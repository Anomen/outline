import { subMilliseconds } from "date-fns";
import { FindOrCreateOptions, Op } from "sequelize";
import {
  BelongsTo,
  Column,
  Default,
  ForeignKey,
  Table,
  DataType,
  Scopes,
} from "sequelize-typescript";
import { USER_PRESENCE_INTERVAL } from "@shared/constants";
import Document from "./Document";
import User from "./User";
import IdModel from "./base/IdModel";
import Fix from "./decorators/Fix";

@Scopes(() => ({
  withUser: () => ({
    include: [
      {
        model: User,
        required: true,
        as: "user",
      },
    ],
  }),
}))
@Table({ tableName: "views", modelName: "view" })
@Fix
class View extends IdModel {
  @Column
  lastEditingAt: Date | null;

  @Default(1)
  @Column(DataType.INTEGER)
  count: number;

  // associations

  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId: string;

  @BelongsTo(() => Document, "documentId")
  document: Document;

  @ForeignKey(() => Document)
  @Column(DataType.UUID)
  documentId: string;

  static async incrementOrCreate(
    where: {
      userId: string;
      documentId: string;
    },
    options?: FindOrCreateOptions
  ) {
    const [model, created] = await this.findOrCreate({
      ...options,
      where,
    });

    if (!created) {
      model.count += 1;
      model.save(options);
    }

    return model;
  }

  static async findByDocument(
    documentId: string,
    { includeSuspended }: { includeSuspended?: boolean }
  ) {
    return this.findAll({
      where: {
        documentId,
      },
      order: [["updatedAt", "DESC"]],
      include: [
        {
          model: User,
          paranoid: false,
          required: true,
          ...(includeSuspended
            ? {}
            : { where: { suspendedAt: { [Op.is]: null } } }),
        },
      ],
    });
  }

  static async findRecentlyEditingByDocument(documentId: string) {
    return this.findAll({
      where: {
        documentId,
        lastEditingAt: {
          [Op.gt]: subMilliseconds(new Date(), USER_PRESENCE_INTERVAL * 2),
        },
      },
      order: [["lastEditingAt", "DESC"]],
    });
  }

  static async touch(documentId: string, userId: string, isEditing: boolean) {
    const values: Partial<View> = {
      updatedAt: new Date(),
    };

    if (isEditing) {
      values.lastEditingAt = new Date();
    }

    await this.update(values, {
      where: {
        userId,
        documentId,
      },
      returning: false,
    });
  }
}

export default View;
