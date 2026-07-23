# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** plan 문서 내 상위 요약 체크리스트가 섹션별 체크박스와 불일치
  - 위치: `plan/in-progress/harness-guard-followups.md` — diff 는 `## D. push 훅 main() 무테스트` 섹션의 개별 항목만 `[ ]` → `[x]` 로 변경(그리고 완료 서술 추가)했지만, 파일 하단 `## 체크리스트` 요약 목록의 `- [ ] D — push 훅 main() 테스트` 줄(전체 파일 컨텍스트 기준 858행 부근)은 diff hunk 밖이라 그대로 `[ ]` 로 남아 있음.
  - 상세: 이 diff 가 건드린 두 파일(`test_guard_review_before_push_main.py` 신규 추가, plan 섹션 D 완료 표기)은 모두 plan 항목 D("push 훅 `main()` 무테스트")가 요청한 범위와 정확히 일치한다 — 불필요한 추가 수정·리팩토링·무관한 파일 수정·포맷팅 혼입·주석/임포트 정리·설정 변경 등 "scope 이탈" 유형은 관찰되지 않았다. 다만 plan 파일 자체 내에서 동일 항목(D)의 상태 표기가 섹션 상세부와 하단 요약 체크리스트 간에 어긋나는 것은 "plan 체크박스 = 실제 상태" 규약(동일 커밋 내 완전 반영) 관점에서 완결성 결함이며, 엄밀히는 scope-reviewer 의 8개 관점(의도 이상 변경/리팩토링/기능확장/무관수정/포맷팅/주석/임포트/설정) 밖의 사안이라 CRITICAL/WARNING 이 아닌 참고용 INFO 로만 남긴다.
  - 제안: 같은 PR(또는 후속 커밋)에서 하단 `## 체크리스트`의 D 항목도 `[x]` 로 동기화.

## 요약

두 파일 모두 plan 항목 D("push 훅 `main()` 무테스트")가 정의한 범위와 정확히 일치한다. 신규 테스트 파일(`.claude/tests/test_guard_review_before_push_main.py`)은 기존 `.claude/tests/_harness.py`(`HOOKS_DIR` 등)·다른 훅 테스트들과 동일한 관례(임시 디렉토리에 훅 복사 + `_lib` 스텁 주입 + 실제 서브프로세스 실행)를 따르며, 스텁의 `evaluate_review`/`evaluate_plan` 반환 계약(`.blocked`/`.reason`, `.untouched`/`.reason`/`.plan_path`)은 실제 `guard_review_before_push.py` 의 계약과 정확히 일치해 테스트가 다른 계약을 가정하지 않는다. 20개 테스트 케이스는 plan 이 명시한 커버리지 항목(exit 0/2, push 미탐지, `input` 별칭, REVIEW→PLAN 순서, `BYPASS_*` 게이트별 격리, 예외/임포트 실패 fail-open, stdin 형태별 처리)에 1:1로 대응하며 그 이상의 기능·리팩토링·무관 코드 변경은 없다. `git diff --stat`(origin 기준 해당 커밋) 확인 결과도 정확히 이 두 파일만 변경됐다. 프로덕션 훅(`guard_review_before_push.py`) 자체는 무편집이며, import·포맷팅·주석·설정 파일 변경도 스코프 이탈 없이 신규 파일 컨텍스트에 국한된다. 유일한 참고 사항은 plan 파일 하단 요약 체크리스트와 섹션 상세 체크박스 간의 사소한 동기화 누락(INFO)뿐이다.

## 위험도
NONE
