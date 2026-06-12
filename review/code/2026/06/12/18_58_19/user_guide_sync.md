# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음.

변경 set 의 코드 파일은 다음으로 구성된다.

- `codebase/frontend/src/lib/i18n/backend-labels.ts` — `ERROR_KO` 에 7개 chat-channel 에러 코드 신규 등록
- `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` — parity guard `LOCALIZED_ERROR_CODES` 에 8개 코드 추가 + `translateBackendError` 직접 단위 테스트 케이스 (7)(8)(9) 추가
- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (KO) — Callout 에 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 추가 + 한국어 표시 문구 갱신
- `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` (EN) — 동일 코드 추가 + "All codes are shown as localized Korean messages…" 로 갱신

각 trigger 에 대한 매칭 결과는 아래와 같다.

### `new-error-code` (ErrorCode enum 추가) — 비매칭

trigger glob `codebase/backend/src/nodes/core/error-codes.ts` 에 해당하는 파일이 변경 set 에 없다. 이번 변경은 이미 backend 에 존재하는 에러 코드들의 frontend `ERROR_KO` 매핑 후속 등록이며, enum 신규 추가가 아니다. 매트릭스 행의 target(`backend-labels.ts` 의 `ERROR_KO` 매핑 추가)은 이번 변경 set 에서 직접 수행됐다.

### `new-warning-code` — 비매칭

backend warningRules 변경 없음. 이번 변경은 error code 번역 등록이며 WARNING_KO 와 무관하다.

### `userguide-gui-flow-section` — 비매칭 (내용 정밀도 갱신, 신규 흐름 절 아님)

`triggers.mdx` + `triggers.en.mdx` 변경은 기존 Callout 의 에러 코드 목록 보완 및 한국어 표시 여부 문구 갱신으로, 신규 GUI 흐름 절 신설이 아니다. `<ImplAnchor kind="ui-entry">` 동반 작성이 요구되는 "user-guide GUI 흐름 절 신규/변경" trigger 에 해당하지 않는다.

### `new-ui-string` — 비매칭

TSX 파일 변경 없음. `dict/{ko,en}/<section>.ts` parity 갱신 대상이 없다. `backend-labels.ts` 의 `ERROR_KO` 는 TSX i18n dict 와 별개의 backend error 번역 테이블이다.

### KO/EN 문서 parity — 정합

- `triggers.mdx` (KO) 와 `triggers.en.mdx` (EN) 에 동일하게 `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 가 추가됐다.
- `WORKSPACE_ID_REQUIRED` 는 두 파일 모두 변경 전부터 Callout 목록에 있었고 이번 변경에서도 양쪽 동일하게 유지됐다.
- KO/EN 쌍 parity: 이상 없음.

### `backend-labels.ts` ERROR_KO 매핑 — 완전

추가된 7개 코드(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`)가 모두 `ERROR_KO` 에 한국어 메시지와 함께 등록됐다. `WORKSPACE_ID_REQUIRED` 는 이미 `ERROR_KO` 에 존재했으며 `LOCALIZED_ERROR_CODES` parity guard 에도 이번 변경에서 추가됐다. 영문 SoT 누락(사용자에게 영문 그대로 노출되는) 상태가 존재하지 않는다.

### `spec-major-change` — 비매칭 (catalog 생성물, lifecycle guard 적용 대상 외)

`spec/conventions/cafe24-api-catalog/_generator.py`, `_overview.md`, 카탈로그 필드 파일 3개는 `fix-spec-frontmatter-catalog.md` plan 에서 lifecycle guard 대상에서 제외 확정된 생성물이다. frontmatter `id/status/pending_plans` 정합 갱신 요건 없음.

## 요약

매트릭스 총 18개 row 중 이번 변경이 glob/semantic 매칭되는 trigger 는 `new-error-code` (backend-labels ERROR_KO 등록) 1건이며, 해당 target 동반 갱신(`backend-labels.ts` 코드 추가 + 테스트 guard 확장)이 변경 set 안에 완전히 포함돼 있다. 나머지 row 는 비매칭. KO/EN 문서 parity, i18n dict parity, 신규 섹션 locale 등록 모두 이상 없음. 누락된 동반 갱신 0건.

## 위험도

NONE

STATUS=success ISSUES=0
