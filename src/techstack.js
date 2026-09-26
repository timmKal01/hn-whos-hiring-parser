// Maintained tech keyword list: canonical name -> pattern, in output order.
// Names that are also ordinary words (Go, Swift, Spark, Spring, Phoenix, React) are matched
// case-sensitively and/or only in list context ("Go, Rust", "(Go)", "in Go"), so prose doesn't count.

const T = (name, pattern, flags = 'gi') => ({ name, re: new RegExp(pattern, flags) });
// Whole token: "Java" is not "JavaScript", "SQL" is not "MySQL".
const W = (s) => String.raw`(?<![\w.#+-])(?:${s})(?![\w#+]|\.[a-z])`;
const CS = 'g';

export const TECH = [
    // Languages
    T('Python', W('python')),
    T('JavaScript', W('javascript|js')),
    T('TypeScript', W('typescript')),
    T('Go', String.raw`\b[Gg]olang\b|(?<=(?:^|[(,/:+]|\band|\bor|\bin|\bwith|\buse|\busing|\buses|\bwrite|\bwritten in)\s?)Go(?=\s?[,/).+;]|\s+(?:and|or|&)\s|\s*$|\s+(?:backend|services|microservices|developer|engineer|code))`, CS),
    T('Rust', W('rust')),
    T('Java', W('java')),
    T('Kotlin', W('kotlin')),
    T('Swift', String.raw`\bSwift(?:UI)?\b`, CS),
    T('Scala', W('scala')),
    T('Ruby', W('ruby')),
    T('PHP', W('php')),
    T('C#', String.raw`(?<!\w)C#`, CS),
    T('C++', String.raw`(?<!\w)C\+\+`, CS),
    T('.NET', String.raw`(?<!\w)\.NET\b|\bdotnet\b`),
    T('Elixir', W('elixir')),
    T('Erlang', W('erlang')),
    T('Haskell', W('haskell')),
    T('Clojure', W('clojure(?:script)?')),
    T('OCaml', W('ocaml')),
    T('F#', String.raw`(?<!\w)F#`, CS),
    T('Julia', String.raw`\bJulia\b(?=\s?[,/)]|\s+(?:and|or)\s)`, CS),
    T('Dart', W('dart')),
    T('Lua', W('lua')),
    T('Zig', W('zig')),
    T('Solidity', W('solidity')),
    T('SQL', W('sql')),
    T('Bash', W('bash')),
    // Frameworks and libraries
    T('React', String.raw`\bReact(?:\.?js|JS)?\b|\breact\.?js\b`, CS),
    T('React Native', W(String.raw`react[\s-]native`)),
    T('Next.js', W(String.raw`next\.?js`)),
    T('Vue', W(String.raw`vue(?:\.?js)?`)),
    T('Angular', W('angular(?:js)?')),
    T('Svelte', W('svelte(?:kit)?')),
    T('Node.js', String.raw`\b[Nn]ode\.?[jJ][sS]\b|\bNode\b(?=\s?[,/)])`, CS),
    T('Django', W('django')),
    T('Flask', W('flask')),
    T('FastAPI', W('fastapi')),
    T('Rails', W('ruby on rails|rails|ror')),
    T('Laravel', W('laravel')),
    // "Spring 2027 internship" is a season: only Spring Boot, or Spring inside a list.
    T('Spring', String.raw`\bSpring\s?Boot\b|(?<=[(,/]\s?)Spring\b(?=\s?[,/)])`, CS),
    T('NestJS', W(String.raw`nest\.?js`)),
    T('Express', String.raw`\bExpress(?:\.js)?\b(?=\s?[,/)])`, CS),
    // Phoenix, AZ is a city: only the Elixir framework.
    T('Phoenix', String.raw`phoenix\s?liveview|elixir\s?[/,&+]\s?phoenix|phoenix\s?[/,&+]\s?elixir|phoenix framework`),
    T('Flutter', W('flutter')),
    T('Tailwind', W(String.raw`tailwind(?:\s?css)?`)),
    T('GraphQL', W('graphql')),
    T('gRPC', W('grpc')),
    T('Kafka', W('kafka')),
    T('Spark', String.raw`\b(?:Apache\s)?Spark\b|\bPySpark\b`, CS),
    T('Airflow', W('airflow')),
    T('dbt', W('dbt')),
    T('PyTorch', W('pytorch')),
    T('TensorFlow', W('tensorflow')),
    T('JAX', String.raw`\bJAX\b`, CS),
    T('CUDA', W('cuda')),
    T('LangChain', W('langchain')),
    T('Pandas', W('pandas')),
    // Databases
    T('PostgreSQL', W('postgres(?:ql)?|psql')),
    T('MySQL', W('mysql')),
    T('MongoDB', W('mongo(?:db)?')),
    T('Redis', W('redis')),
    T('Elasticsearch', W('elasticsearch|opensearch')),
    T('ClickHouse', W('clickhouse')),
    T('Snowflake', W('snowflake')),
    T('BigQuery', W('bigquery')),
    T('DynamoDB', W('dynamodb')),
    T('Cassandra', W('cassandra')),
    T('SQLite', W('sqlite')),
    T('Supabase', W('supabase')),
    T('Databricks', W('databricks')),
    // Cloud and infrastructure
    T('AWS', W('aws|amazon web services')),
    T('GCP', W('gcp|google cloud(?: platform)?')),
    T('Azure', W('azure')),
    T('Kubernetes', W('kubernetes|k8s')),
    T('Docker', W('docker')),
    T('Terraform', W('terraform')),
    T('Linux', W('linux')),
    T('Cloudflare', W('cloudflare')),
    T('Vercel', W('vercel')),
    // AI
    T('LLMs', W('llms?|large language models?')),
];

/** Canonical tech names mentioned in `text`, in list order. */
export function extractTechStack(text) {
    const s = String(text ?? '');
    const found = [];
    for (const t of TECH) {
        t.re.lastIndex = 0;
        if (t.re.test(s)) found.push(t.name);
    }
    // "React Native" also matches React; keep React only if it appears on its own too.
    if (found.includes('React Native') && found.includes('React') && !/\bReact\b(?![\s-]Native)/i.test(s)) found.splice(found.indexOf('React'), 1);
    return found;
}

/** Maps a user's filter term ("postgres", "golang", "k8s") to the canonical name when known. */
export function canonicalTech(term) {
    const s = String(term ?? '').trim();
    if (!s) return s;
    const exact = TECH.find((t) => t.name.toLowerCase() === s.toLowerCase());
    if (exact) return exact.name;
    return extractTechStack(`(${s})`)[0] ?? extractTechStack(s)[0] ?? s;
}
