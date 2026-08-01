# API 계약(API Contract) 리뷰 — round 3

## 스코프 판정

이번 changeset(8개 파일: `.claude/tests/README.md`, `.claude/tests/test_block_integrity.py`,
`.claude/tests/test_review_gate_ci.py`, `.claude/tests/test_stop_guard_failopen.py`,
`.github/workflows/harness-checks.yml`, `.github/workflows/review-gate.yml`,
`plan/in-progress/harness-review-gate-ci-backstop.md`, `scripts/check-review-gate.py`)는 전부
**harness(내부 CI/git-hook 자동화 레이어)** 코드다 — `.claude/hooks/_lib/review_guard.py` 의
`evaluate_review()` 를 GitHub Actions PR 이벤트로도 호출하는 훅-독립 백스톱, 그 백스톱을 검증하는
unittest, 관련 워크플로 YAML, 진행 plan 문서다.

`codebase/backend`·`codebase/frontend` 등 REST/HTTP API 서빙 코드, 컨트롤러, 라우터, 스키마,
OpenAPI 정의는 이 changeset에 전혀 포함되지 않는다 (`grep -n -iE "endpoint|@(Get|Post|...)|controller|swagger|openapi|res\.status|fetch\(|axios"` 전수 확인 — 매칭 0건, `.md` 본문의 관점 체크리스트 항목 문구 자체 외 히트 없음). `review-gate.yml` / `check-review-gate.py` 가 다루는 것은 GitHub PR 이벤트를 트리거로 삼아 로컬 push-hook 과 **같은 함수**를 호출하는 CI 백스톱이지, 외부에 노출되는 API 엔드포인트가 아니다.

**해당 없음, 위험도 NONE.**

---

## 참고: 스코프 밖 관측 (보고 의무에 따른 기록)

작업 중 `git status` 확인 결과 예상 밖의 변경이 있어 프롬프트 지시(“Report any unexpected `git status` rather than fixing it”)에 따라 그대로 기록한다. API 계약 관점의 판정에는 영향 없음 — **워킹트리를 수정하지 않았다.**

```
modified:   scripts/check-review-gate.py
```

```diff
+# control case: local Name-to-Name alias of a disallowed call
+join = os.walk
+join('review')
```

이는 `test_review_gate_ci.py` 의 "One judge" import+call allowlist 가드가 로컬 별칭(alias)
경유 호출(`join = os.walk; join(...)`)을 잡아내는지 검증하려는 뮤테이션 테스트로 보인다. round 2 에서
지적된 "소스 파일이 리뷰 도중 변형되는" 현상과 동일 패턴이며, 프롬프트가 "이제 중단됐다"고 명시한 그
행위가 이번 round 3 세션의 워킹트리에도 남아 있다는 뜻이다. 코드 리뷰어 본인이 만든 변경이 아니며,
지시에 따라 원상 복구도 시도하지 않았다.

---

## 요약

이번 diff 는 harness 자체의 CI 백스톱(리뷰 커버리지 게이트를 GitHub PR 이벤트로도 트리거)과 그 회귀
테스트/워크플로 YAML/plan 문서로 구성되며, 외부 또는 내부 REST API 표면(엔드포인트, 요청/응답
스키마, 버전 관리, 페이지네이션, 인증/인가)을 다루는 코드가 전혀 없다. API 계약 리뷰어의 8개 점검
관점 중 어느 것도 적용 대상이 존재하지 않아 리뷰를 수행할 근거가 없다. 별도로, 워킹트리에서
`scripts/check-review-gate.py` 에 미커밋 상태의 예상 밖 변경(가드 우회 뮤테이션 실험으로 보이는
alias 삽입)이 관측되어 수정 없이 그대로 보고한다.

## 위험도

NONE

---

STATUS=success ISSUES=0
