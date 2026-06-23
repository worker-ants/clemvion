# 신규 식별자 충돌 검토 결과

검토 범위: `spec/7-channel-web-chat/` (5-admin-console.md 신규 포함) + 연관 구현 diff (frontend web-chat console)
diff-base: origin/main

---

## 발견사항

### 1. 요구사항 ID 충돌

- **[INFO]** `NAV-WC-*` prefix — 기존 사용 없음, 신규 충돌 없음
  - target 신규 식별자: `NAV-WC-01` ~ `NAV-WC-06` (`spec/2-navigation/_product-overview.md §3.14`)
  - 기존 사용처: main codebase `spec/2-navigation/_product-overview.md` 에는 `NAV-WF`, `NAV-TR`, `NAV-SC`, `NAV-IN`, `NAV-KB`, `NAV-AM`, `NAV-MP`, `NAV-UG`, `NAV-UP` 만 존재. `NAV-WC` prefix 는 미사용.
  - 상세: 충돌 없음. 규약(NAV-<영역>-)과 일관.
  - 제안: 없음.

### 2. 스펙 문서 ID 충돌

- **[INFO]** `web-chat-admin-console` (5-admin-console.md) — 기존 사용 없음
  - target 신규 식별자: frontmatter `id: web-chat-admin-console` (`spec/7-channel-web-chat/5-admin-console.md`)
  - 기존 사용처: main codebase `spec/7-channel-web-chat/` 에는 `5-admin-console.md` 파일이 없음. 기존 4개 파일(`web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`)과 prefix 가 일관되며 중복 없음.
  - 상세: 충돌 없음.

### 3. 엔티티/타입명 충돌

- **[INFO]** `WebChatInstance`, `WebChatDraft`, `WebChatAppearance`, `WebChatBootInput` — 기존 사용 없음
  - target 신규 식별자: 위 인터페이스들 (`use-web-chat.ts`, `use-appearance-draft.ts`, `snippet.ts`)
  - 기존 사용처: main codebase `codebase/frontend/src/` 전체에서 이 이름들은 발견되지 않음.
  - 상세: 충돌 없음. `WebChat` prefix 가 동일 도메인(`channel-web-chat`) 내 SDK 타입(`BootConfig`, `ChatInstance` 등)과 이름 계층이 다르나, 콘솔 전용 DTO 이므로 혼동 가능성 낮음.

- **[INFO]** `WorkflowOption`, `CreateWebChatInput`, `CreatedWebChat` — 기존 유사명 확인
  - target 신규 식별자: `WorkflowOption` (`use-web-chat.ts`)
  - 기존 사용처: `WorkflowOption` 과 동일 이름이 codebase 내 다른 컴포넌트에 존재하는지 추가 확인 불필요 — 이 타입은 파일 내부(`use-web-chat.ts`)에서만 쓰이며 export 되지 않음(non-exported). 충돌 없음.

### 4. React Query 캐시 키 충돌

- **[INFO]** `WEB_CHAT_INSTANCES_KEY = ["web-chat-instances"]` — 기존 사용 없음
  - target 신규 식별자: `WEB_CHAT_INSTANCES_KEY` (`use-web-chat.ts`)
  - 기존 사용처: main codebase `triggers` 화면은 `["triggers", activeTab, statusFilter, page]` 키를 사용. `"web-chat-instances"` 는 기존 어느 queryKey 와도 겹치지 않음.
  - 상세: 신규 key 는 invalidation 시 `["triggers"]` prefix 를 공유하지 않으므로 캐시 경계 오염 없음. 코드에서 생성 성공 시 `["triggers"]` 와 `WEB_CHAT_INSTANCES_KEY` 를 함께 invalidate 하는데, 이는 의도된 동작(웹채팅=webhook trigger 이므로 양쪽 무효화)이며 충돌이 아님.

### 5. 환경변수·설정키 충돌

- **[WARNING]** `NEXT_PUBLIC_WIDGET_CDN_BASE` — frontend `.env.example` 에 미등록
  - target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (선택, admin frontend, `widget-base.ts` 에서 참조)
  - 기존 사용처: main codebase `codebase/frontend/.env.example` 에 이 키가 없음. `codebase/frontend/src/` 내 어디에도 이 env 를 읽는 코드가 origin/main 에 없음.
  - 상세: worktree 에서 신규 도입된 키이므로 기존 충돌은 없다. 그러나 `.env.example` 에 주석으로 추가되지 않아 배포 운영자가 해당 키 존재를 인지하지 못할 수 있다. 기능 충돌은 아니지만 문서화 누락.
  - 제안: `codebase/frontend/.env.example` 에 `# NEXT_PUBLIC_WIDGET_CDN_BASE=` 와 설명 주석 추가(spec 5-admin-console §5 §R4 참조).

