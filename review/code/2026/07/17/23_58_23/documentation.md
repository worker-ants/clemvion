# 문서화(Documentation) 리뷰 — webchat-boot-single-flight (23_58_23)

대상: `29aa918a6`(origin/main merge-base)`..HEAD` — 16파일. 직전 라운드(18_39_11)가 낸 CRITICAL 3건·WARNING
6건의 반영 여부를 컴파일러 API·grep·git 히스토리·테스트 실행으로 재실측했다. 이번 라운드가 지정한 3개
핵심 항목(JSDoc 10심볼 전수, §3(재전송) 표기, `seedWaitingFromStatus` 표)은 전부 격리 확인했다.

## 발견사항

- **[WARNING]** `use-widget-eager-start.test.ts` 의 테스트 주석이 **되돌려진(reverted) 메커니즘**을 여전히
  현재 구현인 것처럼 서술 — 18_39_11 라운드가 CHANGELOG 와 함께 지적했고 RESOLUTION 은 "fix" 로 표시했지만
  **이 위치는 실제로 고쳐지지 않았다**.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2536-2544`(주석 블록),
    `:2599`(테스트 본문 인라인 주석).
  - 상세: 해당 주석은 "fix: 대체된 시도의 seed 는 종료를 **확정하지 않는다**(`"stale"` 반환). ... 살아있는
    시도가 자기 복원 분기에서 같은 스냅샷을 보고 확정한다. **주체만 바뀐다**" 라고 서술한다. 이는
    `c5d08c45d`(17_36_57 C1 최초 fix)가 도입한 설계다. 그런데 plan 자신의 "충돌 해소 — checkpoint 1 을
    boot 축 전용으로" 절(`webchat-boot-single-flight.md:247-254`)이 명시하듯 그 설계는 **`f1883470b`(flicker
    fix 라운드)에서 되돌려졌다** — "그래서 `seedWaitingFromStatus` 의 '대체된 시도는 종료를 확정하지
    않는다' 특례를 되돌렸다(불필요해졌다)". 실제 현재 코드(`use-widget.ts:511-572`, 이번 라운드 JSDoc 표로
    검증 완료)는 종료 확정(`finalizeEnded`) 분기를 world 축만으로 게이팅하고 boot/`attempt` 축은 **전혀
    보지 않는다** — 즉 **대체된 시도의 seed 도 여전히 종료를 확정한다**(그게 지금 설계의 핵심이다:
    "종료는 세계의 사실이지 시도의 소유물이 아니다", `cannotApplyConfig` JSDoc L281-283). `git log -L
    2536,2545:...test.ts` 로 provenance 를 추적한 결과, 이 코멘트 블록은 `c5d08c45d` 이후 `§106→§110→
    §3(재전송)` 라벨만 두 차례 기계적으로 치환됐을 뿐(`d48a48aae`, `7386acb72`) **본문 서술은 한 번도
    갱신되지 않았다**. 반면 같은 커밋(`7386acb72`)에서 `RESOLUTION.md`/`SUMMARY.md`(같은 파일 경로 다른
    이슈)는 의미 단위로 정확히 재작성됐다 — 즉 CHANGELOG 는 고쳤지만(18_39_11 라운드가 지적한 두 위치 중
    하나) 명시적으로 함께 지목됐던 이 테스트 파일 위치는 누락됐다.
  - 실제 테스트 자체(`it("§3(재전송): 대체된 시도의 종료 확정이 마지막 부팅을 죽이지 않는다", ...)`,
    L2545-2620)는 **최종 단언은 정확**하다(`plan==="last"`, `phase==="ended"`) — 전체 스위트도
    390 passed 로 재확인했다. 런타임 결함은 아니다. 다만 "왜 통과하는가" 의 서술이 틀려, 이 파일이
    반복해 겪은 "가드를 어느 축에 다느냐" 오판을 재현할 위험을 갖는다 — 예컨대 이 주석만 읽고
    `cannotApplyConfig`/checkpoint 1 에 world 축을 다시 얹으면 정확히 `17_36_57` C1 이 재발한다.
  - 제안: 두 위치 모두 "대체된 시도의 seed 도 종료를 그대로 확정한다(world 축만 보므로) — checkpoint 1
    이 boot 축 전용이라 그 무효화가 살아있는 부팅을 막지 않는다" 로 정정. `use-widget.ts` 의
    `seedWaitingFromStatus` JSDoc 표(L486-491)를 그대로 인용하면 재발 방지에 도움이 된다.

- **[WARNING]** `plan/in-progress/webchat-boot-single-flight.md` 자신의 진행 기록이 `§106→§3(재전송)`
  정정 히스토리를 부정확하게 서술 — 41건 재정정 커밋의 **기계적 문자열 치환이 과거 서술까지 덮어썼다**.
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:351`, `:358`.
  - 상세: 두 줄 모두 `` `§106` → `§3(재전송)` 39건 정정 `` 이라고 적는다. 그러나 `git show 7386acb72`
    로 확인한 실제 역사는 **2단계**다 — ① `fdaa06e98` 가 `§106`→`§110` 39건 정정(당시 plan 도 정확히
    "§106 → §110 39건 정정" 이라 적었다), ② `7386acb72` 가 `--impl-done 19_46_54` 체커 충돌 판정에
    따라 `§110`→`§3(재전송)` **41건**을 추가 정정(커밋 메시지 "41건을 `§3(재전송)` 으로 교체" 로 명시).
    이 두 번째 커밋이 plan 파일 전체에서 문자열 `§110` 을 `§3(재전송)` 으로 **일괄 치환**하면서, 과거형
    서술("§106 → §110 39건 정정")까지 함께 걸려 `` `§106` → `§3(재전송)` 39건 `` 이라는, 실제로 일어난
    적 없는 단계(직접 전이 + 잘못된 건수)를 기록하게 됐다. 같은 커밋이 함께 수정한
    `review/code/.../18_39_11/RESOLUTION.md`/`SUMMARY.md` 는 대조적으로 "1차 §110 정정(39건) 후
    ... §3(재전송) 으로 재정정(41건)" 처럼 **의미 단위로 재작성**돼 정확하다(직접 대조 확인). 저장소
    전역에서 `§106`/`§110` 잔존 여부를 grep 한 결과 이 두 줄을 제외하면 전부 무관한 과거 리뷰 산출물뿐이라,
    실사용에 영향은 없다. 다만 이 plan 은 `plan/complete/` 로 이동해 **영구 감사 기록**이 될 문서이고,
    바로 이 항목 자체가 "행-번호 clause-id 취약성" 을 다루는 대목이라 아이러니가 크다.
  - 제안: 두 줄을 `` `§106` → `§110`(39건, fdaa06e98) → `§3(재전송)`(41건, 7386acb72 — --impl-done
    19_46_54 체커 충돌 판정) `` 형태로 정정. 사소하지만 `plan/complete/` 이동 전 정리 권장.

