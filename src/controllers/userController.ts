import { Request, Response } from "express";
import User from "../models/userModel";

export const createUser = async (
  userId: String,
  username: string
): Promise<any> => {
  try {
    // Check if the user already exists in the database
    const existingUser = await User.findOne({ where: { userId } });
    if (existingUser) {
      return { success: false, message: "User already exists." };
    }

    // Create new user in the database
    const newUser = await User.create({
      userId,
      username,
      playMoneyBalance: 100000, // Default balance
    });

    return { success: true, user: newUser };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to create user" };
  }
};

export const getUserBalance = async (userId: number) => {
  try {
    const user = await User.findOne({ where: { userId } });

    if (user) {
      return {
        success: true,
        user: {
          userId: user.userId,
          username: user.username,
          playMoneyBalance: user.playMoneyBalance,
        },
      };
    }

    return { success: false, user: null }; // User not found
  } catch (error) {
    console.error("Error fetching user balance:", error);
    return { success: false, user: null }; // Error scenario
  }
};

export const updateUserBalance = async (
  username: string,
  newBalance: number
): Promise<any> => {
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return { success: false, message: "User not found." };
    }

    // Update the user's balance
    user.playMoneyBalance = newBalance;
    await user.save();

    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, message: "Failed to update balance." };
  }
};
