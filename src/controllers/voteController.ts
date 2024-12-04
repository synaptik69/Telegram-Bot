import Wager from "../models/wagerModel";
import Vote from "../models/voteModel";
import Bet from "../models/betModel";
import User from "../models/userModel";

export async function getBettorsForOption(
  wagerId: number,
  option: "A" | "B"
): Promise<any> {
  try {
    const bettors = await Bet.count({
      where: {
        wagerId, // Matches the wager ID
        choice: option, // Matches the option ("A" or "B")
      },
      distinct: true, // Only retrieve the userId field
      col: "userId",
    });

    // Extract user IDs from the result and return them as an array
    //return bettors.map((bet) => bet.userId);
    return bettors;
  } catch (error) {
    console.error(
      `Error fetching bettors for wager ${wagerId} and option ${option}:`,
      error
    );
    throw new Error("Could not retrieve bettors for the specified option.");
  }
}

export async function settleWager(
  wagerId: number,
  outcome: "A" | "B"
): Promise<void> {
  try {
    // Retrieve the wager from the database
    const wager = await Wager.findOne({ where: { wagerId } });

    if (!wager) {
      throw new Error(`Wager with ID ${wagerId} not found.`);
    }

    // Set the outcome in the wager model
    wager.outcome = outcome;
    await wager.save(); // Save the updated wager

    // Get all the bets for the selected outcome
    const winningBets = await Bet.findAll({
      where: {
        wagerId,
        choice: outcome,
      },
    });

    // Get the total amount of winning bets for the selected outcome
    const totalWinningAmount = winningBets.reduce(
      (total, bet) => total + bet.amount,
      0
    );

    // Get all bets for the wager (both sides)
    const totalBetsA = await Bet.findAll({
      where: {
        wagerId,
        choice: "A",
      },
    });

    const totalBetsB = await Bet.findAll({
      where: {
        wagerId,
        choice: "B",
      },
    });

    const totalPotA = totalBetsA.reduce((total, bet) => total + bet.amount, 0);
    const totalPotB = totalBetsB.reduce((total, bet) => total + bet.amount, 0);

    // If the outcome is A, distribute the winnings to the winning bettors
    if (outcome === "A") {
      const winningAmountPerBet =
        totalPotA > 0 ? totalWinningAmount / totalPotA : 0;

      // Distribute winnings to the bettors who voted for A
      for (const bet of winningBets) {
        // Calculate the winning amount for each bettor based on their bet
        const winnings = bet.amount * winningAmountPerBet;

        // You could add the winnings to the user's account here or perform other actions
        // For now, we can just log it
        console.log(`User ${bet.userId} wins ${winnings}`);
      }
    }

    // If the outcome is B, distribute the winnings to the winning bettors
    if (outcome === "B") {
      const winningAmountPerBet =
        totalPotB > 0 ? totalWinningAmount / totalPotB : 0;

      // Distribute winnings to the bettors who voted for B
      for (const bet of winningBets) {
        // Calculate the winning amount for each bettor based on their bet
        const winnings = bet.amount * winningAmountPerBet;

        // You could add the winnings to the user's account here or perform other actions
        // For now, we can just log it
        console.log(`User ${bet.userId} wins ${winnings}`);
      }
    }

    // Notify the group chat about the settled wager
    // You can add bot.sendMessage or another way to notify users about the result
    console.log(`Wager ${wagerId} has been settled with outcome ${outcome}`);

    // Get bettors for the winning outcome
    //const bettors = await getBettorsForOutcome(wagerId, outcome);

    // Generate the table to display in the group chat
    //const bettorTable = generateBettorTable(bettors);
  } catch (error) {
    console.error(`Error settling wager ${wagerId}:`, error);
    throw new Error("Failed to settle wager.");
  }
}

async function payOutWinnings(userId: number, payoutAmount: number) {
  try {
    // Assume the `userId` is linked to a payment system for payout
    console.log(`Paying out ${payoutAmount} to user ${userId}`);
    // Payment logic here: send the payout to the user's account.
  } catch (error) {
    console.error(`Error paying out winnings to user ${userId}:`, error);
  }
}

