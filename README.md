# ALIGN

**ALIGN** is a collaborative task management tool with **workspace-based projects**, **team member roles**, **tasks**, and **built-in analytics** for productivity insights.

It is designed to help teams organize tasks, manage members, and measure project performance with real-time statistics.

---

## 🚀 Features

### 🔑 Authentication & User Management

- **Register & Login**: Create an account or log in with email/password.
- **Session Management**: Secure cookie-based session handling.
- **Logout**: Invalidate user sessions safely.
- **Get Current User**: Fetch logged-in user details.

### 👥 Workspace Members

- **List Members**: Retrieve all members of a workspace with enriched user details (name, email, role).
- **Delete Member**: Remove a member from a workspace (with role-based authorization).
- **Update Member Role**: Change a member’s role (e.g., ADMIN, MEMBER).
- **Role-based Authorization**:
  - Only Admins can update or remove other members.
  - Prevents removing the last member in a workspace.

### 📂 Workspaces

- **List Workspaces**: Get all workspaces a user belongs to.
- **Get Workspace**: Retrieve details of a workspace.
- **Create Workspace**: Create a new workspace (with optional image upload).
- **Update Workspace**: Edit workspace name or image (admin-only).
- **Delete Workspace**: Delete a workspace (admin-only).
- **Reset Invite Code**: Generate a new invite code for joining.
- **Join Workspace**: Join using an invite code.
- **Workspace Analytics**: Productivity insights across all projects in a workspace.

### 📂 Projects

- **Create Project**: Add a new project within a workspace (supports project images).
- **List Projects**: Get all projects for a workspace.
- **Get Project**: Fetch details of a specific project.
- **Update Project**: Edit project name or image.
- **Delete Project**: Remove a project (with member authorization).
- **Project Analytics**: Reporting on tasks and productivity inside a project.

### ✅ Tasks

- **List Tasks**: Retrieve tasks with filters:
  - `workspaceId` (required)
  - `projectId` (optional)
  - `assigneeId` (optional)
  - `status` (optional, e.g. `TODO`, `IN_PROGRESS`, `DONE`)
  - `search` (optional, by task name)
  - `dueDate` (optional, ISO string)
- **Get Task**: Retrieve a specific task with its project and assignee populated.
- **Create Task**: Add a new task (with auto-calculated position).
- **Update Task**: Modify task details (name, description, dueDate, status, projectId, assigneeId).
- **Delete Task**: Remove a task (workspace membership required).
- **Bulk Update Tasks**: Update multiple tasks at once (status and position).
- **Task + Relations**:
  - Each task can reference a **project** and an **assignee** (workspace member).
  - Returned tasks include enriched project and user details.

### 📊 Analytics

- **Workspace-level Analytics**:
  - Total tasks, assigned tasks, completed, incomplete, overdue.
  - Month-over-month comparisons.
- **Project-level Analytics**:
  - Similar breakdown, scoped to a single project.

## 🛠️ Tech Stack

### **Frontend**

- [Next.js 14](https://nextjs.org/) – React framework for app routing & server components
- [Lucide React](https://lucide.dev/) – icon set
- [TanStack Query](https://tanstack.com/query) – server state management
- [TanStack Table](https://tanstack.com/table) – data tables
- [React Hook Form](https://react-hook-form.com/) – form handling
- [React Big Calendar](https://github.com/jquense/react-big-calendar) – calendar & scheduling
- [ShadcnUI](https://ui.shadcn.com/) - customizable tailwind components

### **Backend**

- [Hono](https://hono.dev/) – lightweight web framework
- [Zod](https://zod.dev/) – schema validation
- [Appwrite](https://appwrite.io/) – authentication, database, and file storage
- [node-appwrite](https://www.npmjs.com/package/node-appwrite) – Appwrite SDK
- [date-fns](https://date-fns.org/) – date & time utilities

### **Utilities**

- [nuqs](https://nuqs.vercel.app/) – URL state synchronization
- [dotenv](https://github.com/motdotla/dotenv) – environment variable handling

### **Developer Tooling**

- [TypeScript](https://www.typescriptlang.org/) – type safety
- [ESLint](https://eslint.org/) – linting
- [PostCSS](https://postcss.org/) – CSS processing

---

## 📌 API Overview

### Auth Routes (`/auth`)

- `POST /login` – Login with email & password
- `POST /register` – Create new account & auto-login
- `GET /current` – Get current logged-in user
- `POST /logout` – End session

### Member Routes (`/members`)

- `GET /?workspaceId={id}` – List all workspace members
- `DELETE /:memberId` – Remove member (admin-only)
- `PATCH /:memberId` – Update member role

### Workspace Routes (`/workspaces`)

- `GET /` – List all workspaces for the current user
- `GET /:workspaceId` – Get workspace details
- `POST /` – Create new workspace (supports image upload)
- `PATCH /:workspaceId` – Update workspace (admin-only)
- `DELETE /:workspaceId` – Delete workspace (admin-only)
- `POST /:workspaceId/reset-invite-code` – Reset invite code (admin-only)
- `POST /:workspaceId/join` – Join workspace using invite code
- `GET /:workspaceId/analytics` – Get workspace analytics

### Project Routes (`/projects`)

- `POST /` – Create project
- `GET /?workspaceId={id}` – List all projects
- `GET /:projectId` – Get project details
- `PATCH /:projectId` – Update project details
- `DELETE /:projectId` – Delete project
- `GET /:projectId/analytics` – Get project analytics

### Task Routes (`/tasks`)

- `GET /?workspaceId={id}&projectId={id}&status={status}&assigneeId={id}&search={string}&dueDate={date}` – List tasks with filters
- `GET /:taskId` – Get task details (with project + assignee)
- `POST /` – Create new task
- `PATCH /:taskId` – Update task
- `DELETE /:taskId` – Delete task
- `POST /bulk-update` – Update multiple tasks (status + position)

---
