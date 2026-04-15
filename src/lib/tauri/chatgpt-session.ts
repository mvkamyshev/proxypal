import { invoke } from "@tauri-apps/api/core";

export interface ChatGptWebSession {
  WARNING_BANNER?: string;
  accessToken?: string;
  account?: {
    id?: string;
    planType?: string;
    structure?: string;
  };
  authProvider?: string;
  expires?: string;
  rumViewTags?: {
    light_account?: {
      fetched?: boolean;
    };
  };
  sessionToken?: string;
  user?: {
    email?: string;
    id?: string;
    name?: string;
  };
}

export async function getChatgptWebSession(fileName: string): Promise<ChatGptWebSession> {
  return invoke("get_chatgpt_web_session", { fileName });
}