- **[INFO]** `bootGenRef` JSDoc 유실 재발 — **완전히 해소 확인** (컴파일러 API 10심볼 전수 재실측).
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:161-221`.
  - 검증: `ts.getJSDocCommentsAndTags()` 로 `worldGenRef`/`bootGenRef`/`unmountedRef`/`pendingResetRef`/
    `isStale`/`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale`/`sessionEstablished`/
    `establishConfig` 10개 심볼 전부 **정확히 1개씩** JSDoc 확인(`0` 이 나온 심볼 없음). 스크립트 자체의
    탐지력도 원 버그 패턴(JSDoc 두 블록 연속 + 선언 두 개 — 두 번째 선언이 고아가 되는 TS 첨부 규칙)을
    합성 재현해 `count=0` 으로 정확히 잡는지 별도 확인했다. 선언 순서는 `worldGenRef` →
    `bootGenRef`(JSDoc 162-181 + 선언 182) → `unmountedRef`(JSDoc 183 + 선언 184) →
    `pendingResetRef`(...) 로, `unmountedRef` 가 **`bootGenRef` 아래**로 옮겨져 있다(지시된 대로). 블록
    안에 "⚠ 이 블록과 `bootGenRef` 선언 사이에 다른 선언을 끼워 넣지 말 것 — JSDoc 은 인접성으로만
    붙는다. 이 파일에서 두 번 당했다(`pendingResetRef`←`bootGenRef` 삽입, `bootGenRef`←`unmountedRef`
    삽입)" 경고가 정확히 그 취약 경계(블록 종료~`bootGenRef` 선언 사이)를 겨냥해 명문화돼 있다(L178-180).
    `eslint`(`npx eslint src/widget/use-widget.ts`) 도 clean.

- **[INFO]** `§106`→`§110`→`§3(재전송)` 표기 정정 — **41건 전부 정확한 타겟을 가리킴 확인**.
  - 위치: `spec/7-channel-web-chat/2-sdk.md:93`(`## 3. host ↔ iframe postMessage 프로토콜`),
    `:110`(`wc:boot` 재전송(멱등 재설정) 불릿).
  - 검증: `grep -o "§3(재전송)"` 로 저장소 전체(과거 리뷰 산출물 제외) 카운트 = **41**(CHANGELOG.md 4,
    plan 14, `2-sdk.md` 1, `use-widget.ts` 6, `use-widget-eager-start.test.ts` 16) — RESOLUTION.md 의
    "41건" 주장과 정확히 일치. `2-sdk.md` 의 heading 목록(`grep "^## "`)을 확인해 `§3` 이 실존 섹션(L93)
    임을, 그 섹션 안에서 "재전송" 문자열이 L110/113-115 불릿에만 등장함을(`grep -n 재전송`) 확인해
    `§3(재전송)` 이 다른 어떤 조항과도 혼동되지 않게 유일하게 해당 불릿을 가리킴을 검증했다. 저장소
    전체에서 `§106`/`§110` 잔존 여부도 재확인 — 남은 매치는 전부 이번 diff 범위 밖의 무관한 과거 리뷰
    산출물(`12_04_49/side_effect.md`, 2026/06·07/10 의 다른 spec 영역 consistency 리포트)이거나 위
    WARNING 이 지적한 plan 자기서술 2곳뿐이었다.

