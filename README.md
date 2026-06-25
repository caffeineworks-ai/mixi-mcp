# MIXI MCP Server

MIXI 조명 브랜드의 공간 취향 인터뷰 MCP 서버입니다.
Claude.ai 커스텀 커넥터로 연결하면, 사용자가 Claude와 대화하며 자신의 공간 취향을 등록하고 다른 사람들의 취향을 갤러리에서 확인할 수 있습니다.

---

## 서비스 흐름

1. 사용자가 Claude.ai에서 MIXI 커넥터를 통해 대화 시작
2. `introduce_mixi` 툴 → MIXI 브랜드 소개 + 갤러리 안내 + 인터뷰 참여 유도
3. `start_mixi_interview` 툴 → 인터뷰 진행 (나이 / 성별 / MBTI / MIXI 키워드 2개 / 보유 브랜드 3개)
4. Claude가 브랜드 공식 URL을 웹검색으로 확인
5. `save_mixi_result` 툴 → 결과를 Cloudflare KV에 저장
6. 갤러리 페이지에서 실시간으로 결과 확인 (3초 폴링)

---

## MCP 툴 목록

| 툴 이름 | 설명 |
|---|---|
| `introduce_mixi` | MIXI 브랜드 소개 + 갤러리 URL 안내 + 인터뷰 참여 유도 |
| `start_mixi_interview` | 인터뷰 진행 지침과 MIXI 키워드 목록을 Claude에게 반환 |
| `save_mixi_result` | 인터뷰 결과를 KV에 저장 (브랜드 URL 포함) |

---

## 엔드포인트

| 경로 | 설명 |
|---|---|
| `/mcp` | Claude.ai 커스텀 커넥터 연결 URL |
| `/gallery` | 공간 취향 갤러리 페이지 |
| `/results` | 갤러리 폴링용 JSON API |

---

## MIXI 키워드 추가 방법

`src/index.ts` 상단의 배열에 항목을 추가하면 됩니다.

```typescript
const MIXI_KEYWORDS = [
  "내추럴 무드",
  "모던 미니멀",
  "미드센추리",
  "보헤미안",   // 추가 예시
];
```

---

## 배포 방법

### 1. KV 네임스페이스 생성

```bash
npx wrangler kv namespace create MIXI_KV
```

출력된 `id`를 `wrangler.toml`에 입력:

```toml
[[kv_namespaces]]
binding = "MIXI_KV"
id = "여기에_입력"
```

### 2. GitHub Secrets 등록

GitHub repo → Settings → Secrets → Actions에서 아래 두 값 등록:

| Secret 이름 | 값 확인 위치 |
|---|---|
| `CF_API_TOKEN` | Cloudflare → My Profile → API Tokens → Edit Cloudflare Workers 템플릿 |
| `CF_ACCOUNT_ID` | Cloudflare → Workers & Pages 우측 |

### 3. main 브랜치에 push → 자동 배포

```bash
git add .
git commit -m "deploy"
git push
```

### 4. 갤러리 Worker URL 입력

배포 후 `src/index.ts` 내 `WORKER_URL` 변수에 실제 URL 입력 후 재배포:

```javascript
const WORKER_URL = "https://mixi-mcp.계정명.workers.dev";
```

### 5. Claude.ai 커넥터 연결

Settings → Integrations → Add custom integration
URL: `https://mixi-mcp.계정명.workers.dev/mcp`

---

## 학생 작업 가이드

### 할 일 1 — MIXI 키워드 추가
`src/index.ts` 상단 `MIXI_KEYWORDS` 배열에 문자열 추가 후 push

### 할 일 2 — 갤러리 페이지 스타일 교체
`src/index.ts` 하단 `getGalleryHTML()` 함수 내부의 HTML/CSS를 자신들의 `index.html` 스타일로 교체
(실루엣 / `.desc` / `.bubble` / `.brands` 구조는 유지)

### 할 일 3 — index.html에 갤러리 링크 추가
```html
<a href="https://mixi-mcp.계정명.workers.dev/gallery">
  다른 사람들의 취향 보기
</a>
```

---

## 기술 스택

- **Runtime**: Cloudflare Workers
- **MCP Framework**: `agents@^0.9.0` (McpAgent)
- **상태 저장**: Cloudflare KV
- **배포**: GitHub Actions → Cloudflare Workers
- **언어**: TypeScript
