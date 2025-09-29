import { Hono } from "hono";
import { createTaskSchema } from "../schemas";
import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { getMember } from "@/features/members/utils";
import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID } from "@/config";
import { ID, Query } from "node-appwrite";
import { TaskStatus } from "../types";
import z from "zod";
import { createAdminClient } from "@/lib/appwrite";

const app = new Hono()
  .get(
    "/",
    zValidator(
      "query",
      z.object({
        workspaceId: z.string(),
        projectId: z.string().nullish(),
        assigneeId: z.string().nullish(),
        status: z.enum(TaskStatus).nullish(),
        search: z.string().nullish(),
        dueDate: z.string().nullish(),
      })
    ),
    sessionMiddleware,
    async (c) => {
      const { users } = await createAdminClient();
      const tablesDB = c.get("tablesdb");
      const user = c.get("user");

      const { dueDate, status, workspaceId, projectId, assigneeId, search } =
        c.req.valid("query");

      const member = getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const query = [
        Query.equal("workspaceId", workspaceId),
        Query.orderDesc("$createdAt"),
      ];
      if (projectId) {
        query.push(Query.equal("projectId", projectId));
      }
      if (status) {
        query.push(Query.equal("status", status));
      }
      if (assigneeId) {
        query.push(Query.equal("assigneeId", assigneeId));
      }
      if (dueDate) {
        query.push(Query.equal("dueDate", dueDate));
      }
      if (search) {
        query.push(Query.equal("name", search));
      }
      const tasks = await tablesDB.listRows({
        tableId: TASKS_ID,
        databaseId: DATABASE_ID,
        queries: query,
      });
      const projectIds = tasks.rows?.map((task) => task.projectId);
      const assigneeIds = tasks.rows?.map((task) => task.assigneeId);
      const projects = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: PROJECTS_ID,
        queries:
          projectIds.length > 0 ? [Query.contains("$id", projectIds)] : [],
      });
      const members = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: MEMBERS_ID,
        queries:
          assigneeIds.length > 0 ? [Query.contains("$id", assigneeIds)] : [],
      });

      const assignees = await Promise.all(
        members.rows.map(async (member) => {
          const user = await users.get(member.userId);
          return {
            ...member,
            name: user.name,
            email: user.email,
          };
        })
      );

      const populatedTasks = tasks.rows.map((task) => {
        const project = projects.rows.find(
          (project) => project.$id === task.projectId
        );
        const assignee = assignees.find(
          (assignee) => assignee.$id === task.assigneeId
        );
        return {
          ...task,
          project,
          assignee,
        };
      });
      return c.json({
        data: {
          ...tasks,
          rows: populatedTasks,
        },
      });
    }
  )
  .post(
    "/",
    zValidator("json", createTaskSchema),
    sessionMiddleware,
    async (c) => {
      const tablesDB = c.get("tablesdb");

      const user = c.get("user");

      const {
        name,
        description,
        dueDate,
        status,
        workspaceId,
        projectId,
        assigneeId,
      } = c.req.valid("json");

      const member = getMember({
        tablesDB,
        workspaceId,
        userId: user.$id,
      });
      if (!member) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const highestPositionTask = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        queries: [
          Query.equal("status", status),
          Query.equal("workspaceId", workspaceId),
          Query.orderAsc("position"),
          Query.limit(1),
        ],
      });
      const newPosition =
        highestPositionTask.rows.length > 0
          ? highestPositionTask.rows[0].position + 1000
          : 1000;

      const task = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TASKS_ID,
        rowId: ID.unique(),
        data: {
          name,
          status,
          description,
          workspaceId,
          projectId,
          dueDate,
          assigneeId,
          position: newPosition,
        },
      });

      return c.json({ data: task });
    }
  );

export default app;
