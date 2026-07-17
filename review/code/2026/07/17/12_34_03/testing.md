# Testing Review — 2026-07-17 12_34_03

**대상**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(전역 `afterEach` 로 `document.referrer`
복원 이동 · 기존 테스트에 `waitFor(streaming)` 2차 전제 추가 · 신규 회귀 테스트 "겹친 부팅(boot 재전송)이 그 사이
접수한 정당한 리셋을 삼키지 않는다") + `use-widget.ts`(`pendingResetRef` 폐기를 `applyConfig` 진입-시 → `BLOCKED`
분기로 국한). 직전 라운드(`12_04_49`)에서 testing 이 낸 W2(거짓 음성)·W3(전역 상태 누수) 지적과 side_effect 가 낸
W1(겹친 부팅에서 정당한 리셋 소실) 지적에 대한 조치(커밋 `0d6128c74`)의 검증이며, orchestrator 가 지정한 5개
질의(① W2 adversarial probe 재현 · ② W3 관측 재현 · ③ side_effect W1 회귀 테스트 mutation-kill · ④ 두 회귀
테스트의 양방향 상호보호 · ⑤ 인접 미커버 경로)에 집중했다.

**검증 방법**: `git worktree add --detach <tmp> HEAD` 로 격리 worktree 를 2회 순차 생성(공유 worktree
`funny-mahavira-50d003` 는 시종 읽기 전용 — 매 라운드 종료 후 `git status --short` 로 무오염 재확인)하고,
`node_modules` 는 공유 worktree 의 실제 디렉터리를 그대로 symlink 해 부트스트랩했다(vitest 실행만 필요해
Next/Turbopack 의 심링크 거부 이슈 무관 — `12_04_49` testing 리뷰가 이미 확인한 방법 재사용). 베이스라인
**42/42 통과**를 먼저 확보한 뒤 6가지 mutation/probe 를 각각 적용 → 실행 → 즉시 원복(`diff` 로 원상 확인)했다.
마지막에 두 worktree 모두 `git worktree remove --force` 로 제거했다.

## 발견사항

- **[INFO]** 질의 ① — W2(거짓 음성) 조치 검증: 직전 라운드의 adversarial probe 를 그대로 재현하니 **이제 실제로
  실패함**을 확인
  - 위치: `use-widget-eager-start.test.ts:2172-2184`(2차 boot resolve + 신규 `waitFor(streaming)` 단언).
  - 상세: 2차 boot(`embedResolvers[1]`)의 응답을 1차와 **동일한 차단 설정**(`allowlist: ["http://other.test"],
    enforce: true`)으로 치환하는 mutation 을 적용해 재실행했다. 직전 라운드에선 이 조작이 "아무 일도 안 일어나서"
    green 이었지만, 이번엔 **정확히 신규 라인(L2184)에서 실패**했다 — `AssertionError: expected 'blocked' to be
    'streaming'`. 원복 후 42/42 로 복귀 확인. 거짓 음성이 해소됐음을 실측으로 확인했다.
  - 제안: 없음(조치 확인됨).

- **[INFO]** 질의 ② — W3(전역 상태 누수) 조치 검증: 직전 라운드의 관측 방법(고의 실패 + 더미 테스트)을 재현하니
  **누수가 사라졌음**을 확인
  - 위치: `use-widget-eager-start.test.ts:195-200`(전역 `afterEach` 의 `document.referrer` 복원) ↔ `:2101-2107`
    (오버라이드 지점, 인라인 복원 코드는 이제 없음).
  - 상세: "차단된 부팅 중의 resetSession..." 테스트의 1차 전제 단언(`expect(phase).toBe("blocked")`, L2161)을
    고의로 깨 중도 실패시키고, 같은 `describe` 블록 끝에 `expect(window.document.referrer).toBe("")` 만 확인하는
    더미 테스트를 추가해 실행했다. 결과 `1 failed | 1 passed` — 실패한 건 의도한 고의 실패(전제 단언)뿐이고, 더미
    테스트는 **통과**해 `document.referrer` 가 `""`(fail-open 기본값)로 정상 복원돼 있음을 직접 관측했다. 원복
    후 42/42 복귀 확인. 인라인 복원(assert 실패 시 미도달)에서 전역 `afterEach`(항상 실행)로 옮긴 조치가 실제로
    누수를 차단함을 확인했다.
  - 제안: 없음(조치 확인됨).

