# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실질 코드 변경은 죽은 쿼리 파라미터(`QueryExecutionDto.workflowId`) 제거 하나뿐이고 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠) 부재를 8개 reviewer 전원이 교차실측으로 확인했다. 다만 이 제거가 만드는 breaking 동작(외부 클라이언트 200→400)을 고정하는 회귀 테스트가 없고, 같은 diff 가 갱신한 plan 트래커의 "종결 조건" 서술이 자체 모순으로 stale 해졌다 — 둘 다 LOW 수준이나 무시하지 말 것. forced 화이트리스트(7명) 전원 결과 확보됨, 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | API 계약 / 부작용 | `workflowId` 쿼리 필드 제거 + 전역 `forbidNonWhitelisted: true` 로 인해 이 파라미터를 보내던 클라이언트는 `200`(무시됨)에서 `400`으로 응답이 바뀌는 breaking change. 저장소 내부 소비자(서비스·프런트·e2e·OpenAPI 코드젠)는 없음을 실측 확인했으나 저장소 밖 제3자 클라이언트는 관측 범위 밖("관측 범위 미발견"이지 "부재 확인"은 아님) | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`, `codebase/backend/src/common/pipes/validation.pipe.ts:31` | 배포 노트/릴리즈 공지에 이 400 회귀 가능성을 한 줄 명시. 코드 변경은 불필요(이미 병합 가능 수준) |
| 2 | Testing | 위 breaking 동작(200→400)을 고정하는 자동화 테스트가 저장소 어디에도 없음 — `workflow-execution.e2e-spec.ts` 는 positive case(경로 파라미터)만 있고 `?workflowId=...` 쿼리를 실어 400 을 기대하는 negative case 가 없으며, `CustomValidationPipe` 자체도 whitelist 거부(`forbidNonWhitelisted`) 축을 검증하는 테스트가 없음 | `codebase/backend/test/workflow-execution.e2e-spec.ts:108`, `codebase/backend/src/common/pipes/validation.pipe.spec.ts` | `?workflowId=<uuid>` → 400(`VALIDATION_ERROR`)을 단언하는 negative e2e 케이스 추가, 또는 `CustomValidationPipe` whitelist 거부 유닛 테스트 추가 |
| 3 | Requirement / Plan 위생 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "종결 조건" 서술이 이 diff 로 즉시 stale — "현재 열려 있는 것은 **넷**"이라 하지만, 바로 아래 이 diff 가 갱신한 추적 표는 4행 중 2행만 미종결(`§5.4 drift 2단계`, `idx_schedule_next_run`)이고 `## 후속` 섹션의 미체크 항목 수도 정확히 2개로 일치 — 같은 섹션 안에서 숫자가 어긋남 | `plan/in-progress/spec-draft-nullable-notation-followups.md:368-370` (서술) vs `:372-377` (표, 이 diff 가 갱신) | "넷"→"둘"로 정정하거나, "열려 있는 것은" 대신 "추적 중인 항목은" 등으로 open/closed 혼동 없는 표현으로 변경 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope / 커버리지 | `swagger-dto-contract-guard.ts` 갱신된 JSDoc 이 언급하는 `[대조군] @Transform 예외` 픽스처(`swagger-dto-contract.spec.ts`) 변경 자체는 이번 리뷰 대상 4개 파일에 포함되지 않음 — 픽스처가 이미 일반화돼 있어 영향받지 않았거나 리뷰 배치 누락일 가능성 둘 다 있음(범위 초과 아님, 잠재적 누락) | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` | 해당 파일이 실제로 이번 변경분에 포함되는지 확인 |
| 2 | Maintainability | CHANGELOG 항목과 plan 트래커 항목이 동일한 실측 서술(`Api*` 필드 1,095개, `@Transform` 17개, null 축 불일치 0개)을 거의 그대로 중복 기재 — SoT 분리 관례상 의도된 이중기록으로 보이나 향후 수치 재변경 시 양쪽 동기화 부담 | `CHANGELOG.md:28-34`, `plan/in-progress/spec-draft-nullable-notation-followups.md:321-323` | 조치 불요, 참고만 |
| 3 | Documentation | 신규 JSDoc·CHANGELOG 가 spec 문서를 줄 번호로 고정 인용(`spec/2-navigation/14-execution-history.md:345`) — 현재는 정확하나 spec 문서가 향후 편집되면 드리프트 가능(저장소 전반의 기존 관례, 이 diff 만의 신규 결함 아님) | `query-execution.dto.ts:11`, `CHANGELOG.md:25` | 조치 불요(기존 관례 준수). 향후 앵커링 컨벤션 결정 시 일괄 정리 대상 |
| 4 | Maintainability | 클래스 JSDoc 에 날짜(2026-09-04)가 박힌 "제거 이력" 서술이 영구 주석으로 남음 — 저장소가 이미 널리 쓰는 패턴(예: `swagger-dto-contract-guard.ts` 자체)과 일관되어 이 diff 가 새로 만든 문제는 아님 | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` (클래스 JSDoc) | 조치 불요 — 컨벤션 일관성 참고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 코드 변경(죽은 UUID 쿼리 파라미터 제거)은 검증 로직과 함께 사라졌지만 원래 소비되지 않던 값이라 회귀 없음. 하드코딩 시크릿·인젝션·인증 우회 없음 |
| requirement | LOW | 핵심 변경은 기능적으로 완전·안전(전수 교차검증). plan 문서 "종결 조건" 서술이 같은 diff 가 갱신한 표·체크박스 수와 불일치(stale) |
| scope | NONE | 4개 파일 전부 "죽은 workflowId 쿼리 파라미터 제거"라는 단일 작업에 정확히 수렴, 요청 외 변경 없음. guard 픽스처 커버리지 확인 필요(INFO) |
| side_effect | LOW | 공개 REST 쿼리 파라미터 제거로 200→400 breaking change. 저장소 내부 소비자 부재 실측 확인, 제3자 클라이언트 리스크는 관측 범위 밖 |
| maintainability | NONE | 구조적 지표 영향 없는 소규모 변경, import 정리 모범적. 문서 간 서술 중복은 소소한 동기화 부담 |
| testing | LOW | 기존 회귀 테스트(DTO·서비스·컨트롤러·e2e·swagger 가드) 전부 GREEN. breaking 동작(200→400)을 고정하는 자동화 테스트 부재 |
| documentation | NONE | CHANGELOG·JSDoc·plan 네 곳 실측 수치 상호 일관, spec/프런트 소비자 부재 재확인 일치. 줄번호 인용 drift 위험만 존재(기존 관례) |
| api_contract | LOW | CHANGELOG 의 모든 정량 주장을 코드 실측으로 교차검증, 전부 일치. 명시적 breaking change 이나 문서화·완화 근거 충분, 버전 신호 권고만 |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 INFO 이상의 관찰을 남겼으며(대부분 "문제 없음/안전 확인" 판정 포함), 실질 조치가 필요한 WARNING 급 발견은 위 표에 반영됨.

