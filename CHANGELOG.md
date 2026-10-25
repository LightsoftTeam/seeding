# Changelog

## 0.1.1

- Fix TypeScript type resolution for the `/cosmos`, `/peru`, and `/testing` subpaths in CommonJS projects using legacy `moduleResolution: "node"` (`node10`).
- Add consumer type checks for legacy Node and NodeNext resolution to CI and release validation.
- Support Faker 9 and 10 as peer dependencies, including Faker 9's CommonJS build.
- Document CommonJS type resolution and Faker installation options.

## 0.1.0

- Initial release of database-agnostic seeders and factories with seeded Faker support and deterministic UUIDs.
- Add composable seeders, environment guards, factory states and relations, and in-memory persistence.
- Include an optional Cosmos DB adapter, Peru data generators, database testing helpers, and a scaffolding CLI.
- Publish ESM and CommonJS builds with TypeScript declarations.
