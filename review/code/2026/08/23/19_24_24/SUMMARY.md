# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 이번 diff 자체(REST `getStatus` waiting 출구에 fail-closed allowlist 추가)는 CRITICAL 0·구조/테스트 품질 양호로 견고하지만, security reviewer 가 재확인한 대로 **같은 클래스의 내부 필드(`_retryState` 등)가 WebSocket `EXECUTION_WAITING_FOR_INPUT` fanout 경로로는 여전히 필터 없이 나간다** — 이번 PR 이 새로 만든 회귀는 아니고 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 추적되고 있지만, REST 와 동일 인가·동일 수신 인구를 갖는 실질 노출이 코드로는 아직 닫히지 않았다는 사실 자체가 MEDIUM 근거다. Critical 발견 없음, forced whitelist(`documentation, security, testing`) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | SSE/WebSocket fanout 경로는 여전히 fail-open deny-list(`llmCalls` 한 칸)만 거친다 — `FormInteractionService`/`ButtonInteractionService` 가 `nodeOutput`/`nodeOutputForEvent` 를 필터 없이 이벤트 payload 에 싣고, `WebsocketService.toFanoutEnvelope()` 는 `allowlistNodeOutputKeys` 를 호출하지 않는다. `_retryState`(재시도 continuation 상태, credential 아님) 가 REST 로는 막혔지만 WS 채널 구독자·chat-channel 어댑터에는 그대로 나간다. 이번 diff 가 새로 만든 회귀는 아니며 tracker 에 이미 등재돼 non-blocking. | `codebase/backend/src/modules/external-interaction/interaction.service.ts:392`(대조군, 닫힌 REST 출구); `codebase/backend/src/modules/execution-engine/form-interaction.service.ts:82-133`; `codebase/backend/src/modules/execution-engine/button-interaction.service.ts:369-421`; `plan/in-progress/spec-sync-external-interaction-api-gaps.md:72-87` | 후속 PR 에서 `toFanoutEnvelope()` 의 `nodeOutput`/`buttonConfig.nodeOutput` 서브트리에 `allowlistNodeOutputKeys` 를 대칭 적용하거나, `waitForFormSubmission`/`waitForButtonInteraction`(및 `processButtonResumeTurn`) 이 WS emit 직전 같은 헬퍼를 호출하도록 배선 |
| 2 | documentation | `node-output-allowlist.ts` JSDoc 이 `{@link EXTERNAL_STRIPPED_FIELDS}` 를 "위"(above) 심볼이라며 참조하지만, 이 상수는 이 파일에 선언·import 모두 없다(`strip-external-only-fields.ts` 에 정의). 직전 라운드 architecture WARNING 대응으로 코드를 분리하며 JSDoc 문구를 그대로 옮기고 위치 참조·`{@link}` 타깃을 갱신하지 않은 잔재 — 깨진/미해석 링크가 됨. | `codebase/backend/src/shared/utils/node-output-allowlist.ts:16` | `{@link EXTERNAL_STRIPPED_FIELDS}` 를 명시 import 하거나, "위" 를 "자매 파일 `strip-external-only-fields.ts` 의 `EXTERNAL_STRIPPED_FIELDS`" 처럼 파일명을 명시한 산문으로 정정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | `node-output-allowlist.ts` 가 `shared/utils/` 하위 8개 파일 중 유일하게 도메인 타입(`NodeHandlerOutput`)을 import — "shared = 도메인 비의존" 디렉토리 불변식이 국소화만 되고 완전히 회복되진 않음. `import type` 이라 런타임 순환은 없고 소비처도 1곳뿐이라 blocking 사유는 아님. | `codebase/backend/src/shared/utils/node-output-allowlist.ts:1` | 후속에서 유일 소비처 인근(`modules/external-interaction/`) 또는 `nodes/core/` 로 재배치, 혹은 `shared/` 하위에 domain-bound 서브폴더 신설 |
| 2 | security | `NODE_OUTPUT_ALLOWED_KEYS` 가 보안 경계 값인데 `Object.freeze()` 없이 export — `as const` 는 컴파일타임 리터럴 타입만 부여, 런타임 변형(`.push`/`.splice`) 방지 없음. 소비처 1곳뿐이라 즉시 위험 낮음, 자매 상수도 동일 패턴이라 이 PR 신규 위험 아님. | `codebase/backend/src/shared/utils/node-output-allowlist.ts:54` | `Object.freeze(NODE_OUTPUT_ALLOWED_KEYS)` 로 런타임 불변 강제 |
| 3 | testing | terminal `error` 출구는 `result` 와 코드가 완전히 대칭(`stripAndRedact` 단독, allowlist 없음)인데, 새로 추가된 "allowlist 를 받지 않는다(의도)" 캐너리는 `result` 에만 있고 `error` 에는 없음 — 여전히 기존 무관 테스트의 부수 효과로만 커버됨. | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:643`(신규 캐너리, `result` 만) vs `:567`(기존, 의도 명시 없음); 구현 `interaction.service.ts:459-466` | `interaction.service.spec.ts:643` 근처에 `error` 버전 캐너리 추가(`status: FAILED` + 임의 키 outputData) — 향후 두 출구 통합 리팩터링 시 회귀 누락 방지 |

**참고(발견 아님, 확인 결과 문제 없음)**: architecture — 컴파일타임 assertion 비대칭이 JSDoc·리터럴 테스트와 삼각으로 정합; deny-list→allowlist 파이프라인 SRP 유지. security — `allowlistNodeOutputKeys` 는 prototype pollution 벡터 아님(own-property `[[Delete]]`, `__proto__` 회귀 테스트로 고정). documentation — CHANGELOG 신규 항목·`getStatus` JSDoc·spec §R17·`egress-masking.md` SoT 위임 전부 직전 라운드 WARNING 정확히 반영. testing — `__proto__` 회귀·buttons 분기 캐너리·`delete` 안전 근거 주석·뮤테이션 예측/실측 기록·배선-유틸 캐너리 분리 모두 직전 라운드 지적사항 해소 확인.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | `shared/utils/` 계층 불변식 국소화(파일 배치 개선 여지), 그 외 설계 정합 |
| security | MEDIUM | WS/SSE fanout 경로 fail-open 잔존 — `_retryState` 등 여전히 노출(tracked, non-blocking) |
| documentation | LOW | `node-output-allowlist.ts` JSDoc 이 분리된 파일의 심볼을 깨진 `{@link}` 로 참조 |
| testing | LOW | terminal `error` 출구 캐너리가 `result` 와 비대칭(부수 효과 커버리지만 존재) |

## 발견 없는 에이전트

없음 — 4개 에이전트 모두 WARNING 또는 INFO 최소 1건 이상 보고.

## 권장 조치사항
1. (WARNING #1, security) `toFanoutEnvelope()` 의 `nodeOutput`/`buttonConfig.nodeOutput` 서브트리에 `allowlistNodeOutputKeys` 대칭 적용 — REST 와 동일한 fail-closed 보장을 WS fanout 경로로 확장 (이미 tracker 등재, 후속 PR 권장).
2. (WARNING #2, documentation) `node-output-allowlist.ts:16` 의 깨진 `{@link EXTERNAL_STRIPPED_FIELDS}` 참조를 명시 import 또는 파일명 명시 산문으로 정정 — 저비용, 이번 PR 내 즉시 반영 가능.
3. (INFO #3, testing) `interaction.service.spec.ts` 에 terminal `error` 출구용 "allowlist 미적용(의도)" 캐너리 추가 — `result`/`error` 커버리지 대칭화.
4. (INFO #1, architecture) 후속 정리로 `node-output-allowlist.ts` 를 `shared/utils/` 밖(유일 소비처 인근 또는 `nodes/core/`)으로 재배치 검토.
5. (INFO #2, security) `NODE_OUTPUT_ALLOWED_KEYS` 에 `Object.freeze()` 적용해 런타임 불변성을 JSDoc 의 "보안 경계" 주장과 일치시킴.

## 라우터 결정

라우터 미사용 — `routing_status=skipped` (사유 미제공). 전체 reviewer(`architecture`, `security`, `documentation`, `testing`) 실행.

- **실행**: `architecture`, `security`, `documentation`, `testing` (4명)
- **제외**: 없음
- **강제 포함(router_safety)**: `documentation`, `security`, `testing` — 3명 전원 결과 확보 확인됨(누락 없음)