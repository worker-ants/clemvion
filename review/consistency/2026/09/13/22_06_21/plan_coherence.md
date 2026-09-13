# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base=origin/main)

## 검토 대상 요약

이 diff 는 `error-code-emission-axis` plan(라운드 1~7, HEAD `53d29a6f4`)의 산출물이다.
`spec/conventions/` 자체 델타는 0(정상 — 코드 전용 PR, `spec_impact: none`)이고, 실제 변경은
`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`(발행 축 신설) ·
`logic{,.en}.mdx`(가이드 문장 2건 정정) · `CHANGELOG.md`/`PROJECT.md` 다.

plan(`plan/in-progress/error-code-emission-axis.md`)과 이 배치가 닫는 트래커 항목
(`plan/in-progress/spec-draft-nullable-notation-followups.md`)을 대조했다. 이 plan 은
이례적으로 자기-정합성 관리가 촘촘하다 — 라운드마다 선행 항목(§B-3 술어, §D-2 등록,
§K 역참조)을 실측으로 재검증하고, planner 몫 택일(카탈로그 backfill vs 메시지-접두 표기,
`spec/` 6파일 정정)을 코드로 우회하지 않고 트래커에 **양방향** 역참조로 넘겨 두었다
(`--impl-done` INFO#7 지적을 반영해 `complete/` 봉인 대비 역참조까지 넣음). 7라운드 전부
`plan_coherence` 가 이 항목 계열에서 NONE~INFO 로 수렴한 상태다. 아래는 지금까지 어느
라운드도 짚지 않은 새 발견이다.

## 발견사항

- **[WARNING]** 같은 파일을 계속 키우는 이 plan 이, 그 파일의 비대화를 이미 지적한 형제 항목의 실측 수치를 갱신하지 않았다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (이 배치가
    라운드 1~7 에 걸쳐 245줄 순증 — `git diff --stat origin/main...HEAD` 기준)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:3332`
    `**guide-identifier-scan.ts 가 코드 84줄에 주석 260줄이다 (72%)**` (developer,
    2026-09-13 `17_26_33` 등재, 아직 미체크 `- [ ]`)
  - 상세: 그 항목은 "실측: 361줄 = 주석 260 · 코드 84 · 빈줄 17" 을 근거로
    유지보수성 판단(리팩터 착수 조건까지)을 걸어 두었다. `error-code-emission-axis`
    plan 은 바로 이 파일에 발행 축 3종(`collectQuotedLiterals`·`collectMessagePrefixes`·
    `collectCatalogCodes`) + `GUIDE_NON_EMITTED_VOCABULARY` + 그 근거를 담은 방대한 JSDoc 을
    7라운드에 걸쳐 추가했다. 지금 그 파일을 다시 세면 **601줄 = 주석 418 · 코드 156 ·
    빈줄 27**(python3 라인 분류 실측, 위 워킹트리 기준)이다. 비율(약 70%)은 거의 그대로지만
    절대 수치는 항목이 인용하는 것과 240줄(66%) 차이가 난다. 이 plan 의 §J 는 스스로
    "숫자를 안 세고 썼다" 는 형태를 두 번 자백했는데(§J "숫자를 또 안 세고 썼다", §D-2 인접
    실측 갱신 항목), 정작 **자신이 계속 편집한 바로 그 파일**을 근거로 삼는 형제 항목의
    숫자는 7라운드 동안 한 번도 재검산되지 않았다(`git diff` 로 확인: 해당 항목 텍스트는
    무편집).
  - 제안: `spec-draft-nullable-notation-followups.md:3332` 항목에 갱신 실측치(601/418/156/27)를
    추가하거나, 최소한 "이 plan 의 라운드들이 그 사이 더 키웠다" 는 한 줄을 덧붙여 다음
    착수자가 옛 수치(361)로 착수 여부를 판단하지 않게 할 것. `error-code-emission-axis` 라운드
    8(`/ai-review`+`--impl-done` 대기 중)에 함께 묶기 좋은 자리다 — 별도 라운드를 소비할
    필요 없이 이번 커밋 범위에 포함 가능.

## 요약

`error-code-emission-axis` plan 은 미해결 결정(카탈로그 backfill vs 메시지-접두 표기,
`CONTAINER_*` 6파일 spec 정정)을 일방적으로 내리지 않고 트래커에 양방향으로 위임했으며,
선행 plan(카탈로그 통합·LLM 코드 누락 3208, "한 턴에 묶어라" §1 합의)도 우회 없이 인용·존중하고
있다. 유일하게 발견된 갭은 CRITICAL 급 충돌이 아니라, 이 plan 이 반복해 스스로 지적해 온
"실측 없이 옛 숫자를 전재한다" 패턴이 **형제 트래커 항목의 수치**에 대해서는 아직 닫히지 않은
것이다 — 정합성 붕괴는 아니지만 다음 착수자를 오도할 수 있어 WARNING 으로 기록한다.

## 위험도
LOW
