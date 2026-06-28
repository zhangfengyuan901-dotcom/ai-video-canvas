// =========================================================================
// useRhCli — RH CLI 前端 hook
// =========================================================================

import { useCallback } from "react";
import { useApi } from "./useApi";

export interface RhCheckData {
  available: boolean;
  hint?: string;
  status?: string;
  keyPrefix?: string;
  keySource?: string;
  balance?: string;
  currency?: string;
  coins?: string;
  runningTasks?: string;
}

export interface RhModel {
  id?: string;
  name?: string;
  endpoint?: string;
  endpointName?: string;
  desc?: string;
  description?: string;
  type?: string;
  task?: string;
}

export interface RhModelsData {
  available: boolean;
  hint?: string;
  models?: RhModel[];
}

export interface RhRunData {
  available: boolean;
  hint?: string;
  files?: string[];
  texts?: string[];
  cost?: string;
  duration?: number;
  taskId?: string;
  error?: string;
  message?: string;
}

export function useRhCli() {
  const { get, post } = useApi();

  const checkBalance = useCallback(async (): Promise<RhCheckData> => {
    return await get<RhCheckData>("/rhcli/check");
  }, [get]);

  const listModels = useCallback(async (type: "image" | "video"): Promise<RhModelsData> => {
    return await get<RhModelsData>(`/rhcli/models?type=${type}`);
  }, [get]);

  const generateImage = useCallback(
    async (prompt: string, model?: string): Promise<RhRunData> => {
      return await post<RhRunData>("/rhcli/image", { prompt, model });
    },
    [post],
  );

  const generateVideo = useCallback(
    async (prompt: string, model: string, duration?: number): Promise<RhRunData> => {
      return await post<RhRunData>("/rhcli/video", { prompt, model, duration });
    },
    [post],
  );

  return { checkBalance, listModels, generateImage, generateVideo };
}
