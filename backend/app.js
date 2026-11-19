import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import morgan from "morgan";
import {connectDB} from "./db.js";
import helmet from "helmet";
import authRoutes from "./routes/userRoutes.js";
import {notFound, errorHandler} from "./middleware/errorHandler.js";
import adminUserRoutes from "./routes/adminRoutes.js";
import productRoutes from "./routes/productRoutes.js"
import http from 'http';
import { initSocket } from './socket/index.js';
import cartRoutes from './routes/cartRoutes.js';
import postRoutes from './routes/postRoutes.js';
import followRoutes from './routes/followRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import userRoutes from './routes/userRoutes.js';
import walletRoutes from "./routes/walletRoutes.js"
import savingsRoutes from "./routes/savingRoutes.js"
import plansRoutes from "./routes/planRoutes.js"
import { startSavingsJob } from "./utils/savingsJobs.js";

dotenv.config();
connectDB();

const app = express();

const server = http.createServer(app);   
app.use(cors());
app.use(helmet());

app.use(express.json());
app.use(morgan("dev"));
app.use(express.json({ limit: "1mb" }));
app.set("trust proxy", 1);


app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);

app.use("/api/admin", adminUserRoutes);
app.use("/api/products", productRoutes)

app.use('/api/cart', cartRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/users', userRoutes);
app.use("/api/wallet", walletRoutes)
app.use('/api/savings', savingsRoutes);
app.use('/api/plans', plansRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;


initSocket(server);
startSavingsJob()
server.listen(PORT, ()=> {
   console.log(`Server is running on port ${PORT}`);
});



