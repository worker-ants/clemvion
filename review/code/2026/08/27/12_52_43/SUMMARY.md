# Code Review 통합 보고서

## 전체 위험도
**LOW** — 핵심 코드 변경(config echo 마스킹을 어댑터→egress 전용으로 이관)은 5라운드에 걸친 독립 재검증에서 CRITICAL 0·신규 WARNING 만 발견됐고 전부 비차단(이미 추적 중이거나 미확증 이론적 리스크)이다. **단, 프로세스 측면에서 한 가지 짚을 사항이 있다** — 이번 라운드(`12_52_43`)의 forced whitelist 는 `meta.json` 기준 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`)인데, 과거 커밋(`ad166120d`, plan 종결)이 이 라운드를 "forced 전원 결과 확보"로 선언했을 당시 실제 디스크에는 `documentation.md`/`testing.md` 2건만 존재하고 나머지 5건(`maintainability`/`requirement`/`scope`/`security`/`side_effect`)은 없었다(requirement 리뷰어 발견, WARNING #2 참조). **이번 호출로 그 5건이 모두 생성되어 현재는 7/7 forced 전원 결과가 디스크에 존재**함을 확인했고, 그 7건 전체를 본 SUMMARY 가 통합했다. 다만 그 사이 나갔던 plan 종결 커밋의 "forced 미이행 없음" 서술 자체는 작성 시점 기준 부정확했으므로 별도 정정이 필요하다.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/아키텍처 | 자격증명이 노드 `config` 로 DB 에 평문 영속 — safe-by-construction(저장 시점 마스킹) → safe-by-convention(egress 헬퍼 통과 강제, 컴파일러 미보증) 전환. 워크스페이스 내 크로스-노드 자격증명 릴레이(한 노드의 평문 자격증명을 다른 노드 요청 body 로 실어 제3자 엔드포인트 전송) 가능해짐 | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`; `spec/2-navigation/14-execution-history.md:471-484`; `spec/conventions/egress-masking.md:54-57`; `spec/conventions/node-output.md:339-350` | 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 근본 처방(자격증명을 `llmConfigId` 같은 참조로 전환)이 등재돼 있음 — 계속 그 트래커로 추적. 신규 조치 불요 |
| 2 | 프로세스/거버넌스 | 이전 plan 종결 커밋(`ad166120d`)이 "이번 라운드(`12_52_43`) forced whitelist 전원 결과 확보"를 주장했으나, 그 시점 디스크에는 `documentation.md`/`testing.md` 2건만 있었고 `maintainability`/`requirement`/`scope`/`security`/`side_effect` 5건은 부재했음(`meta.json` 의 `agents_forced` 7명과 불일치) | `review/code/2026/08/27/12_52_43/meta.json`; `plan/complete/masking-expression-egress-split.md`(커밋 `ad166120d`) | 이번 호출로 5건 모두 생성되어 현재는 7/7 확보됨(본 SUMMARY 반영 완료). 다만 `ad166120d` 커밋 메시지의 "forced 미이행 없음" 서술은 작성 시점 기준 부정확했으므로, plan 문서 또는 후속 커밋에서 이 시점차를 명시적으로 정정할 것을 권고 |
| 3 | 스코프/거버넌스 (기지, 이미 처분) | mirror-sweep 종결 커밋(`23e1c91a0`)에 masking-egress 작업과 무관한 "doc-link 검사기 전제 정정" 실측이 곁다리로 포함됨 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:771-793` | 이미 이전 라운드(`12_00_05/scope.md`)가 지적했고 팀이 "머지된 커밋의 소급 분리는 하지 않는다"로 명시 처분한 기지 사안. 추가 조치 불요 — 향후 유사 상황에서는 커밋 전 분리 관행 유지 |
| 4 | 부작용/설계 (신규 관찰, 미확증) | 장기 참조로 유지되는 `config` 객체(이번 diff 로 `setStructuredOutput` 이 참조 그대로 캐시)와 egress 측 identity 기반 `WeakMap` 캐시(`DEEP_REDACT_CACHE`/`SANITIZE_CACHE`)의 "동일 identity ⇒ 동일 content" 전제가 이론상 약해질 수 있음(실제 재현 경로는 확증 못함) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:202,222-234`; `codebase/backend/src/modules/websocket/websocket.service.ts:102,115-129`(diff 대상 아닌 인접 코드); `execution-context.service.ts:141-168` | 핸들러가 향후 `config` 를 반환 후 변형할 경우의 리스크를 트래커에 한 줄 부기. 확정하려면 동일 execution 의 같은 노드에 대한 2차 emit/REST 조회에서 실제로 같은 `config` identity 가 재사용되는지 통합 테스트로 실측 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 이전 CRITICAL("포함관계 캐너리가 상수에서 파생되지 않음")이 `DEFAULT_SENSITIVE_KEYS` export + `it.each(KEYS)` 로 정확히 수정됨. REST(`deepRedactSecrets`)/WS(`deepRedactSecretsPreserving`) 가 동일 워커·`CREDENTIAL_KEY_PATTERN` 을 공유해 캐너리 대표성이 실측으로 확인됨(정규식 수기 대조, 22개 키 전부 일치) | `mask-sensitive-fields.util.ts:10`; `sanitize-error-message.ts:112-113,222-252,259-312`; `mask-sensitive-fields.util.spec.ts:139-153` | 없음 |
| 2 | 보안 | `handler-output.adapter.ts` 의 마스킹 제거 후에도 config echo 는 REST/WS 두 egress 지점에서만 가려지는 구조로 실질 갭 없음(WS 로컬 패턴이 놓쳐도 후속 공유 패턴이 잡음) | `handler-output.adapter.ts:53`; `websocket.service.ts:326-345,399-417,460-467`; `redact-stored-error.ts:4,34,70` | 없음 |
| 3 | 보안/부작용 | `_retryState`/`_resumeState` 의 credential 배제는 allow-list 기반이며 `maskSensitiveFields` boundary 와 무관 — 문서·구현 일치, 이번 diff 로 인한 회귀 없음(주석 정정만, 로직 불변) | `ai-turn-executor.ts:3361-3416`(`buildRetryState`) | 없음 |
| 4 | 요구사항 | spec 6개 문서가 line-level 로 코드와 일치(취소선+정정 블록), `llmConfigId` 등 config echo 필드 미열거를 grep 재확인(0건) | `spec/2-navigation/14-execution-history.md` 외 5개 spec 파일 | 없음 |
| 5 | 스코프 | 핵심 코드 변경 5개 파일이 "config echo 마스킹을 어댑터→egress 로 이관"이라는 단일 목적에 정확히 귀속 — 무관한 리팩토링/기능확장 없음 | `handler-output.adapter.ts`, `mask-sensitive-fields.util.ts`, `execution-context.service.{ts,spec.ts}` 등 | 없음 |
| 6 | 스코프 | spec 6개 파일 수정은 developer 권한 밖 CRITICAL(보안 Rationale 무효화)을 별도 "planner 턴" 커밋(`57fb83592`)으로 분리 처리 — 권한 경계 준수 | spec 6개 파일; 커밋 `57fb83592` | 없음 |
| 7 | 부작용/유지보수성 | `setStructuredOutput` JSDoc 이 hop1(어댑터 반환)/hop2(이 메서드의 참조 저장)를 정확히 분리하고 신규 캐너리(`toBe` identity + 변형 후 재확인)와 일치 — `12_28_26` W1 근본 해소 확인 | `execution-context.service.ts:141-168`; `execution-context.service.spec.ts` | 없음 |
| 8 | 부작용 | `DEFAULT_SENSITIVE_KEYS` export 는 순수 additive — 기존 런타임 소비처(`explore-tools.service.ts`)는 여전히 함수만 import, 하위 호환 유지. `adaptHandlerReturn` 호출부 6곳(기존과 동일) 전수 재확인, 신규 호출부 없음 | `mask-sensitive-fields.util.ts:10`; `explore-tools.service.ts`; `execution-engine.service.ts:6047,6625`; `ai-turn-orchestrator.service.ts:835,1086,1129,1194` | 없음 |
| 9 | 유지보수성 | 신규 캐너리 2건의 이중 타입 캐스트 반복(2회, 이 저장소 추출 임계선 3회 미달) / 1줄 코드에 23줄 인라인 주석 / 3파일 근접-중복 안전 서사 — 전부 이전 라운드부터 INFO 로 넘겨진 비차단 항목, 형태 변경 없이 유지 | `execution-context.service.spec.ts`; `handler-output.adapter.ts:30-52`; `handler-output.adapter.spec.ts:92-107`; `mask-sensitive-fields.util.spec.ts:102-137` | 3번째 유사 캐너리 추가 시 로컬 헬퍼로 추출 검토(강제 아님) |
| 10 | 문서화 | 4라운드 반복 재발했던 문서 결함 클래스(문법 깨진 주석, `node-output.md` stale 인용, `setStructuredOutput` JSDoc 참조 레벨 혼동, vacuous 빈 문자열 캐너리)가 이번 시점 기준 전부 해소됨을 직접 소스 대조로 확인 | `mask-sensitive-fields.util.ts:30-40`; `node-output.md:256`; `execution-context.service.ts:137-169`; `mask-sensitive-fields.util.spec.ts:160-165` | 없음 |
| 11 | 테스트 | `12_28_26` WARNING(참조-저장 계약 무방비)이 실제로 닫혔음을 뮤테이션 재현으로 독립 확인(`= { ...adapted }` 로 되돌리면 신규 캐너리가 정확히 RED, 직전 라운드 시점엔 66/66 GREEN 으로 무방비였음). 핵심 3개 spec 파일 111/111 GREEN, `explore-tools.service.spec.ts` 18/18 GREEN(회귀 없음) | `execution-context.service.spec.ts:236-272`; `execution-context.service.ts:168` | 종전 WARNING CLOSED 로 표기 가능 |
| 12 | 테스트 (기지, 비차단) | 안전 주장 캐너리 전량이 실제 egress 진입점(`redactStoredDataForResponse`, `maskWireEnvelope`)이 아니라 공유 저수준 함수(`deepRedactSecrets`)를 직접 호출 — 여러 라운드에 걸쳐 이미 추적된 기존 갭, 신규 아님 | `handler-output.adapter.spec.ts:179-215`; `mask-sensitive-fields.util.spec.ts:145-153` | 없음(별건 트래커 `api_contract.md` 에 이미 등재) |
| 13 | 부작용/요구사항 | 신규 백로그 항목(자격증명 참조 간접화 검토, `chatChannel` 정규식 비대칭)은 "미판정"으로 명시 defer — over-engineering 회피, 코드 변경 없음 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:515-533` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 포함관계 캐너리·egress 두 지점의 안전 전제를 정규식/코드 직접 대조로 재검증, CRITICAL 없음. 잔존 DB 평문 저장 트레이드오프는 WARNING #1 로 기추적 |
| requirement | LOW | 기능 구현이 spec 6개와 line-level 일치. 프로세스 커버리지 갭(WARNING #2, 과거 커밋 시점) 발견 |
| scope | LOW | 핵심 변경 5개 파일이 단일 목적에 정확히 귀속, 스코프 이탈 없음. 기지 곁다리 사안(WARNING #3) 재확인 |
| side_effect | LOW | `setStructuredOutput` aliasing 계약이 JSDoc·구현·캐너리 3자 일치. WeakMap 캐시 상호작용 신규 관찰(WARNING #4, 비차단) |
| maintainability | LOW | 핵심 로직이 오히려 단순화됨. 사소한 중복/주석 길이 INFO 만 잔존 |
| documentation | NONE | 4라운드 반복 재발했던 문서 결함 클래스가 이번 시점 기준 전부 해소됨을 직접 확인 |
| testing | LOW | 뮤테이션 재현으로 직전 라운드 WARNING 이 실제로 닫혔음을 독립 확인. 111/111 + 18/18 GREEN |

## 발견 없는 에이전트

(없음 — 전원 최소 INFO 이상 보고. CRITICAL 발견 에이전트는 없음)

## 권장 조치사항

1. (WARNING #2) `plan/complete/masking-expression-egress-split.md` 커밋(`ad166120d`)의 "forced whitelist 전원 결과 확보" 서술이 작성 시점 기준 부정확했음을 후속 정정 커밋 또는 plan 갱신으로 명시한다 — 코드 자체는 문제없으나 "완료 선언의 근거가 그 순간의 디스크 증거와 달랐다"는 프로세스 정합성 이슈이므로 기록을 맞춘다.
2. (WARNING #1) `spec-sync-external-interaction-api-gaps.md` 트래커에 등재된 자격증명 참조 간접화(`llmConfigId` 화) 항목을 후속 스프린트에서 실제 집행 검토한다.
3. (WARNING #4) config 객체 identity 재사용과 egress `WeakMap` 캐시 상호작용을 통합 테스트로 확정하고, 트래커에 리스크를 한 줄 부기한다.
4. (INFO #9) 3번째 유사 캐너리가 추가되는 시점에 이중 타입 캐스트를 로컬 헬퍼로 추출한다(현재는 강제 아님).
5. (WARNING #3) 이미 처분 완료 — 향후 유사 상황(리뷰 중 발견한 별건 실측)은 커밋 전 분리하는 관행을 유지한다.

## 라우터 결정

- `routing_status=skipped` (router 미사용 — forced whitelist 로 직접 실행).
- **forced whitelist** (`meta.json` `agents_forced`, 7명): `documentation, maintainability, requirement, scope, security, side_effect, testing`
  - 이번 호출의 `ran` 배치(5명): `security, requirement, scope, side_effect, maintainability` — 전원 `status=success`, 산출물 확보.
  - `documentation`, `testing` 2명은 이번 호출 이전(같은 `12_52_43` 라운드 내 선행 실행)에 이미 성공·산출물 확보 상태였음을 디스크에서 직접 확인(`documentation.md`: 위험도 NONE, `testing.md`: 위험도 LOW).
  - **결론: forced 7/7 전원 결과 확보** — 미이행 없음. 본 SUMMARY 는 7명 전체를 통합했다.
- **제외**: 없음.
- **강제 포함(router_safety)**: 위 7명 전원(라운드 자체가 router 를 쓰지 않고 forced whitelist 로 직접 실행됨).