# Testing Review — 2026-07-17 12_04_49

**대상**: `codebase/channel-web-chat/src/widget/use-widget.ts`(`applyConfig` 진입 시 `pendingResetRef.current = false;`
1줄 추가, L732) + `use-widget-eager-start.test.ts`(회귀 테스트 1건 "차단된 부팅 중의 resetSession 은 이후 무관한
부팅으로 새어나가지 않는다", L2095-2179). 직전 라운드(`11_38_14`)에서 side_effect·testing 이 독립 발견하고
testing 이 실측 재현한 W1("유령 리셋" — `pendingResetRef` 가 부팅 시도에 스코프되지 않음)의 조치 커밋
(`e195a448c`)에 대한 검증이며, orchestrator 가 지정한 3개 질의(mutation 독립검증 · 전제 고정의 충분성 ·
인접 미커버 경로)에 집중했다.

**검증 방법**: `git worktree add --detach <tmp> HEAD` 로 격리 worktree 를 만들고(공유 worktree
`funny-mahavira-50d003` 는 시종 읽기 전용, `git status` 로 무오염 재확인), `codebase/channel-web-chat` 은
workspace 의존이 없는 self-contained 앱이라(직전 라운드 concurrency 리뷰가 확인) `node_modules` 심링크가
안전함을 재확인 후 심링크로 부트스트랩했다. 베이스라인 41/41 확보 후 (1) 프로덕션 fix 1줄을 되돌리는
mutation, (2) 테스트의 `document.referrer` 셋업을 제거하는 mutation, (3) 2차 boot 의 embed-config 응답을
1차와 동일한 차단 설정으로 바꾸는 adversarial probe, (4) 1차 boot 의 전제 단언을 고의로 깨 테스트를
중도 실패시키고 뒤에 더미 테스트를 붙여 `document.referrer` 누수를 직접 관찰하는 probe — 4가지를 각각
적용→실행→즉시 원복했다. 모든 실험 파일은 격리 worktree 안에서만 존재했고 작업 종료 후 worktree 자체를
`git worktree remove --force` 로 제거했다.

## 발견사항

- **[INFO]** 확인 요청 1(mutation 독립검증) — RESOLUTION 의 주장이 **정확히 재현됨**: 진입 시 폐기 라인 제거 시
  41건 중 신규 테스트 1건만 실패, 실패 지점도 동일
  - 위치: `use-widget.ts:732`(`pendingResetRef.current = false;`, 프로덕션 fix) ↔
    `use-widget-eager-start.test.ts:2095-2179`(신규 테스트).
  - 상세: 격리 worktree 에서 베이스라인(무mutation) `use-widget-eager-start.test.ts` **41/41 통과**를
    먼저 확보했다. `use-widget.ts:732` 한 줄만 제거하는 mutation 을 적용해 재실행한 결과
    **정확히 1건만 실패, 40건은 그대로 통과**했고, 실패 지점은 RESOLUTION 이 예고한 그대로
    `expect(window.sessionStorage.getItem(...)).toContain("legit")` — 실제 저장값은
    `{"executionId":"forced-new",...}` 로 "legit" 세션이 강제 새 대화로 덮였음을 직접 관측했다(다음
    줄 `expect(hookPosts).toBe(0)` 도 연쇄 실패권에 있었을 것이나 첫 실패에서 already-thrown). mutation
    원복 후 재실행 시 41/41 로 복귀. 이는 "이 회귀 테스트가 정확히 그 결함을 잡는지"에 대한 **독립
    mutation-kill 확인**이며, RESOLUTION §W1 이 보고한 수치와 완전히 일치한다.
  - 제안: 없음(주장 확인됨).

- **[INFO]** 확인 요청 2(전제 고정의 필요성) — `document.referrer` 를 제거하는 mutation 으로 **저자가 겪은
  초회 거짓 음성을 그대로 재현**, `expect(phase).toBe("blocked")` 가 정확히 그 실패를 잡아냄을 확인
  - 위치: `use-widget-eager-start.test.ts:2096-2101`(referrer 오버라이드) ↔ `:2154`(전제 단언) ↔
    `codebase/channel-web-chat/src/widget/host-bridge.ts:93-108`(`detectHostOrigin` — `ancestorOrigins`
    없으면(jsdom) `document.referrer` 폴백, 그마저 없으면 `null`) ↔ `use-widget.ts:224-234`(`isEmbedAllowed`
    — `host` 가 `null` 이면 fail-open `return true`).
  - 상세: 테스트에서 `document.referrer` 셋업 블록만 제거하고(전제 단언·나머지 로직은 그대로) 재실행하니,
    1차 boot 의 `expect(result.current.state.phase).toBe("blocked")` 가 **`received: "streaming"`** 으로
    실패했다 — RESOLUTION §W1 이 서술한 "내 초회 재현은 실패했다 — `phase=streaming`" 과 **정확히 같은
    증상**을 독립적으로 재현했다. 이는 (a) `document.referrer` 셋업이 장식이 아니라 이 테스트가 의도한
    시나리오(BLOCKED)에 실제로 도달하기 위한 **필수 전제조건**이라는 것과, (b) `expect(phase).toBe("blocked")`
    가 그 전제 붕괴를 **정확한 지점에서 시끄럽게** 잡아낸다는 것(뒤섞인 다른 단언 실패로 오도되지 않고,
    "전제 — 여기 못 오면 테스트가 무의미" 주석이 가리키는 바로 그 줄에서 죽는다는 것) 둘 다를 실증한다.
  - 제안: 없음(전제 고정의 필요성·정확성 확인됨). 다만 이 전제는 **jsdom 유닛 테스트 한정**으로만
    `document.referrer` 를 검증한다 — 실제 브라우저 iframe 은 `location.ancestorOrigins` 가 존재해
    `detectHostOrigin` 이 그쪽을 먼저 본다(host-bridge.ts:95-97). 이는 이 테스트의 결함이 아니라 유닛
    테스트 계층의 근본적 한계이므로 조치 불요 — 아래 "인접 미커버 경로"에서 별도로 기록.

- **[WARNING]** 2차 부팅이 실제로 "허용" 상태에 도달했는지는 **고정되지 않음** — 대칭적 전제 결손을
  adversarial probe 로 실증
  - 위치: `use-widget-eager-start.test.ts:2160-2169`(2차 `boot()` → `embedResolvers[1]` resolve) ↔
    `:2172-2176`(최종 두 단언 — `sessionStorage` 내용 + `hookPosts`).
  - 상세: 이 테스트는 1차 boot 의 전제(BLOCKED 도달)는 `expect(phase).toBe("blocked")` 로 명시 고정했지만,
    2차 boot 의 전제("이번엔 허용돼 정상 진행" — 테스트 자체 주석 L2162 "2차 부팅 — allowlist 를 고쳐
    재전송... 정상 세션이 살아있고(복원됨)")는 어떤 단언으로도 확인하지 않는다. 최종 두 단언
    (`sessionStorage` 에 `"legit"` 포함 여부, `hookPosts === 0`) 은 **"2차 boot 도 아무 이유로든 진행되지
    않는" 퇴화 시나리오에서도 똑같이 참**이다 — `pendingResetRef` 가 소비되지 않는 것도, `newChat()`/
    `start()` 가 아예 호출되지 않는 것도 저장소를 건드리지 않고 webhook 도 쏘지 않기 때문이다. 이를
    adversarial probe 로 직접 실증했다: 2차 `embedResolvers[1]` 의 응답을 1차와 **동일한 차단 설정**
    (`allowlist: ["http://other.test"], enforce: true`)으로 바꿔 "2차 boot 도 BLOCKED 로 끝나는" 상황을
    만들었더니(1차 fix 는 그대로 둔 채), **테스트가 그대로 GREEN 으로 통과**했다(1 passed). 즉 이 테스트는
    "1차의 유령 리셋이 2차로 새지 않는다"와 "2차 boot 자체가 정상적으로 허용/진행됐다"를 **구분하지
    못한다** — 후자가 어떤 무관한 이유로 깨져도(예: 향후 리팩터가 `isEmbedAllowed`/`applyConfig` 를
    건드려 2차도 우연히 막히는 회귀가 생겨도) 이 테스트는 계속 green 을 보고해 그 회귀를 가려버린다.
    저자 스스로 1차 전제에 대해 "여기 못 오면 테스트가 무의미해지는 걸 내가 실제로 겪었다"고 명시했는데,
    같은 논리가 2차에도 대칭적으로 적용돼야 한다.
  - 제안: 2차 `flushAsync()` 직후 `expect(result.current.state.phase).toBe("streaming")`(또는 최소
    `.not.toBe("blocked")`) 를 추가해 1차와 대칭적으로 전제를 고정한다. 1줄 추가로 해결되며, 이 워딩은
    테스트 자체의 서술("정상 세션이 살아있고(복원됨)")이 이미 주장하는 바를 코드로 확인시키는 것뿐이다.

- **[WARNING]** `document.referrer` 복원이 **assert 실패에서 살아남지 못함** — 같은 코드베이스가 이미
  확립한 W6 컨벤션(`widget-app.test.tsx`) 대비 회귀, 실제 누수를 실측
  - 위치: `use-widget-eager-start.test.ts:2096-2099`(오버라이드) ↔ `:2178`(인라인 복원,
    `if (referrer) Object.defineProperty(...)`) ↔ 대조:
    `codebase/channel-web-chat/src/widget/widget-app.test.tsx:164-167`(`afterEach` 로 전역 상태를
    무조건 복원 — 주석 "복원은 afterEach 에서 보장 — assertion 실패 시에도 전역 상태 누수 없음(W6)").
  - 상세: 이 파일의 전역 `afterEach`(`use-widget-eager-start.test.ts:188-195`)는 `vi.unstubAllGlobals()`·
    `vi.useRealTimers()`·`vi.restoreAllMocks()` 만 수행하며, `Object.defineProperty` 로 직접 재정의한
    `document.referrer` 는 그 어느 것으로도 되돌지 않는다 — 오직 테스트 본문 마지막 줄(L2178)의 인라인
    복원에만 의존한다. 그런데 이 줄은 **그 앞의 어떤 `expect` 든 던지면 도달하지 못한다**(try/finally
    없음). 바로 위 형제 파일(`widget-app.test.tsx`)은 **같은 문제를 이미 겪고 W6 로 고쳐** "assertion
    실패 시에도 전역 상태 누수 없음"을 명시적으로 보장하는 `afterEach` 패턴을 확립해 놓았는데, 이번
    신규 테스트는 그 패턴을 따르지 않고 더 취약한 인라인-복원으로 되돌아갔다. 실측으로 확인했다 — 1차
    전제 단언(L2154)을 고의로 깨서 테스트를 중도 실패시키고 바로 뒤에 더미 테스트를 추가해
    `document.referrer` 를 읽어보니 **`"http://host.test/page"`(오버라이드 값)가 그대로 누출**돼 있었다
    (정상이라면 빈 문자열). **다만 오늘 시점의 실제 파급 범위는 제한적**임을 함께 확인했다 — 이 파일
    안에서 `enforce: true` + 비어있지 않은 allowlist 로 embed-config 를 구성하는 테스트는 이 신규
    테스트가 유일하다(grep 확인, 0건 추가 매치). 다른 모든 테스트는 `installFetch`/`installControllableSse`
    등에서 `/embed-config` fetch 자체가 reject 하도록 구성돼 있어 `fetchEmbedConfig` 가 항상 `null` 을
    반환하고, `isEmbedAllowed` 는 `!cfg` 로 **`detectHostOrigin` 호출 전에 즉시 `true` 를 반환**한다 —
    즉 오늘은 이 파일 안에 이 누수로 결과가 뒤바뀔 후속 테스트가 없다. 그러나 이건 **오늘 우연히
    안전한 것**이지 구조적으로 안전한 게 아니다 — 이 테스트가 실패하는 날(정확히 회귀가 실제로 생겨
    잡아야 할 그 날) `document.referrer` 가 다음 테스트로 새고, 향후 이 describe 블록에 `enforce:true`
    시나리오가 하나라도 추가되면 실패 원인이 뒤섞여 디버깅을 방해할 수 있다 — 정확히 W6 가 방지하려던
    시나리오다.
  - 제안: `widget-app.test.tsx:164-167` 과 동형으로, 이 테스트 안의 인라인 복원 대신 파일 전역
    `afterEach`(또는 이 테스트 전용 `try/finally`)에서 `document.referrer` 를 무조건 복원하도록 옮긴다.
    이 파일에 이미 있는 전역 `afterEach`(L188-195)에 한 줄 추가하는 것으로 충분하다.

- **[INFO]** 확인 요청 3(인접 미커버 경로) — 구조적으로는 안전하나 실측되지 않은 경로 3곳
  - 상세:
    1. **3회 이상 연속 BLOCKED**: 1차·2차 모두 BLOCKED(각각 다른 이유로 리셋 도착) 후 3차가 허용되는
       체인은 테스트되지 않는다. `pendingResetRef.current = false` 를 **매 `applyConfig` 진입 시**
       무조건 실행하는 설계이므로(직전 시도 횟수와 무관), 분석적으로는 N 회로 일반화돼야 하지만, 이
       파일이 "명백히 안전해 보이는 일반화가 4라운드 연속 깨진" 이력(`worldGenRef` 통합·C1 등)이 있는
       만큼 3차 이상 체인의 명시적 테스트가 있으면 더 견고하다. 우선순위는 낮음(현재 로직에 카운트
       의존성이 전혀 없어 회귀 여지가 좁음).
    2. **cross-endpoint 재부팅**: 1차 boot(`triggerEndpointPath="t1"`)가 BLOCKED 로 리셋 의도를 남긴 채,
       2차 boot 가 **다른** `triggerEndpointPath`(예: `"t2"`) 로 온다면 어떻게 되는지 테스트되지 않는다.
       `pendingResetRef` 는 boolean 이라 대상 endpoint 정보가 없으므로 현재 fix 는 이 경우에도 플래그를
       무조건 폐기한다 — 이는 "t1" 리셋 의도가 "t2" 부팅에 오적용되는 걸 막는 **안전한 방향**의 부작용
       (t1 리셋이 조용히 유실될 뿐, 잘못된 대상에 적용되지는 않음)이라 새 버그는 아니지만, 명시
       테스트는 없다.
    3. **`live-preview.tsx` 실제 재전송 경로의 상위 레이어 테스트 부재**: 이 fix 의 커밋 메시지와 코드
       주석이 근거로 드는 실제 프로덕션 트리거는 `codebase/frontend/src/components/web-chat/live-preview.tsx`
       의 `postBoot()`(draft 변경 시 iframe 재마운트 없이 `wc:boot` 재전송, `live-preview.tsx:70-119`) 인데,
       이번 회귀 테스트는 전부 `use-widget` 훅 레벨에서 `boot()` 헬퍼로 `wc:boot` 를 손으로 2번 주입하는
       방식이다. `widget-app.test.tsx`(컴포넌트 레벨) 나 `codebase/frontend` 쪽에는 이 시나리오를 다루는
       테스트가 없다(grep 확인 — `resetSession` 관련 테스트는 이 파일 하나뿐). 이 파일의 기존 테스트가
       전부 이 계층에서만 동작하는 기존 컨벤션과 일관되므로 이번 delta 만의 결함은 아니지만, 근거로 든
       실제 트리거(`live-preview.tsx`)와 검증 계층(훅 단위) 사이의 간극은 기록해 둘 가치가 있다.
  - 제안: 1·2 는 낮은 우선순위 참고용. 3 은 이 fix 의 범위를 벗어나므로 조치 불요 — 다만 향후
    `live-preview.tsx`/`widget-app` 레벨 테스트를 추가할 계획이 있다면 이 시나리오(draft 변경 재전송 +
    임베드 차단 + resetSession)를 후보로 남겨둘 것.

- **[INFO]** 기존 40개 테스트 회귀 없음 + Mock 충실도 양호 — 확인
  - 상세: 격리 worktree 에서 신규 테스트를 제외한 40건 전부가 mutation 유무와 무관하게 항상 통과해
    (collateral failure 0건) 신규 테스트의 격리성도 양호함을 같이 확인했다. Mock 측면에서는 응답 envelope
    이 `{ data: {...} }` 형태로 `TransformInterceptor` 계약과 일치하고, `executionId: "forced-new"`/
    `"legit"` 같은 네이밍이 테스트 실패 시 원인(어느 세션이 어느 값으로 덮였는지)을 즉시 드러내도록
    설계돼 있어 가독성이 좋다. `pendingResetRef` 소비/미소비라는 내부 구현 디테일에 직접 접근하지 않고
    `postMessage`(`boot`/`sendHostCommand`)와 공개 상태(`result.current.state`)만으로 블랙박스 검증한
    점도 테스트 용이성 관점에서 적절하다.
  - 제안: 없음.

## 요약

부모가 요청한 세 질의에 대한 결론: **(1) mutation 독립검증** — 격리 worktree 에서 프로덕션 fix 1줄
(`use-widget.ts:732`)을 제거하는 mutation 을 직접 적용해 RESOLUTION 의 주장("41건 중 이 테스트만 실패")을
**정확히 재현**했고 원복 후 41/41 복귀도 확인했다. 이 회귀 테스트는 저자가 재현한 그 결함(부팅-스코프
미고정으로 인한 "유령 리셋")을 실제로 검출한다. **(2) 전제 고정의 충분성** — `document.referrer` 셋업을
제거하는 mutation 으로 저자가 겪은 초회 거짓 음성(phase=streaming, BLOCKED 미도달)을 독립적으로 재현했고,
`expect(phase).toBe("blocked")` 가 정확히 그 지점에서 실패해 전제 붕괴를 시끄럽게 드러냄을 확인했다 —
1차 전제는 견고하다. 다만 **같은 논리가 2차 boot 에는 적용되지 않았다**: adversarial probe(2차
embed-config 응답을 1차와 동일한 차단 설정으로 치환)로 이 테스트가 "2차 boot 도 BLOCKED 로 끝나는" 퇴화
시나리오에서 **그대로 green 을 보고함**을 실증했다 — 1차와 대칭적인 전제 고정(`expect(phase).toBe("streaming")`)
이 빠져 있다(WARNING). 추가로 `document.referrer` 인라인 복원이 assert 실패 시 살아남지 못해 다음 테스트로
누수됨을 직접 관측했다 — 같은 코드베이스가 이미 W6 로 확립해 둔 "assertion 실패에도 안전한 afterEach 복원"
컨벤션에서 이번 신규 테스트만 이탈했다(WARNING, 오늘 기준 파급은 제한적이나 구조적으로 취약). **(3) 인접
미커버 경로** — 3회 이상 연속 BLOCKED 체인, cross-endpoint 재부팅, `live-preview.tsx` 실제 재전송 경로의
상위 레이어(컴포넌트/frontend) 테스트 부재를 확인했으나 셋 다 현재 설계상 안전하거나 이 fix 범위 밖이라
낮은 우선순위다. 두 WARNING 모두 프로덕션 로직의 결함이 아니라 **이 회귀 테스트 자체의 견고성**에 관한
것이며 각각 1줄 안팎으로 고칠 수 있다 — 핵심 주장(fix 가 실제 결함을 잡는다)은 독립 mutation 으로 확실히
검증됐다.

## 위험도

LOW
