import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
import {
  createUser,
  getUserBalance,
  updateUserBalance,
} from "../controllers/userController"; // Import user controller
import {
  createWager,
  getRecentOpenWagers,
  updateWagerBettingMessageId,
  getRecentClosedWagers,
} from "../controllers/wagerController";
import { placeBet } from "../controllers/betController";
import {
  calculateOdds,
  checkUserBet,
  getTotalBettors,
  closeBetting,
} from "../controllers/betController";
import {
  getBettorsForOption,
  settleWager,
  refundWager,
  hasUserVoted,
  createVote,
  getVoteCounts,
  generateWinnerBettorTable,
  generateLoserBettorTable,
  getBettorsForOutcome,
} from "../controllers/voteController";

dotenv.config(); // Load environment variables

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN!, { polling: false }); // Set polling to true for real-time interaction

// Set commands for the bot's menu button
bot.setMyCommands(
  [
    { command: "/start", description: "Start the bot" },
    { command: "/betting_history", description: "Get help" },
    //{ command: "/balance", description: "Check your balance" },
    { command: "/create_wager", description: "Create a new wager" },
  ],
  { scope: { type: "all_private_chats" } } // Commands only in private chats
);

// Define the chat ID of your group
const groupChatId = "@bettingtestgroup"; // Replace with your actual group username or chat ID
//const groupChatId = "@socialwagergroup"; // Replace with your actual group username or chat ID

// In-memory data store for temporary values
const tempStore: Record<number, { confirmationMessageId?: number }> = {};

// Handle the /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId: any = msg.from?.id;

  if (!userId) {
    return bot.sendMessage(
      chatId,
      "An error occurred. We couldn't retrieve your user ID."
    );
  }

  try {
    // Check if the user already exists in the database
    const existingUser = await getUserBalance(userId);

    if (existingUser && existingUser.success && existingUser.user) {
      // User exists, alert their balance
      return bot.sendMessage(
        chatId,
        `
        <b>🎉 Welcome Back, ${existingUser.user.username}!</b>

        📌 You have already created your account.\n        Here are your details:

        💵 <b>Balance:</b> $${existingUser.user.playMoneyBalance}

        Happy gaming! 🚀`,
        { parse_mode: "HTML" } // Use HTML for post-like formatting
      );
    }

    // User does not exist, prompt to create an account
    await bot.sendMessage(
      chatId,
      "Welcome to the bot! It looks like you don't have an account yet.\n Please input your username to create one:"
    );

    // Listen for username input
    bot.once("message", async (usernameMsg) => {
      if (usernameMsg.chat.id !== chatId) return;
      const inputUsername = usernameMsg.text;
      if (!inputUsername || inputUsername.startsWith("/")) return;

      try {
        await bot.sendMessage(chatId, `You entered: ${inputUsername}.`);

        // Ask for confirmation using Inline Keyboard
        const keyboard = {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "Yes",
                  callback_data: `create_${userId}_${inputUsername}`,
                },
                { text: "No", callback_data: "cancel_create" },
              ],
            ],
          },
        };

        const confirmationMessage = await bot.sendMessage(
          chatId,
          `Would you like to create your account with this username-"${inputUsername}"?`,
          keyboard
        );

        tempStore[chatId] = {
          confirmationMessageId: confirmationMessage.message_id,
        };
      } catch (error) {
        console.error("Error during account creation flow:", error);
        bot.sendMessage(
          chatId,
          "An error occurred while setting up your account."
        );
      }
    });
  } catch (error) {
    console.error("Error checking user existence:", error);
    bot.sendMessage(chatId, "An error occurred. Please try again later.");
  }
});

