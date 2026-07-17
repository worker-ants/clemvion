# 테스트(Testing) 리뷰 — `use-widget.ts` 리셋 계약 확정 후 회귀 테스트 5번째 항목 (2026-07-17 14_56_27)

**대상**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(회귀 테스트 1건 추가 + 주석 정정), `codebase/channel-web-chat/src/widget/use-widget.ts`(JSDoc 13줄 추가, **코드 0줄 변경** — diff 직접 대조로 확인). 나머지 파일(`review/code/2026/07/17/14_30_15/*`)은 이전 라운드 리뷰 산출물이라 테스트 관점 대상이 아니다.

이번 라운드는 orchestrator 가 명시한 4개 질의에 대한 **독립 실측 검증**이 핵심이므로, 주장을 그대로 인용하지 않고 전부 별도 mutation 으로 재현했다.

## 검증 방법론

- `git worktree add --detach <scratchpad>/mutation-wt-testing HEAD` 로 공유 워크트리 밖에 격리(scratchpad 하위). `node_modules`(root·`channel-web-chat`·`codebase/packages/*`)는 공유 워크트리 실디렉터리 symlink 로 부트스트랩(vitest 전용 — 프로덕션 빌드는 대상 아님).
- 네 설계의 정확한 코드를 **추측하지 않고** `git show`로 원본 커밋에서 직접 확보했다 — `e195a448c`(진입 시 일괄 폐기), `0d6128c74`(BLOCKED 한정 폐기), `f4785a953`(`bootGenRef` 소유권). 각 커밋 diff 를 그대로 현재 HEAD 코드 위에 옮겨 심어(surgical) mutation 을 구성했고, 매 mutation 후 `diff` 로 의도한 줄만 바뀌었는지 대조했다.
- 매 mutation 마다 `npx vitest run src/widget/use-widget-eager-start.test.ts --reporter=verbose` 로 실패 테스트 이름을 개별 확인(요약 숫자만 보지 않음), mutation 간 `use-widget.ts.baseline` 으로 복원 후 diff 로 클린 확인.
- 종료 후 `git worktree remove --force`, 공유 워크트리는 `git status --short`(review 산출물 1건 외 무변경)·`git diff --stat -- codebase/`(빈 결과)로 무오염 재확인.
- 베이스라인(HEAD, mutation 없음): `use-widget-eager-start.test.ts` 44/44, `channel-web-chat` 전체 22 files/376 tests — 커밋 메시지·RESOLUTION.md 자기보고 수치와 정확히 일치(직접 재현, 인용 아님).

## 발견사항

- **[INFO]** 질의 1 — 신규 테스트가 4번째 설계 재도입을 실제로 잡는지: **확인(독립 재현)**
  - 위치: `use-widget-eager-start.test.ts:2350`(신규 테스트) vs `use-widget.ts:193`(`pendingResetRef` 선언) 부근에 `f4785a953` 원본 3줄을 그대로 재도입
  - 상세: `bootGenRef` 선언(`const bootGenRef = useRef(0);`) + entry 캡처(`const bootGen = ++bootGenRef.current;`) + BLOCKED 분기 게이팅(`if (bootGenRef.current === bootGen) pendingResetRef.current = false;`) 3줄을 정확히 그 원본 커밋과 동일한 위치에 재도입한 뒤 44건 전체를 재실행했다. 결과: **정확히 2건 실패** — `:2103`("차단된 부팅 중의 resetSession...", 순차) · `:2350`(신규, 거울상). `:2275`(기존 "혼합 순서" 테스트)는 **통과**(옛 결함이 정확히 재도입돼도 못 잡음) — orchestrator·concurrency.md 의 주장과 정확히 일치한다.
  - 제안: 없음(주장 확인됨). 단 아래 WARNING 참조 — "이 테스트만 잡는다"는 코멘트 문구는 정정이 필요하다.