- **[INFO]** CHANGELOG — **A-6(되돌려진 설계) 잔재 없음 확인**.
  - 위치: `CHANGELOG.md:1-11`.
  - 검증: 현재 최상단 항목(`§3(재전송)`)의 3개 불릿을 코드와 대조 — ①마지막 config 적용
    (`bootGenRef`/`beginBootAttempt`), ②재전송이 활성 대화를 방해하지 않음(`sessionEstablished()`
    복원-스킵, `use-widget.ts:955`), ③대체된 시도가 화면을 안 되감되 종료 확정은 유지
    (`seedWaitingFromStatus` 의 world-only 종료 분기) 모두 현재 코드와 일치한다. `teardownSession`·
    `ERROR`·`RESTORED`/`BOOTED` `ended` 가드 확대 등 A-6 되돌림 대상이었던 표현은 CHANGELOG 어디에도
    없음을 `grep` 으로 확인(순변경 0 이라 제거됐다는 RESOLUTION 주장과 일치). `sendCommand` 의 비-410
    분기(`use-widget.ts:672-692`) 주석도 "한때 여기서 `teardownSession()` 을 불렀다... 반증됐다" 로
    명확히 과거형 처리돼 현재 코드(실제로 그 호출 없음, `grep teardownSession` 확인)와 정합한다.

- **[INFO]** `seedWaitingFromStatus` 의 신설 JSDoc 표(staleness 정책 2개 공존) — **코드와 라인 단위로 일치
  확인**.
  - 위치: `use-widget.ts:486-496`(JSDoc 표), `:517-554`(구현), `:504-505`(`@param attempt` 설명).
  - 검증: 표는 "종료 확정(`finalizeEnded`) = world 만 / 표면 갱신(`WAITING` dispatch) = world+boot" 라고
    선언한다. 코드는 `L528 if (isStale(gen)) return "stale";`(world, 두 분기 공통 상위 게이트) →
    `L534-537` terminal 이면 `attempt`/`cannotApplyConfig` 를 **전혀 참조하지 않고** `finalizeEnded`
    호출 → `L538-554` `waiting_for_input` 분기에서만 `L541 if (attempt && cannotApplyConfig(attempt))
    return "stale";` 로 boot 축 추가 게이팅. 정확히 표와 일치. `@param attempt` 의 "`applyConfig` 만
    넘긴다 — `start()`/`replay_unavailable` 폴백은 생략" 주장도 3개 호출부(`L635`: 2-인자, `L966`:
    3-인자 `attempt` 포함, `L423` ref 경유 2-인자) 전수 대조로 확인.

