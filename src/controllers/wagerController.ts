import Wager from "../models/wagerModel";
import Bet from "../models/betModel";
/**
 * Create a new wager in the database.
 * @param {number} creatorId - ID of the user creating the wager.
 * @param {string} description - Description of the wager.
 * @param {number} wagerAmount - Initial balance of the wager.
 * @param {number} timeLimit - Time limit for the wager.
 * @returns {Promise<object>} - Created wager or error message.
 */
export async function createWager(
  creatorId: number,
  wagerDescription: string,
  timeLimit: number,
  wagerId: number,
  optionA: string,
  optionB: string,
  chatId: number,
  bettingMessageId: number
) {
  try {
    const newWager = await Wager.create({
      creatorId,
      wagerDescription,
      timeLimit,
      status: "Open",
      wagerId,
      totalPotA: 0,
      totalPotB: 0,
      optionA,
      optionB,
      chatId,
      bettingMessageId,
    });
    return { success: true, wager: newWager };
  } catch (error) {
    console.error("Error creating wager:", error);
    return { success: false, message: "Failed to create wager." };
  }
}

export const updateWagerBettingMessageId = async (
  wagerId: number,
  bettingMessageId: number
) => {
  try {
    const result = await Wager.update(
      { bettingMessageId }, // Set bettingMessageId
      { where: { wagerId } } // Find wager by wagerId
    );

    if (result[0] > 0) {
      return { success: true };
    } else {
      return { success: false, error: "No rows updated. Wager not found." };
    }
  } catch (error) {
    console.error("Error updating bettingMessageId:", error);
    return { success: false, message: "Failed to create wager." };
  }
};

export const getRecentOpenWagers = async (limit: number = 5) => {
  try {
    const wagers = await Wager.findAll({
      where: { status: "Open" }, // Fetch only open wagers
      order: [["id", "DESC"]], // Order by most recent
      limit, // Limit the number of results
    });
    return wagers;
  } catch (error) {
    console.error("Error fetching recent open wagers:", error);
    throw new Error("Could not retrieve recent wagers.");
  }
};

export const getRecentClosedWagers = async (limit: number = 5) => {
  try {
    const wagers = await Wager.findAll({
      where: { status: "Closed" }, // Fetch only closed wagers
      order: [["id", "DESC"]], // Most recent first
      limit, // Limit results
    });
    return wagers;
  } catch (error) {
    console.error("Error fetching closed wagers:", error);
    throw new Error("Could not retrieve closed wagers.");
  }
};
