# Code Review 통합 보고서

## 전체 위험도
**LOW** — `ReRunRequestDto.inputOverride` 의 OpenAPI 스키마 표현을 축약형(`type: Object`)에서 명시형(`type: 'object', additionalProperties: true`)으로 교정한 순수 문서화 fix. 런타임 검증(class-validator)·인증/인가·API wire-level 계약은 전혀 바뀌지 않았고, 8개 reviewer 전원(forced 7명 + api_contract) 결과를 모두 확보했다(누락 없음). Critical 없음, WARNING 3건은 전부 신규 테스트 파일(`re-run.dto.spec.ts`)의 스타일/견고성 관련이며 blocking 사유가 아니다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | 신규 캐너리 테스트가 저장소에 이미 확립된 `SchemaObject`(`ApiResponseSchemaHost['schema']`) 타입 파생 컨벤션을 따르지 않고 `Record<string, unknown>` 캐스팅을 산발적으로 사용 — 자매 스펙 3개(`workflows-execute-body.spec.ts`, `interact-ack-response.dto.spec.ts`, `execution-status-response.dto.spec.ts`)와 스타일이 갈림, 타입 안전성 저하 | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:51-55, 59, 66` | `type SchemaObject = ApiResponseSchemaHost['schema'];` 를 도입해 자매 스펙과 동일 패턴으로 통일 |
| 2 | maintainability | `beforeAll` 에서 `SwaggerModule.createDocument` 가 던지면 `app.close()` 가 스킵됨 — 자매 스펙 2곳은 `try/finally` 로 이를 방지하는데 이번 파일만 그 방어가 빠짐 | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:43-50` | `try { ... } finally { await app.close(); }` 로 감싸 실패 경로에서도 앱 정리 보장 |
| 3 | scope | 원 작업(`re-run.dto.ts` 축약형 정정)과 무관한 "Docker Hub" won't-do 체크박스가 같은 트래커 파일에서 함께 `[ ]`→`[x]` 플립됨 — 작성자가 plan 문서에 "부수" 로 명시 고지했고 코드 영향 없는 plan-hygiene 성격이라 실질 위험은 낮음(INFO 로 낮춰도 무방하다는 reviewer 자체 판단 포함) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:384` | 현재 방식(plan 문서 내 "부수" 명시)으로 충분. 더 엄격히 가르려면 별도 사소 커밋으로 분리 가능(강제 아님) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security / side_effect / api_contract / requirement | 이번 변경은 순수 OpenAPI 문서 메타데이터 fix — `class-validator`(`@IsOptional`/`@IsObject`) 런타임 검증은 불변, breaking change 아님. codegen 클라이언트는 오히려 "빈 인터페이스"에서 "열린 map" 으로 더 정확하고 관대한 타입을 얻게 됨(개선 방향) | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:28-29` | 없음(정보성) |
| 2 | requirement | 신규 plan 문서의 "미체크 30 → 27" 수치가 실측(29→27)과 1건 어긋남(off-by-one) | `plan/in-progress/rerun-dto-shorthand.md:54` | 다음 편집 시 "29 → 27" 로 정정(별도 diff 불요) |
| 3 | scope | 신규 캐너리 두 번째 단언(`MASKED_VALUE_RESUBMITTED` description 검증)이 이번 diff 로 변경되지 않은 기존 문구를 검증 — 같은 프로퍼티를 다루는 자연스러운 확장으로 위험 낮음 | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:65-68` | PR 설명에 "축약형 회귀 + 기존 마커 캐비엇 회귀 두 가지를 겸한다" 한 줄 명시하면 향후 혼선 방지 |
| 4 | testing | OpenAPI 문서 생성 boilerplate 가 기존 2개 파일에 이어 3번째로 중복(공유 헬퍼 부재) — 이번 PR 이 만든 패턴 아님, 기존 컨벤션 반복 | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:39-51` | 4번째 사례 발생 시 공유 헬퍼 추출 고려(지금 불요) |
| 5 | testing | 캐너리가 `type`/`additionalProperties`/`description` 만 검증하고 `required` 여부는 미검증 — 이번 diff 스코프 밖(`@IsOptional()` 자체는 불변) | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:58-63` | 필요 시 `not.toContain('inputOverride')` 한 줄로 저비용 보강 가능(지금 불요) |
| 6 | documentation | CHANGELOG 미기재 — breaking 아니므로 의도적 생략으로 판단되나 근거 명문화는 안 되어 있음 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:23` | "생성 문서 shape 변경은 CHANGELOG 대상 아님" 을 향후 명문화하면 재판단 비용 절감(강제 아님) |
| 7 | documentation | 트래커 종결 체크박스에 완료 산출물(`rerun-dto-shorthand.md`) 로의 상호 링크가 아직 없음 — plan 이 아직 `in-progress/` 에 있어 자연스러운 상태 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1077` | plan 이 `plan/complete/` 로 이동하는 시점에 링크 추가 권장(차단 아님) |
| 8 | api_contract | `MASKED_VALUE_RESUBMITTED` 캐비엇이 구조화된 `@ApiBadRequestResponse` 등 OpenAPI 에러 데코레이터로는 노출되지 않고 자유 텍스트 description 에만 존재 — 선존 갭, 이번 diff 범위 밖 | `codebase/backend/src/modules/executions/dto/re-run.dto.ts:21` | 필요 시 컨트롤러에 구조화된 에러 응답 데코레이터 추가 고려(스코프 밖) |
| 9 | maintainability | `schema.inputOverride as Record<string, unknown>` 캐스팅이 두 `it` 블록에 중복 | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:59, 66` | `beforeAll` 에서 한 번 파생해 공유(WARNING #1 의 `SchemaObject` 도입과 함께 처리) |
| 10 | maintainability | 테스트 타이틀의 대괄호 태그(`[캐너리]`/`[가드]`) 컨벤션이 두 번째 테스트에서 빠짐 | `codebase/backend/src/modules/executions/dto/re-run.dto.spec.ts:65` | `[가드]` 또는 `[캐너리]` 태그 추가로 일관성 확보 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 문서 메타데이터 변경, 런타임 검증/인가/시크릿 영향 없음 |
| requirement | LOW | spec 컨벤션(`swagger.md`)·엔드포인트 spec 과 line-level 정합, 뮤테이션·jest 실측으로 근거 확인. plan 문서 수치 1건 오기(INFO) |
| scope | LOW | 핵심 변경은 의도와 정확히 일치. 무관한 Docker Hub 체크박스 동반 플립(WARNING, 저위험) |
| side_effect | NONE | 상태/파일시스템/시그니처 부작용 없음. codegen 클라이언트 타입만 관대해짐(INFO) |
| maintainability | LOW | 신규 스펙이 자매 파일 3개의 `SchemaObject`/`try-finally` 컨벤션 미준수(WARNING 2건) |
| testing | NONE | 뮤테이션 재현으로 non-vacuous 확인(RED→GREEN), backend 전체 스위트 8,952 passed |
| documentation | NONE | 근거 3계층(주석/JSDoc/plan) 실측 일치. CHANGELOG·상호링크는 INFO |
| api_contract | NONE | breaking change 아님, wire-level 계약 불변. 구조화 에러 응답 갭은 선존(INFO) |

## 발견 없는 에이전트

없음 — 8개 에이전트 전원이 최소 INFO 이상의 발견사항을 보고함(실질 결함이 아닌 정보성 기록 포함).

## 권장 조치사항
1. (선택) `re-run.dto.spec.ts` 에 자매 스펙과 동일한 `SchemaObject` 타입 별칭 + `try/finally` app 정리 패턴을 적용해 스키마 테스트 컨벤션을 통일한다 — blocking 아님, 다음 관련 PR 에서 처리 가능.
2. (선택) `plan/in-progress/rerun-dto-shorthand.md` 의 "30 → 27" 수치를 "29 → 27" 로 정정한다(별도 diff 불요, 다음 편집 시).
3. 나머지 INFO 항목(CHANGELOG 생략 근거 명문화, plan 상호링크, `required` 캐너리 보강 등)은 전부 비차단 — 필요 시점에 자연스럽게 처리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터가 개별 사유를 제공하지 않음 — 순수 OpenAPI 메타데이터 변경으로 성능 표면 무관 추정 |
  | architecture | 라우터가 개별 사유를 제공하지 않음 — 구조/모듈 경계 변경 없음 추정 |
  | dependency | 라우터가 개별 사유를 제공하지 않음 — 의존성 변경 없음 추정 |
  | database | 라우터가 개별 사유를 제공하지 않음 — DB 접근 로직 변경 없음 추정 |
  | concurrency | 라우터가 개별 사유를 제공하지 않음 — 동시성 관련 코드 변경 없음 추정 |
  | user_guide_sync | 라우터가 개별 사유를 제공하지 않음 — 사용자 가이드 대상 표면 변경 없음 추정 |