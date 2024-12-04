import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/database";
import Wager from "./wagerModel"; // assuming you have the Wager model imported
import User from "./userModel"; // assuming you have the User model imported
import { BelongsToGetAssociationMixin } from "sequelize";

interface BetAttributes {
  id: number;
  wagerId: number;
  userId: number;
  amount: number;
  choice: string;
}
interface BetCreationAttributes extends Optional<BetAttributes, "id"> {}

class Bet
  extends Model<BetAttributes, BetCreationAttributes>
  implements BetAttributes
{
  public id!: number;
  public wagerId!: number;
  public userId!: number;
  public amount!: number;
  public choice!: string;

  public User?: User;

  public getUser!: BelongsToGetAssociationMixin<User>;
}

Bet.init(
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
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    choice: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "A",
    },
  },
  {
    sequelize,
    modelName: "Bet",
    tableName: "bets", // Specify the table name (optional)
    timestamps: false,
  }
);

// Adding associations
Bet.belongsTo(Wager, { foreignKey: "id" }); // Each Vote belongs to a Wager
Wager.hasMany(Bet, { foreignKey: "id" });
Bet.belongsTo(User, { foreignKey: "userId" }); // Each Vote belongs to a User
User.hasMany(Bet, { foreignKey: "userId" });

export default Bet;
