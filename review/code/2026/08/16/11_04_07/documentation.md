# 문서화(Documentation) 리뷰

## 컨텍스트

이번 라운드(`11_04_07`)가 대상으로 하는 56개 파일 누적 diff(vs `origin/main`)는 이미 세 차례의
`/ai-review`(`09_51_00`→`10_19_30`→`10_41_55`)와 두 차례의 consistency-check(`09_25_29`→
`10_19_31`)를 거쳤다. 핵심 코드(`terminal-error-payload.ts`/`.spec.ts`/
`sanitize-error-message.ts`/`CHANGELOG.md`)는 실물 파일을 직접 `Read` 로 열어 이전 라운드가
"반영됨"이라 주장한 지점(§3.1 인용 정정, "5곳" 중의성 해소, JSDoc 궤도 정상화, 판별력 있는
테스트 등)이 실제로 코드에 존재함을 재확인했다 — 이 부분은 새로 지적할 것이 없다.

## 발견사항

- **[WARNING]** plan 체크리스트의 "fresh `/ai-review` (fix 이후)" 항목이, 그 항목을 이미
  충족한 리뷰 라운드가 커밋된 뒤에도 미체크(`- [ ]`)로 남아 있다 — 이 저장소가 반복 기록한
  "plan 체크박스 = 실제 상태" 교훈이 같은 PR 안에서 세 번째로 재발했다
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md:170`(`- [ ] fresh \`/ai-review\`
    (fix 이후)`), 인접 항목 `:168-169`(`09_51_00`·`10_19_30` 는 `[x]`)·`:171`(`--impl-done` 은
    `[x]`)
  - 상세: `git log --oneline`으로 직접 대조 — 커밋 `fb4a70b72`("docs(review): 10_41_55
    Critical 0 · Warning 2 — 수렴, codebase 편집 종료")가 정확히 이 체크리스트 항목이 요구하는
    작업(`--impl-done` 이후의 fresh `/ai-review`)을 수행하고 `review/code/2026/08/16/10_41_55/
    RESOLUTION.md`("3라운드 수렴 판정… 코드 결함은 1라운드가 마지막이다")까지 남겼다. 같은 라운드의
    `testing.md:5`도 스스로 "이번 라운드(`10_41_55`)는 plan 체크리스트상 'fresh `/ai-review`
    (fix 이후)' 단계다"라고 명시한다. 그런데 `fb4a70b72`의 diff(`git show --stat`로 직접 확인)는
    `terminal-error-payload.spec.ts`(주석 3줄)·`spec-sync-external-interaction-api-gaps.md`
    (3줄)·`review/code/2026/08/16/10_41_55/**` 14개 파일만 건드렸고 `eia-terminal-error-
    sanitize.md`는 전혀 손대지 않았다 — 체크박스가 그대로 `[ ]`로 남았다. 또한 plan 본문의 "리뷰
    잡은 것" 절 제목이 여전히 `## 리뷰(\`09_51_00\`)가 잡은 것`뿐이고(`:110`), `10_19_30`·
    `10_41_55` 두 라운드가 각각 반영한 W1~W10/W1~W2 는 그 라운드 자신의 `RESOLUTION.md`에만
    남아 plan 본문 서사에는 미러링되지 않았다 — 다음 사람이 이 plan 하나만 읽으면 두 라운드가
    있었다는 사실 자체를 놓친다. 이 프로젝트는 정확히 이 클래스의 결함을 이미 두 번 별도로
    기록했다(`feedback_plan_checkbox_actual_state.md`, 그리고 같은 PR 의 `10_19_31`
    consistency-check `plan_coherence.md` 가 무관한 `eia-terminal-emit-facade.md` 의 동일 패턴
    stale 체크박스를 지적) — 세 번째 재발이 이번엔 이 PR **자신의** plan 문서에서 일어났다.
    실질적 비용도 있다 — 체크리스트가 최신이 아니면 다음 세션(혹은 이번 `11_04_07` 라운드 자체)이
    "fresh 리뷰가 아직 안 됐다"고 오판해 이미 수렴한 diff 를 다시 통째로 리뷰하게 만든다(현재
    라운드가 그 정황과 일치한다 — 코드 델타 없이 동일 56개 파일을 다시 검토 중).
  - 제안: `plan/in-progress/eia-terminal-error-sanitize.md:170`를 `[x]`로 갱신하고
    `review/code/2026/08/16/10_41_55/RESOLUTION.md` 를 근거로 링크. 가능하면 `10_19_30`·
    `10_41_55` 라운드의 반영 요약도 `09_51_00`과 같은 방식으로 plan 본문에 짧게 미러링(또는 절
    제목을 "리뷰가 잡은 것(`09_51_00`~`10_41_55`)"로 일반화)해 체크리스트·본문·`review/**`
    산출물이 어긋나지 않게 할 것.

## 확인한 항목 (문제 없음 — 실물 대조로 재검증)

- `CHANGELOG.md`(신규 `## Unreleased` 항목)의 "EIA outbound webhook(§3.1)" 인용은 실제
  `spec/5-system/14-external-interaction-api.md`의 §3.1(EIA-NX-02)과 일치 — §3.3(인증)으로
  잘못 적었던 이전 오류가 이번 diff·기존 `CHANGELOG.md:45` 모두에서 정정되어 있음을 직접 확인.
- `terminal-error-payload.ts`의 JSDoc은 `redactTerminalError`(함수 정의 `:107-115`)가
  `toTerminalErrorPayload`의 `@param`/`@returns` 블록(`:117-121`)보다 앞에 위치해 궤도 이탈
  없이 정상 귀속돼 있고, "호출부 5곳"이 언급되는 두 문단(`:8-9` 취소 이벤트 vs `:63-65`
  `toTerminalErrorPayload`)에는 `:65`에 "(위 §'현재 호출부' 의 취소 이벤트 5곳과는 **다른
  집합**이다.)"라는 명시적 구분이 들어 있어 중의성이 해소돼 있다.
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` 의 정정된
  docstring("실측 3곳뿐이고 전부 알림 조립 지점")은 실제 호출부 3곳
  (`execution-engine.service`·`background-execution.processor`·`schedule-runner`)과
  일치하고, 로직(정규식·길이 상한)은 diff 로 변경되지 않았다 — docstring-only 수정이 맞다.
  이 파일이 "shared SoT"라 지칭하는 `shared/utils/sanitize-error-message.ts` 는 서로 다른
  디렉터리의 **다른 파일**(동일 basename)로, `terminal-error-payload.ts:1-2`·
  `sanitize-error-message.ts:9-11` 양쪽 다 이 관계를 명시해 두어 혼동을 완화한다(이미 이전
  라운드 maintainability INFO 로 기결정 — 재조치 불요).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md:169`의 "…blast radius 가 다른
  별건"으로 술어 없이 끊기던 문장은 이번 diff 이전 라운드(`10_41_55` documentation INFO)가
  지적한 대로 `…다른 별건이다.`로 완결돼 있음을 확인했다.
