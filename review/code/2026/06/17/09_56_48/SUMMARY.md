# Code Review 통합 보고서

리뷰 대상: C-1 step3 — `FormInteractionService` + `ButtonInteractionService` 추출 (strangler-fig)
세션: `2026-06-17T09:56:48`
변경 파일 7개: `button-interaction.service.{ts,spec.ts}`, `form-interaction.service.{ts,spec.ts}`, `execution-engine.service.{ts,spec.ts}`, `execution-engine.module.ts`

---

## 전체 위험도
**MEDIUM** — 기능·아키텍처·범위는 양호하나 `FormInteractionService` 테스트에 이벤트 emit/ConversationThread append/보안 whitelist 검증이 누락됨

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `FormInteractionService` spec — `processFormResumeTurn` 의 `emitNode`/`EXECUTION_RESUMED` 이벤트 emit 어서션 부재. button spec 은 검증하지만 form spec 는 완전히 누락돼 이벤트 버스 연결이 끊겨도 테스트가 통과함 | `form-interaction.service.spec.ts` — `processFormResumeTurn — 4 branches` 블록 전체 | `(a) sentinel form_submitted` 케이스에 `expect(mockEventEmitter.emitNode)` + `expect(mockEventEmitter.emitExecution)` 어서션 추가 |
| 2 | Testing | `FormInteractionService` spec — `appendPresentationInteraction`(ConversationThread) 어서션 부재. button spec 은 `appendSpy` 로 검증하나 form 쪽은 spy/expect 없어 §2.1 단일 mutation entrypoint 위반을 감지 못함 | `form-interaction.service.spec.ts` 전체 | `(a)` 케이스에 `jest.spyOn(conversationThreadService, 'appendPresentationInteraction')` + expect 추가 |
| 3 | Testing | `FormInteractionService` spec — WARN #8 보안 whitelist 필터(허용 필드만 통과) 테스트 미존재. XSS payload·임의 키 주입 방어 경로 회귀 보호 없음 | `form-interaction.service.spec.ts` | (1) 미허용 필드 포함 시 interactionData 에서 제거됨 검증, (2) `config.fields=[]` 일 때 모든 키 통과(`allowedFieldNames.size === 0`) 검증 케이스 추가 |
| 4 | Architecture | 엔진 ↔ 추출 서비스 양방향 `forwardRef` 순환 DI 누적. strangler-fig 과도기 불가피 상태이나 신규 서비스가 동일 패턴 누적 시 DI 그래프 복잡도가 이후 분리를 더 어렵게 만듦 | `execution-engine.service.ts` 생성자, `form-interaction.service.ts`, `button-interaction.service.ts` 생성자 | strangler-fig 완료 단계에서 엔진이 서비스를 주입받는 방향 제거 계획 백로그 등록. 단기: `EngineDriver` 인터페이스에 "임시 구조, 엔진 슬림화 완료 시 제거 예정" 주석 명시 |
| 5 | Side Effect | `ENGINE_DRIVER` forwardRef 순환 DI 초기화 순서 불일치. `FormInteractionService`/`ButtonInteractionService` 의 `@Inject(ENGINE_DRIVER)` 에 `forwardRef` 래퍼 없어 두 서비스가 엔진보다 먼저 초기화 시도 시 `ENGINE_DRIVER` 미 resolve 가능. `AiTurnOrchestrator` 선례 동일 패턴 검증돼 실질 위험은 낮으나 일관성 부재 | `form-interaction.service.ts` L946, `button-interaction.service.ts` L622 | `AiTurnOrchestrator` 의 `@Inject(ENGINE_DRIVER)` 패턴과 일관성 확인 후 동일하다면 INFO 로 낮출 수 있음. 다르다면 `@Inject(forwardRef(...))` 형태 검토 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `button_continue` data 에 `selectedItem` 추가 — spec 미기재. carousel item-level link 버튼 합리적 확장이나 `spec/conventions/node-output.md §4.5` 및 `spec/5-system/4-execution-engine.md §1.3` 미반영 | `button-interaction.service.ts` L856-862, `button-interaction.service.spec.ts` L362-397 | 코드 유지. `node-output.md §4.5` `button_continue` 행을 `{ buttonId, buttonLabel, url?, selectedItem? }` 로 갱신 + `4-execution-engine.md §1.3` 표 동기화 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `waitForButtonInteraction`/`waitForFormSubmission`/`processFormResumeTurn`/`processButtonResumeTurn` 구현 위치 이동 후 `spec/5-system/4-execution-engine.md` 미갱신. plan `c1-engine-split.md §spec 갱신` 에서 PR4 체인 종료 시 일괄 반영으로 의도적 이연 결정 | `spec/5-system/4-execution-engine.md` L83, L777 | 코드 유지. PR4(RetryTurnService) 완료 후 `project-planner` 가 `§1.3·§7.5` 메서드 포인터 반영 |
| 3 | Architecture | `EngineDriver` 인터페이스 ISP 위반 — 소비자 실사용 3개 메서드 vs 노출 7개 | `engine-driver.interface.ts` | 단기: 각 소비자 사용 메서드 그룹 주석 구분. 중기: 소비자별 부분 인터페이스 분리 |
| 4 | Architecture | 두 인터랙션 서비스 생성자 시그니처 동일 5개 의존성 중복 (의도적 결정) | `form-interaction.service.ts`, `button-interaction.service.ts` 생성자 | 세 번째 인터랙션 타입 추가 시 `BaseInteractionService` 추상 클래스 도입 고려 |
| 5 | Architecture | `processButtonResumeTurn` 내 `payload: unknown` → 직접 캐스팅, 타입 가드 없음 | `button-interaction.service.ts` L762-766 | `ButtonClickPayload` discriminated union + 타입 가드 함수 |
| 6 | Architecture | `WaitingInteractionType` 미이동 — 추출 서비스가 `'form'`/`'buttons'` 문자열 리터럴 직접 사용 | `execution-engine.service.ts` | 중기: `engine-driver.interface.ts` 또는 `interaction-types.ts` 로 이동 |
| 7 | Maintainability | `processButtonResumeTurn` ~280줄 6개 책임. verbatim 이동이므로 현 PR 범위 외 | `button-interaction.service.ts` L735-1017 | 후속 step 에서 `resolveButtonInteraction()` 순수 함수 추출 |
| 8 | Maintainability | `buttonConfig` 해석 패턴 두 메서드에 중복 | `button-interaction.service.ts` L646-658/748-755 | `private resolveButtonConfig()` 헬퍼 추출 |
| 9 | Maintainability | `'continue'`/`'__item_'` 매직 문자열 하드코딩 | `button-interaction.service.ts` L820, L848 | `BUTTON_PORT_CONTINUE`, `BUTTON_ITEM_SEPARATOR` 상수 추출 |
| 10 | Maintainability | `as unknown as never` 타입 단언 가독성 저하 | `button-interaction.service.spec.ts` L125, `form-interaction.service.spec.ts` 동일 | `as unknown as Repository<NodeExecution>` 로 교체 |
| 11 | Maintainability | `structuredOutputCache` 접근 타입 단언 두 spec 파일 반복 | `button-interaction.service.spec.ts` L163-171, `form-interaction.service.spec.ts` 동일 | 공유 헬퍼 `setStructuredCache(ctx, nodeId, value)` 추출 |
| 12 | Testing | `ButtonInteractionService` spec — `previousOutput` 무한 체인 방지 회귀 보호 없음 | `button-interaction.service.spec.ts` | nested previousOutput 안 됨 검증 케이스 추가 |
| 13 | Testing | 두 spec 파일 `afterEach` / `jest.restoreAllMocks()` 미설정 — spy 누적 위험 | `form-interaction.service.spec.ts`, `button-interaction.service.spec.ts` | `describe` 최상위에 `afterEach(() => { jest.restoreAllMocks(); })` 추가 |
| 14 | Testing | `ButtonInteractionService` spec — `waitForButtonInteraction` null nodeExec 케이스 없음 | `button-interaction.service.spec.ts` | `findOne.mockResolvedValueOnce(null)` 케이스 추가 |
| 15 | Requirement | `button_continue` data `url` 필드 — spec 필수, 구현 조건부 omit. 방어적 처리 수준 | `button-interaction.service.ts` L857 | SPEC-DRIFT 항목과 함께 spec 갱신 시 `url?` optional 로 명시 |
| 16 | Requirement | `applyPortSelection` mock 등록됐으나 서비스 미호출 — 오해 유발 | `button-interaction.service.spec.ts` L119 | mock 항목 제거 또는 미사용 주석 추가 |
| 17 | Requirement | `allowedFieldNames.size === 0` 시 화이트리스트 무력화 — verbatim 이동 로직, 별도 이슈 추적 | `form-interaction.service.ts` L3100 | 별도 보안 이슈로 추적 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| testing | MEDIUM | FormInteractionService spec 3개 검증 gap(emit/ConversationThread/whitelist), afterEach 미설정 |
| architecture | LOW | 양방향 forwardRef 순환 DI 누적, EngineDriver ISP 위반, payload 직접 캐스팅 |
| side_effect | LOW | ENGINE_DRIVER forwardRef 비대칭(AiTurnOrchestrator 선례 검증으로 실질 위험 낮음) |
| maintainability | LOW | processButtonResumeTurn 280줄 복잡도, buttonConfig 중복, 매직 문자열 |
| requirement | LOW | SPEC-DRIFT 2건(button_continue selectedItem, 메서드 위치 이연), url 조건부 omit |
| scope | NONE | 범위 위반 없음, 전원 INFO 수준 의도된 정리 |
| security | 재시도 필요 | output_file 미존재 — pending 상태 |

