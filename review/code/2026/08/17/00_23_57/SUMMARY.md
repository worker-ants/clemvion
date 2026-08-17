# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건, WARNING 1건(신규 테스트 JSDoc 의 표면 개수 자기모순). 7명 reviewer(security/requirement/scope/side_effect/maintainability/testing/documentation) 전원이 인라인 전문을 반환했고 누락 없음(documentation.md 는 본 통합 과정에서 디스크에 영속화 완료). forced 화이트리스트 7명 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | 신규 테스트 JSDoc 이 "네 표면에서 각각 고정한다"고 주장하지만 본문이 직접 나열한 항목(①findById·②findByWorkflow·⑥-b nodeExecutions[]·getChain·stop)을 세면 5개다 — 이 PR 이 근절하려던 "흩어진 표면 수치" 결함 클래스가 새 테스트 코드에 재발 | `codebase/backend/src/modules/executions/executions.service.spec.ts:1361-1368` | "네 표면"→"다섯 표면"으로 정정하거나, `nodeExecutions[]` 를 별도 카운트로 두는 전제를 명시해 나열과 결론 숫자를 일치시킨다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `kb:<documentId>`/`background:run:<id>` WS 채널이 `execution:`/`node:` 채널과 동일한 population-parity 근거(role 미검사, workspace 소유만 확인)에도 불구하고 값-패턴 마스킹(`maskWireEnvelope`)이 적용되지 않음 | `codebase/backend/src/modules/websocket/websocket.service.ts` `emitKbEvent`/`emitBackgroundRunEvent` | 기존 갭(이미 한 차례 평가·이연), 외부 fanout 없어 노출 제한적 — population-parity 근거로 후속 트래커 등재 권장 |
| 2 | 보안 | `inputData`(Execution/NodeExecution/BackgroundRun)는 의도적으로 값-마스킹 대상에서 제외 — Re-run 재제출 오염(CRITICAL) 방지를 위한 문서화된 트레이드오프 | `codebase/backend/src/modules/executions/executions.service.ts:83` `MASKED_INPUT_DATA_REASON` | 조치 불요 — 설계 의도, 이미 트래커 등재 |
| 3 | 보안 | `SECRET_LEAK_PATTERNS` 가 bare `token=` 키워드는 미탐지(access_token 등은 탐지) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:33` | 조치 불요 — 이미 별건 트래커 등재 + `.spec.ts` 캐너리로 고정됨 |
| 4 | 요구사항 | `maskIfPresent` 타입 시그니처가 null 가능성(`value == null` 분기)을 감추지만 대입 대상이 이미 `\| null` 허용해 실질 위험 없음 | `codebase/backend/src/modules/executions/executions.service.ts` `maskIfPresent` | 조치 불요 — 기존 결정("정적 계약과 런타임 방어 의도적 분리") 재확인 |
| 5 | 요구사항 | WS 키-이름 마스킹(`CREDENTIAL_KEY_PATTERN`)과 값-패턴 계층의 동명 패턴이 `x-api-key`/`x-auth-token` 등 인식 범위가 서로 다름(코드 주석이 이미 인지) | `websocket.service.ts:67-68` vs `sanitize-error-message.ts:84-85` | 조치 불요 — 값-패턴 계층이 실질적으로 갭을 메워 노출로 이어지지 않음 |
| 6 | 스코프 | `plan/in-progress/eia-internal-rest-error-masking.md` → `complete/` git rename 이 이번 선언 작업과 별개 사유로 같은 브랜치에 포함 | 커밋 `a8b0cbfdd` | 조치 불요 — 이전 두 라운드가 이미 INFO 로 수용 |
| 7 | 스코프 | `docs(spec)` 커밋에 마스킹 작업과 무관한 `nodeName`→`nodeLabel` spec drift 정정이 곁들여짐 | `spec/5-system/6-websocket-protocol.md` §4.1 | 조치 불요 — 직전 리뷰어 권고에 따른 것, plan 문서에도 사유 명시 |
| 8 | 유지보수성/문서화 | 마커(`VALUE_MASK_MARKER` 등) 관련 대형 rationale JSDoc 블록이 실제 심볼 바로 위가 아니라 중간에 낀 한 줄 JSDoc 앞에 위치해, TSDoc 툴링 기준으로 심볼에 공식 귀속되지 않음(2개 reviewer 중복 지적) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-118` | 조치 불요(저위험, typedoc 미도입) — 블록을 `MASKED_MARKERS`/`VALUE_MASK_MARKER` 바로 위로 재배치 권장 |
| 9 | 유지보수성 | `MASKED_INPUT_DATA_REASON` 을 런타임 미참조 "문서 앵커"로 두고 `void` 로 lint 회피 — 이 저장소에 흔치 않은 패턴이라 향후 오인 삭제 위험 | `codebase/backend/src/modules/executions/executions.service.ts:83-87` | 상수를 `export` 해 실제 import 로 참조하게 하거나 일반 block comment 로 대체 |
| 10 | 유지보수성 | 마스킹 관문 로직·문서가 `executions.service.ts`(1,124줄)에 계속 누적(이번 diff +~150줄) | `codebase/backend/src/modules/executions/executions.service.ts` | 즉시 조치 불요 — 후속 변경 규모 커지면 별도 모듈 추출 검토 |
| 11 | 부작용 | 전역 `WeakMap` 캐시(`DEEP_REDACT_CACHE`/`SANITIZE_CACHE`) 적용 범위가 `outputData`/`inputData` 컬럼까지 확장 | `sanitize-error-message.ts:158`, `websocket.service.ts:91` | 조치 불요 — 객체-identity 키라 교차 오염 없음. 향후 같은 참조를 마스킹 후 mutate 하는 호출부 추가 시 불변식 유지 필요 |
| 12 | 부작용 | WS wire envelope payload 바이트가 바뀌는 프로토콜 동작 변경(에디터 클라이언트가 원문 기대 시 영향) | `websocket.service.ts:387` `maskWireEnvelope`, `:408` `toFanoutEnvelope` | 조치 불요 — CHANGELOG/spec/유저가이드에 이미 통지·반영됨 |
| 13 | 부작용 | `ResponseExecution`/`ResponseNodeExecution` 타입의 `outputData` 가 non-null → `\| null` 로 확장(공개 타입 시그니처 변경) | `executions.service.ts:147,162` | 조치 불요 — 실제 타입 소비자 0건 재확인 |
| 14 | 부작용 | `ExecutionsService.stop()` 반환값이 마스킹되지 않은 엔티티 참조 → 마스킹된 복사본(`ResponseExecution`)으로 변경 | `executions.service.ts:900` | 조치 불요 — 내부 호출부 3곳 반환값 미사용 재확인 |
| 15 | 테스트 | CHANGELOG 의 perf 주장(N=3000, 0.0181→0.0323ms)을 고정하는 자동 회귀 테스트 없음 | `websocket.service.spec.ts` | 필수 아님 — 절대값 작아 실사용 영향 미미, 이 저장소의 기존 관례(perf 서술로만 고정) 범위 |
| 16 | 테스트 | `llmCalls` wire 보존이 `emitExecutionEvent` 경로에서만 검증되고 `emitNodeEvent` 경로는 짝이 없음 | `websocket.service.spec.ts:1061` 부근 | 대칭성 필요 시 `emitNodeEvent` 에도 동일 케이스 추가 — 공유 private 메서드라 위험 낮아 필수 아님 |
| 17 | 테스트 | `maskIfPresent` 의 `value == null` 분기가 명시적 `undefined` 리터럴 fixture 로는 검증되지 않음(`null` 만 사용) | `executions.service.ts` `maskIfPresent` / `executions.service.spec.ts` | 기능적으로 동일 경로(`==`)라 실질 갭 아님 — fixture 추가 시 문서 주장과 1:1 대응 |
| 18 | 문서화 | plan 체크리스트 "B — 회귀 테스트 8개" 가 최종 diff 실측(12개: `it(` 10개 + 2개)과 어긋남 | `plan/in-progress/eia-fanout-and-internal-data-masking.md` | 필수 아님(내부 작업 로그) — 다음 정정 라운드에서 실제 개수로 갱신 권장 |
| 19 | 문서화 | `run-results.mdx`/`.en.mdx` Error 탭 설명이 마스킹 사실을 언급하지 않음(Output 행만 이번 PR 에서 캐비엇 추가) | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:75` 및 EN 대응 행 | 필수 아님 — 이번 PR 은 의도적으로 Output 행만 반영(RESOLUTION.md round 2). 후속 항목으로 Error 행에도 캐비엇 추가 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | kb:/background:run: WS 채널 미마스킹(population-parity 비대칭, 기존 갭) · inputData 비대상 결정 재확인 · bare `token=` 미탐지(기추적) |
| requirement | NONE | spec §R17 6-surface·inputData 비대상·WS wire+fanout 적용이 spec 과 line-level 일치. INFO 2건(재확인성) |
| scope | LOW | 실질 코드 변경은 `inputData` 마스킹 철회 커밋(b05756d9e) 하나로 국한, CRITICAL 되돌림의 정확한 정정. plan rename·spec drift 곁들이기는 기존 라운드가 이미 수용 |
| side_effect | LOW | WeakMap 캐시 범위 확장·WS wire 바이트 변경·타입 확장·stop() 반환 계약 변경 — 전부 문서화·영향범위 재검증됨, mutate 없음 |
| maintainability | LOW | JSDoc 블록 연결 누락·`void` 앵커 관용구·서비스 파일 누적 — 전부 저위험 INFO, 구조는 공통 관문으로 잘 수렴 |
| testing | LOW | 184/184 PASS, mutation 검증으로 신규 테스트 유효성 확인. perf 회귀 자동화·`emitNodeEvent` llmCalls 비대칭·undefined fixture 는 INFO |
| documentation | LOW | 4중 문서 동기화(CHANGELOG/spec/Swagger/유저가이드) 매우 높은 수준. 유일 결함: 신규 테스트 JSDoc 표면 개수 자기모순(WARNING) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO/WARNING 발견사항을 보고함(단, 전원 실질적 결함은 없다고 판정).

## 권장 조치사항
1. `codebase/backend/src/modules/executions/executions.service.spec.ts:1361-1368` 의 JSDoc "네 표면" 표현을 실제 나열 항목 수(5개)와 일치하도록 정정 — 이 PR 이 근절하려는 결함 클래스의 재발이므로 우선 처리.
2. (선택) `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트의 "회귀 테스트 8개" 수치를 실측(12개)으로 갱신.
3. (선택, 후속 백로그) `kb:`/`background:run:` WS 채널에도 population-parity 근거로 `maskWireEnvelope` 적용을 검토해 트래커에 등재.
4. (선택) `sanitize-error-message.ts` 의 마커 rationale JSDoc 블록을 `VALUE_MASK_MARKER`/`MASKED_MARKERS` 바로 위로 재배치.

## 라우터 결정

- **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명, `routing=all`)
- **제외**: 없음(0명)
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 전원 — 사실상 전 reviewer 가 forced 화이트리스트에 포함되어 실행됨. forced 전원 결과 확보 확인됨 — 강제 화이트리스트 미이행 없음)

| 제외된 reviewer | 이유 |
|------------------|------|
| (없음) | — |