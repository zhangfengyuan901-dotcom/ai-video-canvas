// =========================================================================
// useApiSettings — API 设置状态 hook
// =========================================================================

import { useCallback } from "react";
import { useApi } from "./useApi";

export interface ApiSettingsStatus {
  chat: {
    configured: boolean;
    source: "stored" | "env" | "missing";
    maskedKey: string | null;
    baseUrl: string;
    model: string;
  };
  packy: {
    configured: boolean;
    source: "stored" | "env" | "missing";
    maskedKey: string | null;
    baseUrl: string;
    imageModel: string;
  };
  runninghub: {
    configured: boolean;
    source: "stored" | "env" | "missing";
    maskedKey: string | null;
    submitUrl: string;
    queryUrl: string;
    uploadUrl: string;
  };
}

export interface UpdateApiSettingsInput {
  chat?: {
    enabled?: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  };
  packy?: {
    enabled?: boolean;
    baseUrl?: string;
    imageModel?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  };
  runninghub?: {
    enabled?: boolean;
    apiKey?: string;
    clearApiKey?: boolean;
    submitUrl?: string;
    queryUrl?: string;
    uploadUrl?: string;
  };
}

export interface ApiSettingsCheckResult {
  chat: { configured: boolean; message: string };
  packy: { configured: boolean; message: string };
  runninghub: { configured: boolean; message: string };
}

export function useApiSettings() {
  const { get, put, post } = useApi();

  const getApiSettings = useCallback(async () => {
    return await get<ApiSettingsStatus>("/settings/api");
  }, [get]);

  const saveApiSettings = useCallback(async (payload: UpdateApiSettingsInput) => {
    return await put<ApiSettingsStatus>("/settings/api", payload);
  }, [put]);

  const checkApiSettings = useCallback(async () => {
    return await post<ApiSettingsCheckResult>("/settings/api/check", {});
  }, [post]);

  return { getApiSettings, saveApiSettings, checkApiSettings };
}
