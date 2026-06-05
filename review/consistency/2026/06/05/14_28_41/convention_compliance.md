# Convention Compliance — memory-autoinject-extend

**검토 범위**: `git diff 9e65f853..HEAD`
**검토 시각**: 2026-06-05 14:28
**검토 관점**: spec/conventions/** 준수

---

## CRITICAL

없음.

---

## WARNING

### W1 — `spec/conventions/chat-channel-adapter.md` 분류표에서 `EXECUTION_TIME_LIMIT_EXCEEDED` 제거됨, 구현 코드에서도 제거됨, 그러나 `spec/5-system/3-error-handling.md` 와 `spec/1-data-model.md` 는 여전히 해당 코드를 등재함
- **target 위치**: `spec/conventions/chat-channel-adapter.md` §분류표 변경 행 (`EXECUTION_TIMEOUT (engine) · CODE_TIMEOUT`). `codebase/backend/src/nodes/core/error-codes.ts` (`EXECUTION_TIME_LIMIT_EXCEEDED` 삭제). `spec/5-system/3-error-handling.md §1.4` (변경 후에도 해당 행 유지). `spec/1-data-model.md §Execution error 컬럼` (변경 후에도 해당 코드 참조 유지).
- **위반 규약**: `spec/conventions/error-codes.md §1` — 에러 코드 단일 진실 카탈로그. `spec/conventions/chat-channel-adapter.md §CCH-ERR` — 분류표가 chat-channel 어댑터 failedTimeout/failedInternal 분기 SoT.
- **상세**: 이번 diff 가 `EXECUTION_TIME_LIMIT_EXCEEDED` 를 `error-codes.ts` 에서 삭제하고 chat-channel-adapter 분류표에서도 제거했다. 그러나 `spec/5-system/3-error-handling.md §1.4` 표는 해당 코드를 "엔진 레벨 누적 active-running 시간 초과"로 여전히 정의하고, `spec/1-data-model.md §Execution error 컬럼` 설명도 해당 코드를 참조한다. 세 위치 — chat-channel-adapter 분류표·error-codes.ts ("없음"), error-handling §1.4·data-model ("있음") — 가 서로 모순된다. 다운스트림 소비자가 `3-error-handling.md` 를 SoT 로 보고 이 코드를 기대할 경우 런타임에서 undefined 분기가 발생할 수 있다.
- **제안**: `EXECUTION_TIME_LIMIT_EXCEEDED` 제거가 의도라면 `spec/5-system/3-error-handling.md §1.4` 와 `spec/1-data-model.md §Execution 표 error 컬럼` 에서도 해당 참조를 제거 또는 "Planned" 표기로 변경해야 한다. 제거가 의도가 아니라면 `error-codes.ts` 와 chat-channel-adapter 분류표의 변경을 취소해야 한다.

### W2 — `spec/conventions/conversation-thread.md §8.4` Rationale 섹션이 번복 근거 없이 삭제됨
- **target 위치**: `spec/conventions/conversation-thread.md §8.4` (이번 diff 에서 완전 삭제됨). `spec/conventions/conversation-thread.md §4 영속화 표` (park 스냅샷 행 제거됨). `spec/conventions/conversation-thread.md §7 v2 로드맵` ("`DB 컬럼 신설` 채택 완료" 취소선 → 미완 항목으로 되돌려짐).
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 번복 시에도 근거를 Rationale 에 남겨야 한다.
- **상세**: §8.4 는 `Execution.conversation_thread jsonb NULL` 컬럼 채택의 근거를 기록한 Rationale 하위 섹션이었다. 이번 diff 가 해당 컬럼을 "신규 DB 컬럼 없음"으로 번복하면서 §8.4 자체를 흔적 없이 삭제했다. 현재 `§8 Rationale` 에는 이 번복의 근거가 전혀 남아 있지 않아, 미래 독자가 "왜 이전 PR이 컬럼을 채택했다가 번복됐는지" 알 수 없다.
- **제안**: `spec/conventions/conversation-thread.md §8` 하위에 "§8.4 v1 DB 컬럼 없음 — 이전 durable park resume 채택을 번복한 근거" 항목을 추가하거나, `spec/4-nodes/3-ai/1-ai-agent.md §12.13` 에 번복 근거를 기술하고 §8.4 삭제 대신 참조 링크로 대체할 것.

### W3 — `spec/conventions/error-codes.md §3 Known Exception 표`에서 `invitation_*` lower_snake_case 행이 이유 없이 삭제됨
- **target 위치**: `spec/conventions/error-codes.md §3` 표 (이번 diff 에서 `invitation_not_found` 등 6개 lower_snake_case historical exception 행 삭제).
- **위반 규약**: `spec/conventions/error-codes.md §2` — 에러 코드 rename/제거는 breaking change이며 정책 기록이 필요하다. CLAUDE.md §Rationale 기록 의무.
- **상세**: 삭제된 행은 현재도 구현 코드(`workspace-invitations.service.ts`, `auth.service.ts`, 프론트엔드 `INVITATION_ERROR_CODES`)에서 사용 중인 historical artifact 코드들이다. 이 테이블은 "UPPER_SNAKE_CASE 규약 §1을 위반하는 예외 코드"의 관리 목록으로, 삭제가 "이제 더 이상 예외로 관리할 필요 없음(rename 완료)"을 의미하는지, 아니면 단순 누락인지 불명확하다. 이번 diff 의 작업 범위(memory autoinject)와도 무관한 변경이다.
- **제안**: 이 행의 삭제가 의도된 변경인지 확인. 실수라면 복원. 의도된 변경이라면 Rationale 에 근거 명시(rename 완료 또는 코드 폐기 사실).

---

## INFO

### I1 — `spec/conventions/conversation-thread.md §4 영속화 표` — "실행 중" 행 설명에 Redis 구현 세부 노출
- **target 위치**: `spec/conventions/conversation-thread.md §4` 표 "실행 중" 행 (변경 후: "Redis 포함 직렬화").
- **위반 규약**: 직접 위반 없음. conventions 문서는 invariant 를 정의하고 구현 세부는 `spec/5-system/` 에 두는 관행.
- **상세**: "ExecutionContext (실행 엔진 §6.2 정책에 따라 Redis 포함 직렬화)" 는 구현 세부를 conventions 에 노출한다. 이전 문구 "ExecutionContext (실행 엔진 §6.2)"에 비해 구현 레이어 정보가 추가됐다.
- **제안**: "ExecutionContext (실행 엔진 §6.2)" 로 유지하고 TTL 등 구현 세부는 §6.2 링크로 위임하는 것이 conventions 레이어 추상화에 부합. 선택적 개선.

### I2 — `spec/4-nodes/3-ai/1-ai-agent.md §12.12` — scope-freeze 재확인 Rationale 에 번복 맥락 누락
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §12.12`.
- **위반 규약**: CLAUDE.md — Rationale 섹션은 결정의 배경·근거를 보존해야 한다. 직접 위반은 아님.
- **상세**: §12.12 는 PR #467 에서 `summaryModel`/`extractionModel` 을 "도입"했다가, 이번 PR 에서 "번복(scope-freeze 재확인)"으로 재작성됐다. 현재 §12.12 는 처음부터 scope-freeze 를 결정한 것처럼 서술해 PR #467 의 도입 결정이 왜 번복됐는지 근거가 없다. `conversation-thread §7 v2 로드맵`의 해당 항목도 "채택 완료(취소선)" 에서 미완 항목으로 조용히 되돌려졌다.
- **제안**: §12.12 에 "PR #467 이 두 필드를 일시 도입했으나 이번 PR 에서 번복한 근거" 1–2 문장 추가.

### I3 — 삭제된 plan 파일(`agent-memory-summary-model.md` 등)이 `plan/complete/` 로 이동되지 않고 단순 삭제됨
- **target 위치**: `plan/in-progress/agent-memory-summary-model.md`, `plan/in-progress/agent-memory-admin-ui.md`, `plan/in-progress/exec-park-durable-resume.md` (이번 diff 에서 git delete).
- **위반 규약**: `.claude/docs/plan-lifecycle.md` — 완료된 plan 은 `plan/complete/` 로 이동. 취소라면 삭제 가능하나 커밋 메시지에 명시.
- **상세**: 세 파일 모두 `plan/in-progress/` 에서 삭제됐으나 `plan/complete/` 로의 이동 커밋이 이번 diff 에서 확인되지 않는다. 완료(complete)인지 취소(cancel)인지 이력이 소실될 수 있다.
- **제안**: 완료라면 `plan/complete/` 로 이동 (plan-lifecycle.md §이동 규칙). 취소라면 현재 단순 삭제로 충분하지만 커밋 메시지에 "취소(cancelled)" 사유 명시.

### I4 — `spec/conventions/node-output.md §4.2.1` `_resumeCheckpoint` 설명에서 `schemaVersion` invariant 제거
- **target 위치**: `spec/conventions/node-output.md §4.2.1` (변경 후: `schemaVersion` 언급 삭제).
- **위반 규약**: 직접 위반 없음. conventions 변경은 invariant 의도적 철회인지 오탈인지 불명확.
- **상세**: 이전 문구에 "스키마 진화 대비 `schemaVersion`(정수) 을 동봉하며, 재개 시 그 값이 현재 코드 지원 버전을 초과하면 graceful reset" invariant 가 있었다. 이번 diff 가 이를 제거했다. 구현 코드가 `schemaVersion` 를 실제 사용하는지 여부와 이 invariant 의 철회 여부가 불명확하다.
- **제안**: `schemaVersion` invariant 철회가 의도라면 Rationale 에 한 줄 추가. 아니라면 문구 복원.

---

## 요약

이번 diff 는 `summaryModel`/`extractionModel` 도입(PR #467) 번복, `exec-park-durable-resume` 계획 취소(`Execution.conversation_thread` DB 컬럼 미도입 방침 재확인), `agent-memory-admin-ui` 작업 완료 정리를 반영한다. `contextScope` 5필드(`contextScope`, `contextScopeN`, `contextInjectionMode`, `includeToolTurns`, `excludeFromConversationThread`)와 `meta.contextInjection` 출력 포맷(`{ appliedScope, appliedMode, injectedTurns, droppedTurns, totalInjectedChars }`)은 변경 전후 모두 `spec/conventions/conversation-thread.md §5` 및 `spec/conventions/node-output.md §2` 와 일관성을 유지하므로 이 두 항목은 이상 없다. 공유 유틸 파일 명명(`agent-memory-injection.ts`, `agent-memory-extraction.processor.ts`)도 기존 NestJS module-name 규약과 일치한다. 주요 문제는 세 곳: W1 — `EXECUTION_TIME_LIMIT_EXCEEDED` 를 chat-channel-adapter 와 error-codes.ts 에서 제거했으나 `3-error-handling.md`·`1-data-model.md` 가 여전히 등재해 conventions SoT 간 불일치; W2 — conversation_thread DB 컬럼 번복 시 §8.4 Rationale 삭제로 CLAUDE.md 요구 근거 문서화 누락; W3 — error-codes.md Known Exception 표에서 `invitation_*` 행이 이유 없이 제거됨.

---

## 위험도

MEDIUM

---

BLOCK: NO
