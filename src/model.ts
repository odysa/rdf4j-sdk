// ============================================
// RDF Term Types
// ============================================

/** RDF Named Node (IRI) */
export class IRI {
	readonly termType = "NamedNode" as const;

	constructor(public readonly value: string) {}

	toString(): string {
		return `<${this.value}>`;
	}

	equals(other: unknown): boolean {
		return other instanceof IRI && this.value === other.value;
	}
}

/** RDF Blank Node */
export class BlankNode {
	readonly termType = "BlankNode" as const;

	constructor(public readonly value: string) {}

	toString(): string {
		return `_:${this.value}`;
	}

	equals(other: unknown): boolean {
		return other instanceof BlankNode && this.value === other.value;
	}
}

/** RDF Literal value */
export class Literal {
	readonly termType = "Literal" as const;

	constructor(
		public readonly value: string,
		public readonly datatype?: IRI,
		public readonly language?: string,
	) {}

	toString(): string {
		const escaped = this.value.replace(/[\\"\n\r\t]/g, (c) => {
			switch (c) {
				case "\\":
					return "\\\\";
				case '"':
					return '\\"';
				case "\n":
					return "\\n";
				case "\r":
					return "\\r";
				case "\t":
					return "\\t";
				default:
					return c;
			}
		});
		if (this.language) return `"${escaped}"@${this.language}`;
		if (this.datatype) return `"${escaped}"^^${this.datatype}`;
		return `"${escaped}"`;
	}

	equals(other: unknown): boolean {
		return (
			other instanceof Literal &&
			this.value === other.value &&
			this.datatype?.value === other.datatype?.value &&
			this.language === other.language
		);
	}
}

/** SPARQL Variable */
export class Variable {
	readonly termType = "Variable" as const;

	constructor(public readonly name: string) {}

	toString(): string {
		return `?${this.name}`;
	}

	equals(other: unknown): boolean {
		return other instanceof Variable && this.name === other.name;
	}
}

/** Default Graph identifier */
export class DefaultGraph {
	readonly termType = "DefaultGraph" as const;

	toString(): string {
		return "";
	}

	equals(other: unknown): boolean {
		return other instanceof DefaultGraph;
	}
}

// ============================================
// Composite Types
// ============================================

export type Subject = IRI | BlankNode;
export type Predicate = IRI;
export type RDFObject = IRI | BlankNode | Literal;
export type GraphTerm = IRI | BlankNode | DefaultGraph;
export type Term = IRI | BlankNode | Literal | Variable | string;

// ============================================
// RDF Triple and Quad
// ============================================

/** RDF Triple (subject, predicate, object) */
export class Triple {
	constructor(
		public readonly subject: Subject,
		public readonly predicate: Predicate,
		public readonly object: RDFObject,
	) {}

	toString(): string {
		return `${this.subject} ${this.predicate} ${this.object} .`;
	}

	equals(other: unknown): boolean {
		return (
			other instanceof Triple &&
			this.subject.equals(other.subject) &&
			this.predicate.equals(other.predicate) &&
			this.object.equals(other.object)
		);
	}
}

/** RDF Quad (subject, predicate, object, graph) */
export class Quad {
	constructor(
		public readonly subject: Subject,
		public readonly predicate: Predicate,
		public readonly object: RDFObject,
		public readonly graph?: GraphTerm,
	) {}

	toString(): string {
		const graphStr =
			this.graph && !(this.graph instanceof DefaultGraph)
				? ` ${this.graph}`
				: "";
		return `${this.subject} ${this.predicate} ${this.object}${graphStr} .`;
	}

	equals(other: unknown): boolean {
		if (!(other instanceof Quad)) return false;
		const g1 = this.graph ?? new DefaultGraph();
		const g2 = other.graph ?? new DefaultGraph();
		return (
			this.subject.equals(other.subject) &&
			this.predicate.equals(other.predicate) &&
			this.object.equals(other.object) &&
			g1.equals(g2)
		);
	}
}

