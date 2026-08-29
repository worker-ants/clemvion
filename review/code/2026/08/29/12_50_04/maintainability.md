# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `captureThrown`/`captureRejected` 캡처 헬퍼가 코드베이스의 기존 `__test-utils__` 관례를 쓰지 않고 두 spec 파일에 각각 독립 정의됐다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:25-34`(`captureThrown`), `codebase/backend/src/nodes/data/code/code.handler.spec.ts:15-24`(`captureRejected`)
  - 상세: 두 헬퍼는 sync/async 쌍일 뿐 구조가 거의 동일하고, JSDoc 도 "vacuity 방지 단언을 품고 있다 — 아무것도 던지지/reject하지 않으면 `.cause` 가 `undefined` 라 뒤따르는 단언이 전부 조용히 통과해 버린다" 는 문장을 거의 그대로 복제한다. `code.handler.spec.ts` 쪽 JSDoc 이 스스로 "형제 `expression-resolver.service.spec.ts` 에 동기 버전이 있다" 고 명시해 이 쌍둥이 관계를 인지하고 있다. 이 저장소에는 이미 `codebase/backend/src/common/__test-utils__/`, `codebase/backend/src/modules/integrations/__test-utils__/` 같은 공유 테스트 헬퍼 디렉터리 관례가 존재하므로(예: `make-fake-jwt.ts`, `workspace-id-fixtures.ts`), 이번처럼 두 모듈에 걸쳐 재사용되는 헬퍼는 그 관례를 따라 한 곳(예: 공용 `__test-utils__`)에 두고 양쪽 spec 이 import 하는 편이 기존 스타일과 더 일관됐을 것이다.
  - 이 지적은 새 발견이 아니다 — 직전 라운드(`review/code/2026/08/29/12_23_45/maintainability.md`)가 동일 대상을 INFO 로 이미 지적했고, `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 "근거 서술 중복 정리 묶음" 백로그 항목으로 추적 중이다(developer SKILL §수렴 예외 — spec-linked 파일 재편집이 freshness 게이트를 재무장시켜 비용이 든다는 근거로 유예). 다만 그 백로그 서술에는 "공유 위치가 어디여야 하는가" 가 없다 — 처리할 때 위 `__test-utils__` 선례를 참고 지점으로 남긴다.
  - 제안: 급하지 않음(이미 추적 중). 다음에 이 자리를 만질 때 캡처 헬퍼 자체를 공용 `__test-utils__` 로 옮기고 JSDoc 은 그 한 곳에만 두면, 이미 두 번(파일 안 → 헬퍼로, 그다음 파일 간 중복 발견) 반복된 "발견 → 유예 → 다음 라운드에 재확인" 사이클을 끊을 수 있다.

- **[INFO]** `it.each` fixture 튜플이 위치 기반 `string[]` 이라 필드 순서 실수를 컴파일 타임에 못 잡는다 (직전 라운드 지적, 미변경)
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:199-207` (`it.each([['ExpressionSyntaxError', '{{ $input. }}', 'EXPR_SYNTAX_ERROR'], ...])`)
  - 상세: `className`/`expression`/`expectedCode` 세 칼럼이 전부 `string` 이라 TypeScript 가 순서 실수를 잡지 못한다. 같은 케이스에 `cause.name`·`shape.code` 판별 단언이 걸려 있어(뮤테이션 M7/M8로 이미 실측 확인됨) 런타임 상으로는 안전하지만, 정적으로는 열린 표면이다. 이번 diff 는 이 구조를 바꾸지 않았다.
  - 제안: 우선순위 낮음. `$className` 같은 named substitution + 객체 리터럴 배열로 바꾸면 필드 순서 실수의 여지가 준다. 이미 런타임 가드가 있어 시급하지 않다.