- **[INFO]** 질의 ③ — side_effect W1 회귀 테스트("겹친 부팅...")의 **mutation-kill 검증**: entry-clear 재도입 시
  **정확히 이 테스트만** 실패
  - 위치: `use-widget.ts:719-721`(`applyConfig` 진입부에 `pendingResetRef.current = false;` 를 재도입하는
    mutation) ↔ `use-widget-eager-start.test.ts:2197-2260`(신규 회귀 테스트).
  - 상세: `11_38_14` 가 만들었던 잘못된 fix(진입-시 일괄 폐기)를 `if (!cfg.apiBase ...) return;` 가드 직후에
    그대로 재도입하는 mutation 을 적용해 전체 파일(42건)을 재실행했다. 결과 **"겹친 부팅(boot 재전송)이 그 사이
    접수한 정당한 리셋을 삼키지 않는다" 1건만 실패**(`AssertionError: expected +0 to be 1` — `hookPosts` 가
    기대 1 대신 0, 즉 리셋이 소실되고 구 세션이 이어짐), 나머지 41건(기존 "차단된 부팅 중의..." 포함)은 그대로
    통과했다. 원복 후 42/42 복귀 확인. 신규 회귀 테스트가 정확히 이 결함을 검출함을 독립 mutation 으로 확인했다.
  - 제안: 없음(검출력 확인됨).

