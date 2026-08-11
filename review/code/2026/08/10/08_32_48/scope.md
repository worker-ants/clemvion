# 변경 범위(Scope) 리뷰

## 조사 방법

프롬프트에 포함된 "전체 파일 컨텍스트"만으로는 무엇이 새로 추가/변경됐는지 판별할 수 없어(9개 파일 전부 `변경 유형: Review`, unified diff 섹션 없음, 파일 3은 1118줄 중 207줄까지만 표시), `git diff af2562ca3^..HEAD -- <9개 파일>`로 실제 diff를 직접 확인했다. 이 범위는 4개 커밋으로 구성된다:

- `af2562ca3` fix(harness): consistency 번들 — 드롭 자리 표식 + 브랜치-plan 티어 + diff 를 dump 앞으로
- `09b081578` fix(harness): 편집 중(미커밋) 문서가 번들 예산에서 탈락하던 결함
- `dc7bef76a` fix(harness): 같은 초에 생긴 세션 두 개가 한 디렉터리를 공유해 앞 세션이 덮이던 결함
- `62084e807` feat(harness): plan 라이프사이클 게이트 2종 — 완료 plan 의 미완 status + plan 내부 링크 무결성

## 발견사항

- **[INFO]** 리뷰 배치가 서로 독립적인 두 작업 트랙을 함께 묶고 있다.
  - 위치: 커밋 범위 전체 (`af2562ca3`~`62084e807`)
  - 상세: 앞의 3개 커밋은 `.claude/_shared/git_probe.py` · `.claude/skills/code-review-agents/lib/session.py` · `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`(consistency 번들/세션 파이프라인, `harness-consistency-summary-downgrade-rule.md` + `harness-review-gate-followups.md` 잔여 항목)를 다루고, 마지막 커밋(`62084e807`)은 이와 무관한 `spec-draft-secret-store-verification-footnote.md` 잔여 항목(plan 완료 상태 검증 + plan 링크 무결성 가드)을 다룬다. 각 커밋 자체는 자신의 커밋 메시지가 서술한 의도와 diff가 정확히 일치하지만(아래 참고), 9개 파일 전체를 하나의 스코프 리뷰 세션으로 묶어 검토하는 것은 서로 다른 두 plan 항목의 완료를 한 번에 push하는 이 저장소의 통상적인 배치 관행으로 보인다.
  - 제안: 문제는 없음 — 각 커밋이 개별적으로 self-contained 하므로 기록 목적의 정보성 관찰.

## 커밋별 diff-대-의도 대조 (문제 없음 확인)

- `.claude/_shared/git_probe.py`: `worktree_changed_files()` (263행) 단일 함수만 순수 추가. 기존 함수 수정 없음, import/설정 변경 없음. 커밋 메시지("미커밋 편집 탐지")와 정확히 일치.
- `.claude/skills/code-review-agents/lib/session.py`: `_MAX_SESSION_NAME_ATTEMPTS` 상수 + `create_session_dir`의 `exist_ok=True` → 원자적 `exist_ok=False` 재시도 루프로 교체. "같은 초 세션 충돌" 커밋 의도와 정확히 일치, 그 외 수정 없음.
- `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py`: 추가된 `_edited_rels`(260행) · `_named_in`(283행, 기존 인라인 조건을 두 티어에서 재사용하기 위한 최소 추출) · `prioritize_bundle_files` 시그니처 확장(295행, `branch_plan_text` 파라미터 + 티어 3→4 기계적 재번호) · `_splice_chunk`(355행) · `collect_context`의 `_n_on_topic` 헬퍼 및 diff 스플라이스 지점 변경(483행 부근) · `truncate_file_bundle`의 `stub_of` 중첩 헬퍼(777행 부근)는 모두 세 커밋(af2562ca3/09b081578)이 서술한 세 가지 결함(드롭 자리 표식·브랜치-plan 티어·diff 위치·미커밋 편집 인식)에 1:1로 대응한다. `import` 변경 없음. `-w`(공백 무시) diff가 일반 diff와 거의 동일해 포맷팅-only 변경 섞임도 없음.
- 테스트 3종(`test_consistency_bundle_priority.py`, `test_consistency_context_budget.py`, `test_review_session_dir_collision.py`)은 위 프로덕션 변경과 정확히 짝을 이루는 테스트만 추가/수정했다. `test_consistency_context_budget.py`의 `PlanFilesAreReadOncePerRunTest`(읽기 캐시 관련)는 `git log -S _READ_CACHE`로 확인 결과 이번 diff에 포함되지 않은 기존(#1099) 코드다 — 리뷰 대상에 잘못 포함된 것이 아니다.
- 프런트엔드 3파일(`spec-links.ts`의 `collectPlanMarkdown`/`findBrokenPlanLinks` 추가, 신규 `plan-link-integrity.test.ts`, `spec-plan-completion.test.ts`의 `claimsUnfinished`+두 describe 블록 추가)은 `62084e807`이 서술한 "plan 라이프사이클 게이트 2종" 그대로다. `KNOWN_BROKEN` 56쌍의 하드코딩 리스트는 ratchet 게이트 구조상 불가피한 baseline이며 기능 확장이 아니다.
- 설정 파일(`*.json`/`*.yml`) 변경 없음 확인.
- `.claude/tests/README.md` 1줄 추가는 신규 테스트 파일(`test_review_session_dir_collision.py`)의 인덱스 항목으로, 해당 파일과 짝을 이루는 문서 갱신이며 무관한 수정이 아니다(리뷰 대상 9개 파일에는 포함되지 않으므로 채점 대상은 아니지만 맥락 확인차 기재).

## 요약

9개 리뷰 대상 파일의 실제 diff를 커밋별로 대조한 결과, 요청/서술된 의도를 벗어난 추가 수정·불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 잡음·불필요한 주석/임포트 변경·의도치 않은 설정 변경 중 어느 것도 발견되지 않았다. 각 함수/헬퍼 추가는 해당 커밋이 서술한 구체적 결함(같은 초 세션 충돌, 미커밋 편집 누락, 드롭 표식 부재, 티어 신호 희석, diff 절단 위치, plan 상태-위치 불일치, plan 링크 rot)에 정밀하게 대응하며, 방대한 docstring/주석은 이 저장소 기존 파일들(`git_probe.py` 모듈 docstring 등)에서 이미 확립된 관례와 일치한다. 유일한 관찰점은 서로 다른 두 plan 항목(consistency 번들 계열 vs plan 라이프사이클 게이트 계열)이 하나의 리뷰 배치에 함께 실렸다는 점이나, 이는 이 저장소의 통상적인 배치-후-push 관행이며 개별 커밋의 self-containment를 해치지 않는다.

## 위험도

NONE
