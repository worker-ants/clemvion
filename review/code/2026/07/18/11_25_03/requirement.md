# 요구사항(Requirement) 리뷰 — 내부 패키지 등록 목록 4곳 drift 가드

## 검증 방법
정적 분석에 더해 실제 저장소 상태로 3가지를 실측했다:
1. `pnpm vitest run .../internal-package-registration.test.ts` → 35/35 PASS (현재 저장소 상태 기준 vacuous 아님).
2. `gh api repos/{owner}/{repo}/actions/permissions` → `enabled:false`, `gh run list --workflow=packages-checks.yml|harness-checks.yml` → 0건. 주석의 "Actions 꺼짐/inert" 주장이 사실과 일치.
3. **실측 mutation 2건**: (a) `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 에서 `"@workflow/node-summary"` 를 실제로 삭제 → `cmd_lint/cmd_unit/cmd_build` 3개 테스트가 정확히 그 패키지명을 지목하며 FAIL. (b) `packages-checks.yml` 의 `on.pull_request.paths` / `on.push.paths` 에서 동일 항목을 실제로 삭제 → 해당 2개 테스트가 정확히 그 차집합을 지목하며 FAIL. 두 mutation 모두 직후 원복 확인(`git status --short` clean). 가드가 "말로만 방지"가 아니라 실제로 #968 급 회귀를 잡는다는 것을 직접 재현으로 확인했다.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (예상된 결과)
  - 위치: 전 3개 파일 (`.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, 신규 테스트)
  - 상세: `spec/` 전체를 grep(`test-stages`, `INTERNAL_PACKAGES`, `packages-checks`, `run-test.sh`, `repo-guards`)했으나 매치 없음. 이 변경은 `.claude/` 하위 개발 하네스 도구(테스트 실행 스크립트·CI 워크플로·harness 자체 회귀 가드)이며, CLAUDE.md 의 정보 저장 위치 표에 따라 `spec/` 은 "제품 정의·기술 명세" 전용이고 하네스 규약은 `.claude/docs/`·`PROJECT.md` 영역이다. `PROJECT.md`·`.claude/docs/*.md` 에도 이 3파일에 대한 명시적 규약 문서가 없어 spec 불일치 판단 대상 자체가 아니다.
  - 제안: 조치 불요 (spec 영역 밖). 필요하다면 추후 `.claude/docs/` 에 이 4곳 drift 가드 관례를 문서화할 수 있으나 필수는 아님.

- **[INFO]** `explicitFilterCalls` 는 `pnpm --filter <pkg> <script>` 가 한 줄 안에 있을 때만 인식 (설계상 알려진 한계, 문서화됨)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts:498-504` (`explicitFilterCalls`)
  - 상세: 향후 누군가 가독성을 위해 `pnpm --filter X \\n  lint` 처럼 줄바꿈하면, 그 패키지가 실제로는 실행됨에도 가드가 "누락"으로 오탐해 CI/로컬 테스트가 red 가 된다. 이는 침묵하는 오검출(false negative, #968 급 결함)이 아니라 시끄러운 오탐(false positive) 방향이라 실제 안전 성질은 보존된다 — 주석에도 이 방향성을 명시적으로 인지하고 있다. 기능적 결함이 아니라 유지보수 시 알아둘 사항.
  - 제안: 조치 불요. 향후 test-stages.sh 를 리팩터링할 사람을 위해 그대로 두거나, 원한다면 이 가드 파일 헤더 주석에 "한 줄 유지" 제약을 명시적으로 못박아도 좋음.

- **[INFO]** 패키지 디렉터리에 `package.json` 이 없으면 `discoverPackages()`가 조용히 skip
  - 위치: `.../internal-package-registration.test.ts:410-421` (`discoverPackages`), `collectPackages` 주석 자체가 이 분기를 인지
  - 상세: `codebase/packages/<dir>/` 가 생성됐지만 아직 `package.json` 이 없는 과도기 상태라면, 그 디렉터리는 비교 모집단(`packages`)에서 자체가 제외돼 "등록 누락"으로 잡히지 않는다. 다만 `package.json` 없는 디렉터리는 pnpm workspace 도 패키지로 인식하지 않으므로(동일 판별 기준), 가드의 판정 기준이 pnpm 자체의 패키지 판별과 정합적이며 실질적 결함은 아니다.
  - 제안: 조치 불요.

## 요약
신규 테스트(`internal-package-registration.test.ts`)와 그에 연동된 두 파일(`test-stages.sh`, `packages-checks.yml`)의 헤더 주석 추가는 PR #968 급 회귀(신규 내부 패키지가 INTERNAL_PACKAGES/워크플로 paths·matrix 어느 한 곳에 등록되지 않아 조용히 무검증인 채 `status=PASS`)를 구조적으로 차단하려는 의도를 완전히 구현했다. 정적 검토만으로는 확인하기 어려운 "가드가 실제로 작동하는가"를 실측(현재 35/35 PASS, `gh api`/`gh run list` 로 Actions off·0-run 주장 검증, 두 축(`INTERNAL_PACKAGES`·`packages-checks.yml` paths)에 대한 실제 삭제 mutation → 정확한 FAIL 재현 → 원복)으로 직접 검증했고 모든 주장이 사실과 일치했다. vacuity 방지 테스트(파싱이 빈 값을 반환하지 않는지), 합성 fixture 를 통한 파서 순수 함수 회귀 고정, heredoc/중첩 브레이스 등 휴리스틱 한계에 대한 fail-loud 처리까지 방어적으로 설계돼 있다. TODO/FIXME 류 미완성 표식 없음, 함수명·주석과 실제 동작 일치, 모든 코드 경로에서 적절한 반환(빈 배열/throw/실제 목록)을 수행한다. 이 변경 영역은 `spec/` 로 정의된 제품 스펙이 아니라 `.claude/` 하네스 도구이므로 spec fidelity 관점에서는 대상 spec 문서가 없어 INFO 로만 기록했다(불일치 아님). 발견된 것은 전부 INFO 등급의 알려진·문서화된 설계상 한계이며 CRITICAL/WARNING 급 결함은 없다.

## 위험도
NONE