- **[INFO]** 질의 2 — 네 가지 잘못된 설계 전부가 현재 5건 스위트로 막히는지: **확인(4종 독립 재현, 표)**

  | # | 재도입한 설계 | 재도입 위치(정확한 코드) | 실패 테스트(5건 중) | 실패 수 |
  |---|---|---|---|---|
  | (a) | 진입 시 일괄 폐기 | `applyConfig` 첫 줄(`if (!cfg.apiBase...) return;`) 직후 무조건 `pendingResetRef.current = false;`(`e195a448c` 원본) | `:2103, :2199, :2275, :2350` | **4** |
  | (b) | BLOCKED 한정 폐기(세대 무관) | `if (!allowed) { pendingResetRef.current = false; dispatch(...); return; }`(`0d6128c74` 원본) | `:2103, :2275, :2350` | **3** |
  | (c) | `bootGenRef` 소유권 | 위 질의 1 항목과 동일(`f4785a953` 원본 3줄) | `:2103, :2350` | **2** |
  | (d) | 소비 자체 제거 | `applyConfig` 의 `if (pendingResetRef.current) {...}` 소비 블록 전체 삭제(주석 포함) | `:2022, :2103, :2199, :2275, :2350` | **5**(전건) |
  | — | (베이스라인, mutation 없음) | — | 없음 | **0** |

  - 상세: 네 설계 모두 최소 2건 이상의 실패를 유발해 **현재 회귀 스위트가 전부 탐지**함을 확인했다. RESOLUTION.md 14_30_15 의 표(구 4-테스트 스위트 기준 3/2/2/4건)와도 정합적이다 — 신규 테스트가 (a)(b)(d) 에도 추가로 걸려 각각 +1(3→4, 2→3, 4→5)이고, (c)만 "구 스위트에서 이미 `:2103` 1건이 걸렸는데 신규 테스트가 +1 되어 2건"이라는 서로 다른 셈이 정확히 맞아떨어진다.
  - 흥미로운 부가 관찰: `:2103` 과 `:2350` 두 테스트는 **네 mutation 전부에서 공통으로 실패**하는 유일한 두 테스트다 — 즉 이 결함 클래스에 대해 이중 방어선이 존재한다(아래 WARNING 참조, 이 사실 자체가 코멘트 문구와 충돌한다).
  - 제안: 없음(전부 막힘 확인). 아래 WARNING 은 이 표에서 파생된 문서 정확성 문제.

- **[WARNING]** 신규 테스트 코멘트의 "유일한 가드" 주장이 부정확함 — `:2103` 도 동일 mutation 을 독립적으로 잡는다
  - 위치: `use-widget-eager-start.test.ts:2347-2349`
    ```
    // 절반(소유권자=최신 진입이 차단으로 먼저 끝나며 폐기 → 아직 살아있는 이전 진입의 리셋이 소실)은
    // 이 테스트만 잡는다. 네 번째 잘못된 설계의 재도입을 막는 유일한 가드다.
    ```
  - 상세: 위 표에서 실측했듯, `bootGenRef` 소유권(설계 c) 재도입 시 실패하는 테스트는 `:2103`과 `:2350` **둘**이다. `:2103`("차단된 부팅 중의 resetSession..." — 순차, 겹침 없음)이 실패하는 이유는 `:2103` 시나리오에서 boot#1(BLOCKED)이 resolve 되는 시점에 아직 boot#2가 시작되지 않아 `bootGenRef.current === bootGen` 이 참이 되고, 그래서 설계 c 의 BLOCKED 분기 조건부 폐기가 (겹침이 전혀 없는데도) 발동해 정당한 리셋을 지워버리기 때문이다 — concurrency.md `14_30_15` 자신의 결과표에도 "`:2103` ... FAIL(정상 탐지)"로 이미 기록돼 있다. 즉 "이 테스트만 잡는다"는 **"혼합 순서(겹침) 테스트 계열 내에서는"**이라는 암묵 스코프에서만 참이고, 스위트 전체 기준으로는 틀렸다. `:2350`은 "네 번째 잘못된 설계의 재도입을 막는 유일한 가드"가 아니라 **두 번째(추가) 가드**다.
  - 왜 문제인가: 이 파일은 4라운드 연속 회귀가 난 hotspot 이고, 코드 코멘트가 실제로 RESOLUTION.md 류 문서에 "증거"로 인용되는 문화가 있다(`bootGenRef 소유권 (4번째 시도) | 2건`처럼). 향후 누군가 "`:2103`은 순차 케이스라 `:2275`/`:2350`(겹침 케이스)과 중복돼 보인다"며 정리를 시도할 때, 이 코멘트의 "유일한 가드" 문구를 신뢰해 `:2350`만 있으면 안전하다고 오판하고 `:2103`을 지울 위험이 있다 — 실제로는 두 가드가 서로 다른 시나리오(순차 vs 겹침)로 같은 결함을 잡는 **의도치 않은 이중 방어선**이며, 이 사실이 코드 어디에도 드러나지 않는다.
  - 제안: 코멘트를 "실제로 결함을 냈던 절반은 **'혼합 순서(겹침)' 계열에서는** 이 테스트만 잡는다(순차 케이스는 `:2103`이 별도로 잡는다 — mutation 실측 확인)"처럼 스코프를 명시하는 문구로 정정 권고. 코드 동작에는 영향 없음(문서 정확성 이슈).

