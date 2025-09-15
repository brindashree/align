"use server";

import { createSessionClient } from "@/lib/appwrite";

export const getCurrent = async () => {
  try {
    const { account } = await createSessionClient();

    const user = await account.get();
    return user;
  } catch (err) {
    console.error("Error in getCurrent:", err);
    return null;
  }
};
