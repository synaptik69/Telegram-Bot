import { Model, DataTypes } from "sequelize";
import sequelize from "../config/database"; // Import the Sequelize instance

class User extends Model {
  public id!: number;
  public username!: string;
  public userId!: string;
  public playMoneyBalance!: number;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    playMoneyBalance: {
      type: DataTypes.INTEGER,
      defaultValue: 100000,
    },
  },
  {
    sequelize, // Connects this model to the Sequelize instance
    modelName: "User", // Specify the model name
    tableName: "users", // Specify the table name (optional)
    timestamps: false,
  }
);

export default User;
