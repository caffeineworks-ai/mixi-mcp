import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface Env {
  MCP_OBJECT: DurableObjectNamespace;
  MIXI_KV: KVNamespace;
}

// 나중에 학생들이 키워드 추가 가능하도록 배열로 관리
const MIXI_KEYWORDS = [
  "내추럴 무드",
  "모던 미니멀",
  "미드센추리",
];

export class MixiMCP extends McpAgent {
  server = new McpServer({ name: "mixi-mcp", version: "1.0.0" });

  async init() {

    // 툴 1: 인터뷰 시작 — 인터뷰 지침 + 키워드 목록을 Claude에게 반환
    this.server.tool(
      "start_mixi_interview",
      "MIXI 인터뷰를 시작합니다. 이 툴을 호출하면 인터뷰 진행 지침과 선택 가능한 키워드 목록을 반환합니다. Claude는 반환된 지침에 따라 사용자와 대화를 진행해야 합니다.",
      {},
      async () => {
        const keywords = MIXI_KEYWORDS.map((k, i) => `${i + 1}. ${k}`).join("\n");
        const instruction = `
[MIXI 인터뷰 진행 지침]

당신은 MIXI의 공간 취향 인터뷰어입니다. 아래 순서대로 사용자에게 질문하고, 각 질문마다 선택지를 버튼 형태로 제시하세요. 모든 답변을 받은 후 save_mixi_result 툴을 호출하여 결과를 저장하세요.

--- 질문 순서 ---

1. 나이대를 선택해 주세요.
   선택지: 10대 / 20대 / 30대 / 40대 / 50대 이상

2. 성별을 선택해 주세요.
   선택지: 남성 / 여성 / 선택 안 함

3. MBTI를 선택해 주세요.
   선택지: INTJ / INTP / ENTJ / ENTP / INFJ / INFP / ENFJ / ENFP / ISTJ / ISFJ / ESTJ / ESFJ / ISTP / ISFP / ESTP / ESFP / 모름

4. 아래 MIXI 키워드 중 나의 공간과 어울리는 것을 2개 선택해 주세요.
${keywords}

5. 현재 집에서 사용 중인 인테리어/가구 브랜드를 3개 알려주세요. (주관식)
   예: 무인양품, 이케아, HAY

--- 저장 ---
모든 답변을 받은 후 아래 순서로 진행하세요.
1. 사용자가 입력한 브랜드 3개의 공식 웹사이트 URL을 웹검색으로 확인하세요.
2. 확인한 URL과 함께 save_mixi_result 툴을 호출하여 결과를 저장하세요.
3. 저장 후 사용자에게 "결과가 MIXI 갤러리에 등록되었습니다!" 라고 안내하세요.
        `.trim();

        return {
          content: [{ type: "text", text: instruction }],
        };
      }
    );

    // 툴 2: 결과 저장 — KV에 누적 저장
    this.server.tool(
      "save_mixi_result",
      "인터뷰 결과를 저장합니다. 브랜드 3개의 이름과 공식 URL을 웹검색으로 찾은 후 호출하세요.",
      {
        age: z.string().describe("나이대 (예: 20대)"),
        gender: z.string().describe("성별 (예: 여성)"),
        mbti: z.string().describe("MBTI (예: INFP)"),
        keywords: z.array(z.string()).length(2).describe("선택한 MIXI 키워드 2개"),
        brands: z.array(z.string()).length(3).describe("보유 인테리어/가구 브랜드 3개 이름"),
        brand_urls: z.array(z.string()).length(3).describe("브랜드 3개의 공식 웹사이트 URL (웹검색으로 확인한 것)"),
      },
      async ({ age, gender, mbti, keywords, brands, brand_urls }, context) => {
        try {
          const env = (this as any).env as Env;

          // 기존 결과 목록 불러오기
          const existing = await env.MIXI_KV.get("results");
          const results = existing ? JSON.parse(existing) : [];

          // 새 결과 추가
          const newEntry = {
            id: Date.now(),
            age,
            gender,
            mbti,
            keywords,
            brands,
            brand_urls,
            createdAt: new Date().toISOString(),
          };
          results.push(newEntry);

          // 저장
          await env.MIXI_KV.put("results", JSON.stringify(results));

          return {
            content: [{
              type: "text",
              text: `저장 완료! ${keywords[0]} + ${keywords[1]} 조합이 갤러리에 등록되었습니다.`,
            }],
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: `저장 실패: ${e}` }],
          };
        }
      }
    );
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // MCP 엔드포인트
    if (url.pathname === "/mcp") {
      return MixiMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // 갤러리 페이지용 결과 조회 엔드포인트
    if (url.pathname === "/results") {
      return env.MIXI_KV.get("results").then(val =>
        new Response(val ?? "[]", {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        })
      );
    }

    // 갤러리 HTML 페이지
    if (url.pathname === "/" || url.pathname === "/gallery") {
      return new Response(getGalleryHTML(), {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

function getGalleryHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MIXI — 공간 취향 갤러리</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f0f0f;
      color: #f0f0f0;
      font-family: 'Helvetica Neue', sans-serif;
      min-height: 100vh;
    }

    header {
      padding: 48px 40px 32px;
      border-bottom: 1px solid #222;
    }

    header h1 {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 0.1em;
    }

    header p {
      margin-top: 8px;
      font-size: 14px;
      color: #666;
    }

    #gallery {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .entry {
      display: flex;
      align-items: flex-start;
      gap: 32px;
      padding: 40px;
      border-bottom: 1px solid #1a1a1a;
      animation: fadeIn 0.6s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* 인물 실루엣 */
    .silhouette {
      flex-shrink: 0;
      width: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .silhouette svg {
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }

    .silhouette .meta {
      font-size: 11px;
      color: #444;
      text-align: center;
      line-height: 1.4;
    }

    /* 말풍선 + 콘텐츠 */
    .content {
      flex: 1;
    }

    .bubble {
      display: inline-block;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px 16px 16px 4px;
      padding: 16px 20px;
      margin-bottom: 16px;
    }

    .keywords {
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0.05em;
      color: #f0f0f0;
    }

    .keywords span {
      color: #888;
      margin: 0 8px;
    }

    .mbti-badge {
      display: inline-block;
      margin-top: 8px;
      font-size: 11px;
      color: #555;
      letter-spacing: 0.1em;
    }

    /* 브랜드 링크 */
    .brands {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .brand-link {
      display: inline-block;
      padding: 6px 14px;
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 20px;
      font-size: 13px;
      color: #aaa;
      text-decoration: none;
      transition: border-color 0.2s, color 0.2s;
    }

    .brand-link:hover {
      border-color: #555;
      color: #f0f0f0;
    }

    /* 빈 상태 */
    #empty {
      padding: 80px 40px;
      color: #333;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <header>
    <h1>MIXI</h1>
    <p>공간 취향 갤러리 — 사람들이 선택한 조합</p>
  </header>

  <div id="gallery">
    <div id="empty">아직 등록된 결과가 없습니다.</div>
  </div>

  <script>
    const WORKER_URL = "https://mixi-mcp.typica-918.workers.dev";  // 배포 후 Worker URL 입력 (예: https://mixi-mcp.typica-918.workers.dev)
    let lastCount = 0;

    function getBrandSearchUrl(brand) {
      return "https://www.google.com/search?q=" + encodeURIComponent(brand + " 인테리어 브랜드");
    }

    function silhouetteSVG() {
      return \`<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="14" r="8" fill="#f0f0f0"/>
        <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" fill="#f0f0f0"/>
      </svg>\`;
    }

    function renderEntry(entry) {
      const div = document.createElement("div");
      div.className = "entry";
      div.innerHTML = \`
        <div class="silhouette">
          \${silhouetteSVG()}
          <div class="meta">\${entry.age}<br>\${entry.gender}</div>
        </div>
        <div class="content">
          <div class="bubble">
            <div class="keywords">
              \${entry.keywords[0]}<span>+</span>\${entry.keywords[1]}
            </div>
            <div class="mbti-badge">\${entry.mbti}</div>
          </div>
          <div class="brands">
            \${entry.brands.map((b, i) => \`
              <a class="brand-link" href="\${entry.brand_urls?.[i] || '#'}" target="_blank" rel="noopener">\${b}</a>
            \`).join("")}
          </div>
        </div>
      \`;
      return div;
    }

    async function pollResults() {
      try {
        const url = WORKER_URL ? WORKER_URL + "/results" : "/results";
        const res = await fetch(url);
        if (!res.ok) return;
        const results = await res.json();

        if (results.length === lastCount) return;

        const gallery = document.getElementById("gallery");
        const empty = document.getElementById("empty");
        if (empty) empty.remove();

        // 새로 추가된 항목만 렌더링
        for (let i = lastCount; i < results.length; i++) {
          gallery.appendChild(renderEntry(results[i]));
        }
        lastCount = results.length;

      } catch(e) {}
    }

    pollResults();
    setInterval(pollResults, 3000);
  </script>
</body>
</html>`;
}
