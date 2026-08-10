import { writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function buildNode(name, seed) {
  return {
    id: `node-${name}-${seed}`,
    name,
    type: "FRAME",
    visible: true,
    width: 100 + (seed % 20),
    height: 40 + (seed % 10),
    cornerRadius: seed % 8,
    fills: [{ type: "SOLID", visible: true, opacity: 1, color: { r: 1, g: 1, b: 1 } }],
    layoutMode: "HORIZONTAL",
    paddingTop: 8,
    paddingRight: 8,
    paddingBottom: 8,
    paddingLeft: 8,
    itemSpacing: 4,
    primaryAxisAlignItems: "CENTER",
    counterAxisAlignItems: "CENTER",
    children: [
      {
        id: `node-${name}-${seed}-label`,
        name: "Label",
        type: "TEXT",
        visible: true,
        width: 60,
        height: 16,
        fontName: { family: "Inter", style: "Regular" },
        fontSize: 12,
        lineHeight: { value: 16, unit: "PIXELS" },
        letterSpacing: { value: 0, unit: "PIXELS" },
        children: [],
      },
    ],
  };
}

function buildComponent(index) {
  const name = `Component ${index}`;
  return {
    id: `component-${index}`,
    key: `key-${index}`,
    name,
    type: "COMPONENT",
    description: `Fixture component ${index}`,
    remote: false,
    componentPropertyDefinitions: {
      [`Size#${index}`]: {
        type: "VARIANT",
        defaultValue: "Medium",
        variantOptions: ["Small", "Medium", "Large"],
      },
      [`Disabled#${index}`]: { type: "BOOLEAN", defaultValue: false },
    },
    variants: [
      {
        id: `component-${index}`,
        name,
        variantProperties: { Size: "Medium" },
        node: buildNode(name, index),
      },
    ],
    representative: buildNode(name, index),
  };
}

function buildCollection() {
  return {
    id: "collection-1",
    name: "Primitives",
    modes: [
      { modeId: "mode-light", name: "Light" },
      { modeId: "mode-dark", name: "Dark" },
    ],
    defaultModeId: "mode-light",
    remote: false,
  };
}

function buildToken(index) {
  const isColor = index % 2 === 0;
  return {
    id: `token-${index}`,
    key: `token-key-${index}`,
    name: `color.token.${index}`,
    collectionId: "collection-1",
    collectionName: "Primitives",
    resolvedType: isColor ? "COLOR" : "FLOAT",
    scopes: isColor ? ["ALL_FILLS"] : ["CORNER_RADIUS"],
    description: `Fixture token ${index}`,
    remote: false,
    valuesByMode: [
      {
        modeId: "mode-light",
        modeName: "Light",
        value: isColor ? { r: 0.1, g: 0.2, b: 0.3 } : index,
      },
      {
        modeId: "mode-dark",
        modeName: "Dark",
        value: isColor ? { r: 0.9, g: 0.8, b: 0.7 } : index + 1,
      },
    ],
  };
}

function buildFixture(componentCount, tokenCount) {
  return {
    components: Array.from({ length: componentCount }, (_, i) => buildComponent(i)),
    tokens: Array.from({ length: tokenCount }, (_, i) => buildToken(i)),
    collections: [buildCollection()],
  };
}

const fixtures = {
  "small-ds.json": buildFixture(50, 500),
  "medium-ds.json": buildFixture(250, 1000),
  "large-ds.json": buildFixture(1000, 2000),
};

for (const [filename, data] of Object.entries(fixtures)) {
  const outPath = path.join(root, "fixtures", filename);
  writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`Wrote ${outPath} (${data.components.length} components, ${data.tokens.length} tokens)`);
}
