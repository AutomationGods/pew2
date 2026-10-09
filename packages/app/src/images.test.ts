import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import {
  dedupeImages,
  imageSourceKind,
  imageFromMarkdown,
  imagesFromAttachments,
  imagesFromContent,
  imagesFromToolCall,
  isDisplayableImage,
} from "./images";

test("markdown image descriptions survive the installed renderer's actual AST", () => {
  interface MarkdownNode {
    type: string;
    attributes?: { src?: unknown; alt?: unknown };
    content?: unknown;
    children: MarkdownNode[];
  }
  const require = createRequire(import.meta.url);
  const renderer = createRequire(require.resolve("react-native-markdown-renderer/package.json"));
  const MarkdownIt = renderer("markdown-it");
  const parse: (
    text: string,
    render: (nodes: MarkdownNode[]) => MarkdownNode[],
    parser: object,
  ) => MarkdownNode[] = renderer("./lib/commonjs/lib/parser.js").default;
  const nodes = parse("![Architecture diagram](https://example.invalid/diagram.png)", nodes => nodes, new MarkdownIt());
  const images: ReturnType<typeof imageFromMarkdown>[] = [];
  function collect(nodes: MarkdownNode[]) {
    for (const node of nodes) {
      if (node.type === "image") {
        expect(node.attributes?.alt).toBe("");
        expect(node.content).toBe("Architecture diagram");
        images.push(imageFromMarkdown(node));
      }
      collect(node.children);
    }
  }
  collect(nodes);
  expect(images).toEqual([{ src: "https://example.invalid/diagram.png", alt: "Architecture diagram" }]);
});

test("explicit image alt wins, empty descriptions keep the generic fallback", () => {
  expect(imageFromMarkdown({ attributes: { src: "diagram.png", alt: "Explicit description" }, content: "Token description" }))
    .toEqual({ src: "diagram.png", alt: "Explicit description" });
  expect(imageFromMarkdown({ attributes: { src: "diagram.png", alt: "  " }, content: "Token description" }))
    .toEqual({ src: "diagram.png", alt: "Token description" });
  expect(imageFromMarkdown({ attributes: { src: "diagram.png" }, content: "" }))
    .toEqual({ src: "diagram.png", alt: undefined });
});

test("markdown image extraction still rejects unrenderable sources and malformed fields", () => {
  for (const src of ["notes.md", "diagram.svg", "data:image/svg+xml,example", "", 42]) {
    expect(imageFromMarkdown({ attributes: { src }, content: "Description" })).toBeUndefined();
  }
  expect(imageFromMarkdown({ attributes: { src: "diagram.png", alt: 42 }, content: {} }))
    .toEqual({ src: "diagram.png", alt: undefined });
});

test("inline image blocks become data URIs the app can paint", () => {
  expect(
    imagesFromContent({ type: "image", mimeType: "image/png", data: "AAAA" }),
  ).toEqual([{ src: "data:image/png;base64,AAAA", mimeType: "image/png" }]);
});

test("resource links are images only when the type or extension says so", () => {
  // The case that made generated pictures blank: a path on the desktop.
  expect(
    imagesFromContent({ type: "resource_link", uri: ".gg/generated/plot.png", name: "plot" }),
  ).toEqual([{ src: ".gg/generated/plot.png", mimeType: undefined, alt: "plot" }]);

  // A link to something that is not a picture must not become a broken frame.
  expect(imagesFromContent({ type: "resource_link", uri: "src/notes.md" })).toEqual([]);
});

test("embedded resources use their blob, and fall back to their uri", () => {
  expect(
    imagesFromContent({
      type: "resource",
      resource: { mimeType: "image/jpeg", blob: "QUJD", uri: "file:///shot.jpg" },
    }),
  ).toEqual([{ src: "data:image/jpeg;base64,QUJD", mimeType: "image/jpeg" }]);

  expect(
    imagesFromContent({ type: "resource", resource: { uri: "file:///shot.jpg" } }),
  ).toEqual([{ src: "file:///shot.jpg", mimeType: undefined }]);
});

