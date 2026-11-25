import { formatR2KeyFromPath } from "@/lib/r2";

describe("r2 path formatting", () => {
  test("image path includes trip slug", () => {
    const path = "/images/california/DSC_3305.png";
    const slug = "california";
    const result = formatR2KeyFromPath(path, slug);
    expect(result).toBe(path);
  });

  test("image path does not trip slug", () => {
    const path = "/images/20210525_112203.jpg";
    const slug = "virginia";
    const result = formatR2KeyFromPath(path, slug);
    expect(result).toBe(`images/${slug}/20210525_112203.jpg`);
  });

  test("image path includes entry slug but not trip slug", () => {
    const path = "/images/kyoto/DSC_3077.png";
    const slug = "japan";
    const result = formatR2KeyFromPath(path, slug);
    expect(result).toBe(`images/${slug}/DSC_3077.png`);
  });
});
