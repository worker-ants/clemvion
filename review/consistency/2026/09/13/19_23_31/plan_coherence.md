# Plan 정합성 검토 — error-code-emission-axis (impl-done, scope=spec/conventions/)

## 발견사항

- **[WARNING]** `CONTAINER_MISSING_EMIT`·`CONTAINER_MULTIPLE_EMIT` 트래커 항목이 이번 diff 로
  완전히 해소됐는데 체크박스·해소 주석이 갱신되지 않았다
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` 의
    `<Callout type="warn">` 문장 정정 (diff: `...로 실행 실패해요` → `...메시지 앞에 붙어요 —
    전용 에러 코드는 없으니 코드가 아니라 메시지를 봐야 해요`, KO/EN 쌍)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3404
    (`- [ ] **CONTAINER_MISSING_EMIT·CONTAINER_MULTIPLE_EMIT 도 방출 코드가 아니다 (선재)**`)
  - 상세: 이 트래커 항목은 처분 선택지를 정확히 둘로 적어 두었다 — "(A) 문장을 '메시지에
    이 접두가 붙는다'로 정정, 또는 (B) 엔진이 전용 코드를 방출하도록(동작 변경 + spec)".
    이번 diff 는 정확히 (A)를 실행했고 (`guide-identifier-scan.ts` 의 신설
    `GUIDE_NON_EMITTED_VOCABULARY` 등록 사유에도 "이 배치에서 '메시지 앞에 붙어요'로
    정정했다"고 스스로 적었다), 두 파일(ko/en) 모두 반영됐다. 그런데
    `spec-draft-nullable-notation-followups.md` 라인 3404 항목은 여전히 `[ ]` 미해결 상태이고
    옛 문장("…로 실행 실패해요")을 현재형으로 그대로 인용하고 있어 이제 사실과 다르다.
    특히 이번 diff 는 **같은 파일**(`spec-draft-nullable-notation-followups.md`)을 이미
    수정했다 — 단 다른 항목(`--impl-prep` 컨텍스트 예산 초과 재현 기록, 옛 라인 4011 부근)에
    대해서만이고, 3404 항목은 손대지 않았다. 즉 파일을 열어 편집하는 와중에 바로 옆 완료된
    항목을 놓친 형태다. 새 plan `error-code-emission-axis.md` 도 이 트래커 항목을 "트래커
    3404 가 그 갈림을 이미 적어 두었다"고만 인용할 뿐, 그것을 닫는 조치를 체크리스트 항목으로
    명시하지 않는다. 이 plan 자신이 서두에서 "예고를 남긴 채 두면 다음 사람이 있지도 않은
    작업을 쫓는다"고 스스로 경계하는 바로 그 형태(완료된 항목이 미해결로 남아 다음 사람이
    이미 끝난 (A)/(B) 갈림을 다시 판단하게 됨)가 이 트래커 항목에서 재발한다.
  - 제안: `spec-draft-nullable-notation-followups.md` 라인 3404 항목을 `[x]` 로 체크하고
    "(A) 채택 완료 — `#<이 PR>` 가 KO/EN 문장을 '메시지 앞에 붙어요' 형태로 정정, `.code` 미방출은
    `GUIDE_NON_EMITTED_VOCABULARY` 등록으로 가드가 고정" 형태의 해소 주석을 추가한다. 같은 턴에
    처리하기 어렵다면 최소한 `error-code-emission-axis.md` 체크리스트에 "트래커 3404 를 닫는다"를
    명시적 항목으로 추가해, `/ai-review` + `--impl-done` 수렴 뒤 마무리 커밋에서 빠지지 않게 한다.

## 부차 관찰 (참고용, 별도 조치 불요)

- `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3386 (이 배치가 닫으려는
  본 항목 — "가이드 에러 코드 가드가 '존재'만 보고 '방출'을 안 본다")은 여전히 `[ ]` 이지만,
  `error-code-emission-axis.md` 자체 체크리스트의 마지막 항목(`/ai-review` + `--impl-done`
  수렴)이 아직 미완료이므로 지금 미체크인 것은 정상이다 — 완료 시점(플랜 이동)에 함께 체크할
  항목으로, 정합성 위반은 아니다. 다만 위 3404 항목과 **한 턴에 같이** 처리하는 편이 안전하다
  (두 항목이 같은 커밋으로 해소됐다).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3208
  (`3-error-handling.md §1` 카탈로그가 통합·LLM 코드 계열을 누락) 은 이 배치의 §B-2 가 실측한
  "미등재 28종 중 25종은 권한 밖" 판단과 정합한다 — target 이 이 미해결 planner 결정을
  침범하지 않고 명시적으로 우회(카탈로그를 "요구조건"이 아니라 "탈출구"로 쓰는 설계)했다.
  충돌 없음.
- `plan/in-progress/spec-conventions-engine-error-code-surface.md`(`error-codes.md` §Overview
  이분법 서술) 와 `plan/in-progress/harness-env-value-subpattern-dedup.md`(`.claude/hooks/*.py`
  정규식 중복)는 스코프가 겹치지 않는다 — 충돌·의존 없음.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3474
  ("`guide-identifier-scan.ts` 의 `lastIndex` 리셋 보일러플레이트가 4곳에 복제됐다")에 대해
  target 은 신규 정규식 3종을 `String.prototype.matchAll` 로 구현해 다섯 번째 복제를 만들지
  않았다고 스스로 밝히고, 실제 diff 도 `matchAll` 사용을 확인했다 — 해당 트래커 항목을
  악화시키지 않는다(항목 자체는 여전히 미해결·별도 스코프로 남아 있고 이는 정상).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 3247
  (`user-guide-evidence.md §2.1` 관계표에 신규 가드 등재 자리 미정 — planner 결정 대기)를
  target 이 건드리지 않는다(`spec_impact: none`, `spec/conventions/**` 델타 0과 일치). 이번
  diff 로 `guide-identifier-scan.ts`/`guide-identifier-existence.test.ts` 가 더 커졌지만
  이미 등재된 미결정 사안의 범위를 벗어나는 새로운 종류의 갭을 만들지는 않는다.

## 요약

이번 배치(`error-code-emission-axis`)는 자신이 닫으려는 트래커 항목(가드 존재-검사 한계,
`spec-draft-nullable-notation-followups.md` L3386)과 정합하게 설계됐고, 옆에 있는 미해결
planner 결정(카탈로그 완전성 L3208, 가드 등재 자리 L3247)을 침범하지 않고 명시적으로
우회했다 — "미해결 결정과의 충돌"과 "선행 plan 미해소" 축은 깨끗하다. 다만 "후속 항목
누락" 축에서 하나의 구체적 갭이 있다: 같은 diff 가 `CONTAINER_MISSING_EMIT`·
`CONTAINER_MULTIPLE_EMIT` 가이드 문장을 정정해 트래커 L3404 항목을 실질적으로 완전히
해소했음에도, 같은 세션이 바로 그 트래커 파일을 다른 항목 때문에 이미 편집했으면서도 L3404
체크박스는 갱신하지 않았다. 이는 이 plan 문서 자신이 명시적으로 경계하는 "완료된 결함을
미해결로 남겨 다음 사람이 헛수고하게 만드는" 패턴의 재발이며, 조치 자체는 한 줄 체크 +
해소 주석으로 가볍다.

## 위험도

LOW