- **[WARNING]** 신규 테스트의 거짓 음성 여지 — "2차가 실제로 BLOCKED 에 도달했는가" 전제가 고정되지 않음 (실측 확인)
  - 위치: `use-widget-eager-start.test.ts:2396`(`renderHook(() => useWidget());` — `result` 미캡처), `:2410-2414`(2차 진입 resolve 블록에 전제 단언 없음)
  - 상세: 이 파일의 확립된 컨벤션은 "2차 진입이 의도한 상태(BLOCKED/streaming)에 실제로 도달했는가"를 명시적으로 단언하는 것이다 — `:2103`은 정확히 이 이유로 `expect(result.current.state.phase).toBe("blocked")`(1차 전제, 코멘트: "전제 — 여기 못 오면 테스트가 무의미")와 `expect(result.current.state.phase).not.toBe("blocked")`(2차 전제, 코멘트: "2차 전제 고정 — 2차 boot 이 (무관한 이유로) 또 차단되면 아래 단언이 '아무 일도 안 일어나서' 통과해버릴 수 있다")를 **두 번 다** 명시적으로 고정한다. `:2350`은 `renderHook()`의 반환값조차 캡처하지 않아 이런 단언을 걸 수 없는 구조다.
  - **실측(원본 회귀 재현이 아니라 새 실험)**: 신규 테스트에서 `document.referrer` 설정 줄만 제거해(=`detectHostOrigin`이 null 을 반환하도록 강제 → `isEmbedAllowed`가 fail-open 하여 2차 진입이 BLOCKED 가 아니라 ALLOWED 로 끝나도록 함) 격리 워크트리에서 단독 실행했다. **결과: 그래도 테스트가 PASS 한다**(1 passed, 22ms) — `hookPosts===1`이 "의도한 BLOCKED→ALLOWED 혼합 순서"와 "실수로 둘 다 ALLOWED(=`:2199`와 동일 시나리오로 퇴화)"를 구분하지 못하기 때문이다(둘 다 self-healing으로 `hookPosts===1`이 나온다). **대조 실험**: 동일한 실험을 이번 diff 와 무관한 기존 `:2275`에도 적용했더니 **동일하게 PASS**했다 — 즉 이 결함 있는 패턴은 이번 diff 가 새로 만든 게 아니라 `:2275`(선행 라운드에 이미 병합)에서 그대로 물려받은 것이다. 다만 이번 diff 는 "위 테스트의 반대 절반"이라는 명시적 거울상 관계를 표방하면서, `:2103`이 바로 위(같은 describe 블록, 약 250줄 위)에서 정확히 이 클래스의 거짓 음성을 막기 위해 전제를 고정한 전례를 따르지 않았다.
  - 완화 요인: `:2103`이 정확히 같은 BLOCKED 도달 경로(`document.referrer` + `boot()` origin 고정 + `allowlist`/`enforce`)를 독립적으로 명시 단언하므로, 이 경로가 실제로 깨지면(예: 향후 `detectHostOrigin` 리팩터) `:2103`이 먼저 크고 명확하게 실패해 회귀를 드러낸다 — 즉 스위트 차원에서는 "카나리아"가 존재해 즉각적 위험도는 낮다. 그러나 `:2350`/`:2275` 자신은 "이 시나리오를 검증하고 있다"는 착각을 준 채 조용히 다른(이미 커버된) 시나리오로 퇴화할 수 있다는 사실은 남는다.
  - 제안: `const { result } = renderHook(() => useWidget());`로 변경하고, `embedResolvers[1]` resolve 직후(BLOCKED 유발 payload) `await waitFor(() => expect(result.current.state.phase).toBe("blocked"));`를 추가해 `:2103`과 동일한 전제-고정 패턴을 적용할 것을 권고. 여유가 되면 `:2275`도 같은 패턴으로 후속 정리(이번 diff 범위는 아님).

