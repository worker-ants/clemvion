# 변경 범위(Scope) 리뷰

## 확인한 범위
커밋 `f450fca25`(`fix(harness): C won't-do 종결 + default-branch 넛지의 세그먼트 미검사 FN 해소`)의
`git show --numstat`을 직접 조회해 prompt payload 의 6개 파일과 정확히 일치함을 확인했다(추가 파일 없음,
누락 파일 없음). 즉 리뷰 대상 파일 목록 자체가 이번 커밋의 전체 diff 와 1:1 로 일치한다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 코드 주석이 plan 문서 절 번호를 직접 인용
  - 위치: `.claude/hooks/guard_default_branch_bash.py` 65행 (`# ... See harness-guard-followups §C for why the two hooks / # deliberately do NOT share detection code.`)
  - 상세: 해당 주석이 `plan/in-progress/harness-guard-followups.md`의 `§C`를 절 번호로 직접 지칭한다. plan 문서가 향후 재구성·이동되면 주석이 참조를 잃을 수 있다. 다만 이는 스코프 위반이 아니라 유지보수성 관점의 사소한 결합도 이슈이며, 이 저장소의 기존 훅 파일들도 유사하게 PR/리뷰 경로를 주석에 남기는 관행을 따른다(하우스 스타일과 일치).
  - 제안: 스코프상 조치 불필요. 참고로만 기록.

## 스코프 대조

이번 커밋이 다루는 의도된 작업은 plan 문서 자체(`harness-guard-followups.md` §C)에 명시된 두 가지다: (1) `_redact_inert_text` 공유 제안(item C)을 실측 근거로 won't-do 종결, (2) 그 실측 과정에서 발견한 반대 부호 결함(세그먼트 미검사로 인한 false negative) 수정. 6개 변경 파일 전부가 이 두 가지에 직접 대응한다.

- `.claude/hooks/guard_default_branch_bash.py` — 핵심 수정. `_SEGMENT_SPLIT` 도입 + `_is_mutating`을 세그먼트 단위로 재작성 + `_MUTATING` 정규식에 `VAR=value` 접두 스킵 추가. plan 체크리스트에 명시된 항목("&&/||/;/|/개행으로 세그먼트 분할 + VAR=value 접두 허용")과 정확히 일치하며, 그 외 로직 변경(예: 무관한 함수 리팩토링, 새 기능 추가)은 없다. 추가된 주석 블록도 전부 이번 변경(앵커링 근거, 세그먼트 분할 이유, 의도적으로 수용한 잔여 오탐)을 설명하는 내용으로, 무관한 주석 손질이 아니다.
- `.claude/tests/test_guard_default_branch_bash_mutating.py` (신규) — 위 수정에 대한 테스트. 기존 동작(무오탐 클래스, read-only 침묵, 간접실행 미분류)과 신규 동작(세그먼트 분할, env 접두) 양쪽을 커버하며 범위를 벗어나는 무관한 검증은 없다.
- `.claude/tests/README.md` — 신규 테스트 파일 1행 등재. 이 저장소는 `test_tests_readme_catalog.py`로 카탈로그 누락을 가드하므로, 새 테스트 파일 추가 시 이 갱신은 선택이 아니라 필수 동반 수정이다. 무관한 행 변경 없음.
- `.claude/docs/worktree-policy.md` — D 정책 설명 문단 1곳만 수정, 코드 변경(세그먼트 분할·VAR= 스킵·의도적 잔존 오탐)을 정확히 미러링한다. 이 문서는 본 훅 정책의 SSOT 로 CLAUDE.md 에 명시돼 있어, 코드 동작이 바뀌면 함께 갱신하는 것이 규약이다. 무관한 절 수정 없음.
- `plan/in-progress/harness-guard-followups.md` — 이번 작업이 직접 추적하는 in-progress plan. §C 본문에 won't-do 결론과 근거, 신규 발견 결함과 해소 방법을 기록하고, 하단 `## 체크리스트`의 C 항목도 동기화했다(본문·체크리스트 양쪽 갱신 — 프로젝트 컨벤션 그대로 준수).
- `plan/complete/harness-push-guard-subcommand-detection.md` — 이미 완료된 plan 에 4행만 추가해 "여기서 만든 `_redact_inert_text` 공유 제안이 won't-do 로 닫혔다"는 상호 참조를 남긴다. 완료된 문서를 사후에 건드리는 점이 눈에 띌 수 있으나, 그 문서의 §C 관련 서술이 이번 결정의 근거이자 대상이므로 상호 참조 추가는 이번 작업의 직접적 산출물이다. 원 내용을 재작성하거나 무관한 절을 고치지 않았다(순수 append).

## 요약
리뷰 대상 6개 파일은 plan 문서(`harness-guard-followups.md` §C)가 명시한 "item C won't-do 종결 + 세그먼트 미검사 FN 해소"라는 단일 작업 범위와 정확히 일치한다. `git show --numstat`으로 커밋 전체 diff 를 독립적으로 대조한 결과 리뷰 payload 에 없는 추가 변경도, payload 에는 있으나 실제 커밋에 없는 파일도 없었다. 핵심 코드 변경(세그먼트 분할 + VAR= 접두)과 그에 직접 종속된 테스트·문서·plan 동기화만 포함돼 있으며, 무관한 리팩토링·포맷팅·임포트·설정 변경, 요청 이상의 기능 확장은 발견되지 않았다.

## 위험도
NONE
