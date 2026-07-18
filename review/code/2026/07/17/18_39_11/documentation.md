# 문서화(Documentation) 리뷰 — webchat-boot-single-flight (18_39_11)

대상: 고정 merge-base(`14bc86a53`) 기준 7파일 diff. 이전 라운드(`17_36_57`/`17_48_20`)가 낸 CRITICAL 3건 반영 여부를 코드/실측 기반으로 재검증하고, 문서화 8관점을 적용했다.

## 발견사항

- **[CRITICAL]** `bootGenRef` 의 JSDoc 이 다시 유실됐다 — 이번 diff 자신이 만든 회귀 (C3 재발)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:161-180`
  - 상세: 지난 라운드 CRITICAL(C3, `pendingResetRef` JSDoc 0개)의 수정으로 "`bootGenRef` 블록을 앞으로 이동, 재실측 확인(둘 다 1개)" 라고 plan 에 기록돼 있다. 그런데 이번 요청대로 `ts.getJSDocCommentsAndTags()` 로 **확대된 predicate 세트 전원**을 재실측하니 다음과 같다:
    ```
    worldGenRef: 1   unmountedRef: 1   bootGenRef: 0 ← 유실   pendingResetRef: 1
    isStale: 1   beginBootAttempt: 1   cannotApplyConfig: 1   isAttemptStale: 1   establishConfig: 1
    ```
    원인은 C3 수정 **이후**(플랜 순서상 "flicker fix" 라운드)에 추가된 `unmountedRef` 가 "부팅 시도 세대" JSDoc 블록(162-177행)과 `bootGenRef` 선언(180행) **사이**에 자기 자신의 JSDoc+선언 쌍을 끼워 넣으면서 재발했다:
    ```
    161  const worldGenRef = useRef(0);
    162  /** **부팅 시도 세대** — ... (bootGenRef 를 위한 16줄짜리 JSDoc) */
    178  /** 언마운트 여부 — ... */
    179  const unmountedRef = useRef(false);   ← 바로 위 JSDoc 을 정상적으로 가져감(1개)
    180  const bootGenRef = useRef(0);         ← 직전이 코드 줄이라 아무 JSDoc 도 못 가져감(0개)
    ```
    TS 의 JSDoc 첨부 규칙(연속된 두 `/** */` 블록 뒤에 선언이 두 개 오면, 각 선언은 **자신의 바로 앞** 블록만 갖고 그 앞 블록은 고아가 된다)이 정확히 지난 라운드에서 지적됐던 것과 같은 함정인데, 같은 diff 안에서 다른 심볼에 재발했다. IDE hover 로 `bootGenRef` 를 확인하면 world/boot 축 구분, `!cfg.apiBase` 조기 return 비-카운트 근거 등 16줄짜리 설계 rationale 이 통째로 사라진다.
  - 제안: `unmountedRef` 의 JSDoc+선언 쌍을 `bootGenRef` 블록 **앞**(또는 뒤)으로 옮겨 각 선언이 자신의 JSDoc 과 직접 인접하도록 재배치. 예:
    ```ts
    const worldGenRef = useRef(0);
    /** 언마운트 여부 — ... */
    const unmountedRef = useRef(false);
    /** **부팅 시도 세대** — ... */
    const bootGenRef = useRef(0);
    ```
    수정 후 반드시 `ts.getJSDocCommentsAndTags()` 로 **전체 predicate 세트**를 한 번에 재확인할 것 — 이번처럼 부분 확인("둘 다 1개")이 나중에 추가된 심볼로 인해 무효화될 수 있다.

- **[WARNING]** CHANGELOG 항목 3 및 대응 테스트 주석이 **되돌려진(reverted) 메커니즘**을 현재 구현인 것처럼 서술
  - 위치: `CHANGELOG.md:9`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2543-2544`(및 상단 설명 `2497-2505` 부근)
  - 상세: CHANGELOG 항목 3 — "대체된 시도가 복원 중 '이미 종료된 세션' 을 발견해도 종료를 **확정하지 않는다**... 살아있는 시도가 같은 스냅샷을 보고 확정한다(주체만 바뀐다)" — 는 plan 의 "C1 (concurrency) 수정" 단계에서 도입된 `seedWaitingFromStatus` 의 boot-attempt-aware 특례를 서술한다. 그런데 plan 의 **이후** 단계("진행 기록 — flicker fix... 설계 재편")에서 "그래서 `seedWaitingFromStatus` 의 '대체된 시도는 종료를 확정하지 않는다' 특례를 **되돌렸다**(불필요해졌다)" 라고 명시한다.
    실측(`use-widget.ts:467-523`) 결과 현재 `seedWaitingFromStatus` 는 `client, session` 두 인자만 받고 boot 토큰을 전혀 모르며, `isStale(gen)`(world 축 단독)만 검사한 뒤 terminal 이면 **무조건** `finalizeEnded(...)` 를 호출한다 — "대체된 시도는 확정 안 함" 로직은 코드 어디에도 없다. §106 이 실제로 지켜지는 이유는 이 특례가 아니라 **checkpoint 1(`cannotApplyConfig`)이 boot 축만 본다**는 이후 재설계 때문이다(재현 추적: 대체된 1차가 여전히 `finalizeEnded`로 세션을 지우지만, 2차의 checkpoint 1 은 world 를 안 보므로 안 죽는다. 2차는 이미 지워진 세션을 `loadSession` 해 `null` 을 받아 복원 분기 자체를 건너뛴다 — "살아있는 시도가 같은 스냅샷을 보고 확정" 하는 게 아니라 **애초에 재확인이 필요 없어진 것**이다). 대상 테스트(`§106: 대체된 시도의 종료 확정이 마지막 부팅을 죽이지 않는다`)는 현재도 **통과**하지만(직접 실행 확인, 1 passed) 그 이유가 주석과 다르다.
    plan 문서 자체는 진행 기록(로그)이라 "C1 수정 → 이후 되돌림" 순서가 남아있는 게 정상이지만, CHANGELOG 와 테스트 주석은 **현재 구현을 설명하는 자리**라 되돌려진 메커니즘을 최종 사실처럼 적으면 안 된다.
  - 제안: 두 위치 모두 "대체된 시도는 종료를 확정하지 않는다" 를 "대체된 시도의 legitimate 한 world 무효화가 살아있는 시도를 막지 않는다 — checkpoint 1 이 boot 축만 보기 때문" 으로 정정. "주체만 바뀐다" 대신 "재확인 자체가 불필요해진다(세션이 이미 지워져 복원 분기를 스킵)" 로 교체 검토.

