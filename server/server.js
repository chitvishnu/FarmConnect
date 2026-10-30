import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "./src/models/User.js";
import { Product } from "./src/models/Product.js";
import { Order } from "./src/models/Order.js";
import { auth, allow } from "./src/middleware/auth.js";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "FarmConnect API" }));

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, location } = req.body;
    if (!name || !email || !password || !["farmer", "buyer"].includes(role)) {
      return res.status(400).json({ message: "Name, email, password and valid account type are required." });
    }
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ message: "An account with this email already exists." });
    const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 10), role, phone, location });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: String(req.body.email || "").toLowerCase() });
    if (!user || !(await bcrypt.compare(req.body.password || "", user.password))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

function sign(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
}
function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, location: user.location };
}

app.get("/api/users/farmers", async (_req, res) => {
  const farmers = await User.find({ role: "farmer" }).select("name location phone");
  res.json(farmers);
});

app.get("/api/products", async (req, res) => {
  const { search, category, location, minPrice, maxPrice, available } = req.query;
  const filter = { isActive: true, moderationStatus: "approved" };
  if (search) filter.name = { $regex: search, $options: "i" };
  if (category && category !== "All") filter.category = category;
  if (location) filter.location = { $regex: location, $options: "i" };
  if (available === "true") filter.quantity = { $gt: 0 };
  if (minPrice || maxPrice) filter.price = { ...(minPrice ? { $gte: Number(minPrice) } : {}), ...(maxPrice ? { $lte: Number(maxPrice) } : {}) };
  const products = await Product.find(filter).populate("farmer", "name location");
  res.json(products);
});

