# 문서화(Documentation) Review

대상: `webchat-boot-single-flight` (applyConfig single-flight + 동기 구간 불변식 + A-6 ended 가드 확대).
검증 방법: diff 정독 + 대상 워크트리(`webchat-boot-single-flight-8c92b4`)의 실제 소스 직접 Read, `channel-web-chat` 전체 vitest 실행(382 passed 확인), TypeScript 컴파일러 API(`ts.getJSDocCommentsAndTags`)로 JSDoc-선언 결합 여부 실측, git 이력/원격 비교로 diff artifact 여부 확인.

## 발견사항

- **[CRITICAL]** `WAITING` 케이스의 "가드 범위는 WAITING 뿐이다" 주석이 같은 파일 안에서 이 diff 자신이 추가한 코드에 의해 **즉시 반증**된다
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:155-156` (주석, 이번 diff에서 미수정) vs `:136`, `:142` (이번 diff가 신설한 가드)
  - 상세: `WAITING` case의 (미변경) 주석은 이렇게 말한다 — "**가드 범위는 WAITING 뿐이다** — `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 를 검사하지 않고 무조건 전이하므로, 'ended 를 벗어나는 액션'의 리듀서 레벨 불변식은 아직 없다." 그런데 바로 위 `RESTORED`(136행)와 `BOOTED`(142행) case는 이번 diff에서 각각 `if (state.phase === "ended") return state;` 가드가 신설됐다 — 두 곳 다 이제 `state.phase` 를 검사한다. 즉 이 주석의 핵심 주장("RESTORED/BOOTED 도 무조건 전이")은 같은 커밋이 만든 코드에 의해 그 자리에서 바로 틀린 문장이 됐다. `USER_MESSAGE`(177행)에 대한 부분만 여전히 참이다(무조건 전이 유지, 확인함). 뒤이은 "확대는 후속 — ... 실패 사례 없이 넓히지 않는다" 문단도 이제 시제가 안 맞다 — 그 "후속 확대"가 바로 이 diff의 A-6이기 때문이다(plan `webchat-boot-single-flight.md` §A-6 진행 기록 참조). 이 파일은 정확히 "가드 상태를 설명하는 주석이 실제 가드 상태와 어긋나서" 과거 버그가 났다고 스스로 기록해 둔 파일이라(WAITING 주석 자체가 그 사례를 설명 중), 같은 클래스의 드리프트를 이번 diff가 재도입한 셈이다.
  - 제안: `WAITING` case 주석의 "가드 범위는 WAITING 뿐이다" 문단을 갱신 — 예: "가드 범위는 이제 `WAITING`·`RESTORED`·`BOOTED` 세 곳이다(A-6, `webchat-boot-single-flight.md`). `USER_MESSAGE` 는 아직 `state.phase` 를 검사하지 않고 무조건 전이한다(오늘은 호출부가 `ended` 에서 디스패치하지 않아 활성 버그 아님)." 식으로 최신 상태를 반영하고, "확대는 후속" 문단은 과거형으로 정리하거나 A-6 언급으로 대체.

