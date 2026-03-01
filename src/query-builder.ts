import { serializeTerm } from "./helpers.js";
import type { Namespace, Term } from "./model.js";

// ============================================
// GraphPattern
// ============================================

function ensureVarPrefix(name: string): string {
	return name.startsWith("?") ? name : `?${name}`;
}

interface PatternClause {
	type:
		| "triple"
		| "filter"
		| "optional"
		| "union"
		| "bind"
		| "values"
		| "subquery";
	content: string;
}

/** Composable SPARQL graph pattern */
export class GraphPattern {
	private readonly clauses: PatternClause[];

	constructor(clauses?: PatternClause[]) {
		this.clauses = clauses ? [...clauses] : [];
	}

	/** Add a triple pattern */
	where(s: Term, p: Term, o: Term): GraphPattern {
		return this.addClause({
			type: "triple",
			content: `${serializeTerm(s)} ${serializeTerm(p)} ${serializeTerm(o)} .`,
		});
	}

	/** Add a FILTER expression */
	filter(expr: string): GraphPattern {
		return this.addClause({ type: "filter", content: `FILTER (${expr})` });
	}

	/** Add an OPTIONAL pattern */
	optional(sOrPattern: Term | GraphPattern, p?: Term, o?: Term): GraphPattern {
		if (sOrPattern instanceof GraphPattern) {
			return this.addClause({
				type: "optional",
				content: `OPTIONAL {\n${sOrPattern.toSparql(2)}\n}`,
			});
		}
		if (p === undefined || o === undefined) {
			throw new Error("optional() requires (s, p, o) or (GraphPattern)");
		}
		return this.addClause({
			type: "optional",
			content: `OPTIONAL { ${serializeTerm(sOrPattern)} ${serializeTerm(p)} ${serializeTerm(o)} . }`,
		});
	}

	/** Add a UNION of patterns */
	union(...patterns: GraphPattern[]): GraphPattern {
		const parts = patterns.map((p) => `{\n${p.toSparql(2)}\n}`);
		return this.addClause({
			type: "union",
			content: parts.join("\nUNION\n"),
		});
	}

	/** Add a BIND expression */
	bind(expr: string, varName: string): GraphPattern {
		return this.addClause({
			type: "bind",
			content: `BIND (${expr} AS ${ensureVarPrefix(varName)})`,
		});
	}

	/** Add VALUES clause */
	values(varName: string, vals: Term[]): GraphPattern {
		const v = ensureVarPrefix(varName);
		const serialized = vals.map((val) => serializeTerm(val)).join(" ");
		return this.addClause({
			type: "values",
			content: `VALUES ${v} { ${serialized} }`,
		});
	}

	/** Add a sub-query */
	subQuery(builder: SelectQuery): GraphPattern {
		return this.addClause({
			type: "subquery",
			content: `{\n${builder.build()}\n}`,
		});
	}

	/** Generate SPARQL for this pattern */
	toSparql(indent = 0): string {
		const pad = " ".repeat(indent);
		return this.clauses.map((c) => `${pad}${c.content}`).join("\n");
	}

	/** Clone this pattern */
	copy(): GraphPattern {
		return new GraphPattern(this.clauses);
	}

	/** Number of clauses */
	get length(): number {
		return this.clauses.length;
	}

	private addClause(clause: PatternClause): GraphPattern {
		const copy = new GraphPattern(this.clauses);
		copy.clauses.push(clause);
		return copy;
	}
}

// ============================================
// Base Query Builder
// ============================================

interface PrefixDecl {
	name: string;
	uri: string;
}

abstract class QueryBase<T extends QueryBase<T>> {
	protected prefixes: PrefixDecl[] = [];
	protected pattern: GraphPattern = new GraphPattern();

	/** Add a PREFIX declaration */
	prefix(nameOrNs: string | Namespace, uri?: string): T {
		if (typeof nameOrNs === "string") {
			if (uri === undefined) {
				throw new Error("prefix() with string name requires a URI");
			}
			this.prefixes.push({ name: nameOrNs, uri });
		} else {
			this.prefixes.push({
				name: nameOrNs.prefix,
				uri: nameOrNs.value,
			});
		}
		return this as unknown as T;
	}

