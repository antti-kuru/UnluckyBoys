import { describe, expect, it } from "vitest";
import { parsePlayerCareerStats } from "../integrations/sportsgamer.js";

describe("parsePlayerCareerStats", () => {
  it("keeps only configured team rows", () => {
    const html = `
      <table>
        <tr><th>League</th><th>Team</th><th>GP</th><th>G</th><th>A</th><th>P</th><th>+/-</th><th>PIM</th></tr>
        <tr><td>ECL</td><td>Unlucky Boys</td><td>10</td><td>4</td><td>7</td><td>11</td><td>-3</td><td>2</td></tr>
        <tr><td>ECL</td><td>Other</td><td>9</td><td>9</td><td>9</td><td>18</td><td>9</td><td>9</td></tr>
      </table>
    `;
    const parsed = parsePlayerCareerStats(html);
    expect(parsed.skater).toHaveLength(1);
    expect(parsed.skater[0]).toMatchObject({ team: "Unlucky Boys", goals: 4, points: 11, plusMinus: -3 });
  });
});