/**
 * Refunds all bets placed for a wager.
 * @param wagerId - The ID of the wager to refund.
 * @returns A promise that resolves when all bets are refunded.
 */
export async function refundWager(wagerId: number): Promise<void> {
  const transaction = await Wager.sequelize?.transaction(); // Start a transaction to ensure consistency

  if (!transaction) {
    throw new Error("Failed to initialize a transaction.");
  }

  try {
    // Retrieve the wager from the database
    const wager = await Wager.findOne({ where: { wagerId } });

    if (!wager) {
      throw new Error(`Wager with ID ${wagerId} not found.`);
    }

    // Retrieve all bets placed for this wager
    const bets = await Bet.findAll({
      where: { wagerId },
      transaction, // Ensure bets are retrieved within the transaction
    });

    if (bets.length === 0) {
      throw new Error(`No bets found for wager ID ${wagerId}.`);
    }

    // Process each bet and refund the amount to the user
    for (const bet of bets) {
      const { userId, amount } = bet;

      // Refund logic - In a real application, you would probably credit the user's balance here.
      console.log(`Refunding user ${userId}: Amount ${amount}`);

      // Here you would typically update the user's balance or notify the user of the refund
      // Example:
      // await userService.refundUser(userId, amount); // This could be a function to handle user refunds

      // Optionally notify the user (bot example):
      // await bot.sendMessage(userId, `Your bet on wager ${wagerId} has been refunded. Amount: ${amount}`);

      // Delete the bet to mark it as refunded
      await bet.destroy({ transaction }); // Delete the bet record as it's refunded
    }

    // Optionally, set the wager status to "Refunded" (if you use such status)
    wager.status = "Refunded";
    await wager.save({ transaction });

    // Commit the transaction to apply changes
    await transaction.commit();

    console.log(
      `All bets for wager ${wagerId} have been refunded successfully.`
    );
  } catch (error) {
    // If anything goes wrong, rollback the transaction
    if (transaction) {
      await transaction.rollback();
    }

    console.error(`Error while refunding wager ${wagerId}:`, error);
    throw new Error("Failed to refund wager.");
  }
}

export const createVote = async (
  wagerId: number,
  userId: number,
  voteOption: "A" | "B"
): Promise<{ success: boolean; message: string }> => {
  try {
    // Check if the user has already voted for this wager
    const existingVote = await Vote.findOne({ where: { wagerId, userId } });
    if (existingVote) {
      return {
        success: false,
        message: "You have already voted for this wager.",
      };
    }

    // Create the new vote
    await Vote.create({ wagerId, userId, vote: voteOption });

    return {
      success: true,
      message: "Your vote has been recorded successfully.",
    };
  } catch (error) {
    console.error("Error creating vote:", error);
    return {
      success: false,
      message: "An error occurred while recording your vote.",
    };
  }
};

// export const getVoteCounts = async (
//   wagerId: number
// ): Promise<{ A: number; B: number }> => {
//   try {
//     // const countA = await Vote.count({ where: { wagerId, vote: "A" } });
//     // const countB = await Vote.count({ where: { wagerId, vote: "B" } });
//     const countA = await Vote.count({
//       where: {
//         wagerId, // Matches the wager ID
//         vote: "A", // Matches the option ("A" or "B")
//       },
//       attributes: ["userId"],
//     });

//     const countB = await Vote.count({
//       where: {
//         wagerId, // Matches the wager ID
//         vote: "B", // Matches the option ("A" or "B")
//       },
//       attributes: ["userId"],
//     });

//     console.log("------countA and count B", countA, countB);
//     return { A: countA, B: countB };
//   } catch (error) {
//     console.error("Error fetching vote counts:", error);
//     throw new Error("Failed to fetch vote counts.");
//   }
// };

