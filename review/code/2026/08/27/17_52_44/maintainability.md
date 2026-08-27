# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** 실측값 `17,202` 이 세 위치에 하드코딩·중복 기재됨 (단일 출처 없음)
  - 위치:
    - `.claude/tests/test_harness_checks_paths_coverage.py:206` (모듈 docstring)
    - `.github/workflows/spec-link-checks.yml:58` (`pathspecs` 주석)
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md:845` (diff 신규 블록)
  - 상세: git pathspec `*.md` 가 `:(glob)` 없이 매치하는 파일 수(17,202)가 근거로 세 파일에 동일하게 인용된다. 저장소가 자라 이 숫자가 바뀌면(혹은 재측정 시 다른 값이 나오면) 세 곳을 모두 갱신해야 하는데 서로를 참조하는 SoT 표시가 없어 drift 가능성이 있다. 다만 이 프로젝트는 "근거를 각 소비 지점에 로컬로 남긴다"는 관례를 이미 갖고 있고(다른 Rationale 절들도 동일 패턴), 세 곳 모두 "실측(2026-08-27)"이라는 시점 딱지가 붙어 있어 역사적 기록으로는 문제가 적다.
  - 제안: 우선순위 낮음. 굳이 손댈 필요는 없으나, 후속으로 값이 바뀔 가능성이 있다면 한 곳(예: 테스트 파일 docstring)을 SoT로 지정하고 나머지 두 곳은 "근거: `test_harness_checks_paths_coverage.py` 참고"로 링크만 남기는 편이 더 안전하다.

- **[INFO]** 비-공허성(non-vacuity) 검사 임계값 `20` 이 이름 없는 리터럴로 테스트에 인라인됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:110` — `expect(rel.filter((p) => p.startsWith(".claude/")).length).toBeGreaterThan(20);`
  - 상세: 같은 파일의 다른 anti-vacuity 검사(`files.length).toBeGreaterThan(100)` 등)와 마찬가지로 근거가 되는 실측 카운트를 주석으로 남기지 않은 채 임계값만 박혀 있다. 동일 관심사를 다루는 Python 쪽 자매 가드(`.claude/tests/test_harness_checks_paths_coverage.py`)는 `_MIN_TARGETS`/`_MIN_FILTERS` 라는 이름 있는 모듈 상수로 뽑아 "왜 이 숫자인지"를 문서화한다. 이 테스트는 그 패턴을 안 따르고 리터럴로 남겼다.
  - 제안: 사소한 스타일 불일치. 값을 바꿀 필요는 없으나, 후속 편집 때 `_MIN_...` 류 이름 상수로 뽑으면 Python 자매 가드와 일관성이 맞는다. 이번 PR 범위에서 블로킹할 사안은 아니다.

## 요약

이번 변경은 문서 링크 무결성 가드의 스코프를 거버넌스 문서(`CLAUDE.md`/`PROJECT.md`/`.claude/**`)까지 넓히고, 배선되지 않아 사실상 죽어 있던 `scripts/check-doc-links.py`(202줄)를 삭제해 TypeScript 가드(`spec-links.ts`)로 기능을 일원화한 리팩터다. 신규 함수(`collectGovernanceMarkdown`/`findBrokenGovernanceLinks`)는 기존 `collectSpecMarkdown`/`findBrokenLinks`·`collectCodebaseSources`/`findBrokenSpecLinksInSources` 쌍과 이름·구조·문서화 스타일이 정확히 일치하고, 공유 코어(`findBrokenLinksInFiles`)를 옵션으로 분기하는 기존 설계를 그대로 재사용해 진짜 중복 없이 세 번째 스코프를 추가했다. `walkTree`(공유 DFS 유틸)의 기존 계약(`bases`=root-상대 세그먼트, `recurse`/`skipDir`/`includeFile` 옵션)을 정확히 준수하며, 신규 테스트는 실 저장소가 아닌 `mkdtempSync` 합성 fixture로 제외 규칙(루트 비재귀·`.claude/worktrees/` 스킵)을 양성으로 겨눠 공허 통과를 막는다 — 이 저장소가 반복 지적해 온 "필터를 지워도 초록"이었던 결함 클래스를 정확히 피했다. Python 가드(`_GIT_GLOB_MAGIC` 스트립)와 워크플로 `pathspecs` 추가도 각각 왜 필요한지 실측을 곁들여 짧고 명확하게 문서화되어 있다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 네이밍은 기존 컨벤션(SCREAMING_SNAKE_CASE 모듈 상수, `collectX`/`findBrokenXLinks` 명명 규칙)을 그대로 따른다. 위에서 지적한 두 건은 모두 INFO 수준의 사소한 스타일 관찰(중복 실측값 표기, 이름 없는 임계값 리터럴)이며 병합을 막을 이유가 없다.

## 위험도
NONE
