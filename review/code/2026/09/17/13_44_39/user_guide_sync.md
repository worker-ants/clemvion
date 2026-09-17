# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` 의 `rows[]` (21행) 를 Read 했고, `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (line 155~) 을 보조로 확인했다.

## 변경 파일 컨텍스트
- `CHANGELOG.md`
- `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` (테스트 유틸)
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (unit 테스트)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (서비스 로직)
- `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` (e2e)
- `plan/in-progress/trigger-save-partial-patch.md` (plan)
- `review/consistency/2026/09/17/13_04_39/**` (일관성 검토 산출물, 문서 아님)

## trigger 매칭 분석

1. **new-node / node-schema-change** — glob `codebase/backend/src/nodes/**`. 변경 파일은 전부 `codebase/backend/src/modules/triggers/**` 아래이며 `src/nodes/` 를 건드리지 않는다. **불일치**.
2. **backend-api-change** — trigger glob 이 `*.controller.ts` 또는 `dto/**` 로 한정된다. 변경된 `triggers.service.ts` 는 서비스 계층이며 controller/DTO 파일이 아니다. 요청/응답 스키마(필드 구성)도 바뀌지 않았다 — 이번 수정은 `PATCH /api/triggers/:id` 가 **락 밖에서 이미 커밋된 컬럼을 옛 값으로 되돌리던 lost-update 버그**를 고친 것으로, API 계약(필드 집합·타입)은 그대로다. **불일치**.
3. **auth-session-flow-change** — glob `codebase/backend/src/modules/auth/**`. 이번 변경은 트리거 저장 동시성(advisory lock 안에서의 부분 객체 `save`) 문제이며 인증·권한·세션 미들웨어와 무관하다. **불일치**.
4. **expression-language-change** — `codebase/packages/expression-engine/**` 미변경. **불일치**.
5. **run-debug-flow-change** (semantic, glob 없음) — "실행·디버깅 흐름" 은 워크플로 실행 엔진·디버그 로깅(05-run-and-debug 섹션 대상)을 가리킨다. 이번 변경은 트리거 설정 PATCH 시 DB 저장 방식(TypeORM `save` 의 컬럼 비교 시맨틱) 수정으로, 워크플로 실행/디버깅 흐름과는 다른 관심사다. **불일치**.
6. **integration-provider-change / new-warning-code / new-error-code / new-cross-cutting-enum / new-backend-ui-zod-value / new-handler-output-field / auth-config-type-enum-change** — 모두 신규 provider, 신규 warningCode/errorCode, 신규 enum, 신규 zod ui 라벨, 신규 output 필드 도입을 조건으로 하나, 이번 diff 에는 해당 산출물이 전혀 없다(순수 버그 수정 + 테스트 보강). **불일치**.
7. **new-ui-string / new-userguide-section-dir / new-widget-chrome-string** — frontend TSX·docs 디렉토리 변경 없음(전부 backend + 테스트 + plan/changelog). **불일치**.
8. **spec-major-change** — `spec/2-*~5-*` glob 미해당(`spec/` 변경 없음, plan 문서만 변경). **불일치**.

CHANGELOG.md·plan 문서 갱신은 이 자체가 매트릭스의 "동반 갱신 대상"이 아니라 개발 관례상의 기록이며, 매트릭스 어느 행에도 이를 트리거로 규정하지 않는다.

## 발견사항

없음. 매칭되는 trigger 가 없다.

## 요약

이번 변경 set(매트릭스 21개 trigger 전수 확인)은 `TriggersService.update()` 의 TypeORM `save` lost-update 버그를 고치는 순수 backend 서비스 계층 수정 + 관련 unit/e2e 테스트 + CHANGELOG/plan 기록으로, controller/DTO·노드 정의·UI 문자열·warning/error code·auth 모듈·expression-engine·문서 섹션 디렉토리 등 어떤 trigger glob/semantic 조건에도 매칭되지 않는다. 매칭 0건, 누락 0건 — 유저 가이드 동반 갱신 관점에서 해당 없음.

## 위험도
NONE
