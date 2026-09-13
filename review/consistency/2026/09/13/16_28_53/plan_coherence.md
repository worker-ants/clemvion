# Plan 정합성 검토 — plan_coherence

## 검토 범위

- target: `spec/conventions/` (impl-done, diff-base `origin/main`). 이 scope 자체의 델타는 0개
  파일 — 실제 변경은 `codebase/frontend/src/lib/docs/__tests__/guide-{error-code→identifier}-*`
  리네임·확장, `plan/in-progress/guide-identifier-existence.md`(신규),
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신),
  `PROJECT.md`·`CHANGELOG.md` 가드 카탈로그 갱신.
- 대조 대상: `plan/in-progress/**` 전체(특히 `guide-identifier-existence.md` 자신과
  `spec-draft-nullable-notation-followups.md` 트래커), `spec/conventions/user-guide-evidence.md`,
  `spec/conventions/cafe24-api-metadata.md`.
- 절대경로 워킹트리(`git -C .../guide-identifier-existence`)에서 `git log`·`git diff
  origin/main...HEAD`·`grep -rn`으로 직접 실측했다.

## 발견사항

이번 라운드에서 plan 정합성 관점의 CRITICAL/WARNING 은 없다. 확인한 근거는 다음과 같다.

- **미해결 결정 우회 없음**: target(`spec/conventions/user-guide-evidence.md §2`)은 여전히
  가드 3건(`impl-anchor-existence`·`integrations-coverage`·`triggers-coverage`)만 나열하고
  `guide-identifier-existence`/`guide-sanitized-message-parity`를 언급하지 않는다. 이는 새로운
  drift 가 아니라 `plan/in-progress/guide-identifier-existence.md` §D#1·#2 가 스스로 "developer
  권한 밖이라 planner 항목으로 남긴다"고 명시한 상태 그대로다(체크리스트 §D 헤더의 경고문 참고).
  developer 가 spec 을 일방적으로 고쳐 결정을 선점하지 않았다.
- **트래커(`spec-draft-nullable-notation-followups.md`) 갱신이 실제로 반영됨**: `git diff
  origin/main...HEAD -- plan/in-progress/spec-draft-nullable-notation-followups.md` 로 확인.
  `guide-error-code-*` → `guide-identifier-*` 리네임이 해당 트래커의 5개 인용 지점 전부에
  반영됐고, "허용목록 없음" 원칙 번복 근거·Rationale 요구 문구도 함께 추가됐다(§D#1·#2 처분과
  정확히 일치). `cafe24-api-metadata.md §4` Principle 7→0 오인용도 신규 planner 항목으로
  트래커에 추가됐고 중복 등재는 없다(`grep -n "Principle 7\|오인용"` 1곳).
  이미 완료 처리한 항목("가이드가 적는 식별자... 가드가 없다")은 취소선 + 번복 근거를 남긴 채
  `[x]`로 정확히 전환됐다.
- **참조처 정리 완료**: 리네임 대상으로 plan 이 명시한 두 참조처(`PROJECT.md` 가드 카탈로그,
  트래커 전방 참조) 모두 새 이름으로 갱신 확인. 저장소 전체(`grep -rln "guide-error-code"`)에
  남은 참조는 `plan/complete/guide-error-code-truth.md`(역사 기록, 의도적 보존), 과거 리뷰
  산출물(`review/**`, 불변 스냅샷), 그리고 코드 내부 "리네임 전 이름" 각주 2곳뿐 — 전부 plan이
  스스로 "역사 서술은 이름을 보존한다"고 선언한 대상과 일치한다. 갱신 누락은 없다.
  `node-output-redesign/cafe24.md`(Principle 7 = config echo 로 정확히 사용)와도 충돌하지 않고
  오히려 §D#4 진단(§4 의 Principle 7 오인용)을 뒷받침한다.
- **다른 in-progress plan 과의 충돌 없음**: `spec-conventions-engine-error-code-surface.md`·
  `harness-review-gate-followups.md`·`spec-sync-common-gaps.md`·
  `spec-sync-external-interaction-api-gaps.md` 등에서 `guide-identifier`/`guide-error-code`/
  `user-guide-evidence` 관련 언급이 없어 이번 변경이 무효화하거나 새로 만들어야 할 후속 항목이
  다른 plan 에 남아 있지 않다. `harness-env-value-subpattern-dedup.md`의 "사용자 결정 대기" 항목은
  완전히 다른 서브시스템(push/nudge 훅)이라 무관하다.
- **체크리스트 완료 표시의 정직성**: `/ai-review` + `--impl-done spec/conventions/` 라운드 6은
  `- [ ]`로 미체크 상태로 남아 있고, 완료 기준("`codebase/**` 수정 0으로 끝나는 라운드")이 본문에
  명시돼 있다 — plan 이 스스로 지적한 "두 PR 연속 거짓 체크" 재발이 이번엔 관측되지 않는다.

## 요약

target(`spec/conventions/`) 자체는 이번 브랜치에서 변경되지 않았고, 실제 구현 변경(가드 리네임·
백틱 전수 축 추가·`GUIDE_EXTERNAL_VOCABULARY` 허용목록)은 `spec/conventions/user-guide-evidence.md
§2`가 아직 반영하지 못한 상태다. 그러나 이는 developer 가 일방적으로 결정을 내리거나 선행 조건을
무시한 결과가 아니라, plan(`guide-identifier-existence.md`)이 자신의 권한 경계(§자기-반증형
소정정 예외 미해당)를 명시적으로 인정하고 `spec-draft-nullable-notation-followups.md` 트래커에
정확한 위치·범위로 등재한 상태다. 리네임에 따른 참조처 갱신도 누락 없이 완료됐고, 부수적으로 발견한
`cafe24-api-metadata.md §4` Principle 오인용도 무관한 선재 결함으로 올바르게 분리 등재됐다. 다른
in-progress plan 과의 충돌이나 무효화된 후속 항목도 발견되지 않았다.

## 위험도

NONE
