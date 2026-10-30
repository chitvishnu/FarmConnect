import mongoose from "mongoose";
const orderSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: String, unit: String, quantity: Number, price: Number, subtotal: Number
  }],
  total: { type: Number, required: true },
  fulfillment: { type: String, enum: ["pickup", "delivery"], required: true },
  paymentMethod: { type: String, default: "cash-on-pickup" },
  notes: String,
  status: { type: String, enum: ["requested", "accepted", "ready", "completed", "cancelled"], default: "requested" }
}, { timestamps: true });
export const Order = mongoose.model("Order", orderSchema);
