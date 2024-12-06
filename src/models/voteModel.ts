import { DataTypes, Model } from "sequelize";
import sequelize from "../config/database";
import Wager from "./wagerModel";
import User from "./userModel";
import Bet from "./betModel";

class Vote extends Model {
  public wagerId!: number;
  public userId!: String;
  public vote!: string;
}
Vote.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    wagerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    vote: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "A",
    },
  },
  { sequelize, modelName: "Vote", tableName: "votes", timestamps: false }
);

// Adding associations
//Vote.belongsTo(Bet, { foreignKey: "id" }); // Each Vote is tied to a Bet
//Bet.hasMany(Vote, { foreignKey: "id" }); // A Bet can have many Votes

export default Vote;
