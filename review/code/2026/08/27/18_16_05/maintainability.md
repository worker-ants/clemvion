# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 신규 fixture 헬퍼 함수명이 한 글자(`w`)라 의도가 이름만으로 드러나지 않는다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:143` (`const w = (rel: string, body: string): void => {...}`)
  - 상세: 같은 디렉터리의 자매 테스트 `spec-links.test.ts` 는 동일한 "fixture 파일 하나 쓰기" 역할을 `mkLink`(링크 문자열 조립)처럼 의도가 드러나는 이름으로 짓는다. `w` 는 5회 호출되며 스코프-안/스코프-밖 두 그룹의 fixture 를 구분해 쓰는데, 이름만 보면 무엇을 쓰는지(write) 유추해야 한다. 함수 자체는 `beforeAll` 안에 지역 스코프라 위험도는 낮다.
  - 제안: `writeFixture` 또는 `write` 등으로 이름을 풀어써 자매 파일과 네이밍 관례를 맞춘다.

- **[INFO]** `collectGovernanceMarkdown` 안에서 `.md` 확장자 판별 predicate `(name) => name.endsWith(".md")` 가 두 `walkTree` 호출에 동일하게 인라인 중복된다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` `collectGovernanceMarkdown` 함수 (root-level 호출과 `.claude` 호출 두 곳의 `includeFile`)
  - 상세: 2줄짜리 사소한 중복이라 즉각적 위험은 없지만, 두 스코프의 "무엇을 markdown 파일로 볼 것인가" 판정이 물리적으로 갈라져 있어 향후 한쪽만 고치는 drift 여지가 아주 작게 남는다.
  - 제안: `const isMarkdown = (name: string) => name.endsWith(".md");` 로 뽑아 두 호출에서 재사용(선택, 비차단).

- **[INFO]** (참고, 조치 불요) `17,202`(실측 파일 수)가 테스트 docstring·워크플로 주석·plan 문서 3곳에 동일 하드코딩된 채 유지됨.
  - 위치: `.claude/tests/test_harness_checks_paths_coverage.py:206`, `.github/workflows/spec-link-checks.yml:58`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:845`
  - 상세: 이 항목은 직전 리뷰 라운드(`review/code/2026/08/27/17_52_44/RESOLUTION.md` INFO 2)에서 이미 지적되고 "세 곳의 독자가 다르고(테스트 독자·워크플로 편집자·plan 독자) 링크로 바꾸면 편집자가 매직을 지울 위험이 커진다"는 근거로 **의도적으로 유지**하기로 결정된 사안이다. 같은 판단을 이번 라운드에서 재차 요구하면 정체된 fix→review 루프가 될 뿐이므로 신규 조치 불요로 재확인만 한다.

## 요약

전체적으로 가독성·네이밍·주석 품질이 높은 변경이다. 신규 함수(`collectGovernanceMarkdown`, `findBrokenGovernanceLinks`)는 기존 `collectSpecMarkdown`/`findBrokenLinks`, `collectCodebaseSources`/`findBrokenSpecLinksInSources` 쌍과 명명·구조가 정확히 대칭이라 컨벤션 일관성이 강하다. 공유 스캔 로직(`findBrokenLinksInFiles`)을 재사용해 새 스코프를 얇은 두 함수로만 얹었고, 매직 넘버(`MIN_CLAUDE_DOCS=20`)에는 근거(실측 52개)를 단 이름 있는 상수를 썼으며, `scripts/check-doc-links.py`(202줄, 미배선·오탐 보유) 삭제는 중복 로직 제거로 순유지보수성을 개선한다. Python 가드(`test_harness_checks_paths_coverage.py`, `test_ci_paths_changed.py`)의 신규 테스트도 기존 클래스·docstring 관례를 그대로 따른다. 발견된 사항은 전부 INFO 수준의 사소한 네이밍/중복이며, 그중 하나(매직 넘버 중복)는 이미 직전 라운드에서 의도적으로 유지하기로 결정된 사안이라 재조치 대상이 아니다. 병합을 막을 이유가 없다.

## 위험도
NONE
