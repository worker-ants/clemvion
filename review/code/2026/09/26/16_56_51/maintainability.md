# 유지보수성(Maintainability) 리뷰

## 스코프 메모

이번 리뷰 payload 는 30개 파일로 조립되어 있으나, 그중 실제 애플리케이션/테스트 코드는
`codebase/backend/test/workflow-assistant.e2e-spec.ts` 1건뿐이다. 나머지 29건은
`plan/in-progress/*.md`(작업 추적 문서), `review/consistency/**/*.md`·`*.json`(consistency-checker
산출물·retry state), `spec/3-workflow-editor/_product-overview.md`(spec 정정)로, 함수·클래스·
분기 구조가 없는 문서·상태 파일이라 "함수 길이/중첩 깊이/순환 복잡도" 같은 코드 메트릭이
적용되지 않는다. 이 리뷰는 실제 코드 변경분(e2e spec 파일)에 집중했다.

## 발견사항

- **[INFO]** 테스트 F 가 "세션 있음"과 "세션 없음(`data: null`)" 두 시나리오를 하나의 `it` 블록에 담고 있다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:185` (`it('F. sessions/latest — ...')` 시작부터 224줄 종료까지)
  - 상세: 기존에는 응답 상태를 `[200, 204, 404]` 로 받아 `if (latest.status === 200)` 분기로 조건부 검증하던 것을, 이번 변경으로 분기를 없애고 `toBe(200)` 단일 단언으로 좁힌 것은 복잡도를 낮춘 좋은 방향이다. 다만 그 뒤에 "빈 워크플로에서 `sessions/latest` 를 물어 `{ data: null }` 을 본다"는 별개 시나리오를 같은 테스트 안에 추가로 이어붙였다. 두 시나리오는 서로 다른 전제(세션 존재 vs 부재)를 검증하므로, 앞부분이 실패하면 뒷부분(null 케이스)이 실행되지 않고 테스트 리포트도 어느 시나리오가 깨졌는지 한 번에 드러내지 않는다.
  - 제안: `it('F1. ... 방금 만든 세션을 반환', ...)` / `it('F2. ... 세션이 없으면 data: null', ...)` 로 분리하면 실패 시 원인 파악이 더 빨라진다. 다만 파일 내 테스트 H 도 이미 여러 검증을 한 `it` 에 묶는 스타일이라, 이 파일의 기존 컨벤션과는 크게 어긋나지 않는 낮은 우선순위 제안이다.

- **[INFO]** 응답 변수명 `none` 이 값이 아니라 HTTP 응답 객체를 가리켜 의미가 어긋난다
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:213` (`const none = await request(...)`)
  - 상세: `none` 이라는 이름은 "값이 없음"을 연상시키지만 실제로는 supertest 의 `Response` 객체이고, `data: null` 은 이후 `none.body` 를 단언해서 확인한다. 파일의 다른 변수들(`latest`, `detail`, `create`, `patch`)은 모두 "무엇을 담은 응답인지"를 동사/명사로 나타내는데, `none` 만 응답이 담긴 *상태*를 이름으로 썼다.
  - 제안: `emptyLatest` 또는 `latestForEmptyWorkflow` 처럼 "무엇에 대한 응답인지"를 드러내는 이름으로 바꾸면 다른 변수 네이밍과 일관된다.

- **[INFO]** `assertMatchesContract(x.body.data, await contractForDto(Dto))` 패턴이 파일 전체에서 반복된다(이번 diff 로 1곳 추가)
  - 위치: `codebase/backend/test/workflow-assistant.e2e-spec.ts:72-75, 93-96, 112-115, 202-205(신규), 260-263, 340-343` 등 7회 이상
  - 상세: 이번 diff 가 202-205줄에 같은 3줄짜리 패턴을 하나 더 추가했다. 이 파일에 국한된 신규 중복은 아니고 기존에도 반복되던 관용구이지만, 반복 횟수가 늘어날수록 `contractForDto` 호출 시그니처가 바뀔 때 여러 곳을 동시에 고쳐야 하는 부담이 커진다.
  - 제안: `expectContract(body, Dto)` 같은 로컬 헬퍼로 감싸면 향후 계약 검증 방식이 바뀔 때 한 곳만 고치면 된다. 이번 PR 의 필수 수정은 아니며, 다음에 이 파일을 만질 때 함께 정리해도 되는 낮은 우선순위 항목이다.

## 좋았던 점 (참고)

- 테스트 F 의 분기 제거(`if (latest.status === 200) {...}` → `expect(latest.status).toBe(200)`)는 순환 복잡도를 낮추고 라우트 순서 회귀(`sessions/:id` 가 `latest` 를 가로채는 경우 `ParseUUIDPipe` 400)까지 같은 단언으로 가르게 만들어, 테스트 의도를 코드로 명확히 드러낸다.
- 각 변경 지점 위에 "왜 이렇게 테스트했는지"(예: `findLatestActive` 의 정렬 기준, `ApiOkWrappedNullableResponse` 의 null 쪽, 도구 호출 선택 키 두 끝)를 설명하는 한국어 주석이 충실해, 코드만 봐서는 알기 어려운 설계 의도가 잘 남아 있다. 파일 기존 스타일과도 일관된다.
- 신규 `toolCalls[1]`(`call_2`, 선택 키 전부 생략)은 기존 `call_1`(선택 키 전부 채움)과 짝을 이뤄 계약 검증기가 두 극단을 모두 지나가게 하려는 의도가 명확하고, 네이밍(`call_1`/`call_2`)도 파일의 기존 관용(`s1`/`s2`)과 일관된다.

## 요약

실질적인 코드 변경은 e2e 테스트 파일 한 곳으로 한정되며, 기존 분기(`if (latest.status === 200)`)를 제거해 복잡도를 낮추고 새 시나리오(빈 워크플로의 `data: null`, 도구 호출 선택 키 전부 생략)를 기존 파일의 서술 스타일과 네이밍 관용을 그대로 따라 추가했다. 함수 길이·중첩·매직 넘버·중복 등에서 구조적 문제는 없고, 지적한 세 건(F 의 다중 시나리오 결합, `none` 네이밍, 계약 검증 보일러플레이트 반복)은 모두 INFO 수준의 개선 여지이며 이 PR 을 막을 사유가 아니다. 나머지 29개 파일(plan/spec/review 산출물)은 코드가 아니라 문서·상태 파일이라 이 리뷰의 코드 메트릭 대상에서 제외했다.

## 위험도

LOW
