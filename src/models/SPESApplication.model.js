module.exports = (sequelize, DataTypes) => {
  const SPESApplication = sequelize.define(
    "SPESApplication",
    {
      spes_application_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      application_status: {
        type: DataTypes.ENUM("Draft", "Pending", "Approved"),
        allowNull: false,
        defaultValue: "Draft",
      },
      form2_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      form2a_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      form4_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      passport_photo_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      birth_cert_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      indigency_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      registration_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      grades_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      philjobnet_screenshot_path: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      admin_remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "SPES_Applications",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      underscored: true,
      indexes: [
        {
          name: "idx_spes_applications_user_id",
          fields: ["user_id"],
        },
        {
          name: "idx_spes_applications_status",
          fields: ["application_status"],
        },
      ],
    }
  );

  SPESApplication.associate = (models) => {
    if (models.User) {
      SPESApplication.belongsTo(models.User, {
        foreignKey: "user_id",
        as: "user",
      });
    }
  };

  return SPESApplication;
};
