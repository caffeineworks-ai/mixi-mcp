# MIXI MCP Server

MIXI 조명 브랜드의 공간 취향 인터뷰 MCP 서버입니다.

---

## 학생 가이드

### 1. Claude.ai 커넥터 연결

Claude.ai → Settings → Integrations → Add custom integration
URL: `https://mixi-mcp.typica-918.workers.dev/mcp`

연결 후 Claude와 대화를 시작하면 MIXI 인터뷰를 진행할 수 있습니다.

### 2. 이 repo fork

본인의 GitHub 계정으로 이 repo를 fork하세요.

### 3. index.html 재작성

fork한 repo의 `index.html`을 본인의 브랜드 페이지로 재작성하세요.
갤러리 바로가기 버튼(`<a href="...">`)은 삭제하지 마세요.

### 4. GitHub Pages 활성화

fork한 repo → Settings → Pages → Branch: main / root → Save

본인의 브랜드 페이지가 `https://깃허브계정.github.io/mixi-mcp/` 에서 서빙됩니다.

### 5. 선생님께 전달할 것

- 추가하고 싶은 MIXI 키워드
- 갤러리 페이지 스타일 수정 의견

---

## 서비스 구조

```
학생 브랜드 페이지 (GitHub Pages, fork한 repo)
        ↓ 갤러리 바로가기 버튼
MIXI 갤러리 (https://mixi-mcp.typica-918.workers.dev/gallery)
        ↑ 폴링
Cloudflare KV (결과 저장)
        ↑ save_mixi_result
Claude.ai + MIXI 커넥터 (인터뷰 진행)
```

---

## MCP 툴 목록

| 툴 이름 | 설명 |
|---|---|
| `introduce_mixi` | MIXI 브랜드 소개 + 갤러리 안내 + 인터뷰 참여 유도 |
| `start_mixi_interview` | 인터뷰 진행 (나이 / 성별 / MBTI / 키워드 2개 / 브랜드 3개) |
| `save_mixi_result` | 결과를 Cloudflare KV에 저장 |

---

## 관리자 가이드 (선생님용)

### MIXI 키워드 추가

`src/index.ts` 상단 배열에 추가 후 push:

```typescript
const MIXI_KEYWORDS = [
  "내추럴 무드",
  "모던 미니멀",
  "미드센추리",
  "추가할 키워드",
];
```

### 갤러리 스타일 수정

`src/index.ts` 하단 `getGalleryHTML()` 함수 내부 CSS 수정 후 push.

push하면 GitHub Actions가 자동으로 Cloudflare Workers에 배포합니다.
