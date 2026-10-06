const express = require('express');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const { createClient } = require('redis');

const PORT = process.env.PORT || 5000;
const MONGO_URL = process.env.MONGO_URL;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const PAYMENT_URL = process.env.PAYMENT_URL || 'http://payment:5001';
const LOG_FILE = process.env.LOG_FILE || '/var/log/app/app.log';

function log(level, msg, extra = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...extra });
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}   // read by sidecar
}

let db, redis, mongoOk = false, redisOk = false;

async function connectMongo() {
  // Pooling + timeouts + retries => fixes random connection loss under load
  const client = new MongoClient(MONGO_URL, {
    maxPoolSize: 50, minPoolSize: 5, maxIdleTimeMS: 60000,
    serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000,
    heartbeatFrequencyMS: 10000, retryReads: true, retryWrites: true,
  });
  client.on('serverHeartbeatFailed', e => { mongoOk = false; log('warn', 'mongo heartbeat failed', { err: String(e.failure) }); });
  client.on('serverHeartbeatSucceeded', () => { mongoOk = true; });
  for (;;) {
    try { await client.connect(); db = client.db('shopfast'); mongoOk = true; log('info', 'mongo connected'); break; }
    catch (e) { log('error', 'mongo connect failed, retrying', { err: String(e) }); await new Promise(r => setTimeout(r, 3000)); }
  }
  // idempotent seed: safe when several replicas start at the same time
  await db.collection('products').bulkWrite(
    [['Keyboard', 49], ['Mouse', 25], ['Monitor', 189]].map(([name, price]) =>
      ({ updateOne: { filter: { name }, update: { $set: { name, price } }, upsert: true } })));
}

async function connectRedis() {
  redis = createClient({ url: REDIS_URL, socket: { reconnectStrategy: n => Math.min(n * 200, 3000) } });
  redis.on('ready', () => { redisOk = true; log('info', 'redis ready'); });
  redis.on('end', () => { redisOk = false; });
  redis.on('error', e => { redisOk = false; log('warn', 'redis error', { err: String(e) }); });
  redis.connect().catch(() => {});
}

const app = express();
app.use(express.json());
app.use((req, _res, next) => { log('info', 'req', { method: req.method, url: req.url }); next(); });

app.get('/healthz', (_q, r) => r.send('ok'));                                  // liveness
app.get('/readyz', (_q, r) => (mongoOk ? r.send('ready') : r.status(503).send('mongo down'))); // readiness

app.get('/api/products', async (_q, res) => {
  try {
    if (redisOk) { const c = await redis.get('products'); if (c) return res.json(JSON.parse(c)); }
    const items = await db.collection('products').find({}, { projection: { _id: 0 } }).toArray();
    if (redisOk) await redis.set('products', JSON.stringify(items), { EX: 30 });
    res.json(items);
  } catch (e) { log('error', 'products failed', { err: String(e) }); res.status(500).json({ error: 'internal' }); }
});

app.post('/api/pay', async (req, res) => {
  try {
    const r = await fetch(`${PAYMENT_URL}/pay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(5000) });
    res.status(r.status).json(await r.json());
  } catch (e) { log('error', 'payment failed', { err: String(e) }); res.status(502).json({ error: 'payment unavailable' }); }
});

// CPU burner to demo the HPA
app.get('/api/stress', (_q, res) => { const end = Date.now() + 200; while (Date.now() < end) Math.sqrt(Math.random()); res.send('burned'); });

const server = app.listen(PORT, () => log('info', `backend listening on ${PORT}`));
server.keepAliveTimeout = 65000;
connectMongo(); connectRedis();
process.on('SIGTERM', () => { log('info', 'SIGTERM, draining'); server.close(() => process.exit(0)); });
