# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — REST `getStatus` 의 `nodeOutput` fail-open → fail-closed 전환 자체는 견고하게 구현됐으나, 동일 필드가 새는 **WebSocket fanout 병렬 표면이 아직 닫히지 않았고**(이미 문서화·추적된 잔여, 이번 PR 의 blocking 사유는 아님), 구현 완료를 반영하지 못한 **stale JSDoc**·확립된 관례에 반한 **CHANGELOG 누락** 2건이 남아 있다. CRITICAL 발견사항은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SSE/WebSocket fanout 경로는 여전히 fail-open deny-list(`llmCalls` 한 칸) — 동일 `NodeHandlerOutput` shape 의 `_retryState`류 필드가 WS `EXECUTION_WAITING_FOR_INPUT` 채널로는 계속 샌다. `FormInteractionService.waitForFormSubmission`/`ButtonInteractionService.waitForButtonInteraction` 이 아무 필터 없이 `nodeOutput`/`buttonConfig.nodeOutput` 을 실어 `WebsocketService.toFanoutEnvelope()` 를 지나가는데, 이 경로엔 `allowlistNodeOutputKeys` 가 배선돼 있지 않다. REST 와 WS 는 동일 인가(`verifyOwnership`)를 쓰는 동일 수신 인구다 | `codebase/backend/src/modules/websocket/websocket.service.ts` (`toFanoutEnvelope`), `codebase/backend/src/modules/execution-engine/form-interaction.service.ts` (`waitForFormSubmission`), `codebase/backend/src/modules/execution-engine/button-interaction.service.ts` (`waitForButtonInteraction`) | `toFanoutEnvelope()` 에 `allowlistNodeOutputKeys` 를 `nodeOutput`/`buttonConfig.nodeOutput` 서브트리에 대칭 적용하거나, WS emit 직전 호출부에서 동일 헬퍼를 명시 호출. 이미 spec(§R17 표)·plan(`spec-sync-external-interaction-api-gaps.md`)에 후속 항목으로 등재돼 이번 PR 의 blocking 사유는 아니나, 후속 PR 착수 전 이 WARNING 을 그대로 인계할 것 |
| 2 | Architecture | `shared/utils` 레이어(기존 순수 제네릭·다중 소비자 유틸)가 도메인 타입(`nodes/core`)에 결속된 단일 소비자(`interaction.service.ts` 한 곳만 사용) 로직을 흡수 — 계층 방향 역전(하위 계층이 상위/도메인 타입 참조), 파일 응집도 저하. `import type` 이라 런타임 순환참조는 없어 CRITICAL 은 아님 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:1`(신규 `NodeHandlerOutput` type import), `:138-192`(`NODE_OUTPUT_ALLOWED_KEYS`/`assertAllowlistCoversHandlerContract`/`allowlistNodeOutputKeys`) | 별도 파일(예: `shared/utils/node-output-allowlist.ts`, 또는 `external-interaction/` 하위)로 분리해 범용 `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 와 물리적으로 격리 |
| 3 | Architecture, Documentation | `getStatus()` 메서드 상단 JSDoc 이 "`outputData`/`nodeOutput` 키-allowlist 는 별개 잔여 항목" 이라고 서술하는데, 바로 이 PR 이 그 메서드 본문에 `allowlistNodeOutputKeys(...)` 를 배선해 이미 구현했다. JSDoc 은 갱신되지 않아 "미구현" 이라는 잘못된 사실을 전달 — spec §R17 표는 정확히 갱신됐는데 이 JSDoc 한 줄만 stale 화됨 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:315` | "`outputData`/`nodeOutput` 키-allowlist 는 `getStatus` waiting 출구 1곳에 fail-closed 로 적용됨(SSE/fanout·terminal 출구는 잔여, spec R17 표 참조)" 로 정정 |
| 4 | Documentation | 동일 표면(`getStatus`/`nodeOutput`)에 대한 선행 보안 수정(`llmCalls` fanout 누출, `CHANGELOG.md:424`)은 발견 배경·영향 범위(운영 경고)까지 포함해 CHANGELOG 항목을 남겼는데, 성격이 동일한 이번 발견(`_retryState` 가 같은 deny-list 한 칸으로 새고 있었음)에는 CHANGELOG 항목이 없다 — 이 저장소가 필드-스트립 보안 수정마다 예외 없이 지켜온 관례 이탈. 과거에 이미 노출됐을 수 있는 데이터에 대한 운영 경고가 어디에도 남지 않는다 | `CHANGELOG.md` (신규 항목 부재) | `llmCalls` 항목과 동일 형식으로 `## Unreleased` 절 추가 — 발견 배경·수정 내용(fail-closed allowlist, `getStatus` 1곳 한정, SSE/fanout 잔여)·과거 노출 데이터 영향 범위 포함 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | plan 상위 트래커(`spec-sync-external-interaction-api-gaps.md`)는 이미 `[x]` flip + 종결 근거가 적혀 있는데, 하위 plan 의 작업 체크리스트 항목은 미체크로 남아 있음 | `plan/in-progress/nodeoutput-allowlist.md:84` | `[x]` 로 flip |
| 2 | Requirement | `NODE_OUTPUT_ALLOWED_KEYS` JSDoc 의 "타입에서 파생" 표현은 실제로는 손으로 맞춘 리터럴 배열 — 컴파일타임 assertion 은 누락만 검출하고 초과분(예: 타입에서 키 제거)은 감지 안 함. fail-closed 방향이라 보안 리스크는 아님(이미 consistency-check INFO 로 추적 중) | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:107` 부근 JSDoc | spec 착지 시 JSDoc 표현만 정정 권고 |
| 3 | Testing | `allowlistNodeOutputKeys` 에 `__proto__`/prototype-pollution 회귀 테스트가 없음 — 자매 함수 `stripExternalOnlyFields` 는 명시적 케이스 2건을 가짐. `__proto__` 는 애초에 allowlist 밖이라 fail-closed 로 자동 차단되어 실질 위험은 낮으나, 구현 방식이 바뀌면 조용히 뚫릴 수 있음 | `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts:189`, 구현 `strip-external-only-fields.ts:179-192` | 자매 테스트와 동일 형태 `__proto__` 케이스 추가, `Object.getPrototypeOf(out) === Object.prototype` 고정 |
| 4 | Testing | `buttons` variant(`context.buttonConfig.nodeOutput`)에 대한 allowlist 적용 직접 캐너리 없음 — 현재는 `form`/`buttons` 두 분기가 같은 `out` 참조를 재사용해 사실상 안전하지만, 향후 분기가 독립적으로 재가공되면 회귀를 못 잡음 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:424-435`, 테스트 `interaction.service.spec.ts:588-611` | 기존 buttons 테스트 fixture 에 `_retryState` 추가해 `r.context.buttonConfig.nodeOutput` 에서 사라지는지 단언 보강 |
| 5 | Testing | terminal `result`/`error` 출구가 allowlist 미적용이라는 설계 경계가, 의도 명시 캐너리가 아니라 기존 무관 테스트의 부수 효과로만 커버됨 | `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:509-527`, 구현 `interaction.service.ts:459-466` | `[캐너리] terminal result 는 nodeOutput allowlist 를 받지 않는다` 형태로 의도 명시 테스트 추가 |
| 6 | Maintainability | 컴파일타임 결속 assertion(`PublicHandlerOutputKey extends ... ? true : never = true`)이 한 줄에 밀집돼 있어 이 TS 관용구에 익숙하지 않으면 판독이 느림 | `codebase/backend/src/shared/utils/strip-external-only-fields.ts:165` | 조건부 타입을 여러 줄로 분리하거나 근접 주석 추가 |
| 7 | Maintainability | `allowlistNodeOutputKeys` 가 형제 함수 `stripDeep` 의 `__proto__` 방어 관례(`Object.defineProperty`)를 따르지 않고 `delete out[k]` 를 사용 — 실제로는 `[[Delete]]` 라 안전하지만 그 판단 근거가 코드에 없음 | `strip-external-only-fields.ts:179-192` vs `:230-243`(`stripDeep`) | `delete` 가 안전한 이유(own-property `[[Delete]]`, 대입 전용 accessor 문제와 무관) 근거 주석 1줄 추가 |
| 8 | Maintainability | `it.each([...NODE_OUTPUT_ALLOWED_KEYS])` 구현 상수 파생 vacuous 테스트가, 리터럴 대조 캐너리 추가로 완화됐지만 원본 형태 그대로 파일에 남아있음 — 향후 캐너리 쪽만 삭제되면 vacuous 패턴 재발 가능 | `strip-external-only-fields.spec.ts:259-265` | 리터럴 캐너리(235-257)와의 의존 관계를 상호참조 주석으로 명시 |
| 9 | Side Effect | 공개 REST 응답(`getStatus` waiting `nodeOutput`)의 필드 구성이 fail-closed 로 좁아짐 — 의도된 인터페이스 변경(spec/plan 에 범위 명시)이지만, 문서화되지 않은 다른 최상위 키에 의존하던 미지 외부 소비자가 있다면 그 필드를 조용히 잃음 | `interaction.service.ts:392-394` | 조치 불요 — spec §R17 표·plan 트래커로 문서화 요건 충족, 참고용 기록 |
| 10 | Side Effect | 신규 export `NODE_OUTPUT_ALLOWED_KEYS` 가 `Object.freeze` 없이 모듈 레벨 배열로 노출 — 보안 경계 상수인데 변형 방어 없음(자매 상수 `EXTERNAL_STRIPPED_FIELDS` 도 동일 패턴이라 신규 위험은 아님) | `strip-external-only-fields.ts:138-150` | 후속으로 `EXTERNAL_STRIPPED_FIELDS` 와 함께 `Object.freeze` 고려(이 PR 범위 밖) |
| 11 | Architecture | 내부 필드 제외 목록("`_resumeState`/`_retryState` 는 internal")의 SoT 가 정의 지점(`NodeHandlerOutput`)이 아니라 소비 지점(`shared/utils` 의 `Exclude<...>`)에 있음 — 현재는 컴파일타임 assertion 으로 안전 | `strip-external-only-fields.ts:160-164` | `node-handler.interface.ts` 에 `PublicNodeHandlerOutput` 표준 별칭 도입 고려(필수 아님) |
| 12 | Performance | `allowlistNodeOutputKeys` 의 허용 키 판정이 `Array.includes()`(선형 탐색) — 9개 리터럴·소수 최상위 키라 실질 비용은 무의미하나, waiting 폴링이 잦은 경로라 `Set` 전환이 의도를 더 명확히 함 | `strip-external-only-fields.ts:184,187` | `Set` 으로 전환해 `O(1)` 탐색(순수 마이크로 최적화, 우선순위 낮음) |
| 13 | API Contract | REST(`getStatus`)와 SSE(`toFanoutEnvelope`) 가 이제 서로 다른 `nodeOutput` 필터 강도(fail-closed vs fail-open)를 가짐 — 위 보안 WARNING #1 과 동일 근본 이슈이나, API 계약 관점에서는 spec §R17 표·후속 트래커로 이미 문서화돼 있어 "미문서화된 채 갈라짐" 위험은 해소됨 | `interaction.service.ts:392`, `spec/5-system/14-external-interaction-api.md:1739`(R17 표) | 조치 불요(이미 반영) — SSE allowlist 대칭화 후속 PR 착수 시 비대칭 해소 여부 재확인 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | WS fanout 경로가 REST 와 달리 여전히 fail-open — 동일 인가 인구에 `_retryState` 노출 잔존(이미 추적 중) |
| performance | NONE | 추가 순회는 최상위-only 얕은 스캔, 알고리즘/메모리/I/O 리스크 없음(마이크로 최적화 INFO 1건) |
| architecture | LOW | shared/utils 계층 방향 역전 + `getStatus` JSDoc stale |
| requirement | NONE | fail-open→fail-closed 전환 정확 구현, spec·plan·테스트 정합 확인. 문서 정확성 INFO 2건 |
| scope | NONE | 커밋 2개 모두 명시 범위 내, scope creep 없음(무관 오타 수정도 의도적으로 배제) |
| side_effect | LOW | 의도된 REST 응답 필드 축소(문서화됨) + 신규 상수 freeze 없음 |
| maintainability | LOW | 근접 주석 부재 3건(assertion 판독성·`delete` 안전 근거·vacuous 원본 잔존) |
| testing | LOW | 캐너리·뮤테이션 검증 견고하나 `__proto__`/buttons variant/terminal 경계 회귀 갭 3건(저비용 보강 가능) |
| documentation | MEDIUM | `getStatus` JSDoc stale + CHANGELOG 관례 이탈(과거 노출 데이터 운영 경고 부재) |
| api_contract | LOW | REST/SSE 필터 강도 비대칭(이미 spec 문서화), breaking change 아님(확인됨) |
| user_guide_sync | NONE | doc-sync-matrix 20건 전수 대조, 매칭 trigger 0건 — 동반 갱신 누락 없음 |

