# 유저 가이드 동반 갱신(User Guide Sync) Review

## 발견사항

해당 없음 — 변경 set(23 파일) 의 어떤 파일도 동반 갱신 매트릭스의 trigger 에 매칭되지 않는다.

검토 근거 (매트릭스 18개 trigger 대조):

- **new-node / node-schema-change (`codebase/backend/src/nodes/**`)**: 변경된 backend 파일은 `common/services/s3.service.ts`, `modules/dashboard`, `modules/execution-engine`, `modules/knowledge-base`, `modules/workflow-assistant/prompts`, `modules/workflows` 뿐 — `nodes/**` 경로 변경 0건. 노드 신규/스키마 변경 없음.
- **new-ui-string (`frontend/src/**/*.tsx`, semantic)**: 변경된 TSX 는 파일 16 `run-results-drawer.tsx`, 파일 17 `transform/preview.tsx` 2건. 둘 다 신규 한국어 리터럴 없이 **기존 i18n 키만 사용** (`t("nodeConfigs.preview...")` 등) 하는 순수 리팩터다 — `selectSortedNodeResults` 정렬 accessor 도입에 한정. i18n parity 영향 없음. ko/en dict 동반 갱신 불요.
- **new-warning-code / new-error-code**: 파일 8 `knowledge-base.service.ts` 가 `logger.warn(...)` 를 추가하나, 이는 **서버 내부 로그 문자열**이지 사용자 가시 `warningRules` warningCode 발행이 아니다 (`backend-labels.ts` 의 `WARNING_KO` 매핑 surface 아님). `error-codes.ts` (`ErrorCode` enum) 변경 0건.
- **expression-language-change (`packages/expression-engine/**`)**: 해당 패키지 변경 0건. 파일 15 `use-expression-context.ts` 는 expression-engine 에서 import 만 하는 frontend 소비처이며, 표현식 언어 문법/함수/연산자 변경이 아니라 정렬 accessor 전환이다. `04-expression-language/` 갱신 불요.
- **auth-session-flow-change (`modules/auth/**`)**: 변경 0건.
- **integration-provider-change / new-backend-ui-zod-value / new-handler-output-field / run-debug-flow-change**: 통합 provider, backend zod ui.label, handler output.result.* 신규 키, 디버그 UI 흐름 변경 모두 없음. dashboard/execution-engine 변경은 동일 의미론을 보존하는 쿼리 통합·배치 조회 perf 리팩터로, 사용자 가시 표면(필드·라벨·출력 형태) 불변.
- **new-userguide-section-dir / userguide-gui-flow-section (`content/docs/**`)**: docs MDX 변경 0건.
- **spec-major-change (`spec/**`)**: spec 파일 직접 변경 0건. 파일 23 `spec-update-perf-backlog-01.md` 는 `plan/` 하위 draft 이며 spec 본문이 아니다 — developer 가 spec read-only 규약에 맞게 planner 위임 draft 를 남긴 정상 처리.

참고 (회색지대, 위험도 미반영): 파일 23 의 spec-update draft 와 파일 22 plan 메모는 `spec/data-flow/4-file-storage.md` (KB 삭제 S3 정리 문구) 및 `spec/5-system/4-execution-engine.md §1.6` (env read-once 문구) 의 후속 동기화를 이미 명시적으로 추적 중이다. 이 두 spec 문서는 **유저 가이드(docs MDX)·i18n·backend-labels 매트릭스 대상이 아니라** spec 본문 영역이므로 본 reviewer 관점에서는 누락이 아니다 (planner 트랙으로 정상 위임됨).

## 요약

유저 가이드 동반 갱신 관점에서 평가 가능한 누락은 없다. 매트릭스 18개 trigger 중 변경 set 에 매칭된 trigger 0개, 누락 0건. 이번 변경은 전부 backend perf 리팩터(s3 배치 삭제, dashboard 집계 2쿼리, execution-engine rehydration 배치, KB 배치 삭제)와 그에 정렬 의미를 맞춘 frontend store/소비처 리팩터로, 사용자 가시 노드·필드·라벨·문서·에러/경고 코드·i18n 문자열 표면을 변경하지 않는다. 신규 TSX 변경 2건도 기존 i18n 키만 재사용해 ko/en parity 영향이 없다.

## 위험도

NONE
