# 부작용(Side Effect) Review — 2026-07-17 12_34_03

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`(`pendingResetRef` 폐기 위치를 `applyConfig` 진입-시 일괄 → `!allowed`(BLOCKED) 분기로 되돌림, 1줄 이동) + `use-widget-eager-start.test.ts`(양방향 회귀 테스트 2건: `11_38_14` 순차-누출 케이스 재보강, `12_04_49` 겹침-스왈로 케이스 신규).

## 검증 방법

정적 추적(코드 전수 상태-전이 트레이스)으로 질문 1·2 에 답하고, 그 과정에서 세운 새 가설 하나(아래 WARNING)는 `git worktree add --detach`(공유 트리 밖) 격리 환경에서 실측 재현했다 — 검증 후 `git worktree remove --force` 로 즉시 제거, 공유 워크트리는 `git status --short` 로 오염 없음 확인(`review/code/2026/07/17/12_34_03/` 신규 디렉터리만 존재). node_modules 는 원본 pnpm isolated 스토어를 symlink 재사용(vitest 실행 전용, Turbopack/Next 미관여이므로 심링크 제약 무관).

## 발견사항

- **[INFO]** 질문 1 — 두 방향이 실제로 동시에 닫히는지: **독립 추적으로 확인, YES**
  - 위치: `use-widget.ts:719-757`(`applyConfig`)
  - 상세: 현재 코드(`:739` `pendingResetRef.current = false;` — `!allowed` 분기 안, `:754` 소비 지점)를 전수 상태-전이로 재구성했다.
    - **(a) `11_38_14` 방향(차단된 부팅의 리셋이 무관한 다음 부팅으로 누출)**: boot#1 in-flight 중 reset 도착 → `configRef.current` 미확립이라 `teardownSession()` 이 pre-boot no-op 분기로 `pendingResetRef.current = true` 만 세팅(world-gen 안 건드림) → boot#1 resolve 시 `!allowed` → `:739` 가 즉시 그 플래그를 `false` 로 지우고 `BLOCKED` dispatch 후 return. **이후 무관한 boot#2** 가 나중에 (허용으로) 도착해도 `:754` 시점엔 이미 `false` 이므로 `newChat()` 재생이 트리거되지 않는다 — 정상 세션이 조용히 지워지는 사고가 발생하지 않는다. 확인됨.
    - **(b) `12_04_49` 방향(겹친 부팅이 정당한 리셋을 삼킴, 둘 다 결국 허용)**: boot#1 in-flight 중 reset 도착(`pendingResetRef=true`) → boot#2 가 겹쳐 진입해도 **진입 시 폐기 라인이 없으므로**(되돌려진 부분) 플래그를 건드리지 않음 → 어느 쪽이 먼저 `isEmbedAllowed` await 에서 깨어나 `configRef.current` 를 확립하든, 그 호출이 `:754` 에서 플래그를 소비해 `newChat()`(→`teardownSession` 실-분기 world-gen bump + `start()` 의 추가 bump)을 실행 → 늦게 깨어난 나머지 호출은 자신이 캡처했던 `gen` 이 이미 낡아 `:726` 의 `isStale(gen)` 에 걸려 조기 return, `:739`/`:754` 어느 쪽도 건드리지 않는다. "먼저 성공적으로 소비하는 쪽이 world-gen bump 로 나머지를 무효화"하는 자기치유가 실제로 성립함을 확인. (허용/허용 조합에 한해 — 아래 WARNING 참조.)
  - 결론: 오케스트레이터가 보고한 두 mutation 결과(BLOCKED 폐기 제거 → (a) 만 실패 / entry-clear 재도입 → (b) 만 실패)와 내 독립 트레이스가 정확히 일치한다.

- **[INFO]** 질문 2 — 남은 두 조기 return(`:720` 필드 누락, `:726` 첫 `isStale`)에서 플래그가 살아남는 경우가 해로운지: **둘 다 무해함을 확인**
  - 위치: `use-widget.ts:720`, `:726`
  - 상세: 두 줄 다 `pendingResetRef` 를 참조하지 않는다(파일 전체에서 이 ref 를 건드리는 곳은 `:586`(set) · `:739`(BLOCKED 폐기) · `:754`(소비) 3곳뿐 — grep 전수 확인).
    - `:720`(필드 누락 조기 return)은 `gen` 캡처보다도 앞이라 이번 시도가 세계에 아무 흔적도 남기지 않은 시점이다. 실사용에서 이 분기는 host 가 불완전한 `wc:boot`(파싱 실패 등)를 보낼 때만 타는데, 그 메시지는 리셋 의도에 대해 아무 정보도 주지 않으므로 **이미 세워진 pending 플래그를 건드리지 않는 것이 정확히 올바른 동작**이다(불완전 메시지가 대기 중인 정당한 리셋을 지워버리면 그게 오히려 새 버그) — `12_04_49` 라운드가 이미 이 위치의 타당성을 INFO 로 확인한 바와 일치.
    - `:726`(첫 `isStale` 조기 return)이 실제로 발동하는 경우는 오직 "이 호출이 캡처한 `gen` 이후 **다른 누군가**가 world-gen 을 이미 bump 했을 때"뿐이다. `pendingResetRef` 는 오직 `configRef.current` 가 아직 null 인 구간(즉 "아직 아무도 config 를 확립 못한 세계")에서만 set 되는데, world-gen 을 bump 하는 세 지점(`teardownSession` 실-분기, `start()`, unmount) 중 `teardownSession` 실-분기는 `configRef.current` 가 **이미 non-null** 이어야 진입하고, 그 경우 새 reset 요청은 애초에 `pendingResetRef` 를 거치지 않고 즉시 완전한 teardown 으로 처리된다(반대로 pre-boot 구간에서 reset 이 set 한 플래그는 아직 아무 bump 도 유발하지 않는다). 즉 이 checkpoint 에서 관측되는 staleness 는 **항상 "이미 다른 실행 경로가 그 사이 완결한 결과"**이지, "누군가 아직 살려둔 의도를 무단으로 방치"하는 경우가 아니다 — pendingResetRef 관점에서 다룰 게 이미 없거나(다른 쪽이 이미 소비함) 애초에 이 플래그와 무관한 이벤트(언마운트·기확립 세계의 실제 teardown)다. 실사용 피해 경로 없음.

- **[WARNING]** 질문 3(그 외 부작용) — **세 번째 잔여 경합**: 겹친 두 `applyConfig` 가 **서로 다른 결과**(하나는 BLOCKED, 하나는 ALLOWED)로 resolve 하고 **BLOCKED 쪽이 먼저** resolve 하면, `:739` 의 무조건적 폐기가 아직 살아있는 ALLOWED 쪽이 소비했어야 할 정당한 리셋을 지운다 — **실측 재현 확인**
  - 위치: `use-widget.ts:739`(`pendingResetRef.current = false;`, BLOCKED 분기) — 이 줄 자체가 문제라기보다, **이 줄이 "이 시도가 유일한 생존자"라는 전제 없이 무조건 발동**한다는 것이 원인. `:754`(소비 지점) · `:230-234`(`teardownSession` pre-boot no-op) 도 관련.
  - 상세(경합 시퀀스, `gen` 은 각 호출이 진입 시 캡처한 `worldGenRef.current`):
    1. boot#1 진입, `gen1` 캡처(=0), `await isEmbedAllowed(cfg1)` 로 suspend.
    2. (boot#1 in-flight 중) `resetSession` 도착 → `configRef.current` 아직 null → `pendingResetRef.current = true`(pre-boot no-op, world-gen 안 건드림).
    3. (boot#1 여전히 in-flight 중) boot#2 도착(재마운트 없는 `wc:boot` 재전송, spec `2-sdk.md:106`) → `applyConfig` 재진입, `gen2` 캡처(=0, 아직 아무도 안 bump), `await isEmbedAllowed(cfg2)` 로 suspend.
    4. embed-config 응답이 **boot#1 = BLOCKED, boot#2 = ALLOWED** 로 갈리고, **boot#1 이 먼저** resolve: `isStale(gen1)`→false(아직 아무 bump 없음) → `!allowed`→true → `:739` 가 `pendingResetRef.current = false` 로 되돌리고 `BLOCKED` dispatch, return. **이 시점에 boot#2 는 아직 자신의 소비 지점(`:754`)에 도달하지 못한 상태.**
    5. boot#2 resolve: `isStale(gen2)`→false(boot#1 의 BLOCKED 분기는 world-gen 을 bump 하지 않음 — `teardownSession`/`start()` 호출이 없으므로) → `!allowed`→false → `configRef.current`/`clientRef.current` 확립 → `:754` 확인 시 **이미 `false`**(4 단계에서 지워짐) → `newChat()` 재생 **skip** → `loadSession()` 으로 **구 세션 복원**.
    6. 결과: host 가 명시적으로 요청한 "새 대화"가 완전히 소실되고, 리셋 요청 시점에 존재하던 구 세션이 그대로 이어진다 — 이번 라운드가 고친 `12_04_49` W1 과 **동일한 손상**(정당한 리셋 소실)이 **다른 조건**(entry-clear 대신 BLOCKED-clear, "같은 결과" 대신 "다른 결과 + 특정 resolve 순서")으로 재발한다.
  - **실측**(격리 워크트리, HEAD=현재 fix 포함 상태 그대로 — 코드 수정 없이 새 테스트만 추가):
    | 시나리오 | `hookPosts` | `sessionStorage` | `state.phase` |
    |---|---|---|---|
    | BLOCKED 이 먼저 resolve(위 시퀀스) | **0** | `old` 그대로 | `streaming`(구 세션이 이어짐) |
    | 순서만 반대 — ALLOWED 가 먼저 resolve(대조군) | **1** | `fresh` | `streaming`(정상 새 대화) |

    대조군은 자기치유(질문 1-(b))가 정확히 작동함을 재확인하고(ALLOWED 가 먼저 소비 → world-gen bump → 늦게 온 BLOCKED 판정은 `:726` 에서 stale 로 걸러져 `:739` 에 도달조차 못함), "BLOCKED 먼저" 만 실패시켜 **원인이 정확히 `:739` 의 무조건 폐기임**을 순서-대조로 입증한다.
  - **실사용 도달 가능성**: 두 겹친 `applyConfig` 가 다른 embed 판정을 받으려면 통상 **서로 다른 `triggerEndpointPath`** 를 실어야 한다(같은 endpoint 라면 두 요청이 초 단위 간격으로 다른 allowlist 응답을 받을 이유가 거의 없다). 이는 관리자 라이브 미리보기(`live-preview.tsx`, 이전 라운드들이 이미 지목한 동일 컴포넌트)에서 **미리보기 대상 트리거를 전환**하는 흔한 조작과 정확히 일치한다 — 트리거 A(임베드 제한 있음)를 보던 중 트리거 B(제한 없음 또는 다른 allowlist)로 전환하면서, 그 사이 "새 세션" 버튼을 눌렀다면 이 3요소(boot·reset·boot, 서로 다른 대상)가 자연스럽게 갖춰진다. `11_38_14`/`12_04_49` 가 이미 확인한 "`wc:boot` 재전송에 직렬화가 전혀 없다"(`host-bridge.ts` `bootCb` 무조건 호출)는 구조적 전제가 여기서도 그대로 재사용된다.
  - **코드 주석의 과신 지점**: `:735-737` 주석 — "지금 구조는 **먼저 소비한 쪽이 newChat→세대 증가로 나머지를 stale 화**하는 자기치유가 성립하므로, 폐기는 이 시도가 실패한 경우로만 국한한다" — 이 자기치유는 **ALLOWED(성공) 경로에만** 성립한다(`newChat()`/`start()` 가 world-gen 을 bump 하므로). **BLOCKED 분기 자체는 world-gen 을 bump 하지 않는다** — `:739`~`:741` 어디에도 `teardownSession()`/`worldGenRef.current++` 호출이 없다. 따라서 BLOCKED 로 판정되는 시도가 다른 아직-생존한 시도보다 먼저 그 판정에 도달하면, "먼저 도착한 쪽이 나머지를 무효화한다"는 자기치유 서사가 적용되지 않고 오히려 무방비 상태로 플래그를 지운다 — 주석이 이 비대칭을 명시하지 않아 향후 유지보수자가 "이제 안전하다"고 오판할 위험이 있다.
  - **영향 등급**: `11_38_14`/`12_04_49` 의 두 형제 결함과 동일한 손상 범주(호스트가 요청한 새 대화가 조용히 무시되고 구 세션이 이어짐, 탭-스코프 `sessionStorage` 내 문제라 cross-user/cross-tab 유출은 아님) — WARNING 으로 분류. 다만 트리거 조건이 "같은 결과로 겹침"(`12_04_49`, 조건 3개: 겹침+리셋+같은 결과)보다 하나 더 좁다(겹침+리셋+**다른 결과**+**특정 resolve 순서**) — 발생 빈도는 더 낮되 재현 자체는 확정적이다(추측이 아니라 실측).
  - **제안**: 이번 라운드에서 **되돌리거나 국소 패치를 더 얹지는 말 것**을 권고한다 — 바로 이 라운드의 배경 자체가 "이 김에 구조를 고치려다 새 결함을 냈다"는 사례이므로, 같은 함정을 다시 밟을 위험이 크다. 대신:
    1. 기존에 이미 이월 결정된 **INFO#3(부팅 시도 세대 카운터 도입)** 항목에 **이 구체적 경로(BLOCKED 분기도 동일 취약)를 명시적으로 추가**할 것 — 지금 INFO#3 문구는 "single-flight 부재"라는 일반론이라, 이 라운드 fix 이후에도 정확히 같은 근본 원인이 (조건은 좁아졌지만) 그대로 남아있다는 사실이 문서에서 사라지기 쉽다.
    2. 위 `:735-737` 주석의 "자기치유가 성립하므로" 문구에 **"ALLOWED(성공) 경로에만 해당하며 BLOCKED 분기 자체는 세대를 bump 하지 않는다"** 는 단서를 추가해, 다음 사람이 이 부분을 "이미 안전 증명됨"으로 오독하지 않게 할 것을 권고(코드 변경 없이 주석 정확도만 개선하는 것이므로 이번 fix 의 최소-변경 원칙과 충돌하지 않는다).

- **[INFO]** (참고, 이 diff 의 영향 밖) 리셋과 무관한 "겹친 두 boot, 결과가 다르고 BLOCKED 가 나중에 resolve" 조합에서는 `state.phase` 가 이미 확립된 정상 config 를 뒤늦게 `blocked` 로 덮어쓸 수 있다
  - 상세: 추적 결과 (pendingResetRef 무관하게) ALLOWED 가 먼저 확립(`configRef.current`/`clientRef.current` 세팅, 저장 세션 없으면 dispatch 없이 조용히 종료)해도, 이후 늦게 resolve 하는 BLOCKED 판정이 `dispatch({type:"BLOCKED"...})` 를 실행해 `state.phase` 를 되돌릴 수 있다(world-gen 이 bump 되지 않았으므로 `isStale` 로 걸러지지 않음). 이는 **이번 diff 가 만들거나 바꾼 것이 아니라** `applyConfig` 에 single-flight 가 없다는 기존 구조(INFO#3)의 또 다른 표현이라 별도 WARNING 으로 세우지 않았다 — INFO#3 이월 판단이 이 예시로도 뒷받침된다는 정도로만 기록한다.

- **[INFO]** 그 외 표준 부작용 축 — 전부 깨끗함
  - **시그니처/공개 인터페이스**: `applyConfig` 는 `useEffect` 내부의 비export 로컬 클로저 — 시그니처·호출 규약 불변. `useWidget()` 반환 shape 도 불변.
  - **전역 변수/전역 상태**: 없음. `pendingResetRef` 는 `09_36_01` 라운드에 도입된 훅-인스턴스 스코프 `useRef` 그대로 — 이번 diff 는 폐기 **위치**만 옮겼다(1줄 삭제 + 1줄 추가, 순net 라인 수 불변).
  - **파일시스템/환경변수**: 프로덕션·테스트 모두 관여 없음.
  - **네트워크 호출**: 신규 프로덕션 호출 없음. 테스트가 쓰는 `vi.stubGlobal("fetch", ...)` 는 기존 파일의 다른 다수 테스트와 동일한 패턴이고, `afterEach` 의 `vi.unstubAllGlobals()`(파일 상단, 이번 diff 밖)가 테스트 간 격리를 담당 — 이번 신규 테스트가 그 격리를 깨는 새 전역 stub 을 추가하지 않았다.
  - **이벤트/콜백**: `dispatch`/`bridgeRef.current?.sendEvent` 발사 로직 자체는 변경 없음 — 변경은 오직 "언제 `pendingResetRef` 를 지우는가"뿐이라 어떤 dispatch 가 **추가로 발생하거나 사라지는지**는 위 항목들이 이미 다뤘다.
  - **테스트 파일**(`use-widget-eager-start.test.ts`): `afterEach` 에 `document.referrer` 를 원본 descriptor 복원 대신 jsdom 기본값(`""`)으로 강제 재설정하는 방식으로 통합한 것은 파일 내 기존 관용구(`widget-app.test.tsx` 컨벤션과 동형, 주석에 명시)의 확장이라 신규 리스크가 아니다. 새로 추가된 "겹친 부팅" 테스트도 fetch/EventSource stub 을 로컬 변수로만 캡처해 전역 누수 없음.

## 질문별 결론

1. **양방향 동시 폐쇄** → 확인됨(독립 트레이스, 오케스트레이터의 mutation 결과와 일치). 단, 이 두 방향의 폐쇄가 "겹친 boot" 문제 전체를 닫은 것은 아니다 — 위 WARNING 이 보여주듯 겹침 자체(+ 결과 분기 + 순서)가 만드는 세 번째 하위 케이스가 남아 있다.
2. **남은 미소비 체크포인트(`:720`, `:726`) 유해성** → 없음. 둘 다 `pendingResetRef` 를 아예 참조하지 않으며, 그 부재가 각각 정확한 이유(정보 없는 메시지는 기존 의도를 보존해야 함 / 관측되는 staleness 는 항상 이미 처리 완료되었거나 애초에 무관한 이벤트임)로 올바르다.
3. **그 외 부작용** → 위 WARNING(세 번째 겹침 하위 케이스, 실측 재현) 1건 외에는 인터페이스·전역상태·FS·env·네트워크·이벤트 축 전부 이번 diff 와 무관하게 깨끗하다.
4. **INFO#3(single-flight/supersede 부재) 이월 판단의 타당성** → 타당하다고 판단한다. 오히려 이번에 찾은 WARNING 이 "그 이월된 구조적 갭이 이번 fix 이후에도 형태를 바꿔가며 계속 발현된다"는 근거를 하나 더 보탠다 — 즉 국소 패치로는 이 클래스의 문제를 완전히 소거할 수 없고, 세대 카운터 같은 구조적 해법이 필요하다는 이전 판단을 강화한다. 동시에, "이번 라운드에서 그 구조를 함께 고치자"는 유혹은 바로 이 라운드의 발단(`12_04_49`)이 실증했듯 위험하므로, 최소 변경으로 두 번째까지 확실히 닫고 세 번째를 **명시적으로 기록해 이월**하는 이번 접근이 올바른 순서라고 본다.

## 요약

이번 되돌림(진입-시 일괄 폐기 → BLOCKED 분기 폐기)은 질문에서 지정한 두 방향 — `11_38_14`(차단된 부팅의 리셋이 무관한 다음 부팅으로 누출) · `12_04_49`(겹친 부팅이 같은 결과로 수렴할 때 정당한 리셋을 삼킴) — 을 독립 트레이스로 재확인한 결과 정확히 닫는다. 지정된 두 "미소비" 조기 return(`:720` 필드 누락, `:726` 첫 staleness 체크)도 `pendingResetRef` 를 건드리지 않는 것이 각각 올바른 설계임을 확인했다. 그러나 검증 과정에서 코드 주석이 근거로 드는 "자기치유"(먼저 소비하는 쪽이 world-gen 을 bump 해 나머지를 무효화)가 **ALLOWED(성공) 경로에만 성립하고 BLOCKED 분기 자체는 세대를 bump 하지 않는다**는 비대칭을 발견했고, 이로부터 "겹친 두 부팅이 서로 다른 결과로 갈리고 BLOCKED 쪽이 먼저 resolve" 하는 세 번째 하위 케이스에서 동일한 결함(정당한 리셋 소실)이 재발함을 격리 워크트리 실측(순서만 뒤집은 대조군과의 대비)으로 확정했다. 이는 이번 diff 가 새로 만든 결함이 아니라 원래 `11_38_14` 제안(BLOCKED 폐기)에도 이미 내재했던, 지금까지 어느 라운드도 명시적으로 짚지 않은 잔여 gap이며, 이미 이월 결정된 INFO#3(단일비행 가드 부재)의 또 다른 발현이다. 이번 라운드의 최소-변경 되돌림 자체를 되돌리거나 더 손댈 것을 권고하지는 않는다 — 오히려 "이 김에 고치려다 결함을 만든" 직전 교훈에 정확히 부합하므로, 지금은 두 확인된 방향을 닫힌 채로 유지하고 이 세 번째 케이스를 INFO#3 backlog 에 구체적으로 append 할 것과, 관련 주석의 "자기치유" 서술에 성공-경로 한정 단서를 추가할 것만 권고한다. 그 외 인터페이스·전역상태·파일시스템·환경변수·네트워크·이벤트 축은 이번 diff 와 무관하게 전부 깨끗하다.

## 위험도

MEDIUM