- **[INFO]** 질의 3 — 5건이 놓치는 "그럴듯한 잘못된 fix"가 더 있는지: **구조적으로 좁음을 확인 + 신규 미검증 불변식 1건 발견(오늘은 도달 불가)**
  - 상세(탐색): `pendingResetRef`의 SET·CONSUME 두 접점만 존재하는 현재 구조에서 조합 가능한 "그럴듯한 대안"을 여럿 시도했으나 대부분 이미 테스트된 4종으로 환원되거나 무해함이 증명됐다 — (i) entry 시점에 세대-게이팅을 거는 변형은 같은 동기 구간 안이라 항상 참으로 붕괴해 설계(a)와 동일해짐, (ii) `worldGenRef`/`isStale(gen)`을 BLOCKED 분기에 재사용하는 변형은 `if (isStale(gen)) return;`이 이미 BLOCKED 체크보다 먼저 있어(동기 구간, 그 사이 await 없음) 항상 "not stale"로 평가돼 설계(b)와 동일하게 붕괴, (iii) unmount cleanup 에서 폐기하는 변형은 `useRef`가 마운트 스코프라 재마운트가 이미 새 `false`로 시작하므로 순수 no-op(concurrency.md INFO#2 가 이미 증명한 불변식과 동일 논리).
  - **신규 실측(mutation E, 4종 어디에도 속하지 않는 독립 실험)**: `configRef.current = cfg; setConfig(cfg); clientRef.current = new EiaClient(...);` 대입 직후, 소비 블록(`if (pendingResetRef.current)`) **직전**에 `await Promise.resolve();` 한 줄만 삽입(예: 향후 텔레메트리/로깅 리팩터가 우발적으로 만들 법한 변경)한 뒤 전체 44건을 재실행했다. **결과: 44/44 전부 통과** — 어떤 테스트도 이 mutation 을 탐지하지 못한다. 겹친 두 ALLOWED 시도(`:2199`)조차 통과하는 이유는, vitest 의 결정적 FIFO 마이크로태스크 스케줄링 하에서 두 부팅 체인이 동일한 홉 수(`fetchEmbedConfig`의 두 `await` + 신규 `await`)를 거치므로 `embedResolvers[0]`을 먼저 resolve 한 쪽이 항상 소비를 먼저 마치기 때문으로 보인다(A 가 소비 후 `pendingResetRef.current=false`를 동기적으로 세팅하므로 B 는 자기 차례에 이미 false 를 본다) — 이는 **설계가 실제로 안전해서가 아니라 테스트 하네스의 결정적 순서가 우연히 A→B 순서를 보존**하기 때문일 가능성이 있다(실제 프로덕션에서는 두 `fetch` 왕복 시간이 홉 수가 아니라 진짜 네트워크 타이밍으로 갈릴 수 있다).
  - 현재 코드에 이런 `await` 는 존재하지 않으므로(diff 대조 확인) **오늘 기준 도달 불가** — 즉시 결함은 아니다. 다만 `configRef.current` null 불변식(`:174-179` 부근)이나 `triggerEndpointPath` 불변식(이번 diff 가 추가한 `:183-191`)처럼, 이 코드도 "SET 과 CONSUME 사이엔 `await` 가 없어야 한다"는 **문서화되지 않은 세 번째 불변식**에 의존한다. concurrency.md(`14_30_15`)의 "원자성" 절이 이 불변식을 서술은 했으나("read-then-clear...사이에 await 가 전혀 없어 단일 동기 구간") JSDoc 본문에는 반영되지 않았다 — 같은 문서에 이미 정착된 "**불변식 의존 주의**" 패턴을 이 항목에도 적용하지 않은 누락으로 보인다.
  - 제안(이번 diff 필수 아님, 다음 라운드 후보): `pendingResetRef` JSDoc 에 "SET~CONSUME 사이 동기 구간 불변식"을 `configRef`/`triggerEndpointPath` 두 노트와 같은 형식으로 명문화. 런타임 단언으로 "await 부재"를 직접 테스트하긴 어려우므로(구조적 속성) 문서화가 현실적 완화책.

- **[INFO]** 그 외 테스트 관점 체크리스트 — 이번 delta 한정 결과 요약
  - **테스트 존재 여부**: `use-widget.ts`는 JSDoc 13줄뿐(코드 0줄, diff 직접 대조 확인) — 신규 테스트 불요 판단이 타당하다. 테스트 파일 변경(+1 회귀 테스트)은 W1 이 지목한 정확히 그 갭에 비례한다.
  - **Mock 적절성**: 신규 테스트의 `fetch` 스텁(embed-config/hooks POST/executions GET 3분기)은 형제 테스트(`:2199`,`:2275`)와 동일 패턴이고 실제 엔드포인트 shape(`ENDPOINTS` 상수, 봉투 `{data}` 응답)를 충실히 모사한다. 이질적 mock 없음.
  - **테스트 격리**: `document.referrer` 복원(전역 `afterEach`)·`vi.unstubAllGlobals()`·`sessionStorage.clear()` 모두 기존 장치에 의존하며 신규 테스트가 별도 정리 로직을 필요로 하지 않는다. 격리 이슈 없음.
  - **회귀 테스트 유효성**: 베이스라인 44/44, 376/376 직접 재현 — 기존 43건은 이번 diff 로 영향받지 않는다.
  - **테스트 용이성**: `pendingResetRef`가 SET·CONSUME 단 2개 접점만 갖는 현재 설계는 mutation 표면이 작아 본질적으로 테스트하기 쉬운 구조다 — 4라운드 수렴의 근본 원인이자 이 파일의 가장 큰 구조적 개선점이라고 판단한다.

## 요약

orchestrator 의 4개 질의를 전부 격리 워크트리에서 독립 mutation 으로 재실측했다. (1) 신규 테스트는 주장대로 `bootGenRef` 소유권 설계의 3줄 원본 재도입을 정확히 2건 실패(`:2103`+신규)로 탐지하며 `:2275`는 여전히 통과해 그 사각지대 존재도 재확인했다. (2) 네 가지 잘못된 설계(진입 시 일괄 폐기·BLOCKED 한정 폐기·`bootGenRef` 소유권·소비 자체 제거)를 각각 정확한 원본 코드로 재도입한 결과 4/3/2/5건이 실패해 현재 5건 스위트가 전부 탐지함을 확인했다(RESOLUTION.md 의 구 4-테스트 기준 수치와 "+1"로 정합). 다만 이 과정에서 두 가지 문서 정확성/견고성 문제를 발견했다 — 신규 테스트 코멘트의 "유일한 가드" 주장은 실측상 부정확하다(`:2103`이 순차 시나리오로 동일 mutation 을 독립적으로 잡음, 스코프 명시 필요), 그리고 신규 테스트 자신은 `result`를 캡처하지 않아 "2차가 실제로 BLOCKED 도달"이라는 전제를 고정하지 못한다 — referrer 제거 실험으로 실제 거짓 음성 가능성을 실측 확인했다(단 기존 `:2275`도 동일 패턴을 이미 갖고 있어 이번 diff 가 새로 만든 결함은 아니며, `:2103`이 같은 경로를 독립적으로 카나리아 역할해 스위트 전체의 즉각적 위험은 낮다). (3) 잔여 사각지대 탐색에서는 설계 공간이 2-접점 구조로 이미 매우 좁혀져 있어 추가로 유의미한 "그럴듯한 잘못된 설계"는 거의 없었으나, 유일하게 "config 확립~리셋 소비 사이엔 await 가 없어야 한다"는 세 번째 불변식이 문서화도 테스트도 안 돼 있음을 신규 mutation(E)으로 실측했다 — 오늘은 도달 불가하나 이 파일의 기존 "불변식 의존 주의" 컨벤션에 맞춰 JSDoc 명문화를 권고한다. 프로덕션 코드 자체는 순수 주석 변경(동작 무변경, 직접 diff 대조로 확인)이라 위험이 낮고, 발견된 두 WARNING 은 모두 테스트 파일 자체의 견고성/정확성 개선 권고이며 즉시 결함이나 회귀는 아니다.

## 위험도

LOW