export const getVoteCounts = async (
  wagerId: number
): Promise<{
  votedA_betA: any;
  votedA_betB: number;
  votedB_betA: number;
  votedB_betB: number;
}> => {
  console.log("wagerId", wagerId);
  try {
    const usersVotedA = await Vote.findAll({
      where: {
        wagerId,
        vote: "A",
      },
      attributes: ["userId"], // Only fetch userId
      raw: true, // Return raw data instead of Sequelize instances
    });

    const userIdsVotedA = usersVotedA.map((vote) => vote.userId);

    const votedA_betA = await Bet.count({
      where: {
        wagerId,
        choice: "A",
        userId: userIdsVotedA, // Only consider users who voted "A"
      },
      distinct: true, // Ensure unique users are counted
      col: "userId",
    });

    const votedA_betB = await Bet.count({
      where: {
        wagerId,
        choice: "B",
        userId: userIdsVotedA, // Only consider users who voted "A"
      },
      distinct: true, // Ensure unique users are counted
      col: "userId",
    });

    const usersVotedB = await Vote.findAll({
      where: {
        wagerId,
        vote: "B",
      },
      attributes: ["userId"], // Only fetch userId
      raw: true, // Return raw data instead of Sequelize instances
    });

    const userIdsVotedB = usersVotedB.map((vote) => vote.userId);

    const votedB_betA = await Bet.count({
      where: {
        wagerId,
        choice: "A",
        userId: userIdsVotedB, // Only consider users who voted "A"
      },
      distinct: true, // Ensure unique users are counted
      col: "userId",
    });

    const votedB_betB = await Bet.count({
      where: {
        wagerId,
        choice: "B",
        userId: userIdsVotedB, // Only consider users who voted "A"
      },
      distinct: true, // Ensure unique users are counted
      col: "userId",
    });

    console.log(
      "votedA_betA, votedA_betB, votedB_betA, votedB_betB",
      votedA_betA,
      votedA_betB,
      votedB_betA,
      votedB_betB
    );
    return { votedA_betA, votedA_betB, votedB_betA, votedB_betB };
  } catch (error) {
    console.error("Error fetching combined vote and bet counts:", error);
    throw new Error("Failed to fetch combined vote and bet counts.");
  }
};

export const hasUserVoted = async (
  userId: number,
  wagerId: number
): Promise<any> => {
  try {
    // Log for debugging purposes
    console.log(`Checking if user ${userId} has voted for wager ${wagerId}`);

    const vote = await Vote.findOne({ where: { userId, wagerId } });

    // Log the result for debugging
    console.log(`Vote found: ${vote ? "Yes" : "No"}`);

    return !!vote;
  } catch (error) {
    console.error("Error checking user vote:", error);
    throw new Error("Failed to check if user has voted.");
  }
};

export const getBettorsForOutcome = async (
  wagerId: number,
  outcome: "A" | "B",
  tempOdds: number,
  telegramUsername: any
): Promise<any> => {
  try {
    // Fetch all bets placed on the specified wager and outcome
    const bettors = await Bet.findAll({
      where: {
        wagerId: wagerId,
        choice: outcome, // Filtering by the outcome choice ('A' or 'B')
      },
      include: [
        {
          model: User, // Include the User model to access user details
          attributes: ["id", "username"], // Select specific fields from the User model
        },
      ],
    });

    if (!bettors.length) {
      console.warn(
        `No bettors found for wagerId: ${wagerId} and outcome: ${outcome}`
      );
      return [];
    }

    const wager = await Wager.findOne({ where: { wagerId } });
    if (!wager) {
      return { success: false, message: "Wager not found." };
    }
    // Process the results into a readable format
    const bettorData = bettors.map((bet) => ({
      userId: bet.userId,
      name: telegramUsername || "Unknown", // Use the username or fallback to "Unknown"
      option: bet.choice,
      betAmount: bet.amount,
      odds: (tempOdds - 1).toFixed(2), // You might want to adjust this based on actual data
      profit: bet.amount * (tempOdds - 1), // Example profit calculation (adjust as needed)
      amountPaidOut: bet.amount * tempOdds, // Adjust this based on actual payout rules
    }));

    console.log("-------bettorData in getBettorsForOutcome-------", bettorData);
    return bettorData;
  } catch (error) {
    console.error("Error fetching bettors for outcome:", error);
    throw new Error("Failed to fetch bettors for the specified outcome.");
  }
};