- **[WARNING]** `spec/7-channel-web-chat/2-sdk.md` 의 `§106` 자기참조가 **이 diff 자신에 의해** 이미 stale — 반복 지적된 패턴이 저장소 전역에 30곳 이상 전파됨
  - 위치: `spec/7-channel-web-chat/2-sdk.md:6`(참조 지점) vs `:110`(실제 대상 — `wc:boot 재전송(멱등 재설정)` 항목)
  - 상세: 실측 결과 대상 문단은 현재 **110행**인데 주석은 `§106` 을 가리킨다(4줄 드리프트). 이 diff 자체가 frontmatter `code:` 블록에 4줄(주석 2줄 + evidence 경로 2줄)을 새로 추가하는데, 그 4줄이 정확히 대상 문단을 106행→110행으로 밀어냈다 — 즉 **자신이 인용하는 줄을 자신이 삽입하며 밀어낸, 자기모순적 인용**이다(diff 적용 전 106행이었을 위치를 그대로 베껴 썼다가, 같은 diff 의 frontmatter 삽입으로 무효화됨).
    더 근본적으로, 이 저장소의 기존 `§N` 관례(`§10`, `§11`, `§3.1`, `§R6` 등, `grep -rn "§[0-9]"` 로 확인)는 **항상 문서의 실제 번호 매김 헤딩과 일치**한다. 반면 `2-sdk.md` 에는 "## 106." 같은 헤딩이 없다 — `§106` 은 헤딩 참조가 아니라 비공식 **줄 번호 핀**으로 보이며, 이는 이 저장소의 확립된 `§N` 표기 관례와 다른 의미로 같은 기호를 재사용해 독자를 오도할 소지가 있다. 이 표기가 이번 diff 로 CHANGELOG·`use-widget.ts`(6곳)·`use-widget-eager-start.test.ts`(11곳)·`widget-state.ts`(1곳)·plan(9곳)에 "§106" 이라는 이름으로 전파돼, 사실상 이 기능의 비공식 clause-id 가 됐다(총 30곳 이상, `grep -rn "§106"` 확인).
  - 제안: (a) 즉시 조치로 `§106` → `§110` 정정, 또는 (b) 근본 조치로 줄 번호 핀 대신 산문 참조("`wc:boot` 재전송(멱등 재설정) 항목, §3")로 전 저장소 일괄 치환 — 어느 쪽이든 향후 같은 문단 위/앞에 줄이 추가될 때마다 반복 드리프트할 것이므로 (b) 를 권장.