## 발견 없는 에이전트

- **scope**: 두 커밋 모두 diff 범위가 작업 의도와 정확히 일치, scope creep·무관 리팩토링·drive-by 변경 없음.
- **user_guide_sync**: doc-sync-matrix 20개 trigger 전수 대조 결과 매칭 0건(코드 변경이 `nodes/**`·`frontend/**`·`auth/**` 등 문서 동반 갱신 대상 밖).

## 권장 조치사항
1. (WARNING #1) WS fanout 경로(`toFanoutEnvelope`, `waitForFormSubmission`, `waitForButtonInteraction`)에 `allowlistNodeOutputKeys` 를 대칭 적용 — 이미 후속 트래커에 등재된 항목이므로 다음 착수 우선순위로 인계.
2. (WARNING #3) `interaction.service.ts:315` `getStatus()` JSDoc 의 "별개 잔여 항목" 서술을 실제 구현 상태로 정정.
3. (WARNING #4) `CHANGELOG.md` 에 `llmCalls` 선례와 동일 형식으로 이번 보안 강화 항목 추가(발견 배경·수정 내용·과거 노출 데이터 영향 범위).
4. (WARNING #2) `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 를 도메인 무관 유틸 파일에서 분리해 `shared/utils` 의 계층 방향을 복원.
5. (INFO, 저비용) 테스트 갭 3건(`__proto__` 회귀, buttons variant 캐너리, terminal 경계 의도 명시) 보강 — 특히 `__proto__` 케이스는 이 파일의 기존 컨벤션과 정합을 맞추는 차원에서 권장.
6. (INFO) `plan/in-progress/nodeoutput-allowlist.md:84` 체크박스 flip으로 plan 상태 동기화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync` (11명)
  - **제외**: 표 (reviewer · 이유, 3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — forced 전원 결과 확보됨, 누락 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터 판단(diff 가 backend 서비스/유틸 로직 필터링에 국한, 신규 패키지·버전 변경 없음) |
  | database | 라우터 판단(스키마·쿼리·마이그레이션 변경 없음) |
  | concurrency | 라우터 판단(동시성 제어·락·트랜잭션 변경 없음) |