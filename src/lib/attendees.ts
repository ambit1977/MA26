export type Attendee = {
  id: string;
  raw: string;
  name: string;
  company: string;
  role: string;
  category1: string;
  category2: string;
  categories: string[];
};

export const defaultAttendeeText = `# 参加者リストをここに貼り付け
# 形式例：
# 山田 太郎 / 株式会社サンプル / マーケティング部
# 田中 花子 / Example Inc. / Brand Manager
# Akiyama Taishi / EZMAG / Brand`;

const companyHints = /(株式会社|有限会社|合同会社|Inc\.?|LLC|Ltd\.?|Company|Co\.?|Corp\.?|Corporation|Agency|Group|大学|協会|新聞|テレビ|放送|銀行|ホテル|沖縄)/i;

function splitLine(line: string) {
  const cleaned = line.replace(/\s+/g, " ").trim();
  const byDelimiter = cleaned.split(/\s*(?:\/|／|｜|\||,|，|\t)\s*/).filter(Boolean);
  if (byDelimiter.length > 1) return byDelimiter;
  return cleaned.split(/\s{2,}|　{1,}/).filter(Boolean);
}

const knownCategories = new Set(["Brand", "Partner", "Creator"]);

function clean(value: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitCategories(value: string) {
  return value
    .split(/\s*\/\s*/)
    .map((category) => category.trim())
    .filter((category) => knownCategories.has(category));
}

export function parseAttendees(text: string): Attendee[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line, index) => {
      const parts = splitLine(line);
      let name = parts[0] || line;
      let company = parts[1] || "";
      const categoryParts = parts.filter((part) => knownCategories.has(part));
      let role = parts.slice(2).filter((part) => !knownCategories.has(part)).join(" / ");
      const categories = categoryParts.length ? categoryParts : splitCategories(parts[parts.length - 1] || "");

      if (parts.length >= 2 && companyHints.test(parts[0]) && !companyHints.test(parts[1])) {
        company = parts[0];
        name = parts[1];
        role = parts.slice(2).filter((part) => !knownCategories.has(part)).join(" / ");
      }

      if (parts.length === 1) {
        const tokens = line.split(/\s+/).filter(Boolean);
        if (tokens.length >= 4) {
          name = `${tokens[0]} ${tokens[1]}`;
          company = tokens.slice(2, -1).join(" ");
          role = tokens[tokens.length - 1] || "";
        }
      }

      return {
        id: `${index}-${line}`,
        raw: line,
        name: clean(name),
        company: clean(company),
        role: clean(role),
        category1: categories[0] || "",
        category2: categories[1] || "",
        categories,
      };
    });
}

export function attendeesFromRecords(records: Array<Record<string, unknown>>, rawText = ""): Attendee[] {
  return records.map((record, index) => {
    const category1 = clean(record.category1);
    const category2 = clean(record.category2);
    const categories = [category1, category2].filter((category) => knownCategories.has(category));
    const name = clean(record.name) || clean(`${record.last_name_ja || ""} ${record.first_name_ja || ""}`);
    const company = clean(record.company) || clean(record.company_ja);
    const role = clean(record.role) || clean(record.position_ja);
    const raw = [name, company, role, categories.join(" / ")].filter(Boolean).join(" / ");

    return {
      id: clean(record.id) || clean(record.speaker_id) || `${index}-${raw}`,
      raw: raw || rawText.split(/\r?\n/)[index] || "",
      name,
      company,
      role,
      category1,
      category2,
      categories,
    };
  });
}

export function filterAttendees(attendees: Attendee[], query: string, category: string, companyQuery: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  const normalizedCompanyQuery = companyQuery.trim().toLocaleLowerCase("ja-JP");
  return attendees.filter((attendee) => {
    const matchesCategory = category === "all" || attendee.categories.includes(category);
    const matchesCompany = !normalizedCompanyQuery || attendee.company.toLocaleLowerCase("ja-JP").includes(normalizedCompanyQuery);
    const haystack = `${attendee.name} ${attendee.company} ${attendee.role} ${attendee.categories.join(" ")} ${attendee.raw}`.toLocaleLowerCase("ja-JP");
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesCategory && matchesCompany && matchesQuery;
  });
}