- **[WARNING]** `eslint-disable-next-line` 제거로 인한 `react-hooks/exhaustive-deps` 경고 재발 — **발견 시점엔 재현됐으나 리뷰 도중 워크트리에서 이미 수정된 것으로 재확인됨**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` 언마운트 cleanup 블록(현재 `unmountedRef.current = true;` 직후 `worldGenRef.current++;` 행)
  - 상세: diff 는 기존 `// eslint-disable-next-line react-hooks/exhaustive-deps` 한 줄을 공백 줄로 대체하고 그 자리에 `unmountedRef.current = true;` 를 삽입했다. 1차 실측(`npx eslint src/widget/use-widget.ts`) 에서 실제로 다음 경고가 재현됐다:
    ```
    warning  The ref value 'worldGenRef.current' will likely have changed by the time this
    effect cleanup function runs... react-hooks/exhaustive-deps
    ```
    바로 위 6줄짜리 주석("eslint 의 '값이 바뀌어있을 수 있다' 경고는... 여기선 오탐이다")은 정확히 이 경고를 억제하려는 의도인데, 억제 지시어 자체가 사라져 주석과 코드가 불일치했다. `pnpm --filter channel-web-chat lint`(CI 와 동일 명령) 는 warning-only 라 종료 코드는 0 이라 CI 는 통과하지만, plan 의 "lint PASS" 기록이 "경고 0건" 을 의미하지 않게 된다.
    **재검증**: 같은 세션 도중 재실행하니 `// eslint-disable-next-line react-hooks/exhaustive-deps` 가 `unmountedRef.current = true;` 바로 다음, `worldGenRef.current++;` 바로 앞에 복원돼 있었고 경고도 사라졌다 — 이 공유 워크트리에서 병렬로 도는 다른 라운드(예: security 리뷰 대응)가 이미 수정한 것으로 보인다(같은 파일에 `// (ai-review 2026-07-17 18_39_11 security WARNING — 내가 그 리셋을 빠뜨렸다)` 라는, 이번 라운드 자신을 인용하는 신규 주석도 발견됨 — 리뷰 대상 diff 범위 밖의 실시간 수정).
  - 제안: 이 수정이 최종 커밋에 포함되는지 orchestrator 가 확인. "고정 diff 7파일" 스코프 밖에서 발생한 수정이므로 최종 diff 재생성 시 반영 여부를 재확인할 것.