	/** Add a triple pattern to WHERE clause */
	where(s: Term, p: Term, o: Term): T {
		this.pattern = this.pattern.where(s, p, o);
		return this as unknown as T;
	}

	/** Add a FILTER expression */
	filter(expr: string): T {
		this.pattern = this.pattern.filter(expr);
		return this as unknown as T;
	}

	/** Add an OPTIONAL pattern */
	optional(sOrPattern: Term | GraphPattern, p?: Term, o?: Term): T {
		this.pattern = this.pattern.optional(sOrPattern, p, o);
		return this as unknown as T;
	}

	/** Add a UNION of patterns */
	union(...patterns: GraphPattern[]): T {
		this.pattern = this.pattern.union(...patterns);
		return this as unknown as T;
	}

	/** Add a BIND expression */
	bind(expr: string, varName: string): T {
		this.pattern = this.pattern.bind(expr, varName);
		return this as unknown as T;
	}

	/** Add VALUES clause */
	values(varName: string, vals: Term[]): T {
		this.pattern = this.pattern.values(varName, vals);
		return this as unknown as T;
	}

	/** Add a sub-query */
	subQuery(builder: SelectQuery): T {
		this.pattern = this.pattern.subQuery(builder);
		return this as unknown as T;
	}

	/** Build the SPARQL query string */
	abstract build(): string;

	/** Clone this builder */
	abstract copy(): T;

	protected buildPrefixes(): string {
		if (this.prefixes.length === 0) return "";
		return `${this.prefixes.map((p) => `PREFIX ${p.name}: <${p.uri}>`).join("\n")}\n`;
	}

	protected buildWhereClause(): string {
		if (this.pattern.length === 0) return "";
		return `WHERE {\n${this.pattern.toSparql(2)}\n}`;
	}
}

// ============================================
// SELECT Query
// ============================================

/** SPARQL SELECT query builder */
export class SelectQuery extends QueryBase<SelectQuery> {
	private variables: string[];
	private isDistinct = false;
	private orderByExprs: string[] = [];
	private groupByExprs: string[] = [];
	private havingExpr?: string;
	private limitVal?: number;
	private offsetVal?: number;

	constructor(...variables: string[]) {
		super();
		this.variables = variables.map((v) => (v === "*" ? v : ensureVarPrefix(v)));
	}

	/** Make results distinct */
	distinct(): SelectQuery {
		this.isDistinct = true;
		return this;
	}

	/** Add ORDER BY expressions */
	orderBy(...exprs: string[]): SelectQuery {
		this.orderByExprs.push(...exprs);
		return this;
	}

	/** Add GROUP BY expressions */
	groupBy(...exprs: string[]): SelectQuery {
		this.groupByExprs.push(...exprs);
		return this;
	}

	/** Add HAVING expression */
	having(expr: string): SelectQuery {
		this.havingExpr = expr;
		return this;
	}

	/** Set result limit */
	limit(n: number): SelectQuery {
		this.limitVal = n;
		return this;
	}

	/** Set result offset */
	offset(n: number): SelectQuery {
		this.offsetVal = n;
		return this;
	}

	build(): string {
		const parts: string[] = [];

		parts.push(this.buildPrefixes());

		const distinctStr = this.isDistinct ? "DISTINCT " : "";
		const varsStr = this.variables.length > 0 ? this.variables.join(" ") : "*";
		parts.push(`SELECT ${distinctStr}${varsStr}`);

		parts.push(this.buildWhereClause());

		if (this.groupByExprs.length > 0) {
			parts.push(`GROUP BY ${this.groupByExprs.join(" ")}`);
		}

		if (this.havingExpr) {
			parts.push(`HAVING (${this.havingExpr})`);
		}

		if (this.orderByExprs.length > 0) {
			parts.push(`ORDER BY ${this.orderByExprs.join(" ")}`);
		}

		if (this.limitVal !== undefined) {
			parts.push(`LIMIT ${this.limitVal}`);
		}

		if (this.offsetVal !== undefined) {
			parts.push(`OFFSET ${this.offsetVal}`);
		}

		return parts.filter((p) => p.length > 0).join("\n");
	}

