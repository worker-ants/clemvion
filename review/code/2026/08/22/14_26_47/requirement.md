STATUS=success requirement review complete — 0 CRITICAL, 0 WARNING, 3 INFO
===REPORT_MARKDOWN_BELOW===
# 요구사항(Requirement) 리뷰 — repo-guards.yml 신설 + backend 미러 가드 사본 삭제

## 조사 방법

diff 31개 파일 중 실질 코드/설정 변경 10개(파일 1~10)를 정독하고, 나머지 21개(파일
11~31)는 `review/code/2026/08/22/14_02_49/**`·`review/consistency/2026/08/22/13_20_18/**`
직전 라운드 산출물이 신규 파일로 커밋된 것임을 확인했다(프로젝트 규약상 `review/` 는
gitignore 대상이 아니라 이력으로 남긴다) — 기능 검토 대상은 파일 1~10 이다. 다음을 실제로
실행해 주장을 실측했다:

- `.claude/tests/test_required_check_skip_jobs.py` + `test_workflow_yaml_structure.py`
  전체 실행 — **17건 + 13건 = 30건 GREEN**. (1회차는 `__pycache__` stale 로 3건
  false-FAIL 이 났다 — `find .claude/tests -name __pycache__ -exec rm -rf {} +` 후
  재실행하니 GREEN. 캐시 문제였지 코드 결함 아님, `pathspecs_of("repo-guards.yml")` ·
  `filter_covers_file` 을 개별 호출해도 4스택 전부 매치를 직접 재확인했다.)
- `pnpm --filter frontend exec vitest run masked-marker-mirror.test.ts
  typescript-toolchain.test.ts` — **44건 GREEN**.
- `grep -rn "masked-marker-mirror-guard\|masked-marker-mirror.spec"
  codebase/backend/src` — 0건(삭제 후 잔존 참조 없음). `codebase/backend/src/repo-guards/
  __tests__/` 디렉터리에 8개 파일이 남아 빈 스위트로 안 죽음.
- `grep -rn "masked-marker-mirror\|repo-guards" spec/` — 0건 → 이 영역을 규정하는 spec
  본문이 없다(`spec_impact: none` 정확).
- `typescript-toolchain-guard.ts:173`(`path.join(ROOT, dir, "package.json")`)과
  `typescript-toolchain.test.ts:56`(`expect(dirs).toContain("codebase/channel-web-chat")`)
  을 직접 읽어 `frontend-checks.yml` 의 `codebase/channel-web-chat/**` 복원 근거(RESOLUTION
  WARNING 1)가 실제 소스와 line-level 로 일치함을 재확인.

## 발견사항

- **[INFO]** 직전 라운드(`14_02_49`)가 지적한 WARNING 2건이 이번 diff 에서 실제로
  해소됐음을 코드 레벨로 확인.
  - 위치: `.github/workflows/frontend-checks.yml:44`-`54`(pathspec 복원 + 근거 주석 교체),
    `.claude/tests/test_required_check_skip_jobs.py:171`-`208`
    (`test_repo_guards_pathspec_covers_every_stack` 신설)
  - 상세: (1) WARNING 1 — `codebase/channel-web-chat/**` pathspec 을 되돌리고 근거를
    "미러 가드가 이 잡에 산다" → "`typescript-toolchain` 가드가 이 경로의 `package.json`
    을 읽는다" 로 갈아 끼웠다. 그 근거를 소스로 직접 대조하면 정확하다(`typescript-toolchain-
    guard.ts:173`·`typescript-toolchain.test.ts:56` 실측). (2) WARNING 2 — "`codebase/**`
    가 backend·frontend·packages·channel-web-chat 4 스택을 전부 덮는다" 는 이 워크플로의
    존재 이유를 검증하는 전용 assertion 을 추가했고, `in_stack` vacuous 방지까지 포함해
    실행 시 4 스택 전부 통과(GREEN)한다.
  - 제안: 없음 — 이미 반영됨. 기록 목적.

- **[INFO]** repo-guards.yml 의 skip-job 계약이 형제 워크플로(`frontend-checks.yml` 등)와
  동형이고 하네스 레지스트리 4곳에 빠짐없이 등재됨을 실행으로 확인.
  - 위치: `.github/workflows/repo-guards.yml` 전체(신규), `.claude/tests/
    test_workflow_yaml_structure.py:260,294,365,418`, `.claude/tests/
    test_required_check_skip_jobs.py:60`
  - 상세: `needs: changes` + `if: ${{ !cancelled() }}` + 모든 스텝 `if:` 게이팅 + no-op
    안내 스텝 + `paths:` 필터 부재 + `permissions: contents: read` 패턴이 다른 8개 전환
    워크플로와 정확히 같은 형태다. `test_job_conditions_are_registered`·
    `test_step_conditions_are_registered`·`test_pull_request_trigger_shape_is_registered`·
    `test_every_workflow_declares_its_permissions`·`test_the_two_registries_agree` 전부
    통과해, 등록 누락이 있었다면 이 시점에 이미 RED 였을 것이라는 plan 의 주장과 일치한다.
  - 제안: 없음.

- **[INFO]** 관련 spec 본문 부재(spec fidelity, 점검 관점 9) — `spec/` 전체에서
  `masked-marker-mirror`·`repo-guards.yml` 문자열이 0건이다(재실측). 이 PR 의 영역(CI
  워크플로 구조·테스트 하네스 사본 통합)은 `spec/` 소관이 아니라 `plan/in-progress/
  mirror-guard-single-copy.md`(`spec_impact: none`)로 충분하다. CRITICAL 대상 아님.
  - 위치: `spec/` (일치하는 문서 없음)
  - 제안: 없음.

## 요약

`repo-guards.yml` 신설 + backend 미러 가드 사본 2파일(`masked-marker-mirror-guard.ts`/
`.spec.ts`, 총 354줄) 삭제는 `plan/in-progress/mirror-guard-single-copy.md` 가 서술한
설계·검증 기준과 코드가 정확히 일치한다. 직전 라운드(`14_02_49`)가 남긴 WARNING 2건 —
(1) `channel-web-chat` pathspec 제거의 단일 소비처 판단, (2) 핵심 불변식("전 스택 커버")의
1회성 수동 실측 의존 — 모두 이번 diff 에서 코드로 해소됐고, 두 수정 모두 실제 소스 대조와
테스트 실행(하네스 17+13건, frontend vitest 44건, 전부 GREEN)으로 재검증했다. backend 사본
삭제 후 잔존 참조 없고, frontend 쪽 캐너리 9종은 형태·내용 그대로 유지된다. spec 본문이
이 영역을 규정하지 않아 spec fidelity 위반도 없다. TODO/FIXME/HACK/XXX 류 미완성 표식도
없다. Critical/Warning 급 요구사항 결함은 발견되지 않았다.

## 위험도

NONE
