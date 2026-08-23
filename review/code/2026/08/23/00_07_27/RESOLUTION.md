# RESOLUTION — `00_07_27`

**Critical 0 · Warning 3 · INFO 11.** Warning 3건 모두 반영했다. 셋 다 정당한 지적이다.

## W1 — `input` description 이 마커 거부 규칙을 안 적었다 (제 결함)

실측 확인: 컨트롤러가 `parameterValues ?? input.parameters` 로 두 출처를 합류시킨 뒤
`resolveTriggerParametersRejectingMasked()` 를 **한 번** 부른다
(`workflows.controller.ts:300-317`). 즉 **두 필드 모두 거부 대상**인데 `parameterValues`
description 에만 적었다 — `input.parameters` 로 보내는 클라이언트는 규칙을 못 본다.

- `input` description 53 → **74자**에 *"그 값도 동일한 마커 거부 대상"* 추가
- DTO docstring 에 **왜** 두 필드가 같은지(합류 후 단일 호출) 명시

> 길이가 늘었지만 이제 이 필드는 §3 이 2026-08-22 에 넓힌 **요청값 정책 거부 캐비엇**
> 클래스에 해당한다 — 예외가 정확히 이 경우를 위해 확장된 것이라 자기정합적이다.

## W3 — 캐너리가 이 PR 의 **목적**은 안 지키고 있었다

가장 값진 지적이다. 기존 캐너리는 *"런타임 계약이 안 깨졌는가"* 만 본다. 그것만으로는
`@ApiBody` 가 형제 `ExecuteNodeDto` 를 잘못 참조하는 복붙 실수를 **아무도 못 잡는다** —
런타임은 어차피 안 바뀌므로 전부 GREEN 이다.

추가한 가드 4건:

| 단언 | 무엇을 막나 |
| --- | --- |
| 실 컨트롤러 `swagger/apiParameters` 의 body 항목이 `ExecuteWorkflowDto` | **잘못된 DTO 참조** |
| 같은 항목의 `required: false` | 본문 필수화(계약 축소) |
| 렌더링 스키마의 두 필드가 `type: object` + `additionalProperties: true` | 열린 map 표기 회귀 |
| 두 필드 description 에 마커 규칙 존재 | W1 재발 |

### 판별력을 뮤테이션으로 실증했다

리뷰어가 지목한 바로 그 실수를 넣었다 — `@ApiBody({ type: ExecuteNodeDto })`.

- `tsc` 선검증 **0 오류** → 유효 뮤턴트(컴파일 실패로 인한 거짓 RED 아님)
- 결과: **1 failed / 8 passed** — 새 가드 **단독**으로 RED. 기존 8건은 전부 통과했다.

**자매 패턴과 다른 점**: 저장소의 기존 OpenAPI 스펙(`interact-ack-response.dto.spec.ts`)은
stub 컨트롤러만 쓴다. stub 만 보면 *"실제 엔드포인트가 올바른 DTO 를 가리키는가"* 가 여전히
사각지대라, **실 컨트롤러 메타데이터**를 함께 본다.

## W2 — plan 체크리스트 stale

구조적 문제다 — 체크리스트의 마지막 항목(`/ai-review`)은 정의상 그것을 체크하는 커밋보다
먼저 끝난다. 이 PR 의 마무리 커밋에서 전부 `[x]` 로 갱신했다.

## INFO 11건 — 처분

| INFO | 처분 |
| --- | --- |
| #7 `input` 길이 초과 | **해소됨** — W1 반영으로 §3 예외 클래스에 정식 해당 |
| #4 rationale 3중 중복 | **안 한다.** DTO docstring 이 SoT 이고 plan·트래커는 그 시점 기록이다. 완료 plan 은 봉인되므로 링크로 바꿔도 drift 는 안 준다 |
| #9 캐너리의 "마지막 파라미터 = body" 가정 | **부분 해소** — 새 가드가 `apiParameters` 의 `in === 'body'` 로 **위치 무관** 식별을 하므로, 시그니처가 바뀌어도 그쪽은 유효하다 |
| #3 클래스명에 `ForDocsOnly` 접미사 | **안 한다.** 이름을 길게 하는 대신 캐너리가 오용을 막는다 — 이름 규약은 강제되지 않고 테스트는 강제된다 |
| #10 유저 가이드에 거부 규칙 서술 없음 | **안 한다.** 형제 `re-run` 과도 대칭인 선존 갭이고 plan 이 범위를 명시적으로 좁혔다 |
| #1 · #2 · #5 · #6 · #8 · #11 | 확인성 기록 / 선택적 nit — 조치 불요 |
