## 발견사항

### [WARNING] `cafe24.en.mdx` — 한국어 문서 대비 주요 섹션 누락

- **위치**: `frontend/src/content/docs/06-integrations-and-config/cafe24.en.mdx` (전체 파일)
- **상세**: 한국어 문서(`cafe24.mdx`)에는 있으나 영문 문서에 없는 섹션이 두 개다. (1) OAuth scope 권장 프리셋 표 — 8개 카테고리 × read/write scope 값 (`mall.read_product` 등). (2) FAQ 4항목 — mall_id 수정 방법, `OAUTH_CONFIG_MISSING` 오류 처리, `CAFE24_MCP_NO_SESSION` 원인, 응답 느림 원인. 영문 사용자는 scope 값을 Cafe24 공식 문서에서 직접 찾아야 하며, 자주 겪는 오류 해결 경로가 문서화되지 않는다.
- **제안**: `cafe24.en.mdx` 에 `## OAuth Scope Presets` 표와 `## FAQ` 섹션을 추가하여 양 언어 문서의 내용 패리티를 맞춘다.

---

### [WARNING] 환경변수 `.env.example` 미갱신

- **위치**: diff 외부 — `.env.example` 파일
- **상세**: `cafe24.mdx`·`cafe24.en.mdx` 두 문서 모두 `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET`, `OAUTH_STUB_MODE` 세 변수를 문서화하고 있다. 그러나 이 변경 diff에 `.env.example` 갱신이 없다. 운영자가 새 배포를 설정할 때 `.env.example`을 참조하는 경우 Public 앱 흐름이 동작하지 않는다. 이미 `review/2026-05-14_01-29-47/documentation/review.md`에서도 같은 사항이 지적되었으나 `RESOLUTION.md`에서 follow-up으로 미뤄진 상태.
- **제안**: 최소한 다음 세 줄을 `.env.example`에 추가한다:
  ```
  # Cafe24 Public App OAuth
  # CAFE24_CLIENT_ID=
  # CAFE24_CLIENT_SECRET=
  # OAUTH_STUB_MODE=false   # set to true for local dev (no real OAuth call)
  ```

---

### [WARNING] `integrations.ts` 주석이 내부 구현 세부사항을 API 계층에 노출

- **위치**: `frontend/src/lib/api/integrations.ts` — `oauthBegin` 파라미터 블록 내 주석
- **상세**: 추가된 주석 `"// Public apps read client_id/secret from server env; private apps pass them in here for the state-row TTL"` 은 백엔드의 state row TTL 구현 방식을 프론트엔드 API 클라이언트 레이어에 기술하고 있다. 이 계층의 문서 책임은 "무엇을 전달하는가"이지 "백엔드가 어떻게 저장하는가"가 아니다. 유지보수 중 백엔드 저장 방식이 바뀌면 이 주석이 오해를 유발한다.
- **제안**: 주석을 아래처럼 호출자 관점으로 재작성한다:
  ```ts
  // Cafe24-only. mallId is required before the OAuth popup opens because
  // Cafe24 token URLs are mall-specific. For private apps, supply
  // clientId/clientSecret obtained from the shop's admin panel.
  ```

---

### [INFO] `mcp-capable-service-types.ts` — 미래 follow-up이 일반 주석으로만 기록

- **위치**: `frontend/src/lib/integrations/mcp-capable-service-types.ts` 블록 주석
- **상세**: `"A future follow-up could expose this list via /api/integrations/services and drop the duplication"` 는 기술 부채 사항인데, 일반 설명 주석에 묻혀 있어 `TODO` 트래킹 도구에서 잡히지 않는다.
- **제안**: `// TODO: expose via GET /api/integrations/services to eliminate frontend/backend duplication` 으로 분리한다.

---

### [INFO] `mcp-server-selector.tsx` — 이모지 UI 레이블에 i18n 처리 부재

- **위치**: `frontend/src/components/integrations/mcp-server-selector.tsx:195, 200`
- **상세**: `"🌐 Generic MCP (HTTP) servers"`, `"🛒 Cafe24 stores (Internal Bridge)"` 두 문자열이 하드코딩된 영문이다. 다른 UI 텍스트가 `t()` 훅을 통해 처리된다면 이 부분만 예외가 된다. 이모지 자체도 스크린 리더에서 의도치 않게 읽힐 수 있다.
- **제안**: 당장 i18n 적용이 어렵다면 최소한 `const GROUP_LABELS = { mcp: '...', cafe24: '...' }` 상수로 추출하고, 향후 `t()` 래핑 시 단일 지점만 수정하도록 준비한다.

---

### [INFO] CHANGELOG 갱신 없음

- **위치**: 프로젝트 루트 또는 해당 changelog 파일
- **상세**: Cafe24 통합은 신규 서비스 타입 추가, AI Agent MCP 연동, OAuth 플로우 확장을 포함하는 주요 기능이다. diff 범위 내에서 CHANGELOG 업데이트가 없다.
- **제안**: 팀 컨벤션에 따라 릴리스 노트 항목 추가를 검토한다.

---

### [INFO] `cafe24.en.mdx` 와 `cafe24.mdx` frontmatter 구조 불일치

- **위치**: 두 mdx 파일 frontmatter
- **상세**: 한국어 문서는 `title` + `title_en` + `summary` + `summary_en` 네 필드를 모두 가지지만, 영문 문서는 `title` + `title_en` 만 있고 `summary_en` 이 없다(`summary` 만 있음). 문서 빌드 시스템이 `summary_en` 을 별도로 활용하는 경우 영문 문서의 메타데이터가 불완전하다.
- **제안**: `cafe24.en.mdx` 에 `summary_en` 필드를 추가하거나, 한국어 문서의 `summary_en` 필드를 제거하여 두 파일의 frontmatter 스키마를 통일한다.

---

## 요약

이번 변경의 문서화 수준은 전반적으로 높다. 두 언어의 사용자 가이드 신규 작성, `mcp-capable-service-types.ts` 의 프론트-백 동기화 주석, `mcp-server-selector.tsx` 의 설계 결정 주석 모두 모범적이다. 주된 개선점은 세 가지다: 영문 문서에서 OAuth scope 프리셋 표와 FAQ 섹션이 누락되어 한국어 사용자와의 정보 격차가 생기고, `.env.example` 미갱신으로 운영 배포 시 환경변수 설정 안내가 빠지며, 프론트엔드 API 계층 주석이 백엔드 내부 구현 세부사항을 기술하여 유지보수 중 오해를 유발할 수 있다.

## 위험도

**LOW**