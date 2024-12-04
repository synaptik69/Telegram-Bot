import express from "express";
import { createUser, getUserBalance } from "../controllers/userController"; // Correct import path

const router = express.Router();

// Define routes and their corresponding handlers
//router.post("/create", createUser);
//router.get("/balance/:id", getUserBalance);

export default router;
