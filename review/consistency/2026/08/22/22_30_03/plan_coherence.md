# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 검토 범위 및 방법

이번 PR(`masked-marker-plan-close-d8edad`, `origin/main` 대비 3커밋)의 실제 diff 는
`spec/5-system/**` 파일을 **한 글자도 건드리지 않는다**(`git diff origin/main...HEAD -- spec/`
결과 0). 변경은 (1) `codebase/backend/.../executions.service.ts` 의 순수 private-helper
추출 리팩터(`reRun` 141줄 → 109줄, `resolveManualOverrideInput` 신설, 동작 무변경), (2) 정본
트래커 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 체크박스 갱신, (3)
`plan/in-progress/masked-marker-test-gaps.md` → `plan/complete/` 이동 + 잔여 체크박스 완료,
(4) 신규 `plan/complete/rerun-input-resolution-extract.md` 추가로 구성된다. `spec_impact: none`
프런트매터와 diff 실측이 일치한다.

이를 근거로 (a) 정본 트래커 전문(3,700줄 프롬프트 중 §"진행 중 plan 문서 모음" 절 전체,
budget 내 온전히 포함됨), (b) `plan/complete/masked-marker-*.md`·`rerun-input-resolution-extract.md`
원본, (c) 다른 63개 `plan/in-progress/*` 파일 중 `reRun`/`resolveTriggerParametersRejectingMasked`/
`masked-reject-callers-guard` 식별자를 참조하는 파일 유무(grep 전수, 0건 — 자기 자신 제외)를
확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO] 이월 항목 종결 처리가 트래커와 정합** — target 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:824-836`
  (`ExecutionsService.reRun` 137줄·6책임 항목). 이 PR 이 유일하게 실제로 닫은 트래커 항목이며,
  트래커가 등재 시점에 적어 둔 처방("다음에 손댈 때 입력 해석 블록을 private 헬퍼로")을
  문면 그대로 집행했다(`plan/complete/rerun-input-resolution-extract.md`). 같은 절의 나머지
  이월 항목 4건(`findMaskedResubmissions` 단위 테스트 부재·`13-replay-rerun.md` 401 코드 drift·
  `swagger.md §3` 길이-예외·`execute` DTO 부재)은 각각 명시적 유예 근거(재판정된 커버리지
  분석, `spec/` 편집이 developer 권한 밖이라는 CLAUDE.md 역할 분리, 컨트롤러 시그니처 변경
  범위 초과)를 달고 `[ ]` 로 남아 있다 — 미해결 결정을 우회하지 않고 정확히 남겨야 할 것만
  남겼다.
- **[INFO] `13-replay-rerun.md` 401 코드 drift 항목의 출처·소유권 표시 일관** — 이 항목은
  같은 세션의 `21_53_41` 라운드에서 `convention_compliance` 가 WARNING 으로 등재한 것을
  트래커에 그대로 이관한 것이며, 이번 라운드의 `naming_collision`·`rationale_continuity`
  체크도 동일하게 "이미 별도 planner 항목으로 이관됨 · 본 PR 범위 밖" 으로 판정해 중복
  계상하지 않았다(교차 확인). 세 체크의 판정이 상호 정합적이다.
- 다른 63개 `plan/in-progress/*` 문서(node-output-redesign 하위 24개 포함) 중 이번 diff 가
  건드리는 식별자(`reRun`/`resolveManualOverrideInput`/`resolveTriggerParametersRejectingMasked`/
  `masked-reject-callers-guard`)를 참조하는 파일은 자기 자신(`spec-sync-external-interaction-api-gaps.md`)
  외에 없다 — 후속 항목 누락 가능성 있는 교차 참조 없음.
- `plan/complete/masked-marker-test-gaps.md` 이동은 남은 두 체크박스(TEST WORKFLOW 4단계·
  `/ai-review`)를 이번 PR 안에서 완료해 붙였고, `plan-lifecycle.md §3`("이동만 담은 별 PR
  분리 금지")를 스스로 인용하며 그 규칙을 지켰다고 명시 — plan 라이프사이클 규약과도 정합.

## 요약

이번 PR 의 실질 변경은 spec 텍스트 무변경의 순수 리팩터이고, 유일하게 닫은 트래커 항목은
등재 시점 처방을 그대로 집행한 것이며, 함께 닫지 않은 나머지 이월 항목들은 전부 "왜 지금
안 하는가" 근거(권한 범위·구조적 비용)를 명시한 채 열어 뒀다. 미해결 결정을 일방적으로
확정하거나, target 이 가정하는 선행 조건이 아직 안 풀린 상태에서 진행한 흔적, 다른 plan 의
후속 항목을 무효화하고 반영을 누락한 흔적 어느 것도 발견되지 않았다.

## 위험도

NONE
