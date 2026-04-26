fetch('http://localhost:3000/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        client_id: 'doc-5',
        warehouse_id: 1,
        expected_delivery: '2026-03-01',
        items: [{ product_id: 1, qty: 1, unit_price: 10 }]
    })
}).then(res => res.text()).then(txt => console.log('Response:', txt)).catch(err => console.error('Fetch Error:', err));