---

## 발견 없는 에이전트

**scope** — 범위 위반 없음, 변경 전체가 선언된 strangler-fig C-1 step3 범위 내

---

## 권장 조치사항

1. **[즉시]** `form-interaction.service.spec.ts` 에 `processFormResumeTurn` 의 `emitNode`/`EXECUTION_RESUMED` emit 어서션 추가 (WARNING #1)
2. **[즉시]** `form-interaction.service.spec.ts` 에 `appendPresentationInteraction` ConversationThread spy/expect 추가 (WARNING #2)
3. **[즉시]** `form-interaction.service.spec.ts` 에 WARN #8 보안 whitelist 필터 케이스 2개 추가 — 미허용 필드 제거, `fields=[]` 전체 통과 (WARNING #3)
4. **[단기]** `ENGINE_DRIVER` 주입 `forwardRef` 비대칭 — `AiTurnOrchestrator` 패턴과 일관성 확인 (WARNING #5)
5. **[단기]** `afterEach(() => { jest.restoreAllMocks(); })` 추가 — 두 spec 파일 (INFO #13)
6. **[단기]** `button-interaction.service.spec.ts` 에 `waitForButtonInteraction` null nodeExec 케이스 추가 (INFO #14)
7. **[단기]** `button-interaction.service.spec.ts` 에 `previousOutput` 무한 체인 방지 회귀 케이스 추가 (INFO #12)
8. **[중기]** SPEC-DRIFT 반영: `node-output.md §4.5` `button_continue` 행 `selectedItem?` 추가, `4-execution-engine.md §1.3` 동기화 — PR4 체인 완료 후 `project-planner` 일괄 반영 (INFO #1, #2)
9. **[중기]** 양방향 forwardRef 순환 DI 백로그 등록 + `EngineDriver` 인터페이스에 임시 구조 주석 명시 (WARNING #4)
10. **[중기]** `processButtonResumeTurn` 포트 분기 `resolveButtonInteraction()` 순수 함수 추출 (INFO #7)

---

## 재시도 필요

- **security** (output_file 미존재 — pending): 리뷰 결과 없음, 별도 재시도 필요
- 기타 미실행 에이전트(performance, documentation, dependency, database, concurrency, api_contract, user_guide_sync): 실행되지 않음

---

## 라우터 결정

라우터 호출 실패 또는 미완료. fallback 으로 전체 reviewer 실행됨 (`routing_status=pending`).

실제 실행 완료된 reviewer: architecture, maintainability, requirement, scope, side_effect, testing (6명)
강제 포함(router_safety): maintainability, requirement, scope, security, side_effect, testing