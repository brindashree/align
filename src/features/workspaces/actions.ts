"use server";

import { cookies } from "next/headers";
import { Account, Client, Query, TablesDB } from "node-appwrite";
import { AUTH_COOKIE } from "../auth/constants";
import { DATABASE_ID, MEMBERS_ID, WORKSPACES_ID } from "@/config";

export const getWorkspaces = async () => {
  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT!);

    const session = await cookies().get(AUTH_COOKIE);

    if (!session) return { rows: [], total: 0 };
    client.setSession(session.value);

    const tablesdb = new TablesDB(client);
    const account = new Account(client);
    const user = await account.get();

    const members = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: MEMBERS_ID,
      queries: [Query.equal("userId", user?.$id)],
    });

    if (members.total === 0) {
      return { rows: [], total: 0 };
    }
    const workspacesIds = members.rows.map((member) => member.workspaceId);

    const workspaces = await tablesdb.listRows({
      databaseId: DATABASE_ID,
      tableId: WORKSPACES_ID,
      queries: [
        Query.orderDesc("$createdAt"),
        Query.contains("$id", workspacesIds),
      ],
    });
    return workspaces;
  } catch (err) {
    console.error("Error in getCurrent:", err);
    return { rows: [], total: 0 };
  }
};
