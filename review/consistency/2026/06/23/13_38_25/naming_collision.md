# 신규 식별자 충돌 검토

검토 대상: `spec/7-channel-web-chat/` (diff-base=origin/main, --impl-done)  
신규 파일: `spec/7-channel-web-chat/5-admin-console.md` (신설)  
수정 파일: `spec/7-channel-web-chat/0-architecture.md`, `spec/7-channel-web-chat/_product-overview.md`

---

## 발견사항

### 1. **[WARNING]** `NAV-WC-01..06` 요구사항 ID — 정의 없이 참조

- target 신규 식별자: `NAV-WC-01`, `NAV-WC-02`, … `NAV-WC-06` (5-admin-console.md §Overview: "요구사항 SoT: [`NAV-WC-01..06`](../2-navigation/_product-overview.md)")
- 기존 사용처: `spec/2-navigation/_product-overview.md` — 해당 파일에 `NAV-WC-*` 시리즈가 전혀 존재하지 않는다. 현재 정의된 최고 번호는 `NAV-AM-06` (§3.13 Agent Memory) 이며, 웹채팅 메뉴 전용 섹션이 없다.
- 상세: `5-admin-console.md` 는 SoT 를 `_product-overview.md` 로 가리키지만, 실제 navigation spec 에 `NAV-WC-*` 요구사항이 없다. 내부 링크(`[NAV-WC-01..06]`) 는 현재 dead reference 다. 사이드바 신규 메뉴 등록 요구사항이 `_layout.md`/`_product-overview.md` 에 반영되지 않은 상태다.
- 제안: `spec/2-navigation/_product-overview.md` §3.x 에 "웹채팅(Web Chat)" 섹션을 추가하고 `NAV-WC-01..06` 요구사항을 정의하거나, 참조 링크가 가리키는 앵커가 없음을 명시해 미이행(planned) 상태임을 표기한다.

---

### 2. **[WARNING]** `sidebar.webChat` i18n 키 — 기존 dict 에 부재

- target 신규 식별자: `sidebar.webChat` (5-admin-console.md §8: "메뉴 라벨 `sidebar.webChat` — `lib/i18n/dict/{ko,en}/sidebar.ts`")
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/ko/sidebar.ts`, `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/en/sidebar.ts` — 현재 두 파일 모두에 `webChat` 키가 없다. 기존 키 목록: `dashboard`, `workflows`, `triggers`, `schedule`, `integration`, `knowledgeBase`, `models`, `llmConfig`, `reranker`, `authentication`, `statistics`, `systemStatus`, `agentMemory`, `userGuide` 등.
- 상세: spec 이 이미 `sidebar.webChat` 키를 사용처로 못 박았으나 codebase 에 존재하지 않아 i18n 타입 검사(`ui-label-parity.test.ts`)가 실패할 위험이 있다. 충돌은 아니지만 누락 식별자다.
- 제안: 해당 키가 구현 범위(증분)에 속한다면 spec 에 "(미구현 — Phase 1 에서 추가)" 표기를 달거나, 구현 PR 에 누락 사실을 추적한다.

---

### 3. **[WARNING]** `lib/i18n/dict/{ko,en}/web-chat.ts` — 신규 파일, 기존 `index.ts` 등록 필요

- target 신규 식별자: `lib/i18n/dict/{ko,en}/web-chat.ts` (5-admin-console.md §8: "콘솔 페이지 문자열 — `lib/i18n/dict/{ko,en}/web-chat.ts` (+ 각 `index.ts` 등록)")
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/ko/` 및 `en/` — 현재 `web-chat.ts` 파일이 없다. `index.ts` 에 아직 미등록 상태.
- 상세: spec 은 파일 경로를 명시했으나 아직 생성되지 않았다. 이 자체는 구현 미완성이라 충돌이 아니지만, 기존 `index.ts` 내 dict key 목록에 `webChat` 네임스페이스가 없어 TypeScript 타입(`Dict`) 정의 변경도 수반된다(`types.ts`).
- 제안: 구현 plan(`web-chat-console.md`)에 i18n dict 파일 신설 + `types.ts` Dict 타입 확장이 명시 체크박스로 추적되는지 확인한다.

---

### 4. **[INFO]** `NEXT_PUBLIC_WIDGET_CDN_BASE` ENV var — 신규, 기존 `.env.example` 에 미등록

