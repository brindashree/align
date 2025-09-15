import { Models } from "node-appwrite";

export type Workspace = Models.DefaultRow & {
  name: string;
  image: string;
  inviteCode: string;
  userId: string;
};
