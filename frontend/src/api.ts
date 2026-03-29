export type StatusResponse = {
  is_recording: boolean;
  transcript: string;
  followup: string;
  transition: string;
  empathy: string;
};

export type StopResponse = {
  message: string;
  scorecard: string;
};

function getApiBaseUrl(): string {
  // Default uses Vite dev proxy (/api) so you don't fight CORS during dev.
  // For direct backend calls, set VITE_API_URL=http://localhost:8000
  return (import.meta as any).env?.VITE_API_URL ?? "/api";
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, init);
}

export async function uploadPlan(file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);

  const res = await apiFetch("/upload_plan", { method: "POST", body: form });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

export async function updateConfig(customPrompt: string): Promise<void> {
  const res = await apiFetch("/update_config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ custom_prompt: customPrompt }),
  });
  if (!res.ok) throw new Error(`Update config failed (${res.status})`);
}

export async function startRecording(): Promise<void> {
  const res = await apiFetch("/start", { method: "POST" });
  if (!res.ok) throw new Error(`Start failed (${res.status})`);
}

export async function stopRecording(): Promise<StopResponse> {
  const res = await apiFetch("/stop", { method: "POST" });
  if (!res.ok) throw new Error(`Stop failed (${res.status})`);
  return (await res.json()) as StopResponse;
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await apiFetch("/status", { method: "GET" });
  if (!res.ok) throw new Error(`Status failed (${res.status})`);
  return (await res.json()) as StatusResponse;
}





