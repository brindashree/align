import { client } from "@/lib/rpc";
import { useQuery } from "@tanstack/react-query";

interface UseGetWorkspaceAnalyticsProps {
  workspaceId: string;
}
export const useGetWorkspaceAnalytics = ({
  workspaceId,
}: UseGetWorkspaceAnalyticsProps) => {
  const query = useQuery({
    queryKey: ["workspace-analytics", workspaceId],
    queryFn: async () => {
      const response = await client.api.workspaces[":workspaceId"][
        "analytics"
      ].$get({
        param: { workspaceId },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch workspace analytics");
      }

      const { data } = await response.json();
      return data;
    },
  });
  return query;
};