- target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (0-architecture.md §4, 5-admin-console.md §5·§R4: "admin 프론트엔드, 신규(선택)")
- 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/.env.example` — 이 변수가 없다. 기존 등록 변수: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_WEBHOOK_BASE_URL`(commented). 백엔드 `WEB_CHAT_WIDGET_ORIGINS` 는 이미 `/Volumes/project/private/clemvion/codebase/backend/.env.example` 에 등록됨.
- 상세: spec 이 "신규(선택)" 로 명시했고 기존 변수와 용도가 다르므로 충돌은 아니다. 단 frontend `.env.example` 에 주석 형태로라도 문서화되지 않으면 배포자가 두 env 를 같이 맞춰야 한다는 사실을 놓칠 수 있다(`0-architecture §4` 경고: "두 값은 일치해야 함").
- 제안: `codebase/frontend/.env.example` 에 `# NEXT_PUBLIC_WIDGET_CDN_BASE=` 항목을 추가해 `WEB_CHAT_WIDGET_ORIGINS` 와 세트로 설명하는 주석을 달도록 구현 plan 에 포함시킨다.

---

### 5. **[INFO]** `getWidgetLoaderUrl()` 함수명 — spec 에만 정의, codebase 미존재

- target 신규 식별자: `getWidgetLoaderUrl()` (5-admin-console.md §5: "self-origin loader URL 을 항상 생성하며(`getWidgetLoaderUrl()`)")
- 기존 사용처: codebase 전체 검색 결과 `getWidgetLoaderUrl` 함수가 현재 존재하지 않는다. 유사 함수로 `getWebhookBaseUrl()` (`codebase/frontend/src/lib/utils/webhook-url.ts`) 이 있으나 다른 용도.
- 상세: spec 이 함수명을 특정했으나 미구현 상태다. `getWebhookBaseUrl` 과 패턴이 유사해 동일 `webhook-url.ts` 또는 신규 `web-chat-url.ts` 에 추가될 것으로 보인다. 현재는 이름 충돌 없음.
- 제안: 구현 시 기존 `getWebhookBaseUrl` 내부 로직(env fallback 우선순위)을 재사용하되 `widget` 전용으로 분리하는 방향이 일관성에 부합한다(spec §5 `<api-base>` 결정 로직과 같은 파일 `webhook-url.ts` 재사용을 명시).

---

### 6. **[INFO]** `spec/7-channel-web-chat/5-admin-console.md` — 파일 번호 순서 및 메뉴 등록

- target 신규 식별자: 파일 경로 `spec/7-channel-web-chat/5-admin-console.md`, spec id `web-chat-admin-console`
- 기존 사용처: 기존 `4-security.md` 까지 번호가 순차적이고, `5-admin-console` 는 빈 슬롯. `web-chat-admin-console` id 는 기존 spec 어디에도 사용되지 않는다.
- 상세: 파일 경로·id 모두 충돌 없음. `spec/2-navigation/_layout.md` "메뉴 항목" 섹션에 `/web-chat` 경로 등록 여부를 추가로 확인할 필요가 있다(5-admin-console §Overview 가 `[메뉴 등록](../2-navigation/_layout.md#22-메뉴-항목)` 을 참조하므로). 해당 파일에 `웹채팅` 항목이 실제로 있는지는 본 검토 범위(식별자 충돌)에서 별도 확인 가능.
- 제안: 명명 충돌 없음. 단 `_layout.md` `#22-메뉴-항목` 앵커가 실존하는지 링크 정합성 확인 권장.

---

## 요약

target(`spec/7-channel-web-chat/` diff) 이 도입하는 신규 식별자 중 **기존에 다른 의미로 이미 사용 중인 충돌**은 발견되지 않았다. 신규 spec id `web-chat-admin-console`, 파일 경로 `5-admin-console.md`, 환경변수 `NEXT_PUBLIC_WIDGET_CDN_BASE`, 함수명 `getWidgetLoaderUrl()` 은 모두 기존 사용처와 겹치지 않는다. 다만 **두 가지 미완성 참조**가 주목된다: (1) `5-admin-console.md` 가 SoT 로 명시한 `NAV-WC-01..06` 요구사항이 `spec/2-navigation/_product-overview.md` 에 아직 존재하지 않아 dead link 상태이고, (2) `sidebar.webChat` i18n 키가 frontend dict 에 없다. 두 항목 모두 구현 plan 에서 추적해야 할 미완성 식별자이며 현재 다른 의미로 선점된 충돌은 아니다.

## 위험도

MEDIUM
