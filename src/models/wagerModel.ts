import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import Bet from "./betModel";
import Vote from "./voteModel";

// Define the Wager model's attributes type
interface WagerAttributes {
  id: number;
  creatorId: number;
  wagerId: number;
  wagerDescription: string;
  timeLimit: number;
  status: string;
  outcome?: "A" | "B" | null;
  totalPotA: number;
  totalPotB: number;
  optionA: string;
  optionB: string;
  chatId: number;
  bettingMessageId: number;
}

// Define the creation attributes type (optional properties for creation)
interface WagerCreationAttributes
  extends Optional<WagerAttributes, "id" | "outcome"> {}

class Wager
  extends Model<WagerAttributes, WagerCreationAttributes>
  implements WagerAttributes
{
  public id!: number;
  public creatorId!: number;
  public wagerId!: number;
  public wagerDescription!: string;
  public timeLimit!: number;
  public status!: string;
  public outcome?: "A" | "B" | null;
  public totalPotA!: number;
  public totalPotB!: number;
  public optionA!: string;
  public optionB!: string;
  public chatId!: number;
  public bettingMessageId!: number;

  // Timestamps are optional, depending on your model configuration
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

//class Wager extends Model {}
Wager.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    creatorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    wagerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    wagerDescription: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    timeLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Open",
    },
    outcome: {
      type: DataTypes.ENUM("A", "B"),
      allowNull: true,
    },
    totalPotA: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalPotB: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    optionA: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    optionB: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    chatId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    bettingMessageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Wager",
    tableName: "wagers", // Specify the table name (optional)
    timestamps: false,
  }
);

export default Wager;