test("tool call content carries generated images, but never tool text", () => {
  // An image generation tool reports its result here and nowhere else, so
  // ignoring tool calls is why 'the agent made a picture' rendered as nothing.
  const images = imagesFromToolCall({
    sessionUpdate: "tool_call_update",
    content: [
      { type: "content", content: { type: "text", text: "Wrote out.png" } },
      { type: "content", content: { type: "resource_link", uri: "/tmp/out.png" } },
      { type: "diff", path: "a.ts" },
    ],
  });
  expect(images).toEqual([{ src: "/tmp/out.png", mimeType: undefined, alt: undefined }]);
});

test("a format with no renderer is refused wherever it is declared", () => {
  // `image/svg+xml` is an image mime type, so trusting `image/*` alone would
  // let these through the source check and reserve a permanently empty frame.
  expect(
    imagesFromContent({ type: "image", mimeType: "image/svg+xml", data: "AA" }),
  ).toEqual([]);
  expect(
    imagesFromContent({
      type: "resource_link",
      uri: "diagram.svg",
      mimeType: "image/svg+xml",
    }),
  ).toEqual([]);
  expect(
    imagesFromContent({
      type: "resource",
      resource: { uri: "diagram.svg", mimeType: "image/svg+xml", blob: "AA" },
    }),
  ).toEqual([]);
});

test("sources are classified by who can load them", () => {
  expect(imageSourceKind("data:image/png;base64,AA")).toBe("inline");
  expect(imageSourceKind("https://example.com/a.png")).toBe("remote");
  // Only the daemon can read this one.
  expect(imageSourceKind("/Users/me/project/out.png")).toBe("local");
  expect(imageSourceKind("file:///Users/me/out.png")).toBe("local");
});

test("only real image sources are displayable", () => {
  expect(isDisplayableImage("out.PNG")).toBe(true);
  expect(isDisplayableImage("https://x.dev/a.jpg?v=2")).toBe(true);
  expect(isDisplayableImage("data:image/png;base64,AA")).toBe(true);
  expect(isDisplayableImage("data:text/plain;base64,AA")).toBe(false);
  expect(isDisplayableImage("notes.md")).toBe(false);
  expect(isDisplayableImage("")).toBe(false);
  // An image type with no renderer: it would decode to an empty frame, and the
  // daemon refuses the same format, so both halves must agree.
  expect(isDisplayableImage("data:image/svg+xml;base64,AA")).toBe(false);
  expect(isDisplayableImage("diagram.svg")).toBe(false);
});

test("an echoed attachment is a desktop path, never a device one", () => {
  // The daemon wrote these to its own tempdir, so they resolve like any other
  // agent image. No `origin`: that flag is only for the sending phone's
  // optimistic turn, whose copy is local to that handset.
  expect(
    imagesFromAttachments([
      { name: "shot.png", mimeType: "image/png", uri: "/tmp/pew2-attachments/s/0-shot.png" },
    ]),
  ).toEqual([
    { src: "/tmp/pew2-attachments/s/0-shot.png", mimeType: "image/png", alt: "shot.png" },
  ]);
});

test("attachments that are not paintable pictures are left to the file chip", () => {
  expect(
    imagesFromAttachments([
      { name: "log.txt", mimeType: "text/plain", uri: "/tmp/a/0-log.txt" },
      // An image type with no renderer, refused here exactly as it is elsewhere.
      { name: "d.svg", mimeType: "image/svg+xml", uri: "/tmp/a/1-d.svg" },
      // A missing uri is nothing to fetch.
      { name: "x.png", mimeType: "image/png" },
    ]),
  ).toEqual([]);
});

test("a turn with no attachments key is not an error", () => {
  // Nearly every user message: the daemon omits the field entirely.
  expect(imagesFromAttachments(undefined)).toEqual([]);
  expect(imagesFromAttachments("nonsense")).toEqual([]);
});

test("a tool restating its own result does not show the picture twice", () => {
  expect(dedupeImages([{ src: "a.png" }, { src: "a.png" }, { src: "b.png" }])).toEqual([
    { src: "a.png" },
    { src: "b.png" },
  ]);
});