- **[INFO]** 질의 ④ — 두 회귀 테스트의 **양방향 상호보호** 검증: 반대 방향 mutation 으로도 대칭적으로 확인
  - 위치: `use-widget.ts:727-741`(`if (!allowed) {...}` BLOCKED 분기의 `pendingResetRef.current = false;`,
    L739) ↔ 두 회귀 테스트(`:2101`, `:2197`).
  - 상세: 이번엔 반대 방향 — BLOCKED 분기의 폐기 라인(L739)을 **완전히 제거**(entry-clear 도 없고 BLOCKED-분기
    폐기도 없는, `11_38_14` 이전 원시 상태로 복원)하는 mutation 을 적용해 42건을 재실행했다. 결과 **"차단된
    부팅 중의 resetSession..." 1건만 실패**(`expected '...forced-new...' to contain 'legit'` — 유령 리셋이
    무관한 2차 부팅으로 유출돼 구 세션이 강제 새 대화로 덮임), "겹친 부팅..." 테스트는 이 mutation 과 무관하게
    (해당 테스트는 두 boot 모두 allowed 라 BLOCKED 분기 자체를 지나지 않음) 그대로 통과했다. 원복 후 42/42
    복귀 확인.
  - **결론**: 질의 ③(entry-clear 재도입 → "겹친 부팅"만 실패)과 질의 ④(BLOCKED-분기 폐기 제거 → "차단된
    부팅"만 실패)를 합치면, 두 테스트는 서로 **다른 축**을 지킨다 — "차단된 부팅" 은 "폐기가 없으면" 실패하고
    "겹친 부팅" 은 "폐기가 너무 넓으면(entry-scope)" 실패한다. 어느 방향으로 "고쳐도"(폐기를 없애거나, 폐기
    범위를 넓히거나) 반대편 테스트가 잡는 구조임을 실측으로 확인했다 — RESOLUTION 의 주장과 일치.
  - 제안: 없음(쌍 구조 확인됨).

- **[WARNING]** 질의 ⑤(인접 미커버 경로) — **신규 발견**: 겹친 두 부팅 중 **먼저 resolve 되는 쪽이 BLOCKED,
  나중에(겹쳐서) resolve 되는 쪽이 ALLOWED** 인 혼합 시나리오에서 리셋이 소실됨을 실측(PROBE) 재현
  - 위치: `use-widget.ts:727-741`(BLOCKED 분기의 `pendingResetRef.current = false;`, L739) — 이 분기가 "이
    시도가 실패했다"는 사실만으로 폐기하는데, **아직 살아있고 곧 성공할 다른(겹친) 시도**가 그 리셋을 대신
    이행할 기회까지 함께 지워버린다.
  - 상세: 격리 worktree 에서 임시 probe 테스트를 추가해 확인했다(최종 반영하지 않고 검증 후 즉시 원복 —
    아래 재현 스텝 참조). 시나리오: 구 세션 존재 → boot#1 in-flight(embed-config 왕복 중) → `resetSession`
    도착(`pendingResetRef.current = true`, 정상 지연 이행 설계) → boot#1 이 아직 in-flight 인 동안 boot#2
    도착(재마운트 없는 `wc:boot` 재전송, spec `2-sdk.md:106`) → **먼저** boot#1 이 resolve 되며 이번엔
    **BLOCKED**(allowlist 불일치) → `:739` 가 `pendingResetRef.current = false` 로 **아직 boot#2 가 소비하지
    못한 리셋 의도를 지운다** → 뒤이어 boot#2 가 resolve 되며 **ALLOWED** → `configRef.current` 세팅 후
    `pendingResetRef.current` 확인 시 이미 `false`(boot#1 이 지웠음) → `loadSession()` 으로 **구 세션을 그대로
    복원** → host 가 요청한 "새 대화"가 소실됨. 실측 결과 `hookPosts` 가 기대 1 이 아니라 **0** 으로 고정돼
    타임아웃 실패했다 — 이론적 구성이 아니라 재현 가능한 결함이다.
  - **기존 두 회귀 테스트로 커버되지 않는 이유**: "차단된 부팅 중의..." 은 boot#1 이 **완전히 반환된 뒤**
    boot#2 가 시작되는 순차 시나리오만 다루고(겹치지 않음), "겹친 부팅..." 은 boot#1·boot#2 **둘 다 ALLOWED**
    로 resolve 되는 경우만 다룬다(자기치유가 성립하는 케이스). **"겹치면서 outcome 이 서로 다른"**(하나는
    BLOCKED, 하나는 ALLOWED) 조합은 이번 delta 의 어느 테스트에도 없다.
  - **재현 스텝(격리 worktree, 결과 재확인용)**: `use-widget-eager-start.test.ts` 의 "겹친 부팅..." 테스트를
    복제해 두 번째 `boot()` 이후 `embedResolvers[0]` 을
    `{ allowlist: ["http://other.test"], enforce: true }`(BLOCKED)로, `embedResolvers[1]` 을
    `{ allowlist: [], enforce: false }`(ALLOWED)로 resolve 하도록만 바꾸면 `await waitFor(() =>
    expect(hookPosts).toBe(1))` 이 타임아웃으로 실패한다(재현 확인, 원복 완료).
  - **실사용 도달 가능성**: side_effect 가 이미 확인한 "둘 다 ALLOWED" 겹침의 실사용 경로(관리자 라이브
    미리보기의 draft 연타 + `resetSession`, `live-preview.tsx:71-119`)와 **같은 트리거 계열**이지만, 이번
    조합은 겹친 두 `wc:boot` 가 **서로 다른 allow/block 판정**을 받아야 한다 — 예컨대 관리자가 미리보기에서
    `triggerEndpointPath` 를 바꿔가며(서로 다른 엔드포인트는 서로 다른 embed-config allowlist 를 가질 수 있음)
    빠르게 재전송하는 도중 `resetSession` 을 누르는 경우, 또는 서버측 allowlist/enforce 설정이 두 fetch 사이에
    실제로 바뀌는 좁은 TOCTOU 창. "둘 다 ALLOWED" 케이스보다는 좁지만 이론적 구성은 아니다.
  - **영향**: W1/side_effect-W1 과 동일한 손상 범주(탭 스코프 세션 오배정 — host 가 새 대화를 요청했는데 이전
    대화가 계속됨). 새 침해 범주 아님.
  - **근본 원인은 이미 인지됨**: 이는 `12_04_49` side_effect 가 이미 이월한 INFO#3("`pendingResetRef` 가 단일
    boolean 인 한 '죽은 시도의 잔재'와 '아직 살아있는 시도를 위한 유효한 의도'를 구분 못한다" · "부팅 시도
    세대(boot-attempt generation) 도입" 권고)의 **또 다른 구체적 인스턴스**다 — 다만 side_effect 가 실측한
    것은 "둘 다 ALLOWED" 조합이었고, 이번은 "BLOCKED+ALLOWED 혼합" 조합이라는 점에서 새로운 증거다. 즉 이번
    라운드의 fix(BLOCKED-분기로 폐기를 국한)는 "이 시도가 실패했다" 기준으로 폐기하는데, 그 기준 자체가
    "생존한 다른 시도가 있는지"를 보지 못하는 한 이런 혼합 케이스에서 계속 새는 구조다.
  - 제안: 이번 라운드에서 즉시 고칠 필요는 없다(이미 이월된 구조적 이슈의 연장선이고, 현재 fix 를 되돌릴
    사유는 아니다) — 다만 **다음에 `pendingResetRef` 관련 구조 변경(세대 카운터 등)을 할 때 이 혼합 시나리오도
    회귀 테스트로 추가**할 것을 권고한다. 최소한 이번 라운드 산출물(RESOLUTION/이월 목록)에 "겹침+outcome
    혼합" 케이스를 INFO#3 의 하위 항목으로 명시해 두면, 다음 라운드가 세대 카운터를 설계할 때 커버해야 할
    구체적 테스트 케이스 목록으로 바로 쓸 수 있다.

- **[INFO]** 겹친 두 부팅(둘 다 ALLOWED)의 **resolve 순서 역전**은 안전함을 확인 — 낮은 우선순위 커버리지 노트
  - 위치: `use-widget-eager-start.test.ts:2251-2256`(현재 커밋된 테스트는 `embedResolvers[0]` → `[1]` 순서로만
    resolve).
  - 상세: 커밋된 "겹친 부팅..." 테스트는 boot#1 이 먼저 resolve 되는 순서만 고정한다. 순서를 뒤집는(boot#2 를
    먼저 resolve) probe 테스트를 격리 worktree 에서 추가 실행한 결과 **정상 통과**했다 — "먼저 소비하는 쪽이
    `newChat`→세대 증가로 나머지를 stale 화" 하는 자기치유가 어느 쪽이 먼저 resolve 되든 대칭적으로 성립함을
    실측으로 확인했다(코드 주석이 서술하는 설계 의도와 일치). 다만 이 순서 자체를 고정하는 **커밋된** 테스트는
    없다 — 오늘은 안전하지만 향후 리팩터가 이 대칭성을 깨도 즉시 잡을 테스트가 없다는 뜻이므로, 순수 커버리지
    관점에서는 여전히 갭이다.
  - 제안: 우선순위 낮음. 위 WARNING(혼합 outcome 케이스)과 묶어 다음 라운드의 회귀 테스트 후보로 남겨둘 것.

- **[INFO]** 코드 주석의 리뷰 라운드 인용 라벨이 `RESOLUTION.md` 번호와 어긋남(사소, 기능 영향 없음)
  - 위치: `use-widget-eager-start.test.ts:2183`(`(ai-review 2026-07-17 12_04_49 testing W1)`) ↔ `:199`
    (`(ai-review 2026-07-17 12_04_49 testing W2)`) ↔ 대조: `review/code/2026/07/17/12_04_49/RESOLUTION.md`
    (거짓 음성 fix = **W2**, referrer 누수 fix = **W3**).
  - 상세: `waitFor(streaming)` 추가(거짓 음성 조치)의 코드 주석은 "testing W1" 을 인용하지만 `RESOLUTION.md` 는
    이를 **W2**로 명명한다. 전역 `afterEach` 로 옮긴 referrer 복원(누수 조치)의 코드 주석은 "testing W2" 를
    인용하지만 `RESOLUTION.md` 는 이를 **W3**로 명명한다 — 둘 다 하나씩 밀려 있다. 기능적 결함은 아니나, 향후
    누군가 `RESOLUTION.md` 의 "W2(testing)" 를 grep 해 코드 근거를 찾으려 하면 엉뚱한 줄(referrer 관련)을
    먼저 찾게 되는 혼동 소지가 있다.
  - 제안: 우선순위 낮음. 다음에 이 파일을 만질 때 주석의 W-라벨을 `RESOLUTION.md` 기준(W2/W3)으로 정정 권고
    (documentation 리뷰어 영역과도 겹치므로 필수 차단 사유는 아님).

- **[INFO]** 직전 라운드에서 이미 이월된 인접 갭 — 이번 델타로 조치되지 않았고 여전히 유효(재확인, 새 지적
  아님)
  - 상세: `12_04_49` testing 리뷰가 낸 세 가지(3회 이상 연속 BLOCKED 체인 미검증 · cross-endpoint 재부팅
    미검증 · `live-preview.tsx` 실제 재전송 경로의 상위 레이어(`widget-app`/`frontend`) 테스트 부재)는 이번
    delta 의 범위 밖이라 그대로 남아 있다. 위 WARNING(혼합 outcome 겹침) 이 사실상 "cross-endpoint 재부팅"
    항목과 맞닿아 있어(서로 다른 endpoint 면 allow/block 판정이 갈릴 수 있음), 다음 라운드에서 함께 검토하면
    효율적이다.
  - 제안: 없음(추적만).

## 요약

부모가 요청한 5개 질의 중 ①~④(specifically-asked 조치 검증)는 **전부 실측으로 확인됐다**: ① W2(2차 boot 전제
미고정) 조치는 리뷰어의 adversarial probe 를 그대로 재현해 이제 정확히 신규 `waitFor(streaming)` 라인에서
실패함을 확인했다(거짓 음성 해소). ② W3(`document.referrer` 전역 상태 누수) 조치는 고의 실패 + 더미 테스트
관측법을 재현해 누수가 사라졌음을 확인했다(전역 `afterEach` 이동이 유효). ③ side_effect W1 신규 회귀 테스트
("겹친 부팅...")는 entry-clear 재도입 mutation 으로 **정확히 이 테스트 1건만** 실패함을 확인해 검출력을
독립 검증했다. ④ 반대 방향 mutation(BLOCKED-분기 폐기 완전 제거)으로는 **정확히 반대편 테스트("차단된
부팅...") 1건만** 실패함을 확인해, 두 회귀 테스트가 서로 다른 축(폐기 없음 vs 폐기 범위 과다)을 지키는
상보적 쌍임을 양방향으로 실측했다 — RESOLUTION 의 주장과 완전히 일치한다. ⑤(인접 미커버 경로)에서는 기존에
이월된 항목 재확인에 더해, **겹친 두 부팅 중 먼저 resolve 되는 쪽이 BLOCKED 이고 나중에 resolve 되는 쪽이
ALLOWED 인 혼합 시나리오에서 리셋이 소실되는 새로운 결함을 실제로 재현**했다(PROBE, `hookPosts` 기대 1 대신
0으로 타임아웃) — 이는 side_effect 가 이월한 INFO#3(단일 boolean 플래그의 구조적 한계·세대 카운터 필요성)의
새로운 구체적 증거이며, 커밋된 두 회귀 테스트 어느 쪽도 이 조합을 커버하지 않는다. 추가로 resolve 순서 역전
(둘 다 ALLOWED)은 안전함을 확인했고(INFO), 코드 주석의 리뷰 라벨 인용이 `RESOLUTION.md` 번호와 하나씩 밀려
있는 사소한 불일치도 발견했다(INFO). 이번 라운드가 요청받은 조치 자체는 모두 정확하고 견고하게 검증됐으나,
"이 fix 로 커버되지 않는 인접 경로" 질의가 실제로 활성 결함 하나를 새로 드러냈다는 점에서 완전히 닫힌 상태는
아니다.

## 위험도

MEDIUM