	copy(): SelectQuery {
		const q = new SelectQuery(...this.variables);
		q.prefixes = [...this.prefixes];
		q.pattern = this.pattern.copy();
		q.isDistinct = this.isDistinct;
		q.orderByExprs = [...this.orderByExprs];
		q.groupByExprs = [...this.groupByExprs];
		q.havingExpr = this.havingExpr;
		q.limitVal = this.limitVal;
		q.offsetVal = this.offsetVal;
		return q;
	}
}

// ============================================
// ASK Query
// ============================================

/** SPARQL ASK query builder */
export class AskQuery extends QueryBase<AskQuery> {
	build(): string {
		const parts: string[] = [];
		parts.push(this.buildPrefixes());
		parts.push("ASK");
		parts.push(this.buildWhereClause());
		return parts.filter((p) => p.length > 0).join("\n");
	}

	copy(): AskQuery {
		const q = new AskQuery();
		q.prefixes = [...this.prefixes];
		q.pattern = this.pattern.copy();
		return q;
	}
}

// ============================================
// CONSTRUCT Query
// ============================================

type TripleTemplate = [Term, Term, Term];

/** SPARQL CONSTRUCT query builder */
export class ConstructQuery extends QueryBase<ConstructQuery> {
	private templates: TripleTemplate[];

	constructor(...templates: TripleTemplate[]) {
		super();
		this.templates = templates;
	}

	build(): string {
		const parts: string[] = [];
		parts.push(this.buildPrefixes());

		if (this.templates.length > 0) {
			const templateStr = this.templates
				.map(
					([s, p, o]) =>
						`  ${serializeTerm(s)} ${serializeTerm(p)} ${serializeTerm(o)} .`,
				)
				.join("\n");
			parts.push(`CONSTRUCT {\n${templateStr}\n}`);
		} else {
			parts.push("CONSTRUCT");
		}

		parts.push(this.buildWhereClause());
		return parts.filter((p) => p.length > 0).join("\n");
	}

	copy(): ConstructQuery {
		const q = new ConstructQuery(...this.templates);
		q.prefixes = [...this.prefixes];
		q.pattern = this.pattern.copy();
		return q;
	}
}

// ============================================
// DESCRIBE Query
// ============================================

/** SPARQL DESCRIBE query builder */
export class DescribeQuery extends QueryBase<DescribeQuery> {
	private resources: Term[];

	constructor(...resources: Term[]) {
		super();
		this.resources = resources;
	}

	build(): string {
		const parts: string[] = [];
		parts.push(this.buildPrefixes());

		const resourcesStr = this.resources.map(serializeTerm).join(" ");
		parts.push(`DESCRIBE ${resourcesStr}`);

		if (this.pattern.length > 0) {
			parts.push(this.buildWhereClause());
		}

		return parts.filter((p) => p.length > 0).join("\n");
	}

	copy(): DescribeQuery {
		const q = new DescribeQuery(...this.resources);
		q.prefixes = [...this.prefixes];
		q.pattern = this.pattern.copy();
		return q;
	}
}

// ============================================
// Factory Functions
// ============================================

/** Create a SELECT query builder */
export function select(...variables: string[]): SelectQuery {
	return new SelectQuery(...variables);
}

/** Create an ASK query builder */
export function ask(): AskQuery {
	return new AskQuery();
}

/** Create a CONSTRUCT query builder */
export function construct(...templates: TripleTemplate[]): ConstructQuery {
	return new ConstructQuery(...templates);
}

/** Create a DESCRIBE query builder */
export function describe(...resources: Term[]): DescribeQuery {
	return new DescribeQuery(...resources);
}