- **[CRITICAL]** `pendingResetRef` JSDoc이 `bootGenRef` JSDoc 삽입으로 인해 선언과의 인접성이 끊어져, TypeScript/IDE 툴링에서 **완전히 유실**됨 (실측 확인)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:162-197`(`pendingResetRef` 의도된 JSDoc, 이번 diff가 "성공하는 부팅 정의에 supersede 포함" 문단을 추가한 바로 그 블록) → `:198-213`(이번 diff가 신설한 `bootGenRef` JSDoc, 사이에 끼어듦) → `:214`(`const bootGenRef = useRef(0);`) → `:215`(`const pendingResetRef = useRef(false);`, 바로 위에 주석 없음)
  - 상세: 두 JSDoc 블록이 공백 줄 없이 연달아 쌓인 뒤 `const bootGenRef = ...`, `const pendingResetRef = ...` 두 선언이 뒤따른다. TypeScript 컴파일러 API로 직접 확인한 결과: `ts.getJSDocCommentsAndTags()` 가 `bootGenRef` 선언에는 JSDoc 1개를 정확히 붙이지만(`"**부팅 시도 세대**..."`), `pendingResetRef` 선언에는 **0개**를 반환한다(동일 스크립트로 `worldGenRef`/`beginBootAttempt`/`isAttemptStale` 은 모두 정상 1개씩 붙는 것과 대조). 즉 VSCode hover, TypeDoc 등 JSDoc 소비 툴링 어디서도 `pendingResetRef` 를 가리키면 아무 문서도 뜨지 않는다 — "폐기 로직을 다시 넣지 말 것"(4회 재현된 버그 클래스 경고)과 이번에 추가된 "성공하는 부팅의 정의에 supersede 포함" 계약 문장이 통째로 툴링에서 안 보인다. 내용 자체는 정확하고 기존 계약과 모순도 없음(아래 확인 사항 참조) — 문제는 순수하게 **배치**다. 같은 파일의 바로 위 `worldGenRef` 는 JSDoc-선언 1:1 인접 패턴을 지키고 있어(정상), 이번 diff가 그 패턴을 깬 것으로 보인다. lint(eslint) 설정에 jsdoc 플러그인이 없어 이 클래스의 결함은 CI로 안 잡힌다.
  - 제안: `bootGenRef` 의 {JSDoc, `const`} 쌍을 `pendingResetRef` 의 {JSDoc, `const`} 쌍보다 **앞으로** 재배치 — 즉 `worldGenRef` 선언 → `bootGenRef` JSDoc → `const bootGenRef` → `pendingResetRef` JSDoc → `const pendingResetRef` 순서로 바꾸면 두 쌍 모두 인접성이 복원된다.

- **[CRITICAL]** 사용자 가시 버그 수정인데 `CHANGELOG.md` 미갱신
  - 위치: `CHANGELOG.md`(저장소 루트) — 이번 diff 6개 변경 파일에 미포함 (`git diff --stat origin/main...HEAD` 로 확인)
  - 상세: A-6 커밋 메시지 자체가 `fix(web-chat): ERROR 로 종료된 대화가 wc:boot 재전송으로 부활하던 문제 (사용자 가시)` — 작성자 스스로 "사용자 가시" 로 태깅했다. plan 문서도 "실패 사례 (재현 확인)" 로 구체적 재현 로그를 남겼다(`ERROR 후 phase=ended storage잔존=true` → `재부팅 후 phase=streaming ← 부활`). `CHANGELOG.md` 최상단 항목("Unreleased — 웹채팅 위젯: 버퍼 만료 재동기화 + 종료 처리 일원화")은 바로 이 작업의 **선행 PR(#964)** 이며, 정확히 같은 클래스의 버그("종료된 위젯 부활")를 `**종료된 위젯 부활 버그 수정 (사용자 가시 버그 수정)**` 태그로 changelog에 남긴 선례다. 저장소 관례상 CHANGELOG 항목은 별도 후속 커밋이 아니라 **해당 PR 자체에** 포함되는 패턴이다(`git log --grep=changelog` 로 확인 시 전용 커밋 없음 — 매 기능 PR이 자체 "Unreleased — ..." 섹션을 CHANGELOG 최상단에 prepend). 이번 diff는 그 관례를 따르지 않았다.
  - 제안: `CHANGELOG.md` 최상단에 `## Unreleased — ...` 섹션 신설. A-6("ERROR 종료 대화가 wc:boot 재전송으로 부활" — **(사용자 가시 버그 수정)** 태그)을 주 항목으로, §106 준수(supersede)는 plan의 자체 평가("오늘 실사용 재전송 경로는 관리자 라이브 미리보기 하나뿐" — 낮은 사용자 영향)를 반영해 부가 항목으로 함께 기술 권장.

