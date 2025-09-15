import { DATABASE_ID, MEMBERS_ID } from "@/config";
import { Query, type Databases, type TablesDB } from "node-appwrite";

interface GetMemberProps {
  tablesDB: TablesDB;
  workspaceId: string;
  userId: string;
}

export const getMember = async ({
  tablesDB,
  workspaceId,
  userId,
}: GetMemberProps) => {
  const members = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_ID,
    queries: [
      Query.equal("workspaceId", workspaceId),
      Query.equal("userId", userId),
    ],
  });
  return members.rows[0];
};
