# 정식 규약 준수 검토 (convention_compliance)

- 모드: 구현 완료 후 검토 (--impl-done, scope=`.claude/docs`, diff-base=origin/main)
- scope(`.claude/docs`) 델타는 0개 파일이다. 델타 0 자체는 결함이 아니다.
- 실제 변경은 코드 2개 파일이다. 둘 다 `codebase/frontend/src/lib/docs/__tests__/` 아래에 있다.
  - `spec-links.ts`
  - `spec-link-integrity.test.ts`
- 검증: 워크트리에서 `vitest run` 으로 `spec-link-integrity` · `spec-area-index` · `tree-walk` 3개 파일을 돌렸다. 56개 테스트가 모두 통과했다.

## 발견사항

- **[WARNING]** 가드 스코프 변경이 SoT 문서 두 곳에 반영되지 않았다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `inNervMirror` / `collectSpecMarkdown`.
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §4.2` 표 (133행, `spec-link-integrity.test.ts` 행의 "제외" 열).
  - 위반 규약: `PROJECT.md` "문서 링크 검증" 절 (392행, 스코프 (1)).
  - 상세: 이번 변경으로 스코프 (1) `spec/**.md` 본문 스캔은 두 가지를 제외한다. 하나는 생성형 `*-api-catalog/`, 다른 하나는 NERV 미러(`spec/README.md` · `spec/CLE-*`)다. 그런데 SoT 표의 "제외" 열은 "생성형 `*-api-catalog/` 트리" 만 적고 있다. `PROJECT.md:392` 도 "(생성형 `*-api-catalog/` 제외)" 로 끝난다. 이 변경에서 두 문서의 델타는 0이다. 스코프가 바뀌었는데 SoT 서술이 옛 스코프에 머물러 있다. `spec-area-index.test.ts` 도 같은 `collectSpecMarkdown` 을 쓰기 때문에 4.2 표 134행("카탈로그" 만 면제)도 함께 어긋난다. 코드 주석은 "옛 트리는 NERV 전환 단계 5 에서 지운다" 고 적는다. 그때까지 SoT 표가 실제 스코프보다 넓은 검사를 약속하는 상태가 이어진다.
  - 제안: `PROJECT.md:392` 에 "NERV 미러(`spec/README.md` · `spec/CLE-*`) 제외" 를 덧붙인다. 이 문서는 developer 가 수정할 수 있다. `spec-impl-evidence.md §4.2` 133·134행은 같은 사실로 갱신한다. 다만 이 `spec/` 경로는 단계 1 부터 `guard_nerv_owned_paths.py` 훅이 막는다. 그래서 planner/NERV 경로로 처리하거나 후속 plan 항목으로 남겨야 한다. 후속으로 미룬다면 두 SoT 가 어긋난 채 남는 구간을 plan 에 적어 둔다.

- **[INFO]** 가드 주석이 새 제외를 반영하지 않는다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts`. 주석 `// excludes catalogs` (36행)와 헤더의 "Generated `*-api-catalog/` trees are exempt." 가 대상이다.
  - 위반 규약: 코드 주석과 구현의 정합. `spec-impl-evidence.md §4.2` 의 가드 서술 SoT 원칙을 따른다.
  - 상세: `collectSpecMarkdown` 은 이제 NERV 미러도 뺀다. 이 가드는 영역 폴더의 index 를 검사하는데, 미러 영역 폴더(`CLE-ACCT/` 등)가 조용히 제외된다. `spec-links.ts` 에는 "영역 목차 규칙" 대상이 아니라는 설명이 있다. 반대로 `spec-area-index.test.ts` 에는 그 설명이 없어 읽는 사람이 제외 이유를 놓친다.
  - 제안: 두 주석에 "NERV 미러도 제외" 를 한 줄씩 더한다.

- **[INFO]** 제외 테스트가 옛 트리의 특정 파일 실재에 결합되어 있다
  - target 위치: `spec-link-integrity.test.ts` 의 `excludes the NERV spec mirror from scope`. `files.some(f => f.relPath === "spec/5-system/1-auth.md")` 단언이 대상이다.
  - 위반 규약: 해당 없음. 문서 구조 규약이 아니라 유지보수 일관성 제안이다.
  - 상세: `spec-links.ts` 주석이 "옛 트리는 NERV 전환 단계 5 에서 지운다" 고 명시한다. 그 시점에 이 단언은 가드 회귀와 무관하게 깨진다. 반대편 단언(`spec/CLE-VISION.md` 실재)은 미러가 사라지면 깨진다.
  - 제안: 단계 5 정리 작업에 이 테스트를 포함시킨다. 또는 옛 트리 단언을 합성 트리 fixture(`tree-walk.test.ts` 의 "수집기 필터 배선 — 합성 트리")로 옮긴다. 그러면 실저장소 형태와 무관하게 옵션 배선이 고정된다. `tree-walk.test.ts` 의 `collectSpecMarkdown` 배선 fixture 에는 현재 미러 사례가 없다.

- **[INFO]** 정규식이 이중 정의되어 있다
  - target 위치: `spec-links.ts` 의 `NERV_MIRROR` 와 `.claude/tools/nerv-mirror/pull.py` 의 `KEY_RE`(48행)·`glob("CLE-*")`.
  - 위반 규약: 해당 없음. 단일 진실 원칙에 관한 제안이다.
  - 상세: 실제 미러 파일(`git ls-files spec`)을 전수 대조했다. `README.md` · `CLE-*` 최상위 파일과 폴더 27개가 모두 `NERV_MIRROR` 에 걸린다. 오탐(미러가 아닌데 걸리는 경로)도 미탐도 없다. 다만 미러 경계 정의가 TS 와 Python 두 곳에 있어서 `pull.py` 가 새 형태(예: 소문자 키, 새 루트 파일)를 쓰기 시작하면 갈라질 수 있다.
  - 제안: 지금은 조치 불필요하다. 위 첫 번째 INFO 의 테스트 보강 시 "미러 실파일 전수가 `inNervMirror` 에 걸린다" 는 양성 단언을 하나 두면 갈라짐을 잡는다.

## 요약

이번 변경은 테스트 지원 코드 2개 파일이다. 코드는 정식 규약이 금지한 패턴을 답습하지 않는다. 파일과 식별자 명명은 기존 가드 파일(`spec-links.ts` · `*.test.ts`)의 규칙을 따른다. 미러 판정 정규식은 실제 미러 파일과 정확히 일치한다. 3개 가드 테스트 파일도 통과한다. 위반 정도가 큰 지점은 SoT 문서 정합 하나다. `spec-link-integrity` 스코프 (1) 에 NERV 미러 제외가 추가되었는데 `spec/conventions/spec-impl-evidence.md §4.2` 와 `PROJECT.md:392` 는 "카탈로그만 제외" 로 남아 있어 WARNING 으로 분류했다. `PROJECT.md` 는 지금 고칠 수 있고, `spec/conventions` 는 단계 1 의 NERV 소유 경로 훅 때문에 별도 경로가 필요하다. `.claude/docs` 자체는 변경이 없고, 그 안에 이 가드 스코프를 서술하는 문장도 없어서 영향이 없다. 차단할 CRITICAL 은 없다.

## 위험도

LOW
