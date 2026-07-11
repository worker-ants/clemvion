# 변경 범위(Scope) 리뷰

## 대상

- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (단일 파일, 커밋 `829ddceee`)
- 커밋 메시지: `refactor(docs-guard): spec-link 스캔 코어를 파라미터화해 중복 제거`
- worktree/branch 명 (`spec-links-dedup-ad581b`) 과 커밋 메시지가 명시하는 작업 의도: `findBrokenLinks`(spec/**)와 `findBrokenSpecLinksInSources`(codebase 소스)가 중복 보유한 DEAD/ANCHOR 스캔 루프를 공유 코어로 추출하는 순수 리팩토링.

## 발견사항

- **[NONE]** 범위 이탈 없음
  - 위치: 전체 diff
  - 상세: 변경은 `findBrokenLinksInFiles(files, options)` 공유 코어 추출 하나로 수렴한다. 신설된 `LinkScanOptions`(`checkSelfAnchors`, `targetFilter`)와 `slugsFor` 클로저는 모두 "두 함수가 무엇이 다른가"를 옵션으로 명시하기 위한 것으로, 중복 제거라는 선언된 목적에 직접 필요한 요소다 — 요청 이상의 신규 기능이 아니다. 원본 `findBrokenLinks`/`findBrokenSpecLinksInSources` 의 분기 순서(`target.startsWith("#")` → self-anchor 처리 → `continue`, 이어서 `isExternal` 체크, `pathPart === ""` 체크, 그 다음 filter)를 라인 단위로 대조한 결과 동작 등가성이 유지된다:
    - `findBrokenLinks`: `checkSelfAnchors: true`, `targetFilter` 미지정 → 원본과 동일하게 모든 상대 링크 검사 + self-anchor 검사.
    - `findBrokenSpecLinksInSources`: `checkSelfAnchors: false`(원본의 `target.startsWith("#")` 무조건 skip과 동일), `targetFilter: SPEC_MD_TARGET_RE.test`(원본의 `!SPEC_MD_TARGET_RE.test(pathPart)` skip과 동일).
  - `git show --stat`으로 확인한 변경 통계는 `1 file changed, 53 insertions(+), 66 deletions(-)` — 리뷰 대상 파일 외 다른 파일에 대한 수정 없음.
- **[NONE]** 불필요한 리팩토링 없음 — 두 public 함수 자체를 얇은 wrapper로 축소한 것이 정확히 "중복 제거"라는 선언된 작업 범위이며, 그 외 이름 변경·구조 개편·무관한 정리는 없음.
- **[NONE]** 기능 확장 없음 — `targetFilter`/`checkSelfAnchors` 는 기존 두 함수가 이미 갖고 있던 서로 다른 동작을 옵션화한 것일 뿐, 새로운 검증 규칙이나 새 진입점은 추가되지 않았다.
- **[NONE]** 무관한 파일 수정 없음 — 커밋은 대상 파일 1개만 포함.
- **[NONE]** 포맷팅 변경 혼입 없음 — diff 전체가 로직 이동/추출과 직접 결부되어 있고, 별도의 순수 포맷팅 hunk는 없음.
- **[NONE]** 주석 변경은 리팩토링에 종속적 — `findBrokenLinksInFiles` 상단에 새 JSDoc 추가(공유 코어를 설명), `findBrokenLinks`/`findBrokenSpecLinksInSources` 상단 JSDoc은 새 구조를 반영해 갱신(“Same-file `#anchor` links are checked…”, “— and same-file `#anchor` links, since code has no headings — are ignored.” 문구 추가). 모두 실제 코드 구조 변경을 정확히 반영하는 문서화이며, 무관한 주석 삭제/추가는 없음.
- **[NONE]** 임포트 변경 없음 — diff에 import 문 추가/삭제 없음.
- **[NONE]** 설정 변경 없음 — 테스트/빌드/CI 설정 파일은 변경 대상에 포함되지 않음.

## 요약

단일 파일에 국한된 순수 리팩토링으로, worktree 명·커밋 메시지가 선언한 "spec-link 스캔 코어 파라미터화를 통한 중복 제거"라는 의도와 diff 내용이 정확히 일치한다. 신설된 옵션 인터페이스와 헬퍼는 모두 기존 두 함수의 차이를 표현하는 데 필요한 최소 요소이며, 동작 등가성도 원본/신규 분기 로직을 라인 단위로 대조해 확인했다. 무관한 파일 수정, 끼워팔기 리팩토링, 기능 확장, 포맷팅/주석/임포트/설정의 부수적 혼입 등 스코프 이탈 징후는 발견되지 않았다.

## 위험도

NONE
