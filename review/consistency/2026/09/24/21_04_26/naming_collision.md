# 신규 식별자 충돌 검토 — docs-guard-trigger (`--impl-prep spec/conventions`)

## 검토 범위 확인

target 은 plan `plan/in-progress/docs-guard-trigger.md` 이며, 구현 대상은 `spec/` 문서가 아니라 `.github/workflows/spec-link-checks.yml` (CI workflow) 이다. 계획된 변경은 두 가지뿐이다.

1. `changes` job 의 `pathspecs` 목록에 `plan/**` 추가
2. `spec-link-integrity` job 의 실행 커맨드를 `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` (단일 파일) 에서 `codebase/frontend/src/lib/docs/__tests__/` 디렉터리 전체 실행으로 확장

이 변경은 새로운 요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, webhook/queue/sse 이벤트명을 전혀 도입하지 않는다. `spec/conventions/spec-impl-evidence.md` 는 이번 변경으로 내용이 바뀌지 않고(이미 존재하는 `id: spec-impl-evidence` 그대로), 새 spec 파일도 생성되지 않는다. 따라서 관점 1~4 는 해당 사항 없음.

## 발견사항

- **[INFO]** job 이름 `spec-link-integrity` 재사용은 이미 의도적으로 검증된 비-충돌 사례
  - target 신규 식별자: 없음 — plan 은 새 이름을 만들지 않고 **기존** job 이름 `spec-link-integrity` 를 그대로 유지한 채 스코프만 넓힌다.
  - 기존 사용처: `.github/workflows/spec-link-checks.yml:70` (job id) 및 `.claude/tests/test_workflow_yaml_structure.py:262` (`("spec-link-checks.yml", "spec-link-integrity")` 튜플로 `if:` 조건을 강제하는 등록부).
  - 상세: 변경 후 이 job 은 `spec-link-integrity.test.ts` 단일 가드가 아니라 `__tests__/` 디렉터리 전체(plan-frontmatter·spec-frontmatter·spec-code-paths 등)를 돈다. 이름과 실제 동작 범위가 어긋나지만, 이는 **새 식별자 충돌이 아니라** `test_workflow_yaml_structure.py` 가 이 이름을 required-check 등록 앵커로 고정하고 있어(plan 본문 §B 가 이미 인지) 이름을 바꾸면 harness 가드를 깨기 때문에 의도적으로 유지하는 것이다. 다른 곳에서 `spec-link-integrity` 라는 이름이 다른 의미로 쓰이고 있지 않음을 확인했다 — grep 상 유일한 사용처가 이 workflow job id 뿐이다.
  - 제안: 충돌은 아니므로 변경 불필요. 다만 이름이 "링크 무결성만 검사한다" 는 오해를 줄 수 있으므로, job 정의부 주석(현재도 있음, L70 인접)에 "이름은 유지되지만 §4.2 전 가드를 포함한다" 를 한 줄 남겨두면 향후 리더의 혼동을 줄일 수 있다(강제 아님).

- **[INFO]** `plan/**` pathspec 은 다른 workflow(`e2e.yml`)에도 이미 존재 — 충돌 아님
  - target 신규 식별자: `spec-link-checks.yml` 의 `changes` job `pathspecs` 리스트에 추가되는 `plan/**` 항목.
  - 기존 사용처: `.github/workflows/e2e.yml:25,33` 가 이미 동일한 glob `plan/**` 를 자신의 trigger paths 에 갖고 있음.
  - 상세: GitHub Actions pathspec 은 전역 유일 식별자가 아니라 각 workflow 가 독립적으로 참조하는 필터 값이므로, 여러 workflow 가 같은 glob 을 갖는 것은 정상이며 의미 충돌이 없다(오히려 `e2e.yml` 선례가 "plan 변경도 관련 있다" 는 기존 관행과 일치).
  - 제안: 조치 불필요.

- **[INFO]** (참고, 이 리뷰 범위 밖) `PROJECT.md:382` 의 수동 실행 커맨드가 이번 변경 후 stale 해질 수 있음
  - target 신규 식별자 아님 — 새 식별자를 만들지 않으므로 엄밀히는 naming-collision 범주 밖이지만, 인접 정보라 기록해 둔다.
  - 기존 사용처: `PROJECT.md` §문서 링크 검증 절이 `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` (단일 파일 커맨드)를 "CI 가 강제한다" 는 문장과 함께 명시.
  - 상세: workflow 커맨드가 디렉터리 전체 실행으로 바뀌면 이 라인은 실제 CI 커맨드와 더 이상 일치하지 않게 된다. 식별자 충돌은 아니지만 문서-구현 정합성 문제이므로 다른 관점(문서 동기화)의 checker 나 구현 체크리스트에서 함께 갱신 권장.
  - 제안: 구현 시 이 라인도 디렉터리 실행 커맨드로 함께 갱신.

## 요약

이번 target(plan `docs-guard-trigger.md` → `.github/workflows/spec-link-checks.yml` 변경)은 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수/설정키·신규 spec 파일 경로 중 어느 것도 새로 도입하지 않는다. 유일하게 재사용되는 식별자(`spec-link-integrity` job 이름)는 harness 가드(`test_workflow_yaml_structure.py`)가 요구하는 안정성 때문에 의도적으로 유지되는 것이며 plan 본문(§B)이 그 근거를 이미 명시했으므로 충돌이 아니다. `plan/**` pathspec 추가도 다른 workflow 의 선례와 형태가 같아 문제없다. 새 식별자 충돌 관점에서는 차단 사유가 없다.

## 위험도
NONE
