# 문서화(Documentation) Review — `10_58_43`

대상: `claude/webchat-reload-rest-branches` vs `origin/main`. 이번 라운드는 직전(`10_41_08`)
라운드에서 낸 WARNING 2건(`§5`→`§1` 인용 세 번째 사본 누락, `"(실측)"` 오라벨)의 반영 완전성과,
새로 쓴 라벨의 저장소 일관성, 그리고 잔여 doc/comment-code 불일치 유무를 확인하는 데 집중했다.

## 확인 (a) — `§5`→`§1` 인용 정정이 이번엔 전수인가

**전수 확인됨.** `codebase/` · `spec/` 전체에서 `"4-security §5"` / `"4-security.md §5"` 문자열을
검색해 **0건**을 확인했다. 실제 라이브 사본 셋:

- `codebase/channel-web-chat/src/widget/use-widget.ts:1269` — `` `4-security.md §1`(표 "에러 메시지 노출") ``
- `codebase/channel-web-chat/src/widget/use-widget.ts:1363` — `4-security §1 표 "에러 메시지 노출"`
- `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1278` — `4-security §1(표 "에러 메시지 노출")`

모두 `§1`로 정정돼 있고, `spec/7-channel-web-chat/4-security.md:38`의 "1. 보안 정책 요약" 표
"에러 메시지 노출" 행("코드 SoT: `use-widget.ts errMessage`")과 실제로 대응한다 — 인용 자체가
정확하다. `eia-client.test.ts`(직전 라운드가 놓쳤던 "세 번째 사본")에는 애초에 이 인용이 없다
(해당 파일은 `EiaError`/`isTerminalAuthError`/`redactToken` 테스트만 다룸 — 인용을 지운 것이
아니라 이 파일엔 원래 이 인용이 없었다는 뜻).

`grep`으로 걸리는 나머지 3건(`plan/complete/webchat-spec-polish-followups.md`,
`review/code/2026/07/*/security.md`, `review/code/2026/08/11/10_02_22/*`)은 전부 **완료된
backlog 항목의 기록 또는 과거 라운드 산출물**이다 — 그 시점에는 실제로 `§5`였던 상태를 그대로
기록한 것이라 지금 정정 대상이 아니다.

## 확인 (b) — 새 `"정적 추적 — 실행·뮤테이션이 아니다"` 라벨이 저장소 다른 용례와 일관되는가

**일관됨.** `"정적 추적"`은 이 저장소 review 산출물에서 2026-07-17부터 반복 사용돼 온 용어로,
"코드를 실행/뮤테이션하지 않고 소스를 눈으로 따라간 논증"을 가리킨다
(`review/code/2026/07/17/09_36_01/testing.md:120`, `review/code/2026/07/17/14_30_15/concurrency.md:9,57`,
`review/code/2026/07/17/13_03_59/side_effect.md:15,40` 등). 이번에 반영된 두 사본이 서로도
일치한다:

- `use-widget.ts:1281` — `**오늘 무해한 근거(정적 추적 — 실행·뮤테이션이 아니다)**`
- `plan/in-progress/webchat-auth-session-status-reconcile.md:251` — `**오늘은 무해하다(정적
  추적으로 확인 — 재현 시도는 실패했고, 그건 부재의 증거가 아니다)**`

두 사본 모두 같은 근거(모든 `await`가 자체 try/catch로 닫혀 있고 유일한 동기 throw가 checkpoint 2
직후에만 발생)를 가리키고, 표현("정적 추적")도 일치한다.

부수 확인: 같은 파일의 다른 `"(실측)"` 라벨 6곳도 전부 실제로 실행된 결과를 가리켜(예:
`use-widget.ts:784`의 뮤턴트 생존 주장은 `review/code/2026/08/10/17_55_57/testing.md:48-62`의
실측 근거와 대응, `:582`는 `16_26_09` testing 라운드의 반증과 대응) 라벨-실제 대응이 이번 정정
이후에도 깨지지 않았다.

