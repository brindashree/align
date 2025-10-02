import { Models } from "node-appwrite";

export enum MemberRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}
export type Member = Models.Row & {
  workspaceId: string;
  userId: string;
  role: MemberRole;
  name: string;
  email: string;
};
