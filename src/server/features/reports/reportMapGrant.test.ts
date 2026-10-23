import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReportMapGrant,
  grantCoversTile,
  verifyReportMapGrant,
} from "./reportMapGrant";

const reportWithGrid = `<!doctype html><html><body>
<figure data-widget="rank-grid"><script type="application/json">{"version":1,"center":{"lat":40.44,"lng":-79.99},"keywords":[{"keyword":"self storage","points":[{"row":0,"col":0,"lat":40.458,"lng":-80.013,"rank":3},{"row":2,"col":2,"lat":40.422,"lng":-79.967,"rank":null}]}]}</script><svg></svg></figure>
</body></html>`;

// Web-mercator tile at zoom 14 containing a coordinate.
function tileAt(lat: number, lng: number, z = 14) {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    z,
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(
      ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
    ),
  };
}

describe("report map grants", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-maps-key");
  });

  it("covers the report's grid and nothing far from it", async () => {
    const grant = await createReportMapGrant(reportWithGrid);
    const scope = await verifyReportMapGrant(grant ?? "");

    expect(scope).not.toBeNull();
    if (!scope) return;
    expect(grantCoversTile(tileAt(40.44, -79.99), scope)).toBe(true);
    // Philadelphia, ~400 km east.
    expect(grantCoversTile(tileAt(39.95, -75.16), scope)).toBe(false);
  });

  it("covers only the zooms a fitted view of the grid uses", async () => {
    const grant = await createReportMapGrant(reportWithGrid);
    const scope = await verifyReportMapGrant(grant ?? "");

    expect(scope).not.toBeNull();
    if (!scope) return;
    // The grid is ~4 km across, so street level is far past any fitted view.
    expect(grantCoversTile(tileAt(40.44, -79.99, 18), scope)).toBe(false);
  });

  it("rejects a grant whose area was widened", async () => {
    const grant = (await createReportMapGrant(reportWithGrid)) ?? "";
    const widened = grant.replace(/^[^~]+/, "-80");

    expect(await verifyReportMapGrant(widened)).toBeNull();
  });

  it("issues no grant without a Maps key", async () => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "");

    expect(await createReportMapGrant(reportWithGrid)).toBeNull();
  });
});
