# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건은 모두 "이미 알려진, 완화 근거가 문서화된" 이슈(직전 라운드 후속 조치 검증)이며 신규 결함은 아니다. forced whitelist(7명: documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / side_effect | `QueryExecutionDto.workflowId` 제거 + 전역 `forbidNonWhitelisted: true` 로 인해 이 쿼리 파라미터를 보내던 **저장소 밖** 클라이언트는 `200`(조용히 무시)에서 `400`(거부)으로 응답이 바뀌는 breaking change. 저장소 내부 소비자(서비스·프런트·spec·e2e·OpenAPI 코드젠)는 부재가 재확인됐으나, 제3자 클라이언트 존재 여부는 로그 없이 확정 불가. 완화책은 CHANGELOG 문서화뿐이고 유예 기간·Deprecation 헤더 등 절차적 장치는 없음(단, 이 저장소 자체가 API 버전 관리 체계를 갖고 있지 않아 이 diff 만의 신규 갭은 아님) | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`(필드 삭제), `codebase/backend/src/common/pipes/validation.pipe.ts:31`(`forbidNonWhitelisted: true`), `CHANGELOG.md:17-24` | 이미 병합 가능 수준. 배포 노트/릴리즈 공지에 이 400 회귀를 한 줄 명시. 향후 유사 케이스는 유예 기간 또는 `Deprecation`/`Sunset` 헤더 절차를 컨벤션화 고려 |
| 2 | maintainability | 신규 테스트 2건만 한국어 설명이고, 같은 파일의 기존 테스트 3건은 영어 설명 — diff 가 파일 내부 언어 컨벤션 불일치를 새로 만듦 | `codebase/backend/src/common/pipes/validation.pipe.spec.ts:92,101`(신규, 한국어) vs `:26,34,56`(기존, 영어) | 새 `describe` 블록 내부만이라도 언어를 기존과 맞추거나, 파일 전체를 한국어로 통일하는 후속 리팩터를 별도로 열 것(블로킹 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / requirement | DTO 필드(`workflowId`) 제거는 검증 공백이 아니라 검증 대상 자체의 소거 — `IsUUID`/`Transform` 도 함께 제거됐고 남은 `status` 필드의 `@IsIn` 검증은 유지됨. 이 breaking change 는 fail-closed 강화 방향이라 보안 취약점 아님 | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts` | 조치 불요 |
| 2 | requirement | 직전 라운드(`18_34_04`) WARNING 3건(W1 api_contract/side_effect, W2 testing, W3 requirement/plan) 모두 실측 재현으로 해소 확인 — 특히 W2 는 `forbidNonWhitelisted: true→false` 뮤테이션을 직접 재현해 RED 1/GREEN 4 → 원복 후 GREEN 5/5, `git status` 클린까지 확인 | `validation.pipe.spec.ts:84-108`, `CHANGELOG.md:14-24`, `plan/in-progress/spec-draft-nullable-notation-followups.md:368-379` | 조치 불요 |
| 3 | requirement | 핵심 변경은 spec 과 line-level 로 일치 — `workflowId` 는 spec(`14-execution-history.md:345`)이 약속한 적 없는 필드였고 서비스도 소비하지 않음. code>spec 여분 표면을 제거해 정렬시킨 케이스 | `codebase/backend/src/modules/executions/dto/query-execution.dto.ts`, `spec/2-navigation/14-execution-history.md:345` | 조치 불요 |
| 4 | testing | 신규 테스트의 `type: 'query'` 메타데이터는 파이프 로직에서 실제로 소비되지 않음(`transform` 은 `type` 미사용) — 대표성 문제 없이 유효 | `validation.pipe.spec.ts:96` vs `validation.pipe.ts:18-42` | 조치 불요(확인용 기록) |
| 5 | scope / side_effect / documentation | 이번 커밋에 함께 포함된 21개 리뷰/일관성 산출물(`review/code/.../18_34_04/*`, `review/consistency/.../18_51_26/*`)은 프로젝트 관례상 정상 저장 위치이며, 표본 확인 결과 전부 동일 작업(`workflowId` 제거)만 다룸 — 다른 작업 혼입 없음 | `review/code/2026/09/04/18_34_04/*`, `review/consistency/2026/09/04/18_51_26/*` | 조치 불요 |
| 6 | side_effect | 신규 `describe` 블록은 로컬 `NarrowDto`/`pipe` 로 격리돼 있고 `CustomValidationPipe` 자체가 stateless — 블록 간 오염 가능성 없음 | `validation.pipe.spec.ts:84-108` | 조치 불요 |
| 7 | side_effect / maintainability | `swagger-dto-contract-guard.ts` 변경은 순수 JSDoc 재서술이며 판정 로직(`findSwaggerContractMismatches` 등)은 불변임을 직접 대조 확인 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:100-121` | 조치 불요 |
| 8 | maintainability | 신규 JSDoc 이 SoT 가 아닌 ephemeral 리뷰 세션 ID(`18_34_04` W2)를 소스 영구 주석의 근거로 인용 — 향후 그 디렉터리가 정리되면 dangling reference 위험 | `validation.pipe.spec.ts:77` | 리뷰 세션 ID 대신 plan 항목처럼 SoT 로 취급되는 문서를 인용하는 편이 더 오래감(즉시 조치 불요) |
| 9 | maintainability | "workflowId 제거, 200→400" 서사가 CHANGELOG·plan·DTO JSDoc·신규 테스트 JSDoc 네 곳에 중복 서술됨 — 숫자 반복은 없어 동기화 리스크는 낮지만 서사 분산 자체는 이전 라운드가 이미 지적한 패턴의 연장 | `CHANGELOG.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md:307-324`, `query-execution.dto.ts:5-14`, `validation.pipe.spec.ts:79-82` | 향후 유사 서사 추가 시 한쪽을 SoT 로 지정하고 나머지는 짧게 링크 |
| 10 | maintainability | `query-execution.dto.ts` diff 자체는 모범적 — 필드 제거와 함께 미사용 import(`IsUUID`, `Transform`) 정리, 나머지 필드·구조 불변 | `query-execution.dto.ts:1-3` | 조치 불요(긍정 관찰) |
| 11 | testing / api_contract | 파이프 레벨 유닛 테스트가 이전 라운드가 제안한 "e2e negative case" 대신 채택됨 — 전역 파이프라 오히려 더 넓은 커버리지지만, 실제 라우트(`?workflowId=...`)를 종단으로 찌르는 e2e negative case 는 여전히 없음 | `validation.pipe.spec.ts:84-108`, `workflow-execution.e2e-spec.ts`(신규 케이스 없음) | 후속으로 `?workflowId=<uuid>` → 400 e2e 1개 추가 시 종단 보증 완성(필수 아님) |
| 12 | testing | 신규 거절 단언이 응답 바디 형태(`code`/`details`)를 검증하지 않아 같은 파일의 기존 테스트와 검증 깊이가 다름 | `validation.pipe.spec.ts:92-99` vs `:34-54` | `body.code === 'VALIDATION_ERROR'` 단언 한 줄 추가 시 일관성 개선(블로킹 아님) |
| 13 | testing | `RESOLUTION.md` 의 뮤테이션 검증 결과(1 RED/4 pass)를 이번 세션에서 직접 재실행하지 않고 정적 재구성으로만 대조(정합 확인) — 병렬 리뷰 중 공유 트리 뮤테이션 금지 규약 때문 | `review/code/2026/09/04/18_34_04/RESOLUTION.md` | 조치 불요 |
| 14 | api_contract | URL/경로 설계 관점에서 경로(`:workflowId`)와 쿼리(`workflowId`)가 같은 리소스를 이중 지시하던 구조적 모순을 제거 — RESTful 원칙에 부합하는 정정 | `query-execution.dto.ts` 클래스 JSDoc | 조치 불요(긍정 소견) |
| 15 | documentation | §③ 스냅샷 표의 모집단(1,096)이 이번 필드 제거로 실제 값(1,095)과 추가 드리프트 — 단 이번 diff 범위 밖이고 문서가 이미 "잰 시점의 값" 원칙을 명시해 둠 | `plan/in-progress/spec-draft-nullable-notation-followups.md` §③ | 조치 불요(원칙적으로 이미 수용된 드리프트). 다음 §③ 수정 시 한 줄 갱신 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인가/검증 로직 무영향, breaking change 는 fail-closed 강화 방향 |
| requirement | NONE | 직전 라운드 WARNING 3건 실측 재현으로 해소 확인, spec 정합 |
| scope | NONE | 단일 작업(workflowId 제거)에 정확히 수렴, 무관 변경 없음 |
| side_effect | LOW | breaking change(200→400) 재확인, 신규 테스트는 격리·부작용 없음 |
| maintainability | LOW | 신규 테스트 언어 컨벤션 불일치(WARNING), 리뷰 세션 ID 인용·서사 중복(INFO) |
| testing | LOW | 회귀 테스트로 실질 갭 해소, 엔드포인트 종단 e2e·응답 바디 검증은 INFO 수준 잔여 |
| documentation | NONE | CHANGELOG·JSDoc·plan 트래커 다섯 곳 일관·정확, §③ 드리프트는 원칙적으로 수용됨 |
| api_contract | LOW | breaking change 완화 절차 부재(WARNING), 나머지는 정당한 설계 정정 |

## 발견 없는 에이전트

- security, requirement, scope, documentation — 각 NONE 판정(위 표 참고, Critical/WARNING 없음)

## 권장 조치사항

1. (선택) `workflow-execution.e2e-spec.ts` 에 `?workflowId=<uuid>` → `400 VALIDATION_ERROR` negative 케이스 추가해 파이프 유닛 테스트와 실제 라우트 사이 종단 검증 간극을 닫는다.
2. (선택) `validation.pipe.spec.ts` 신규 `describe` 블록의 테스트 설명 언어를 파일 내 기존 영어 컨벤션에 맞추거나, 별도 후속 PR 에서 파일 전체를 한국어로 통일한다.
3. (선택) 배포 노트/릴리즈 공지에 `QueryExecutionDto.workflowId` 제거로 인한 200→400 breaking change 를 한 줄 명시한다.
4. 위 3건 모두 블로킹 사유가 아니며, 이번 PR 은 현재 상태로 병합 가능하다는 것이 8개 reviewer 공통 결론이다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 소스 코드 변경 시 항상 적용되는 화이트리스트) — **forced 전원 결과 확보됨, 미이행 없음**
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(DTO 필드 제거 + 단위 테스트)와 무관 |
  | architecture | 구조적 변경 없음(단일 필드 제거) |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없음(내부 API 파라미터 제거) |