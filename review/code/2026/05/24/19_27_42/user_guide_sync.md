# 유저 가이드 동반 갱신 (User Guide Sync) 리뷰

검토 일시: 2026-05-24
대상 PR: trigger-create-multi-provider-ui (slack/discord Chat Channel provider 추가)

---

## 발견사항

해당 없음. 검토 대상 변경 set 의 모든 매트릭스 trigger 에 대해 동반 갱신이 정상 완료되어 있음.

---

## 항목별 매트릭스 매칭 결과

### Trigger 1: 통합 신규/제공자 변경

- **매칭 파일**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
  - `CHAT_CHANNEL_PROVIDERS` 를 `['telegram']` → `['telegram', 'slack', 'discord']` 로 확장
  - `inboundSigningPlaintext` 신규 필드 추가
- **매트릭스 항목**: "통합 신규/제공자 변경 — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키"
- **검증 결과**: 충족
  - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx` — §3 GUI 등록 흐름 갱신, `<ImplAnchor kind="ui-entry">` 동반 작성 (file=`triggers/page.tsx`, symbol=`createMutation`), `<Callout>` 안내 추가. 확인
  - `codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx` — 동일 내용 영문 번역 갱신. 확인
  - `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` — §4 GUI 등록 흐름 갱신, `<ImplAnchor kind="ui-entry">` 동반 작성, v1 한계 `<Callout type="warn">` 추가. 확인
  - `codebase/frontend/src/content/docs/06-integrations-and-config/discord.en.mdx` — 동일 내용 영문 번역 갱신. 확인
  - dict 키: `addChatChannelToggle` / `addChatChannelHelp` 갱신 + `inboundSigningLabelSlack` / `inboundSigningLabelDiscord` / `inboundSigningPlaceholderSlack` / `inboundSigningPlaceholderDiscord` / `inboundSigningFormatHelpSlack` / `inboundSigningFormatHelpDiscord` / `inboundSigningRequiredErrorSlack` / `inboundSigningRequiredErrorDiscord` 신규 추가 — ko/en 양쪽 동시 등록 확인

### Trigger 2: user-guide GUI 흐름 절 신규/변경 (`ImplAnchor` 의무)

- **매칭 파일**: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (+ `.en.mdx`), `slack.mdx` (+ `.en.mdx`), `discord.mdx` (+ `.en.mdx`)
- **매트릭스 항목**: "user-guide GUI 흐름 절 신규/변경 — `<ImplAnchor kind="ui-entry">` 동반 작성. `file`/`symbol` 실존 의무. SoT: `spec/conventions/user-guide-evidence.md`"
- **검증 결과**: 충족
  - `triggers.mdx` §Chat Channel 연결 — `<ImplAnchor kind="ui-entry" file="codebase/frontend/src/app/(main)/triggers/page.tsx" symbol="createMutation">` 삽입 확인
  - `triggers.en.mdx` § Chat Channel — 동일 `<ImplAnchor>` 삽입 확인
  - `slack.mdx` §3 — `<ImplAnchor kind="ui-entry" ... symbol="createMutation">` 삽입 확인
  - `slack.en.mdx` §3 — 동일 `<ImplAnchor>` 삽입 확인
  - `discord.mdx` §4 — `<ImplAnchor kind="ui-entry" ... symbol="createMutation">` 삽입 확인
  - `discord.en.mdx` §4 — 동일 `<ImplAnchor>` 삽입 확인
  - `file` 실존: `codebase/frontend/src/app/(main)/triggers/page.tsx` 실존 확인
  - `symbol` 실존: `createMutation` 이 해당 파일 189번 줄에서 `const createMutation = useMutation(...)` 로 정의됨 확인

### Trigger 3: 신규 UI 문자열 (TSX) — i18n parity

- **매칭 파일**: `codebase/frontend/src/app/(main)/triggers/page.tsx` (신규 i18n 키 사용)
- **매트릭스 항목**: "신규 UI 문자열 (TSX) — `dict/{ko,en}/<section>.ts` **양쪽** 등록 필수"
- **검증 결과**: 충족
  - 신규 8개 키 (`inboundSigningLabelSlack`, `inboundSigningLabelDiscord`, `inboundSigningPlaceholderSlack`, `inboundSigningPlaceholderDiscord`, `inboundSigningFormatHelpSlack`, `inboundSigningFormatHelpDiscord`, `inboundSigningRequiredErrorSlack`, `inboundSigningRequiredErrorDiscord`) + 변경 2개 키 (`addChatChannelToggle`, `addChatChannelHelp`) — `dict/ko/triggers.ts` 와 `dict/en/triggers.ts` 양쪽 동시 등록 확인
  - TSX 내 JSX-렌더링 한국어 하드코딩 없음 — 모두 `t("triggers.chatChannel.*")` 호출로 추출됨 확인

### Trigger 4: 신규 errorCode 발행

- **매칭 파일**: `codebase/backend/src/modules/triggers/triggers.service.ts` (신규 에러 코드 `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN` 발행)
- **매트릭스 항목**: "신규 errorCode 발행 — 현재 `backend-labels.ts` 에 `ERROR_KO` 매핑 테이블이 없어 영문 message 가 그대로 노출됨. 후속 plan 에서 `ERROR_KO` 신설 검토 — 그 전까지는 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시"
- **검증 결과**: 매트릭스가 정의한 현행 기준(후속 plan 전까지 ERROR_KO 테이블 미존재 상태 인정)에 부합
  - `backend-labels.ts` 에 `ERROR_KO` 테이블 자체가 미존재 — 전 PR 부터의 기존 상태
  - `triggers.mdx` 와 `triggers.en.mdx` 양쪽에 Callout 으로 해당 error code 목록 및 현재 영문 노출 사유를 명시 ("현재 `ERROR_KO` 테이블에 미등록으로 영문 그대로 노출돼요 — 향후 `backend-labels.ts` 갱신 시 흡수 예정이에요") — PR 본문 명시 의무를 docs Callout 으로 충족
  - 매트릭스 규정: "그 전까지는 errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시" — 충족

### Trigger 5: KO/EN sibling 동기화 확인

- `triggers.mdx` / `triggers.en.mdx` 양쪽 갱신 확인
- `slack.mdx` / `slack.en.mdx` 양쪽 갱신 확인
- `discord.mdx` / `discord.en.mdx` 양쪽 갱신 확인

### 매트릭스 비매칭 변경

- `ai-agent.handler.ts` / `ai-agent.handler.spec.ts` 변경 (`capFormDataBytes` 헬퍼 및 `FORM_SUBMITTED_MAX_BYTES` 삭제) — 내부 helper 제거 (ai-agent formdata cap 롤백). 유저 가이드 트리거 없음. spec §12.7 관련 docs 연동 없음 — 본 PR 의 롤백 대상은 이미 완료된 internal helper 이며 사용자 가시 변경 아님. docs MDX 연동 불필요.
- `chat-channel-discord.e2e-spec.ts` / `e2e-chat-channel-fixture.ts` — e2e 파일 변경. 유저 가이드 트리거 없음.
- `plan/complete/` 파일 삭제 (`ai-agent-formdata-size-limit.md`, `chat-channel-unverified-owner-e2e.md`) — plan 정리. 유저 가이드 트리거 없음.
- `review/consistency/` 파일 삭제 — 리뷰 산출물 정리. 유저 가이드 트리거 없음.

---

## 요약

매트릭스 trigger 총 5개 카테고리 (통합 신규/제공자 변경, GUI 흐름 ImplAnchor 의무, i18n parity, 신규 errorCode 발행, KO/EN sibling) 매칭 — 모두 충족. 누락 0건. 신규 slack/discord provider 에 대해 (a) `06-integrations-and-config/slack.{mdx,en.mdx}` + `discord.{mdx,en.mdx}` GUI 흐름 절과 `<ImplAnchor kind="ui-entry">` (b) `02-nodes/triggers.{mdx,en.mdx}` provider 테이블과 `<ImplAnchor>` (c) `dict/{ko,en}/triggers.ts` 신규 8키 + 2키 변경 — 모두 동일 변경 set 안에 포함. `ERROR_KO` 미매핑 문제는 매트릭스 정의에 따라 docs Callout 으로 명시되어 있어 현행 기준 충족.

---

## 위험도

NONE
