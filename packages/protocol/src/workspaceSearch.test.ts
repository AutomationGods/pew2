import { expect, test } from "bun:test";
import { matchesWorkspaceQuery, searchWorkspaces } from "./workspaceSearch.js";

const a = { path: "/Users/k/projects/pew2", name: "pew2" };
const b = { path: "/Users/k/pew-work/api", name: "api" };
const c = { path: "/Users/k/projects/site", name: "site" };

test("an empty query matches everything, in the order given", () => {
  expect(searchWorkspaces([a, b, c], "  ")).toEqual([a, b, c]);
});

test("every term must match the name or path, ignoring case", () => {
  expect(matchesWorkspaceQuery(a, "PEW")).toBe(true);
  expect(matchesWorkspaceQuery(c, "projects site")).toBe(true);
  expect(matchesWorkspaceQuery(c, "projects pew")).toBe(false);
});

test("name matches rank above path-only matches", () => {
  expect(searchWorkspaces([b, a, c], "pew")).toEqual([a, b]);
});
