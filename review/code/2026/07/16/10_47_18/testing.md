# Testing Review — commit b9c162cd1 (`scripts/check-e2e-playwright-config.py` + harness test)

리뷰 대상: `git diff HEAD~1..HEAD` — `scripts/check-e2e-playwright-config.py`(신규 260L),
`.claude/tests/test_check_e2e_playwright_config.py`(신규 227L, 11 tests), `.github/workflows/e2e.yml`
(config-guard job 신설), `.github/workflows/harness-checks.yml`(paths 등재), Dockerfile/compose
comment-only 변경.

로컬에서 `python3 -m unittest discover -s .claude/tests -p 'test_check_e2e_playwright_config.py' -v`
11개 전부 통과 확인(`RealRepoSmokeTest.test_real_repo_is_consistent` 포함, 실제 repo 정합 확인).

## 발견사항

- **[CRITICAL]** compose 마스킹 정규식이 실제 YAML `volumes:` 리스트 항목이 아니라 **파일 전체 텍스트**를
  대상으로 하는 unanchored substring search 라, 주석에 경로 문자열이 남아 있으면 실제로는 제거된 마스킹을
  "존재한다"고 오판(false negative)한다 — 정확히 이 가드의 존재 이유("compose 마스킹 목록은 누락돼도
  조용히 통과한다")를 막지 못하는 케이스이며, 테스트로 전혀 커버되지 않는다.
  - 위치: `scripts/check-e2e-playwright-config.py:52-54`(`_COMPOSE_MASK_RE`), `:156-159`
    (`compose_mask_dirs`)
  - 상세: 재현 완료(로컬 스크립트 실행). `node-summary` 마스킹 라인을 삭제하고 그 자리에
    "# historically also masked /app/codebase/packages/node-summary/node_modules but removed,
    see PR#123" 같은 주석만 남긴 fixture 로 `guard.check(root)` 를 호출하면 `[]`(위반 없음)를
    반환한다 — 실제로는 `node-summary` anonymous volume 마스킹이 없어 호스트 macOS 네이티브
    바이너리가 컨테이너로 새는 정확히 그 버그 클래스가 발생했는데도 가드가 통과시킨다. 동일한
    문제가 반대 방향(마스킹이 실제로는 주석 처리돼 비활성인데 정규식이 텍스트만 보고 활성으로
    카운트)에도 적용된다.
  - 제안: `_COMPOSE_MASK_RE` 를 실제 리스트 항목 라인에만 매치하도록 앵커링한다(예:
    `^\s*-\s*/app/codebase/packages/([A-Za-z0-9._-]+)/node_modules\s*$` + `re.MULTILINE`,
    Dockerfile COPY 정규식이 이미 `^COPY...`로 하는 것과 동일 패턴). 그리고 "주석에 마스킹 경로가
    있어도 무시돼야 한다"/"주석 처리된 마스킹 라인은 카운트되면 안 된다" 케이스를 `ParserTest`에
    추가한다.

- **[WARNING]** `_BASE_TAG_RE`(base 이미지 태그 파서)는 `_DOCKERFILE_COPY_RE`와 달리 `^`/`re.MULTILINE`
  라인 시작 앵커가 없어, `FROM mcr.microsoft.com/playwright:vX.Y.Z-tag` 문자열을 언급하는 **주석**이
  실제 `FROM` 지시문보다 앞에 있으면 그 주석의 태그를 먼저 매치해 버린다(false version-mismatch 실패
  또는 우연히 false pass 가능).
  - 위치: `scripts/check-e2e-playwright-config.py:52-54`(`_BASE_TAG_RE`), `:80-87`
    (`base_tag_major_minor`, `text.search()` 사용 — Dockerfile 전체 스캔)
  - 상세: 재현 완료. `"# changelog: previously FROM mcr.microsoft.com/playwright:v1.55.0-jammy,
    upgraded later\nFROM mcr.microsoft.com/playwright:v1.61.0-jammy\n"` 텍스트에 대해
    `_BASE_TAG_RE.search()` 가 실제 `FROM` 이 아니라 주석 속 `v1.55.0` 을 먼저 반환한다. 현재 실제
    Dockerfile 헤더 코멘트에는 완전한 `FROM ...` 문자열이 없어 당장 실사고는 없지만, 향후 changelog
    주석 스타일이 추가되면 silent breakage.
  - 제안: `^FROM\s+mcr\.microsoft\.com/playwright:v(\d+)\.(\d+)\.\d+-\w+` + `re.MULTILINE` 로
    앵커링. `base_tag_major_minor`/`frontend_playwright_version` 의 "파일 없음"·"태그 매치 실패"
    branch(모두 `check()`의 `resolved is None` / `base is None` failure 경로)도 테스트가 전혀
    없다(아래 INFO 참고).

- **[WARNING]** `pkgname_to_dir`/`frontend_workflow_closure_dirs` 의 존재 이유로 문서에 명시된
  "name≠dir 케이스 대응"이 어떤 테스트에도 실제로 검증되지 않는다.
  - 위치: `scripts/check-e2e-playwright-config.py:141-142`(docstring: "name≠dir 케이스 대응"),
    테스트 `.claude/tests/test_check_e2e_playwright_config.py:155-161`
    (`test_workflow_closure_maps_name_to_dir`), fixture 헬퍼 `:34-53`(`make_repo`)
  - 상세: `make_repo` 는 항상 `codebase/packages/<slug>/package.json` 의 `name` 을
    `@workflow/<slug>`(디렉터리명과 동일한 slug)로 생성한다. 즉 name→dir 매핑이 항등함수인
    fixture 만 쓰이고 있어, 실제 매핑 로직(`json.loads(...).get("name")` → `entry.name`)이
    깨지거나(예: key/value 스왑, 캐시 안 됨) 실제 dir 명이 name 의 slug 와 다른 케이스(과거 흔적:
    패키지가 rename 됐지만 dir 은 그대로인 경우)에 대해 아무 것도 검증하지 못한다.
  - 제안: `codebase/packages/legacy-dir/package.json` 의 `name` 을 `@workflow/renamed-pkg` 로 설정한
    fixture 로 `frontend_workflow_closure_dirs` 가 `{"legacy-dir"}` 를 반환함을 검증하는 테스트 1개
    추가.

- **[INFO]** closure/copy/mask 3-way diff 의 4가지 방향성 케이스 중 2개만 직접 테스트된다.
  - 위치: `.claude/tests/test_check_e2e_playwright_config.py:185-196`
    (`test_compose_mask_missing_pkg_fails` = missing-from-compose), `:198-209`
    (`test_dockerfile_copy_extra_pkg_fails` = extra-in-dockerfile)
  - 상세: "missing-from-dockerfile"(closure 에는 있는데 Dockerfile COPY 가 빠짐)와
    "extra-in-compose"(closure 에는 없는데 compose 마스킹에 여분 패키지가 있음)는 테스트되지 않는다.
    `check()` 내부에서 두 방향 모두 동일한 f-string 패턴(`sorted(closure - X)` /
    `sorted(X - closure)`)을 재사용하므로 회귀 위험은 낮지만, diff 로직을 리팩터링할 때 이 두
    분기가 조용히 깨질 수 있다.
  - 제안: 낮은 우선순위. 여유가 있으면 4개 방향 모두를 커버하는 파라미터라이즈드 테스트로 정리.

- **[INFO]** 방어적 분기(파일 부재, 버전 정규식 불일치) 커버리지 0.
  - 위치: `scripts/check-e2e-playwright-config.py:170-179`(`resolved is None`/`base is None`
    failure 메시지), `:181-186`(`rm` 매치 실패 시 "unexpected @playwright/test version" 분기)
  - 상세: `frontend_playwright_version`/`base_tag_major_minor`/`dockerfile_copy_dirs`/
    `compose_mask_dirs` 모두 대상 파일이 없으면 `None`/`set()`을 반환하는 경로가 있고, `check()`
    은 이를 각각 실패 메시지로 변환하는데, 어떤 테스트도 파일을 삭제/누락시켜 이 분기를 타지
    않는다. `rm` 정규식이 실패하는 "예상치 못한 버전 문자열"(예: `link:../x`, `workspace:*`)
    분기도 동일하게 미검증.
  - 제안: 우선순위 낮음(정상 repo 에서는 도달 안 함) — 회귀 안전망으로 `pnpm-lock.yaml`/
    `Dockerfile.playwright-e2e` 를 아예 안 만든 fixture 에 대해 `check()` 가 적절한 실패 메시지를
    내는지 확인하는 테스트 1~2개 추가하면 방어 코드가 실제로 동작함을 보증할 수 있다.

- **[INFO]** `harness-checks.yml` 의 `paths:` 필터는 `.claude/**` + 스크립트 자신만 등재하고
  `codebase/frontend/Dockerfile.playwright-e2e`, `docker-compose.e2e.yml`,
  `codebase/frontend/package.json`, `pnpm-lock.yaml` 은 없다.
  - 위치: `.github/workflows/harness-checks.yml:9-21`
  - 상세: 이 가드가 지키려는 drift(예: `docker-compose.e2e.yml` 의 마스킹 목록만 손댄 PR)가
    발생해도 harness-checks 워크플로(따라서 `RealRepoSmokeTest.test_real_repo_is_consistent` 포함
    11개 유닛테스트)는 재실행되지 않는다. 다만 `.github/workflows/e2e.yml` 은 `paths-ignore`
    방식(`.claude/**`/`spec/**`/`plan/**`/`review/**`/`*.md` 만 제외)이라 이 파일들 변경 시
    `config-guard` job 은 정상적으로 트리거되어 실질적 CI 커버리지 공백은 아니다(테스트 모듈
    docstring 도 "e2e.yml 이 primary enforcement" 라고 명시). 의도된 설계로 보이나, harness-checks
    는 이 PR 종류에 대해 "빠른 회귀 시그널"로 기능하지 않는다는 점은 문서화해 둘 가치가 있다.
  - 제안: 차단 사유 아님. 원하면 `harness-checks.yml` paths 에 4개 파일을 추가해 이중 안전망을
    강화할 수 있으나 필수는 아니다.

## 긍정적으로 확인된 점

- manifest-only COPY(`.../package.json`) 는 정확히 제외되고 소스 COPY 만 잡힌다 — 실제
  `Dockerfile.playwright-e2e` 형식으로 직접 검증 완료(정규식이 6-manifest COPY 와 4-source COPY
  라인을 올바르게 구분).
- lockfile 파서의 `codebase/frontend:` importer 블록 경계 탐지(2-space 들여쓰기 sibling key 기준)는
  실제 `pnpm-lock.yaml` 구조(`codebase/backend:` → ... → `codebase/frontend:` →
  `codebase/packages/chat-channel-validation:` 순서, 6-space `'@playwright/test':` 키)와 정확히
  일치함을 확인. `test_frontend_playwright_version_reads_frontend_block_only` 가 앞쪽 importer
  오염을 정확히 검증(다만 뒤쪽 importer 경계는 real-repo smoke test 로만 간접 검증 — 위 WARNING
  과 무관하게 실제로는 잘 동작).
- patch-level 차이는 통과해야 한다는 요구사항이 `test_patch_level_difference_still_passes` 로 정확히
  검증됨.
- 11개 테스트 모두 `tempfile.TemporaryDirectory()` 기반으로 완전히 격리되어 실행 순서 의존성 없음.
  Mock 사용이 전혀 없고(파일 fixture 만 사용) 이는 순수 파서 로직 테스트로서 적절한 선택.
- 스크립트의 모든 핵심 함수가 `root: Path` 를 인자로 받는 구조라(하드코딩된 절대경로 없음)
  synthetic fixture 테스트가 자연스럽게 가능 — 테스트 용이성 설계가 좋음.
- 이름 붙은 실패 브랜치(`test_dockerfile_copy_extra_pkg_fails`/`test_unmapped_workflow_dep_fails`
  등) 는 각각 다른 파라미터를 정확히 격리해서 단일 분기만 트리거하도록 fixture 를 구성해
  tautological 하지 않고 실제로 의도한 분기를 검증한다.

## 요약

가드 스크립트의 핵심 요구사항(patch-level 허용, manifest-only COPY 제외, frontend importer 블록
스코핑, name≠dir 매핑 존재)에 대한 테스트는 대체로 잘 짜여 있고 격리·가독성도 양호하다. 다만 컴포즈
마스킹 정규식이 실제 YAML 리스트 항목이 아니라 파일 전체 텍스트를 대상으로 하는 unanchored search 라서,
주석에 경로 문자열이 남아있으면 실제로 제거된 마스킹을 "존재"로 오판(false negative)한다는 것을
로컬에서 구체적으로 재현했다 — 이는 가드 자신의 존재 이유(마스킹 누락이 조용히 통과하는 것을 막는 것)를
정확히 무력화할 수 있는 케이스인데 어떤 테스트도 이를 커버하지 않는다. base 태그 파서도 동일한 앵커링
결함(`FROM` 문자열이 주석에 먼저 등장하면 오매칭)을 갖고 있다. 두 이슈 모두 Dockerfile COPY 정규식이
이미 채택한 `^...`+`re.MULTILINE` 라인 앵커링 패턴을 그대로 적용하면 해소되고, 이를 검증하는 회귀
테스트 추가가 권장된다. 그 외 name≠dir 매핑 미검증, 방어적 분기(파일 부재) 미검증, closure diff 4방향
중 2방향만 테스트 등은 낮은 우선순위 갭이다.

## 위험도

MEDIUM
