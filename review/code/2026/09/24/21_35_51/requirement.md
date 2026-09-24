# 요구사항(Requirement) 리뷰: docs-guard-trigger

## 검증 방법

저장소를 직접 뮤테이션하지 않고, `Read`/`Grep`/scratch 스크립트(`/private/tmp/.../scratchpad/run_old.sh`,
`run_new.sh`)로 다음을 실측했다. 작업 종료 시 `git status --short` 확인 — 이번 세션 출력 디렉터리
(`review/code/2026/09/24/21_35_51/`) 외에 저장소 변경 없음.

- `scripts/ci-paths-changed.sh` 를 CI 와 동일한 방식(`GITHUB_EVENT_NAME=pull_request`,
  `PR_BASE_SHA=89f67c040^`, `PR_HEAD_SHA=89f67c040`, 해당 커밋은 `plan/complete/deps-audit-floor-refresh-2026-09.md`
  1파일만 바꾼 순수 plan-only 커밋임을 `git show --stat` 로 확인)으로 옛/새 pathspec 각각 실행
  → **옛 `relevant=false` / 새(= `plan/**` 추가) `relevant=true`**. plan 문서 §D 의 표와 정확히 일치.
- `pnpm --filter frontend test src/lib/docs/__tests__/` 직접 실행 → **23 files / 3567 tests, 4.05s**.
  RESOLUTION/plan 이 주장한 "23파일 3567개, 수 초" 와 정확히 일치 — "lightweight 트리거" 불변식이
  현재 시점엔 실제로 유지됨을 확인.
- `python3 -m pytest .claude/tests -q` → **1140 passed, 1257 subtests passed**. plan/RESOLUTION 의
  claim 과 일치.
- `python3 -m pytest .claude/tests/test_spec_link_checks_scope.py -q` → 2 passed / 2 subtests.
  `test_harness_checks_paths_coverage.parse_pathspecs_block` 을 실제로 **import** 하는지(재구현 아님)
  소스 확인 완료.
- `grep -n spec-link-integrity .claude/tests/test_workflow_yaml_structure.py` → 262행에서 job id 를
  `if:` 앵커로 고정하는 것을 확인 — 워크플로 주석의 "잡 이름은 required check 앵커로 설계됐다" 는
  근거 있는 서술.
- `review/consistency/2026/09/24/21_04_26/meta.json` 을 직접 열어 `target_path`/`scope_note` 가
  RESOLUTION.md Warning 1 조치대로 저장소 상대경로 + 정정 사유로 남아 있음을 확인.

## 발견사항

- **[INFO]** "가벼운 대체 트리거" 불변식이 코드/테스트로 강제되지 않고 관례로만 유지됨 (round-1
  architecture/INFO #4 와 동일 사안, 재확인만)
  - 위치: `.github/workflows/spec-link-checks.yml` — `spec-link-integrity` job 의 `run:` 스텝
    (`pnpm --filter frontend test src/lib/docs/__tests__/`)
  - 상세: 디렉터리째 실행으로 바꾼 근거는 "그 디렉터리는 가볍다"는 현재 실측(4.05초)이며, 이는
    round-1 에서 이미 INFO 로 분류·기록됐고 이번 라운드 실측으로도 유지되는 것을 확인했다. 새 결함
    아님 — spec 본문에도 이 불변식을 강제하는 조항은 없어(회색지대) INFO 유지가 타당하다.
  - 제안: 조치 불요. round-1 RESOLUTION 의 처분과 동일.

- **[INFO]** plan 체크리스트의 `[ ] /ai-review`, `[ ] 트래커 항목 체크 + plan complete/ 로` 는
  여전히 미체크
  - 위치: `plan/in-progress/docs-guard-trigger.md` 체크리스트 섹션
  - 상세: 이 리뷰 자체가 `/ai-review` 항목의 수행이므로 정상적인 in-progress 상태이며 괴리 아님.
    트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:5100`)의 해당 항목도 현재
    미체크 상태와 일치 — plan 종결 시 동시에 처리되어야 할 항목(체크박스+`complete/` 이동은 한
    동작)이라는 점만 상기.
  - 제안: 조치 불요, plan 종결 커밋에서 함께 처리.

## 요약

핵심 기능 변경(`spec-link-checks.yml` pathspec 에 `plan/**` 추가 + 파일 열거 대신 디렉터리 전체
실행)은 plan `docs-guard-trigger.md` 가 서술한 결함·처방과 line-level 로 정확히 일치하며, 관련 spec
(`spec/conventions/spec-impl-evidence.md` §4.2 의 `spec-link-integrity.test.ts` 스캔 범위 —
`codebase/{backend,frontend,channel-web-chat,packages}`·`spec/**.md`·`plan/**` 내부 링크·거버넌스
문서)과도 pathspec 목록이 정확히 대응한다. plan 이 주장한 두 실측(과거 plan-only 커밋에서
`relevant=false→true` 전이, 디렉터리 실행 시 23파일/3567테스트/수 초)을 이번 리뷰에서 독립적으로
재실행해 **모두 정확히 재현**했다. 신설 회귀 테스트 `test_spec_link_checks_scope.py` 는 두 회귀 형태
(pathspec 의 `plan/**` 부재, 단일 파일 실행 회귀)를 이름으로 고정하고 있고 실제로 통과하며, 파서를
재구현하지 않고 기존 `parse_pathspecs_block` 을 import 해 재사용한다. `CHANGELOG.md`/`PROJECT.md`
동반 갱신도 실제 구현 범위와 정확히 일치한다(과장·축소 없음). 직전 1라운드 리뷰(`21_16_58`)가 지적한
Warning 4건은 RESOLUTION.md 대로 실제 커밋(`32b97f944`)에 반영돼 있음을 파일 대조로 확인했다. 이번
독립 재검토에서 새로운 Critical/Warning 급 요구사항 결함은 발견되지 않았다. TODO/FIXME/HACK 주석
없음, `spec_impact: none` 은 이번 변경이 `spec/**` 파일을 전혀 건드리지 않는다는 사실과 일치한다.

## 위험도
NONE
