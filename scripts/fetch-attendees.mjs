import { mkdir, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ATTENDEES_URL = "https://marketingagenda.jp/okinawa/attendees/";
const OUT_PATH = "public/attendees.local.json";
const ARRAY_WEAVER_COLUMNS = [
  "session_speaker_flag",
  "hide_flag",
  "speaker_id",
  "category1",
  "category2",
  "name_full_en",
  "last_name_ja",
  "first_name_ja",
  "company_ja",
  "position_ja",
];

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "\n")
      .replace(/<style[\s\S]*?<\/style>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function extractLines(text) {
  const ignore = /^(marketing agenda|okinawa|参加者一覧|attendees|公式|schedule|copyright|privacy|menu|home|login|ログイン)$/i;
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length >= 3 && !ignore.test(line))
    )
  );
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function resolveScriptUrls(html) {
  return [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => new URL(match[1], ATTENDEES_URL).href)
    .filter((url) => url.includes("/ArrayWeaver/"));
}

function extractQuotedValue(source, variableName) {
  const match = source.match(new RegExp(`(?:const|var)\\s+${variableName}\\s*=\\s*['"]([^'"]+)['"]`));
  return match?.[1] || "";
}

function extractApiConfig(getArrayWeaverJs, attendeesJs) {
  const fileName = extractQuotedValue(attendeesJs, "file_name") || "MA26_attendeessheet.csv";
  const cacheClear = /const\s+cache_clear\s*=\s*true/.test(attendeesJs);
  const apiUrls = [...getArrayWeaverJs.matchAll(/https:\/\/[^'"]+execute-api[^'"]+/g)].map((match) => match[0]);
  const apiKeys = [...getArrayWeaverJs.matchAll(/['"]([A-Za-z0-9]{35,})['"]/g)].map((match) => match[1]);

  return {
    fileName,
    cacheClear,
    apiUrl: cacheClear ? apiUrls[0] : apiUrls[1],
    apiKey: cacheClear ? apiKeys[0] : apiKeys[1],
  };
}

async function fetchArrayWeaverRecords(html, auth) {
  const scriptUrls = resolveScriptUrls(html);
  const getArrayWeaverUrl = scriptUrls.find((url) => url.endsWith("/get_arrayweaver.js"));
  const attendeesJsUrl = scriptUrls.find((url) => url.endsWith("/attendees.js"));
  if (!getArrayWeaverUrl || !attendeesJsUrl) return null;

  const [getArrayWeaverJs, attendeesJs] = await Promise.all(
    [getArrayWeaverUrl, attendeesJsUrl].map(async (url) => {
      const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
      if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
      return response.text();
    })
  );

  const config = extractApiConfig(getArrayWeaverJs, attendeesJs);
  if (!config.apiUrl || !config.apiKey) return null;

  const response = await fetch(config.apiUrl, {
    method: "POST",
    headers: {
      "x-api-key": config.apiKey,
      "Content-Type": "application/json;charset=utf-8",
    },
    body: JSON.stringify({
      file_name: config.fileName,
      column_name: ARRAY_WEAVER_COLUMNS,
      cache_clear: config.cacheClear,
    }),
  });
  if (!response.ok) throw new Error(`Failed to fetch ArrayWeaver API: ${response.status}`);

  const data = await response.json();
  if (data.statusCode !== 200 || !Array.isArray(data.data)) {
    throw new Error("ArrayWeaver API returned an unexpected payload.");
  }

  return data.data
    .filter((row) => row.first_name_ja && !row.hide_flag)
    .sort((a, b) => String(a.name_full_en || "").localeCompare(String(b.name_full_en || "")))
    .map((row, index) => ({
      id: compact(row.speaker_id) || `attendee-${index}`,
      category1: compact(row.category1),
      category2: compact(row.category2),
      name: compact(`${row.last_name_ja || ""} ${row.first_name_ja || ""}`),
      company: compact(row.company_ja),
      role: compact(row.position_ja),
      nameFullEn: compact(row.name_full_en),
      sessionSpeaker: compact(row.session_speaker_flag),
    }));
}

async function askMissingCredentials() {
  const rl = createInterface({ input, output });
  const username = process.env.MA26_BASIC_USER || (await rl.question("Basic username: "));
  const password = process.env.MA26_BASIC_PASS || (await rl.question("Basic password: "));
  rl.close();
  return { username, password };
}

async function main() {
  const { username, password } = await askMissingCredentials();
  if (!username || !password) {
    throw new Error("Basic auth username/password is required.");
  }

  const auth = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  const response = await fetch(ATTENDEES_URL, {
    headers: {
      Authorization: `Basic ${auth}`,
      "User-Agent": "MA26-Okinawa-local-fetch/1.0",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch attendees: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const records = await fetchArrayWeaverRecords(html, auth);
  const lines = records
    ? records.map((record) =>
        [record.name, record.company, record.role, [record.category1, record.category2].filter(Boolean).join(" / ")]
          .filter(Boolean)
          .join(" / ")
      )
    : extractLines(htmlToText(html));
  const payload = {
    sourceUrl: ATTENDEES_URL,
    fetchedAt: new Date().toISOString(),
    lineCount: lines.length,
    records: records || [],
    rawText: lines.join("\n"),
  };

  await mkdir("public", { recursive: true });
  await mkdir("local-data", { recursive: true });
  await writeFile(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile("local-data/attendees.raw.txt", `${payload.rawText}\n`, "utf8");
  console.log(`Saved ${lines.length} lines to ${OUT_PATH}`);
  console.log("Credentials were used for this request only and were not written to disk.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
