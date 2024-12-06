import Bet from "../models/betModel";
import Wager from "../models/wagerModel";
import User from "../models/userModel";

// Betting function
export const placeBet = async (
  userId: String,
  wagerId: number,
  option: "A" | "B",
  amount: number,
  username: string
): Promise<any> => {
  try {
    const wager = await Wager.findOne({ where: { wagerId } });
    console.log("-------------------*wagerId----------", wagerId);
    if (!wager) {
      return { success: false, message: "Wager not found." };
    }

    wager.totalPotA = wager.totalPotA || 0;
    wager.totalPotB = wager.totalPotB || 0;

    console.log("amount", amount);
    console.log("option", option);
    console.log("totalPotA", wager.totalPotA);
    console.log("totalPotB", wager.totalPotB);

    // Update the pot for the chosen option
    if (option === "A") {
      wager.totalPotA += amount; // Add amount to totalPotA
    } else if (option === "B") {
      wager.totalPotB += amount; // Add amount to totalPotB
    }
    console.log("UpdatedtotalPotA", wager.totalPotA);
    console.log("UpdatedtotalPotB", wager.totalPotB);
    await wager.save();

    // Store the bet
    const newBet = await Bet.create({
      userId,
      wagerId,
      choice: option,
      amount,
      username,
    });

    return { success: true, bet: newBet, updatedWager: wager };
  } catch (error) {
    console.error("Error placing bet:", error);
    return { success: false, message: "Failed to place bet." };
  }
};

// Function to calculate odds
export const calculateOdds = async (wagerId: number): Promise<any> => {
  const wager = await Wager.findOne({ where: { wagerId } });
  console.log("=================calculateodds", wagerId);

  if (!wager) {
    return { success: false, message: "Wager not found." };
  }

  const totalPotA = wager.totalPotA || 0;
  const totalPotB = wager.totalPotB || 0;
  const totalPot = totalPotA + totalPotB;
  console.log("totalPotA:", totalPotA);
  console.log("totalPotB:", totalPotB);
  console.log("totalPot:", totalPot);

  // Odds calculation
  const oddsA = totalPotA > 0 ? totalPot / totalPotA : 0;
  const oddsB = totalPotB > 0 ? totalPot / totalPotB : 0;

  console.log("oddsA:", oddsA);
  console.log("oddsB:", oddsB);
  return { success: true, oddsA, oddsB };
};

export const checkUserBet = async (
  userId: number,
  wagerId: number
): Promise<boolean> => {
  // Check the database to see if the user placed a bet on the wager
  if (!Number.isInteger(userId) || !Number.isInteger(wagerId)) {
    console.error("Invalid userId or wagerId. Must be integers.");
    return false;
  }

  // Query the database for the bet
  const bet = await Bet.findOne({
    where: { wagerId, userId },
  });

  console.log("1111111bet", bet);
  return !!bet;
};

export const getTotalBettors = async (wagerId: number): Promise<any> => {
  // Use Bet.distinct() to get unique userIds based on wagerId
  const bettors = await Bet.count({
    distinct: true,
    where: {
      wagerId,
    },
    col: "userId",
  }); // exec() to handle promise
  return bettors; // Return the count of unique bettors
};

export const closeBetting = async (wagerId: number): Promise<any> => {
  try {
    // Update wager status to "closed"
    const [affectedRows] = await Wager.update(
      { status: "Closed" }, // The fields you want to update
      { where: { wagerId } } // The condition to match the wagerId
    );

    if (affectedRows > 0) {
      console.log(`Wager with ID ${wagerId} has been closed.`);
    } else {
      console.log(`No wager found with ID ${wagerId}.`);
    }
  } catch (error) {
    console.error("Error closing the wager:", error);
    throw new Error("Failed to close the wager.");
  }
};
