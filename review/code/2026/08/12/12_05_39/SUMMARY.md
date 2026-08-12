# Code Review 통합 보고서

## 전체 위험도
**LOW** — backend lint `no-unsafe-*` warning 46→0 처분(타입 주석/제네릭/단언 추가) + `package.json` `--max-warnings 0` 게이트 도입. 9개 reviewer 전원(강제 화이트리스트 8명 전원 결과 확보 포함) 실행 완료, CRITICAL 없음. WARNING 2건 — (1) `idempotency.interceptor.ts` 의 신규 방어 가드(`HttpResponseLike`)를 실제로 검증하는 테스트가 없음, (2) `--max-warnings 0` 도입으로 backend `lint` 스크립트가 "report-only"에서 "warning 게이팅"으로 바뀌었는데 `README.md` 설명이 갱신되지 않아 사실과 반대되는 문서로 남음. 로직 변경은 전무함(emit 바이트 비교로 6/8 파일 완전 동일, 나머지 2파일은 여분 괄호 한 쌍 차이만 확인됨).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `idempotency.interceptor.ts` 가 이번 diff 로 신설한 `HttpResponseLike` 방어 가드(`typeof res.status`/`res.statusCode` 체크)와 그 존재 이유를 검증하는 테스트가 없다. 기존 4개 테스트 전부 캐시 미스 경로만 돌고, 캐시 히트 재생·409 충돌·4xx 캐시 제외·손상 JSON fallback·`statusCode` 기본값 fallback 어느 것도 실행되지 않는다. 유일한 mock 은 항상 `status`(함수)+`statusCode`(number)를 갖춘 형태라 가드가 지키려는 "형태 없는 응답" 시나리오 자체를 재현하지 않는다 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37,105,128-131` | 캐시 히트 재생/409 충돌/4xx 캐시 제외 테스트 3건 추가 + `status`/`statusCode` 없는 빈 `res` mock 으로 `typeof` 가드 회귀 고정 1건 추가 |
| 2 | documentation | `package.json` 의 `lint` 스크립트에 `--max-warnings 0` 을 추가해 동작이 "report-only(warning 만으로는 exit 0)"에서 "warning 1건도 exit 1"로 바뀌었는데, 정확히 이 지점에 대해 과거 리뷰가 의도적으로 심어 둔 `README.md` 의 "report-only" 문구가 갱신되지 않아 이제 실제 동작과 반대되는 설명이 됨 | `codebase/backend/README.md:19` (변경 소스: `codebase/backend/package.json:20`) | README 스크립트 표의 `lint` 행을 "warning 도 게이트 실패(`--max-warnings 0`)"로 갱신 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `chat-channel.dispatcher.ts` 의 `logFn`(`debug`/`warn` 선택 삼항식)이 `.handle()` 경유 스펙에서는 도달 불가 — standalone 함수 테스트만 존재 | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:192-201` | `.handle()` 호출로 debug/warn 각 분기를 태우는 테스트 2건 추가 |
| 2 | testing | `executions.service.ts` 의 `snapshotCache` evict(LRU 유사, 256건 한도) 로직에 대한 테스트가 전무 | `codebase/backend/src/modules/executions/executions.service.ts:192-199` | 경계값(256회 삽입) 테스트로 evict 1건·최오래된 키 삭제 확인 |
| 3 | security/requirement | `execution-engine.service.ts` admission-control `m.query<{id:string}[]>()` 결과가 런타임 미검증(`Array.isArray` 없음) — 실패 시 fail-closed(admission 거부)이며 이미 plan 문서에 하드닝 제안이 유예 기록됨. 신규 위험 아님 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2911` | 후속 세션에서 다른 `.query<T>()` 호출부와 일관되게 `Array.isArray` 가드 추가 검토 |
| 4 | architecture | `ExecutionContext.getResponse<T>()` 타입 좁히기 스타일이 저장소 내 3갈래(전체 `Response`/익명 구조체/named `HttpResponseLike`)로 갈림 — 이번 diff 가 세 번째 변형을 추가. 기존에도 비일관 존재, 이번 diff 결함 아님 | `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:34-37` 외 `http-exception.filter.ts:44`, `logging.interceptor.ts:54` | 다음에 이 자리를 건드릴 때 공유 위치로 패턴 통일 고려 |
| 5 | architecture/maintainability | `migrate-node-output-refs.ts` 의 정규식 pass 6곳이 동일한 콜백 타입 시그니처를 반복 — 1회성 스크립트라 강제 리팩터 사유 아님, 이전 라운드에서도 동일 판정 | `codebase/backend/src/scripts/migrate-node-output-refs.ts:247-252,292-297,312-317,332-337,437-442,487-492` | pass 수가 유의미하게 늘면 `{pattern, replacer}[]` 데이터 구조로 승격 검토 |
| 6 | maintainability | `Array.isArray` → `any[]` 좁힘을 설명하는 동일 주석이 2개 파일에 반복 | `ai-agent.schema.ts:645`, `render-tool-provider.ts:376-377` | 3번째 파일에 등장 시 공용 유틸/린트 설정 검토 |
| 7 | side_effect | `package.json` `lint` 게이트가 "정보성→게이팅"으로 바뀌며 로컬 stale `node_modules` drift(과거 실측: 존재하지 않는 `prettier/prettier` 119건 유발)에 더 민감해짐 — 이미 plan 문서에 기록된 기존 위험의 노출 빈도만 증가 | `codebase/backend/package.json:20` | 조치 불요(문서화됨), CI 는 clean install 이라 영향 없음 |
| 8 | scope | `migrate-node-output-refs.spec.ts` 에 "타입 주석만" 이라는 선언 범위를 넘는 신규 테스트 케이스(Pass 2)가 추가됨 — 다만 `RESOLUTION.md` 에 실측(뮤테이션 판별력 확인)과 함께 명시적으로 disclosure 됨 | `codebase/backend/src/scripts/migrate-node-output-refs.spec.ts:56-67` | 조치 불요 |
| 9 | scope | 직전 리뷰 세션(`11_06_12`) 산출물 10개 파일(~837줄)이 이번 브랜치 누적 diff 에 코드 diff(~190줄)의 4배 이상 크기로 함께 보임 — 별도 커밋으로 분리돼 있고 저장소 표준 워크플로(리뷰 산출물 커밋)에 부합 | `review/code/2026/08/12/11_06_12/*` | 조치 불요 |
| 10 | security | `workspace-reflection-canary.ts` 의 `as object` 제거 — `handlerConsumesWorkspaceId(cls, handler)` 첫 인자가 `object`이고 `cls` 는 이미 `Function` 으로 좁혀져 있어 구조적으로 안전. cross-tenant 캐너리(`#1103`)에 영향 없음 확인 | `workspace-reflection-canary.ts:89`, `workspace.decorator.ts:66` | 조치 불요 |
| 11 | dependency | 신규 외부 패키지 추가/버전 변경 없음. 유일한 import 변경(`triggers.service.ts` 의 `SetupResult`)도 기존 내부 export 소비일 뿐 | `codebase/backend/src/modules/triggers/triggers.service.ts:31` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 인젝션/시크릿/인증우회 없음. admission-control 미검증 shape 은 fail-closed·기존 유예 항목 재확인 |
| architecture | NONE | 순수 타입 강화, 구조 퇴행 없음. `getResponse<T>` 스타일 3갈래·migrate pass 반복은 INFO |
| requirement | NONE | eslint/tsc/jest/emit 전수 독립 재측정, 커밋·plan 수치 전부 정확히 일치 |
| scope | LOW | Pass2 테스트 확장(disclosed)·이전 리뷰 산출물 번들, 둘 다 INFO |
| side_effect | NONE | emit md5 동일(6/8) + 괄호만 차이(2/8) 직접 확인, 함수 시그니처/공개 인터페이스 불변 |
| maintainability | NONE | `HttpResponseLike` 기존 `*Like` 컨벤션 부합, 주석 반복 경미 |
| testing | LOW | `idempotency.interceptor.ts` 테스트 공백(WARNING), dispatcher/executions 커버리지 공백(INFO) |
| documentation | LOW | README `lint` 스크립트 설명이 `--max-warnings 0` 도입 후 사실과 반대(WARNING) |
| dependency | NONE | 의존성 표면 변경 없음 |

## 발견 없는 에이전트

없음 (전 에이전트가 최소 1건 이상의 INFO 이상 항목을 보고함).

## 권장 조치사항
1. `idempotency.interceptor.ts` — 캐시 히트 재생/409 충돌/4xx 캐시 제외 테스트 3건 + `status`/`statusCode` 없는 mock 회귀 테스트 1건 추가 (WARNING #1).
2. `codebase/backend/README.md:19` 의 `lint` 스크립트 설명을 "report-only" 에서 "warning 도 게이트 실패(`--max-warnings 0`)"로 갱신 (WARNING #2).
3. (선택) `chat-channel.dispatcher.ts` logFn 분기·`executions.service.ts` snapshotCache evict 에 대한 테스트 공백을 후속 세션에서 메울 것 (INFO #1, #2).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency (9명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — 전원 결과 확보됨
  - **제외**: 아래 표 (5명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(구체 사유 미제공 — 이번 델타가 타입 주석뿐이라 런타임 성능 영향 없음으로 추정 배제) |
  | database | router 판단(구체 사유 미제공 — DB 스키마/쿼리 로직 변경 없음으로 추정 배제) |
  | concurrency | router 판단(구체 사유 미제공 — 동시성 제어 로직 변경 없음으로 추정 배제) |
  | api_contract | router 판단(구체 사유 미제공 — 공개 API 시그니처 변경 없음으로 추정 배제) |
  | user_guide_sync | router 판단(구체 사유 미제공 — 사용자 가이드 대상 변경 없음으로 추정 배제) |
