# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** 소스 정규식 매칭으로 "로드 시점 실제 호출"을 검증하는 방식은 유효하지만 포맷 변경에 취약할 수 있다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:46-50` (`'모듈이 로드 시점에 실제로 가드를 부른다'` 테스트)
  - 상세: `src.match(/^[ \t]*assertAllUnique\s*\(\s*ALL_WS\s*\)\s*;/gm)` 는 `assertAllUnique(ALL_WS);` 가 줄 시작에 그대로, 세미콜론이 `)` 직후(공백 허용)에 와야만 매치한다. 예를 들어 향후 누군가 `assertAllUnique(ALL_WS); // 부트 가드` 처럼 같은 줄에 라인 코멘트를 붙이는 것은 통과하지만, `void assertAllUnique(ALL_WS);` 처럼 앞에 다른 토큰이 붙거나 호출을 다른 statement 안에 감싸면(예: `if (...) assertAllUnique(ALL_WS);`) 여전히 줄 시작이 아니므로 실패해 허위 RED 가 날 수 있다. 다만 이는 주석에 이미 "공백·개행에 관대하게" 라고 명시된 의도된 트레이드오프이고, U2 뮤테이션(호출 삭제)에 대한 실측 검증도 문서화돼 있어 설계적으로 정당화된 선택이다.
  - 제안: 현재로서는 문제 없음. 향후 이 정규식이 허위 RED 를 내면(포맷 변경만으로) 조건을 넓히거나, 더 견고하게 하려면 TS AST 파서로 전환을 고려할 수 있다는 정도의 참고 사항.

- **[INFO]** `assertAllUnique` 의 다중 중복 그룹(3개 이상 값이 겹치는 경우) 시나리오는 테스트되지 않음
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:23-29` (`'중복이 있으면 throw 한다'`, `'throw 메시지가 고유/전체 개수를 말한다'`)
  - 상세: 두 테스트 모두 `['a', 'b', 'a']` (정확히 1쌍 중복) 케이스만 검증한다. `uniqueCount`/`values.length` 계산 로직(`new Set(values).size`)은 단순해 실질 위험은 낮지만, 메시지 포맷이 "고유 N / 전체 M" 형태로 향후 소비될 가능성(에러 로그 파싱 등)을 고려하면 전원 중복(`['a','a','a']` → "고유 1 / 전체 3")처럼 경계값 하나를 추가하면 완전성이 높아진다.
  - 제안: 필수는 아니며, 이번 PR 의 스코프(INFO 등급 항목이었던 유일성 가드 추가) 대비 충분한 커버리지다. 여유가 있을 때 1케이스 추가 고려.

- **[INFO]** `uuid.spec.ts` 변경은 주석(docstring)만 재작성한 순수 문서 정리 — 회귀 위험 없음
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:49-58`
  - 상세: 실제 `expect` 단언 코드(59-68행)는 변경되지 않았고, nil/v7/oddVariant 세 값에 대한 `isUuidShaped`/`isValidUuid` 상호 검증 로직 그대로 유지된다. SoT 를 `uuid.ts` docstring 으로 옮기고 중복 산문을 포인터로 축약한 것으로, 테스트 유효성에 영향 없음.
  - 제안: 없음. 확인용 기재.

## 종합 평가

`workspace-id-fixtures.ts` 에 추가된 `assertAllUnique` 순수 함수와 `ALL_WS` 값 유일성 로드 시점 가드는 전용 spec 파일(`workspace-id-fixtures.spec.ts`)로 빈틈없이 커버된다 — 정상 경로(유일값 통과), 판정 로직 생존(중복 시 throw), 에러 메시지 정확성, 경계값(빈 배열·단일 원소), "헬퍼 존재 vs 실제 호출" 배선 검증(U2 클래스 뮤테이션에 대한 방어), 그리고 `ALL_WS` 완전성(하드코딩 대조가 아니라 모듈 네임스페이스 자동 추출 + 프로덕션 `isUuidShaped` 재사용)까지 각 테스트가 스스로 "왜 이 형태여야 하는가"(과거 vacuous 실패 사례 포함)를 주석으로 명시하고 있어 테스트 가독성·의도 전달이 매우 우수하다. 픽스처 재사용(하드코딩 배열이 아닌 export 재사용)·중복 제거 회피 등 앞서 리뷰에서 잡힌 vacuous 패턴을 스스로 되짚어 재발을 막은 점도 눈에 띈다. `uuid.spec.ts` 변경은 순수 주석 정리로 기존 테스트 로직·회귀 방어선(경계 테스트, nil/v7/oddVariant)에 영향이 없다. Mock 사용은 없으며(순수 함수·파일 읽기만 사용) 테스트 간 의존성·공유 상태도 없어 격리도 양호하다. 발견된 두 건은 모두 INFO 수준의 사소한 보강 여지이며 이번 PR 의 실질 회귀 위험은 없다.

## 위험도

LOW
