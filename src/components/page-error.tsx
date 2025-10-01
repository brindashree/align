import { AlertTriangle } from "lucide-react";
import React from "react";

interface PageErrorProps {
  message?: string;
}

export const PageError = ({
  message = "Something went wrong",
}: PageErrorProps) => {
  return (
    <div className="flex items-center justify-center h-full">
      <AlertTriangle className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
};
