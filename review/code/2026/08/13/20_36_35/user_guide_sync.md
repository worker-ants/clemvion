# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (rows[] 21행) Read 완료
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 21행 + "자주 누락되는 항목" prose) Read 완료

## 변경 파일 목록 (prompt 제공 6개)
1. `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
2. `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
3. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (수정 — 테스트 추가)
4. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (수정)
5. `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (수정)
6. `plan/in-progress/update-returning-tuple-shape.md` (신규 plan 문서)

## 매칭 분석

변경 내용은 TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE` RETURNING 에 대해 `[rows, rowCount]` 튜플을 돌려주는데, 기존 코드 7곳이 이를 행 배열로 오인해 `.length`/`.map` 을 잘못 적용하던 결함을 `updateReturningRows()` 헬퍼로 통일 수정한 것이다 (admission gate, `updateExecutionStatus` 종결 이벤트, KB CAS 락 2곳, KB 임베딩/그래프 재큐, KB reset). 모두 내부 정합성 버그 수정이며 새 기능·새 필드·새 문자열·새 코드는 없다.

매트릭스 21행을 전수 대조:

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 변경 경로는 `common/utils/`, `modules/execution-engine/`, `modules/knowledge-base/` 이며 `src/nodes/**` 밖. 미매칭.
- **new-ui-string** (`*.tsx`) — 변경 파일 전부 `.ts`/`.md`. 미매칭.
- **new-widget-chrome-string** (`channel-web-chat/**/*.tsx`) — 미매칭.
- **integration-provider-change** — 신규/변경 provider 없음. 미매칭.
- **new-userguide-section-dir** — `content/docs/` 변경 없음. 미매칭.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 컨트롤러·DTO 변경 없음. 미매칭.
- **new-bullmq-queue** — `system-status.constants.ts` 변경 없음, 신규 `@Processor` 없음. 미매칭.
- **new-warning-code / new-error-code** — 확인: `KB_REEXTRACT_IN_PROGRESS`·`KB_REEMBED_IN_PROGRESS` 는 diff 이전부터 존재하는 기존 코드로, 이번 diff 는 `if (acquired.length === 0)` → `if (updateReturningRows(acquired).length === 0)` 로 조건식만 감쌌을 뿐 에러 코드 문자열 자체는 변경하지 않았다. `error-codes.ts` 변경 없음. 미매칭.
- **new-cross-cutting enum / new-backend-ui-zod-value / new-handler-output-field** — 해당 패턴 없음. 미매칭.
- **auth-session-flow-change** (`modules/auth/**`) — 변경 경로 아님. 미매칭.
- **auth-config-type-enum-change / expression-language-change** (`packages/expression-engine/**`) — 미매칭.
- **run-debug-flow-change** (semantic, `05-run-and-debug/` 대상) — 검토: `execution-engine.service.ts` 변경이 admission/실행 흐름에 해당하나, 내용 확인 결과 (a) `codebase/frontend/src/content/docs/05-run-and-debug/*.mdx` 에는 워크스페이스/워크플로 레벨 admission 동시성 큐잉·defer 동작에 대한 서술이 전혀 없음 (`running-a-workflow.mdx` 에 대기/큐 관련 언급 부재 — grep 결과 무관 문구 1건만 매치) (b) `validation-errors.mdx` §"동시 실행 수 한도 초과" 는 **Parallel 노드 branch fan-out 한도(32)** 얘기로, 이번에 고친 워크스페이스/워크플로 동시 실행 cap(`admitExecutionOrDefer`)과는 다른 개념. (c) 이번 수정은 새 사용자 가시 상태·타이밍 계약을 추가하는 게 아니라, **버그 경로(잘못된 admission 실패→우회 재구동)를 의도된 정상 경로로 되돌리는 내부 정합성 수정**이며 최종 사용자 관측 결과(실행 완료 상태)는 이미 문서화된 대로 동일하게 유지된다(§7.5 rehydration 우회가 아니라 정상 admission 경로를 타게 됨). 사용자 가이드에 서술할 신규/변경된 관측 가능 동작이 없어 **회색지대이나 갱신 불요로 판단** (INFO 수준 — 매칭 아님으로 최종 처리).
- **env-runtime-change / spec-major-change / userguide-gui-flow-section / spec-defect-found** — 해당 없음.

`plan/in-progress/update-returning-tuple-shape.md` 는 plan 산출물 자체이며 매트릭스 target 이 아니라 이 변경 set 을 설명하는 문서 — 별도 동반 갱신 대상이 아니다.

## 발견사항

없음.

## 요약

매트릭스 21행 전수 대조 결과, 이번 변경 set(6개 파일)은 `codebase/backend/src/common/utils/` · `modules/execution-engine/` · `modules/knowledge-base/` 의 TypeORM UPDATE/DELETE RETURNING 튜플-오인 버그를 헬퍼(`updateReturningRows`)로 통일 수정한 내부 정합성 패치로, 신규 노드·스키마 변경·신규 UI 문자열·신규 provider·신규 docs 섹션·auth 흐름·표현식 언어·신규 warning/error 코드 등 어떤 trigger 에도 매칭되지 않는다. "실행·디버깅 흐름 변경"(semantic) 행이 가장 근접했으나 `05-run-and-debug/` 문서가 다루는 사용자 가시 동작(Parallel 분기 동시성 한도 등)과는 별개의 내부 admission 정합성 버그 수정이라 문서 갱신 불요로 판정했다. 유저 가이드 동반 갱신 관점에서 누락 0건.

## 위험도

NONE
