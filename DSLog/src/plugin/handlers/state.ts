import { postToUi } from "@plugin/utils/postMessage";
import { persist, session } from "./session";
import type { Msg } from "./types";

export async function handleGetState(): Promise<void> {
  postToUi({ type: "state", project: session.project });
}

export async function handleUpdateSettings(message: Msg<"update-settings">): Promise<void> {
  const { project } = session;
  project.settings = message.settings;
  await persist();
  postToUi({ type: "state", project });
}
