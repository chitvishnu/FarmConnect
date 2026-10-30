import mongoose from "mongoose";
const productSchema = new mongoose.Schema({
  farmer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true },
  image: String,
  unit: { type: String, enum: ["kg", "quintal", "piece", "dozen", "litre", "bunch"], required: true },
  quantity: { type: Number, min: 0, required: true },
  price: { type: Number, min: 0, required: true },
  harvestDate: { type: Date, required: true },
  availabilityDate: { type: Date, required: true },
  fulfillment: { type: String, enum: ["pickup", "delivery", "both"], required: true },
  location: String,
  description: String,
  isActive: { type: Boolean, default: true },
  moderationStatus: { type: String, enum: ["approved", "pending", "rejected"], default: "approved" }
}, { timestamps: true });
export const Product = mongoose.model("Product", productSchema);
