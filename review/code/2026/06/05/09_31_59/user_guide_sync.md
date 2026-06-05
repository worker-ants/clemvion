# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` — 18개 rows 적재. 변경 파일 목록은 `git diff main...HEAD --name-only` 로 확인.

## 변경 파일 목록

- `codebase/backend/migrations/V083__execution_conversation_thread.sql` (신규)
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts`
- `codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `codebase/backend/src/modules/executions/entities/execution.entity.ts`
- `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts`
- `codebase/backend/src/shared/conversation-thread/conversation-thread.types.spec.ts`
- `spec/` 4개 파일 (spec 동기 갱신 — 별도 trigger)
- `plan/`, `review/` 파일들

## trigger 매칭 결과

| trigger id | 판정 | 근거 |
|---|---|---|
| `new-node` | 불일치 | `codebase/backend/src/nodes/**` 하위 변경 없음 |
| `node-schema-change` | 불일치 | 노드 schema 변경 없음 |
| `new-ui-string` | 불일치 | frontend TSX 변경 없음 |
| `integration-provider-change` | 불일치 | provider 변경 없음 |
| `new-userguide-section-dir` | 불일치 | docs 디렉토리 신규 없음 |
| `new-warning-code` | 불일치 | warningRules 변경 없음 |
| `new-error-code` | 불일치 | `error-codes.ts` 변경 없음 |
| `new-cross-cutting-enum` | 불일치 | enum 추가 없음 |
| `new-backend-ui-zod-value` | 불일치 | zod ui label 변경 없음 |
| `new-handler-output-field` | 불일치 | handler output 구조 변경 없음 |
| `auth-session-flow-change` | 불일치 | auth 모듈 변경 없음 |
| `expression-language-change` | 불일치 | expression-engine 변경 없음 |
| `run-debug-flow-change` | **회색지대(INFO)** | 아래 상세 참조 |
| `spec-major-change` | 일치 — 단 reviewer 영역 외 | spec 4개 파일 갱신됨 — spec frontmatter/code 정합은 spec-coverage 영역 |
| `env-runtime-change` | 불일치 | README.md 변경 없음 |

## 발견사항

### [INFO] 실행·디버깅 흐름 변경 — `05-run-and-debug/` 동반 갱신 여부

- 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `execution-context.service.ts`, `execution.entity.ts`, `V083__execution_conversation_thread.sql`
- 매트릭스 항목: `run-debug-flow-change` — "codebase/frontend/src/content/docs/05-run-and-debug/"
- 누락된 동반 갱신: `codebase/frontend/src/content/docs/05-run-and-debug/` 내 어떤 파일도 변경 set 에 포함 안 됨
- 상세:
  - 본 PR 은 `waiting_for_input` park 시 `ExecutionContext.conversationThread` 전체를 DB 에 durable commit 하고, rehydration 시 무손실 복원하는 내부 실행 엔진 변경이다.
  - `05-run-and-debug/` 문서는 현재 이 durability 보장을 언급하지 않는다. 단, 존재하는 어떤 doc 문장도 이 변경으로 인해 틀린 내용이 되지는 않는다 — form/button 노드의 `waiting_for_input` 재개 시 대화 맥락이 보존된다는 내용 자체가 기존 docs 에 없기 때문이다.
  - 주의: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` 와 `telegram.mdx` 의 §7.3 "session-expired key" 는 "Multi-turn conversation cannot be resumed (instance restart / session expired)" 를 기술하는데, PR-A1 이 `conversationThread` 를 복원하더라도 AI agent 의 `_resumeState` (in-memory 전용, WARN #6) 는 여전히 비영속 — commit message 에서 명시적으로 제외. 따라서 telegram sessionExpired 설명은 여전히 유효하며 stale 이 아니다.
  - 결론: 이 변경은 사용자가 직접 설정/사용 방식을 바꿀 필요가 없는 투명한 내부 버그픽스(spec drift I3 정합화)이다. 사용자 가이드 갱신 필요성은 낮다.
- 제안: 선택적 대응 — `05-run-and-debug/run-results.mdx` + `run-results.en.mdx` 에 "서버 재시작 후에도 form/button 입력 대기 중인 실행의 대화 맥락(conversationThread)이 보존됩니다" 를 한 줄 추가할 수 있으나, 사용자 행동을 바꾸지 않으므로 강제 요구사항은 아니다. 이 PR 의 범위를 초과하지 않도록 후속 작업에서 처리 가능.

## 요약

매트릭스 18개 trigger 중 glob 매칭 — 없음. semantic 매칭 — `run-debug-flow-change` 1건이 회색지대(INFO)로 식별됨. 변경 집합에 frontend docs/i18n/backend-labels 파일이 전혀 포함되지 않으나, 본 변경은 사용자 가이드 갱신을 강제하는 i18n parity 누락·신규 UI 문자열·신규 에러코드·신규 섹션 디렉토리 등 CRITICAL/WARNING 트리거에 해당하지 않는다. 변경은 실행 엔진 내부 durability 개선(spec drift 정합화)이며 기존 docs 내용을 틀리게 만들지 않는다.

## 위험도

NONE