- **[WARNING]** `widget-state.ts` RESTORED 케이스 주석이 같은 diff 의 이후 수정(C2)으로 이미 부분적으로 낡음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:128-129`, 대응하는 `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:2872-2879`
  - 상세: "`ERROR` 는 `phase: "ended"` 로 보내면서 **세션을 정리하지 않는다**(`teardownSession` 을 거치지 않는 유일한 종료 경로)" 는 A-6 라운드 당시 사실이었다. 그런데 같은 PR 의 **이후** 라운드(C2, side_effect·security CRITICAL)가 `sendCommand` 의 비-410 에러 경로에 `teardownSession()` 호출을 추가했다(`use-widget.ts:634`, 자기 자신의 주석은 "종전엔... 였다" 로 올바르게 과거형 처리돼 있음 — 대조 확인). 실제로 `ERROR` 를 디스패치하는 두 지점 중 세션이 존재할 수 있는 유일한 지점(`sendCommand`)은 이제 정리를 수행하므로, "teardownSession 을 거치지 않는 유일한 종료 경로" 라는 서술은 더 이상 일반 사실이 아니다(다른 한 지점 `start()` catch 는 애초에 세션이 persist 되기 전이라 이 시나리오와 무관).
    `WAITING` 케이스의 인접 주석과 plan 의 C2 섹션은 "근본 원인 fix(C2)" 와 "리듀서 defense-in-depth" 를 명확히 분리해 서술하는 반면, 이 RESTORED 케이스 주석은 그 연결을 언급하지 않아 "ERROR 는 세션을 안 지운다" 를 현재형 불변식으로 오독할 위험이 있다.
  - 제안: "(근본 원인은 이후 `sendCommand` 의 `teardownSession()` 호출로 별도 수정됨 — 본 가드는 여전히 defense-in-depth 로 유지)" 같은 한 문장을 추가해 WAITING 케이스와 서술 패턴을 맞출 것.

- **[INFO]** plan 의 "6번째 거울상" 서수 주장 — 앞선 5건이 문서 내에 열거돼 있지 않아 검증 불가
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:256`
  - 상세: "내가 만든 6번째 거울상 — `startedRef` 스킵" 은 구체적 근거(재현 로그 `STUCK:: ...`, mutation 양방향 고정)를 갖춰 그 자체는 신뢰할 만하지만, "6번째" 라는 서수의 근거가 되는 앞선 1~5번 목록이 plan 안에 없다. 문서 앞부분의 "네 번" (pendingResetRef 폐기 로직, `11_38_14`·`12_04_49`·`12_34_03`·`13_03_59` 4개 라운드로 뒷받침됨)과 이번 PR 자체의 C1(concurrency, "내가 고치려던 바로 그 위반이 다른 경로로 재발") 을 더하면 4+1=5 가 되어 "6번째" 가 산술적으로 그럴듯하긴 하나, 이 계산을 문서가 명시하지 않는다. 이 plan 은 다른 모든 수치·주장에 라운드 타임스탬프나 재현 로그를 빠짐없이 붙이는 습관이 있어(예: mutation 표, `A-5`) 이 한 건만 인용 없이 서수를 단정한 것이 눈에 띈다.
  - 제안: 각주로 1~5번을 짧게 나열하거나("1~4: pendingResetRef 폐기 로직 4연속, 5: C1 world-축 재발"), 서수가 핵심이 아니라면 "또 다른 거울상" 으로 완화.

- **[INFO]** mutation 매트릭스(4/3/1/1/4/0) 수치를 독립 재현하지 못함 — 워크트리 위생 제약
  - 위치: `plan/in-progress/webchat-boot-single-flight.md:151-158`
  - 상세: "공유 워크트리, 코드 수정 금지" 지시에 따라 표에 기재된 각 mutation(예: "둘째 지점만 제거")을 실제로 코드에 적용해 재확인하지 않았다. 대신 안전하게 확인 가능한 것만 검증: 현재 베이스라인 스위트를 그대로 실행한 결과 `Test Files 22 passed (22)` / `Tests 385 passed (385)` — plan 최종 진행 기록의 "channel-web-chat **385 passed**(22 파일)" 과 **정확히 일치**한다. 표의 개별 실패 건수 자체는 신뢰 여부를 판단할 근거(재현 로그·raw 출력)가 함께 제시돼 있지 않아 액면 그대로 수용했다.
  - 제안: 정보성 — 별도 조치 불요. 다만 향후 유사 mutation 표는 최소 1~2개 대표 케이스의 raw 실패 로그를 plan 에 첨부하면 사후 검증이 쉬워진다.

- **[INFO]** CHANGELOG 새 항목의 제목 구조가 기존 관례와 소폭 다름
  - 위치: `CHANGELOG.md:3`
  - 상세: 새 항목 제목 `"웹채팅 위젯: 마지막 wc:boot 적용(§106) + 종료된 대화 부활 fix"` 은 spec 참조 괄호(`§106`)를 제목 **중간**에 둔다. 반면 파일 내 다른 6개 `## Unreleased` 항목은 전부 `<설명> (<spec/부가설명>)` 형태로 참조 괄호를 제목 **끝**에 둔다(예: `"...버퍼 만료 재동기화 + 종료 처리 일원화 (7-channel-web-chat §3.1)"`, `"...타임아웃 (defense-in-depth, §12.16)"`). 내용 자체는 명확해 실질적 문제는 없다.
  - 제안: 사소한 스타일 통일 — 급하지 않음. 예: `"웹채팅 위젯: 마지막 wc:boot 적용 + 종료된 대화 부활 fix (2-sdk §106)"`.

