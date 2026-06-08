# Restaurant Service (Node.js + Express + MongoDB)

Owns the catalog: restaurants, menus, dishes, prices. This is the data the Order Service
calls to validate an order.

## Done for you (plumbing)
- Dockerfile, package.json, `src/index.js` (express bootstrap), `src/config/db.js` (mongo connect)
- `/api/restaurants/health` endpoint

## What YOU code (look for `TODO (YOU CODE THIS)`)
- `models/Restaurant.js` — the Mongoose schema
- `controllers/restaurant.controller.js` — list/get/create + getDish
- `routes/restaurant.routes.js` — map URLs to controllers

## Pre-read
- Why MongoDB for the catalog but MySQL for orders/users? (data shape, relations)
- Database-per-service: why can't Order read this DB directly?

Runs on port **3001**.
