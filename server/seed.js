import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { User } from "./src/models/User.js";
import { Product } from "./src/models/Product.js";
dotenv.config();
await mongoose.connect(process.env.MONGO_URI);
const password = await bcrypt.hash("Farm123", 10);
const farmerData = [
  ["Ravi Kumar","ravi@farmconnect.demo","Hyderabad"],
  ["Lakshmi Devi","lakshmi@farmconnect.demo","Rangareddy"],
  ["Suresh Reddy","suresh@farmconnect.demo","Medchal"],
  ["Anitha Rao","anitha@farmconnect.demo","Sangareddy"],
  ["Mahesh Goud","mahesh@farmconnect.demo","Warangal"]
];
for (const [name,email,location] of farmerData) {
  await User.updateOne({ email }, { $setOnInsert: { name,email,password,role:"farmer",location,phone:"9876543210" } }, { upsert:true });
}
await User.updateOne({ email:"buyer@farmconnect.demo" }, { $setOnInsert:{ name:"Demo Buyer",email:"buyer@farmconnect.demo",password,role:"buyer",location:"Hyderabad" } }, { upsert:true });
await User.updateOne({ email:"admin@farmconnect.demo" }, { $setOnInsert:{ name:"Demo Admin",email:"admin@farmconnect.demo",password,role:"admin",location:"Hyderabad" } }, { upsert:true });
const farmers = await User.find({ role:"farmer" });
const products = [
  ["Tomatoes","Vegetables","kg",80,25,"https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=700"],
  ["Onions","Vegetables","kg",120,32,"https://images.unsplash.com/photo-1508747703725-719777637510?w=700"],
  ["Potatoes","Vegetables","kg",100,28,"https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=700"],
  ["Green Chilli","Vegetables","kg",35,45,"https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=700"],
  ["Spinach","Vegetables","bunch",50,15,"https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=700"],
  ["Carrots","Vegetables","kg",60,40,"https://images.unsplash.com/photo-1445282768818-728615cc910a?w=700"],
  ["Bananas","Fruits","dozen",40,55,"https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=700"],
  ["Mangoes","Fruits","kg",70,90,"https://images.unsplash.com/photo-1553279768-865429fa0078?w=700"],
  ["Apples","Fruits","kg",45,140,"https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=700"],
  ["Papaya","Fruits","kg",55,35,"https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=700"],
  ["Watermelon","Fruits","piece",25,60,"https://images.unsplash.com/photo- watermelon?w=700"],
  ["Rice","Grains","kg",200,48,"https://images.unsplash.com/photo-1586201375761-83865001e31c?w=700"],
  ["Wheat","Grains","kg",180,36,"https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=700"],
  ["Groundnuts","Pulses","kg",75,95,"https://images.unsplash.com/photo-1567892737950-30c4db37cd89?w=700"],
  ["Turmeric","Spices","kg",30,160,"https://images.unsplash.com/photo-1615485500704-8e990f9900f3?w=700"]
];
const today = new Date();
for (let i=0;i<products.length;i++) {
  const [name,category,unit,quantity,price,image] = products[i];
  await Product.updateOne({ name, farmer:farmers[i%farmers.length]._id }, { $setOnInsert:{
    farmer:farmers[i%farmers.length]._id,name,category,unit,quantity,price,image,
    harvestDate:today,availabilityDate:today,fulfillment:"both",
    location:farmers[i%farmers.length].location,description:`Fresh ${name.toLowerCase()} directly from the farm.`,isActive:true,moderationStatus:"approved"
  } }, { upsert:true });
}
console.log("Seed complete. Demo password for all accounts: Farm123");
await mongoose.disconnect();
