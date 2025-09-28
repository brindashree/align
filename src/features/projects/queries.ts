import { createSessionClient } from "@/lib/appwrite";
import { getMember } from "../members/utils";
import { Project } from "./types";
import { DATABASE_ID, PROJECTS_ID } from "@/config";

interface GetProjectProps {
  projectId: string;
}

export const getProject = async ({ projectId }: GetProjectProps) => {
  const { account, tablesDB } = await createSessionClient();
  const user = await account.get();

  const project = await tablesDB.getRow<Project>({
    databaseId: DATABASE_ID,
    tableId: PROJECTS_ID,
    rowId: projectId,
  });

  const member = await getMember({
    tablesDB: tablesDB,
    workspaceId: project.workspaceId,
    userId: user?.$id,
  });

  if (!member) {
    throw new Error("Unauthorized");
  }

  return project;
};
