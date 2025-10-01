"use server";

import { DATABASE_ID, MEMBERS_ID, WORKSPACES_ID } from "@/config";
import { createSessionClient } from "@/lib/appwrite";
import { Query } from "node-appwrite";
import { getMember } from "../members/utils";
import { Workspace } from "./types";

export const getWorkspaces = async () => {
  const { account, tablesDB } = await createSessionClient();

  const user = await account.get();

  const members = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: MEMBERS_ID,
    queries: [Query.equal("userId", user?.$id)],
  });

  if (members.total === 0) {
    return { rows: [], total: 0 };
  }
  const workspacesIds = members.rows.map((member) => member.workspaceId);

  const workspaces = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: WORKSPACES_ID,
    queries: [
      Query.orderDesc("$createdAt"),
      Query.contains("$id", workspacesIds),
    ],
  });
  return workspaces;
};

interface GetWorkspaceInfoProps {
  workspaceId: string;
}

export const getWorkspaceInfo = async ({
  workspaceId,
}: GetWorkspaceInfoProps) => {
  const { tablesDB } = await createSessionClient();

  const workspace = await tablesDB.getRow<Workspace>({
    databaseId: DATABASE_ID,
    tableId: WORKSPACES_ID,
    rowId: workspaceId,
  });

  return {
    name: workspace.name,
  };
};
