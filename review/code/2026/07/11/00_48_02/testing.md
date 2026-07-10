# 테스트(Testing) 리뷰 — getStatus 2단계 조회(#903) 리베이스 후 `interaction.service.spec.ts` / e2e `I-2` 검증

## 검토 대상 및 방법

`origin/main` 리베이스로 `49c2185d1`(PR #903, `getStatus()` 2단계 컬럼 projection)이 base 에 들어온 뒤 `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts` 에 "내 테스트"(waiting context wire 형식 검증, `describe('InteractionService.getStatus', ...)`)와 #903 의 테스트(`describe('InteractionService.getStatus — 컬럼 projection (2단계 조회)', ...)`)가 같은 파일에 공존한다. 다음을 직접 코드 Read + `npx jest` 실행 + **의도적 mutation(코드를 임시로 손상시켜 어떤 테스트가 잡아내는지 실측 후 원복)** 으로 검증했다.

## 발견사항

- **[INFO]** "내" waiting-context 테스트들은 stage-1/stage-2 소스를 구분하지 못한다 — 코드 주석이 이미 명시적으로 인정
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:589-592`
  - 상세: `describe('InteractionService.getStatus', ...)` (L459-796) 안의 waiting 테스트들은 전부 `repo.findOne.mockResolvedValue(...)` (Once 아님) 로 **모든** `findOne` 호출(1단계 status projection + 2단계 `threadRow`)에 동일 객체를 반환한다. 이 블록 바로 위(L589-592)에 개발자 본인이 남긴 주석이 정확히 이 문제를 인정한다: "이 waiting 테스트들은 mockResolvedValue 로 모든 findOne 호출에 같은 객체를 돌려주므로 1단계/2단계를 구분하지 못한다(구현이 2단계 분리를 되돌려도 green). 2단계 조회 자체와 thread 마스킹 배선은 아래 `describe('...컬럼 projection (2단계 조회)')` 가 select 분기 mock 으로 가드한다." — 이는 사용자가 이번 검증 요청에서 제기한 우려사항과 정확히 동일하며, **이미 인지되고 문서화된 트레이드오프**다.
  - 실측(mutation test): `getStatus()` 의 `const conversationThread = threadRow?.conversationThread ...` 를 의도적으로 `execution?.conversationThread`(stage-1 변수)로 바꿔 "merge 가 threadRow 를 잘못 배선한" 상황을 재현한 뒤 `npx jest interaction.service.spec.ts` 를 실행한 결과, **45개 중 44개가 여전히 PASS** 했다(원복 완료, `git diff` clean 확인). 실패한 유일한 테스트는 `describe('...컬럼 projection (2단계 조회)')` 안의 `'2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과 (secret egress 가드)'` (L921-959) 하나뿐이었다 — 이 테스트만 `mockImplementation` 으로 stage-1/stage-2 호출에 **서로 다른** 값을 돌려주기 때문(`selectOf(opts).includes('conversationThread')` 로 분기).
  - 제안: 조치 불필요(이미 설계 의도대로 동작 + 주석으로 명문화됨)하나, "buttons variant + thread-wiring 오배선" 조합을 잡는 테스트가 정확히 1개뿐이라는 점은 **단일 실패점(SPOF)** 성격이 있다. 여유가 있다면 L921-959 테스트를 buttons variant 로도 하나 더(또는 `it.each` 로 ai_conversation/buttons 양쪽) 확장하면 이 SPOF 를 완화할 수 있다 — 차단 사유 아님, 참고용.

- **[INFO]** #903 의 select-drop(컬럼 누락) 클래스 버그도 "내" 테스트는 못 잡고 #903 자신의 테스트가 잡음 — 교차 검증으로 division-of-labor 건전성 확인
  - 실측(mutation test): 2단계 `findOne` 의 `select: ['id', 'conversationThread']` 를 `select: ['id']` 로 축소해 "conversationThread 를 select 에서 빠뜨린" 회귀를 재현. `npx jest interaction.service.spec.ts` 결과 **45개 중 43개 PASS, 2개 FAIL** — 실패한 2건은 `'waiting_for_input 일 때만 2단계로 conversationThread 를 재조회'`(L866-877, select 배열에 `'conversationThread'` 포함 여부 직접 단언)와 위와 동일한 L921-959 였다. "내" 15개 waiting 테스트는 전부 그대로 PASS. 원복 완료(`git diff` clean 확인).
  - 결론: "내" 테스트(wire 형식 검증)와 #903 테스트(2단계 조회 배선 검증)는 **서로 다른 계층을 커버하는 의도된 분업**이며, 어느 한쪽도 vacuous 하게 "우연히 틀린" 방향으로 깨지지는 않는다 — 각자 담당 계층에서는 정확하다.

## 항목별 답변

### (1) "내" 유닛 테스트는 #903 의 double-findOne 아래서도 유효한가?

**유효하다 — 하지만 좁은 의미로.** `mockResolvedValue`(Once 아님)가 stage-1/stage-2 양쪽에 같은 값을 돌려주는 것은 사실이나, 이로 인해 "내" 테스트들이 **잘못된 방향으로(false positive)** 깨지는 사례는 없었다:

- **buttons-fallthrough 테스트**(L530-547, `buttonConfig` 부재 → `nodeOutput` 변형): `makeExecution({status: WAITING_FOR_INPUT})` 에 `conversationThread` override 가 없으므로 반환 객체엔 그 키 자체가 없다(`undefined` 접근과 동치) — stage-1/stage-2 어느 쪽에서 읽어도 결과가 같아 이 테스트의 실제 관심사(`nodeOutput` in ctx / `buttonConfig` not in ctx)는 정확하게 검증된다. conversationThread 를 다루지 않는 테스트이므로 애초에 그 필드 관련 위험에 노출되지 않는다.
- **conversationThread-absent 테스트**(L552-573, L776-795): `conversationThread: null as never` 를 override 로 명시하므로 반환 객체에 `conversationThread: null` 이 실제로 존재한다. stage-2 `threadRow` 로 이 값이 정확히 전달되어 `threadRow?.conversationThread` → `null`(falsy) → `undefined` → 키 생략. 코드가 실제로 의도한 분기(`null`→키 생략)를 정확히 거치므로 **"우연히 맞았다"가 아니라 정확한 경로를 탄다**. shape 도 "정확한 stage-2 shape(`{id, conversationThread}`)"은 아니지만(전체 execution mock 객체를 그대로 반환), 코드가 `.conversationThread` 필드 하나만 읽으므로 초과 필드는 무해하다.
- **conversationThread-present 테스트**(L617-663): `DURABLE_THREAD` override 로 동일한 이유로 정확히 동작.

다만 "동일 객체 반환" 설계의 진짜 대가는 **stage-1 변수(`execution`)와 stage-2 변수(`threadRow`)를 서로 바꿔치기하는 배선 버그를 "내" 테스트가 원천적으로 구분 못 한다**는 점이다(위 mutation-test 로 실증). 이건 결함이 아니라 **명시적으로 위임된 책임 분리**다 — L589-592 주석이 정확히 이 사실을 사전에 문서화했고, 담당은 `describe('...컬럼 projection (2단계 조회)')` 로 넘겨져 있다.

### (2) #903 의 테스트와 "내" 테스트가 같은 파일에서 충돌 없이 공존하는가?

**충돌 없음.**

- `describe` 블록 5개(`interact`/`cancel`/`refreshToken`/`getStatus`/`getStatus — 컬럼 projection (2단계 조회)`) 이름이 모두 고유하며 중첩 없이 top-level 이다(`grep '^describe('` 로 5건 전수 확인).
- 각 `it()` 은 매번 `makeMocks()` 를 호출해 `repo`/`nodeRepo`/`engine`/`executions`/`token` 을 **테스트마다 새로 생성**한다(모듈 스코프 공유 mock 인스턴스 없음). `beforeEach`/`afterEach`/`jest.resetAllMocks` 류가 파일에 전혀 없는데도(grep 결과 0건) 문제가 없는 이유가 이것 — 애초에 재사용되는 가변 mock 자체가 없다.
- `DURABLE_THREAD`(L593, `getStatus` describe 스코프 로컬) 와 `THREAD`(L821, projection describe 스코프 로컬) 는 이름이 유사하지만 **각자의 `describe` 블록 안에 로컬 선언**되어 서로 다른 스코프이며 값도 다르다(전자는 2-turn, 후자는 1-turn) — 이름 유사성으로 인한 실수 가능성은 낮지만 완전히 격리돼 있어 실질 충돌 없음.
- `IEXT_CTX`/`ITK_CTX`/`makeExecution` 은 파일 전역에서 공유되지만 전부 read-only 값이거나(상수) 매 호출 새 객체를 반환하는 순수 팩토리(`makeExecution`)라 mutation 에 의한 오염 경로가 없다.

### (3) `npx jest src/modules/external-interaction/` 결과

```
Test Suites: 16 passed, 16 total
Tests:       228 passed, 228 total
```

`interaction.service.spec.ts` 단독: **45 passed, 45 total** (`--verbose` 로 개별 확인).

**merge 가 threadRow 를 잘못 배선했다면 내 assertion 이 실패했을까?** 위 mutation-test 결과가 직접 답한다 — **아니오, 대부분은 아니다.** stage-1/stage-2 변수를 맞바꾸는 배선 버그는 45건 중 단 1건(`'2단계 재조회 결과의 thread 도 redactThreadForPublic 를 통과 (secret egress 가드)'`, #903 이 추가한 projection describe 소속)만 잡는다. "내" `describe('InteractionService.getStatus', ...)` 블록의 15개 waiting 테스트는 이 클래스의 버그에 대해 전부 무력하다 — 다만 이는 설계상 의도된 것이고(L589-592 주석), 실제로 그 책임을 진 테스트 1건은 존재하며 정상 동작한다. select 컬럼 누락(다른 배선 버그 클래스)은 2건이 잡는다.

### (4) e2e `I-2` 는 #903 의 2단계 쿼리 아래서도 유의미한가?

**그렇다 — 오히려 이 리팩터 이후 가장 신뢰도 높은 테스트다.**

- `codebase/backend/test/external-interaction.e2e-spec.ts:411-464` 의 `I-2` 는 실 HTTP(`request(BASE_URL).get(...)`)+ 실 Postgres round-trip이며 **아무 것도 mock 하지 않는다.** `execution` INSERT 시 `conversation_thread` 컬럼을 아예 넣지 않으므로(L426-430 주석: "conversation_thread 컬럼을 채우지 않는다 (durable park 이력 없음)") 실 DB 기본값(`NULL`, `Execution.conversationThread` 엔티티 정의가 `nullable: true`, 컬럼명 `conversation_thread` — `execution.entity.ts:164-165` 확인)이 그대로 stage-2 `findOne({select:['id','conversationThread']})` 에 실려 돌아온다.
- 이는 mock 기반 유닛 테스트가 원천적으로 검증 못 하는 것 — **실제 TypeORM select 배열이 실제 컬럼명으로 정확히 매핑되고, 실제 WHERE 스코프(`{id: executionId}`)가 정확한 row 를 잡고, 두 쿼리(stage-1/stage-2)가 실제로 순차/병렬 실행돼도 최종 응답이 옳은지** — 를 검증한다. 위 mutation-test 로 실증했듯 "stage-1/stage-2 변수 스왑" 류 버그가 유닛 테스트 44/45 건을 통과하는 상황에서도, `I-2` 처럼 mock 이 전혀 없는 e2e 는 이런 종류의 버그를 원천적으로 노출시킨다(전체 응답 조립 경로가 실제로 정확해야 통과하므로).
- `Object.keys(context)).not.toContain('conversationThread')`(L459) 단언은 stage-2 가 `NULL` 을 정확히 반환하고, `threadRow?.conversationThread ? ... : undefined` 분기가 정확히 "키 생략"으로 귀결됨을 실제로 확인한다 — API 규약 §5.4 "부재 표현(null vs 키 생략)" 계약을 real DB 기준으로 고정하는 유일한 테스트.
- 자매 테스트 `I`(L344-409, `conversation_thread` 를 실제로 채워 secret 마스킹까지 end-to-end 검증)와 짝을 이뤄 stage-2 ternary 의 두 분기(존재/부재)를 모두 실 DB 로 커버한다.
- git log 상 `I-2` 는 `ee271026e`(ai-review Warning 5건 반영) 커밋에서 신설됐고, 이 시점 base 는 이미 `49c2185d1`(PR #903, 2단계 쿼리)를 포함하고 있었다 — 즉 `I-2` 는 **2단계 쿼리 존재를 전제로 작성된 테스트**이지, 사후에 우연히 호환되는 낡은 테스트가 아니다.
- 참고: 본 리뷰에서는 e2e 를 실제로 기동(docker compose)하지 않고 정적 분석(엔티티 컬럼 매핑, INSERT 문, select/where 코드)으로 검증했다 — CLAUDE.md 관례상 e2e 는 `make e2e-test`(backend Jest e2e runner) 로 별도 검증 대상이다.

## 요약

리베이스로 유입된 PR #903 의 `getStatus()` 2단계 조회(stage-1 얇은 projection + stage-2 `threadRow`)와 "내" 기존 waiting-context 테스트는 같은 파일에서 이름 충돌·fixture 오염 없이 안전하게 공존한다. `mockResolvedValue`(Once 아님)로 인해 "내" 15개 waiting 테스트가 stage-1/stage-2 소스를 구분 못 하는 것은 사실이지만(코드 L589-592 주석이 사전에 명시), 실측 mutation-test(threadRow↔execution 변수 스왑, select 컬럼 누락 2종)로 검증한 결과 이 클래스의 배선 버그는 #903 자신이 추가한 `describe('...컬럼 projection (2단계 조회)')` 블록의 전용 테스트(각각 1건·2건)가 정확히 포착하며, "내" 테스트는 자신이 담당하는 계층(wire 형식)에서는 정확하다 — false positive/false negative 로 깨지는 사례는 없었다. 유일한 개선 여지는 stage-1/stage-2 변수 스왑 클래스를 잡는 테스트가 45건 중 1건뿐이라는 단일 실패점 성격(SPOF)인데, 차단급은 아니고 보강 시 buttons variant 로 하나 더 추가하는 정도로 완화 가능하다. `npx jest src/modules/external-interaction/` 는 16 suites / 228 tests 전부 PASS, `interaction.service.spec.ts` 단독 45/45 PASS. e2e `I-2` 는 mock 이 전혀 없는 실 HTTP+DB round-trip 으로 2단계 쿼리의 select/where/컬럼 매핑을 통째로 검증하는 가장 신뢰도 높은 회귀 가드이며, #903 의 2단계 쿼리를 전제로 작성돼 여전히(오히려 더) 유의미하다.

## 위험도

LOW

STATUS: SUCCESS
