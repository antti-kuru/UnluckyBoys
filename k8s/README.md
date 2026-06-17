# Kubernetes Notes

These manifests are starting points for a container platform. Replace image names, host names, and secrets before deploying.

For Google Cloud Run, prefer deploying `server` and a production-built static client separately, then use Cloud SQL for Postgres and Memorystore or Upstash-compatible Redis for cache/session storage. Keep the same environment variables from `project.env.example`.