## 권장 조치사항

1. `workflow-execution.e2e-spec.ts` 에 `GET /api/executions/workflow/:workflowId?workflowId=<uuid>` → `400` 을 단언하는 negative e2e 케이스를 추가하거나, `CustomValidationPipe` 에 whitelist 거부(`forbidNonWhitelisted`) 유닛 테스트를 추가해 이번 breaking 동작을 회귀 테스트로 고정한다. (WARNING #2)
2. 배포 노트/릴리즈 공지에 "`workflowId` 쿼리 파라미터를 보내던 요청은 이제 400 을 받는다"는 한 줄을 추가해 제3자 연동 이슈 발생 시 원인 추적을 빠르게 한다. (WARNING #1)
3. `plan/in-progress/spec-draft-nullable-notation-followups.md:368-370` 의 "열려 있는 것은 넷" 서술을 실제 표·체크박스 수(2개 미종결)에 맞게 "둘"로 정정하거나 open/closed 혼동 없는 표현으로 바꾼다. (WARNING #3)
4. (선택) `swagger-dto-contract.spec.ts` 의 `[대조군] @Transform 예외` 픽스처가 이번 필드 제거와 무관하게 여전히 유효한지 한 번 더 확인. (INFO #1)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 누락 없음
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 범위(죽은 DTO 필드 제거·문서)에 성능 영향 표면 없음(구체 사유는 prompt 에 미제공) |
  | architecture | 라우터 판단 — 아키텍처 구조 변경 없음 |
  | dependency | 라우터 판단 — 의존성 변경 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 로직 변경 없음 |
  | user_guide_sync | 라우터 판단 — 사용자 가이드 동기화 대상 아님 |