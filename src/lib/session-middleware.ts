import "server-only";
import { getCookie } from "hono/cookie";

import { createMiddleware } from "hono/factory";
import { AUTH_COOKIE } from "@/features/auth/constants";
import {
  Account,
  Client,
  Databases,
  Models,
  Storage,
  TablesDB,
  type Account as AccountType,
  type Databases as DatabasesType,
  type Storage as StorageType,
  type Users as UsersType,
  type TablesDB as TablesDBType,
} from "node-appwrite";

type AdditionalContext = {
  Variables: {
    account: AccountType;
    databases: DatabasesType;
    storage: StorageType;
    users: UsersType;
    user: Models.User<Models.Preferences>;
    tablesdb: TablesDBType;
  };
};

export const sessionMiddleware = createMiddleware<AdditionalContext>(
  async (c, next) => {
    const client = new Client()
      .setEndpoint(process.env.APPWRITE_ENDPOINT!)
      .setProject(process.env.APPWRITE_PROJECT!);

    const session = getCookie(c, AUTH_COOKIE);
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    client.setSession(session);

    const account = new Account(client);
    const databases = new Databases(client);
    const storage = new Storage(client);
    const tablesdb = new TablesDB(client);

    const user = await account.get();

    c.set("account", account);
    c.set("databases", databases);
    c.set("storage", storage);
    c.set("user", user);
    c.set("tablesdb", tablesdb);

    return next();
  }
);