// ============================================
// Namespace
// ============================================

/** RDF Namespace for generating IRIs from a base URI */
export class Namespace {
	constructor(
		public readonly prefix: string,
		public readonly value: string,
	) {}

	/** Create an IRI by appending a local name */
	term(name: string): IRI {
		return new IRI(`${this.value}${name}`);
	}

	toString(): string {
		return this.value;
	}
}

// ============================================
// Standard Vocabularies
// ============================================

export const RDF = new Namespace(
	"rdf",
	"http://www.w3.org/1999/02/22-rdf-syntax-ns#",
);
export const RDFS = new Namespace(
	"rdfs",
	"http://www.w3.org/2000/01/rdf-schema#",
);
export const OWL = new Namespace("owl", "http://www.w3.org/2002/07/owl#");
export const XSD = new Namespace("xsd", "http://www.w3.org/2001/XMLSchema#");
export const FOAF = new Namespace("foaf", "http://xmlns.com/foaf/0.1/");
export const SKOS = new Namespace(
	"skos",
	"http://www.w3.org/2004/02/skos/core#",
);
export const DC = new Namespace("dc", "http://purl.org/dc/elements/1.1/");
export const DCTERMS = new Namespace("dcterms", "http://purl.org/dc/terms/");
export const SCHEMA = new Namespace("schema", "https://schema.org/");

// ============================================
// Repository Configuration
// ============================================

/** Interface for SAIL implementations */
export interface SailConfig {
	toTurtle(indent?: number): string;
}

/** Interface for repository implementation configs */
export interface RepositoryImplConfig {
	toTurtle(indent?: number): string;
}

/** In-memory store SAIL configuration */
export class MemoryStoreConfig implements SailConfig {
	constructor(
		public readonly persist: boolean = false,
		public readonly syncDelay: number = 0,
	) {}

	toTurtle(indent = 6): string {
		const pad = " ".repeat(indent);
		return [
			`${pad}sail:sailType "openrdf:MemoryStore" ;`,
			`${pad}ms:persist ${this.persist} ;`,
			`${pad}ms:syncDelay ${this.syncDelay}`,
		].join("\n");
	}
}

/** Native (disk-based) store SAIL configuration */
export class NativeStoreConfig implements SailConfig {
	constructor(public readonly tripleIndexes: string = "spoc,posc,cosp") {}

	toTurtle(indent = 6): string {
		const pad = " ".repeat(indent);
		return [
			`${pad}sail:sailType "openrdf:NativeStore" ;`,
			`${pad}ns:tripleIndexes "${this.tripleIndexes}"`,
		].join("\n");
	}
}

/** Elasticsearch store SAIL configuration */
export class ElasticsearchStoreConfig implements SailConfig {
	constructor(
		public readonly hostname: string = "localhost",
		public readonly port: number = 9200,
		public readonly clusterName: string = "elasticsearch",
		public readonly index: string = "rdf4j",
	) {}

	toTurtle(indent = 6): string {
		const pad = " ".repeat(indent);
		return [
			`${pad}sail:sailType "openrdf:ElasticsearchStore" ;`,
			`${pad}ess:hostname "${this.hostname}" ;`,
			`${pad}ess:port ${this.port} ;`,
			`${pad}ess:clusterName "${this.clusterName}" ;`,
			`${pad}ess:index "${this.index}"`,
		].join("\n");
	}
}

/** Base class for SAIL configs that wrap a delegate */
class DelegatingSailConfig implements SailConfig {
	constructor(
		private readonly sailType: string,
		public readonly delegate: SailConfig,
	) {}

	toTurtle(indent = 6): string {
		const pad = " ".repeat(indent);
		return [
			`${pad}sail:sailType "${this.sailType}" ;`,
			`${pad}sail:delegate [`,
			this.delegate.toTurtle(indent + 3),
			`${pad}]`,
		].join("\n");
	}
}