bot.on("callback_query", async (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id;
  console.log("chatId: ", chatId);
  if (!chatId) return;
  const action = callbackQuery.data;
  const userId: any = callbackQuery.from?.id;

  if (!action || !userId) {
    return bot.sendMessage(chatId, "Invalid action. Please try again.");
  }

  const tempData = tempStore[chatId];
  if (!tempData) return;

  if (action.startsWith("create_")) {
    const [, actionUserId, username] = action.split("_");

    // Ensure actionUserId and username are present and valid
    if (!actionUserId || !username) {
      return bot.sendMessage(chatId, "Invalid data for account creation.");
    }

    // Ensure the user ID matches the callback user
    if (parseInt(actionUserId) !== userId) {
      return bot.sendMessage(
        chatId,
        "You are not authorized to perform this action."
      );
    }

    // Proceed with creating the user in the database
    try {
      const result = await createUser(userId, username);

      if (result.success) {
        await bot.sendMessage(
          chatId,
          "Your account has been created successfully!\n Now create a new wager"
        );
        // Optionally send a welcome message to the group
        await bot.sendMessage(
          groupChatId,
          `🎉 New user alert: Welcome, ${username}! Starting balance: $${result.user.playMoneyBalance}.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          result.message || "Something went wrong while creating your account."
        );
      }
    } catch (err) {
      console.error("Error creating user:", err);
      bot.sendMessage(chatId, "An error occurred while creating your account.");
    }
  } else if (action === "cancel_create") {
    // If 'No' is clicked, cancel account creation and notify the user
    await bot.sendMessage(
      chatId,
      "Account creation has been canceled. No data was saved."
    );
    console.log("User canceled account creation.");
  }

  // Delete the confirmation message if exists
  if (tempData.confirmationMessageId) {
    try {
      await bot.deleteMessage(chatId, tempData.confirmationMessageId);
    } catch (err) {
      console.error("Failed to delete confirmation message:", err);
    }
  }
  delete tempStore[chatId]; // Clean up temporary data
});
let result1: any;
bot.onText(/\/create_wager/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const tgUsername = msg.from?.username || "Anonymous";
  console.log("===================tgusername============", tgUsername);
  if (!userId) {
    return bot.sendMessage(
      chatId,
      "An error occurred. We couldn't retrieve your user ID."
    );
  }
  const existingUser1 = await getUserBalance(userId);
  const creatorId = userId;

  // Step 1: Ask for wager description
  await bot.sendMessage(
    chatId,
    `🟢 Let’s set up a new wager! Provide a clear description that all bettors will see (e.g., “Will X happen by the end of the year?”).`
  );

  // Listen for description input
  bot.once("message", async (descMsg) => {
    if (descMsg.from?.id !== userId) return;

    const wagerDescription = descMsg.text;

    if (!wagerDescription || wagerDescription.startsWith("/")) return;

    // Step 2: Ask for Option A
    await bot.sendMessage(
      chatId,
      `🟢 Enter the first possible outcome (e.g., “Yes”).`
    );

    bot.once("message", async (optionAMsg) => {
      if (optionAMsg.from?.id !== userId) return;

      const optionA = optionAMsg.text;
      if (!optionA || optionA.startsWith("/")) return;

      // Step 3: Ask for Option B
      await bot.sendMessage(
        chatId,
        `🟢 Enter the second possible outcome (e.g., “No”).`
      );

      bot.once("message", async (optionBMsg) => {
        if (optionAMsg.from?.id !== userId) return;

        const optionB = optionBMsg.text;
        if (!optionB || optionB.startsWith("/")) return;

        let wagerTimeLimit = null;

        while (wagerTimeLimit === null) {
          await bot.sendMessage(
            chatId,
            `🟢 How long should betting stay open (in minutes)?. Once this time is up, no new bets will be accepted.`
          );

          const timeLimitMsg: any = await new Promise((resolve) => {
            bot.once("message", (msg) => {
              if (msg.from?.id === userId) {
                resolve(msg);
              } else {
                resolve(null); // Ignore other users' messages
              }
            });
          });

          if (
            !timeLimitMsg ||
            !timeLimitMsg.text ||
            isNaN(Number(timeLimitMsg.text))
          ) {
            await bot.sendMessage(
              chatId,
              "Please enter a valid positive number for the time limit."
            );
            continue; // Continue to prompt for a valid input
          }
          wagerTimeLimit = parseInt(timeLimitMsg.text, 10);

          if (wagerTimeLimit > 900000) {
            await bot.sendMessage(
              chatId,
              "The max timelimit is 900,000. Please input the value again!"
            );
            wagerTimeLimit = null; // Reset to continue prompting
            continue; // Go back to the beginning of the loop
          }
        }

        console.log("wagerTimeLimit", wagerTimeLimit);

        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeLimitDate = hours * 60 + minutes;

        console.log(
          "=========timelimit date============    ",
          hours,
          minutes,
          timeLimitDate
        );

        const wagerId = msg.message_id; // Use message ID as wager ID

        let bettingMessageId: any | null = 0;

        const result = await createWager(
          creatorId,
          wagerDescription,
          timeLimitDate,
          wagerId,
          optionA,
          optionB,
          chatId,
          bettingMessageId
        );

        if (!result.success) {
          console.error("Failed to create wager:", result.message);
          return; // Exit if creation fails
        }
        if (result.success) {
          const activeSelections = new Map(); // To track active selections per user

          await bot.sendMessage(
            chatId,
            `🟢 🎉  <b>New Wager Created Successfully</b>\n\n` +
              `🎲 The wager “${wagerDescription}” has been posted to the group chat.\n\n` +
              `🅰️ Option A: ${optionA}\n` +
              `🅱️ Option B: ${optionB}\n\n` +
              `⏱️Betting for this wager will close in <b>${wagerTimeLimit}</b> minutes, or when the majority of bettors have elected to close the betting`,
            { parse_mode: "HTML" }
          );

          // Notify the group chat about the new wager
          const bettingMessage = await bot.sendMessage(
            groupChatId,
            `🟢 <b>New Wager Created</b>\n\n` +
              `🔔 @${tgUsername} has created a new wager for you to bet on! 🔔\n\n` +
              `🎲 ${wagerDescription}\n\n` +
              `🅰️ Option A: ${optionA}\n` +
              `🅱️ Option B: ${optionB}\n\n` +
              `⏱️ Betting for this wager will close in <b>${wagerTimeLimit}</b> minutes, or when the majority of bettors have elected to close the betting.\n\n` +
              `⚠️ Place a bet by choosing an outcome below:\n\n`,
            {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    {
                      text: "🅰️ ✅",
                      callback_data: `option_a_${wagerId}`,
                    },
                    { text: "🅱️ ✅", callback_data: `option_b_${wagerId}` },
                  ],
                  [
                    {
                      text: "Close Betting 🔒",
                      callback_data: `close_betting_${wagerId}`,
                    },
                  ],
                ],
              },
            }
          );

          bettingMessageId = bettingMessage.message_id;
          const updateResult = await updateWagerBettingMessageId(
            wagerId,
            bettingMessageId
          );

          if (!updateResult.success) {
            console.error(
              "Failed to update betting message ID:",
              updateResult.error
            );
          } else {
            console.log(
              "Betting message updated successfully:",
              bettingMessageId
            );
          }

          const delay = wagerTimeLimit * 60 * 1000;
          setTimeout(async () => {
            try {
              await bot.editMessageReplyMarkup(
                {
                  inline_keyboard: [
                    [
                      {
                        text: "✋❌ Betting is closed.",
                        callback_data: "betting_closed",
                      },
                    ],
                    [
                      {
                        text: "🗳️ Vote outcome🗳️",
                        callback_data: `vote_outcome_${wagerId}`,
                      },
                    ],
                  ],
                },
                {
                  chat_id: groupChatId,
                  message_id: bettingMessageId, // ID of the original betting message
                }
              );

              console.log("Wager has been successfully closed.");
            } catch (error) {
              console.error("Error closing wager:", error);
            }
          }, delay);

          let tempOddsA: any = 0;
          let tempOddsB: any = 0;

          //Select OptionA or B
          bot.on(
            "callback_query",
            async function handleOptionSelection(callbackQuery) {
              const action = callbackQuery.data;

              // Ignore unrelated callback queries
              if (!action || !action.startsWith(`option_`)) return;

              const wagerMatch = action.includes(`${wagerId}`);
              if (!wagerMatch) return;

              const selectedOption = action.includes("option_a") ? "A" : "B";

              const user: any = callbackQuery.from.id;

              // Cancel previous selection for this user
              if (activeSelections.has(user)) {
                const previousMsgId = activeSelections.get(user);
                try {
                  await bot.editMessageText(
                    "Your previous selection was canceled.",
                    {
                      chat_id: user,
                      message_id: previousMsgId,
                    }
                  );
                } catch (err) {
                  if (err instanceof Error) {
                    console.error("Failed to edit message:", err.message);
                  } else {
                    console.error("An unexpected error occurred:", err);
                  }
                }
              }

              const oddsResult = await calculateOdds(wagerId);
              if (!oddsResult.success) {
                return bot.sendMessage(
                  callbackQuery.message?.chat.id || chatId,
                  oddsResult.message || "Failed to calculate odds."
                );
              }

              const expectedOption = selectedOption === "A" ? optionA : optionB;

              const notifyMsg = await bot.sendMessage(
                user,
                `🟢 <b>Place a bet on wager:</b>\n` +
                  `"${wagerDescription}"\n\n` +
                  `You have selected Option ${selectedOption}: ("${expectedOption}")\n\n` +
                  `Enter how much you want to bet to see your odds, then confirm your bet.\n\n` +
                  `Or click cancel to cancel your bet.\n\n`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: "Cancel Bet ❌", callback_data: "cancel_bet" }],
                    ],
                  },
                }
              );

              activeSelections.set(user, notifyMsg.message_id);

              // Handle cancel action
              bot.once("callback_query", async (cancelQuery) => {
                if (
                  cancelQuery.data === "cancel_bet" &&
                  cancelQuery.from.id === user
                ) {
                  await bot.editMessageText("Your bet was canceled.", {
                    chat_id: user,
                    message_id: notifyMsg.message_id,
                  });
                  activeSelections.delete(user);
                }
              });

              // Listen for the user's bet amount
              bot.once("message", async (betAmountMsg) => {
                if (betAmountMsg.from?.id !== user) return;

                const betAmount = parseFloat(betAmountMsg.text || "0");
                if (isNaN(betAmount) || betAmount <= 0) {
                  return bot.sendMessage(
                    user,
                    "Please enter a valid bet amount."
                  );
                }

                // Ensure this is the latest selection
                if (activeSelections.get(user) !== notifyMsg.message_id) {
                  return;
                }

                activeSelections.delete(user);
                console.log(
                  "user, wagerId, selectedOption, betamount, tgUsername, username",
                  user,
                  wagerId,
                  selectedOption,
                  betAmount,
                  tgUsername,
                  betAmountMsg.from?.username
                );

                const username: any = betAmountMsg.from?.username;
                const result = await placeBet(
                  user,
                  wagerId,
                  selectedOption,
                  betAmount,
                  username
                );
                result1 = result;

                const oddsA = (
                  result.updatedWager.totalPotA === 0
                    ? 0
                    : (result.updatedWager.totalPotA +
                        result.updatedWager.totalPotB) /
                      result.updatedWager.totalPotA
                ).toFixed(2);

                const oddsB = (
                  result.updatedWager.totalPotB === 0
                    ? 0
                    : (result.updatedWager.totalPotA +
                        result.updatedWager.totalPotB) /
                      result.updatedWager.totalPotB
                ).toFixed(2);

                const expectedOdds = selectedOption === "A" ? oddsA : oddsB;
                const expectedOddsNum = parseFloat(expectedOdds);
                tempOddsA = oddsA;
                tempOddsB = oddsB;

                // Send confirmation message
                const confirmMsg = await bot.sendMessage(
                  user,

                  `🟢💰 You want to bet $${betAmount.toFixed(
                    2
                  )} on Option ${selectedOption} ("${expectedOption}") at odds of ${expectedOdds}x.\n\n` +
                    `💸 Your bet of $${betAmount.toFixed(
                      2
                    )} could pay out a total of $${(
                      betAmount * expectedOddsNum
                    ).toFixed(2)}. ` +
                    `<b>Future bets can change the odds.</b>\n\n ` +
                    `⚠️ Please confirm or cancel your bet:\n\n`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "Confirm Bet ✅",
                            callback_data: "confirm_bet",
                          },
                          {
                            text: "Cancel Bet ❌",
                            callback_data: "cancel_bet",
                          },
                        ],
                      ],
                    },
                  }
                );

                // Handle confirm or cancel actions
                bot.once("callback_query", async (confirmCancelQuery) => {
                  if (confirmCancelQuery.data === "cancel_bet") {
                    await bot.editMessageText("Your bet was canceled.", {
                      chat_id: user,
                      message_id: confirmMsg.message_id,
                    });
                    return;
                  }

                  if (confirmCancelQuery.data === "confirm_bet") {
                    if (result.success) {
                      await bot.editMessageText(
                        `🟢 Your bet of $${betAmount.toFixed(
                          2
                        )} on Option ${selectedOption} ("${expectedOption}") at current odds of ${expectedOdds}x for a total payout of $${(
                          betAmount * expectedOddsNum
                        ).toFixed(2)} has been placed! 🎉`,
                        { chat_id: user, message_id: confirmMsg.message_id }
                      );

                      await bot.sendMessage(
                        groupChatId,
                        `🟢 <b>New Bet Placed</b>\n\n` +
                          `🤑 @${
                            callbackQuery.from.username
                          } has bet <b>$${betAmount.toFixed(
                            2
                          )} </b>on <b>Option ${selectedOption}</b> for the wager “${wagerDescription}”\n\n` +
                          `🅰️ Option A pot ("${optionA}") now contains $${result1.updatedWager.totalPotA.toFixed(
                            2
                          )}\n` +
                          `🅱️ Option B pot ("${optionB}") now contains $${result1.updatedWager.totalPotB.toFixed(
                            2
                          )}\n\n` +
                          `The payout odds for all bets placed are now:\n\n` +
                          `💰 Option A: ${oddsA}x\n` +
                          `💰 Option B: ${oddsB}x\n\n` +
                          `⏱️ Betting will close in <b>${wagerTimeLimit}</b> minutes, or earlier if most bettors choose to close it.\n\n` +
                          `⚠️ Place a bet by choosing an outcome below:`,
                        {
                          parse_mode: "HTML",
                          reply_markup: {
                            inline_keyboard: [
                              [
                                {
                                  text: "🅰️ ✅",
                                  callback_data: `option_a_${wagerId}`,
                                },
                                {
                                  text: "🅱️ ✅",
                                  callback_data: `option_b_${wagerId}`,
                                },
                              ],
                              [
                                {
                                  text: "Close Betting 🔒",
                                  callback_data: `close_betting_${wagerId}`,
                                },
                              ],
                            ],
                          },
                        }
                      );
                    }
                  }
                });
              });
            }
          );

          const votes: Record<string, { close: Set<number> }> = {};

          //Closing betting
          bot.on("callback_query", async (callbackQuery) => {
            const action = callbackQuery.data;
            const userId = callbackQuery.from.id;

            if (!action) {
              return bot.answerCallbackQuery(callbackQuery.id, {
                text: "Invalid action. Please try again.",
                show_alert: true,
              });
            }
            const wagerMatch = action.includes(`${wagerId}`);
            if (!wagerMatch) return;

            // Check if the button pressed is "Close Betting"
            if (action.startsWith("close_betting_")) {
              const wagerId = msg.message_id;

              // Ensure this is scoped to the wager being acted upon
              if (!votes[wagerId]) {
                votes[wagerId] = { close: new Set() };
              }

              // Check if the user has placed a bet on this wager
              const hasBet = await checkUserBet(userId, wagerId);

              if (!hasBet) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: "You must place a bet on this wager to propose closing it.",
                  show_alert: true,
                });
              }

              // Notify group and start voting
              await bot.sendMessage(
                userId,
                `🔒 You've requested to close betting for the wager "${wagerDescription}". Do you confirm this action?`,
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "✅ Confirm Close",
                          callback_data: `bet_close_${wagerId}`,
                        },
                        {
                          text: "❌ Cancel Close",
                          callback_data: `cancel_close${wagerId}`,
                        },
                      ],
                    ],
                  },
                }
              );

              return bot.answerCallbackQuery(callbackQuery.id, {
                text: "Your request to close betting has been noted.",
              });
            }

            // Voting logic for closure
            if (action.startsWith("bet_close_")) {
              const wagerId = msg.message_id;
              const userId = callbackQuery.from.id;

              if (!votes[wagerId]) votes[wagerId] = { close: new Set() };

              // Check if the user has already voted
              if (votes[wagerId].close.has(userId)) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: "You have already voted to close.",
                  show_alert: true,
                });
              }

              // Register the vote
              if (action.startsWith("bet_close_")) {
                votes[wagerId].close.add(userId);
              }

              const totalBettors = await getTotalBettors(wagerId);
              console.log("totalbettors", totalBettors);

              let neededVotes;
              if (totalBettors % 2 == 0) {
                neededVotes = Math.ceil(totalBettors / 2) + 1;
              } else {
                neededVotes = Math.ceil(totalBettors / 2);
              }
              const closeVotes = votes[wagerId].close.size;

              await bot.editMessageText(
                `🟢🔒 <b>Betting Close Request</b>\n\n` +
                  `🔒 @${callbackQuery.from.username} has requested to close betting on the wager “${wagerDescription}”\n\n` +
                  `👨 Bettors on this wager: ${totalBettors}\n` +
                  `✅ Votes required to close betting: ${neededVotes}\n` +
                  `🗳️ Current votes for closing: ${closeVotes}\n\n` +
                  `⚠️ ${
                    neededVotes - closeVotes
                  } more votes are required to close betting, or betting will be closed in <b>${wagerTimeLimit}</b> minutes.`,
                {
                  chat_id: callbackQuery.message?.chat.id,
                  message_id: callbackQuery.message?.message_id,
                  parse_mode: "HTML",
                }
              );

              await bot.sendMessage(
                groupChatId,
                `🟢🔒 <b>Betting Close Request</b>\n\n` +
                  `🔒 ${callbackQuery.from.username} has requested to close betting on the wager “${wagerDescription}”\n\n` +
                  `👨 Bettors on this wager: ${totalBettors}\n` +
                  `✅ Votes required to close betting: ${neededVotes}\n` +
                  `🗳️ Current votes for closing: ${closeVotes}\n\n` +
                  `⚠️ ${
                    neededVotes - closeVotes
                  } more votes are required to close betting, or betting will be closed in ${wagerTimeLimit} minutes.`,
                {
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "Close Betting 🔒",
                          callback_data: `close_betting_${wagerId}`,
                        },
                      ],
                    ],
                  },
                }
              );

              // Check if majority has been reached for the closure
              if (closeVotes >= neededVotes) {
                await bot.sendMessage(
                  groupChatId,
                  `🟢 <b>Betting is now closed for the wager:</b>\n` +
                    `"${wagerDescription}"\n\n` +
                    `🅰️ Option A pot ("${optionA}") contains $${result1.updatedWager.totalPotA.toFixed(
                      2
                    )}\n` +
                    `🅰️ Option A pot ("${optionB}") contains $${result1.updatedWager.totalPotB.toFixed(
                      2
                    )}\n\n` +
                    `⚠️ All bettors can now vote on the outcome of this wager.\n\n` +
                    `🗳️ Vote on the outcome of this wager`,
                  {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "🗳️ Vote outcome",
                            callback_data: `vote_outcome_${wagerId}`,
                          },
                        ],
                      ],
                    },
                  }
                );

                // Disable betting buttons
                await bot.editMessageReplyMarkup(
                  {
                    inline_keyboard: [
                      [
                        {
                          text: "✋❌ Betting is closed.",
                          callback_data: "betting_closed",
                        },
                      ],
                      [
                        {
                          text: "🗳️ Vote outcome",
                          callback_data: `vote_outcome_${wagerId}`,
                        },
                      ],
                    ],
                  },
                  {
                    chat_id: groupChatId,
                    message_id: bettingMessageId, // ID of the original betting message
                  }
                );

                // Proceed to close betting
                await closeBetting(wagerId);
              }

              return bot.answerCallbackQuery(callbackQuery.id, {
                text: "Your vote has been recorded.",
              });
            }

            if (action.startsWith("vote_outcome_")) {
              const wagerId = msg.message_id;
              const userId = callbackQuery.from.id;

              await bot.sendMessage(
                userId,
                `🗳️ *Vote for the outcome of this wager*:\n\n` +
                  `📝 *Wager:* ${wagerDescription}\n\n` +
                  `Please choose one of the options below:`,
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [
                      [
                        {
                          text: "Option A ✅",
                          callback_data: `vote_a_${wagerId}`,
                        },
                        {
                          text: "Option B ✅",
                          callback_data: `vote_b_${wagerId}`,
                        },
                      ],
                    ],
                  },
                }
              );

              return bot.answerCallbackQuery(callbackQuery.id, {
                text: "You can now vote for the outcome.",
              });
            }

            const votesOfOutcome: Record<
              string,
              { A: Set<number>; B: Set<number> }
            > = {};

            if (action.startsWith("vote_a_") || action.startsWith("vote_b_")) {
              // Ensure callbackQuery.message is defined
              if (!callbackQuery.message) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: "Message context is missing. Please try again later.",
                  show_alert: true,
                });
              }

              const userId: any = callbackQuery.from.id;

              if (!wagerId) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: "Invalid wager ID. Please try again later.",
                  show_alert: true,
                });
              }

              if (!votesOfOutcome[wagerId]) {
                votesOfOutcome[wagerId] = {
                  A: new Set(),
                  B: new Set(),
                };
              }

              // Determine vote option (A or B)
              const voteOption = action.startsWith("vote_a_") ? "A" : "B";

              // Check if the user has already voted
              const alreadyVoted = await hasUserVoted(userId, wagerId);
              if (alreadyVoted) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: "You have already voted for this wager.",
                  show_alert: true,
                });
              }

              // Register the vote
              const { success, message } = await createVote(
                wagerId,
                userId,
                voteOption
              );
              if (!success) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: message,
                  show_alert: true,
                });
              }

              // Acknowledge the user's vote privately
              await bot.answerCallbackQuery(callbackQuery.id, {
                text: `Your vote for Option ${voteOption} has been recorded. 🗳️`,
              });

              // Fetch bettors for options A and B
              const bettorsA = await getBettorsForOption(wagerId, "A");
              const bettorsB = await getBettorsForOption(wagerId, "B");

              let majorityA, majorityB;
              // Calculate majority for A and B
              if (bettorsA % 2 == 0) {
                majorityA = Math.ceil(bettorsA / 2) + 1;
              } else {
                majorityA = Math.ceil(bettorsA / 2);
              }
              if (bettorsB % 2 == 0) {
                majorityB = Math.ceil(bettorsB / 2) + 1;
              } else {
                majorityB = Math.ceil(bettorsB / 2);
              }

              console.log(
                "bettorA, bettorB, majorityA, majorityB",
                bettorsA,
                bettorsB,
                majorityA,
                majorityB
              );

              const {
                votedA_betA: totalVotedA_BetA,
                votedA_betB: totalVotedA_BetB,
                votedB_betA: totalVotedB_BetA,
                votedB_betB: totalVotedB_BetB,
              } = await getVoteCounts(wagerId);

              console.log(
                " totalVotedA_BetA, totalVotedA_BetB, totalVotedB_BetA, totalVotedB_BetB,",
                totalVotedA_BetA,
                totalVotedA_BetB,
                totalVotedB_BetA,
                totalVotedB_BetB
              );
              const totalA = totalVotedA_BetA + totalVotedA_BetB;
              const totalB = totalVotedB_BetA + totalVotedB_BetB;
              console.log("totalA, totalB", totalA, totalB);

              if (
                (totalVotedA_BetA >= majorityA &&
                  totalVotedA_BetB >= majorityB) ||
                (totalVotedB_BetA >= majorityA && totalVotedB_BetB >= majorityB)
              ) {
                if (totalA > totalB) {
                  // Notify the group of the outcome
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🟢 Vote Placed. Current votes for wager "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedA_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedA_BetB}/${majorityB} votes submitted\n\n` +
                      `Bettors should keep voting to finalise this wager.`,
                    { parse_mode: "HTML" }
                  );
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🎉 The outcome of the wager is *Option A*! Congratulations to the winners! 💰`
                  );
                  await bot.sendMessage(
                    groupChatId,
                    `🟢🔒 Vote Submitted.\n\n` +
                      `🔒 @${callbackQuery.from.username} has voted on Option ${optionA} as the outcome of the wager: "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedA_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedA_BetB}/${majorityB} votes submitted\n\n` +
                      `Bettors should keep voting to finalise this wager.`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "🗳️ Vote outcome",
                              callback_data: `vote_outcome_${wagerId}`,
                            },
                          ],
                        ],
                      },
                    }
                  );
                  await bot.sendMessage(
                    groupChatId, // Assuming botChatId is defined for bot chat
                    `🟢 <b>Wager closed</b>\n\n` +
                      `The wager “${wagerDescription}” has now closed with enough votes.\n\n` +
                      `😊 <b>Verdict</b>: Voters agreed that Option A (“${optionA}”) was the outcome!\n` +
                      `🥳 <b>Outcome</b>: Time to settle up with the winners!`,
                    { parse_mode: "HTML" }
                  );

                  const telegramUsername = callbackQuery.from.username;

                  // // Get bettors for the winning outcome
                  const bettorsA = await getBettorsForOutcome(
                    wagerId,
                    "A",
                    tempOddsA
                  );
                  const bettorsB = await getBettorsForOutcome(
                    wagerId,
                    "B",
                    tempOddsB
                  );

                  const bettorWinnerTable = generateWinnerBettorTable(bettorsA);
                  const bettorLoserTable = generateLoserBettorTable(bettorsB);
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🏆 Winners Table:\n\n${bettorWinnerTable}\n\n\n` +
                      `🥴 Losers Table:\n\n${bettorLoserTable}\n`,
                    { parse_mode: "Markdown" }
                  );
                  await bot.sendMessage(
                    groupChatId,
                    `🟢 <b>Winners/Losers Table for wager “${wagerDescription}”</b>\n\n` +
                      `🅰️ Option A ('${optionA}') Pot: $${result1.updatedWager.totalPotA.toFixed(
                        2
                      )}\n` +
                      `🅱️ Option B ('${optionB}') Pot: $${result1.updatedWager.totalPotB.toFixed(
                        2
                      )}\n` +
                      `💰 Total Pot: $${(
                        parseFloat(result1.updatedWager.totalPotA) +
                        parseFloat(result1.updatedWager.totalPotB)
                      ).toFixed(2)}\n\n` +
                      `🗳️ Voted outcome of wager: Option A (“${optionA}”)\n\n` +
                      `🏆 Winners\n\n${bettorWinnerTable}\n\n\n` +
                      `🥴Losers\n\n${bettorLoserTable}`,
                    { parse_mode: "HTML" }
                  );

                  await bot.editMessageReplyMarkup(
                    {
                      inline_keyboard: [
                        [
                          {
                            text: "❌ Wager is Closed",
                            callback_data: "wager_closed",
                          },
                        ],
                      ],
                    },
                    {
                      chat_id: groupChatId,
                      message_id: bettingMessageId, // ID of the original betting message
                    }
                  );

                  await settleWager(wagerId, "A");
                } else if (totalB > totalA) {
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🟢 Vote Placed. Current votes for wager "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedB_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedB_BetB}/${majorityB} votes submitted\n\n` +
                      `Bettors should keep voting to finalise this wager.`,
                    { parse_mode: "HTML" }
                  );
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🎉 The outcome of the wager is *Option B*! Congratulations to the winners! 💰`
                  );
                  await bot.sendMessage(
                    groupChatId,
                    `🟢🔒 Vote Submitted.\n\n` +
                      `🔒 @${callbackQuery.from.username} has voted on Option ${optionA} as the outcome of the wager: "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedB_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedB_BetB}/${majorityB} votes submitted\n\n` +
                      `Bettors should keep voting to finalise this wager.`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "🗳️ Vote outcome",
                              callback_data: `vote_outcome_${wagerId}`,
                            },
                          ],
                        ],
                      },
                    }
                  );
                  await bot.sendMessage(
                    groupChatId, // Assuming botChatId is defined for bot
                    `🟢 <b>Wager closed</b>\n\n` +
                      `The wager "${wagerDescription}" has now closed with enough votes\n\n` +
                      `😊 <b>Verdict</b>: Voters agreed that Option B ('${optionB}') was the outcome!\n` +
                      `🥳 <b>Outcome</b>: Time to settle up with the winners!`,
                    { parse_mode: "HTML" }
                  );

                  const telegramUsername = callbackQuery.from.username;

                  // Get bettors for the winning outcome
                  const bettorsA = await getBettorsForOutcome(
                    wagerId,
                    "A",
                    tempOddsA
                  );
                  const bettorsB = await getBettorsForOutcome(
                    wagerId,
                    "B",
                    tempOddsB
                  );
                  const bettorWinnerTable = generateWinnerBettorTable(bettorsB);
                  const bettorLoserTable = generateLoserBettorTable(bettorsA);

                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🏆 Winners Table:\n\n${bettorWinnerTable}\n\n\n` +
                      `🥴Losers Table:\n\n${bettorLoserTable}`,
                    { parse_mode: "Markdown" }
                  );

                  await bot.sendMessage(
                    groupChatId,
                    `🟢 <b>Winners/Losers Table for wager “${wagerDescription}”</b>\n\n` +
                      `🅰️ Option A ("${optionA}") Pot: $${result1.updatedWager.totalPotA.toFixed(
                        2
                      )}\n` +
                      `🅱️ Option B ("${optionB}") Pot: $${result1.updatedWager.totalPotB.toFixed(
                        2
                      )}\n` +
                      `💰 Total Pot: $${(
                        parseFloat(result1.updatedWager.totalPotA) +
                        parseFloat(result1.updatedWager.totalPotB)
                      ).toFixed(2)}` +
                      `🗳️ Voted outcome of wager: Option B (“${optionB}”)\n\n` +
                      `🏆 Winners\n\n${bettorWinnerTable}\n\n\n` +
                      `🥴Losers\n\n${bettorLoserTable}`,
                    { parse_mode: "HTML" }
                  );

                  await bot.editMessageReplyMarkup(
                    {
                      inline_keyboard: [
                        [
                          {
                            text: "❌ Wager is Closed",
                            callback_data: "wager_closed",
                          },
                        ],
                      ],
                    },
                    {
                      chat_id: groupChatId,
                      message_id: bettingMessageId, // ID of the original betting message
                    }
                  );

                  await settleWager(wagerId, "B");
                } else {
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `⚠️ There is a tie in voting. All bets will be refunded.`
                  );
                  await bot.sendMessage(
                    groupChatId, // Assuming botChatId is defined for bot chat
                    `The outcome of the wager ${wagerId} is *Option B*! 🎉`
                  );
                  await refundWager(wagerId);
                }
              } else {
                // No majority yet - show vote progress
                if (totalA > totalB) {
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🟢 Vote Placed. Current votes for wager "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedA_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedA_BetB}/${majorityB} votes submitted` +
                      `Bettors should keep voting to finalise this wager.`,
                    { parse_mode: "HTML" }
                  );
                  await bot.sendMessage(
                    groupChatId,
                    `🟢🔒 Vote Submitted.\n\n` +
                      `🔒 @${callbackQuery.from.username} has voted on Option ${optionA} as the outcome of the wager: "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedA_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedA_BetB}/${majorityB} votes submitted` +
                      `Bettors should keep voting to finalise this wager.`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "🗳️ Vote outcome",
                              callback_data: `vote_outcome_${wagerId}`,
                            },
                          ],
                        ],
                      },
                    }
                  );
                } else if (totalA < totalB) {
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🟢 Vote Placed. Current votes for wager "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedB_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedB_BetB}/${majorityB} votes submitted` +
                      `Bettors should keep voting to finalise this wager.`
                  );
                  await bot.sendMessage(
                    groupChatId,
                    `🟢🔒 Vote Submitted.\n\n` +
                      `🔒 @${callbackQuery.from.username} has voted on Option ${optionA} as the outcome of the wager: "${wagerDescription}":\n\n` +
                      `🔵 Option A: ${totalVotedB_BetA}/${majorityA} votes submitted\n` +
                      `🔴 Option B: ${totalVotedB_BetB}/${majorityB} votes submitted` +
                      `Bettors should keep voting to finalise this wager.`,
                    {
                      parse_mode: "HTML",
                      reply_markup: {
                        inline_keyboard: [
                          [
                            {
                              text: "🗳️ Vote outcome",
                              callback_data: `vote_outcome_${wagerId}`,
                            },
                          ],
                        ],
                      },
                    }
                  );

                  console.log("========vote end========");
                } else if (totalA + totalB == bettorsA + bettorsB) {
                  await bot.sendMessage(
                    callbackQuery.message.chat.id,
                    `🔴 <b>Wager closed</b>\n\n` +
                      `The wager "${wagerDescription}" has now closed with enough votes.\n\n` +
                      `😭 Verdict: An outcome was not agreed upon by voters.\n` +
                      `💩 Outcome: The wager is cancelled and all bets are refunded to players.`,
                    { parse_mode: "HTML" }
                  );
                  await bot.sendMessage(
                    groupChatId,
                    `🔴 <b>Wager closed</b>\n\n` +
                      `The wager "${wagerDescription}" has now closed with enough votes.\n\n` +
                      `😭 <b>Verdict</b>: An outcome was not agreed upon by voters.\n` +
                      `💩 <b>Outcome</b>: The wager is cancelled and all bets are refunded to players.`,
                    { parse_mode: "HTML" }
                  );

                  await bot.editMessageReplyMarkup(
                    {
                      inline_keyboard: [
                        [
                          {
                            text: "❌ Wager is Closed",
                            callback_data: "wager_closed",
                          },
                        ],
                      ],
                    },
                    {
                      chat_id: groupChatId,
                      message_id: bettingMessageId, // ID of the original betting message
                    }
                  );
                }
              }
            }

            // Betting close is canceled
            if (action.startsWith("cancel_close")) {
              const wagerId = msg.message_id;
              const userId = callbackQuery.from.id;

              if (!votes[wagerId]) votes[wagerId] = { close: new Set() };

              // Check if the user has already voted
              if (votes[wagerId].close.has(userId)) {
                return bot.answerCallbackQuery(callbackQuery.id, {
                  text: "You have already voted.",
                  show_alert: true,
                });
              }

              const totalBettors = await getTotalBettors(wagerId);
              const closeVotes = votes[wagerId].close.size;

              await bot.editMessageText(
                `🔒 *Betting Closure Cancelled* 🔒\n\n` +
                  `👤 *Requester:* ${callbackQuery.from.username}\n` +
                  `📝 *Wager:* ${wagerDescription}\n` +
                  `✅ Votes to close: ${closeVotes}/${totalBettors}\n\n` +
                  `The request to close betting has been cancelled.`,
                {
                  chat_id: callbackQuery.message?.chat.id,
                  message_id: callbackQuery.message?.message_id,
                  parse_mode: "Markdown",
                }
              );

              return bot.answerCallbackQuery(callbackQuery.id, {
                text: "Your vote has been recorded.",
              });
            }
          });
        }
      });
    });
  });
});

