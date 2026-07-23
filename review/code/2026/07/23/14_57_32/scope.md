# 변경 범위(Scope) 리뷰 — push guard allowlist redesign (재검토)

## 리뷰 대상 (origin/main 대비, 2 커밋: `6eec7cb80` 구현 + `837ebba33` CRITICAL 3건 수정)

1. `.claude/hooks/guard_review_before_push.py` — blind 1차 정규식(불변) + 열거된 allowlist(`_redact_inert_text`) 구현, C1/C2/C3 CRITICAL 수정 반영본
2. `.claude/tests/test_push_guard_allowlist.py` — 신규 차등 테스트(코퍼스 기반)
3. `plan/in-progress/harness-push-guard-subcommand-detection.md` — 이 작업 자체의 대상 plan (체크박스·구현 노트·CRITICAL 재현/수정 이력·worktree 필드)
4. `plan/in-progress/harness-guard-followups.md` — 별도 백로그 항목 C 의 선행조건 해소 주석
5. `review/code/2026/07/23/14_23_23/{RESOLUTION.md, SUMMARY.md, meta.json, _retry_state.json, architecture.md, documentation.md, maintainability.md, requirement.md, scope.md, security.md, side_effect.md, testing.md}` — 직전 `/ai-review` 라운드(구현 완료 직후 실행)의 산출물 12개

## 발견사항

- **[INFO]** 함수 경계 공백 줄 3개 (파일 전체 컨벤션은 2개) — 미수정 상태로 잔존
  - 위치: `.claude/hooks/guard_review_before_push.py:202-204` (`_blank_commit_heredocs` 종료 ~ `def _read_payload` 사이). 직접 확인: 정규식 `\n{3,}(?=def |class )` 스캔 결과 이 지점 포함 8곳 중 하나(원본 파일도 3곳은 기존에 이미 존재 — 이 파일 컨벤션이 완벽히 균일하지는 않았음).
  - 상세: 직전 리뷰(`review/code/2026/07/23/14_23_23/maintainability.md`, `scope.md`)가 동일 지점을 이미 INFO 로 지적했고, `RESOLUTION.md` 는 "스타일, 동작 영향 없음" 으로 명시적으로 미반영 처리했다. 실질 로직과 섞인 포맷팅 변경은 아니며(새 함수 삽입 경계에서 발생한 국소 아티팩트), 신규 도입된 다른 diff 라인들과 뒤섞여 리뷰를 방해하지 않는다.
  - 제안: 조치 불요(이미 의도적으로 defer 됨). 재지적 목적 아님 — scope 관점에서 "실질 변경과 섞인 포맷팅"에 해당하지 않음을 재확인.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 편집은 이 작업의 직접 표제(②/push-guard-allowlist)가 아니라 별도 백로그 항목(C, `guard_default_branch_bash.py` 판정 로직 공유)의 선행조건 상태를 갱신
  - 위치: `plan/in-progress/harness-guard-followups.md` §C 해당 hunk.
  - 상세: 이 문서는 원래 "C 는 ② 재설계 확정 후 착수 가능"이라고 명시하고 있었고, 이번 두 커밋이 바로 그 ②(설계 반전)를 확정·구현·검증했으므로 C 의 선행조건이 실제로 풀렸다는 사실을 그 문서에 반영한 것이다. 코드 동작에는 영향이 없는 순수 트래킹 갱신이며, C 자체의 구현 착수는 여전히 미체크 상태로 남아 있어 "몰래 다른 작업까지 처리"한 것도 아니다. 프로젝트 관례("plan 체크박스는 실제 상태를 반영해야 하고, 완료 시 해당 커밋에 반영")에 정확히 부합하는 방향이라 스코프 위반으로 판단하지 않는다.
  - 제안: 조치 불요.

## 스코프 내로 확인된 항목 (문제 없음)

