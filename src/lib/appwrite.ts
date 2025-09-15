import "server-only";

import { Client, Account, TablesDB } from "node-appwrite";
import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/features/auth/constants";

export async function createSessionClient() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT!);

  const session = await cookies().get(AUTH_COOKIE);

  if (!session || !session.value) {
    throw new Error("Unauthorized");
  }
  client.setSession(session.value);

  return {
    get account() {
      return new Account(client);
    },
    get tablesDB() {
      return new TablesDB(client);
    },
  };
}

export async function createAdminClient() {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT!)
    .setProject(process.env.APPWRITE_PROJECT!)
    .setKey(process.env.APPWRITE_KEY!);

  return {
    get account() {
      return new Account(client);
    },
  };
}
