import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile();

const base = process.env.BASE_URL ?? 'http://localhost:3000';
for (const service of ['restaurants', 'orders', 'payments', 'notifications']) {
  const response = await fetch(`${base}/api/${service}/health`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200, `${service} health`);
  assert.equal((await response.json()).status, 'ok');
  console.log(`${service}: healthy through gateway`);
}

async function request(path, { token, method = 'GET', body, key, expected = 200, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  if (expected !== null) assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return { status: response.status, data };
}

async function login(username, password) {
  return (await request('/auth/login', { method: 'POST', body: { username, password } })).data.accessToken;
}
async function eventually(read, check, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const value = await read();
    if (check(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 750));
  }
  assert.fail(`Timed out: ${label}`);
}

const customer = await login('customer', process.env.DEMO_CUSTOMER_PASSWORD);
const customer2 = await login('customer2', process.env.DEMO_CUSTOMER_PASSWORD);
const admin = await login('admin', process.env.DEMO_ADMIN_PASSWORD);
await request('/orders', { expected: 401 });
await request('/auth/login', { method: 'POST', body: { username: 'admin', password: 'incorrect' }, expected: 401 });
await request('/restaurants', { token: customer, method: 'POST', body: { name: 'Forbidden' }, headers: { 'x-user-role': 'admin' }, expected: 403 });

const restaurant = (await request('/restaurants', { token: admin, method: 'POST', body: { name: `Smoke ${randomUUID()}` }, expected: 201 })).data;
const restaurantId = restaurant.id;
try {
  const dish = async (name, priceVnd, stock) => (await request(`/restaurants/${restaurantId}/dishes`, { token: admin, method: 'POST', body: { name, priceVnd, stock }, expected: 201 })).data;
  const main = await dish('Rice', 45000, 10);
  const soup = await dish('Soup', 20000, 10);
  const last = await dish('Last portion', 10000, 1);
  const declined = await dish('Declined checkout', 15000, 2);
  await request(`/restaurants/${restaurantId}/dishes`, { token: admin, method: 'POST', body: { name: 'Invalid', priceVnd: -1, stock: 1 }, expected: 400 });
  assert.equal((await request(`/restaurants/${restaurantId}`)).data.dishes.length, 4);

  const key = randomUUID();
  const body = { restaurantId, items: [{ dishId: main.id, quantity: 2 }, { dishId: soup.id, quantity: 1 }] };
  await request('/orders', { token: customer, method: 'POST', key: randomUUID(), body: { ...body, totalVnd: 1 }, expected: 400 });
  const order = (await request('/orders', { token: customer, method: 'POST', key, body, expected: 201 })).data;
  assert.equal(order.totalVnd, 110000);
  assert.equal(order.items.length, 2);
  const retry = (await request('/orders', { token: customer, method: 'POST', key, body, expected: 201 })).data;
  assert.equal(retry.id, order.id);
  await request('/orders', { token: customer, method: 'POST', key, body: { ...body, items: [{ dishId: main.id, quantity: 1 }] }, expected: 409 });
  await request(`/orders/${order.id}`, { token: customer2, headers: { 'x-user-id': 'customer' }, expected: 404 });
  await request(`/orders/${order.id}/status`, { token: customer, method: 'PATCH', body: { status: 'CONFIRMED' }, expected: 403 });
  await request(`/orders/${order.id}/status`, { token: admin, method: 'PATCH', body: { status: 'READY' }, expected: 409 });

  await eventually(async () => (await request(`/orders/${order.id}`, { token: customer })).data, o => o.status === 'PAID', 'payment event updates order');
  assert.equal((await request(`/payments/${order.id}`, { token: customer })).data.amountVnd, 110000);
  await request(`/payments/${order.id}`, { token: customer2, expected: 404 });
  for (const status of ['CONFIRMED', 'READY']) {
    assert.equal((await request(`/orders/${order.id}/status`, { token: admin, method: 'PATCH', body: { status } })).data.status, status);
  }
  await request(`/orders/${order.id}/status`, { token: admin, method: 'PATCH', body: { status: 'CONFIRMED' }, expected: 409 });
  await eventually(async () => (await request('/notifications', { token: customer })).data,
    rows => rows.some(row => row.type === 'order.ready' && row.orderId === order.id), 'ready notification');
  assert(!(await request('/notifications', { token: customer2 })).data.some(row => row.orderId === order.id));
  console.log('Checkout, authoritative pricing, idempotency, permissions, payment and READY notification: passed');

  const failed = (await request('/orders', { token: customer, method: 'POST', key: randomUUID(), body: {
    restaurantId, items: [{ dishId: declined.id, quantity: 1 }], paymentMethod: 'demo_failure',
  }, expected: 201 })).data;
  await eventually(async () => (await request(`/orders/${failed.id}`, { token: customer })).data, o => o.status === 'CANCELLED', 'declined payment cancels order');
  await eventually(async () => (await request(`/restaurants/${restaurantId}`)).data,
    r => r.dishes.find(d => d.id === declined.id).stock === 2, 'stock restored after payment decline');
  console.log('Payment decline and stock compensation: passed');

  const results = await Promise.all(Array.from({ length: 100 }, () => request('/orders', {
    token: customer, method: 'POST', key: randomUUID(), body: { restaurantId, items: [{ dishId: last.id, quantity: 1 }] }, expected: null,
  })));
  assert.equal(results.filter(r => r.status === 201).length, 1, JSON.stringify(results.map(r => r.status)));
  assert.equal(results.filter(r => r.status === 409).length, 99, JSON.stringify(results.map(r => r.status)));
  const menu = (await request(`/restaurants/${restaurantId}`)).data;
  assert.equal(menu.dishes.find(d => d.id === last.id).stock, 0);
  assert.equal(menu.dishes.find(d => d.id === main.id).stock, 8, 'retry must not reserve twice');
  console.log('100 concurrent orders, one portion: 1 accepted, 99 conflicts, zero oversell');
} finally {
  await request(`/restaurants/${restaurantId}`, { token: admin, method: 'DELETE' });
}
console.log('Full scope B smoke test passed. Order/payment audit records are retained.');
