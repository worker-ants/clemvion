# Plan 정합성 검토 — `spec/conventions/` (impl-done, diff-base `origin/main`)

## 검토 범위 재확인

`git diff origin/main...HEAD -- spec/conventions/error-codes.md` 실측: `spec/conventions/`
스코프 델타는 **`error-codes.md` §Overview "적용 범위" 문단 1건**뿐이다(신규 2문단 삽입, 기존
문장 1곳 수정, `③ historical-artifact` §3 표는 미변경). 이 세션은 동일 브랜치의 5번째
`--impl-done` 라운드다 — 직전 라운드(`review/consistency/2026/09/01/23_17_23/plan_coherence.md`)
가 이미 이 target 을 NONE 판정했고, 그 사이 커밋(`b5d2e6972`→`9c0028371`→`8218dbb29`→
`7829dbd61`→`628f0b071`, `/ai-review` 1R~5R fix)이 `error-codes.md` 를 두 차례 더 건드렸다.
그 두 편집을 재검증하고 직전 라운드의 결론이 여전히 성립하는지 확인했다.

## 발견사항

### [INFO] 1R·3R 의 추가 wording 편집도 §Overview 범위를 벗어나지 않는다 — 재확인

- target 위치: `spec/conventions/error-codes.md` §Overview "적용 범위" 문단
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` 할 일 1번째 항목
- 상세: 직전 라운드 이후 `9c0028371`(1R)이 "대표 surface" → "대표 surface 중 하나. 나머지
  하나는 아래 문단 참조"로, `8218dbb29`(3R)이 그 괄호를 다시 "중 하나)"로 되돌리는 두 번의
  손질을 했다(리뷰어가 "6R draft 스냅샷과 커밋 문구가 축어적으로 다르다"고 지적한 데 대한
  대응). `git diff origin/main...HEAD -- spec/conventions/error-codes.md` 로 최종 상태를
  재확인한 결과 여전히 §Overview 신설 2문단(같은 파일·자매 const·경계 비대칭)만 있고 §3
  예외 레지스트리(§3 `AbortError`/`WORKER_HEARTBEAT_TIMEOUT` 행 포함)는 미변경이다. plan
  체크리스트가 요구하는 "존재·자매 관계·키 disjoint 만 적고 목적지 매핑은 SoT 로 보낸다"는
  접근과 여전히 일치한다.
- 조치 불요.

### [INFO] `spec-update-node-cancellation-shutdown-classification.md` 의 "나란히 가는 plan" 경고 — 이번 라운드에도 미실현

- target 위치: `spec/conventions/error-codes.md` §3 예외 레지스트리 `AbortError` 행
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md` "나란히 가는
  plan" 절(두 plan 이 같은 파일을 편집하면 서로의 문단을 덮을 수 있다는 경고) ·
  `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(그 문서의
  `error-codes.md §3` 위임 항목은 2026-07-27 에 별도로 이미 이행 완료 — 문서 최상단 배너 및
  §3 `AbortError` 행에 근거 명시)
- 상세: 직전 라운드와 마찬가지로 이번 diff 도 §3 표를 손대지 않아 clobber 는 발생하지 않았다.
  그 plan 의 최상위 미해결 (a)/(b) 택일 결정(SIGTERM/timeout 유발 abort 를 `failed` 유지 vs
  `cancelled` 재정의)은 여전히 미결이지만, 그 결정 영역(§1 카탈로그·NodeExecution 상태 분류)과
  이번 target 편집(§Overview 대표 surface 서술)은 겹치지 않는다.
- 조치 불요.

### [INFO] 코드 diff 동반 신규 가드(`stray-tool-tags.test.ts`)의 `spec-impl-evidence.md §4.2` 미등재 drift — 계속 추적 중, 신규 아님

- target 위치: `spec/conventions/spec-impl-evidence.md §4.2`("build 차단 4건" 표 — 실측 여전히
  4건, `stray-tool-tags.test.ts` 미등재)
- 관련 plan: `plan/in-progress/harness-review-gate-followups.md` "신규 가드를
  `spec-impl-evidence.md §4.2` SoT 에 등재"(리뷰 1R documentation W5, 여전히 미체크)
- 상세: `spec/conventions/` 스코프 델타는 `error-codes.md` 하나뿐이라 `spec-impl-evidence.md`
  자체는 이번 diff 에 없다. 신규 가드는 §4.2 규약상 등재 대상이지만, "이 PR 은 spec 축이
  이미 과하게 묶였다"(같은 리뷰 scope W1)는 근거로 의도적 유예 중이며 재개 신호(다음 harness
  가드 추가 시)도 plan 에 명시돼 있다. 직전 라운드 대비 상태 변화 없음 — 이번 라운드에서
  두 번째 harness 가드(`skipDir`/링크 통합층 보강 등)가 같은 PR 안에서 여럿 추가됐지만
  `harness-review-gate-followups.md` 는 이들을 §4.2 등재 대상으로 새로 인지하지 않았다(모두
  build-차단 가드가 아니라 기존 `spec-links.test.ts` 보강이라 §4.2 표 대상 자체가 아님 — 실측:
  `stray-tool-tags.test.ts` 만 신규 `describe` 블록으로 독립된 build-차단 스위트).
- 제안: 조치 불요. 다만 "다음 harness 가드 추가 시" 재개 신호가 이번에도 다시 유예됐으므로
  (누적 2회째), 세 번째 유예 시점부터는 이 항목의 등급을 WARNING 으로 올릴 근거가 쌓인다.

### [INFO] developer 트랙 fix-round 커밋이 planner 트랙 spec 문장을 재편집한 경위 — 자기-반증형 소정정 예외를 쓰지 않았다고 스스로 명시, 근거는 성립하나 최초 도입 커밋이 harness 코드와 한 커밋에 뒤섞여 있다

- target 위치: `spec/conventions/error-codes.md` §Overview 신설 문단 (최초 도입 커밋 `b5d2e6972`)
- 관련 plan: `plan/in-progress/spec-conventions-engine-error-code-surface.md`(owner:
  project-planner) · CLAUDE.md "자기-반증형 소정정" 5조건
- 상세: 이 문단의 **최초 도입**은 `docs(spec):` 류 단독 커밋이 아니라 `b5d2e6972
  "fix(harness): 가드 사각지대 3곳 + plan 이동 절차의 빠진 방향"` 라는 harness 백로그 5건
  묶음 커밋 안에 섞여 들어갔다(stray-tool-tags 가드·checkbox 정규식·링크 통합층·
  plan-lifecycle 규칙과 동일 커밋). 이어진 1R/3R 리뷰 fix 커밋도 같은 wording 을 두 차례
  더 편집했다. commit `00fc56488`(2R) 본문은 "이 편집은 CLAUDE.md 자기-반증형 소정정 예외를
  쓴 것이 아니라, draft 가 `--spec` 6라운드를 통과해 planner 트랙에서 이미 승인된 범위이고
  fix 커밋은 diff 를 그 draft 에 맞춘 것"이라 스스로 근거를 밝혔고, "게이트는 `--impl-done`
  을 이 파일 포함 scope 로 돌려 사후 그물도 통과시킨다"고 덧붙였다 — 실제로 이번 세션이 그
  `--impl-done` 사후 그물이며, `spec-conventions-engine-error-code-surface.md` 체크리스트도
  6라운드 `--spec` 이력을 정확히 인용한다. 즉 **결과적으로는 CLAUDE.md 가 요구하는 안전망
  (사후 `--impl-done`)을 실제로 통과하고 있어 절차 위반으로 단정할 근거는 없다.**
- 다만 CLAUDE.md 의 다섯 조건은 "developer 자신이 쓴 예고 문장의 자기-반증"에 좁게 정의돼
  있고, 이번 케이스("같은 브랜치에서 이미 planner 승인된 spec 문구를 developer 트랙 fix
  라운드가 wording 만 다듬는다")는 그 다섯 조건 중 어느 것에도 명시적으로 대응하지 않는
  **제3의 패턴**이다. CLAUDE.md 가 경계하는 "실측했으니 고쳤다는 만능 통행증"과 형태가
  다르지만(실측 반증이 아니라 리뷰어 지적 반영), 관례로 굳으면 같은 논리가 더 넓게 재사용될
  여지가 있다.
- 제안: 이번 target 자체를 막을 사안은 아니다(조치 불요) — 다만 project-planner 가 향후
  이 패턴을 규칙화할지(예: "planner 승인 spec 문구에 대한 wording-only fix 는 developer 트랙
  에서도 가능하되 `--impl-done` scope 필수"를 CLAUDE.md 에 명문화) 판단할 가치가 있는 INFO
  로 등재한다.

## 요약

target(`spec/conventions/error-codes.md` §Overview 두 surface 병기)의 최종 diff 는 여전히
`spec-conventions-engine-error-code-surface.md` 의 체크리스트·"최종 접근"(존재·자매 관계·키
disjoint 만 서술, 목적지 매핑·판단 기준은 SoT/유보로 위임)과 문자 그대로 일치한다. 직전
`--impl-done` 라운드(`23_17_23`) 이후 발생한 두 차례 wording 편집(1R·3R)도 §Overview 범위를
벗어나지 않아 §3 표를 겨눈 `spec-update-node-cancellation-shutdown-classification.md` 의
clobber 경고는 이번에도 미실현이고, 그 plan 의 상위 미해결 (a)/(b) 결정과도 영역이 겹치지
않는다. 동반 코드 변경(`stray-tool-tags.test.ts`)의 `spec-impl-evidence.md §4.2` 미등재
drift 는 `harness-review-gate-followups.md` 에 근거·재개 신호와 함께 계속 정확히 추적되고
있어 "후속 항목 누락"에 해당하지 않는다(다만 유예 누적 2회째로 다음 라운드부터 WARNING 격상
후보). 유일하게 새로 짚을 점은 이 spec 문단의 최초 도입이 harness 코드 커밋 하나에 뒤섞여
있었다는 절차적 특이점인데, CLAUDE.md 가 요구하는 사후 안전망(`--impl-done`)을 실제로
통과하고 있어 CRITICAL/WARNING 급 결정 충돌이나 미반영 후속으로 격상할 근거는 없다.

## 위험도

NONE
