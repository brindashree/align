import { Models } from "node-appwrite";

export type Project = Models.Row & {
  name: string;
  image: string;
  workspaceId: string;
};