- **[INFO]** `spec/7-channel-web-chat/2-sdk.md` 신규 `code:` 주석의 `§106` 자기 참조가 같은 diff 자신의 편집으로 즉시 4줄 밀림
  - 위치: `spec/7-channel-web-chat/2-sdk.md:6`("§106 `wc:boot` 재전송 계약...") vs `:110`(실제 "`wc:boot` 재전송(멱등 재설정)" 불릿의 현재 위치)
  - 상세: 이번 diff 이전(`74662e3b2`^ 기준) 해당 불릿은 정확히 106행에 있었다 — 저장소 전역에서 쓰이는 "§106" 표기(plan 문서, `use-widget.ts` 여러 JSDoc·주석, 신규 테스트 주석)가 전부 이 파일 이 위치를 라인 번호로 가리키는 관례임을 확인(비교 사례: `EIA §6.5 line 536` 처럼 "§섹션 line 줄번호" 조합 표기가 이 저장소에 존재). 그런데 이번 diff가 바로 그 `code:` frontmatter에 4줄(주석 2줄 + evidence 경로 2줄)을 **그 불릿보다 앞에** 추가하면서, 같은 불릿이 110행으로 밀렸다 — 즉 새로 추가한 "§106" 자기 참조가 추가되는 순간 이미 스스로 4줄 오차를 만든다. 실사용 영향은 낮다(휴먼 리더는 "wc:boot 재전송" 텍스트 검색으로 쉽게 도달, 라인 참조가 CI로 검증되는 것도 아님).
  - 제안: 우선순위 낮음. 다음에 이 문서를 만질 때 "§106"→"§110" 갱신하거나, 향후 유사 표기를 라인 번호 대신 검색 가능한 불릿 텍스트("`wc:boot` 재전송(멱등 재설정)" 불릿) 참조로 바꾸는 편이 이런 자기-드리프트에 더 강건함.

