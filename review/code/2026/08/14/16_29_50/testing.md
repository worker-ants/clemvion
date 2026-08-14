### 발견사항

- **[INFO]** 이번 라운드의 실질 코드 델타(`dfc63bbb7`)가 지적한 직전 testing WARNING(`15_58_26` W3 — `stripAndRedact` null 분기 무테스트)이 정확히 닫혔다 — 코드 추적 + 실행 양쪽으로 확인
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:713-728`(`it.each` — completed/failed × outputData null → result/error null), `interaction.service.spec.ts:730-752`(waiting — nodeExec.outputData null → currentNode 생존/context null), 대상 코드 `interaction.service.ts:98-108`(`stripAndRedact`)·`:379`(`?? {}` 흡수)
  - 상세: `stripAndRedact(null)`은 명시적 가드(`interaction.service.ts:99`)로 `null`을 즉시 반환한다. 이 가드를 통째로 제거해도 `stripExternalOnlyFields(null,…)`→`deepRedactSecrets(null)` 체인이 둘 다 `null`을 그대로 통과시키므로(각각 `value === null` 분기, `sanitize-error-message.ts:133`) **가드 존재 자체**에 대해서는 이 테스트가 판별력이 없다 — 그러나 커밋 메시지가 명시한 실제 회귀 형태는 "가드가 `{}`를 반환하도록 바뀌는" 뮤턴트이고, 그 경우 terminal 2건(`result`/`error`)은 `expect(r[field]).toBeNull()`이 실패해 RED가 된다(직접 추적 확인). waiting 1건은 호출부의 `?? {}`가 `null`이든 `{}`이든 동일하게 흡수해 초록이 되는데, 이 비대칭을 테스트 JSDoc이 정확히 명시해 뒀다 — "GREEN인 이유를 안 적으면 vacuous로 오인된다"는 이 저장소의 반복 교훈에 부합한다. `npx jest interaction.service.spec.ts strip-external-only-fields.spec.ts websocket.service.spec.ts`를 직접 실행해 5 suites / 150 tests 전체 통과를 재확인했다.
  - 제안: 조치 불요 — positive finding. (참고로만: `undefined` 입력 분기는 별도 미검증이지만 `Execution.outputData`/`NodeExecution.outputData` 모두 `nullable: true` jsonb 컬럼이라 TypeORM이 실제로 넘기는 값은 `null`이지 `undefined`가 아니다 — 실질 위험 없음, 추가 조치 권고 안 함.)

- **[INFO]** `strip-external-only-fields.ts`/`websocket.service.ts`/`interaction.service.ts` 전체 diff의 테스트 구조가 이 저장소 기준으로도 이례적으로 견고하다 — 확인했으나 문제 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.spec.ts`(177줄, 참조 동일성·`__proto__`·다원소 배열 clone-on-write·REST 순서 깊이 sweep), `codebase/backend/src/modules/websocket/websocket.service.spec.ts:573-900`(wire/fanout 대조군, 중첩 `turnDebug.llmCalls` 2경로, 깊이 sweep `it.each([0,MAX-5,MAX-3,MAX-2,MAX-1,MAX,MAX+1,MAX+2])`)
  - 상세: 모든 strip/redact 관련 테스트가 (a) 뮤턴트(strip을 no-op화)로 실제 판별력을 실측해 JSDoc 표로 남기고 "판별력 없는" depth도 삭제 대신 존재 이유를 기록했으며, (b) 내부 WS(wire) vs 외부 fanout 대조군을 매번 쌍으로 검증해 "통째로 날려서 통과"하는 거짓 양성을 차단하고, (c) 정상 필드 보존(control) 단언(`안녕하세요`/`최종 답변`/`message: 'hi'` 등)을 빠뜨리지 않는다. `interaction.service.spec.ts`의 `makeMocks()`가 테스트마다 신규 mock/service 인스턴스를 만들어 테스트 간 상태 공유가 없고, `websocket.service.spec.ts`도 `beforeEach`마다 신규 인스턴스 + `take(1)` 기반 자동 unsubscribe로 격리가 보장된다.
  - 제안: 없음(positive finding).

- **[INFO]** 대용량 non-AI payload의 strip 오버헤드(2.5×, 무제한 상한)는 실측됐지만 회귀를 잠그는 자동화 테스트/벤치마크 파일은 없다 — 이번 PR에서 의도적으로 미수정
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` JSDoc "## 비용 (실측)" 절, `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(대용량 A/B 실측 기록), `review/code/2026/08/14/15_58_26/RESOLUTION.md`(W1 처분 근거)
  - 상세: `124 KB→2.47×`, `1.2 MB→2.36×`, `6.5 MB→2.56×`(emit 경로 전체 기준) 수치가 커밋 메시지·JSDoc·plan에 남아 있으나, `codebase/backend` 어디에도 `*benchmark*` 파일이 없어 이 수치를 재현·회귀 감시하는 자동 테스트는 없다(수동 스크립트로 1회성 측정). 다만 이는 이번 라운드에서 새로 드러난 갭이 아니라 직전 라운드(`15_58_26` performance W1)가 이미 "이번 PR에서는 고치지 않는다"고 근거와 함께 명시적으로 유예한 항목이다.
  - 제안: 조치 불요 — 성능 개선(캡 도입) 착수 시점에 함께 회귀 벤치마크를 추가하는 편이 자연스럽다. 지금 추가하면 이번 보안 수정 PR의 스코프를 넘는다.

### 요약
이번 라운드(`16_29_50`)의 유일한 실질 코드 델타(`dfc63bbb7`)는 직전 라운드가 낸 testing WARNING(`stripAndRedact` null 분기 무테스트)에 대한 처방으로, 새로 추가된 3개 테스트(`interaction.service.spec.ts:713-752`)를 코드 추적과 실제 `jest` 실행(5 suites / 150 tests 전부 통과) 양쪽으로 검증한 결과 정확히 의도한 회귀(가드가 `{}`를 반환하는 뮤턴트)를 terminal 2건에서 RED로 잡고, waiting 1건이 초록인 이유(`?? {}` 흡수)까지 JSDoc에 명시해 vacuous 오인 가능성을 차단했다. `strip-external-only-fields.ts`/`.spec.ts`·`websocket.service.ts`/`.spec.ts`·`interaction.service.ts`/`.spec.ts` 전체를 다시 훑어도 깊이 경계 판별력 실측·wire/fanout 대조군·`__proto__` 하드닝·clone-on-write 참조 보존·테스트 격리 모두 이 저장소 기준으로 모범적인 수준이며, 새로 발견된 커버리지 갭은 없다. 유일하게 남은 항목(대용량 payload 성능 회귀를 잠그는 자동화 테스트 부재)은 이번 라운드가 새로 만든 갭이 아니라 직전 라운드가 근거와 함께 명시적으로 유예한 사항이라 INFO로만 기록한다.

### 위험도
NONE
