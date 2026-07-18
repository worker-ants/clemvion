# 유지보수성(Maintainability) 리뷰

리뷰 대상 중 실제 애플리케이션 코드는 파일 1(`interaction-type-exhaustiveness.test.ts`)·파일 2
(`interaction-type-registry.ts`) 두 개다. 파일 3(`plan/*.md`)은 작업 추적 문서, 파일 4~11
(`review/consistency/2026/07/18/12_04_53/**`)은 이전 세션의 자동 생성 리뷰 산출물(마크다운 리포트 +
`_retry_state.json`/`meta.json`)이라 "코드" 유지보수성 관점(가독성/네이밍/함수 길이/중첩/매직넘버/
중복/복잡도)이 적용될 대상이 아니다 — 아래 발견사항은 실코드 변경분에 집중했다.

### 발견사항

- **[INFO]** self-test fixture 강화가 기존 `expect(...).toBe(true)` 2줄을 `for` 루프로 교체해 중복을 줄임
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:222-230` (real 값
    루프), `:231-241` (ghost 값 루프)
  - 상세: real 값이 2개(`real_literal`, `real_template`)에서 5개(`real_union_a`, `real_union_b`,
    `real_prop` 추가)로 늘면서, 이전처럼 각 값마다 `expect(...).toBe(true)` 한 줄씩 나열했다면 중복이
    누적됐을 것이다. `for (const real of [...])` 루프로 전환해 값 추가 시 배열 원소만 늘면 되도록 정리한
    점은 긍정적 — 매직 문자열 나열이지만 테스트 픽스처 특성상 자기서술적(self-descriptive) 이름
    (`real_union_a`/`ghost_regex` 등)이라 의미 파악에 문제없음.
  - 제안: 없음 (개선 사항으로 기록, 조치 불필요).

- **[INFO]** JSDoc 갱신(`collectCodeStringLiterals` 위 주석에 정규식 리터럴 관련 문단 추가)이 기존의
  장문 rationale 주석 스타일과 일관됨
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:170-174`
  - 상세: 추가된 문단("A regex literal (`/…/`) is a `RegularExpressionLiteral`, not a `StringLiteral`…")은
    기존 주석의 "왜 이 설계를 택했는가" 서술 패턴(§근거 나열)을 그대로 따른다. 이 파일은 이미 함수당
    10줄 넘는 JSDoc 이 여러 개 있어(가독성보다 근거 보존을 우선하는 이 저장소 컨벤션에 부합, CLAUDE.md
    의 Rationale 문서화 관례와 동일 정신) 신규 이질감은 없음.
  - 제안: 없음.

- **[INFO]** 파일 2(`interaction-type-registry.ts`)의 변경은 "grep 가드" → "AST 가드" 용어 정정 3곳뿐,
  순수 주석 diff
  - 위치: `codebase/frontend/src/lib/conversation/interaction-type-registry.ts:14`, `:63-64`
  - 상세: 실제 구현(`ts.createSourceFile` 기반 AST 순회, 파일 1 참고)과 주석 용어가 이제 일치한다.
    코드 로직 변경 없음, 네이밍/일관성 관점에서 개선(전에는 "grep" 이라는 잘못된 용어가 독자를
    오도할 수 있었음).
  - 제안: 없음.

- **[INFO]** (사전 존재, 이번 diff 범위 밖) `REGISTRY_SITES`/`SOURCE_REGISTRY_SITES` 를 순회하며
  "missing" 배열을 만들고 동일한 형식의 에러 메시지를 던지는 블록이 두 `describe` 블록
  (`:245-266`, `:284-305`)에서 거의 동일한 구조로 반복됨
  - 위치: `codebase/frontend/src/lib/__tests__/interaction-type-exhaustiveness.test.ts:245-305`
  - 상세: 이번 PR 이 건드리지 않은 기존 코드라 새 결함은 아니다. 두 블록을
    `assertExhaustive(sites, values, sotPath)` 같은 공용 헬퍼로 뽑으면 향후 세 번째 registry 가 추가될 때
    중복이 늘지 않는다. 다만 현재 2개뿐이고 각 블록이 짧아 즉각적 리스크는 낮음.
  - 제안: 조치 불요 (참고용 관찰). 세 번째 exhaustiveness 가드가 추가되는 시점에 헬퍼 추출을 고려.

### 요약

이번 diff 는 기존 AST 가드 테스트의 self-test fixture 를 확장(union 타입 선언·객체 프로퍼티 값·정규식
리터럴 비오염 케이스)하고, 소스 코드 주석의 "grep 가드"라는 낡은 용어를 실제 구현("AST 가드")에 맞게
정정한 것이 전부다. 순수 테스트 보강 + 주석 정정이라 함수 길이·중첩 깊이·순환 복잡도에 영향이 없고,
반복되던 개별 `expect` 호출을 루프로 통합해 오히려 중복을 소폭 줄였다. 새로 추가된 매직 문자열은
테스트 픽스처의 자기서술적 더미 값이라 문제되지 않는다. 유일하게 눈에 띄는 pre-existing 중복(두
exhaustiveness `describe` 블록의 에러 빌드 로직)은 이번 diff 대상이 아니며 규모도 작아 INFO 수준으로만
기록했다. 전반적으로 가독성·네이밍·일관성 모두 양호하며 유지보수성 리스크는 없다.

### 위험도

NONE
