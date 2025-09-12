"use server";

import { cookies } from "next/headers";
import { Account, Client } from "node-appwrite";
import { AUTH_COOKIE } from "./constants";

export const getCurrent = async () => {
  try {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT!);

    const session = await cookies().get(AUTH_COOKIE);

    if (!session) return null;
    client.setSession(session.value);

    const account = new Account(client);

    const user = await account.get();
    return user;
  } catch (err) {
    console.error("Error in getCurrent:", err);
    return null;
  }
};
