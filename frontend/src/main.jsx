import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

// RELATIVE URLs only -> inherits page scheme (fixes HTTP/HTTPS mixed content)
function App() {
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { fetch('/api/products').then(r => r.json()).then(setProducts).catch(e => setMsg(String(e))); }, []);
  const pay = async (p) => {
    const r = await fetch('/api/pay', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ item: p.name, amount: p.price }) });
    setMsg(JSON.stringify(await r.json()));
  };
  return (<div style={{fontFamily:'sans-serif',padding:24}}>
    <h1>ShopFast</h1>
    {products.map(p => <div key={p.name}>{p.name} - ${p.price} <button onClick={() => pay(p)}>Buy</button></div>)}
    <pre>{msg}</pre></div>);
}
createRoot(document.getElementById('root')).render(<App />);