- **[INFO]** (이월, 저위험) 두 잔여 문서 항목 — 이전 라운드에서 이미 INFO 로 저위험 판정된 채 미수정 유지.
  다시 확인만 하고 이번 라운드 처리 대상으로 격상하지 않음: (a) `widget-state.ts:161-162` 의 `USER_MESSAGE`
  주석이 인용하는 `C1` 이 라운드 접두어 없이(``02_04_13`` C1 vs 이번 PR 의 새 C1) 남아 있다. (b) CHANGELOG
  새 항목 제목의 `(§3(재전송))` 괄호 위치가 다른 6개 `## Unreleased` 항목과 달리 제목 중간에 있다(다른
  항목은 끝에 둔다).

## 검증 방법 요약 (재현 가능)

- JSDoc: 격리 스크립트(`ts.getJSDocCommentsAndTags`, channel-web-chat 의 `typescript@5.9.3` 사용, 합성
  회귀 케이스로 탐지력 자체도 검증)로 10심볼 전수 확인 후 스크래치패드에서 제거.
- `§3(재전송)`: `grep -rn`/`grep -o` 로 전량 카운트(41) + `2-sdk.md` heading/문단 위치 확인.
- lint: `npx eslint src/widget/use-widget.ts` — clean.
- 테스트: `npx vitest run`(channel-web-chat 전체, **390 passed/22파일** — RESOLUTION.md 수치와 일치) +
  `widget-state.test.ts` 단독 실행(42 passed).
- 코멘트 provenance: `git log -L <range>:<file>`/`git show <commit> -- <file>` 로 각 서술의 최종 수정
  커밋 추적.
- spec 인용 검증: `1-widget-app.md`/`3-auth-session.md` 원문과 plan/RESOLUTION 의 인용문 대조.
- 코드 수정은 하지 않았다(공유 worktree 읽기 전용) — 모든 검증은 read-only 실행이며 임시 스크립트는
  scratchpad 에만 생성 후 제거했다.

## 요약

이번 라운드가 지정한 3개 핵심 항목은 모두 실측으로 정확히 해소됨을 확인했다: `bootGenRef` JSDoc 유실은
컴파일러 API 10심볼 전수 재실측으로 완전히 해소됐고 재발 방지 경고도 취약 경계에 정확히 배치돼 있으며,
`§106→§110→§3(재전송)` 표기는 41건 전부 `2-sdk.md §3` 의 유일한 "재전송" 불릿을 정확히 가리키고,
`seedWaitingFromStatus` 의 이중 staleness 정책 JSDoc 표는 코드와 라인 단위로 일치한다. CHANGELOG 도 A-6
되돌림 이후의 잔재 없이 깨끗하다. 다만 이 과정에서 두 개의 새 WARNING 을 발견했다 — 하나는 18_39_11
라운드가 **이미 지적하고 RESOLUTION 이 "fix" 로 표시했으나 실제로는 고쳐지지 않은** 테스트 파일 주석(여전히
되돌려진 C1 메커니즘을 서술, 재발 위험의 씨앗), 다른 하나는 이번 §-표기 재정정 자체가 남긴 부작용(plan
자신의 과거 서술이 기계적 치환으로 부정확해짐)이다. 둘 다 런타임·빌드·테스트 통과에는 영향이 없고
production 코드의 JSDoc·CHANGELOG·spec 은 전부 정확하다.

## 위험도

LOW — CRITICAL 0건. WARNING 2건은 전부 주석/plan 서술 정확성 문제로 컴파일·런타임·테스트 결과에 영향
없음(390 passed 로 확인). 다만 첫 번째 WARNING(테스트 주석)은 "이미 fix 로 표시됐으나 실제로는 미수정"
이라는 프로세스적 의미가 있어 우선 정리를 권한다.

STATUS=success ISSUES=7 PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/17/23_58_23/documentation.md RESET_HINT=
