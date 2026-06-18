# Unlucky Boys

Full-stack web application for the Unlucky Boys NHL esports team.

## Stack

- Client: Astro, TypeScript
- Server: Node.js, Hono, Postgres, Redis, bcrypt sessions, Zod validation
- Data: SQL migrations with Flyway
- Local platform: Docker Compose, Traefik, Postgres 17, Redis
- Deployment: Kubernetes starter manifests and Cloud Run notes

## Local Setup

1. Create local env:

```sh
cp project.env.example project.env
```

2. Change `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `project.env`.

3. Start the stack:

```sh
docker compose up --build
```

4. Open the app:

```text
http://localhost:8000
```

Traefik dashboard is available at `http://localhost:8080`.

## Pages

- `/` shows the Burgernation intro, latest news, upcoming games, and a link to the X feed.
- `/news` lists public news with load-more pagination.
- `/news/:slug` shows a full news article with its image.
- `/roster` shows active player cards.
- `/players/:slug` shows player metadata and SportsGamer stat snapshots.
- `/achievements-records` shows editable achievement paragraphs and all-time leaders.
- `/admin` protects content and roster editing behind an admin account.

## Branding

Brand images live in `client/public/brand`.

- `logo.png` is used in the navigation and home page.
- `banner.png` is used as the faded site background and default news image.

News articles require an image path or URL. The admin form defaults to `/brand/banner.png`.

## SportsGamer Sync

Add a `sportsgamer_url` to a player in admin, then use the SportsGamer sync button. The scraper is isolated in `server/src/integrations/sportsgamer.ts` so it can be replaced with an official API adapter later.

## Useful Commands

```sh
docker compose run --rm database-migrations
docker compose logs -f server
docker compose logs -f client
```

## Validation

The app has been verified in Docker with:

```sh
docker compose up --build -d
docker compose exec -T client npm run check
docker compose exec -T server npm run lint
```
