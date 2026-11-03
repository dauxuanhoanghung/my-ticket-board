# Architecture · Turborepo task graph

> Index: [04 · Architecture §3](../../04-architecture.md#3-monorepo-layout-turborepo--pnpm-workspaces)

```mermaid
flowchart LR
  subgraph PK["packages/*"]
    ord["ordering:build"]
    con["contracts:build"]
  end
  apigen["api:schema<br/>(emit schema.gql)"] --> webgen["web:codegen<br/>(typed documents)"]
  ord --> apibuild["api:build"]
  con --> apibuild
  ord --> webbuild["web:build"]
  con --> webbuild
  webgen --> webbuild
  apibuild --> apitest["api:test"]
  webbuild --> webtest["web:test"]
  apibuild --> lint["lint / typecheck (all)"]
  webbuild --> lint
  apitest --> e2e["e2e (compose)"]
  webtest --> e2e
```

## Notes

- `api:schema` boots the Nest GraphQL module in "schema only" mode and writes `apps/api/schema.gql` (committed). CI fails if the committed schema differs from the generated one.
- `web:codegen` reads that file, so the web build never needs a running API.
- `@tb/ui` has no build step. `apps/web` compiles it through `transpilePackages`, so it isn't a node in this graph.
