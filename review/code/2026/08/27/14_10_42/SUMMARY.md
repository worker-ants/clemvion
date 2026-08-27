# Code Review 통합 보고서

## 전체 위험도
**LOW** — 신규 CRITICAL 없음. 이 diff(`masking-residuals-0b195b`)는 6라운드째 재검토 대상이며, 마지막 실질 코드 변경(`b0b52ad2c`) 이후로는 JSDoc 문구 정정과 spec/plan 문서 수정만 있었다. 남은 WARNING 은 전부 팀이 이미 인지·문서화·수용한 구조적 trade-off 의 재확인이며 신규 결함이 아니다. 라우터 강제 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7개 전원이 실행되고 전문을 확보했음을 확인 — forced 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | `config` 가 이제 DB 에 원문(자격증명 포함)으로 저장되어, 노출 표면이 REST/WS egress 마스킹 두 경로 밖(DB 백업·복제본·직접 `psql` 조회·감사 export 등 제3경로)으로 넓어짐. 팀이 R-5 정정 블록에 이미 trade-off 로 문서화·수용(§R17)했고 5라운드 코드 리뷰 + 3라운드 consistency-check 에서 반복 재확인된 기지 사안 | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`, `spec/2-navigation/14-execution-history.md` R-5 정정 블록 | 근본 처방(자격증명 참조 간접화)은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 등재·우선순위 유지. 추가로 DB 백업/리포팅·ETL 파이프라인의 재-마스킹 여부를 별도 점검 항목으로 명시 등재 권장 |
| 2 | security | 마스킹 책임이 safe-by-construction(생성 시점 단일 boundary) 에서 safe-by-convention(각 egress 구현체 규율) 으로 전환 — `NodeHandlerOutput.config` 타입에 raw/masked 구분 브랜딩이 없어 향후 신규 egress 추가 시 마스킹 누락을 컴파일러가 못 잡음. 이미 인지·수용된 trade-off(코드 리뷰 `10_53_52`/`12_28_26`/`12_52_43` 라운드에서 비차단 재확인) | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:26-63` | 후속으로 `Raw<T>` 류 브랜디드 타입 또는 lint 규칙("config 를 응답/로그로 내보내는 새 코드는 반드시 `deepRedactSecrets` 를 거친다") 도입을 트래커에서 계속 추적 |
| 3 | scope | masking-egress 작업과 무관한 "doc-link 검사기" 전제 정정이 mirror-sweep 정정 커밋(`23e1c91a0`) 안에 곁다리로 섞임. 이미 두 차례 이전 라운드(`12_00_05`/`12_52_43` scope)가 지적했고 `12_00_05/RESOLUTION.md` W6 에서 "내용은 정확하나 커밋을 갈랐어야 했다 — 소급 분리는 하지 않는다"로 명시 처분된 기지 사안 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — `⚠️ 전제 정정 (2026-08-27 실측, C 작업 중)` 블록 | 추가 조치 불요(소급 분리 안 함, 이미 처분 완료). 향후 유사 상황에서는 커밋 전이라면 별도 커밋으로 분리하는 관행 유지 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 4 | security | 크로스-노드 자격증명 릴레이(한 노드 config 를 다른 노드 body 로 릴레이) — 권한 상승 아니며 워크스페이스 경계 내로 한정, 이미 R-5·트래커 등재된 기지 사안 | `spec/2-navigation/14-execution-history.md` R-5, `handler-output.adapter.ts:53` | 조치 불요(별건 트래커에서 근본 처방 추적) |
| 5 | security | REST/WS 의 `CREDENTIAL_KEY_PATTERN` 이 독립 선언·비대칭(`x-api-key` 는 REST 전용) — 이번 PR 안전성엔 영향 없음(양쪽 다 `DEFAULT_SENSITIVE_KEYS` 포함), drift 위험은 별도 트래커 등재 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:112-113`, `websocket.service.ts` 로컬 sanitizer | 조치 불요(이 PR 범위 밖) |
| 6 | side_effect | `ExecutionContextService.setStructuredOutput` 이 핸들러 반환 `config` 객체를 참조로 그대로 장기 캐시에 저장(aliasing) — 시크릿 유출 벡터는 아니나 신규 데이터 무결성 계약. JSDoc 2-hop 분리 + 캐너리 2건으로 이미 고정·문서화됨 | `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:137-157` | 조치 불요(이미 캐너리로 고정) |
| 7 | side_effect | (신규 관찰) 단일 노드 디버그 재실행이 이 PR **이전에 저장된** 실행을 predecessor 로 시딩할 때, `adaptHandlerReturn` 은 이미 boundary-마스킹된 과거 `config` 값(`****abcd`)을 그대로 캐리 — storage-format 전환이 과거 row 에 소급 적용 안 되는 일반적 한계, 신규 결함 아님 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `seedSingleNodePredecessorOutputs`(diff 대상 아님, 참조용) | 차단 사유 아님. `spec-sync-external-interaction-api-gaps.md` 또는 `13-replay-rerun.md` C3 항목에 "이 PR 이전 실행을 predecessor 로 시딩하면 config 가 여전히 마스킹값" 한 줄 부기 권장 |
| 8 | side_effect | `DEEP_REDACT_CACHE`(identity 기반 WeakMap) staleness 가설 재검증 — 매 REST 요청이 새 조회 엔티티를 넘기므로 identity 재진입 경로 없음, WS 는 이 캐시 자체를 안 씀. `12_52_43` 라운드의 "오늘 도달 불가" 처분과 일치 | `sanitize-error-message.ts:202,222-231`, `redact-stored-error.ts:107-108` | 조치 불요(재확인 완료) |
| 9 | requirement | 리뷰 시점 공유 워크트리에 이 diff 와 무관한 미커밋 뮤테이션 테스트 잔여물(`DEFAULT_SENSITIVE_KEYS`에 `oauthCred` 삽입, 다른 병렬 세션의 M4 뮤테이션 산물로 추정) 발견 — 이 PR 의 결함이 아니라 오히려 포함관계 캐너리가 정상 동작함을 보여주는 방증 | `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`DEFAULT_SENSITIVE_KEYS` 배열) | 조치 불요(관찰만 기록, 원복은 해당 세션이 자체 수행할 것으로 예상) |
| 10 | maintainability / documentation | `handler-output.adapter.ts` 의 1줄 코드(`config: r.config ?? {},`)에 20줄 이상의 인라인 주석 — 3라운드 연속(`12_00_05`/`12_52_43`/이번) 형태 변경 없이 유지, 강제 아님 | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:30-53` | 핵심 1~2문단만 남기고 반증 이력은 CHANGELOG/spec 포인터로 대체(비강제) |
| 11 | maintainability / documentation | 동일 보안 불변식("포함관계 캐너리가 두 마스커의 안전성을 보장") 서술이 3개 파일(어댑터 주석, 어댑터 spec JSDoc, mask-sensitive-fields spec JSDoc)에 근접-중복 — 실제로 mirror-sweep 라운드들에서 한쪽만 갱신되는 drift 가 여러 차례 발생한 이력 있음 | `handler-output.adapter.ts:39-48`, `handler-output.adapter.spec.ts:92-108`, `mask-sensitive-fields.util.spec.ts:116-137` | `mask-sensitive-fields.util.spec.ts` JSDoc 을 canonical 로 삼고 나머지는 `@see` 참조로 축약(비강제, 저자의 의도적 선택과 상충하여 강제하지 않음) |
| 12 | maintainability / testing | `execution-context.service.spec.ts` 신규 캐너리 2건이 동일한 이중 타입 캐스트(`as unknown as Parameters<...>[2]`)를 반복 — 추출 임계선(3회) 미달 | `execution-context.service.spec.ts:245,263` | 3번째 캐너리 추가 시 로컬 헬퍼로 추출(현재는 비강제) |
| 13 | testing | egress 게이트웨이 함수(`maskWireEnvelope`/`redactStoredDataForResponse`) 를 실제로 통과하는 end-to-end 테스트가 없음 — 어댑터 pass-through 와 `deepRedactSecrets` 마스킹을 각각 직접 호출로만 단언, 배선 자체는 별개 기존 테스트에 의존. `12_00_05`/`12_52_43` 라운드가 이미 "기존부터 없던 갭, 신규 아님"으로 처분 | `handler-output.adapter.spec.ts`, `mask-sensitive-fields.util.spec.ts` | 강제 아님. 향후 두 게이트웨이 함수에 회귀 발생 시 유닛 테스트가 못 잡을 수 있으므로, e2e 또는 게이트웨이 함수 spec 에 "민감 키가 실제로 wire/REST 응답에서 가려진다" 1건 이상 추가 권장 |
| 14 | documentation | `node-output.md` mutation-보호 절이 엔진→핸들러 방향(`context.rawConfig` freeze)만 다루고, 이번 PR 이 만든 반대 방향(핸들러→엔진 캐시, `adapted.config` aliasing) 계약은 아직 안 다룸. `13_47_15` consistency RESOLUTION INFO 6 에서 "선택 사항, 정본 트래커 등재"로 이미 처분 | `spec/conventions/node-output.md` `context.rawConfig 의 mutation 보호` 절 | 향후 `node-output.md` 개정 시 `adapted.config` aliasing 계약 한 줄 추가 권장(비차단) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | DB 원문 저장 노출 확대 + safe-by-convention 전환(둘 다 기지·수용된 trade-off), 크로스노드 릴레이/패턴 비대칭은 INFO |
| requirement | LOW | 기능 구현이 CHANGELOG·spec R-5 와 line-level 일치 확인, 공유 워크트리 뮤테이션 잔여물 관찰(비결함) |
| scope | LOW | 단일 목적(config echo 마스킹 이관) 준수, doc-link 곁다리 실측 1건은 기지 처분 사안 |
| side_effect | LOW | aliasing/DEEP_REDACT_CACHE 재확인 전부 유효, predecessor 시딩 경로 신규 INFO 관찰 1건 |
| maintainability | LOW | 핵심 로직 단순화 확인, 반복 INFO 3건(주석 길이·근접중복·캐스트 중복) 형태 변화 없이 유지 |
| testing | LOW | 포함관계·참조저장 캐너리 뮤테이션으로 직접 재현 성공(111 passed, 뮤테이션 시 정확히 RED), e2e 갭은 기지 사안 |
| documentation | NONE | JSDoc/CHANGELOG/spec 정합 철저, 신규 문서화 결함 없음. mutation-보호 절 갱신 미반영만 INFO |

## 발견 없는 에이전트

(없음 — 전 에이전트가 최소 INFO 이상 보고. 단 documentation 은 위험도 NONE 판정)

## 권장 조치사항
1. (비차단, 후속 트래커 유지) `NodeHandlerOutput.config` 에 raw/masked 구분 브랜디드 타입 또는 lint 규칙 도입 검토 — safe-by-convention 전환의 컴파일 타임 안전망 보강.
2. (비차단) `spec-sync-external-interaction-api-gaps.md` 또는 `13-replay-rerun.md` C3 에 "이 PR 이전 실행을 predecessor 로 시딩하면 config 가 여전히 마스킹값" 한 줄 부기.
3. (비차단) DB 백업/리포팅·ETL 파이프라인이 `config` 원문을 재유출하지 않는지 별도 점검 항목으로 등재.
4. (선택) `node-output.md` mutation-보호 절에 `adapted.config` aliasing(핸들러→엔진 캐시 방향) 계약 한 줄 추가.
5. (선택, 강제 아님) egress 게이트웨이 함수(`maskWireEnvelope`/`redactStoredDataForResponse`)를 실제로 통과하는 e2e 테스트 1건 추가 검토.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — prompt 상 `routing: skipped`. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7개 reviewer 전원 실행 및 전문 확보 확인, 미이행 없음.
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전원 forced)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 — forced 전원 결과 확보됨, 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |