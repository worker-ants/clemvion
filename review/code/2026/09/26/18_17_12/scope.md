# 변경 범위(Scope) 리뷰 — rotate-bot-token-body (재검토, 리뷰 1R 조치분 포함)

검토 대상은 `origin/main...HEAD`(`6c3d27d8c`~`7d03bdfb1`, 7개 커밋 · 32개 파일) 전체다. 이전 스코프 리뷰
(`review/code/2026/09/26/17_55_14/scope.md`)가 다뤘던 19개 파일(라우트 3곳 `@ApiBody` + 헬퍼 + 캐너리 + plan/consistency
산출물)에 더해, 이번 라운드에 추가된 4개 커밋 — `ecaed6534`(lint 경고 제거) · `e3fd2b674`(plan 체크리스트 갱신) ·
`fafc6b8ac`(헬퍼 에러 경로 테스트 보강, 전회 WARNING 1 조치) · `7d03bdfb1`(전회 리뷰 산출물 커밋) — 을 새로 확인했다.

## 발견사항

(없음 — 범위 이탈 없음)

점검 관점별 확인 근거:

1. **의도 이상의 변경 / 무관한 수정** — 신규 4개 커밋은 각각 단일 목적이다.
   `ecaed6534`는 `swagger-probe.ts`의 `controller.prototype`을 `as object`로 좁히는 1줄 변경(lint
   `no-unsafe-argument` 제거, 동작 불변 — 커밋 메시지가 명시), `fafc6b8ac`는 같은 헬퍼의 두 에러 분기
   (`@Body()` 부재·둘 이상, `design:paramtypes` 부재)를 테스트로 고정하고 그 김에 변수명 `body`→`bodyArgs`,
   JSDoc 보강만 했다 — 전부 전회 리뷰(`17_55_14`) SUMMARY의 W1·INFO1~3이 지목한 항목과 1:1 대응한다.
   `e3fd2b674`는 plan 체크리스트 갱신(문서 텍스트만), `7d03bdfb1`은 전회 리뷰 산출물(SUMMARY·RESOLUTION·
   8개 에이전트 리포트·`_retry_state.json`) 커밋이다. 라우트 3곳의 핸들러 로직·`@Body()` 파라미터 타입은
   이번 4개 커밋 어디에도 나타나지 않는다.
2. **불필요한 리팩토링** — `fafc6b8ac`의 `body`→`bodyArgs` 개명과 `filter`로의 전환은 "둘 이상이면 던진다"는
   새 요구사항 자체가 요구하는 최소 변경이지, 무관한 정리가 아니다. 기존 3개 함수(`buildSwaggerDocument`,
   `schemaOf`, `propertyOf`)는 이번 4개 커밋에서도 손대지 않았다.
3. **기능 확장(over-engineering)** — 새로 추가된 테스트 4케이스(`swagger-probe.spec.ts`)는 헬퍼가 이미
   갖고 있던 방어 분기(에러 throw)를 검증할 뿐, 헬퍼의 공개 동작을 넓히지 않는다. `@Body()` 둘 이상 감지
   분기는 기존 로직(`.find` 첫 항목 암묵 채택)의 잠재 버그를 명시적 에러로 바꾼 것으로, 리뷰가 지적한
   INFO를 그대로 반영한 것이지 새 기능이 아니다.
4. **포맷팅 변경** — 4개 커밋의 diff는 모두 의미 있는 코드/문서 줄만 포함한다. 의미 없는 공백·줄바꿈
   재정렬은 관찰되지 않는다.
5. **주석 변경** — `fafc6b8ac`가 JSDoc에 추가한 두 문장(`@Body()` 가 없거나 둘 이상이면 던진다`,
   `ROUTE_ARGS_METADATA`·`RouteParamtypes` 내부 경로 경고)은 같은 커밋에서 실제로 바뀐 동작·의존성을
   그대로 서술한다 — 코드와 무관한 주석 첨삭은 없다.
6. **임포트 변경** — 이번 4개 커밋에서 새 import는 없다(`ecaed6534`는 타입 단언만, `fafc6b8ac`는 기존
   import 재사용). 미사용 import 정리나 무관한 import 변경은 없다.
7. **설정 변경** — `tsconfig`/`package.json`/lint 설정 등은 diff에 없다. `ecaed6534`는 lint 규칙이 아니라
   호출부 타입 단언으로 경고를 없앴다(설정 완화가 아니다).
8. **plan/review 산출물 포함 여부** — `plan/in-progress/rotate-bot-token-body.md`(체크리스트 갱신)와
   `review/code/2026/09/26/17_55_14/**`(전회 `/ai-review` 세션 산출물 — SUMMARY·RESOLUTION·8개 에이전트
   리포트·`_retry_state.json`)가 diff에 포함된 것은 CLAUDE.md가 명시하는 강제 워크플로(구현 완료 후
   `/ai-review` + Critical/Warning 조치는 "상시 승인된 강제 의무")의 정상 산출물이며, `developer`의 쓰기
   권한(`plan/**`, `review/**`) 범위다. 스코프 이탈이 아니라 이 작업 자체가 요구하는 workflow 부산물이다.

## 워킹트리 상태 확인

리뷰 시작 시점 `git status --short`는 이번 리뷰 세션 자신의 산출물 디렉터리
(`review/code/2026/09/26/18_17_12/`, untracked)만 보였고, 추적 파일 변경이나 `.bak*`/`.bakmut` 잔여물은
없었다 — 이전 라운드(`17_55_14`)에서 다른 reviewer가 관측·기록했던 라이브 뮤테이션(`writeOnly` 제거 +
`.bakmut`)은 이번 세션 시작 시점에는 이미 정리된 상태다. 본 리뷰는 저장소 파일에 어떤 Write/Edit도
수행하지 않았다.

## 요약

이번 재검토 대상(4개 신규 커밋 포함 32개 파일)도 전부 "OpenAPI가 요청 본문 스키마를 모르던 라우트
3곳에 문서 전용 `@ApiBody` 를 붙인다, 런타임은 불변" 이라는 단일 의도와 전회 `/ai-review` 1라운드의
Warning 조치(테스트 보강 + lint 수정) 범위 안에 있다. 새 코드/테스트는 리뷰가 명시적으로 지적한 항목에
정확히 대응하는 최소 변경이며, 무관한 리팩토링·기능 확장·포맷팅·주석·임포트·설정 변경은 발견되지
않았다. plan·review 산출물 커밋은 프로젝트 워크플로가 요구하는 정상 부산물이다.

## 위험도

NONE
