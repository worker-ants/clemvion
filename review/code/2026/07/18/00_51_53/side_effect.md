# 부작용(Side Effect) 리뷰 — webchat-boot-single-flight (00_51_53, fix 검증 라운드)

> 지시받은 핵심 검증: 커밋 `7cfbf2557`(`start()` 가 boot 스냅샷을 `seedWaitingFromStatus` 에 넘기는
> fix)가 (1) 직전(23_58_23) CRITICAL 두 부작용(화면 되감기·두번째 EventSource 오픈)을 실제로 닫는지,
> (2) 정상 경로의 `start()` seed·`openStream` 부작용이 그대로 유지되는지, (3) `outcome !== "continue"`
> 조기 return 이 두번째 `openStream` 을 막는 경로가 실제로 작동하는지. 격리된 워크트리
> (`.claude/worktrees/webchat-boot-single-flight-8c92b4`, 본 세션의 primary worktree)에서 실제
> `useWidget()` 훅을 대상으로 mutation A/B 대조 + 임시 재현 테스트로 실측했다(전부 원복, 아래 "실행 기록"
> 참조).

## 발견사항

- **[CRITICAL] 같은 fix(`7cfbf2557`)가 새로운 부작용 억제 결함을 도입한다 — 아무것도 복원하지 못하는
  `wc:boot` 재전송이 `start()` 의 webhook in-flight 구간에 도착하면, 정상적으로 성공했어야 할
  `start()` 자신의 `openStream`/`WAITING` 부작용이 통째로 억제되고 아무도 대신 열지 않는다**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:612-666`(`start()`, 특히 `:628`
    `const bootAtStart = bootGenRef.current;` · `:651`
    `const outcome = await seedWaitingFromStatus(client, session, { boot: bootAtStart });` · `:652`
    `if (outcome !== "continue") return;`) · `:520-581`(`seedWaitingFromStatus`, 게이트 `:550`
    `if (attempt && cannotApplyConfig(attempt)) return "stale";`) · `:290-291`(`cannotApplyConfig`)
    · `:945-995`(`applyConfig`, `:951` `beginBootAttempt()` — 모든 `wc:boot` 진입마다 조건 없이
    `bootGenRef` 를 올림 · `:971` `const saved = sessionEstablished() ? null : loadSession(...)`).
  - 상세 — **부작용 관점 프레이밍**: 이 fix 의 전체 목적은 "boot 세대가 앞섰으면 이 seed 의 부작용
    (WAITING dispatch·`openStream`)을 억제한다"이다. 그 억제 조건(`cannotApplyConfig`)은 순수하게
    "`bootGenRef` 가 내가 캡처한 값과 다른가"만 본다 — "그 뒤 세대의 재전송이 **실제로 이 세션을
    넘겨받아 대신 부작용을 일으켰는가**"는 보지 않는다. 두 사실이 갈리는 창이 있다: 재전송이
    `beginBootAttempt()` 로 세대는 올리지만 `loadSession()` 이 빈손이라(`start()` 가 아직 `persist()`
    하지 않은 시점) 그 재전송 자신은 **아무 부작용도 일으키지 않고** 조용히 끝난다. 이 경우
    `start()` 의 seed 는 "억제됐지만 아무도 대신하지 않은" 상태로 남는다 — **부작용의 순유실**이다.
  - **재현(실제 훅, 임시 테스트 작성 → 실행 → 확인 → 삭제, 5회 반복 전부 동일 결과)**:
    1. `wc:boot` #1 → config 확립(신규 방문, 저장 세션 없음).
    2. 패널 `open()` → `start()` 진입. 동기 구간에서 `bootAtStart = bootGenRef.current`(=1)를 캡처한
       뒤 `dispatch({type:"START"})` → webhook POST(`client.startConversation`)가 in-flight 로 들어간다.
       이 시점 `sessionRef`/`sessionStorage` 는 **아직 비어 있다** — `persist()` 는 webhook resolve
       **이후**에만 실행된다.
    3. **webhook 미해결 중** `wc:boot` #2(재전송)가 도착. 그 `applyConfig` 는 `beginBootAttempt()` 를
       무조건 호출해 `bootGenRef` 를 2로 올린다. `isEmbedAllowed()` 통과 후
       `saved = sessionEstablished() ? null : loadSession(...)` 를 검사하는데, storage 가 아직 비어
       있어 `saved === null` — 복원 분기 전체를 스킵하고(`getStatus` 호출도, `RESTORED` dispatch 도,
       `openStream` 도 없음) config 재적용만 하고 조용히 끝난다.
    4. 이제 `start()` 의 webhook 이 resolve → `BOOTED` dispatch(phase→`streaming`) → `persist()` 가
       세션을 storage 에 쓴다 → `seedWaitingFromStatus(client, session, { boot: bootAtStart(=1) })`
       호출, 자기 `getStatus` 발사.
    5. `getStatus` 가 정상적으로 `waiting_for_input(n1)` 로 응답한다 — **아무도 이 세션을 가로채지
       않았는데도** WAITING 게이트가 `cannotApplyConfig({boot:1})` = `bootGenRef.current(2) !== 1` =
       `true` 로 평가해 `"stale"` 을 반환하고, `start()` 는 `outcome !== "continue"` 로 `openStream`
       호출 없이 조기 return 한다.
    6. **최종 상태**: `phase="streaming"`(로딩 스피너), `pending=null`, `EventSource` **0개**
       (`streamRef.current===null`). 세션은 `sessionStorage` 에 정상 저장돼 있지만 이 마운트에서는
       아무도 그 세션의 `getStatus`/`openStream` 을 다시 시도하지 않는다 — **에러 표시도 재시도
       타이머도 없이, 같은 마운트 안에서는 자력 회복 수단이 없다.**
  - **A/B 로 "이번 fix 가 만든 신규 결함"임을 확정**: 위와 동일 시나리오에서 `:651` 을 fix 이전 형태
    (`seedWaitingFromStatus(client, session)`, 세번째 인자 없음)로 되돌리면 **정상 통과**한다
    (`phase=awaiting_user_message`, `pending.nodeId="n1"`, `esCount=1`) — 재전송은 여전히 아무것도
    복원하지 못하지만, `start()` 자신이 boot 축을 보지 않으므로 자기 seed 를 그대로 진행해 스트림을
    연다. 즉 **이 실패는 `7cfbf2557` 이전에는 존재하지 않았고 정확히 이 fix 가 도입**했다
    (mutation·복원 모두 `git diff`/`git status` 로 무결성 확인, 아래 "실행 기록" 참조).
  - **부작용 소실이 "일시적"이 아니라 "다음 재전송에 종속"임도 확인(자가치유 실험)**: 위 5단계
    직후(고착 상태) 세번째 `wc:boot`(재전송 #2)를 추가로 보내면, 그때는 storage 에 세션이 이미
    있으므로 그 `applyConfig` 의 `loadSession` 이 세션을 찾아 정상적으로 `getStatus`→`openStream` 을
    수행해 **회복된다**(`esCount: 0→1`, `pending.nodeId="n3"`). 즉 이 결함은 "영구 고착"이 아니라
    "**다음 wc:boot 재전송이 우연히 도착할 때까지 고착**"이다 — 관리자 라이브 미리보기처럼 재전송이
    빈번한 호스트에서는 다음 키 입력이 우연히 복구시킬 수 있지만, 재전송이 그 한 번뿐인 호스트(스펙상
    허용되는 사용 패턴 — `2-sdk.md §3(재전송)` 은 재전송 빈도를 규정하지 않는다)에서는 새로고침 전까지
    무기한 고착된다.
  - 왜 CRITICAL 인가 — 이 fix 가 막으려던 원 결함(직전 라운드, "단순 flicker 가 아니라 고착")과 **같은
    급의 사용자 영향**이고, 도달 조건은 오히려 **더 넓다**: 원 결함은 재전송이 "이 세션을 성공적으로
    복원"해야 성립했지만, 이 결함은 재전송이 **아무것도 못 찾아도**(더 흔하고 무해해 보이는 경우)
    성립한다. "persist 전" 창은 "persist 후" 창(원 결함의 창)보다 시간축상 **먼저** 열려 있어 더 넓다.
    이 PR 자신이 CHANGELOG 에서 근거로 드는 도달 조건(관리자 라이브 미리보기의 무디바운스 재전송 +
    eager 즉시시작)만으로 충분히 도달한다.
  - **교차 검증**: 같은 라운드의 `requirement` 리뷰어가 이 결함을 **완전히 독립적으로**(별도 A/B
    mutation, 별도 재현 절차) 동일한 근본 원인·동일한 반증(같은 mutation 으로 정상 통과 확인)으로
    보고했다(`review/code/2026/07/18/00_51_53/requirement.md` — 그쪽은 공유 워크트리에서 본 리뷰의
    작업 중이던 임시 테스트 파일을 `git status` 로 우연히 관측했다고 명시하나, 결론은 자신의 독립
    재현에만 의존한다고 밝힘). 두 리뷰어가 독립 재현으로 수렴했다는 것은 이 결함이 실측 아티팩트가
    아니라 실재함을 강하게 뒷받침한다. `concurrency.md` 는 이 조합에 인접한 "BLOCKED 재전송"·
    "`!apiBase` 무효 재전송" 두 파생 시나리오는 실측했으나(둘 다 무해로 확인) "허용되고 config 도
    정상 재적용되지만 복원할 게 없는" 이 세 번째 조합은 다루지 않았다(grep 확인, 나머지 완료 리포트
    4건도 동일).
  - 제안: 병합 전 처리 필요. 근본 원인은 `cannotApplyConfig`/`bootGenRef` 가 "**boot 카운터가
    움직였다**"와 "**실제로 다른 시도가 이 세션을 넘겨받아 부작용을 대신 일으켰다**"를 구분하지 못하는
    데 있다 — 후자가 거짓인데도(경쟁자가 `saved===null` 로 아무 부작용도 안 냈는데도) 전자만으로
    `start()` 의 정당한 부작용(seed+openStream)을 폐기한다. 단순히 게이트에
    `sessionEstablished()` 를 AND 로 추가하는 방향은 이 세션에 한해서는 유효해 보이지만, §3(재전송)
    의 resolve-순서-역전 시나리오(두 `applyConfig` 복원이 경합 중이고 대체한 쪽이 아직 자기 스트림을
    열기 **전**인 순간)에서 `sessionEstablished()` 가 그 순간 `false` 라 대체된 쪽의 옛 스냅샷이
    화면에 일시 노출되는 flicker 를 재도입할 위험이 있어 보인다(직접 코드 경로만 대조, 별도 재현은
    안 함 — 시간 제약). "boot 카운터 이동"·"스트림 개설 여부" 만으로는 안전한 단일 predicate 가 아닐
    수 있다는 뜻이므로, "이 seed 가 응답할 때쯤 **다른 경쟁자가 실제로 이 세션을 넘겨받았거나 넘겨받는
    중인가**"를 더 정밀하게 구분하는 신호(예: 경쟁자가 `sessionRef.current` 를 자신의 세션으로 이미
    교체했는지)가 필요해 보인다 — 정확한 설계는 developer 트랙 판단. 무엇을 택하든 **이 시나리오
    (webhook in-flight 중 아무것도 복원 못 하는 재전송)를 포착하는 회귀 테스트를 반드시 추가**할 것
    — 현재 `:3223` 신규 테스트는 재전송이 persist **이후**에 도착해 복원에 **성공**하는 경우만 다뤄
    이 창을 커버하지 않는다.

- **[INFO] 확인됨 — 직전 라운드(23_58_23) CRITICAL 의 두 부작용(화면 되감기 + 두번째 EventSource
  오픈)은 이 fix 로 실제로 닫힌다(mutation 으로 각각 독립 확인)**
  - 위치: `use-widget-eager-start.test.ts:3223-3303`(신규 회귀 테스트) ·
    `use-widget.ts:628,651`(fix 지점).
  - 상세: `:651` 의 `{ boot: bootAtStart }` 인자를 제거하는 mutation 을 적용하고 전체 스위트를
    돌리면 **정확히 신규 테스트 1건만** 실패한다(391 → 56/57 within file, 나머지 390건 전부 그대로
    통과) — `expected 'n1' to be 'n2'`, 즉 화면 되감기가 재현된다. 이어서 해당 테스트의 마지막 두
    단언(`pending.nodeId` / `esCount`) **순서를 바꿔** `esCount` 를 먼저 확인하도록 임시 수정한 뒤
    같은 mutation 으로 재실행하면 `esCount` 자체가 **독립적으로** `expected 2 to be 1` 로 실패한다
    — 즉 되감기 실패가 첫 단언에서 조기 종료돼 가려지는 게 아니라, 두번째 EventSource 오픈도
    **진짜로** 재현됨을 확인했다(두 부작용이 같은 원인·같은 fix 로 함께 닫힘). mutation·단언 순서
    변경 모두 `git checkout --` 로 원복, `git diff` 무변경 확인.

- **[INFO] 확인됨 — `outcome !== "continue"` 조기 return 이 `start()` 의 두번째(중복) `openStream`
  을 실제로 차단하는 경로가 작동한다**
  - 위치: `use-widget.ts:652` `if (outcome !== "continue") return;` (바로 다음 줄 `:655`
    `openStream(session, "0");` 이전에 위치).
  - 상세: 코드 순서상 `outcome` 게이트가 `openStream` 호출보다 먼저 있어 구조적으로 확인되고,
    기존 회귀 테스트 `"start() 직후 스냅샷이 terminal → openStream 미호출 + 즉시 ended"`(`:1429`
    부근, `outcome==="ended"` 케이스)가 이미 이 경로를 검증하고 있었다(391/391 그대로 통과, 이번
    fix 로 영향 없음). 이번 라운드가 새로 검증한 것은 `outcome==="stale"`(boot 축 supersede) 케이스도
    같은 게이트를 타는지인데, 위 mutation 실험(되감기+이중 스트림 재현)이 인과적으로 이를 증명한다 —
    `{boot: bootAtStart}` 를 제거하면 `cannotApplyConfig` 검사가 스킵돼 `outcome` 이 `"stale"` 대신
    `"continue"` 로 나오고, 그 결과로만 `openStream` 이 (부당하게) 다시 호출돼 두번째 스트림이
    열린다 — 게이트 자체의 위치·동작은 항상 올발랐고, 이번 fix 가 그 게이트에 넘기는 **입력**
    (`outcome` 값)을 올바르게 계산하도록 고쳤을 뿐이다.
  - 다만 위 CRITICAL 항목이 보여주듯, 같은 게이트가 **과도하게** `"stale"` 로 판정하는 새 창도 함께
    열렸다 — 게이트 메커니즘 자체는 문제 없으나 트리거 조건(`cannotApplyConfig`)의 정밀도가 부족하다.

- **[INFO] 확인됨 — 정상 경로(재전송 경합이 없거나, 경합이 있어도 `start()` 가 유일한 소유자로
  남는 경우)의 `start()` seed·`openStream` 부작용은 그대로 유지된다**
  - 상세: 이번 fix 는 `seedWaitingFromStatus` 의 기존 optional 파라미터(`attempt?: { boot: number }`,
    직전 라운드 `fa1dceba5` 에서 이미 도입됨)를 `start()` 호출부에서 추가로 사용할 뿐 시그니처를
    바꾸지 않는다. 재전송이 전혀 없는 단순 부팅 경로를 검증하는 기존 회귀 테스트
    (`"race fix: openStream 을 lastEventId=0 으로 열어 buffer replay 를 요청"` 등)가 수정 없이 그대로
    통과하고, `npx vitest run`(channel-web-chat 전체) 결과 **22 파일 391/391 전부 통과**, `tsc --noEmit`
    도 에러 없음(둘 다 실행 확인, 아래 "실행 기록" 참조) — 위 CRITICAL 시나리오(재전송이 persist
    **이전**에 도착해 아무것도 못 찾는 경우) 를 제외한 나머지 경로는 이번 fix 로 인한 회귀가 없다.

- **[INFO] 시그니처/인터페이스 변경 없음**
  - `seedWaitingFromStatus(client, session, attempt?)` 의 `attempt` 파라미터는 이번 커밋이 아니라
    직전 라운드(`fa1dceba5`)에서 이미 도입된 optional 파라미터다 — 이번 커밋(`7cfbf2557`)은 그
    기존 optional 슬롯을 세번째 호출부(`start()`)에서 추가로 채울 뿐, 함수 시그니처·`useWidget()`
    의 공개 반환 형태(`state`/`config`/`actions`)·`start` 자체의 외부 호출 형태(무인자, `Promise<void>`)
    어느 것도 바꾸지 않는다. 외부 호출자(공개 SDK 소비자 포함) 영향 없음.

- **[INFO] 전역 변수·환경 변수·파일시스템·네트워크 호출 신규 도입 없음**
  - 이번 커밋의 실질 코드 변경은 (a) `start()` 지역 스코프의 `const bootAtStart = bootGenRef.current;`
    (기존 ref 읽기, 새 ref/전역 변수 아님) 와 (b) 그 값을 기존 optional 파라미터에 전달하는 한 줄뿐이다
    (나머지는 JSDoc 갱신). `bootGenRef` 자체는 직전 라운드에서 이미 도입된 기존 ref 이고, 이번 커밋은
    이를 **한 곳 더 읽을** 뿐 새로 만들거나 갱신 지점을 추가하지 않는다. `sessionStorage`
    읽기/쓰기(`saveSession`/`loadSession`/`clearSession`), `fetch`/`EventSource` 호출 경로 모두
    기존 그대로이며 새 호출이 추가되지 않았다 — 오히려 이 fix 의 목적 자체가 **불필요한 두번째
    `EventSource` 오픈(의도치 않은 네트워크 부작용)을 없애는 것**이었고, 정상 경로에서는 그 목적대로
    작동함을 위에서 확인했다.

- **[INFO] 후속 커밋 `a2cd6ebb7`(23_58_23 WARNING 정합)은 부작용 관점에서 무해**
  - `use-widget.ts` 에 대한 변경은 언마운트 cleanup 내부의 공백-only 빈 줄 삭제 1줄뿐(로직 변경 없음,
    직접 diff 확인). 나머지는 테스트 주석·plan 문서 정정으로 런타임 부작용과 무관하다.

- **[INFO, 이월·이번 라운드 신규 아님] `execution.replay_unavailable` 폴백이 `attempt` 없이
  `seedWaitingFromStatus` 를 호출하는 것의 안전성은 구조적 추론에 의존하며 전용 경합 테스트는 없다**
  - 위치: `use-widget.ts:418-426`(`handleEiaEvent` 의 `replay_unavailable` 분기).
  - 상세: 커밋 메시지는 "그 경로는 스트림이 이미 열려 있어야 발화하므로 복원 분기와 상호배타"라고
    주장한다(side_effect 리뷰어 확인이라고 귀속됨). 코드 구조상 이 주장은 타당하다 — `replay_unavailable`
    은 SSE 이벤트이므로 `handleEiaEvent` 가 그 이벤트를 받으려면 `openStream` 이 이미 성공적으로 실행된
    뒤여야 하고, 재전송의 복원 분기는 `sessionEstablished()`(=스트림 존재 여부)가 `false` 일 때만
    `loadSession` 을 시도하므로 두 경로가 동시에 세션을 두고 경쟁할 수 없다. 다만 이 상호배타성을
    직접 검증하는 전용 테스트(두 이벤트를 동시에 유발하는 레이스 테스트)는 이번 라운드에도 여전히
    없다 — 이번 커밋이 손대지 않은 기존 설계이므로 CRITICAL/WARNING 으로 올리지 않지만, 위 CRITICAL
    항목의 fix 를 설계할 때(예: `sessionEstablished()` 를 게이트 조건에 추가하는 방향을 택할 경우)
    이 경로도 같은 predicate 를 공유하게 될 가능성이 있으니 함께 재검토 대상에 넣을 것을 제안한다.

## 실행 기록 (실측 방법 요약)

모든 실험은 본 세션의 primary worktree(`/Volumes/project/private/clemvion/.claude/worktrees/
webchat-boot-single-flight-8c92b4`)에서 진행했고, 매 mutation 뒤 `git checkout --`(또는 대상 파일
지정 `git diff`/`git status`)로 원복·무결성을 확인했다. 최종 상태는 untracked
`review/code/2026/07/18/` 외 diff 없음.

1. 기준선: `npx vitest run`(channel-web-chat) → **22 파일 391/391 통과**, `npx tsc --noEmit` → 에러 0.
2. 신규 회귀 테스트(`:3223`)만 단독 실행 → 통과.
3. mutation(`:651` 에서 `{ boot: bootAtStart }` 제거) → 전체 파일 재실행 → **정확히 그 테스트 1건만
   실패**(56 passed), `expected 'n1' to be 'n2'`.
4. 같은 mutation 상태에서 해당 테스트의 마지막 두 단언 순서를 `esCount` 우선으로 임시 교체 →
   재실행 → `esCount` 가 독립적으로 `expected 2 to be 1` 로 실패(2회 원복 후 초기 상태로 확인).
5. 두 파일 모두 `git checkout --` 로 원복 확인 후, "webhook in-flight 중 아무것도 복원 못 하는
   재전송" 시나리오를 임시 테스트로 신설 — 처음엔 즉시-resolve 방식 embed-config mock 으로 5회 실행해
   결과가 갈리는 것을 관찰(비결정적 타이밍 의존 확인), 이어서 embed-config 도 명시적 resolver 로
   제어하는 완전 결정적 버전으로 재작성해 **5회 전부 동일하게 고착 재현**(`phase=streaming`,
   `pending=null`, `esCount=0`).
6. 같은 결정적 시나리오에서 `:651` mutation(fix 되돌리기)을 적용해 재실행 → **정상 통과**
   (`phase=awaiting_user_message`, `pending.nodeId="n1"`, `esCount=1`) — 이번 fix 가 신규 결함의
   원인임을 A/B 로 확정.
7. 고착 상태에서 세번째 `wc:boot` 을 추가로 보내는 자가치유 실험 → 이번엔 storage 에 세션이 있어
   정상 복구(`esCount: 0→1`) 확인 — "영구 고착"이 아니라 "다음 재전송 종속 고착"임을 특정.
8. 모든 임시 테스트·mutation 은 실험 직후 `git checkout --` 로 제거·원복, 최종 `git status --short`
   로 워크트리가 리뷰 산출물 외에는 깨끗함을 재확인. 마지막으로 기준선 스위트를 재실행해 391/391 ·
   `tsc --noEmit` 통과를 재확인했다(실제 병합 대상 코드는 처음 읽은 그대로임을 최종 보증).

## 요약

이번 라운드에서 검증을 요청받은 두 부작용(화면 되감기·두번째 `EventSource` 오픈)은 커밋 `7cfbf2557`
로 실제로 닫혔고, `outcome !== "continue"` 게이트가 정상적으로 두번째 `openStream` 을 막는 것도
확인했다 — 이 부분은 mutation 기반 인과 증명(제거 시 정확히 재현, 복원 시 정확히 사라짐)까지 마쳤다.
그러나 같은 fix 가 **같은 게이트의 트리거 조건 부정확성**으로 인해 새로운 부작용 억제 결함을
도입했다: `wc:boot` 재전송이 `start()` 의 webhook 응답 대기 중(세션이 아직 storage 에 쓰이기 전)
도착하면, 그 재전송 자신은 아무 부작용도 일으키지 않고 조용히 물러나는데도 `start()` 는 "누군가
넘겨받았다"고 오판해 자신의 정당한 `openStream` 부작용을 포기한다 — 결과는 로딩 스피너만 무기한
남는 완전한 상호작용 정지다. 격리된 워크트리에서 5회 결정적으로 재현했고, mutation A/B 로 이번
커밋이 원인임을 확정했으며, 같은 라운드의 `requirement` 리뷰어가 완전히 독립적인 절차로 동일
결론에 도달해 교차 검증됐다. 그 외 시그니처·전역 변수·환경 변수·파일시스템·네트워크 호출 측면에서
이번 커밋은 기존 optional 파라미터를 한 호출부 더 채우는 최소 변경이라 신규 위험이 없다.

## 위험도

CRITICAL — 요청받은 두 부작용은 fix 로 정상적으로 닫혔으나, 같은 fix 가 도달 조건이 더 넓은
신규 CRITICAL(정상 `start()` 의 `openStream` 부작용이 억제되고 아무도 대신하지 않아 위젯이
무기한 스피너에 고착)을 도입했으므로 현재 diff 는 그대로 병합하기에 안전하지 않다.
