import { Models } from "node-appwrite";
import { Project } from "../projects/types";

export enum TaskStatus {
  BACKLOG = "BACKLOG",
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  DONE = "DONE",
}

export type Task = Models.Row & {
  name: string;
  status: TaskStatus;
  assigneeId: string;
  workspaceId: string;
  projectId: string;
  position: number;
  dueDate: string;
  description?: string;
  [key: string]: any;
};
