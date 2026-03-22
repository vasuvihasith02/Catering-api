const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// In-memory store (Render free tier resets on sleep, but orders persist while awake)
// For permanent storage, upgrade to use a free MongoDB Atlas or Supabase DB
let orders = [];
let nextId = 1;

// ── GET /orders — app polls this every 60 seconds ──
app.get('/orders', (req, res) => {
  res.json({ orders, count: orders.length });
});

// ── POST /orders — Google Apps Script sends here on form submit ──
app.post('/orders', (req, res) => {
  const body = req.body;
  if (!body || (!body.trainName && !body.train_name)) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const order = {
    id: `form_${Date.now()}_${nextId++}`,
    trainNumber:   body.trainNumber   || body.train_number   || '',
    trainName:     body.trainName     || body.train_name     || '',
    date:          body.date          || '',
    time:          body.time          || '',
    coach:         body.coach         || '',
    seatNumber:    body.seatNumber    || body.seat_number    || '',
    persons:       parseInt(body.persons) || 0,
    contactPerson: body.contactPerson || body.contact_person || '',
    contactNumber: body.contactNumber || body.contact_number || body.phone || '',
    foodItems:     body.foodItems     || body.food_items     || body.food || '',
    packing:       (body.packing || 'individual').toLowerCase(),
    plates:        body.plates === true || body.plates === 'Yes' || body.plates === 'true',
    notes:         body.notes         || body.special_instructions || '',
    source:        'form',
    receivedAt:    new Date().toISOString()
  };

  orders.push(order);
  console.log(`✅ New order received: ${order.trainName} #${order.trainNumber} — ${order.persons} persons`);
  res.status(201).json({ success: true, id: order.id });
});

// ── DELETE /orders/:id — optional: mark as synced/delete ──
app.delete('/orders/:id', (req, res) => {
  const before = orders.length;
  orders = orders.filter(o => o.id !== req.params.id);
  res.json({ deleted: before - orders.length });
});

// ── Health check ──
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Catering Orders API is running',
    ordersInQueue: orders.length,
    uptime: Math.round(process.uptime()) + 's'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🍱 Catering API running on port ${PORT}`);
});