bot.onText(/\/betting_history/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;
  const tgUsername = msg.from?.username || "Anonymous";

  if (!userId) {
    return bot.sendMessage(
      chatId,
      "An error occurred. We couldn't retrieve your user ID."
    );
  }

  await bot.sendMessage(
    chatId,
    `💰 <b>Betting History</b>\n\n` +
      `🎲Show the currently open or closed wagers you have betted on.\n\n` +
      `Select below:\n\n`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open",
              callback_data: `history_open`,
            },
            {
              text: "Closed",
              callback_data: `history_close`,
            },
          ],
        ],
      },
    }
  );
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  const callbackData = query.data;

  if (!chatId || !callbackData) return;

  if (callbackData === "history_open") {
    try {
      const wagers = await getRecentOpenWagers();

      if (wagers.length === 0) {
        await bot.sendMessage(chatId, "No open wagers found.");
        return;
      }

      const wager = wagers[0];
      await sendWagerDetails(chatId, wager, 0, wagers.length);
    } catch (error) {
      console.error("Error handling open wagers:", error);
      await bot.sendMessage(chatId, "An error occurred while fetching wagers.");
    }
  } else if (callbackData === "history_close") {
    try {
      const closedWagers = await getRecentClosedWagers();
      console.log("closeWagers", closedWagers.length);

      if (closedWagers.length === 0) {
        await bot.sendMessage(chatId, "No open wagers found.");
        return;
      }

      const wager = closedWagers[0];

      await sendClosedWagerDetails(
        chatId,
        wager,
        0,
        closedWagers.length
        //telegramUsername
      );
    } catch (error) {
      console.error("Error handling open wagers:", error);
      await bot.sendMessage(chatId, "An error occurred while fetching wagers.");
    }
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  const callbackData = query.data;
  const telegramUsername = query.from.username;

  if (!chatId || !callbackData) return;

  const mockWagers = await getRecentOpenWagers();
  const totalWagers = mockWagers.length;

  if (
    callbackData.startsWith("openprev_") ||
    callbackData.startsWith("opennext_")
  ) {
    const currentIndex = parseInt(callbackData.split("_")[1], 10);
    const newIndex = callbackData.startsWith("openprev_")
      ? Math.max(currentIndex - 1, 0)
      : Math.min(currentIndex + 1, totalWagers - 1);

    const wager = mockWagers[newIndex];
    await sendWagerDetails(chatId, wager, newIndex, totalWagers);
  } else if (
    callbackData.startsWith("closeprev_") ||
    callbackData.startsWith("closenext_")
  ) {
    const currentIndex = parseInt(callbackData.split("_")[1], 10);
    const newIndex = callbackData.startsWith("closeprev_")
      ? Math.max(currentIndex - 1, 0)
      : Math.min(currentIndex + 1, totalWagers - 1);

    const wager = mockWagers[newIndex];
    await sendClosedWagerDetails(chatId, wager, newIndex, totalWagers);
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message?.chat.id;
  const callbackData = query.data;
  const telegramUsername = query.from.username;
  if (!chatId || !callbackData) return;

  const mockWagers = await getRecentClosedWagers();
  const totalWagers = mockWagers.length;

  if (
    callbackData.startsWith("closeprev_") ||
    callbackData.startsWith("closenext_")
  ) {
    const currentIndex = parseInt(callbackData.split("_")[1], 10);
    const newIndex = callbackData.startsWith("closeprev_")
      ? Math.max(currentIndex - 1, 0)
      : Math.min(currentIndex + 1, totalWagers - 1);

    const wager = mockWagers[newIndex];
    await sendClosedWagerDetails(
      chatId,
      wager,
      newIndex,
      totalWagers
      //telegramUsername
    );
  }
});

