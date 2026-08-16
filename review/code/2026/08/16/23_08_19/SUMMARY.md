# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. 기능 결함 없이 정확히 구현됐으나, 코드가 이미 구현한 두 표면(WS `execution.node.*` emit 마스킹, 내부 REST `inputData`/`outputData` 마스킹)을 spec(§R17, WS 프로토콜 문서)이 아직 "미해결"로 서술 중이라 **SPEC-DRIFT**로 태깅했고, Swagger 문서·CHANGELOG·신규 함수 전용 테스트 등 문서/테스트 정합성 갭이 다수 발견됐다. 강제 화이트리스트(router_safety forced) 7명 전원 결과가 확보되어 있어 화이트리스트 미이행에 따른 거짓 음성 위험은 없다.

**forced 화이트리스트 상태**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 전원 결과 확보(success) — 강제 포함 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 이 "아직 원문"이라 못박은 두 표면 — WS `execution.node.*` emit 의 `error`, 내부 REST `inputData`/`outputData` — 를 이 diff 가 이미 정확히 마스킹 구현했다. 코드가 틀린 게 아니라 spec 이 낡았다. 개발자도 plan 체크리스트에 미체크로 남겨 인지하고 있음(단, plan frontmatter 에 `spec_impact` 필드 자체가 없음). | `spec/5-system/14-external-interaction-api.md:1500-1518`(§R17 "잔여(범위 밖)" ①·②), `spec/5-system/6-websocket-protocol.md:184` | 코드는 유지. planner 턴에서 §R17 ①·②를 해소로 flip(③만 잔존), `6-websocket-protocol.md:184` 문구를 관문 상속 서술로 교체, plan frontmatter 에 `spec_impact` 추가 |
| 2 | Documentation/Requirement | 같은 DTO 안에서 `error` 필드는 마스킹 사실을 Swagger 설명에 명시(#1179 반영)했지만, 이번에 새로 마스킹이 걸린 `inputData`/`outputData` 는 그 설명을 갱신하지 않아 자매 필드 간 비대칭. OpenAPI만 보는 외부 통합사/프런트가 DB 원문과 달라질 수 있음을 알 방법이 없음 | `execution-response.dto.ts:48-57,152`(`ExecutionDto`), `background-run-response.dto.ts:49-56`(`BackgroundRunNodeExecutionDto`) | `error` 필드와 동일 패턴으로 "자격증명으로 판별된 값은 마스킹되어 반환된다(DB 원문과 다를 수 있음)" + SoT 링크(EIA §R17) 추가. plan 체크리스트에도 등재 |
| 3 | Requirement | plan 문서 자기모순 — 최상단 "결정" 표와 §A 소제목은 "fanout 브랜치에만" 이라고 멈춰 있는데, 실제 코드·하단 체크리스트는 wire 도 마스킹하는 것으로 번복돼 있음. 표만 보고 참조하면(특히 spec 반영 시) 오독 위험 | `plan/in-progress/eia-fanout-and-internal-data-masking.md:22`(결정 표) vs `:64-68` vs `:162-164`(재택일) | 상단 결정 표 A 행과 §A 소제목을 최종 결정(wire+fanout, `llmCalls` 예외)으로 갱신 |
| 4 | Testing | 신규 함수 `redactStoredDataForResponse` 가 자매 함수(`redactStoredErrorForResponse`)와 달리 전용 유닛 테스트를 못 받음 — null/undefined 정규화, **마스킹이 실제로 발생하는 입력에 대한 비변이(mutation-safety)**, 레거시 타입 보존이 함수 단위로 직접 검증되지 않음. 서비스-레벨 통합 테스트만 간접 커버 | `codebase/backend/src/shared/utils/redact-stored-error.ts`(`redactStoredDataForResponse`), `redact-stored-error.spec.ts`(갱신 안 됨) | `describe('redactStoredDataForResponse', …)` 추가 — 자매 함수 테스트를 거의 그대로 복사-치환 |
| 5 | Testing | `findById` 의 `nodeExecutions[]` copy-on-change 조건이 `error` 단일 필드에서 `inputData`/`outputData`/`error` 3필드로 넓어졌는데, 신규 두 필드만의 변화를 참조 동일성(`toBe`/`not.toBe`)으로 가르는 테스트가 없음 — `inputData === ne.inputData` 항이 빠지거나 뒤바뀌는 뮤턴트가 있어도 기존 테스트가 RED 로 안 바뀜("자매 중 하나만" 패턴의 3필드판 재현 위험) | `codebase/backend/src/modules/executions/executions.service.ts` `findById` 의 `reconciledNodeExecutions` map / `executions.service.spec.ts` `⑤`·`⑤-c` | `inputData` 또는 `outputData` 만 leaky 하고 나머지는 clean 한 행을 섞어 필드별 참조 동일성을 직접 단언하는 테스트 추가 |
| 6 | Maintainability | 마스킹 마커 문자열(`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)이 `sanitize-error-message.ts`(`MASKED_MARKERS`)와 `websocket.service.ts`(인라인 리터럴)에 각각 중복 하드코딩됨 — import/타입 연결 없음. 한쪽만 바뀌면 이 PR 이 막으려는 "마커 재마스킹" 회귀가 조용히 재발 가능 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:117-121` vs `codebase/backend/src/modules/websocket/websocket.service.ts:102,132` | `'[REDACTED]'`/`'[REDACTED_DEPTH]'` 를 이름 있는 export 상수로 승격하고 `MASKED_MARKERS` 가 그 상수를 import 하도록 변경 |
| 7 | Maintainability | `findById` 의 node-level 마스킹 콜백이 "null 이면 그대로, 아니면 redact" 패턴을 `inputData`/`outputData`/`error` 3회 손으로 반복하고 결과를 3항 비교로 재구성 — 필드 추가마다 선형으로 늘어남 | `codebase/backend/src/modules/executions/executions.service.ts:655-680` | `maskIfPresent<T>` 같은 작은 헬퍼로 반복 축약, copy-on-change 비교도 배열 순회로 일반화 |
| 8 | Documentation | `CHANGELOG.md` 가 이번 wire-visible 변경(WS fanout 값-마스킹 신설 + `inputData`/`outputData` 4~5개 표면 마스킹)에 대해 갱신되지 않음 — 87건의 확립된 관례, 특히 바로 직전 자매 PR(#1179)·같은 클래스의 보안 항목(`llmCalls` fanout 유출)은 상세 항목을 남겼음 | `CHANGELOG.md`(diff 미포함, `## Unreleased` 섹션) | 기존 항목과 같은 형식(⚠️ wire 변화 캐비엇 포함)으로 항목 추가. plan 체크리스트에도 등재 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | WS 내부 wire 채널이 `llmCalls` 서브트리를 값-패턴 마스킹에서 제외 — 그 채널 인가는 role 게이팅 없이 workspace 멤버 전원(viewer 포함)에게 열려 있음. 문서화된 trade-off(에디터 디버깅 가치)이며 이번 diff 가 만든 회귀 아님(오히려 다른 필드는 새로 마스킹해 노출 축소) | `websocket.service.ts:380`(`maskWireEnvelope`), `:75`(`WIRE_PRESERVED_FIELDS`) | 없음(설계상 수용). viewer 를 저-신뢰로 재분류할 경우 재검토 |
| 2 | Security | 마커 보존(`isMaskedMarker`)이 정확 문자열 일치로만 판단 — 이론상 실제 시크릿 값이 마커 문자열과 우연히 완전 일치하면 재마스킹 안 됨(그 값 자체가 이미 무정보라 실질 노출 아님) | `sanitize-error-message.ts:117-125,249-251` | 없음(설계 의도와 일치, 캐너리로 고정) |
| 3 | Security | `GET /api/executions/:id` 계열이 role 게이팅 없이 workspace 멤버 전원에 열려 있다는 전제 — 이번 diff 의 근거로 반복 인용되나 인가 모델 자체는 이 diff 범위 밖 | `plan/complete/eia-internal-rest-error-masking.md:42` 등 | 없음 — 범위 밖 |
| 4 | Scope | plan-lifecycle 정리(이전 세션 완료 plan `eia-internal-rest-error-masking.md` 를 `in-progress/`→`complete/` 이동 + 링크 2곳 정정)가 이번 기능 범위(§A/§B/§D)와 무관하게 같은 diff 에 포함 — 내용 무변형, 저위험 | `plan/complete/eia-internal-rest-error-masking.md`(신규), `plan/in-progress/eia-internal-rest-error-masking.md`(삭제), `spec-sync-external-interaction-api-gaps.md:187,200` | PR 설명에 이 정리가 별개 사유임을 한 줄 명시 권장(분리 커밋 불요) |
| 5 | Scope | `deepRedactSecrets` 캐시 로직을 `deepRedactCore`/`deepRedactObject` 로 분리한 리팩터 — 겉보기엔 무관해 보이나 신규 `deepRedactSecretsPreserving`(§A `llmCalls` 보존)이 기존 캐시를 오염시키지 않기 위한 §A 의 직접 귀결 | `sanitize-error-message.ts`(`deepRedactCore`, `deepRedactObject`) | 없음(범위 내) |
| 6 | Side Effect | WS 내부 wire 채널의 emit payload 형태가 이번 변경으로 전면적으로 마스킹 대상이 됨(종전 fanout 전용 처리가 wire 로 확장) — PR 문서가 명시적으로 검토·결정한 트레이드오프이며 회귀 테스트로 고정 | `websocket.service.ts:254,328`(호출부), `:380-387`(`maskWireEnvelope`) | 이 채널의 다른 내부 구독자(모니터링/자동화 도구) 존재 여부 재확인 |
| 7 | Side Effect | `deepRedactSecrets`/`deepRedactCore` 의 마커-보존 규칙 변경이 이 diff 밖의 다른 소비자(`thread-renderer`, `ai-turn-orchestrator`, `interaction.service` 등)에도 전역 상속됨 — 안전 방향(마스킹 완화 아님)으로만 열려 있어 신규 유출 없음 | `sanitize-error-message.ts:117-121,244-254` | 없음(캐너리로 계약 고정됨). 파급 범위 인지만 기록 |
| 8 | Side Effect | `ResponseExecution`/`ResponseNodeExecution` 타입이 `inputData`/`outputData` 를 `Record<string, unknown> \| null` 로 확장 — diff 밖 다른 소비자가 있다면 컴파일 타임에 `\| null` 처리 요구. `nest build` PASS 로 검증됨 | `executions.service.ts:85-92,100-108` | 없음 |
| 9 | Maintainability | "세 컬럼(`error`/`inputData`/`outputData`) redact 후 반환 객체에 얹는" 3줄 블록이 서로 다른 두 파일 세 곳에 문자 그대로 반복 | `executions.service.ts:978-980,1042-1044`(`toExecutionDto`/`toResponseExecution`), `background-runs.service.ts:304-306`(`toNodeExecutionDto`) | 3줄 블록만 공유 헬퍼로 뽑고, "호출 여부"의 개별성은 유지(강제 통합 지양) |
| 10 | Maintainability | `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수 본문이 매개변수 이름만 다르고 완전 동일 — JSDoc 이 의도된 분리임을 명시하나 가드 조건 변경 시 양쪽 수동 동기 필요 | `redact-stored-error.ts:28-35,66-71` | 필요 시 한쪽이 다른 쪽을 내부 호출하도록 단일 출처화 고려 |
| 11 | Maintainability | 한 파일(`websocket.service.ts`) 안에서 유사 목적 연산에 `sanitize`/`mask`/`redact`/`strip` 네 동사가 섞여 쓰임. 개별 JSDoc 으로 완화되나 `maskWireEnvelope` 가 내부적으로 `redact*` 계열을 호출해 동사 불일치 | `websocket.service.ts:100,380-387,401-410` | 필수 아님. 파일 상단 역할 구분표 또는 `maskWireEnvelope`→`redactWireEnvelope` 명명 정합 고려 |
| 12 | Documentation | `NodeExecutionSummaryDto` Swagger 스키마에 `inputData` 필드 자체가 없음(런타임엔 마스킹 적용되나 API 문서엔 애초 미등재) — 이번 diff 가 만든 결함 아닌 선존 갭 | `execution-response.dto.ts:123-182`(`outputData`·`error` 만 선언) | Swagger 갱신(WARNING #2) 작업 시 함께 처리 고려 |
| 13 | Testing | `stop()` 취소 응답 테스트가 `outputData` 마스킹만 단언하고 `inputData` 마스킹은 대칭적으로 겨냥하지 않음(로직 자체는 공통 관문 재사용이라 간접 커버됨) | `executions.service.spec.ts` `④ stop — 취소 응답` | 필수 아님. `cancelled` fixture 에 `inputData` leaky 값도 추가해 대칭 확보 |
| 14 | Testing | `emitKbEvent`/`emitBackgroundRunEvent` 등 나머지 `broadcastToChannel` 호출부는 새 값-패턴 마스킹(`maskWireEnvelope`) 밖에 있고, 그 스코프 경계(의도된 범위 밖 vs 빠뜨린 자매)를 고정하는 테스트/캐너리가 없음 | `websocket.service.ts`(`emitKbEvent`, `emitBackgroundRunEvent`) | 필수 아님. 두 경로가 자유 텍스트 에러 페이로드를 나르지 않는다는 전제를 주석/회귀 테스트로 고정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `llmCalls` wire 마스킹 예외, 마커 정확일치 우회 — 둘 다 실질 익스플로잇 경로 없는 설계상 trade-off |
| requirement | MEDIUM | [SPEC-DRIFT] spec 2문서가 이 diff 의 구현을 아직 "미해결"로 서술, Swagger 미갱신, plan 자기모순 |
| scope | LOW | plan-lifecycle 부수 정리가 기능 범위 밖에 묶임(저위험, 내용 무변형) |
| side_effect | LOW | WS wire 전면 마스킹 확장, 공유 유틸 전역 파급, 타입 시그니처 확장 — 전부 의도적·회귀테스트로 고정 |
| maintainability | LOW | 마커 문자열 중복 하드코딩, `findById` 3회 반복 패턴이 향후 필드 추가 시 조용히 갈릴 위험 |
| testing | MEDIUM | 신규 함수 전용 유닛테스트 부재, 3-컬럼 copy-on-change 참조동일성 검증 갭 — "자매 중 하나만" 패턴 재현 위험 |
| documentation | LOW | CHANGELOG 미갱신, Swagger 비대칭, spec-코드 불일치(단 plan 에 이미 추적 중) |

## 발견 없는 에이전트

없음 — 실행된 7개 에이전트 전원 최소 1건 이상(WARNING 또는 INFO) 보고.

## 권장 조치사항

1. `redact-stored-error.spec.ts` 에 `redactStoredDataForResponse` 전용 테스트(null 정규화·마스킹 발생 케이스의 비변이·레거시 타입 보존) 추가 — 자매 함수 테스트 복사-치환으로 저비용 (WARNING #4)
2. `findById` `⑤-c` 곁에 `inputData`/`outputData` 단독 변화를 참조 동일성으로 가르는 테스트 추가 (WARNING #5)
3. `execution-response.dto.ts`/`background-run-response.dto.ts` 의 `inputData`/`outputData` Swagger 설명에 `error` 필드와 동형의 마스킹 캐비엇 + SoT 링크 추가 (WARNING #2)
4. `CHANGELOG.md` 에 이번 wire-visible 변경 항목 추가(⚠️ wire 변화 캐비엇 포함, 기존 87건 관례 준수) (WARNING #8)
5. planner 턴에서 `spec/5-system/14-external-interaction-api.md` §R17 잔여 ①·②를 해소로 flip, `6-websocket-protocol.md:184` 서술 갱신, plan frontmatter 에 `spec_impact` 추가 (WARNING #1, SPEC-DRIFT — 코드 revert 아님, spec 갱신 경로) — **CLAUDE.md 규약상 `spec/` 변경은 project-planner 담당**
6. `plan/in-progress/eia-fanout-and-internal-data-masking.md` 상단 결정 표/§A 소제목을 실제 최종 결정(wire+fanout)과 일치하도록 정정 (WARNING #3)
7. (저비용) 마스킹 마커 리터럴을 이름 있는 상수로 승격해 두 파일 간 암묵적 동기화 의존 제거 (WARNING #6)
8. (선택) `findById` null-guard-redact 3회 반복을 헬퍼로 축약해 향후 필드 추가 비용 절감 (WARNING #7)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 이미 "실행" 목록에 포함되어 있어 강제 조항이 실질적으로 라우터 선정과 100% 겹침(강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 는 egress 마스킹 계층 추가로 성능 특성 변경 없음(값-패턴 정규식 매칭 비용은 기존과 동일 프리미티브 재사용) |
  | architecture | 라우터 판단 — 기존 아키텍처 패턴(관문 함수) 내 확장, 구조 변경 없음 |
  | dependency | 라우터 판단 — 신규 외부 의존성 추가 없음 |
  | database | 라우터 판단 — DB 스키마/쿼리 변경 없음, egress 마스킹은 응답 직전 계층 |
  | concurrency | 라우터 판단 — 동시성 관련 코드 경로 변경 없음 |
  | api_contract | 라우터 판단 — 응답 값(바이트)은 바뀌나 스키마/타입 계약 자체(엔드포인트, 필드 존재)는 불변으로 판단 |
  | user_guide_sync | 라우터 판단 — 사용자 대상 가이드 문서 영향 없음(내부 API 응답 마스킹) |

---