# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 7개 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원 forced 목록대로 실행·결과 확보(누락 없음). 전부 INFO 수준 발견사항만 있으며, scope·side_effect·maintainability 3개 reviewer 가 자체 판정을 LOW 로 냈다(근거: 시그니처/프로토콜 변경 표면이 실재하지만 영향 재검증 결과 무해 확인). 이 changeset 은 이미 동일 세션 내 6라운드 `/ai-review`(1건의 CRITICAL 을 레벨 분리로 해소)를 거쳤고, 이번 7라운드 독립 재검증에서도 신규 CRITICAL/WARNING 은 발견되지 않았다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/설계 | `Execution.inputData`(최상위)는 egress 마스킹 대상에서 의도적으로 제외 — Re-run 재제출 소비처 보호 목적. 트리거 자유 텍스트의 자격증명은 계속 노출됨(webhook 민감 헤더는 이미 ingestion 시점 마스킹됨) | `executions.service.ts` `MASKED_INPUT_DATA_REASON`(58~92행 부근), `toResponseExecution`(1044~1046행) | 조치 불요(설계 결정, 이미 문서화·트래킹됨) |
| 2 | 보안 | 마커 멱등성(`isMaskedMarker`) 검사가 credential-key 분기에만 적용되고 값-패턴 정규식 치환(`redactSecrets`) 경로엔 미적용 — 이미 마스킹된 텍스트 안 잔여 접두어가 재마스킹될 수 있음(정보 노출 방향 아님, 표시 일관성 문제) | `sanitize-error-message.ts` `deepRedactObject`(credential-key 분기) vs `deepRedactCore` 문자열 leaf 처리 | 조치 불요. 필요시 `redactSecrets` 에도 마커 사전-검사 추가 가능(우선순위 낮음) |
| 3 | 보안/범위 | `emitKbEvent`/`emitBackgroundRunEvent` 는 이번 diff 의 새 값-패턴 마스킹 초크포인트(`maskWireEnvelope`)를 거치지 않고 기존 `sanitizePayloadForWs`(키-이름 기반)만 적용 — `emitBackgroundRunEvent` 의 `errorMessage` 는 호출부에서 이미 별도 sanitize 되어 실질 갭 아님. `emitKbEvent` 는 이번 changeset 선언 범위(§A) 밖 | `websocket.service.ts` `emitKbEvent`(약 310~324행), `emitBackgroundRunEvent`(약 449~465행) — 둘 다 diff 미변경 기존 코드 | 조치 불요(범위 밖, 회귀 아님). 후속 하드닝 후보로만 기록 |
| 4 | 요구사항/성능 | CHANGELOG 의 성능 수치("0.0181→0.0323ms, 1.78배")는 diff 내에서 재현 불가능한 별도 벤치마크 서술 | `CHANGELOG.md:52` | 조치 불요(성능 리뷰어 영역) |
| 5 | 범위 | plan lifecycle 하우스키핑(이전 세션 완료분 `in-progress→complete` 이동, 6줄 무변형 diff)이 이번 기능 커밋과 섞임 | `plan/complete/eia-internal-rest-error-masking.md`(신규, 이동) | 조치 불요. 커밋/PR 설명에 별개 사유 한 줄 명시 권장 |
| 6 | 범위 | 관련 없는 다른 plan 문서(`ie-resume-turn-boundary-cancel.md`)에 이번 §A 가 그 문서의 미해결 우려를 해소했다는 8줄 캐비엇 추가 — 코드 변경 없음, 정당한 cross-reference | `plan/in-progress/ie-resume-turn-boundary-cancel.md` | 조치 불요 |
| 7 | 범위 | `sanitize-error-message.ts` 내부 구조(`deepRedactCore`/`deepRedactObject`/`DeepRedactOptions`) 분리 — `preserveKeys` 옵션의 캐시 오염 방지 목적, §A 요구사항의 직접 파생 | `sanitize-error-message.ts` | 조치 불요(범위 내) |
| 8 | 범위 | `review/code/**`·`review/consistency/**` 산하 130여 개 신규 파일 — 프로젝트 상시 승인된 강제 review/fix 워크플로(6라운드)의 정본 산출물, 코드 diff 와 인과적으로 연결됨 | `review/code/2026/08/{16,17}/**`, `review/consistency/**` | 조치 불요(scope 위반 아님) |
| 9 | 부작용 | `deepRedactCore` 마커-멱등성 변경이 `deepRedactSecrets` 를 쓰는 이번 diff 밖 **기존** 호출부(`terminal-error-payload.ts`·`thread-renderer.ts`·`ai-turn-orchestrator.service.ts`·`interaction.service.ts`)에도 조용히 전파 — 영향은 "이미 마스킹 마커인 값은 재마스킹 안함" 뿐이라 안전 방향으로만 열림 | `sanitize-error-message.ts` `deepRedactCore` | 조치 불요. `MASKED_MARKERS` 확장 시 4개 기존 호출부 영향 재확인 권장 |
| 10 | 부작용/프로토콜 | WS `execution:<id>` wire envelope 이 인증된 내부(에디터) 구독자에게도 값-패턴 마스킹된 바이트로 감 — 구독 인가가 workspace 소유만 검사(role 무관)한다는 근거로 REST 와 인구 대칭을 맞춘 의도적 변경, `llmCalls` 는 예외 보존. CHANGELOG/spec/유저가이드에 캐비엇 반영됨 | `websocket.service.ts` `maskWireEnvelope` | 조치 불요. 프런트 에디터가 `error`/`input`/`output` 원문에 의존하는 파싱 로직이 있는지는 별도 확인 권장(범위 밖) |
| 11 | 부작용 | `ExecutionsService.stop()` 반환 계약 변경(엔티티→마스킹 관문 통과 복사본) — grep 재검증 결과 실제 소비 지점은 controller HTTP 응답 1곳뿐, 내부 호출부(`hooks.service.ts`, `interaction.service.ts`)는 반환값 미소비 | `executions.service.ts` `stop`/`stopInternal` | 조치 불요 |
| 12 | 부작용 | `ResponseExecution`/`ResponseNodeExecution`(내부 전용 타입) 시그니처 확장 — grep 재검증 결과 외부 import 소비자 0건 | `executions.service.ts` 타입 선언부 | 조치 불요 |
| 13 | 유지보수성/문서화 | 마커 3종(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`) 설명 대형 JSDoc 블록이 어느 심볼에도 공식 귀속되지 않는 고아 주석(사이에 별도 한 줄 JSDoc이 끼어듦) — **maintainability·documentation 양쪽에서 중복 지적**. 이미 이전 라운드(`00_47_01`)에서 발견·트래커 등재(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:293-299`)되었고 "등급 상향 금지"로 재확인된 기지(旣知) 항목 | `sanitize-error-message.ts:95-118`(대형 블록) / `:124`(`MASKED_MARKERS` 실제 대상) | 조치 불요(트래커 등재·수렴 규율 적용). 다음 편집 기회에 블록 위치 이동 권장 |
| 14 | 유지보수성 | `MASKED_INPUT_DATA_REASON` 런타임 미참조 상수를 `void` 로 살려 lint 통과 — 문서 앵커 전용 관용구, 위 주석으로 의도 명시됨 | `executions.service.ts:93-94` | 조치 불요 |
| 15 | 유지보수성 | 마스킹 관문 로직·문서가 이미 다책임인 `executions.service.ts`(1,140줄)에 순증 ~150줄 누적 | `executions.service.ts` 전체, 특히 `:57-123`, `:139-176`, `:1064-1113` | 즉시 조치 불필요. 규모 더 커지면 별도 유틸 추출 검토 |
| 16 | 유지보수성 | `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수 본문이 문자 그대로 동일 — 독립 describe 로 각각 테스트 고정된 의도적 선택("한쪽만 고쳐 갈리는" 결함 클래스 방지) | `redact-stored-error.ts:28-35`, `:66-71` | 조치 불요. 세 번째 자매 컬럼 등장 시 공통화 검토 |
| 17 | 테스트 | `emitNodeEvent` wire 마스킹 테스트가 결함 서사의 당사자 필드(`input`)가 아닌 `error` 로만 검증 — 메커니즘상(필드-불특정 전체 envelope 마스킹) 실질 위험 낮음. 이전 두 라운드부터 동일 논거로 INFO 유지 | `websocket.service.spec.ts` `②` 테스트 | 낮은 우선순위. `input: LEAKY_INPUT` 추가 시 결함 서사와 1:1 대응. 필수 아님 |
| 18 | 테스트 | `maskIfPresent` 의 `value == null` 방어 분기가 명시적 `undefined` 값 fixture 로 직접 실행되지 않음(`null` 케이스로 `==` 등가성에 의해 간접 커버) | `executions.service.ts` `maskIfPresent` | 조치 불요. 여유 있으면 `undefined as never` fixture 추가해 테스트로 고정 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | `Execution.inputData` 카브아웃(의도적)·마커 멱등성 값-패턴 미적용·KB/BackgroundRun emit 범위 밖. 신규 취약점 없음 |
| requirement | NONE | §A/§B/§D 선언 범위 완전 구현, spec 4개 문서와 line-level 일치. 성능 수치 재현 불가 서술만 INFO |
| scope | LOW | plan housekeeping 혼입·타 plan 캐비엇 추가·내부 구조 리팩터링·대량 review 산출물 — 전부 정당화됨, CRITICAL/WARNING 없음 |
| side_effect | LOW | 마커-멱등성 변경의 기존 호출부 전파(안전 방향)·WS wire 프로토콜 변경(문서화됨)·타입/반환 계약 변경(영향 없음 재검증) |
| maintainability | LOW | 관문 로직 수렴으로 "자매 표면 갈림" 결함 클래스 구조적 억제. JSDoc 귀속·파일 비대화 추세만 INFO |
| testing | NONE | 184/184 GREEN 직접 재실행 + 독립 뮤테이션(마커-보존 분기)으로 3개 파일 정확히 RED 재현. 신규 결함 없음 |
| documentation | NONE | CHANGELOG·JSDoc·Swagger·유저가이드·spec·plan 트래커 전수 대조 일치. JSDoc 귀속 문제만 기지 INFO(등급 상향 금지 확인) |

## 발견 없는 에이전트

없음 (전원 최소 1건 이상의 INFO 를 보고했으나 CRITICAL/WARNING 은 전무).

## 권장 조치사항

1. (선택, 낮은 우선순위) `websocket.service.spec.ts` `emitNodeEvent` wire 마스킹 테스트에 `input: LEAKY_INPUT` 을 추가해 결함 서사(WS/REST flip-flop)와 필드 수준까지 1:1 대응시킨다.
2. (선택) 다음에 `sanitize-error-message.ts` 를 편집할 기회에 마커 3종 설명 JSDoc 블록을 `MASKED_MARKERS` 선언 바로 위로 이동해 고아 주석 문제를 해소한다(트래커 등재 항목, 급하지 않음).
3. (모니터링) `executions.service.ts` 가 마스킹 관문 로직 누적으로 계속 커지는 추세 — 다음 마스킹 관련 변경 시 별도 유틸 추출 검토.
4. 그 외 항목은 전부 의도적 설계 결정이거나 이미 이전 라운드에서 검토·처분된 기지 사항이므로 추가 조치 불요.

## 라우터 결정

- `routing_status=all` (지정된 표기 그대로 — 실질적으로 라우터가 전체를 forced 처리):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, 전원 success)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (forced 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |