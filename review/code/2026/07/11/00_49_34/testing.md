# 테스트(Testing) 리뷰 — EIA/WS 대기 노드 표면 매트릭스 가드 (ai-review 반영 커밋)

diff 범위: `9ba336453^..2244539a9` (fix + 후속 ai-review 반영 refactor 커밋)

직전 리뷰(`review/code/2026/07/11/00_03_25/`) Warning #1~#5 에 대한 보강분을 중심으로,
실제 production 코드(`execution-engine.service.ts` / `park-entry-dispatch.ts` /
`button-interaction.service.ts` / `hooks.service.ts`)를 직접 대조해 비-vacuity 를 검증했다.

## 발견사항

- **[WARNING]** "JOIN 탈락" 유닛 테스트는 실제 SQL JOIN 동작을 검증하지 않고 기존 "0건" 케이스를 재기술할 뿐
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `it('대기 node 정의 부재(JOIN 탈락) → 0건과 동일하게 INVALID_EXECUTION_STATE', ...)`
  - 상세: `resolveWaitingNodeExecutionId` 는 `createQueryBuilder('ne').innerJoin('ne.node','n')...getRawMany()` 로 전환됐고, 신규 mock(`mockWaitingQb`)은 `createQueryBuilder` 자체를 완전히 가로챈다. 이 테스트는 `waitingRawRows = []` 를 직접 세팅해 통과시키는데, 이는 production 의 실제 `INNER JOIN` 이 노드 정의가 사라진 행을 정말 걸러내는지를 전혀 실행하지 않고, 이미 존재하는 "WAITING row 0건" 테스트(`waitingRawRows = []` 로 동일하게 세팅)와 어써션까지 동일하다. 테스트명·주석("대기 node 정의 부재(JOIN 탈락)")이 암시하는 "실제 SQL이 이 경우를 0건으로 만든다"는 사실은 unit 에서도 e2e 에서도 실증되지 않는다(신규 buttons/form e2e 는 모두 노드 정의가 존재하는 정상 케이스만 다룸). QueryBuilder 를 전체 스텁으로 대체한 것 자체가 이 갭의 근본 원인 — mock 전환이 §7.5.1 hot-path 비용 문제(WARNING #5)는 해결했지만, "실제 SQL 동작 재현"이라는 목적으로는 처음부터 한계가 있다.
  - 제안: 이 시나리오(실행 도중 노드 정의 삭제)는 현재 아키텍처상 발생 빈도가 낮아 즉각 조치는 불필요하나, 테스트 주석을 "0건 케이스의 다운스트림 처리를 재확인함(SQL JOIN 자체는 mock 특성상 미검증)"으로 정정하거나, 최소 코드 주석에 이 한계를 명시할 것을 권장. Critical 은 아님.

- **[WARNING]** buttons e2e 는 "가드 비활성화 시 재현" 대조 실험이 없어 form e2e 대비 비-vacuity 증거가 간접적
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` — `it('buttons 대기 중 EIA end_conversation → 409 STATE_MISMATCH, 엉뚱한 continue 포트 분기 없음', ...)`; `review/code/2026/07/11/00_03_25/RESOLUTION.md` TEST 결과 절
  - 상세: RESOLUTION.md 는 "form 케이스는 가드 비활성 시 202 반환(재현) / 복원 시 409 를 실 Postgres 로 실증(비-vacuity 확인)"이라고 명시하는데, 이 대조 실험은 form 에만 수행됐고 buttons 에는 없다. buttons e2e 는 가드가 항상 활성인 상태로만 실행되므로, "가드가 없었다면 실제로 `resolveButtonInteraction` 의 (d) fallback 이 걸려 'continue' 포트로 분기했을 것"이라는 주장은 이 테스트가 직접 증명하지 않고, 코드 추적(`button-interaction.service.ts:106` "(d) fallback — type !== 'button_click' → continue")과 "거부 후 execution 이 waiting_for_input 을 유지"라는 간접 신호(부재 시 node 가 COMPLETED 로 전이해 waiting 을 벗어났을 것이라는 추론)에 의존한다. 이 추론 자체는 코드 상 타당하지만(확인함 — 4개 명령 페이로드 중 `button_click` 이 아닌 모든 타입이 이 fallback 을 탄다), form 처럼 "실제로 가드를 걷어내고 버그가 재현됨"을 실측하지는 않았다.
  - 제안: Critical 은 아님 — 동일 시나리오가 unit 레벨(`execution-engine.service.spec.ts` "buttons 대기 + submit_form → INVALID_EXECUTION_STATE (엉뚱한 continue 포트 분기 차단)")에서 순수 로직으로 이미 검증되므로 실질 위험은 낮다. 다만 rigor 일관성을 위해 buttons 축도 form 과 동일하게 가드 우회 실측을 했거나, 최소한 이 비대칭을 plan/RESOLUTION 에 "buttons 는 unit 레벨 대조로 대체" 라고 명시했으면 더 좋았을 것.

- **[INFO]** buttons e2e 의 최종 "선택 포트" 단언은 happy-path 확인이지 회귀 자체를 잡는 단언은 아님
  - 위치: `execution-park-resume.e2e-spec.ts` buttons e2e 마지막 `expect(...).toContain(approveBtnId)`
  - 상세: 수락된 `click_button` 요청은 애초에 `isButtonClickPayload` 가 true 인 정상 페이로드라 (d) fallback 경로를 타지 않는다 — 즉 이 단언은 "정상 클릭이 여전히 올바른 포트로 라우팅된다"는 기본 동작 확인일 뿐, "엉뚱한 continue 포트 분기가 차단됐다"는 회귀 가드 자체는 그 앞의 "거부 후 execution 이 waiting_for_input 유지" 단언이 담당한다. 리뷰 요청에서 물은 "선택 포트 단언 충분성"에 대한 답: 이 단언 하나만 보면 회귀를 직접 잡지 못하지만, 앞선 waiting-유지 단언과 결합하면 실질적으로 충분하다.
  - 제안: 문제 삼을 수준은 아님. 주석으로 "이 단언은 happy-path 확인이며, 회귀 가드 자체는 앞선 still-waiting 단언"이라고 명시하면 다음 리뷰어의 오독을 방지할 수 있음.

- **[INFO]** `armStaticFormSurface` 의 `getMetadata` mock 이 인자 무관 전역 override
  - 위치: `execution-engine.service.spec.ts` — `armStaticFormSurface`
  - 상세: `jest.spyOn(handlerRegistry, 'getMetadata').mockReturnValue({kind:'blocking', interaction:'form'})` 는 어떤 노드 타입을 넣어도 동일 값을 반환한다. 현재 이 헬퍼를 쓰는 테스트들은 `assertCommandMatchesWaitingSurface` 한 곳에서만 `getMetadata` 를 호출하므로 문제가 없으나, 향후 같은 테스트 내에서 다른 노드 타입의 metadata 조회가 추가되면 의도치 않게 'form' 취급될 위험이 있다.
  - 제안: `mockImplementation((type) => (type === 'form' ? {...} : {kind:'standard'}))` 로 좁히면 더 안전. 즉각 조치 불요.

## 확인된 강점 (비-vacuity 실증, 코드 직접 대조 결과)

- **resumeTurnRegistry 대칭 테스트**(`execution-engine.service.spec.ts` "resumeTurnRegistry 의 selects 와 resolveWaitingSurface 판정이 일치한다")는 실제 private getter(`service.resumeTurnRegistry`, 캐스팅으로 접근)와 실제 `isCheckpointEligibleNodeType`(mock 아님, `CHECKPOINT_ELIGIBLE_NODE_TYPES = {ai_agent, information_extractor}` 실제 상수 사용)를 그대로 호출해 비교한다. `ai_agent`/`information_extractor` 케이스가 실제로 eligible 함을 코드로 확인했고, `resolveWaitingSurface` 와 1:1 로 일치함을 검증하는 비-vacuous 테스트. 직전 리뷰 Warning #3 을 정확히 메운다.
- **park-entry registry 대칭 테스트**(`waiting-surface-guard.spec.ts`)도 `buildParkEntryRegistry` 의 실제 `selects` 술어(`park-entry-dispatch.ts` — form: `blockingInteraction==='form'`, buttons: `interactionType==='buttons'`, ai: `interactionType∈{'ai_conversation','ai_form_render'}`)와 정확히 대조하며, 6개 selector 조합이 registry 의 모든 분기를 실질적으로 커버한다.
- **hooks 진단정보 테스트**는 직전 리뷰 Warning #1(`err.message` 가 항상 `'Conflict Exception'`) 을 정확히 재현·수정 확인한다 — `readErrorBody(err)` 가 `err.getResponse().error.{code,message}` 를 읽는 실제 production 로직이고, 테스트가 `surface mismatch` 포함 + `Conflict Exception` 미포함을 모두 단언해 non-vacuous. `STATE_MISMATCH` 가 아닌 409(`IDEMPOTENCY_KEY_CONFLICT`)는 전파, 일반 `Error`도 전파하는 두 테스트가 catch 범위를 정확히 좁혔음을 실증(직전 리뷰 Warning #2 해소).
- **JSONB path 투영 테스트**는 `mockWaitingQb.select`/`addSelect` 호출 인자에서 `'ne.output_data'`/`'ne.outputData'` 전체 컬럼 select 가 없음과 `interactionType` 투영이 있음을 실제 production 코드가 호출하는 QueryBuilder 체인 위에서 검증 — 향후 누군가 실수로 컬럼 전체를 다시 select 하면 이 테스트가 fail 한다(직전 리뷰 Warning #5 해소).
- **표면 매트릭스 unit 스위트**(form/buttons/ai_conversation × 4개 명령 조합)는 `mockBus.publish` 호출 여부·타입을 단언해 "publish 전 동기 거부"라는 핵심 불변식을 각 표면·명령 조합마다 직접 검증하며, 표를 그대로 코드화한 것이라 가독성도 높음.
- e2e 두 건(form/buttons) 모두 실 Postgres 로 영속된 `output_data` 를 재조회해 표면 판정 입력을 검증하고(특히 buttons 는 `parked.rows[0]?.itype === 'buttons'` 사전 확인 — mock 으로는 불가능한 JSONB 왕복을 실증), 거부 후 `execution`/`node_execution` 상태가 `waiting_for_input` 로 보존됨과 이후 정상 명령의 무손실 재개를 함께 검증해 회귀 재발 방지 신뢰도가 높다.
- 테스트 격리: `execution-engine.service.spec.ts`/`hooks.service.spec.ts` 모두 `beforeEach` 마다 신선한 `TestingModule`(따라서 신선한 mock/handlerRegistry)을 생성하고, `warnSpy.mockRestore()` 등 spy 복구도 챙겨 테스트 간 상태 누수가 없음을 코드로 확인했다. e2e 두 건도 각자 독립 workflow/execution 을 생성해 다른 테스트와 격리된다.

## 요약

직전 리뷰의 Warning #1~#5(진단정보 유실·catch 범위 과다·registry 대칭 절반·buttons e2e 부재·JSONB 전체 select)는 모두 코드를 직접 대조한 결과 실질적으로, 그리고 대부분 non-vacuous 하게 해소되었다. `resolveWaitingSurface`/`SURFACE_ALLOWED_COMMANDS`/두 registry 대칭 테스트는 순수함수·실제 registry getter 를 그대로 비교하는 방식이라 신뢰도가 높고, hooks 로그 진단정보 테스트는 실제로 있었던 결함(`err.message` 고정 문자열)을 정확히 재현·검증한다. 남은 갭은 두 가지로, 모두 non-blocking 이다: (1) "JOIN 탈락" unit 테스트가 이름과 달리 실제 SQL JOIN 동작이 아니라 기존 0건 케이스를 재기술할 뿐이라는 점(QueryBuilder 전체 mock 전환의 구조적 한계) — 실행 중 노드 정의 삭제라는 드문 시나리오라 우선순위는 낮음, (2) buttons e2e 가 form 과 달리 "가드 비활성화 시 재현" 대조 실험 없이 간접 신호(waiting 상태 유지)로만 비-vacuity 를 주장한다는 점 — 다만 동일 시나리오가 unit 레벨에서 이미 직접 검증되므로 실질 위험은 낮다.

## 위험도

LOW
