# RESOLUTION — §D push 훅 main() 테스트

리뷰: `review/code/2026/07/23/13_02_46/SUMMARY.md` — RISK=MEDIUM, Critical 0, **Warning 3**.
forced(router_safety) 7명 전원 결과 확보(`forced_missing: []`).

## Warning (3) — 전부 반영

| # | 카테고리 | 조치 |
|---|----------|------|
| 1 | Documentation | **docstring 이 거짓 전제를 심었다.** "`_is_git_push` 는 이미 두텁게 테스트됨" 은 plan 본문의 stale 서술을 그대로 옮긴 것인데, **실측 확인 결과 사실이 아니다** — 근거였던 `test_push_detection.py`(44-케이스)는 커밋 `3c6547b4d`("push 가드 서브커맨드 재작성 철회")에서 **621줄 통째로 삭제**됐고, 현재 `.claude/tests/` 에서 `_is_git_push` 를 참조하는 테스트는 **0건**이다. → docstring 을 "이 파일은 `main()` 오케스트레이션만 검증하며, `_is_git_push` 자체는 전용 테스트가 없다(구 스위트 철회됨). 그 갭은 backlog ② 가 추적한다" 로 정정. 테스트가 의도적으로 모호하지 않은 명령(`git push …`/`git status`)만 쓰는 이유도 명시. |
| 2 | Documentation | `import _harness  # noqa: F401 … REPO_ROOT used below` — 실제로는 `HOOKS_DIR` 만 쓴다(다른 테스트 파일에서 복사하며 딸려온 문구). `HOOKS_DIR used below` 로 정정. |
| 3 | Requirement / Documentation / Scope | plan 하단 `## 체크리스트` 의 `- [ ] D` 가 본문 §D 완료 표기와 **같은 파일 안에서 모순**(A·F 는 양쪽 동기화됨). `- [x] D — push 훅 main() 테스트 (별건 PR)` 로 동기화. |

## INFO 중 반영한 것

- INFO #6 (Maintainability/Testing): stub 이 실제 `PlanDecision` 의 부분집합만 미러링 →
  스텁 위에 "의도적으로 좁다; `main()` 이 읽는 필드만 모델링하며, 계약이 늘면 조용한
  기본값이 아니라 `AttributeError` 로 fail-loud" 주석 추가.

## INFO 중 미반영(사유)

- **INFO #3 — non-dict top-level JSON stdin(`"[]"`, `"null"`)이 `payload.get()` 에서
  `AttributeError`.** 실재하는 크래시 경로가 맞다. 다만 하네스 계약상 non-0/non-2 exit 은
  **fail-open** 이라 실질 영향은 없고, 제대로 고치려면 훅의 `_read_payload()` 를 손봐야 하는데
  §D 는 **테스트 전용 항목**이라 scope 오염이 된다(scope reviewer 도 "plan 항목 D 와 정확히
  일치" 로 판정). 후속 후보로 기록만 한다.
- INFO #1 (fail-open traceback 노출): 기존 동작을 pin 한 것이며 plan **§E(fail-open 정책
  사용자 결정)** 가 이미 추적 중. §E 확정 시 테스트도 함께 갱신 대상.
- INFO #2/#4/#5 (import 진단 비대칭 pin, 두 게이트 동시 raise, `tool_input`/`input` 우선순위):
  선택적 대칭성 보강. Critical·Warning 0 수렴 원칙상 추가 churn 하지 않는다.
- INFO #7 (`.claude/tests/README.md` 카탈로그 누락): **선재 drift**(이미 6개 파일 미등재).
  이 diff 의 신규 회귀가 아니며, 근본 해결은 README-vs-실제파일 자동 가드로 별건.

## 검증

- `python3 -m unittest test_guard_review_before_push_main` → 20 tests OK.
- 리뷰어가 뮤테이션(게이트 순서 스왑·BYPASS 누출·예외 미포착)을 **독립 재현**해 테스트가 실제로
  회귀를 포착함을 확인 — plan 의 뮤테이션 검증 주장이 사실로 교차 확인됐다.
- 이번 수정은 docstring·주석·plan 체크리스트뿐이라 테스트 동작 변화 없음.
