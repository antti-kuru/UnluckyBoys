import { describe, expect, it } from "vitest";
import { parseLeagueStandingsPage, parsePlayerCareerStats } from "../integrations/sportsgamer.js";

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

describe("parseLeagueStandingsPage", () => {
  it("reads standings from the SportsGamer page payload", () => {
    const html = `
      <div id="app" data-page="{&quot;props&quot;:{&quot;league&quot;:{&quot;id&quot;:250,&quot;name&quot;:&quot;ECL &amp;#039;23: Winter - Elite&quot;,&quot;groups&quot;:[{&quot;groupId&quot;:0,&quot;teams&quot;:[{&quot;gamesPlayed&quot;:30,&quot;wins&quot;:8,&quot;losses&quot;:14,&quot;ties&quot;:0,&quot;otWins&quot;:4,&quot;otLosses&quot;:4,&quot;points&quot;:28,&quot;goalsFor&quot;:66,&quot;goalsAgainst&quot;:85,&quot;ppPercentage&quot;:21.95,&quot;pkPercentage&quot;:77.27,&quot;penaltyMinutes&quot;:44,&quot;shots&quot;:344,&quot;hits&quot;:286,&quot;currentStreak&quot;:&quot;4-5-1&quot;,&quot;team&quot;:{&quot;id&quot;:159,&quot;name&quot;:&quot;Unlucky Boys&quot;,&quot;abbreviation&quot;:&quot;UB&quot;,&quot;logo&quot;:&quot;https://example.com/logo.png&quot;}}]}]},&quot;groupNames&quot;:[]}}"></div>
    `;

    const parsed = parseLeagueStandingsPage(html, 250, "https://sportsgamer.gg/leagues/250/standings");

    expect(parsed.leagueName).toBe("ECL '23: Winter - Elite");
    expect(parsed.groups[0].teams[0]).toMatchObject({
      rank: 1,
      teamName: "Unlucky Boys",
      abbreviation: "UB",
      gamesPlayed: 30,
      overtimeWins: 4,
      overtimeLosses: 4,
      points: 28,
      goalDifference: -19
    });
  });
});