- **[INFO]** `widget-state.ts` WAITING 케이스의 "C1" 인용이 이번 라운드 자체의 새 "C1" 과 이름이 충돌할 수 있음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts:157`(`USER_MESSAGE 는... C1 이 보여줬듯...`) 부근
  - 상세: 이 문구는 이번 diff 이전부터 있던 표현을 그대로 옮긴 것으로, 원래 `02_04_13` 라운드의 C1(복원 분기가 `start()` 의 우연한 가드를 못 받은 문제)을 가리킨다. 그런데 이번 diff 가 CHANGELOG·plan 에 **자기 자신의 새로운 "C1"**(concurrency CRITICAL, supersede 설계 결함 — 완전히 다른 내용)을 도입하면서, 같은 파일·같은 PR 안에 라운드 접두어 없는 "C1" 참조가 두 개의 다른 사건을 가리키게 됐다. 다른 곳(plan 79행 등)은 `` `02_04_13` C1 `` 처럼 타임스탬프를 붙여 명확히 구분하지만 이 comment 는 접두어가 없다.
  - 제안: `C1` → `` `02_04_13` C1 `` 로 접두어 추가(한 단어 수정)해 이번 라운드의 새 C1 과 혼동 방지.

## 검증 방법 요약 (재현 가능)

- JSDoc: `ts.getJSDocCommentsAndTags()` 로 `use-widget.ts` 전체 파싱, 대상 심볼 9종 전수 확인.
- lint: `npx eslint src/widget/use-widget.ts` (channel-web-chat package, `pnpm lint` 와 동일 실행기).
- 테스트: `npx vitest run`(전체, 385/22 확인) 및 `-t` 필터로 특정 §106 테스트 단독 실행(1 passed).
- §106 줄 드리프트: `grep -n` 으로 실제 대상 문단 위치 확인.
- 코드 수정은 전혀 하지 않았다(워크트리 위생 준수) — 모든 검증은 read-only 실행.

## 요약

이전 라운드가 지적한 CRITICAL 3건 중 2건(WAITING 주석 자기모순, CHANGELOG 신설)은 정확히 반영됐고, `pendingResetRef` 자체의 JSDoc 유실도 해소됐다. 그러나 그 수정 방식(선언 순서 재배치)이 구조적으로 "JSDoc 블록이 연속되면 앞쪽이 고아가 된다"는 근본 원인을 없애지 않아, 이후 라운드(`unmountedRef` 도입)에서 **같은 결함이 `bootGenRef` 로 옮겨 재발**했다 — 확대된 predicate 세트를 재검증하라는 이번 요청이 정확히 이 재발을 잡아냈다. 이 외에 CHANGELOG·테스트 주석 한 곳이 이후 라운드에서 되돌려진(reverted) 설계를 여전히 현재형으로 서술하는 문제, spec 의 `§106` 자기참조가 같은 diff 삽입으로 스스로 무효화된 문제(및 그 표기가 저장소 전역 30곳 이상에 비공식 clause-id 로 전파된 점), `ERROR`/`teardownSession` 서술이 후속 C2 fix 이후 갱신되지 않은 점을 확인했다. JSDoc 의 검증 가능한 개별 주장들(`cannotApplyConfig` 의 world 축 미검사, `unmountedRef` 의 편도 종점 성질, `streamRef` 기반 스킵 판정)과 이전에 정정된 "타입 검사 보호 범위" 과대 주장은 모두 코드로 정확히 성립함을 실측 확인했다. README/API/설정 문서 관점은 이 diff 범위(내부 동시성 로직 + 상태머신)에 해당 사항이 없어 갭 없음.

## 위험도

MEDIUM — CRITICAL 1건은 런타임 동작에는 영향 없는 순수 문서(hover) 결함이지만, 이 파일이 저문서화로 반복 회귀를 낸 이력(이번 세션에서만 6번째로 자평)을 감안하면 재발 자체가 신호다. 나머지는 전부 WARNING/INFO 로 CI·런타임을 막지 않는다.

STATUS=success ISSUES=9 PATH=/Volumes/project/private/clemvion/.claude/worktrees/webchat-boot-single-flight-8c92b4/review/code/2026/07/17/18_39_11/documentation.md RESET_HINT=