const sendWagerDetails = async (
  chatId: number,
  wager: any,
  currentIndex: number,
  totalWagers: number
) => {
  const wagerMessageLink = `https://t.me/socialwagergroup/${wager.bettingMessageId}`;
  console.log("===========wagerMessageLink============", wagerMessageLink);

  await bot.sendMessage(
    chatId,
    `🟢 You are currently betting on ${totalWagers} open wager(s).\n\n` +
      `Wager ID: <b>${wager.wagerId}</b>\n\n` +
      `Wager: <i>${wager.wagerDescription}</i>\n\n` +
      `🅰️ Option A Pot: $${wager.totalPotA}\n` +
      `🅱️ Option B Pot: $${wager.totalPotB}\n\n` +
      `Pick an option below:`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⬅️ Previous Wager",
              callback_data: `openprev_${currentIndex}`,
            },
            {
              text: "➡️ Next Wager",
              callback_data: `opennext_${currentIndex}`,
            },
          ],
          [
            {
              text: "✅ Place a bet",
              url: wagerMessageLink,
            },
            {
              text: "✋❌ Close/🗳️Vote Wager",
              url: wagerMessageLink,
            },
          ],
        ],
      },
    }
  );
};

const sendClosedWagerDetails = async (
  chatId: number,
  wager: any,
  currentIndex: number,
  totalWagers: number
) => {
  if (!wager || typeof wager !== "object") {
    console.error("Invalid wager object:", wager);
    await bot.sendMessage(chatId, "Error: Invalid wager data.");
    return;
  }

  const { totalPotA, totalPotB } = wager;
  const oddsA = parseFloat(
    (totalPotA > 0 ? (totalPotA + totalPotB) / totalPotA : 0).toFixed(2)
  );
  const oddsB = parseFloat(
    (totalPotB > 0 ? (totalPotA + totalPotB) / totalPotB : 0).toFixed(2)
  );

  // Fetch bettors for options A and B
  const bettorsA = await getBettorsForOption(wager.wagerId, "A");
  const bettorsB = await getBettorsForOption(wager.wagerId, "B");

  let majorityA, majorityB;
  // Calculate majority for A and B
  if (bettorsA % 2 == 0) {
    majorityA = Math.ceil(bettorsA / 2) + 1;
  } else {
    majorityA = Math.ceil(bettorsA / 2);
  }
  if (bettorsB % 2 == 0) {
    majorityB = Math.ceil(bettorsB / 2) + 1;
  } else {
    majorityB = Math.ceil(bettorsB / 2);
  }
  const {
    votedA_betA: totalVotedA_BetA,
    votedA_betB: totalVotedA_BetB,
    votedB_betA: totalVotedB_BetA,
    votedB_betB: totalVotedB_BetB,
  } = await getVoteCounts(wager.wagerId);

  const totalA = totalVotedA_BetA + totalVotedA_BetB;
  const totalB = totalVotedB_BetA + totalVotedB_BetB;

  if (
    (totalVotedA_BetA >= majorityA && totalVotedA_BetB >= majorityB) ||
    (totalVotedB_BetA >= majorityA && totalVotedB_BetB >= majorityB)
  ) {
    if (totalA > totalB) {
      const bettorsWinner = await getBettorsForOutcome(
        wager.wagerId,
        "A",
        oddsA
      );

      const bettorsLoser = await getBettorsForOutcome(
        wager.wagerId,
        "B",
        oddsB
      );

      const bettorWinnerTableA = generateWinnerBettorTable(bettorsWinner);
      const bettorLoserTable = generateLoserBettorTable(bettorsLoser);

      await bot.sendMessage(
        chatId,
        `🟢 You are currently betting on ${totalWagers} open wager(s).\n\n` +
          `Wager ID: <b>${wager.wagerId}</b>\n\n` +
          `Wager: <i>${wager.wagerDescription}</i>\n\n` +
          `🅰️ Option A Pot: $${wager.totalPotA}\n` +
          `🅱️ Option B Pot: $${wager.totalPotB}\n\n` +
          `Pick an option below:` +
          `🏆 Winners\n\n${bettorWinnerTableA}\n\n\n` +
          `🥴Losers\n\n${bettorLoserTable}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⬅️ Previous Wager",
                  callback_data: `closeprev_${currentIndex}`,
                },
                {
                  text: "➡️ Next Wager",
                  callback_data: `closenext_${currentIndex}`,
                },
              ],
            ],
          },
        }
      );
    } else if (totalA < totalB) {
      const bettorsWinner = await getBettorsForOutcome(
        wager.wagerId,
        "B",
        oddsB
      );

      const bettorsLoser = await getBettorsForOutcome(
        wager.wagerId,
        "A",
        oddsA
      );

      const bettorWinnerTable = generateWinnerBettorTable(bettorsWinner);
      const bettorLoserTable = generateLoserBettorTable(bettorsLoser);

      await bot.sendMessage(
        chatId,
        `🟢 You are currently betting on ${totalWagers} open wager(s).\n\n` +
          `Wager ID: <b>${wager.wagerId}</b>\n\n` +
          `Wager: <i>${wager.wagerDescription}</i>\n\n` +
          `🅰️ Option A Pot: $${wager.totalPotA}\n` +
          `🅱️ Option B Pot: $${wager.totalPotB}\n\n` +
          `Pick an option below:` +
          `🏆 Winners\n\n${bettorWinnerTable}\n\n\n` +
          `🥴Losers\n\n${bettorLoserTable}`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⬅️ Previous Wager",
                  callback_data: `closeprev_${currentIndex}`,
                },
                {
                  text: "➡️ Next Wager",
                  callback_data: `closenext_${currentIndex}`,
                },
              ],
            ],
          },
        }
      );
    }
  }
};

export default bot;
