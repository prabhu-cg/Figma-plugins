import type { UiToPluginMessage } from "@shared/types/messages";

/** The UI → plugin message with the given `type`. */
export type Msg<T extends UiToPluginMessage["type"]> = Extract<UiToPluginMessage, { type: T }>;
