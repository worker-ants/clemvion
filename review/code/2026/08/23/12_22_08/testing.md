# 테스트(Testing) 리뷰

## 검증 절차

- `git diff` 로 보인 변경분을 실제 파일에서 `Read`/`grep` 으로 재확인 (gate 숫자와 소스 라인 일치 확인).
- `npx jest workflows-execute-body.spec.ts` 를 실행 — **10 passed** (plan 문서의 "나머지 9건 GREEN" + 신규 1건과 일치).
- plan(`swagger-decisions.md`)이 주장한 뮤테이션 테스트("`deprecated: true` 제거 → 신규 단언만 RED")를 독립적으로 재현: `execute-workflow.dto.ts` 의 `deprecated: true,` 줄을 제거하고 재실행 → **`[결정] \`input\` 만 deprecated 로 표시된다` 단 1건만 FAIL, 나머지 9건 GREEN** — 주장과 정확히 일치. 커밋 상태로 원복 후 `git status` 로 clean 확인.

## 발견사항

- **[INFO]** `input` description 에 새로 추가된 안내 문구("신규 통합은 `parameterValues` 를 쓴다.")는 직접 단언되지 않는다.
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:63` (description 값) / `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:174-179` (`[가드] 마커 거부 규칙이 두 필드 description 에 모두 드러난다`)
  - 상세: 기존 가드 테스트는 `description` 이 `'마커'` 부분 문자열을 포함하는지만 확인한다. 이번에 덧붙인 안내 문구("신규 통합은 `parameterValues` 를 쓴다.")는 `'마커'` 를 포함하지 않으므로, 이 문구가 실수로 삭제되거나 오탈자가 나도 기존 테스트는 계속 GREEN이다. 다만 이 문구는 순수 안내성 텍스트라 런타임·계약에 영향이 없고, 플랜(`swagger-decisions.md`)의 "검증 기준" 자체도 `deprecated` 플래그만을 뮤테이션 대상으로 명시했으므로 의도된 범위로 보인다.
  - 제안: 필수는 아님. 문구 자체를 정본으로 굳히고 싶다면 `expect(input.description).toEqual(expect.stringContaining('parameterValues'))` 류의 단언을 추가할 수 있으나, 우선순위는 낮다.

- **[INFO]** 신규 테스트(`[결정] input 만 deprecated 로 표시된다`)는 기존 `describe('스키마 렌더링')` 블록의 `beforeAll` 공유 `schema` 변수를 읽기 전용으로 사용해 격리 문제가 없다.
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:163-168`
  - 상세: `schema` 는 `beforeAll` 에서 1회 생성되고 이후 테스트들은 모두 읽기만 한다(쓰기 없음) — 순서 의존성이나 오염 가능성이 없음을 확인함. 이 항목은 결함이 아니라 검증 결과를 기록해 두는 것.

## 평가 요약 (관점별)

1. **테스트 존재 여부**: 변경(설명 문구 개정 + `deprecated: true` 추가) 각각에 대응하는 테스트가 정확히 존재한다. `deprecated` 플래그는 신규 단언으로, 설명 문구는 기존 substring 가드로 (부분적으로) 커버된다.
2. **커버리지 갭**: 위 INFO 1건(안내 문구 전체 텍스트 미검증) 외에는 갭이 보이지 않는다. DTO 자체가 데코레이터만 있는 순수 선언적 코드라 커버리지 표면이 작다.
3. **엣지 케이스**: `parameterValues`(전자)가 `deprecated` 로 잘못 전이되는 실수를 막는 **대조군 단언**(`toBeFalsy()`)이 같은 테스트 안에 포함돼 있다 — "한쪽만 검사하면 둘 다 deprecated 로 바꿔도 통과한다" 는 실패 모드를 정확히 예견하고 막았다. 뮤테이션 테스트로 실측 검증까지 마쳤다(본 리뷰에서 독립 재현 완료).
4. **Mock 적절성**: 이 파일은 실제 `SwaggerModule.createDocument` + 실제 Nest 모듈 컴파일로 OpenAPI 문서를 렌더링해 검증한다 — mock 없이 실동작을 그대로 사용해 "장식자만 맞고 실제 렌더링은 다르다" 류의 괴리 위험이 없다. 캐너리 테스트(`CustomValidationPipe` 대조군)도 실제 파이프 인스턴스를 사용한다.
5. **테스트 격리**: `beforeAll` 공유 fixture 는 읽기 전용으로만 소비되어 테스트 간 의존성이 없다. `it.each` 대조군도 매회 새 `CustomValidationPipe` 인스턴스를 생성한다.
6. **테스트 가독성**: `[캐너리]`/`[가드]`/`[결정]` 접두사 컨벤션을 그대로 따르고, JSDoc 주석에 "왜 대조군이 필요한가"까지 명시해 의도가 명확하다.
7. **회귀 테스트**: 기존 캐너리(`@Body()` 파라미터가 DTO로 타입되지 않는다, 여분 키 통과, DTO로 타입하면 파이프가 거부한다)와 기존 스키마 렌더링 테스트(`additionalProperties: true` 확인, description 마커 substring 확인)는 이번 변경 후에도 실행 결과 그대로 GREEN — 새 `deprecated` 필드나 description 문구 추가로 인한 부작용 없음을 실측 확인.
8. **테스트 용이성**: DTO가 데코레이터만 가진 순수 선언 클래스라 별도 DI 없이 리플렉션 메타데이터로 직접 검증 가능 — 구조적으로 테스트하기 쉬운 형태를 유지하고 있다.

## 요약

이번 변경은 런타임 로직 없는 순수 OpenAPI 문서화 변경(description 문구 추가 + `deprecated: true` 플래그)이며, 그 유일한 관찰 가능 효과(`deprecated` 플래그)를 정확히 겨냥한 신규 테스트가 대조군과 함께 추가되었다. 뮤테이션 테스트(`deprecated: true` 제거 → 신규 단언만 단독 RED)를 본 리뷰에서 독립적으로 재현해 plan 문서의 주장이 사실임을 확인했고, 전체 스위트 10건이 GREEN 으로 회귀 없이 통과한다. 안내 문구 전체 텍스트가 직접 단언되지 않는 점은 있으나 순수 안내성 텍스트이고 plan 이 명시한 검증 범위 밖이라 낮은 우선순위의 INFO에 그친다. 테스트 격리·가독성·mock 미사용(실동작 검증) 모두 양호하다.

## 위험도

NONE
