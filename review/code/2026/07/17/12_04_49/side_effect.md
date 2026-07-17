# 부작용(Side Effect) Review

대상: `codebase/channel-web-chat/src/widget/use-widget.ts`(`applyConfig` 진입-시 `pendingResetRef.current = false;` 1줄 추가) + `use-widget-eager-start.test.ts`(회귀 테스트 1건) + `review/code/2026/07/17/11_38_14/{SUMMARY,RESOLUTION}.md`(문서, 신규 프로덕션 부작용 없음).

## ⚠ 프로세스 참고 — 공유 워크트리 동시편집 감지 (오케스트레이터 확인 요망)

본 리뷰 작성 도중 `git status` 에서 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` 가 **공유 워크트리에서 직접 수정된 상태(unstaged)**로 관측됐다. diff 내 주석이 `ai-review 2026-07-17 12_04_49 testing W1`/`W2` 를 인용하는 것으로 보아, **같은 라운드의 `testing` reviewer 가 격리 worktree 가 아니라 공유 워크트리를 직접 편집**한 것으로 보인다(본인은 `git worktree add --detach` 격리 환경에서만 mutation 을 수행했고 실행 후 즉시 제거 — 아래 "검증 방법" 참조. 본 변경은 본인 것이 아님을 `git diff`/`grep` 으로 확인).

- 이는 오케스트레이터 프롬프트가 명시적으로 경계한 "지난 라운드 공유 트리 동시편집 → 15% 산발 실패 → CRITICAL 오진" 패턴과 정확히 같은 리스크 클래스다.
- 본 리뷰의 분석·실측(아래)은 이 stray 변경과 **무관** — 전부 격리 worktree 에서 별도로 검증했으므로 이 오염에 영향받지 않는다.
- 다만 SUMMARY 집계 시점에 공유 워크트리를 다시 스캔하면 이 미커밋 변경이 "리뷰되지 않은 새 diff" 로 잡혀 push 가드 오탐을 만들 수 있으므로, testing reviewer 산출물과 대조해 의도된 변경이면 정식 커밋으로 반영하고, 아니면 되돌릴 것을 권고한다. (본인이 임의로 되돌리지는 않았다 — 다른 reviewer 의 작업 결과물일 수 있어 손대지 않는 편이 안전하다고 판단.)

---

## 검증 방법

격리 worktree(`git worktree add --detach`) 2개를 순차로 만들어 mutation 을 수행하고 실행 후 즉시 제거했다(공유 트리 미변경, `git status`/`git diff --stat` 로 원상 확인). node_modules 는 pnpm isolated 링크의 원본 스토어(`<원본>/node_modules`)를 그대로 symlink 해 재사용(vitest 실행만 필요해 Next/Turbopack 의 심링크 거부 이슈 무관).

1. **worktree A**(HEAD = 현재 fix 포함 상태, `b7a2cc063`): 겹친 2차 boot 진단 테스트 2건(신규 시나리오 + 대조군) 추가 후 실행.
2. **worktree B**(HEAD 동일하되 `pendingResetRef.current = false;` 진입-시 폐기 1줄 + 그 주석만 수동 제거, 즉 `11_38_14` fix 이전 상태로 국소 복원): 동일 신규 시나리오 재실행.

## 발견사항

- **[WARNING]** entry-scoped `pendingResetRef` 폐기가 **겹친(overlapping) 2차 `applyConfig` 진입**에서, 그 직전 도착한 **정당한** 리셋 요청을 침묵 소거한다 — W1("유령 리셋", 원치 않는 리셋이 무관한 부팅에 유출)의 **정반대 방향** 결함이다: 이번엔 **원하는 리셋이 소실**된다.
  - 위치:
    - `codebase/channel-web-chat/src/widget/use-widget.ts:719-732`(`applyConfig` 진입 및 진입-시 폐기), `:753-757`(소비 지점), `:231-234`(`teardownSession` 의 부팅-전 no-op 분기 — `configRef.current` 가 아직 null 일 때 `pendingResetRef.current = true` 만 세팅), `:787-789`(`bridge.onBoot` 콜백이 `void applyConfig(...)` 를 in-flight 여부 확인 없이 매번 새로 기동).
    - `codebase/channel-web-chat/src/widget/host-bridge.ts:51-56` — `wc:boot` 수신 시 `bootCb?.(...)` 를 무조건 호출. 이전 `applyConfig` 호출이 아직 첫 `await` 에서 안 돌아왔어도 **직렬화·단일비행(single-flight) 가드가 전혀 없다** — 이 결함이 재현 가능한 구조적 전제.
  - 상세:
    1. **정확한 경합 경로** (`gen` 은 `worldGenRef.current` 캡처값):
       - `t1` boot#1 진입 → 진입-시 폐기(no-op, 이미 false) → `await isEmbedAllowed(cfg1)` 로 suspend.
       - `t2`(boot#1 이 아직 unresolved 인 동안) host `resetSession` 도착 → `newChat()` → `teardownSession()` → `configRef.current` 가 아직 null(boot#1 이 그 대입에 도달 못함) → **`pendingResetRef.current = true`** 로 기록만 되고 return(정상 설계 — "지연 이행").
       - `t3`(boot#1 이 여전히 unresolved 인 동안) boot#2 도착(재마운트 없는 `wc:boot` 재전송, spec `2-sdk.md:106` 이 명문으로 지원하는 경로) → `applyConfig` 재진입 → **진입-시 폐기가 `t2` 에서 세운 플래그를 즉시 `false` 로 되돌린다** — boot#1 도, boot#2 도 아직 자신의 소비 지점(`:753`)에 도달하지 않은 시점에.
       - `t4` boot#1 resolve(allowed) → `worldGenRef` 는 `t1~t4` 사이 한 번도 bump 되지 않았으므로(`teardownSession` 이 부팅-전 분기라 no-op) **stale 아님** → 정상 진행 → `configRef`/`clientRef` 세팅 → `pendingResetRef.current` 확인 시 이미 `false` → **리셋 재생 skip** → `loadSession` 으로 **구 세션을 복원**.
       - `t5` boot#2 도 같은 이유로 stale 이 아니어서 마저 진행하며 `configRef`/`clientRef` 를 자기 값으로 덮어쓰고 동일하게 구 세션을 다시 복원(중복이나 무해 — `openStream`/`scheduleRefresh` 모두 자체적으로 close-then-open/clear-then-reschedule 이라 idempotent, 아래 INFO 참조).
       - 결과: host 가 명시적으로 요청한 "새 대화"가 **완전히 소실**되고, 리셋을 요청한 시점에 존재하던 구 세션이 그대로 이어진다.
    2. **왜 지금 이 fix 가 원인 제공자인가** — 이 진입-시 폐기가 없었다면(=`11_38_14` 이전) 위 경합에서 `pendingResetRef` 는 `t2` 이후 아무도 건드리지 않으므로 boot#1 이 `t4` 에서 정상 소비해 `newChat()` 을 실행했을 것이고, 그 `newChat→resetSessionRefs→teardownSession` 의 **world-gen bump 가 boot#2 를 자연스럽게 stale 화**해 boot#2 는 `t5` 에서 조용히 중단됐을 것이다 — 즉 "먼저 도착한 리셋을 먼저 소비하는 쪽이 이기고, 그 소비 행위 자체가 나머지 경쟁자를 무효화한다"는 **우연한 자기치유 구조**가 있었다. `11_38_14` fix 는 이 구조를 깨지 않고 다른 문제(W1)만 풀었어야 했는데, "진입 시 무조건 폐기"라는 **시간 순서 기준(scope=진입~소비 구간)** 이 "생존한 시도(attempt) 기준" 이라는 실제 필요 기준과 어긋나 이 경로에서 역효과를 낸다. 아래 실측이 이를 3원 대조로 증명한다.
  - **실측 (mutation 대조 3종, 모두 동일 시나리오: 구 세션 storage 존재 → boot#1 in-flight → `resetSession` → boot#1 in-flight 중 boot#2 → 둘 다 allowed 로 resolve)**:

    | 조건 | `hookPosts`(신규 대화 webhook POST 수) | `sessionStorage` | `state.executionId` | 판정 |
    |---|---|---|---|---|
    | (a) 대조군: boot#2 없이 boot#1 + resetSession 만(기존 baseline, C1-b 와 동형) | **1** | `NEW` | `NEW` | 정상(리셋 반영) |
    | (b) 현재 코드(진입-시 폐기 포함, 이 라운드 fix) + boot#2 겹침 | **0** | `OLD`(그대로) | `OLD` | **버그 — 리셋 소실** |
    | (c) 진입-시 폐기 1줄만 제거(11_38_14 이전 상태로 국소 복원) + boot#2 겹침 | **1** | `NEW` | `NEW` | 정상(자기치유로 리셋 반영) |

    (a)/(c) 는 리셋이 정상 반영되는데 (b) 만 실패 — **진입-시 폐기가 정확히 이 회귀의 원인**임을 결정적으로 보여준다. (b) 시나리오는 이번 라운드가 추가한 회귀 테스트("차단된 부팅 중의 resetSession...")나 기존 baseline 테스트("저장 세션이 있는 채로 부팅 중 resetSession...", `use-widget-eager-start.test.ts:2016`) 어디에도 커버되지 않는다 — 두 테스트 모두 boot#1 이 **완전히 resolve 되고 return 한 뒤** boot#2 가 시작되는 **순차** 시나리오만 다루고, boot#1 이 **아직 unresolved 인 동안** boot#2 가 시작되는 **중첩(overlap)** 시나리오는 다루지 않는다. `SUMMARY.md` 의 "검증되어 문제 없음" 항목("재진입 안전성")도 **단일** `applyConfig` 호출 내부(설정 대입~replay return 까지 동기 구간)의 안전성만 확인했을 뿐, **서로 다른 두 `applyConfig` 호출** 간의 경합은 검증 범위 밖이었다.
  - **실사용 도달 가능성**: 이론적 구성이 아니다.
    - `spec/7-channel-web-chat/2-sdk.md:106` 은 host 가 재마운트 없이 `wc:boot` 를 재전송할 수 있고 "위젯은 **마지막 wc:boot 의 config 를 적용**" 해야 한다고 명문화한다.
    - `codebase/frontend/src/components/web-chat/live-preview.tsx:71-119` 의 `postBoot()` 는 `bootConfig`(=`draft` 파생, `useMemo`) 가 바뀔 때마다(외형 폼 편집 — 사실상 매 키 입력) `useEffect([status, postBoot])` 로 재발사된다 — 즉 **관리자가 미리보기에서 빠르게 타이핑하면 `wc:boot` 가 짧은 간격으로 연속 도착하는 것이 정상 동작**이다. 동일 컴포넌트의 "재설정" 버튼(`:128`, `postCommand("resetSession")`)이 그 사이 눌리면 정확히 이 경합의 3요소(boot·reset·boot)가 갖춰진다.
    - `host-bridge.ts` 의 `onMessage` 는 `wc:boot` 마다 무조건 `bootCb` 를 호출해(§위치 참조) 위젯 측에 어떤 직렬화도 없다 — 브라우저 `postMessage` 디스패치는 네트워크 RTT(embed-config fetch, 통상 수십~수백ms, 서버 콜드스타트·부하 시 더 김)에 비해 훨씬 빠르므로, 스크립트로 boot→reset→boot 를 연속 전송하는 host(자동화 테스트, QA 스크립트, 혹은 그저 빠른 연타)라면 사람이 정밀 타이밍을 맞추지 않아도 이 창에 들어간다.
    - 결론: W1 만큼 흔하진 않다(W1 은 boot#1 이 **완전히 종료된 뒤** 임의 시점의 무관한 boot#2 로도 재현되는 순수 순차 버그라 타이밍 요건이 사실상 없었다). 이번 결함은 "한 네트워크 RTT 안에 3개 이벤트" 라는 더 좁은 창을 요구하지만, 그 창은 실제 사용 경로(관리자 미리보기 연타, 스크립트 host)에서 현실적으로 열린다.
  - **영향**: 브라우저 탭 스토리지 스코프 내 세션 오배정("host 가 새 대화를 요청했는데 이전 대화가 계속됨") — cross-user/cross-tab 유출은 아니다(sessionStorage 는 탭 스코프). W1 과 동일한 손상 범주(세션 정합성/UX)로, 새 침해 범주를 추가하지 않는다.
  - **제안**: `pendingResetRef` 를 **단일 boolean** 으로 유지하는 한 "죽은 이전 시도의 잔재"와 "아직 살아있는 시도를 위한 유효한 의도"를 구분할 수 없다 — 이번이 이 플래그의 3번째 라운드 연속 패치(08_29_33 도입 필요성 발견 → 09_36_01 플래그 도입 → 11_38_14 진입-시 폐기)라는 점 자체가 boolean 설계의 구조적 한계를 시사한다. 다음 중 하나를 검토 권고:
    1. **부팅 시도 세대(boot-attempt generation) 도입** — `worldGenRef` 와 별개로(그건 config 확립 후에만 bump 되므로 이 구간을 못 덮음) `applyConfig` 진입마다 증가하는 카운터를 두고, 뒤이은 진입이 **이전 진입을 명시적으로 무효화**(그 진입의 이후 모든 재검증 지점에서 조기 return)하게 만들면 "생존한 단 하나의 시도" 만 flag 를 다루게 되어 진입-시 폐기가 안전해진다.
    2. **spec §106 의 "마지막 wc:boot 우선" 을 명시적으로 강제** — 현재는 두 겹친 시도가 각자의 `isEmbedAllowed` 해소 순서에 따라 승자가 갈려(네트워크 지연 역전 시 **먼저 도착한 boot 가 나중 것을 덮어쓸 수 있음**), spec 이 약속한 "마지막 config 적용" 이 항상 보장되지 않는다. 이는 이번 diff 가 만든 문제는 아니고 겹친 `applyConfig` 를 직렬화하지 않는 기존 구조의 특성이지만, 위 1번과 같은 세대 카운터로 함께 해결된다.
    - 최소한 이번 라운드에서는 이 gap 을 **인지된 잔여 위험으로 명시 기록**하고 다음 라운드로 이월할 것을 권고(현재 fix 를 되돌리라는 뜻은 아니다 — W1 은 실제로 고쳤고 더 흔한 경로였다).

- **[INFO]** 리셋과 무관한 "단순 겹친 2회 boot"(재설정 요청 없이)는 자원 누수로 이어지지 않음을 확인 — `openStream()`(`closeStream()` 선행 후 재오픈, `:490`) 과 `useTokenRefresh.scheduleRefresh()`(`clearRefreshTimer()` 선행 후 재예약, `use-token-refresh.ts:74`) 모두 자체적으로 idempotent 하다. 따라서 위 WARNING 경합에서 boot#1/boot#2 가 각각 세션을 중복 복원해도 SSE 이중 연결이나 갱신 타이머 중복 예약은 발생하지 않는다 — 관찰되는 유일한 손상 축은 `pendingResetRef` 소실이다.

- **[INFO]** `pendingResetRef.current = false;` 가 `if (!cfg.apiBase || !cfg.triggerEndpointPath) return;` 가드 **뒤**에 위치한 것은 옳다 — 형식이 불완전한 `wc:boot`(파싱 실패 등)는 그 즉시 return 하므로 플래그를 건드리지 않고, 이전에 세워진 유효한 pending 리셋은 다음 정상 `applyConfig` 호출까지 그대로 보존된다. 만약 이 가드보다 앞에 폐기 라인을 뒀다면 새로운 손상 경로가 하나 더 생겼을 것이다(불완전 boot 하나가 대기 중이던 정당한 리셋을 지워버림) — 이번 배치는 그 함정을 피했다.

## 그 외 부작용 점검 (질문 3)

- **시그니처/인터페이스**: 없음. `useWidget()` 반환 shape(`state`/`config`/`actions`), export 되는 `safeApiBaseFromQuery` 등 공개 표면 불변.
- **전역 변수/전역 상태**: 없음. `pendingResetRef` 는 이미 `09_36_01` 라운드에 도입된 훅-인스턴스 스코프 `useRef` — 이번 diff 는 그 값을 **언제** 지우는지만 바꿨다. 컴포넌트 인스턴스 간 공유 없음.
- **파일시스템**: 없음(프로덕션 코드·테스트 모두 실제 FS I/O 없음, 테스트의 `sessionStorage` 는 jsdom 메모리 목).
- **환경 변수**: 없음.
- **네트워크 호출**: 프로덕션 코드에 신규 호출 없음. 테스트가 추가한 `vi.stubGlobal("fetch", ...)` 는 목킹으로 테스트 프로세스 내부에 격리.
- **이벤트/콜백**: `dispatch`/`sendEvent` 발사 로직 자체는 diff 로 변경되지 않았다 — 오직 위 WARNING 경합 상황에서 "어떤 dispatch 가 발생하지 않는가"(리셋에 따른 `NEW_CHAT`/webhook 이벤트가 조용히 스킵됨)가 관찰 가능한 유일한 변화다.

## 질문별 결론

1. **entry-clear 가 정당한 리셋을 삼키는 경로가 있는가 / 실사용 도달 가능한가** → **있다.** 겹친 2차 `applyConfig` 진입이 1차의 await 구간에 세워진 플래그를 지운다(위 WARNING). 관리자 라이브 미리보기의 draft 연타 + 리셋 버튼 조합, 또는 스크립트 host 의 빠른 postMessage 연쇄로 실사용에서 도달 가능 — 3원 mutation 대조로 실측 확인.
2. **직전 라운드 확인된 정상 동작(부팅 중 resetSession → config 확립 후 newChat 재생)을 깨는가** → **깨지 않는다.** 대조군(boot#2 없는 단일-boot 경합)이 `hookPosts=1`/`NEW` 로 정상 통과함을 확인했고, 이는 코드베이스에 이미 있는 baseline 테스트(`use-widget-eager-start.test.ts:2016` "저장 세션이 있는 채로 부팅 중 resetSession...")와 이번 라운드가 추가한 회귀 테스트(`:2095` "차단된 부팅 중의 resetSession...") 둘 다와 일치한다. 이 fix 는 W1 이 보고한 정확한 시나리오(순차 boot, BLOCKED 뒤 무관한 boot)를 올바르게 고쳤다.
3. **그 외 부작용** → 인터페이스·전역상태·FS·env·네트워크 축은 전부 깨끗함(위 항목). 유일한 잔여 리스크는 위 WARNING(겹친 2차 boot 에서의 리셋 소실)이며, 그 외 "겹친 boot" 일반 시나리오의 자원 누수(SSE 중복·타이머 중복)는 기존 idempotent 설계 덕에 발생하지 않음을 확인했다(INFO). 별도로, 리뷰 도중 공유 워크트리 동시편집을 관측했다(본문 상단 "프로세스 참고" 참조) — 코드 변경 자체의 부작용은 아니나 이번 라운드의 프로세스 위생 이슈로 보고한다.

## 요약

이번 delta(진입-시 `pendingResetRef.current = false;` 1줄)는 `11_38_14` 가 보고한 W1("순차 boot 간 유령 리셋 유출")을 정확히 고치고, 직전 라운드가 검증한 정상 경로(단일 boot 중 resetSession → newChat 재생)를 깨지 않는다 — 인터페이스·전역상태·FS·env·네트워크 등 표준 부작용 축도 모두 깨끗하다. 그러나 3단계 mutation 대조 실측(대조군 정상 / 현재 코드 실패 / fix-1줄-제거 시 정상)으로, **겹친 2차 `applyConfig` 진입**(host 가 1차 boot 의 embed-config 왕복이 끝나기 전에 `wc:boot` 를 재전송하는 경로 — spec §106 이 명문으로 지원하고 관리자 라이브 미리보기가 draft 변경마다 실제로 수행)에서 이 진입-시 폐기가 그 직전 도착한 **정당한** 리셋 요청을 소리 없이 삼키는 새 잔여 결함을 확인했다. 이는 W1 의 정반대 방향(불필요한 리셋 유출이 아니라 필요한 리셋의 소실)이며, 기존 테스트 스위트(baseline·이번 라운드 회귀 테스트 포함)가 다루는 "순차" 시나리오와 달리 "중첩(overlap)" 시나리오라 어느 기존 테스트에도 커버되지 않는다. boolean 플래그가 3라운드 연속(08_29_33→09_36_01→11_38_14) 패치 대상이 된 점 자체가, 이 문제가 국소 1줄 패치가 아니라 부팅 시도(attempt) 스코프를 명시하는 구조적 변경(세대 카운터 등)을 필요로 함을 시사한다. 현재 fix 를 되돌릴 필요는 없다(W1 이 더 흔한 경로였고 실제로 고쳐졌다) — 이 잔여 gap 은 다음 라운드로 명시 이월할 것을 권고한다. (별도: 리뷰 도중 공유 워크트리 동시편집을 관측 — 상단 프로세스 참고 참조.)

## 위험도

MEDIUM
