<script lang="ts">
  import { onMount } from "svelte";
  import { ExternalLink, LogIn, LogOut, Plus, RefreshCw, Save, Trash2 } from "lucide-svelte";
  import { api, deleteJson, postJson } from "./lib/api";
  import type { Achievement, GoalieStat, News, Player, SkaterStat, UpcomingGame } from "./lib/types";

  type Records = Record<string, Record<string, string | number | null>>;

  const nav = [
    { href: "/", label: "Home" },
    { href: "/news", label: "News" },
    { href: "/x", label: "X" },
    { href: "/roster", label: "Roster" },
    { href: "/achievements-records", label: "Achievements & Records" },
    { href: "/admin", label: "Admin" }
  ];

  let path = window.location.pathname;
  let loadedRoute = "";
  let loading = false;
  let error = "";

  let homeNews: News[] = [];
  let news: News[] = [];
  let selectedNews: News | null = null;
  let newsOffset = 0;
  let roster: Player[] = [];
  let player: Player | null = null;
  let skaterStats: SkaterStat[] = [];
  let goalieStats: GoalieStat[] = [];
  let achievements: Achievement[] = [];
  let games: UpcomingGame[] = [];
  let records: Records = {};

  let admin: { email: string; displayName: string } | null = null;
  let loginForm = { email: "admin@unluckyboys.local", password: "" };
  let newsForm = { title: "", summary: "", body: "", coverImageUrl: "/brand/banner.png" };
  let playerForm = {
    name: "",
    nickname: "",
    position: "C",
    number: 0,
    nationality: "FIN",
    captain: false,
    alternateCaptain: false,
    imageUrl: "",
    bio: "",
    sportsGamerUrl: "",
    active: true,
    rosterOrder: 10
  };
  let achievementForm = { title: "", body: "", displayOrder: 10 };
  let adminMessage = "";

  function routeTo(href: string, event?: MouseEvent) {
    event?.preventDefault();
    history.pushState({}, "", href);
    path = window.location.pathname;
    window.scrollTo({ top: 0 });
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  }

  function placeholder(name: string) {
    const initials = name
      .split(/\s|_/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
    return initials || "UB";
  }

  async function loadRoute() {
    if (loadedRoute === path) return;
    loadedRoute = path;
    error = "";
    loading = true;
    try {
      if (path === "/") await loadHome();
      else if (path === "/news") await loadNews(true);
      else if (path.startsWith("/news/")) await loadNewsArticle(path.split("/")[2]);
      else if (path === "/x") loadX();
      else if (path === "/roster") await loadRoster();
      else if (path.startsWith("/players/")) await loadPlayer(path.split("/")[2]);
      else if (path === "/achievements-records") await loadAchievementsRecords();
      else if (path === "/admin") await loadAdmin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Something went wrong";
    } finally {
      loading = false;
    }
  }

  async function loadHome() {
    const [newsResponse, gamesResponse] = await Promise.all([
      api<{ items: News[] }>("/news?limit=3&offset=0"),
      api<{ items: UpcomingGame[] }>("/games/upcoming")
    ]);
    homeNews = newsResponse.items;
    games = gamesResponse.items;
  }

  async function loadNews(reset = false) {
    const offset = reset ? 0 : newsOffset;
    const response = await api<{ items: News[]; offset: number; limit: number }>(`/news?limit=10&offset=${offset}`);
    news = reset ? response.items : [...news, ...response.items];
    newsOffset = offset + response.items.length;
  }

  async function loadNewsArticle(slug: string) {
    selectedNews = await api<News>(`/news/${slug}`);
  }

  function loadX() {
    setTimeout(() => (window as any).twttr?.widgets?.load?.(), 100);
  }

  async function loadRoster() {
    const response = await api<{ items: Player[] }>("/roster");
    roster = response.items;
  }

  async function loadPlayer(slug: string) {
    const [playerResponse, statsResponse] = await Promise.all([
      api<Player>(`/players/${slug}`),
      api<{ skater: SkaterStat[]; goalie: GoalieStat[] }>(`/players/${slug}/stats`)
    ]);
    player = playerResponse;
    skaterStats = statsResponse.skater;
    goalieStats = statsResponse.goalie;
  }

  async function loadAchievementsRecords() {
    const [achievementResponse, recordResponse] = await Promise.all([
      api<{ items: Achievement[] }>("/achievements"),
      api<Records>("/records")
    ]);
    achievements = achievementResponse.items;
    records = recordResponse;
  }

  async function loadAdmin() {
    const me = await api<{ admin: typeof admin }>("/admin/auth/me");
    admin = me.admin;
    const [newsResponse, achievementResponse, rosterResponse] = await Promise.all([
      api<{ items: News[] }>("/news?limit=50&offset=0"),
      api<{ items: Achievement[] }>("/achievements"),
      api<{ items: Player[] }>("/roster")
    ]);
    news = newsResponse.items;
    achievements = achievementResponse.items;
    roster = rosterResponse.items;
  }

  async function login() {
    adminMessage = "";
    await postJson("/admin/auth/login", loginForm);
    await loadAdmin();
  }

  async function logout() {
    await postJson("/admin/auth/logout", {});
    admin = null;
  }

  async function createNews() {
    await postJson("/admin/news", newsForm);
    newsForm = { title: "", summary: "", body: "", coverImageUrl: "/brand/banner.png" };
    adminMessage = "News saved.";
    await loadAdmin();
  }

  async function createPlayer() {
    await postJson("/admin/players", playerForm);
    playerForm = {
      name: "",
      nickname: "",
      position: "C",
      number: 0,
      nationality: "FIN",
      captain: false,
      alternateCaptain: false,
      imageUrl: "",
      bio: "",
      sportsGamerUrl: "",
      active: true,
      rosterOrder: 10
    };
    adminMessage = "Player saved.";
    await loadAdmin();
  }

  async function createAchievement() {
    await postJson("/admin/achievements", achievementForm);
    achievementForm = { title: "", body: "", displayOrder: 10 };
    adminMessage = "Achievement saved.";
    await loadAdmin();
  }

  async function removeNews(slug: string) {
    await deleteJson(`/admin/news/${slug}`);
    await loadAdmin();
  }

  async function removeAchievement(id: string) {
    await deleteJson(`/admin/achievements/${id}`);
    await loadAdmin();
  }

  async function removePlayer(slug: string) {
    await deleteJson(`/admin/players/${slug}`);
    await loadAdmin();
  }

  async function syncSportsGamer() {
    adminMessage = "Sync started.";
    const result = await postJson<{ syncedPlayers: number }>("/admin/integrations/sportsgamer/sync", {});
    adminMessage = `Synced ${result.syncedPlayers} player profiles.`;
  }

  onMount(() => {
    const handler = () => {
      path = window.location.pathname;
    };
    window.addEventListener("popstate", handler);
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    document.body.appendChild(script);
    return () => window.removeEventListener("popstate", handler);
  });

  $: loadRoute();
</script>

<svelte:head>
  <title>Unlucky Boys</title>
  <meta name="description" content="Unlucky Boys esports NHL team hub" />
</svelte:head>

<header class="site-header">
  <a href="/" class="brand" on:click={(event) => routeTo("/", event)}>
    <img class="brand-mark" src="/brand/logo.png" alt="Unlucky Boys logo" />
    <span>
      <strong>Unlucky Boys</strong>
      <small>Burgernation</small>
    </span>
  </a>
  <nav aria-label="Main navigation">
    {#each nav as item}
      <a class:active={path === item.href} href={item.href} on:click={(event) => routeTo(item.href, event)}>{item.label}</a>
    {/each}
  </nav>
</header>

<main>
  {#if error}
    <section class="notice error">{error}</section>
  {/if}
  {#if loading}
    <section class="notice">Loading</section>
  {/if}

  {#if path === "/"}
    <section class="home-grid">
      <div class="intro-panel">
        <p class="kicker">SportsGamer era team hub</p>
        <h1>Unlucky Boys</h1>
        <p class="welcome">Welcome to burgernation, the home of Unlucky Boys.</p>
        <p>News, roster, upcoming games, player profiles, achievements, and all-time records for the club.</p>
        <div class="quick-links">
          <a href="/roster" on:click={(event) => routeTo("/roster", event)}>Roster</a>
          <a href="/achievements-records" on:click={(event) => routeTo("/achievements-records", event)}>Records</a>
        </div>
      </div>
      <section class="panel">
        <div class="section-title">
          <h2>Upcoming Games</h2>
        </div>
        {#if games.length}
          <div class="game-list">
            {#each games as game}
              <article class="game-row">
                <span>{game.competition}</span>
                <strong>{game.opponent}</strong>
                <time>{formatDate(game.startsAt)}</time>
                {#if game.sportsGamerUrl}
                  <a aria-label="Open SportsGamer game" href={game.sportsGamerUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} /></a>
                {/if}
              </article>
            {/each}
          </div>
        {:else}
          <p class="muted">No upcoming games have been added yet.</p>
        {/if}
      </section>
    </section>

    <section class="content-grid">
      <div>
        <div class="section-title">
          <h2>Latest News</h2>
          <a href="/news" on:click={(event) => routeTo("/news", event)}>All news</a>
        </div>
        <div class="cards">
          {#each homeNews as article}
            <a class="card news-card" href={`/news/${article.slug}`} on:click={(event) => routeTo(`/news/${article.slug}`, event)}>
              <img src={article.coverImageUrl || "/brand/banner.png"} alt={article.title} />
              <time>{formatDate(article.publishedAt)}</time>
              <h3>{article.title}</h3>
              <p>{article.summary}</p>
            </a>
          {/each}
        </div>
      </div>
      <aside class="panel logo-panel">
        <img src="/brand/logo.png" alt="Unlucky Boys Burgernation logo" />
        <a class="command" href="/x" on:click={(event) => routeTo("/x", event)}>Open X feed</a>
      </aside>
    </section>
  {:else if path === "/news"}
    <section class="page-head">
      <h1>News</h1>
    </section>
    <div class="list">
      {#each news as article}
        <a class="wide-card news-list-card" href={`/news/${article.slug}`} on:click={(event) => routeTo(`/news/${article.slug}`, event)}>
          <img src={article.coverImageUrl || "/brand/banner.png"} alt={article.title} />
          <time>{formatDate(article.publishedAt)}</time>
          <h2>{article.title}</h2>
          <p>{article.summary}</p>
        </a>
      {/each}
    </div>
    <button class="command" on:click={() => loadNews(false)}><Plus size={18} />Load more</button>
  {:else if path.startsWith("/news/")}
    {#if selectedNews}
      <article class="article-page">
        <img src={selectedNews.coverImageUrl || "/brand/banner.png"} alt={selectedNews.title} />
        <div class="article-body">
          <time>{formatDate(selectedNews.publishedAt)}</time>
          <h1>{selectedNews.title}</h1>
          <p class="lead">{selectedNews.summary}</p>
          <p>{selectedNews.body}</p>
        </div>
      </article>
    {/if}
  {:else if path === "/x"}
    <section class="page-head">
      <h1>X Feed</h1>
      <a class="external" href="https://twitter.com/UnluckyBoysNHL" target="_blank" rel="noreferrer"><ExternalLink size={18} />@UnluckyBoysNHL</a>
    </section>
    <section class="panel x-page">
      <a class="twitter-timeline" data-height="760" data-theme="dark" href="https://twitter.com/UnluckyBoysNHL">Tweets by UnluckyBoysNHL</a>
    </section>
  {:else if path === "/roster"}
    <section class="page-head">
      <h1>Roster</h1>
    </section>
    <div class="roster-grid">
      {#each roster as item}
        <a class="player-card" href={`/players/${item.slug}`} on:click={(event) => routeTo(`/players/${item.slug}`, event)}>
          {#if item.imageUrl}
            <img src={item.imageUrl} alt={item.name} />
          {:else}
            <div class="player-placeholder">{placeholder(item.name)}</div>
          {/if}
          <span class="card-meta">#{item.number} · {item.position} · {item.nationality || "FIN"}</span>
          <strong>{item.name}</strong>
          {#if item.nickname}
            <em>{item.nickname}</em>
          {/if}
          {#if item.captain || item.alternateCaptain}
            <small class="captain-badge">{item.captain ? "C" : "A"}</small>
          {/if}
        </a>
      {/each}
    </div>
  {:else if path.startsWith("/players/")}
    {#if player}
      <section class="player-profile">
        {#if player.imageUrl}
          <img src={player.imageUrl} alt={player.name} />
        {:else}
          <div class="player-placeholder large">{placeholder(player.name)}</div>
        {/if}
        <div>
          <span class="kicker">#{player.number} · {player.position} · {player.nationality || "FIN"}</span>
          <h1>{player.name}</h1>
          {#if player.nickname}
            <p class="player-nickname">{player.nickname} {player.captain ? "· Captain" : player.alternateCaptain ? "· Alternate Captain" : ""}</p>
          {/if}
          <p>{player.bio || "Player bio can be updated from the admin dashboard."}</p>
          {#if player.sportsGamerUrl}
            <a class="external" href={player.sportsGamerUrl} target="_blank" rel="noreferrer"><ExternalLink size={18} />SportsGamer profile</a>
          {/if}
        </div>
      </section>
      <section class="stats-section">
        <h2>Skater Seasons</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>League</th><th>Team</th><th>GP</th><th>G</th><th>A</th><th>P</th><th>+/-</th><th>PIM</th></tr></thead>
            <tbody>
              {#each skaterStats as stat}
                <tr><td>{stat.league}</td><td>{stat.teamName}</td><td>{stat.gamesPlayed}</td><td>{stat.goals}</td><td>{stat.assists}</td><td>{stat.points}</td><td>{stat.plusMinus}</td><td>{stat.penaltyMinutes}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
        <h2>Goalie Seasons</h2>
        <div class="table-wrap">
          <table>
            <thead><tr><th>League</th><th>Team</th><th>GP</th><th>W</th><th>L</th><th>OTL</th><th>SV%</th><th>GAA</th><th>SO</th></tr></thead>
            <tbody>
              {#each goalieStats as stat}
                <tr><td>{stat.league}</td><td>{stat.teamName}</td><td>{stat.gamesPlayed}</td><td>{stat.wins}</td><td>{stat.losses}</td><td>{stat.overtimeLosses}</td><td>{stat.savePercentage ?? "-"}</td><td>{stat.goalsAgainstAverage ?? "-"}</td><td>{stat.shutouts}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </section>
    {/if}
  {:else if path === "/achievements-records"}
    <section class="page-head">
      <h1>Achievements & Records</h1>
    </section>
    <div class="content-grid">
      <section class="list">
        {#each achievements as achievement}
          <article class="wide-card">
            <h2>{achievement.title}</h2>
            <p>{achievement.body}</p>
          </article>
        {/each}
      </section>
      <aside class="panel">
        <h2>All-Time Leaders</h2>
        <div class="records">
          {#each Object.entries(records) as [key, value]}
            <div class="record-row">
              <span>{key.replace(/([A-Z])/g, " $1")}</span>
              <strong>{value?.name ?? "Pending"}</strong>
              <em>{value ? Object.values(value).filter((item) => typeof item === "number")[0] : "-"}</em>
            </div>
          {/each}
        </div>
      </aside>
    </div>
  {:else if path === "/admin"}
    <section class="page-head">
      <h1>Admin</h1>
      {#if admin}
        <button class="icon-button" aria-label="Log out" on:click={logout}><LogOut size={18} /></button>
      {/if}
    </section>
    {#if !admin}
      <form class="admin-form compact" on:submit|preventDefault={login}>
        <label>Email<input bind:value={loginForm.email} type="email" /></label>
        <label>Password<input bind:value={loginForm.password} type="password" /></label>
        <button class="command" type="submit"><LogIn size={18} />Log in</button>
      </form>
    {:else}
      <p class="muted">Signed in as {admin.displayName}</p>
      {#if adminMessage}<p class="notice">{adminMessage}</p>{/if}
      <div class="admin-grid">
        <form class="admin-form" on:submit|preventDefault={createNews}>
          <h2>News</h2>
          <label>Title<input bind:value={newsForm.title} /></label>
          <label>Summary<input bind:value={newsForm.summary} /></label>
          <label>Body<textarea bind:value={newsForm.body}></textarea></label>
          <label>Image URL<input bind:value={newsForm.coverImageUrl} /></label>
          <button class="command" type="submit"><Save size={18} />Save news</button>
        </form>
        <form class="admin-form" on:submit|preventDefault={createPlayer}>
          <h2>Roster</h2>
          <label>Name<input bind:value={playerForm.name} /></label>
          <label>Nickname<input bind:value={playerForm.nickname} /></label>
          <label>Position<input bind:value={playerForm.position} /></label>
          <label>Number<input bind:value={playerForm.number} type="number" /></label>
          <label>Nationality<input bind:value={playerForm.nationality} /></label>
          <label class="checkbox-label"><input bind:checked={playerForm.captain} type="checkbox" />Captain</label>
          <label class="checkbox-label"><input bind:checked={playerForm.alternateCaptain} type="checkbox" />Alternate captain</label>
          <label>Image URL<input bind:value={playerForm.imageUrl} /></label>
          <label>SportsGamer URL<input bind:value={playerForm.sportsGamerUrl} /></label>
          <label>Bio<textarea bind:value={playerForm.bio}></textarea></label>
          <button class="command" type="submit"><Save size={18} />Save player</button>
        </form>
        <form class="admin-form" on:submit|preventDefault={createAchievement}>
          <h2>Achievements</h2>
          <label>Title<input bind:value={achievementForm.title} /></label>
          <label>Body<textarea bind:value={achievementForm.body}></textarea></label>
          <label>Order<input bind:value={achievementForm.displayOrder} type="number" /></label>
          <button class="command" type="submit"><Save size={18} />Save achievement</button>
        </form>
        <section class="admin-form">
          <h2>SportsGamer</h2>
          <button class="command" on:click={syncSportsGamer}><RefreshCw size={18} />Sync stats</button>
        </section>
      </div>
      <section class="admin-lists">
        <h2>Current Content</h2>
        {#each news as item}
          <div class="manage-row"><span>{item.title}</span><button aria-label="Delete news" class="icon-button" on:click={() => removeNews(item.slug)}><Trash2 size={18} /></button></div>
        {/each}
        {#each roster as item}
          <div class="manage-row"><span>{item.name}</span><button aria-label="Deactivate player" class="icon-button" on:click={() => removePlayer(item.slug)}><Trash2 size={18} /></button></div>
        {/each}
        {#each achievements as item}
          <div class="manage-row"><span>{item.title}</span><button aria-label="Delete achievement" class="icon-button" on:click={() => removeAchievement(item.id)}><Trash2 size={18} /></button></div>
        {/each}
      </section>
    {/if}
  {:else}
    <section class="page-head">
      <h1>Page not found</h1>
      <button class="command" on:click={() => routeTo("/")}>Home</button>
    </section>
  {/if}
</main>

<footer>
  <strong>Unlucky Boys</strong>
  <span>Contact: team@unluckyboys.local</span>
  <a href="https://twitter.com/UnluckyBoysNHL" target="_blank" rel="noreferrer">X</a>
</footer>