// export const generateBettorTable = (
//   bettorData: {
//     userId: number; // Ensure userId is included in the bettorData
//     name: string; // This field won't be used anymore in the output table
//     option: string;
//     betAmount: number;
//     odds: string | number; // odds can be a string or number, so ensure it's handled correctly
//     profit: number;
//     amountPaidOut: number;
//   }[]
// ): string => {
//   if (!bettorData || bettorData.length === 0) {
//     return "No bettors found for this outcome.";
//   }

//   console.log("=========bettordata in generateBettorTable", bettorData);

//   // Define compact column widths
//   const colWidths = {
//     userId: 10, // Player ID width (instead of name)
//     option: 3, // Option width
//     betAmount: 7, // Bet Amount width
//     odds: 4, // Odds width
//     profit: 8, // Profit width
//     amountPaidOut: 8, // Amount Paid Out width
//   };

//   // Format a single row
//   const formatRow = (
//     userId: string, // This now takes userId instead of name
//     option: string,
//     betAmount: string,
//     odds: string, // Odds should be passed as a string
//     profit: string,
//     amountPaidOut: string
//   ) => {
//     return `| ${userId.padEnd(colWidths.userId, " ")} | ${option.padEnd(
//       colWidths.option,
//       " "
//     )} | ${betAmount.padStart(colWidths.betAmount, " ")} | ${odds.padStart(
//       colWidths.odds,
//       " "
//     )} | ${profit.padStart(colWidths.profit, " ")} | ${amountPaidOut.padStart(
//       colWidths.amountPaidOut,
//       " "
//     )} |`;
//   };

//   // Header row
//   const header = formatRow("User ID", "Opt", "Bet", "Odds", "Profit", "Paid");

//   // Separator
//   const separator =
//     `|-${"-".repeat(colWidths.userId)}-|-` +
//     `${"-".repeat(colWidths.option)}-|-` +
//     `${"-".repeat(colWidths.betAmount)}-|-` +
//     `${"-".repeat(colWidths.odds)}-|-` +
//     `${"-".repeat(colWidths.profit)}-|-` +
//     `${"-".repeat(colWidths.amountPaidOut)}-|`;

//   // Data rows
//   const rows = bettorData.map((bettor) => {
//     const userId = bettor.userId.toString(); // Use userId in string format
//     const option = bettor.option;
//     const betAmount = bettor.betAmount.toString();
//     const odds = bettor.odds.toString(); // Ensure odds is a string
//     const profit = bettor.profit.toFixed(2); // Format profit as two decimal places
//     const amountPaidOut = bettor.amountPaidOut.toFixed(2); // Format amount paid out as two decimal places
//     return formatRow(userId, option, betAmount, odds, profit, amountPaidOut);
//   });

//   // Combine header, separator, and rows
//   return [header, separator, ...rows].join("\n");
// };

export const generateBettorTable = (
  bettorData: {
    userId: number; // Ensure userId is included in the bettorData
    telegramUsername: string; // Username instead of name
    option: string;
    betAmount: number;
    odds: string | number; // odds can be a string or number, so ensure it's handled correctly
    profit: number;
    amountPaidOut: number;
  }[]
): string => {
  if (!bettorData || bettorData.length === 0) {
    return "No bettors found for this outcome.";
  }

  // Header row
  const header = "👨Username 💰Bet 🎲Odds 📈Profit 🤑Pay Out";

  // Data rows
  const rows = bettorData.map((bettor) => {
    const username = `@${bettor.telegramUsername}`; // Fallback for missing usernames
    const betAmount = `$${bettor.betAmount.toFixed(2)}`; // Format bet amount with $ and two decimals
    const odds =
      typeof bettor.odds === "number"
        ? `${bettor.odds.toFixed(2)}x`
        : `${bettor.odds}x`; // Ensure odds is formatted correctly
    const profit = `$${bettor.profit.toFixed(2)}`; // Format profit with $ and two decimals
    const amountPaidOut = `$${bettor.amountPaidOut.toFixed(2)}`; // Format payout with $ and two decimals

    return `👨${username} 💰${betAmount} 🎲${odds} 📈${profit} 🤑${amountPaidOut}`;
  });

  // Combine header and rows
  return [header, ...rows].join("\n");
};