/** Schema-caching RDFS inferencer wrapping a delegate SAIL */
export class SchemaCachingRDFSInferencerConfig extends DelegatingSailConfig {
	constructor(delegate: SailConfig) {
		super("openrdf:SchemaCachingRDFSInferencer", delegate);
	}
}

/** Direct type hierarchy inferencer wrapping a delegate SAIL */
export class DirectTypeHierarchyInferencerConfig extends DelegatingSailConfig {
	constructor(delegate: SailConfig) {
		super("openrdf:DirectTypeHierarchyInferencer", delegate);
	}
}

/** SHACL validation SAIL wrapping a delegate SAIL */
export class SHACLSailConfig extends DelegatingSailConfig {
	constructor(delegate: SailConfig) {
		super("openrdf:SHACLSail", delegate);
	}
}

/** SAIL-backed repository configuration */
export class SailRepositoryImplConfig implements RepositoryImplConfig {
	constructor(public readonly sailConfig: SailConfig) {}

	toTurtle(indent = 3): string {
		const pad = " ".repeat(indent);
		return [
			`${pad}rep:repositoryType "openrdf:SailRepository" ;`,
			`${pad}sr:sailImpl [`,
			this.sailConfig.toTurtle(indent + 3),
			`${pad}]`,
		].join("\n");
	}
}

/** Remote SPARQL endpoint repository configuration */
export class SPARQLRepositoryImplConfig implements RepositoryImplConfig {
	constructor(
		public readonly queryEndpoint: string,
		public readonly updateEndpoint?: string,
	) {}

	toTurtle(indent = 3): string {
		const pad = " ".repeat(indent);
		const lines = [
			`${pad}rep:repositoryType "openrdf:SPARQLRepository" ;`,
			`${pad}sparql:query-endpoint "${this.queryEndpoint}"${this.updateEndpoint ? " ;" : ""}`,
		];
		if (this.updateEndpoint) {
			lines.push(`${pad}sparql:update-endpoint "${this.updateEndpoint}"`);
		}
		return lines.join("\n");
	}
}

/** Remote HTTP repository configuration */
export class HTTPRepositoryImplConfig implements RepositoryImplConfig {
	constructor(public readonly url: string) {}

	toTurtle(indent = 3): string {
		const pad = " ".repeat(indent);
		return [
			`${pad}rep:repositoryType "openrdf:HTTPRepository" ;`,
			`${pad}hr:repositoryURL "${this.url}"`,
		].join("\n");
	}
}

const CONFIG_PREFIXES = `@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix rep: <http://www.openrdf.org/config/repository#> .
@prefix sr: <http://www.openrdf.org/config/repository/sail#> .
@prefix sail: <http://www.openrdf.org/config/sail#> .
@prefix ms: <http://www.openrdf.org/config/sail/memory#> .
@prefix ns: <http://www.openrdf.org/config/sail/native#> .
@prefix ess: <http://www.openrdf.org/config/sail/elasticsearch#> .
@prefix sparql: <http://www.openrdf.org/config/repository/sparql#> .
@prefix hr: <http://www.openrdf.org/config/repository/http#> .`;

/** Typed repository configuration that generates Turtle */
export class RepositoryImplConfigBuilder {
	constructor(
		public readonly repoId: string,
		public readonly title: string = repoId,
		public readonly impl?: RepositoryImplConfig,
	) {}

	/** Generate Turtle configuration string */
	toTurtle(): string {
		const implTurtle = this.impl
			? this.impl.toTurtle(6)
			: new SailRepositoryImplConfig(new MemoryStoreConfig()).toTurtle(6);

		return `${CONFIG_PREFIXES}

[] a rep:Repository ;
   rep:repositoryID "${this.repoId}" ;
   rdfs:label "${this.title}" ;
   rep:repositoryImpl [
${implTurtle}
   ] .
`;
	}
}
