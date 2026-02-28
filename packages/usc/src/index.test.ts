import { describe, it, expect } from "vitest";
import { convertTitle } from "./index.js";

describe("@law2md/usc", () => {
  it("exports convertTitle function", () => {
    expect(typeof convertTitle).toBe("function");
  });
});