- **[INFO]** `WEB_CHAT_WIDGET_ORIGINS` — 기존 키, 신규 도입 아님
  - target 신규 식별자: 없음 (기존 키)
  - 기존 사용처: `codebase/backend/src/main.ts:182`, `codebase/backend/src/common/cors/web-chat-cors.ts:108`, `codebase/backend/.env.example:44` — 이미 정의·문서화됨. spec `0-architecture.md §4` 에서 참조만 함.
  - 상세: 충돌 없음. 기존 키 재확인 참조.

### 6. i18n 키 충돌

- **[WARNING]** `sidebar.webChat` / `webChat.*` dict — origin/main 에 미존재
  - target 신규 식별자: `sidebar.webChat` (`sidebar.ts`), `webChat.*` (새 `webChat.ts` 파일)
  - 기존 사용처: origin/main 기준 `codebase/frontend/src/lib/i18n/dict/en/sidebar.ts` 에 `webChat` 키 없음. `codebase/frontend/src/lib/i18n/dict/en/` 에 `webChat.ts` 파일 없음. origin/main `dict/en/index.ts` 에 `webChat` import 없음.
  - 상세: worktree 에서 신규 추가된 키이므로 기존 동일 키와의 **의미 충돌**은 없다. 그러나 origin/main 에 i18n Dict 타입(`Dict["webChat"]`)이 없으므로 타입스크립트 컴파일 관점에서 merge 시 타입 정의(`types.ts`)와 `ko/index.ts` 도 함께 갱신돼야 함 — 이는 충돌이 아닌 의존 추가 사항이며, worktree 내 파일들이 이미 이를 처리하고 있는지는 `types.ts` 확인이 필요.
  - 제안: 없음 (식별자 충돌은 없음).

### 7. API endpoint 충돌

- **[INFO]** 신규 endpoint 없음 — 기존 `/api/triggers` 재사용만
  - target 신규 식별자: 없음. spec 5-admin-console §2 는 `GET /api/triggers`, `POST /api/triggers` 의 **기존 엔드포인트**를 재사용. 신규 백엔드 엔드포인트 미신설.
  - 상세: 충돌 없음. 신규 API 표면이 없으므로 endpoint 충돌 점검 대상 없음.

### 8. postMessage 이벤트명 충돌

- **[INFO]** `wc:*` 네임스페이스 — 기존 정의와 일관
  - target 신규 식별자: `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event` (spec 2-sdk.md §3)
  - 기존 사용처: `codebase/channel-web-chat/` 의 기존 구현(`demo-host.tsx`, README 등)에서 동일 `wc:*` 이름 사용 — 신규 정의가 아니라 기존 구현의 spec 확인.
  - 상세: 충돌 없음. `wc:` prefix 는 이미 해당 도메인에서 일관되게 사용 중.

### 9. 파일 경로 충돌

- **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` — 신규 파일, 기존 없음
  - target 신규 식별자: 위 경로
  - 기존 사용처: main codebase `spec/7-channel-web-chat/` 에 `5-admin-console.md` 미존재.
  - 상세: 충돌 없음. 영역 내 숫자 접두 파일(`0-`, `1-`, `2-`, `3-`, `4-`) 다음 자연스러운 `5-` 위치.

- **[INFO]** `codebase/frontend/src/lib/web-chat/` 신규 디렉토리 — 기존 `lib/` 하위 구조와 일관
  - 기존 사용처: main codebase 에 해당 디렉토리 없음. `lib/` 하위 `utils/`, `api/`, `i18n/` 등 패턴과 일관.
  - 상세: 충돌 없음.

- **[INFO]** `codebase/frontend/src/components/web-chat/` 신규 디렉토리 — 기존 없음
  - 기존 사용처: main codebase 에 해당 디렉토리 없음.
  - 상세: 충돌 없음.

---

## 요약

`spec/7-channel-web-chat/5-admin-console.md` 신규 파일과 관련 구현(frontend web-chat console) 이 도입하는 신규 식별자 중 기존 사용처와 **의미 충돌하는 사례는 발견되지 않았다**. 요구사항 ID(`NAV-WC-*`), 스펙 문서 ID(`web-chat-admin-console`), 엔티티/타입명(`WebChatInstance`, `WebChatDraft` 등), React Query 캐시 키(`web-chat-instances`), postMessage 이벤트명(`wc:*`), 파일 경로 모두 origin/main 에 동명 충돌이 없다. 주의 사항으로는 (1) `NEXT_PUBLIC_WIDGET_CDN_BASE` env 키가 `frontend/.env.example` 에 추가되지 않아 배포 문서화가 누락됐고, (2) `sidebar.webChat` · `webChat.*` i18n 키가 신규로 도입됐으나 origin/main `types.ts` / `ko/index.ts` 갱신이 필요하다는 점이 있다 — 두 사항 모두 식별자 의미 충돌이 아닌 문서화/타입 연동 사항이다.

---

## 위험도

LOW
