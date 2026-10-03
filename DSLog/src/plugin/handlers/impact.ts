import { scanInstances } from "@plugin/scanner";
import { postToUi } from "@plugin/utils/postMessage";
import { persist, session } from "./session";

export async function handleBuildImpactIndex(): Promise<void> {
  const { project } = session;
  const index = await scanInstances((progress) => {
    postToUi({ type: "impact-index-progress", progress });
  });
  project.instanceIndex = index;

  await persist();
  postToUi({ type: "impact-index-complete", index });
  postToUi({ type: "state", project });
}
