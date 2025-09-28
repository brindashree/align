import { Models } from "node-appwrite";

export type Project = Models.DefaultRow & {
  name: string;
  image: string;
  workspaceId: string;
};