- `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 절(`:151-159`)은 §R17 카탈로그
  5번째 항목·§6.4 캐비엇을 developer 권한 밖(`spec/`) planner 턴 대상으로 정확히 명시하고
  있고, 이번 라운드에서도 그 상태(미완료 `[ ]`, spec 파일 diff 0줄)는 실제와 일치한다 — 이
  항목 자체는 stale 이 아니다.

## 요약

이번 라운드에서 실물 소스(`terminal-error-payload.ts`/`.spec.ts`/`sanitize-error-message.ts`/
`CHANGELOG.md`/`spec-sync-external-interaction-api-gaps.md`)를 직접 열어 대조한 결과, 앞선 세
라운드가 지적하고 "반영됨"이라 주장한 문서 정확성 문제(§3.3→§3.1, "5곳" 중의성, JSDoc 궤도 이탈,
술어 누락 문장)는 모두 실제로 해소돼 있다. 이번 라운드에서 새로 발견한 것은 코드가 아니라 이
PR 자신의 진행 추적 문서(`plan/in-progress/eia-terminal-error-sanitize.md`)의 체크리스트가
`10_41_55` 라운드의 완료(`RESOLUTION.md`, "3라운드 수렴")를 반영하지 못한 채 `- [ ] fresh
/ai-review (fix 이후)`로 남아 있다는 점이다(WARNING). 이 프로젝트가 이미 두 차례 별도로 기록한
"plan 체크박스 = 실제 상태" 교훈이 같은 PR 안에서 세 번째로 재발한 사례이며, 실제로 이 stale
상태가 코드 변경 없이 동일 diff 를 다시 리뷰하게 만드는 이번 라운드 자체의 정황과도 맞아떨어진다.
Critical 급 문서 결함은 없다.

## 위험도

LOW
