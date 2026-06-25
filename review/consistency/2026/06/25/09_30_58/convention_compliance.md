# 정식 규약 준수 검토 — web-chat-preview-improvements

**검토 모드**: `--impl-done`
**Target**: `plan/in-progress/web-chat-preview-improvements.md` + diff (origin/main...HEAD)
**검토일**: 2026-06-25

---

## 발견사항

### [INFO-1] plan frontmatter 에 `status` 필드가 비표준 추가 필드로 포함됨
- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` frontmatter L6 `status: in-progress`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 3 필드는 `worktree`·`started`·`owner`. `priority`/`status`/`title` 등 추가 필드는 허용.
- **상세**: `status: in-progress` 는 허용 범주의 추가 필드이므로 위반은 아님. 다만 plan 수명 동안 값이 고정(`in-progress`)이어서 가치 정보가 없고, 완료 이동 시 Gate C 체크 항목인 `spec_impact` 와 혼동 우려가 있다.
- **제안**: 현행 유지 가능 (위반 아님). `spec_impact` 는 `complete/` 이동 시 별도 추가 필요.

### [INFO-2] plan frontmatter 의 `spec_impact` 필드가 in-progress 단계에 존재함
- **target 위치**: `plan/in-progress/web-chat-preview-improvements.md` frontmatter L7-9 `spec_impact:`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — "`spec_impact` 는 완료 시점에만 `spec-plan-completion.test.ts` 가 강제. in-progress 단계에선 의무 아님."
- **상세**: in-progress 단계에 `spec_impact` 를 미리 작성하는 것은 규약 위반이 아님. Gate C(`started: 2026-06-25` → 2026-06-04 이후 적용 대상)에서 완료 시점 검사 기준으로 사용된다. 현행 경로(`spec/5-system/14-external-interaction-api.md`, `spec/7-channel-web-chat/5-admin-console.md`)는 실존 spec 파일이므로 dangling 없음.
- **제안**: `complete/` 이동 시 `spec_impact` 경로 실존 재확인으로 충분.

### [INFO-3] `PRESENTATION_NODE_TYPES` 상수 파일이 `common/constants/` 에 신설됨 — 명명 규약 확인
- **target 위치**: `codebase/backend/src/common/constants/presentation.ts` (신규 파일)
- **위반 규약**: 명시적 명명 규약 없음 (conventions 내 `common/constants/` 파일 명명 규약 미정의).
- **상세**: 파일명 `presentation.ts`, export 이름 `PRESENTATION_NODE_TYPES` 는 `UPPER_SNAKE_CASE` 상수 관례에 부합. JSDoc 으로 단일 출처 근거 명시. 기존 `chat-channel.dispatcher.ts` 의 로컬 Set 를 제거하고 공용 모듈로 이동한 것은 의존 방향상 올바름.
- **제안**: 현행 유지.

### [INFO-4] `ExecutionMessageEvent` 타입 명명 — DOM 전역 `MessageEvent` shadowing 회피 의도 명시됨
- **target 위치**: `codebase/channel-web-chat/src/lib/eia-types.ts` L445 `export interface ExecutionMessageEvent`
- **위반 규약**: `spec/conventions/` 에 frontend 타입 명명 규약은 별도로 없음.
- **상세**: plan W6 메모로 "DOM 전역 `MessageEvent` shadowing 회피" 근거가 명시. `AiMessageEvent` 컨벤션 준수 확인됨. JSDoc 도 DOM `MessageEvent` 와 별개임을 명시.
- **제안**: 현행 유지. 위반 없음.

### [INFO-5] i18n dict 신규 키 ko/en 동시 추가 — Principle 2 준수 확인
- **target 위치**: `codebase/frontend/src/lib/i18n/dict/en/webChat.ts` L644-645 / `dict/ko/webChat.ts` L657-658
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 2 — ko/en 사전 leaf key parity.
- **상세**: `reset`·`resetHint` 키가 ko/en 양쪽에 동시에 추가됨. 값도 각각 현지화됨. Principle 2 준수.
- **제안**: 현행 유지.

### [INFO-6] `postCommand` 헬퍼가 `'wc:command'` 를 하드코딩
- **target 위치**: `codebase/frontend/src/components/web-chat/live-preview.tsx` L601-610
- **위반 규약**: `spec/conventions/i18n-userguide.md` Principle 1 — UI 문자열 dict 경유. 단 `'wc:command'` 는 사용자 가시 문자열이 아닌 내부 postMessage 프로토콜 식별자이므로 Principle 1 적용 외.
- **상세**: 프로토콜 식별자는 dict 경유 대상이 아님. 위반 없음.
- **제안**: 현행 유지.

---

## 요약

정식 규약(`spec/conventions/**`, `.claude/docs/plan-lifecycle.md`) 관점에서 대상 변경(plan 문서 + diff)은 전반적으로 규약을 잘 준수하고 있다. Plan frontmatter 3필수 필드(`worktree`·`started`·`owner`)가 모두 충족됐고, i18n Principle 2(ko/en parity)가 준수됐으며, 상수·타입 명명도 기존 관례와 일치한다. `spec_impact` 가 in-progress 단계에 미리 선언된 점은 Gate C 완료 시점 재확인으로 충분하며 즉각 차단 사항이 아니다. CRITICAL 또는 WARNING 등급 위반은 없고 INFO 6건은 모두 사소한 형식 제안 또는 확인 메모 수준이다.

## 위험도

NONE