- **핵심 구현이 대상 plan 과 1:1 대응**: `guard_review_before_push.py` 의 변경분은 `harness-push-guard-subcommand-detection.md` 가 사전에 정의한 설계("1차 blind 정규식 바이트 단위 불변 + `_redact_inert_text()` 3규칙: escaped pipe·`-m`/`--message=`/`-F` 인용 값·commit/tag 메시지 heredoc")와 정확히 일치한다. `_GIT_PUSH` 정규식 문자열 자체는 무변경(`test_blind_pattern_is_frozen` 으로 고정), `guard_default_branch_bash.py` 등 무관 훅·무관 함수(`main()`, `_REVIEW_MSG`, `_PLAN_MSG`)는 손대지 않았다.
- **CRITICAL 수정(두번째 커밋)도 표제 작업 범위 안**: `837ebba33` 은 첫 커밋이 도입한 `_MESSAGE_ARG`/`_is_git_push` 자체의 결함(C1 홑따옴표 오판정·C2 ReDoS·C3 unmask)만 수정한다 — 새 기능이나 무관 영역 확장이 아니라, 같은 함수의 버그 수정이다.
- **신규 import 없음**: `guard_review_before_push.py` diff 에는 신규 import 문이 전혀 없다(`re` 는 기존에 이미 import 됨). `test_push_guard_allowlist.py` 는 신규 파일이므로 자체 import(`re`, `subprocess`, `sys`, `time`, `unittest`, `_harness`)가 있으나 전부 파일 내에서 실사용됨(`subprocess`+`time`→ReDoS 하드 타임아웃 테스트, `_harness`→모듈 로더) — 불필요한 import 없음.
- **review/code/2026/07/23/14_23_23/\* 12개 파일은 "무관한 파일" 이 아니라 이 작업 고유의 산출물**: CLAUDE.md 가 "구현 완료 후 `/ai-review` + Critical/Warning `resolution-applier` fix 는 상시 승인된 강제 의무"로 명시하고, `review/` 디렉터리는 gitignore 대상이 아니라 SUMMARY·RESOLUTION 도 커밋 대상이라는 것이 이 프로젝트의 정착된 관례다(developer SKILL §REVIEW WORKFLOW). 이 12개 파일은 정확히 이 두 커밋(②구현 + CRITICAL 수정)에 대한 첫 `/ai-review` 라운드의 기록이며, "요청 이상의 문서 확장"이 아니라 표준 워크플로 산출물이다. router 가 제외한 6개 리뷰어(performance/dependency/database/concurrency/api_contract/user_guide_sync)의 출력 파일이 diff 에 없는 것도 `_retry_state.json`/`meta.json` 의 `agents_forced`/제외 사유와 정합적이다.
- **설정 파일 변경 없음.**
- **포맷팅/주석이 실질 로직과 뒤섞여 리뷰를 방해하는 패턴 없음**: 신규 주석은 전부 이 설계의 근거·SoR 링크·실패 이력 설명으로, "왜 이렇게 짰는가"를 코드 옆에 남기라는 프로젝트 관례에 부합한다.

## 요약

두 커밋(초기 구현 + CRITICAL 3건 수정)과 그에 딸린 plan 갱신 2건·`/ai-review` 산출물 12건을 포함한 총 16개 파일 전부가 "push 가드 오탐 해소(blind 정규식 유지 + 열거된 allowlist)"라는 단일 작업 항목(plan ②)에 수렴한다. 핵심 코드 변경은 대상 plan 문서가 사전에 정의한 설계·검증 항목과 정확히 매핑되고, 두번째 커밋은 그 코드 자체의 버그 수정일 뿐 새로운 영역 확장이 아니다. `harness-guard-followups.md` 편집은 다른 백로그 항목이지만 이번 결정의 직접적 인과 효과를 정직하게 기록한 트래킹 갱신이며, `review/code/2026/07/23/14_23_23/*` 산출물은 이 프로젝트가 구현 직후 강제하는 표준 리뷰 워크플로의 정상 산물이다. 요청 이상의 리팩토링·기능 확장·무관한 파일 수정·불필요한 import·의도치 않은 설정 변경은 발견되지 않았다. 유일한 흠은 함수 경계 공백 줄 1개 과다(파일 전체 관례상 이미 완벽히 균일하지 않았고, 실질 변경과 섞이지 않은 순수 스타일 nit)로, 직전 리뷰에서 이미 INFO 로 지적·의도적으로 defer 된 사안이다.

## 위험도

LOW
