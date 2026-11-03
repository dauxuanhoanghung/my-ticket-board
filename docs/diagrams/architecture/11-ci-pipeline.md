# Architecture · CI/CD pipeline

> Index: [10 · Infrastructure §9](../../10-infrastructure.md#9-cicd)

```mermaid
flowchart LR
  pr["Push / pull request"] --> install["pnpm install<br/>(store cached)"]
  install --> lint["lint + typecheck<br/>turbo --affected"]
  install --> unit["Jest unit tests<br/>domain + application"]
  install --> schema["schema drift check<br/>api:schema vs committed"]
  lint --> integ["Jest integration tests<br/>Testcontainers: Postgres 18,<br/>RabbitMQ 4, Valkey"]
  unit --> integ
  schema --> build["build images<br/>turbo prune, multi-stage"]
  integ --> build
  build --> e2e["e2e Playwright<br/>against the compose stack"]
  e2e --> main{"main branch?"}
  main -- no --> done(["report status"])
  main -- yes --> push["push images<br/>tag = git sha"]
  push --> stg["deploy staging (later)<br/>migrations run first"]
  stg --> smoke["smoke tests"]
  smoke --> prod["manual promote to production (later)"]
```

| Gate | Fails the build when |
|---|---|
| lint | import-boundary violations (domain importing infrastructure, cross-context imports) |
| schema drift | `schema.gql` changed without being committed, or a breaking change without the `breaking-api` label |
| integration | a migration fails on a fresh DB, or an outbox/consumer contract test fails |
| e2e | the critical journeys fail: sign-up → board → move ticket seen by a second browser |
