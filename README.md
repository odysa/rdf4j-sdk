# rdf4j-sdk

[![CI](https://github.com/odysa/rdf4j-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/odysa/rdf4j-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/rdf4j-sdk)](https://www.npmjs.com/package/rdf4j-sdk)

TypeScript SDK for the [RDF4J](https://rdf4j.org/) triplestore REST API.

## Install

```bash
npm install rdf4j-sdk
```

## Quick Start

```ts
import { RDF4JClient } from "rdf4j-sdk";

const client = new RDF4JClient({
  baseUrl: "http://localhost:8080/rdf4j-server",
});

// List repositories
const repos = await client.listRepositories();

// Query a repository
const repo = client.repository("my-repo");
const results = await repo.query("SELECT * WHERE { ?s ?p ?o } LIMIT 10");
```

## Features

- Full RDF4J REST API coverage
- SPARQL query and update operations
- Repository management (create, delete, list)
- Transaction support with auto-commit/rollback
- Graph Store Protocol (SPARQL 1.1 GSP)
- Named graph operations
- Namespace management
- RDF data model (IRI, Literal, BlankNode, Triple, Quad)
- Type-safe SPARQL query builder
- Typed repository configuration builders
- Standard vocabularies (RDF, RDFS, OWL, XSD, FOAF, SKOS, DC, SCHEMA)

## Usage

### Repository Operations

```ts
// Create a repository
await client.createRepository({ id: "my-repo", type: "memory" });

// Check if a repository exists
const exists = await client.repositoryExists("my-repo");

// Delete a repository
await client.deleteRepository("my-repo");
```

### SPARQL Queries

```ts
const repo = client.repository("my-repo");

// SELECT query
const results = await repo.query("SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10");

// ASK query
const exists = await repo.ask("ASK { <http://example.org/s> ?p ?o }");

// CONSTRUCT query
const turtle = await repo.construct(
  "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT 10"
);

// UPDATE query
await repo.update("INSERT DATA { <http://example.org/s> <http://example.org/p> \"hello\" }");
```

### Query Builder

```ts
import { select, ask, construct, describe, RDF, RDFS } from "rdf4j-sdk";

const query = select("s", "label")
  .prefix(RDF)
  .prefix(RDFS)
  .where("?s", "rdf:type", "?type")
  .where("?s", "rdfs:label", "?label")
  .filter('lang(?label) = "en"')
  .orderBy("?label")
  .limit(10)
  .build();

const results = await repo.query(query);
```

### RDF Data Model

```ts
import { IRI, Literal, Triple, Quad, iri, literal } from "rdf4j-sdk";

// Create terms
const subject = iri("http://example.org/alice");
const predicate = iri("http://xmlns.com/foaf/0.1/name");
const object = literal("Alice", undefined, "en");

// Create and add statements
const triple = new Triple(subject, predicate, object);
await repo.addStatements([triple]);
```

### Transactions

```ts
await repo.withTransaction(async (txn) => {
  await txn.update("INSERT DATA { <http://example.org/s> <http://example.org/p> \"value\" }");
  await txn.query("SELECT * WHERE { ?s ?p ?o }");
  // Auto-commits on success, rolls back on error
});
```

### Typed Repository Configuration

```ts
import {
  RepositoryImplConfigBuilder,
  SailRepositoryImplConfig,
  MemoryStoreConfig,
  SchemaCachingRDFSInferencerConfig,
} from "rdf4j-sdk";

const config = new RepositoryImplConfigBuilder(
  "my-repo",
  "My Repository",
  new SailRepositoryImplConfig(
    new SchemaCachingRDFSInferencerConfig(
      new MemoryStoreConfig(true, 1000)
    )
  )
);

await client.createRepository(config);
```

### File Upload

```ts
await repo.uploadFile("./data.ttl");
await repo.uploadFile("./data.rdf", { context: "<http://example.org/graph>" });
```

## License

MIT
