# FarmConnect – HACK-P309 Farmer Marketplace

## Requirements
- Node.js 18+
- MongoDB Atlas cluster and database user
- Internet connection for product photos / Google Fonts

## Setup
1. In `server/`, copy `.env.example` to `.env`.
2. Replace `MONGO_URI` with your MongoDB Atlas connection string. URL-encode special characters in the database password.
3. Set a long random `JWT_SECRET`.
4. From the project root run:
   ```bash
   npm install
   npm run install:all
   npm run seed --prefix server
   npm run dev
   ```
5. Open http://localhost:5173

## Demo accounts
All seeded demo accounts use password `Farm123`:
- Buyer: buyer@farmconnect.demo
- Farmer: ravi@farmconnect.demo
- Admin: admin@farmconnect.demo

Seed creates five farmers and fifteen sample products. Register additional farmer or buyer accounts through the UI.

## Important notes
- This is a hackathon prototype. Payments are simulated; the app does not collect card details.
- Delivery is an arrangement selected in the order request, not an integrated logistics service.
- Product images are image URLs; farmers can paste an image URL in the listing form.
- MongoDB transactions require Atlas running as a replica set (Atlas free clusters support this). Stock decrement and order creation run in a transaction to avoid overselling.
- Demo products are shown in the UI if the API is not connected, but ordering works only for products seeded into MongoDB.
- Basic stock and cancellation business-rule tests: `npm test --prefix server`.
