import { useQuery, useQueryClient } from "@tanstack/react-query";
import { triggersApi, type TriggerDetail } from "@/lib/api/triggers";

export function useTrigger(triggerId: string | null, open: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery<TriggerDetail>({
    queryKey: ["trigger-detail", triggerId],
    queryFn: () => triggersApi.getById(triggerId as string),
    enabled: !!triggerId && open,
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["trigger-detail", triggerId] });
    queryClient.invalidateQueries({ queryKey: ["triggers"] });
  };
  return { trigger: query.data, isLoading: query.isLoading, invalidate };
}
