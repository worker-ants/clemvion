# 변경 범위(Scope) 리뷰

## 리뷰 대상

1. `.claude/hooks/guard_review_before_push.py` — blind 정규식 + 열거된 allowlist(`_redact_inert_text`) 구현
2. `.claude/tests/test_push_guard_allowlist.py` — 신규 차등 테스트 (17건)
3. `plan/in-progress/harness-guard-followups.md` — 후속 백로그 문서 갱신 (② 항목 해소 표기 → C 착수 가능 주석)
4. `plan/in-progress/harness-push-guard-subcommand-detection.md` — 이 작업의 대상 plan 문서 자체 (체크박스·구현 노트·worktree 필드 갱신)

## 발견사항

- **[INFO]** 함수 사이 공백 줄 3개(파일 내 다른 모든 top-level def/class 경계는 전부 2개)
  - 위치: `.claude/hooks/guard_review_before_push.py:189-191` (`_blank_commit_heredocs` 종료 ~ `def _read_payload` 사이)
  - 상세: `python3 -c` 로 전체 파일의 `\n{2,}(def |class )` 경계를 스캔한 결과, 이 지점만 개행 3개(빈 줄 2개가 아니라 3개)이고 나머지 7곳은 전부 2개. diff 상 `pos = max(body_end, m.end())` 뒤에 `+` 로 빈 줄 1개가 추가되고 기존 컨텍스트 빈 줄 1개가 남아 있는데, 원본에는 원래 빈 줄이 2개였을 가능성이 있어(구현자가 신규 함수 블록을 삽입하며 경계 정리를 놓친 것으로 보임) 결과적으로 파일 전체 컨벤션(2줄)과 어긋나는 국소 아티팩트가 생겼다.
  - 제안: 빈 줄 1개 제거해 파일 전체 컨벤션(2줄)에 맞춘다. 기능에는 영향 없는 순수 스타일 nit.

- **[INFO]** `plan/in-progress/harness-guard-followups.md` 편집은 이 PR 의 직접 대상(②/push-guard-allowlist)이 아니라 **다른 백로그 항목(C, `guard_default_branch_bash.py` 판정 로직 공유)**의 상태를 갱신한다
  - 위치: `plan/in-progress/harness-guard-followups.md` §C (해당 diff hunk)
  - 상세: 이 문서는 "C 는 ② 재설계 확정 후 착수 가능"이라고 이미 명시하고 있었고, 이번 변경이 바로 그 ②(설계 반전) 를 확정·구현했으므로 C 의 선행조건이 풀렸다는 사실을 그 문서에 반영한 것 — 논리적으로 인과관계가 있고 코드 동작에는 영향 없는 순수 트래킹 갱신이다(C 자체의 구현 착수는 아직 미체크). 다만 이번 PR 의 표제 작업(push guard allowlist 자체)과는 별개 문서·별개 항목이라는 점에서 "요청 이상의 문서 확장"으로 보일 여지가 있다. Critical 은 아니며, 프로젝트 관례(plan 체크박스=실제 상태, 완료 시 해당 커밋에 반영) 에 부합하는 방향이라 문제로 보지 않는다.
  - 제안: 별도 조치 불요. 리뷰어 판단 참고용 기록.

## 스코프 내로 확인된 항목 (문제 없음)

- 코드 변경(`guard_review_before_push.py`)은 대상 plan(`harness-push-guard-subcommand-detection.md`)이 명시한 "1차 blind 정규식 바이트 단위 불변 + `_redact_inert_text()` 3규칙(escaped pipe·`-m`/`--message=`/`-F` 인용 값·commit 메시지 heredoc)" 과 정확히 1:1 대응한다. `_GIT_PUSH` 정규식 자체는 문자열 그대로 유지되고(테스트 `test_blind_pattern_is_frozen` 이 동결 확인), `guard_default_branch_bash.py` 등 다른 훅·무관 함수(`main()`, `_REVIEW_MSG`, `_PLAN_MSG`)는 손대지 않았다.
- 신규 임포트 없음(`re` 는 기존에 이미 임포트됨). 불필요한 import 정리/추가 없음.
- 테스트 파일은 이번 기능 전용 신규 파일로, 다른 테스트나 무관 모듈을 건드리지 않는다.
- `plan/in-progress/harness-push-guard-subcommand-detection.md` 갱신은 이 작업 자체의 대상 plan 문서이므로 당연히 포함되어야 하는 범위(체크박스 완료 표기, `worktree` 필드, 구현 요약) 이다.
- 포맷팅/주석 변경이 실질 로직 변경과 뒤섞여 리뷰를 방해하는 패턴은 관찰되지 않음(신규 주석은 전부 이 설계의 근거 설명으로, 반복된 반려 이력(SoR 링크)을 코드에 남기라는 프로젝트 관례에 부합).
- 설정 파일 변경 없음.

## 요약

변경 4개 파일 모두 "push 가드 오탐 해소(blind 정규식 + 열거된 allowlist)"라는 단일 의도에 밀접하게 수렴한다. 코드·테스트는 대상 plan 문서가 사전에 정의한 설계·검증 항목과 1:1로 매핑되고, 무관한 리팩토링·기능 확장·불필요한 임포트·설정 변경은 발견되지 않았다. 유일한 흠은 함수 경계의 공백 줄 1개 과다(순수 스타일, 파일 컨벤션과의 국소 불일치)와, 이번 결정의 파급효과로 다른 백로그 문서(C 항목)의 상태 주석을 함께 갱신한 것인데 후자는 인과관계가 명확한 트래킹 업데이트라 스코프 위반으로 보지 않는다.

## 위험도

LOW