app.post("/api/products", auth, allow("farmer"), async (req, res) => {
  try {
    const { name, category, image, unit, quantity, price, harvestDate, availabilityDate, fulfillment, description } = req.body;
    if (!name || !category || !unit || Number(quantity) <= 0 || Number(price) <= 0 || !harvestDate || !availabilityDate || !["pickup", "delivery", "both"].includes(fulfillment)) {
      return res.status(400).json({ message: "Please complete all required product fields with valid quantity and price." });
    }
    const product = await Product.create({
      farmer: req.user.id, name, category, image, unit, quantity: Number(quantity), price: Number(price),
      harvestDate, availabilityDate, fulfillment, description, location: req.body.location || req.user.location || "Location not specified"
    });
    res.status(201).json(product);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

app.get("/api/products/mine", auth, allow("farmer"), async (req, res) => {
  res.json(await Product.find({ farmer: req.user.id }).sort({ createdAt: -1 }));
});

app.patch("/api/products/:id", auth, allow("farmer"), async (req, res) => {
  const product = await Product.findOne({ _id: req.params.id, farmer: req.user.id });
  if (!product) return res.status(404).json({ message: "Product not found." });
  const allowed = ["name", "category", "image", "unit", "quantity", "price", "harvestDate", "availabilityDate", "fulfillment", "description", "isActive"];
  for (const key of allowed) if (req.body[key] !== undefined) product[key] = req.body[key];
  await product.save();
  res.json(product);
});

app.delete("/api/products/:id", auth, allow("farmer"), async (req, res) => {
  const product = await Product.findOneAndUpdate({ _id: req.params.id, farmer: req.user.id }, { isActive: false }, { new: true });
  if (!product) return res.status(404).json({ message: "Product not found." });
  res.json({ message: "Listing removed." });
});

app.post("/api/orders", auth, allow("buyer"), async (req, res) => {
  const { items, fulfillment, notes } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: "Your cart is empty." });
  if (!["pickup", "delivery"].includes(fulfillment)) return res.status(400).json({ message: "Choose pickup or delivery." });

  const session = await mongoose.startSession();
  try {
    let createdOrder;
    await session.withTransaction(async () => {
      const lines = [];
      let total = 0;
      for (const item of items) {
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Order quantity must be greater than zero.");
        const product = await Product.findOneAndUpdate(
          { _id: item.productId, isActive: true, moderationStatus: "approved", quantity: { $gte: qty }, fulfillment: { $in: [fulfillment, "both"] } },
          { $inc: { quantity: -qty } }, { new: true, session }
        ).populate("farmer", "name location");
        if (!product) throw new Error("One or more products have insufficient stock or do not support the selected fulfillment option.");
        const subtotal = product.price * qty;
        total += subtotal;
        lines.push({ product: product._id, farmer: product.farmer._id, name: product.name, unit: product.unit, quantity: qty, price: product.price, subtotal });
      }
      const farmers = [...new Set(lines.map(x => String(x.farmer)))];
      if (farmers.length !== 1) throw new Error("Please place separate orders for products from different farmers.");
      [createdOrder] = await Order.create([{ buyer: req.user.id, farmer: farmers[0], items: lines, total, fulfillment, notes, status: "requested", paymentMethod: "cash-on-pickup" }], { session });
    });
    res.status(201).json(await createdOrder.populate(["buyer", "farmer"]));
  } catch (e) { res.status(400).json({ message: e.message }); }
  finally { await session.endSession(); }
});

app.get("/api/orders/mine", auth, async (req, res) => {
  const filter = req.user.role === "farmer" ? { farmer: req.user.id } : { buyer: req.user.id };
  res.json(await Order.find(filter).populate("buyer", "name email phone").populate("farmer", "name location").sort({ createdAt: -1 }));
});

app.patch("/api/orders/:id/status", auth, async (req, res) => {
  const { status } = req.body;
  const allowedStatuses = ["accepted", "ready", "completed", "cancelled"];
  if (!allowedStatuses.includes(status)) return res.status(400).json({ message: "Invalid order status." });
  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found." });
  const isFarmer = req.user.role === "farmer" && String(order.farmer) === req.user.id;
  const isBuyer = req.user.role === "buyer" && String(order.buyer) === req.user.id;
  const isAdmin = req.user.role === "admin";
  if (!isFarmer && !isBuyer && !isAdmin) return res.status(403).json({ message: "Not allowed." });
  if (status === "cancelled") {
    if (["completed", "cancelled"].includes(order.status)) return res.status(400).json({ message: "This order can no longer be cancelled." });
    if (!isBuyer && !isFarmer && !isAdmin) return res.status(403).json({ message: "Not allowed." });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const fresh = await Order.findOne({ _id: order._id, status: { $nin: ["completed", "cancelled"] } }).session(session);
        if (!fresh) throw new Error("Order has already been closed.");
        for (const item of fresh.items) await Product.updateOne({ _id: item.product }, { $inc: { quantity: item.quantity } }, { session });
        fresh.status = "cancelled";
        await fresh.save({ session });
      });
    } finally { await session.endSession(); }
    return res.json(await Order.findById(order._id).populate("buyer farmer"));
  }
  if (!isFarmer && !isAdmin) return res.status(403).json({ message: "Only the farmer can update order progress." });
  const transitions = { requested: ["accepted"], accepted: ["ready"], ready: ["completed"] };
  if (!(transitions[order.status] || []).includes(status)) return res.status(400).json({ message: `Cannot move an order from ${order.status} to ${status}.` });
  order.status = status;
  await order.save();
  res.json(await order.populate(["buyer", "farmer"]));
});

app.get("/api/admin/products", auth, allow("admin"), async (_req, res) => {
  res.json(await Product.find().populate("farmer", "name email location").sort({ createdAt: -1 }));
});
app.patch("/api/admin/products/:id/moderate", auth, allow("admin"), async (req, res) => {
  const { moderationStatus } = req.body;
  if (!["approved", "rejected"].includes(moderationStatus)) return res.status(400).json({ message: "Choose approved or rejected." });
  const product = await Product.findByIdAndUpdate(req.params.id, { moderationStatus, isActive: moderationStatus === "approved" }, { new: true });
  if (!product) return res.status(404).json({ message: "Product not found." });
  res.json(product);
});
app.get("/api/admin/users", auth, allow("admin"), async (_req, res) => {
  res.json(await User.find().select("-password").sort({ createdAt: -1 }));
});

const port = process.env.PORT || 5000;
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error("Set MONGO_URI and JWT_SECRET in server/.env");
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(port, () => console.log(`FarmConnect API running at http://localhost:${port}`)))
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
