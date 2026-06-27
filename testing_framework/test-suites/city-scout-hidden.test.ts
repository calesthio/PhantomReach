import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((target: string) => {
  throw new Error(`redirect:${target}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("City Scout hard hide", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it.each([
    ["scouts index", "@/app/(dashboard)/scouts/page"],
    ["new scout", "@/app/(dashboard)/scouts/new/page"],
    ["scout loading", "@/app/(dashboard)/scouts/loading/page"],
    ["scout detail", "@/app/(dashboard)/scouts/[id]/page"],
  ])("redirects %s to audits", async (_name, modulePath) => {
    const mod = await import(modulePath);

    expect(() => mod.default()).toThrow("redirect:/audits");
    expect(redirectMock).toHaveBeenCalledWith("/audits");
  });
});