- **[INFO]** `error-shape.spec.ts` 의 클래스-전수 캐너리와 backend 두 spec 의 C2 캐너리가 "enumerable own key 를 축으로 쓰는 이유" 설명을 세 곳에 거의 동일 문장으로 중복 서술한다
  - 위치: `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:19-22`, `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:178-181`, `codebase/backend/src/nodes/data/code/code.handler.spec.ts:245-246`(참조만, code.handler 쪽은 "그쪽 주석에 있다" 로 중복을 이미 피하고 있음)
  - 상세: 새 패키지 캐너리(`error-shape.spec.ts`)가 추가되며 "enumerable 인 이유" 서술이 두 곳에서 세 곳으로 늘었다. `code.handler.spec.ts` 는 참조만 해 중복을 피하는 선례를 이미 보여주는데, 신규 패키지 파일은 참조 대신 전문을 다시 썼다. `plan/in-progress/deps-peer-gating-and-eslint10.md` 의 같은 백로그 항목이 "두 backend spec + 신규 패키지 캐너리" 세 곳의 중복을 이미 명시적으로 추적하고 있어 새로 발견된 것은 아니다.
  - 제안: 급하지 않음(추적 중). 정리할 때 이 축 설명 자체를 `spec/5-system/3-error-handling.md` §6.3.1 Rationale 로 승격하고 세 test 파일은 전방 참조만 남기는 편이 3중 동기화 비용을 없앤다.

## 확인한 것 (문제 없음)

- `error-shape.spec.ts` 의 `SUBCLASSES` 필터(타입 가드 포함)·전수성 단언·`it.each` 구조는 가독성이 좋고 각 단언의 "왜"가 인접 주석에 명확하다. 네이밍(`ALLOWED_KEYS`, `SUBCLASSES`)도 목적을 정확히 드러내며 함수 길이·중첩 깊이·매직 넘버 문제가 없다.
- `secret-resolver.service.ts` 에 추가된 문단(92-99행 부근)은 순수 주석 4줄 추가이고, 기존 `resolve()` catch 블록의 길이·분기 구조에 영향을 주지 않는다. "C1 판정의 보조 근거일 뿐 판정축이 아니다" 한 문장으로 요지가 명확해 가독성 저하가 없다.
- `code.handler.spec.ts` 의 신규 C2 캐너리(`Object.keys(cause).toEqual([])`)와 `expression-resolver.service.spec.ts` 의 캐너리(정렬 후 화이트리스트 비교)가 단언 형태는 다르지만, 각 파일 주석이 그 차이(빈 집합 vs `['code','name','position']`)가 실측 데이터 차이의 정확한 반영임을 밝히고 있어 일관성 결함이 아니다.
- `review/code/2026/08/29/{11_58_35,12_23_45}/*` 디렉터리(RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·각 reviewer `.md`)는 이전 리뷰 라운드의 산출물을 프로젝트 관례(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)대로 그대로 커밋한 감사 기록이다. 코드가 아니라 프로세스 이력 문서라 함수 길이·중첩·복잡도 같은 유지보수성 기준을 적용할 대상이 아니라고 판단했다.

## 요약

이번 diff 는 프로덕션 로직 변경이 없는 테스트·주석·plan 문서 전용 변경으로, 신규 코드(`error-shape.spec.ts`)는 가독성·네이밍·복잡도 면에서 양호하다. 다만 캡처 헬퍼(`captureThrown`/`captureRejected`)의 사실상 동일한 JSDoc 이 두 spec 파일에, "enumerable 축" 근거 설명이 이제 세 파일에 중복돼 있다 — 둘 다 새 발견이 아니라 직전 리뷰 라운드가 이미 짚었고 plan 백로그에 등재돼 developer SKILL §수렴 예외 사유(spec-linked 파일 재편집이 freshness 게이트를 재무장시킴)로 유예된 상태다. 저장소에 이미 `__test-utils__` 공유 헬퍼 관례가 존재하므로, 그 백로그 항목을 처리할 때 임시 파일 내 정의 대신 그 관례를 따르는 편이 기존 스타일과 더 일관된다는 점만 추가로 남긴다. 그 외 함수 길이·중첩 깊이·매직 넘버·중복 코드 관점에서 새로 도입된 구조적 위험은 없다.

## 위험도
LOW