- **[INFO]** `"정적 추적"` / `"(실측)"` 구분은 review 산출물 관례로만 존재하고
  `spec/conventions/`에 명문화돼 있지 않다.
  - 위치: 없음(관례가 review artifact 텍스트에만 산재).
  - 상세: 이번 세션에서 `"(실측)"` 오라벨이 이미 재발한 이력이 있다(사용자 메모리:
    "'실측했다'가 세 번 틀렸다"). 코드 주석까지 이 라벨을 쓰기 시작한 이상, 다음 재발을
    막으려면 짧은 문장으로라도 문서화하는 편이 안전하다.
  - 제안: 조치 불요(코드 수정 대상 아님) — 필요하면 plan 항목으로 등재해 추후
    `spec/conventions/` 또는 리뷰 스킬 문서에 "라벨은 실행 결과에만 붙인다"는 한 줄 규약을
    추가할 것.

## 확인 (c) — 이 PR 이 남긴 문서·주석 중 여전히 코드와 어긋나는 것이 있는가

**CRITICAL 없음, WARNING 없음.** 아래 항목을 실제 소스와 대조 검증했고 전부 일치했다.

- `seedWaitingFromStatus`의 JSDoc(REST 오류 4갈래 서술 + `@returns` `SeedOutcome` 표,
  `use-widget.ts:595-684`)과 실제 `catch` 분기(`404`→`ended`/`401`→`recoverFromExpiredToken`/
  기타→`continue`, `use-widget.ts:732-761`)가 일치.
- `SeedOutcome` 4-way union JSDoc(`use-widget.ts:84-111`)과 `shouldAbortAfterSeed`의 화이트리스트
  구현(`use-widget.ts:142-144`), 그리고 `use-widget.test.ts`의 진리표 테스트가 서로 일치.
- `recoverFromExpiredToken`의 JSDoc·인라인 주석(`use-widget.ts:517-593`)이 `isTerminalAuthError`
  (`eia-client.ts`)를 정확히 가리키고, `401`/`410`만 종단으로 처리하는 실제 조건과 일치.
- CHANGELOG.md:166-174 항목이 `refresh_deferred`의 실제 동작(스트림 유예 + 지수 백오프 재예약,
  `401`/`410`만 종료 확정)을 코드와 어긋남 없이 서술.
- `spec/7-channel-web-chat/3-auth-session.md` §R4·§3.1-2가 "재차 `401`·`410`"으로 코드와 정합
  (`16_42_07` 라운드가 지적한 SPEC-DRIFT — §3.1-2가 `401`만 언급하던 상태 — 는 이미 해소됨).
- `spec/0-overview.md:82`가 "영역 spec 6문서가 모두 `implemented`"로 갱신돼 있고,
  `3-auth-session.md` frontmatter(`status: implemented`, `pending_plans` 없음)와 실제로 일치.
- `plan/in-progress/webchat-auth-session-status-reconcile.md`의 "처리(나중 머지 쪽)" 체크리스트
  7항목(파일 이동·역링크 4곳·overview 미러 등)을 실제 파일 상태와 대조 — 전부 일치. 역링크
  4곳 중 diff 로 드러난 2곳(`webchat-command-failure-is-not-termination.md`,
  `webchat-usewidget-extraction.md`)과 나머지도 `in-progress/webchat-reload-rest-error-branches`
  경로의 잔존 참조 0건으로 확인.

이번 세션이 반복해 지적해 온 "낡은 인용/라벨/JSDoc-선언 이격" 패턴(이번이 9~10번째로 언급되는
자리)의 새 재발은 이번 리뷰 범위에서 발견하지 못했다.

## 요약

직전 라운드의 WARNING 2건은 저장소 전수 검색 기준으로 완전히 반영됐고, 새로 도입한 "정적 추적"
라벨은 2026-07-17부터 이어진 저장소 관례 및 같은 파일 내 다른 라벨들과 모두 일관된다. 이번
라운드에서 새로 검토한 JSDoc·CHANGELOG·spec·plan 교차 대조에서 코드와 어긋나는 서술을 찾지
못했다 — CRITICAL·WARNING 없음. 유일한 참고 사항은 "(실측) vs 정적 추적" 구분이 명문화된
convention 이 아니라는 점이며, 이는 조치 불요 수준의 plan 등재 후보로만 남긴다.

## 위험도
NONE
