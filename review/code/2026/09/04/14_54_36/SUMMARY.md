# Code Review 통합 보고서

## 전체 위험도
**LOW** — 응답 DTO 83개 필드의 `@ApiPropertyOptional`→`@ApiProperty` (`required: false→true`) 순수 정합화 배치. 런타임 wire 변경 없음, CRITICAL 없음. testing 리뷰어가 검증 방법론(`tsc` 판정)의 사각지대 2건을 WARNING 으로 지적했으나 둘 다 "오늘 시점 결함"이 아니라 향후 회귀에 대한 안전망 공백이다. forced whitelist 7명 전원 + router 선택 api_contract 결과 모두 확보(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | "`tsc` 가 판정자였다"는 검증 방법론이 엔티티를 그대로 반환하는 컨트롤러(alerts/folders/edges 등)에는 적용되지 않는다 — 서비스가 `Promise<Entity[]>` 를 그대로 반환하고 컨트롤러도 가공 없이 돌려주므로 DTO-typed 대입 지점 자체가 없어 tsc 검증이 발동하지 않는다. `AlertRuleDto.threshold: number` vs 엔티티 `AlertRule.threshold: string`(numeric 컬럼) 처럼 DTO 가 이미 "문서 전용"이라 구조적으로 강제되지 않음을 보여주는 사례도 있음 | `codebase/backend/src/modules/alerts/alerts.controller.ts:52`, `alerts.service.ts:14`; `codebase/backend/src/modules/folders/folders.controller.ts:52`; `codebase/backend/src/modules/edges/edges.controller.ts:55-59`; DTO: `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts:25,33` | 후속으로 (a) 이런 패스스루 컨트롤러의 반환 타입을 `Promise<{ data: XxxDto[] }>` 로 명시 annotate 해 tsc 가 실제로 구조를 검사하게 하거나, (b) 대표 엔드포인트에 `buildSwaggerDocument`+e2e 응답 대조 테스트 추가 |
| 2 | testing | 유일하게 실제 `SwaggerModule.createDocument()` 를 빌드해 스키마를 검사하는 테스트가 이번 PR 이 바꾼 정확한 축(`required`)을 단언하지 않는다 — `nullable` 만 일부 필드(3/5)에 대해 확인하고 `required` 배열 포함 여부는 어디에도 검사 없음 | `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:110-118` (`durationMs`/`currentNode`/`context`/`result`/`error` 5필드 대상, `it.each` 목록엔 3개만 존재) | `it.each` 에 `currentNode`/`context` 추가 + `expect(executionStatus.required ?? []).toEqual(expect.arrayContaining([...5개 필드]))` 단언 보강 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 응답 payload 는 이 변경으로 늘거나 줄지 않음 — `?` 제거·데코레이터 전환은 OpenAPI `required`/TS 컴파일타임 옵셔널리티만 변경, 런타임 직렬화·마스킹 로직은 diff 범위 밖 | DTO 20개 파일 전체 | 조치 불요 |
| 2 | security | 요청(PATCH) DTO 는 의도적으로 배제 — tri-state(키 생략=불변, `null`=초기화) 의미 보존 | `plan/in-progress/spec-draft-nullable-notation-followups.md` | 조치 불요 |
| 3 | security | 클라이언트 생성 타입이 optional→required 로 좁아지며 소비자 코드의 `undefined` 분기가 죽은 코드가 될 수 있음(보안 아님, 신뢰성 이슈) | DTO 20개 파일 전체 | 프런트/SDK 소비 빌드가 이 변경을 `tsc` 로 검증하는지만 확인 권장 |
| 4 | requirement | `npx tsc --noEmit` 실측 재실행 결과 197건/36파일 — 커밋의 "타입체크 ratchet baseline 일치" 주장과 정확히 일치, DTO 관련 오류 0건 | `codebase/backend/tsconfig.json` 전체 | 조치 불요 |
| 5 | requirement | 83건 필드 전환 + 12개 파일 import 정리 수치가 diff 실카운트와 정확히 일치 | DTO 20개 파일 diff | 조치 불요 |
| 6 | requirement | `dto/responses/**` 전수 스캔 결과 낡은 패턴(옵셔널+nullable) 잔존 0건, §5.4 (a)/(b) 예외 필드는 정확히 보존됨 | `codebase/backend/src/modules/**/dto/responses/*.ts` | 조치 불요 |
| 7 | requirement | `WorkflowVersionDto.creator` "always-present" 전제를 서비스 코드(`relations: { creator: true }`)로 실측 확인 — 주석 문구("조인 시 포함")는 오독 소지 있으나 실제 동작과 무모순 | `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:44-49,81-86` | 조치 불요 |
| 8 | scope | 20개 DTO 파일 각각 대상 필드의 데코레이터/타입 줄만 변경, 진짜 optional(키 생략) 필드(`cronExpression?`, `timezone?` 등)는 정확히 배제 | 전체 20개 DTO 파일 | 조치 불요 |
| 9 | scope | import 정리(`ApiPropertyOptional` 제거)는 실제 미사용 파일에서만 발생, 여전히 쓰는 파일(예: `execution-response.dto.ts`)은 보존 | 12개 파일 import 문 | 조치 불요 |
| 10 | scope | plan/CHANGELOG 갱신은 이 diff 를 설명하는 필수 부속물, 범위 밖 아님 | `plan/in-progress/spec-draft-nullable-notation-followups.md`, `CHANGELOG.md` | 조치 불요 |
| 11 | side_effect | OpenAPI `required` 83필드 flip 은 공개 인터페이스 변경(생성 클라이언트 타입 협소화)이나 CHANGELOG/커밋 본문에 명시적으로 고지됨 | DTO 20개 파일 전역 | 조치 불요 — 고지·검증됨 |
| 12 | side_effect | TS 필드 시그니처 협소화의 blast radius 는 백엔드 패키지 내부로 국한(`codebase/frontend`/`packages` 에서 DTO 클래스 직접 import 없음) | 20개 DTO 파일 | 향후 `plainToInstance`/spread/`as` 캐스트 조립 코드 추가 시 tsc 가 "항상 채워짐"을 보증 못할 수 있음(참고용) |
| 13 | side_effect | 12개 파일 미사용 import 제거는 고지됨 + 검증됨, 여전히 쓰는 파일은 올바르게 보존 | 12개 파일 | 조치 불요 |
| 14 | maintainability | 83필드×20파일 반복 변경이지만 전형적 DRY 위반 아님 — 전수 대조 결과 진짜 optional 필드 배제·import 정리 모두 일관되게 적용됨 | 20개 DTO 파일 전반 | 향후 대규모 배치엔 codemod(ts-morph) 고려(이번 PR 결함 아님) |
| 15 | maintainability | import 정리가 파일별로 정확히 조건부 처리됨(사용 중인 파일은 유지) | `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:1` | 조치 불요 |
| 16 | maintainability | CHANGELOG 신규 항목의 서술 밀도가 높음(자기 정정 서사 포함)이나 기존 CHANGELOG 컨벤션과 일치 | `CHANGELOG.md:3-37` | 조치 불요 |
| 17 | testing | 이 배치 자체에 새 테스트가 없는 것은 타당 — 기존 저장소 전역 AST 가드(`swagger-dto-contract.spec.ts`)가 이번 83필드를 포함해 전체를 매 실행마다 재검증 | `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` | 조치 불요 |
| 18 | testing | `class-validator`/`ClassSerializerInterceptor` 전역 미개입 확인 — wire 포맷 불변 주장에 근거 있음 | `main.ts`/`app.module.ts` (grep 0건) | 조치 불요 |
| 19 | documentation | CHANGELOG 가 커밋 본문의 부수 효과(12개 파일 import 정리)를 언급하지 않음 — 실질적 문제 아니나 완전성 갭 | `CHANGELOG.md:3` | 선택 사항. 후속 관련 커밋에서 함께 정리해도 무방 |
| 20 | documentation | CHANGELOG 수량 주장(83필드/12파일) 실측 교차검증 일치, 오래된 주석 0건, `spec/conventions/swagger.md` 기존 지침을 코드가 뒤늦게 따라간 사례로 확인 | 21개 DTO 파일 전수 + `spec/conventions/swagger.md`, `CHANGELOG.md` §5.4 링크 | 조치 불요 |
| 21 | api_contract | OpenAPI `required` flip 은 wire 불변이지만 생성 클라이언트 타입 계약을 좁힘(하위호환 유지 방향) — CHANGELOG 에 이미 명시 | 20개 DTO 파일 (예: `alert-rule-response.dto.ts:25`, `execution-response.dto.ts:19-20`) | SDK 자동 재생성 파이프라인이 있다면 트리거 확인 권장 |
| 22 | api_contract | "상시 존재" 판정은 `tsc` 구조적 타입체크에 의존 — object spread widening·`as` 캐스트·직렬화 인터셉터는 새 AST 가드 범위 밖(이번 diff 가 만든 사각지대 아님, 방법론 자체의 알려진 한계) | `swagger-dto-contract-guard.ts`, plan 문서 | 고빈도 응답 경로에 한해 e2e 스냅샷 단언 유지 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션·인증·시크릿·검증 관점 해당 없음, 노출 표면 변화 없음 |
| requirement | LOW | §5.4 문면과 line-level 일치, tsc 재실행으로 197/36 정확히 재현, 배치 완결성(잔존 0건) 확인 |
| scope | NONE | 20개 DTO 파일 전부 단일 목적에 정확히 수렴, 범위 밖 변경 없음 |
| side_effect | LOW | 컨트롤러/서비스/엔티티 등 런타임 로직 파일 0건 포함, blast radius 백엔드 내부로 국한 확인 |
| maintainability | NONE | 기계적 단일 패턴 치환, 예외 처리(진짜 optional 배제) 전수 일관 |
| testing | LOW | AST 가드가 재검증하나 엔티티 패스스루 컨트롤러엔 tsc 미적용 + 유일한 스키마 레벨 테스트가 `required` 축 미검사 (WARNING 2건) |
| documentation | NONE | CHANGELOG 수치 실측 일치, 오래된 주석·스펙 불일치 없음 |
| api_contract | LOW | wire 불변, 요청/응답 tri-state 구분 정확 유지, 검증 방법론의 알려진 사각지대만 존재 |

## 발견 없는 에이전트

없음 (전 8개 에이전트가 최소 INFO 이상 발견사항 보고, security/scope/maintainability/documentation 은 Critical/Warning 없이 NONE 위험도로 수렴).

## 권장 조치사항

1. (testing WARNING #2) `execution-status-response.dto.spec.ts` 의 `it.each` 에 `currentNode`/`context` 를 추가하고, `required` 배열에 이번 PR 이 뒤집은 5개 필드가 포함되는지 단언을 보강 — 유일한 OpenAPI 문서-생성 레벨 테스트가 이번 PR 의 실제 변경 축을 검사하도록.
2. (testing WARNING #1) 엔티티를 그대로 반환하는 패스스루 컨트롤러(alerts/folders/edges 등)의 반환 타입을 `Promise<{ data: XxxDto[] }>` 로 명시 annotate 하거나, 대표 엔드포인트에 실제 응답 대조 테스트를 추가해 "DTO 계약이 사람의 판단이 아니라 코드로 강제됨"을 확보 — 이번 PR 을 막을 사안은 아니므로 후속 티켓으로 처리.
3. (documentation INFO) 여유가 있다면 다음 관련 커밋에서 CHANGELOG 에 import 정리(12파일) 언급을 보완 — 선택 사항.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 순수 데코레이터/타입 메타데이터 변경, 런타임 성능 경로 무관 |
  | architecture | router 판단 — 아키텍처 구조 변경 없음 |
  | dependency | router 판단 — package.json/lockfile 변경 없음 |
  | database | router 판단 — 스키마/쿼리 변경 없음 |
  | concurrency | router 판단 — 동시성 관련 코드 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 영향 없는 내부 타입 정합화 |