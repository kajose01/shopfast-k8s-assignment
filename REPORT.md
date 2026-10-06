# ShopFast – Troubleshooting & Optimization Report

## 1. Symptoms → root cause → fix
| Symptom | Root cause | Fix |
|---|---|---|
| Slow responses | Single backend, no cache hit path, no CPU limits/requests | Redis caching (30 s TTL), 3 backend replicas, requests/limits, HPA (CPU>70%) |
| DB connection failures | Backend started before Mongo ready; default driver timeouts; no pooling | Startup retry loop, `maxPoolSize`, `serverSelectionTimeoutMS`, retryReads/Writes, Mongo readiness probe, `depends_on: service_healthy` |
| Intermittent 503 | Pods receiving traffic before ready / while terminating | Readiness (`/readyz` checks Mongo), liveness, `preStop sleep 5`, `maxUnavailable: 0`, PDBs, SIGTERM handler |
| Inefficient resources | No limits; oversized images | Multi-stage builds, alpine/slim, requests/limits everywhere, HPA scales only on demand |

## 2. Frontend cannot reach backend (service discovery)
```
kubectl get svc backend
kubectl get endpoints backend          # empty ENDPOINTS => selector/readiness problem
kubectl describe svc backend           # compare Selector with pod labels
kubectl get pods --show-labels
kubectl run dns --rm -it --image=busybox:1.36 --restart=Never -- nslookup backend.default.svc.cluster.local
kubectl exec deploy/frontend -- wget -qO- http://backend:5000/healthz
```
Typical causes: label/selector mismatch, wrong targetPort, pods not Ready (so no endpoints), CoreDNS down.
Here the Service selector `app: backend` matches pod labels, and nginx proxies `/api/` to `http://backend:5000`.

## 3. Redis pod crashing
```
kubectl apply -f troubleshooting/redis-crash-demo.yaml
kubectl get pods -l app=redis-broken        # CrashLoopBackOff
kubectl logs <pod> --previous
kubectl describe pod <pod>                  # Last State: Terminated, Reason: OOMKilled, Exit Code 137
```
Root cause: memory limit 10Mi < Redis `maxmemory` 100mb. Fix: limit 160Mi, `--maxmemory 100mb --maxmemory-policy allkeys-lru` (see `k8s/20-redis.yaml`).

## 4. Bonus
- **Mixed content (HTTP/HTTPS):** frontend called `http://…` absolute URLs from an HTTPS page. Fix: relative `/api/...` calls + nginx proxy forwarding `X-Forwarded-Proto`; TLS terminated at ingress/ALB.
- **Backend randomly loses Mongo:** idle sockets dropped + no retry. Fix: pool/idle/heartbeat/timeout options, retries, readiness gate, startup retry loop. The **log sidecar** (`kubectl logs deploy/backend -c log-sidecar`) tails `/var/log/app/app.log` from a shared `emptyDir`, giving structured logs of each `mongo heartbeat failed` event.

## 5. Optimization changes
- Affinity: preferred pod anti-affinity by hostname (spreads when >1 node).
- Resources: requests/limits on all pods. Scaling: HPA backend 3→10 @ CPU 70%. PDBs. RollingUpdate with zero unavailable.

## 6. Extra finding: duplicate products after scaling
Symptom: `/api/products` returned 9 items instead of 3. Root cause: all 3 backend replicas started together, each saw an empty collection and inserted the seed data (check-then-insert race). Fix: idempotent `bulkWrite` upserts keyed by product name, shipped as image `v2` via a zero-downtime rolling update.
