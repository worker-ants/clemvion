# 유지보수성(Maintainability) Review

## 리뷰 범위 메모

이번 diff 는 실질적으로 **테스트 전용 변경**이다 (`git diff origin/main -- codebase/backend/src/shared/utils/sanitize-error-message.ts` 결과 없음 — 프로덕션 코드 변경 없음). 실제 코드 리뷰 대상은 `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 한 파일뿐이며, 나머지(`plan/**`, `review/consistency/**`)는 계획 문서·자동 생성 리뷰 산출물이라 "유지보수성(가독성/네이밍/함수 길이/복잡도 등)" 관점 코드 리뷰 대상이 아니라고 판단해 본문 검토에서 제외했다(모두 새로 발견한 이슈 없음 확인).

## 발견사항

- **[INFO]** `nestObj`/`nestArr`/`nestMixed` 세 헬퍼가 구조적으로 거의 동일한 루프를 반복한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:276`~`292` (`nestObj`/`nestArr`/`nestMixed` 세 함수)
  - 상세: 세 함수 모두 `let v = leaf; for (...) v = <wrap>(v); return v;` 형태로 동일하고 `<wrap>` 표현식만 다르다 (`{ n: v }` / `[v]` / `i % 2 === 0 ? { n: v } : [v]`). 의도(각 분기의 "보폭"이 같은지 대칭적으로 확인)를 감안하면 세 개를 나란히 두는 편이 오히려 읽기 쉬울 수 있어 CRITICAL/WARNING 급은 아니지만, 순수 중복 관점에서는 `nestWith(depth, leaf, wrap)` 같은 공통 헬퍼로 3줄씩 더 줄일 여지가 있다.
  - 제안: 현재도 각 함수가 3줄로 짧고 JSDoc 주석으로 의도가 명확해 실사용상 문제는 낮음. 굳이 통합하지 않아도 무방하나, 넷째 분기가 추가될 경우 공통 헬퍼 추출을 고려.

- **[INFO]** 스택 오버플로 회귀 테스트의 깊이 값(`5000`)이 리터럴로 박혀 있음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:379` (`nestObj(5000, 'Bearer sk-DEEP-END')`)
  - 상세: 바로 위 JSDoc(367~376행)이 "#1188 실측: JSON.parse 는 100,000 을 통과, 재귀는 5,000 에서 터진다"는 근거를 상세히 설명하고 있어 매직넘버치고는 이례적으로 잘 문서화돼 있다. 다만 숫자 자체는 명명된 상수가 아니라 리터럴이라, 향후 이 값이 다른 테스트에도 재사용되거나 실측 기준이 바뀌면 주석과 리터럴이 따로 놀 여지가 있다.
  - 제안: 이 값이 이 테스트 하나에만 쓰이는 한 현재 형태(주석 + 리터럴)로 충분. 재사용 필요 시 `const STACK_OVERFLOW_PROBE_DEPTH = 5000;` 형태로 승격 권장.

- **[INFO]** 경계 쌍(상한 깊이 vs 상한-1 깊이) 검증의 테스트 단위가 object 분기와 array 분기에서 서로 다름
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:301`, `:307` (object 분기: 별도 `it` 2개) vs `:336` (array 분기: `it` 1개 안에 `expect` 2개)
  - 상세: object 중첩에서는 "상한 깊이" 케이스(301행)와 "상한-1 케이스"(307행)가 각각 독립된 `it` 로 분리돼 있어 실패 시 어느 쪽이 깨졌는지 테스트 리포트에서 바로 구분된다. 반면 array 중첩(336행)은 같은 두 케이스를 하나의 `it` 안에 `expect` 두 번으로 합쳐놨다 — 첫 `expect` 가 실패하면 두 번째는 실행되지 않고 리포트에는 테스트 1개 실패로만 보인다. 기능적으로는 문제없으나 같은 개념 쌍을 다루는 두 분기의 테스트 입자성(granularity)이 다르다는 점에서 코드베이스 내 일관성이 약간 떨어진다.
  - 제안: 필수는 아니지만, object 분기와 동일하게 array 분기도 두 개의 `it` 로 쪼개면 리포트 가독성·일관성이 개선된다.

## 요약

이번 변경은 프로덕션 코드 수정 없이 `deepRedactSecrets` 의 깊이 상한 경계를 검증하는 테스트 스위트를 추가한 테스트 전용 PR이다. 각 테스트가 왜 필요한지(좌표계 혼동 방지표, 값검사 vs 깊이검사 순서, JSON 재귀 진입점의 `depth+1` 보폭, 상한 없는 구현이 실제로 터지는 크기 실측 등)를 JSDoc 으로 꼼꼼히 설명해 가독성이 높고, 하드코딩된 상한 값 대신 `MAX_REDACT_DEPTH` 를 import 해 SoT 변경에 자동으로 추종하도록 설계돼 매직넘버 문제를 사실상 피했다. 테스트 제목의 `[경계]`/`[회귀]`/`[캐너리]` 태그, 헬퍼 네이밍(`nestObj`/`nestArr`)도 기존 파일·프런트엔드 동형 테스트(`masked-markers.test.ts`)와 일관된 컨벤션을 따른다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮고, 발견된 사항은 헬퍼 3종의 경미한 구조적 중복과 object/array 분기 간 테스트 입자성 불일치 등 INFO 수준에 그친다.

## 위험도

NONE