- **[INFO]** 리뷰 payload의 "파일 5"(`plan/in-progress/harness-session-anchor-guards.md` 삭제)는 이 브랜치의 실제 diff가 아닌 것으로 보임 — stale-base 아티팩트 추정
  - 위치: 리뷰 prompt payload 내 "파일 5", 실제로는 무관
  - 상세: `git diff --stat origin/main...HEAD`(merge-base 기준)로 확인한 결과 이 브랜치가 실제로 변경한 파일은 6개뿐이며 `harness-session-anchor-guards.md` 는 포함되지 않는다. 조사 결과: 이 브랜치의 merge-base는 `5de44d4d6`(#964)이고, `harness-session-anchor-guards.md` 는 그 이후 별도 PR `#965`(`14bc86a53`)가 `origin/main` 에 **추가**한 파일이다 — 이 브랜치에는 애초에 존재한 적이 없다. 즉 리뷰 payload를 만들 때 사용한 diff가 `origin/main...HEAD`(3-dot, merge-base 기준) 대신 `origin/main HEAD`(2-dot, tip 기준)로 생성됐다면, main에만 있고 이 브랜치엔 없는 파일이 "삭제"로 오표시될 수 있다 — 이 프로젝트 메모리에 이미 기록된 "ensure-worktree stale base"류 아티팩트와 같은 뿌리. 실제 코드에는 영향 없음(머지 시 3-dot 기준으로 정상 처리됨)이나, 이 리뷰 payload만 보고 "이 PR이 무관한 plan 문서를 삭제한다"고 오판하지 않도록 기록해 둔다.
  - 제안: 조치 불요(문서화 대상 아님). 다만 이 브랜치를 PR로 올리기 전 최신 `origin/main` 기준으로 rebase 여부를 한 번 확인 권장 — 실제 파일 충돌은 없지만 리뷰 payload 생성 파이프라인이 2-dot diff를 쓰고 있다면 다른 곳에서도 같은 오표시가 재발할 수 있음.

## 검증 확인 사항 (문제 없음 — 요청 항목별 실증 결과)

- **`bootGenRef`/`beginBootAttempt`/`isAttemptStale`/`establishConfig` JSDoc의 개별 주장은 전부 코드로 성립함**을 확인했다. 특히 "`applyConfig` 는 `gen`(world 단독)을 스코프에 두지 않아 `isStale(gen)` 은 컴파일되지 않는다" 주장은, `applyConfig`(마운트 `useEffect` 내부)와 `gen` 이 선언되는 세 함수(`seedWaitingFromStatus`/`start`/`sendCommand`, 각각 447·539·584행)가 서로 형제 스코프라 `gen` 이 `applyConfig` 클로저에 전혀 보이지 않음을 확인해 참으로 검증했다. "`!cfg.apiBase` 조기 return 은 세대를 올리지 않는다"도 `beginBootAttempt()` 호출(835행)이 그 조기 return(830행) 다음에 와 참으로 확인. `establishConfig` 가 실제로 `useCallback((cfg): "reset"|"continue" => {...}, [])`(비-async)로 선언돼 "async 아님" 주장도 확인. `establishConfig` 자신의 JSDoc은 `bootGenRef` 와 달리 자기 선언 바로 위에 정상 인접(TS API로도 1개 정상 부착 확인).
- **`pendingResetRef` 계약 갱신("성공하는 부팅"에 supersede 포함)은 기존 계약 문장과 모순되지 않는다.** 기존 "접수된 리셋은 다음 성공하는 부팅이 이행한다"·"BLOCKED/config 없이 끝나면 의도는 남는다"·"불변식 의존 주의"(endpoint 미구분, 재전송 호출부가 리마운트로 안전성 보장) 세 문단 모두, "성공"= `establishConfig` 도달로 정의하면 정합하며, 코드상 `isAttemptStale` 통과 후 **동기적으로**(await 없이) `establishConfig` 호출까지 진행되므로 TOCTOU 없이 이 정의가 실제로 성립함을 확인(위 CRITICAL #2의 배치 문제와는 별개로 **내용은 정확**).
- **spec `2-sdk.md` `code:` 주석의 실질 내용은 정확**하다 — `1-widget-app.md` 는 실제로 "wc:boot 재전송" 동작을 서술하지 않음(grep 확인, locale 관련 교차참조만 존재)을 확인했고, `host-bridge.ts` 의 `onMessage` 핸들러(51행)가 `wc:boot` 을 최초 1회성이 아니라 매번 수신·relay 함(once-guard 없음)을 확인해 "재전송의 위젯 측 구현" 주장이 타당함을 검증했다.
- **plan 문서(`webchat-boot-single-flight.md`)의 진행 기록 수치는 실측과 정확히 일치**한다. 최종 "channel-web-chat 382 passed(22 파일)" 주장은 `npx vitest run` 실행 결과(Test Files 22 passed, Tests 382 passed)와 정확히 일치했다. 단계별 "신규 3건"(A) + "신규 3건"(A-6) = "신규 6건"(최종) 주장도, 실제 diff의 신규 `it`/`it.each` 블록 수(widget-state.test.ts 2개 + use-widget-eager-start.test.ts 4개 = 6개, 그중 A 단계 3개·A-6 단계 3개로 정확히 구분됨)와 `use-widget-eager-start.test.ts` 단독 실행 결과(48 passed = 44 베이스라인 + 4 신규, plan이 인용한 "44"·"45" 중간값과도 시계열상 정합)로 교차검증했다. 체크리스트 전 항목(`[x]`)이 실제 코드 상태와 어긋남 없이 반영됨을 확인.

## 요약

코드/테스트 자체의 문서화 밀도와 정확성은 매우 높다 — `bootGenRef`/`beginBootAttempt`/`isAttemptStale`/`establishConfig` 의 JSDoc 주장들(특히 "컴파일되지 않는다" 류의 검증 가능한 주장)은 전부 실측 확인됐고, plan 문서의 진행 기록·테스트 수치는 실제 vitest 실행과 한 자리까지 일치했다. 다만 세 가지 CRITICAL 이 발견됐다 — (1) 이 diff 자신이 신설한 `RESTORED`/`BOOTED` 가드가 바로 옆 `WAITING` case의 기존 주석("가드 범위는 WAITING 뿐")을 그 자리에서 반증시켰고, (2) `pendingResetRef` 의 갱신된 계약 JSDoc(이번 리뷰가 특히 확인을 요청한 supersede 문단 포함)이 `bootGenRef` JSDoc 삽입으로 선언과의 인접성을 잃어 TypeScript API 실측 결과 IDE 툴링에서 완전히 유실되며, (3) 커밋 메시지 스스로 "(사용자 가시)" 로 태깅한 A-6 버그 수정이 이 저장소의 명확한 선례(직전 CHANGELOG 항목이 정확히 같은 버그 클래스를 "사용자 가시 버그 수정"으로 기재)에도 불구하고 CHANGELOG.md 에 반영되지 않았다. 셋 다 내용이 아니라 **전달/배치/누락**의 문제이며 수정 비용은 낮다(각 몇 줄 안팎). 부가로 spec `code:` 주석의 자기 참조 라인 번호 드리프트(§106→실제 110행)와, 리뷰 payload에 섞인 무관 plan 파일 삭제 아티팩트(실제 diff 아님, stale-base 추정)를 INFO 로 남긴다.

## 위험도

MEDIUM
