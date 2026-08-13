# 테스트(Testing) 리뷰

## 검증 방법

프롬프트가 크기 제한으로 여러 파일의 diff 를 생략해, 다음 파일들을 저장소에서 직접 열어
전체 내용을 확인했다: `source-scan.ts`/`.spec.ts`, `assert-row-array.ts`/`.spec.ts`,
`update-returning-rows.ts`/`.spec.ts`, `auth-oauth.service.ts`/`.spec.ts`,
`auth-oauth-callback.e2e-spec.ts`, `knowledge-base.service.ts`/`.spec.ts`,
`execution-engine.service.ts`(발췌: `admitExecutionOrDefer`, `updateExecutionStatus`)/`.spec.ts`(발췌),
`update-returning-tuple-shape.md`. 또한 다음 unit 스위트를 실제로 재실행해 GREEN 을 직접 확인했다
(주장을 그대로 신뢰하지 않고 재검증):

```
assert-row-array.spec.ts + update-returning-rows.spec.ts + source-scan.spec.ts → 3 suites / 25 tests passed
auth-oauth.service.spec.ts                                                     → 1 suite  / 16 tests passed
knowledge-base.service.spec.ts                                                 → 1 suite  / 57 tests passed
execution-engine.service.spec.ts                                               → 1 suite  / 448 tests passed
```

`assert-row-array.spec.ts` 의 구조적 가드가 단언하는 `guards: 1`(execution-engine)·`guards: 1`
(executions.service) 값과 `update-returning-rows.spec.ts` 의 `EXPECTED`/`[3, 10, 0]` 값을
실제 소스의 `updateReturningRows`/`assertRowArray` 호출 수와 대조했고 모두 일치했다(드리프트 없음).
`knowledge-base.service.ts` 의 `updateReturningRows` 호출 5곳(re-extract CAS·re-embed CAS·
embedding 재큐·graph 재큐·reset) 전부에 `detail` 인자가 채워져 있는 것도 확인했다.

## 발견사항

- **[INFO]** 신규 튜플-shape 회귀 테스트는 각 소비 지점마다 전용으로 추가돼 있고
  (`updateExecutionStatus`/`admitExecutionOrDefer`/OAuth 콜백/KB 5곳) RESOLUTION 문서가 주장하는
  뮤테이션 사살(5/5, 2/2 등)도 코드 구조상 타당하다 — 다만 이 회귀 테스트 대상 **밖의** 나머지
  테스트 다수는 여전히 비-튜플(행 배열) mock 을 그대로 쓴다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` 의
    `dataSource.query.mockResolvedValueOnce([validState])` 형태 4곳(`returns tokens for existing
    OAuth user`, `conditionally links existing email user`, `creates new user`,
    `recovers from concurrent first-time OAuth`) / `codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts` 의
    `mockDataSource.query: jest.fn().mockResolvedValue([])`(전역 기본값) 및 `reEmbedAll`/
    `retryFailedDocuments` 다수 테스트의 `mockResolvedValueOnce([{ id: 'd1' }, ...])`(행 배열) 형태.
  - 상세: `updateReturningRows` 가 튜플·행 배열 양쪽을 흡수하므로 현재는 기능적으로 안전하지만,
    이 legacy mock 들이 인코딩하는 shape 은 이 PR 이 "4개월간 아무도 못 봤다" 고 지목한 바로 그
    틀린 가정(`[row, ...]` 이 실제 드라이버 응답이라는 착각)이다. 새 코드 경로가 이 legacy
    mock/기본값 위에서 작성되고 전용 튜플 테스트를 빠뜨리면, 이번에 진단된 결함 클래스가 그
    지점에서 다시 조용히 통과할 수 있다 — `update-returning-tuple-shape.md` §후속 자체가 "구조적
    가드가 이 3개 파일 하드코딩" 한계를 이미 인지하고 있어(AST/래퍼 검토를 backlog 로 남김),
    이 관찰은 새로운 갭이 아니라 그 backlog 항목의 근거를 테스트 관점에서 한 번 더 확인한 것.
  - 제안: 즉시 조치 불요. 신규 raw UPDATE/DELETE 소비 지점을 추가하는 다음 PR 에서 "전용 튜플
    테스트를 최소 1건 곁들인다" 를 리뷰 체크리스트 항목으로 못박거나, plan 이 이미 적어 둔
    `DataSource`/`EntityManager` 얇은 래퍼(호출 즉시 언랩을 구조적으로 강제)를 우선순위 있게
    검토할 것.

- **[INFO]** `admitExecutionOrDefer` 의 "0행 매칭(cap 초과)" 테스트가 `not.toBe('admitted')`
  대신 `resolves.toBe('deferred')` 로 정확한 값을 단언하도록 고쳐져 있다(주석에 "느슨한 단언이
  버그를 4개월 숨긴 게 이 PR 의 교훈인데 새 테스트가 그걸 재도입한 셈이었다" 라고 자기 반성까지
  남김). 이런 형태의 vacuous-assertion 재발 방지가 테스트 코드 자체에 문서화돼 있는 점은 긍정적
  신호다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
    (`실측 shape 로 0행 매칭(cap 초과)이면 admitted 가 아니어야 한다` 테스트)

- **[INFO]** `assert-row-array.spec.ts` 와 `update-returning-rows.spec.ts` 는 이번 라운드에서
  `countCalls`/`stripComments` 를 `__testing__/source-scan.ts` 로 공유하도록 통합됐지만(직전
  라운드 `00_54_01` WARNING 1 이 지적한 "주석 스트리핑 비대칭" 을 정확히 닫음), `SRC =
  join(__dirname, '..', '..')` 계산과 `readFileSync(join(SRC, rel), 'utf8')` 루프 자체는 두
  파일에 여전히 각자 인라인돼 있다(직전 라운드 `22_45_24` maintainability INFO 가 이미 지적한
  잔여분). 급하지 않고, 세 번째 유사 구조 가드가 생기는 시점에 추출해도 늦지 않다는 그 판단에
  동의한다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts`(`SRC`/`CONSUMING_QUERY`
    정의부) / `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(`SRC`/`CONSUMING`
    정의부)

- **[INFO]** `source-scan.spec.ts` 자체가 두 구조적 가드의 "카운트 방식" 을 정하는 단일 출처인
  만큼, 6개 테스트로 촘촘히(제네릭/일반 호출 동시 카운트, 접두 심벌 오탐 방지, 줄 끝 주석 배제,
  문자열 내 `//` 절단이라는 **알려진 한계를 "의도된 방향"으로 명시 고정**) 검증돼 있다. 한계를
  숨기지 않고 실패 방향(RED)까지 테스트로 못박은 점이 좋다.
  - 위치: `codebase/backend/src/common/utils/__testing__/source-scan.spec.ts`

## 요약

이 변경분(UPDATE/DELETE `RETURNING` 튜플 shape 결함과 그 후속 auth-oauth `remember_me` 컬럼명
결함의 수정)은 이미 3차례의 `/ai-review` 라운드(`20_36_35`→`22_45_24`→`23_07_11`)를 거쳐
CRITICAL/WARNING 이 전량 조치되고 뮤테이션 테스트(KB 5/5, engine/auth 각각 확인)로 사살이
검증된 상태다. 직접 재실행한 4개 관련 스위트(unit 546건)도 전부 GREEN 이었고, 구조적
회귀 가드가 단언하는 고정 수치(`guards: 1`, `[3, 10, 0]`, `detail` 인자 5/5)도 실제 소스와
대조해 드리프트가 없음을 확인했다. 실 드라이버 위에서 성공/거절 양방향과 `remember_me` 대조군까지
검증하는 e2e(`auth-oauth-callback.e2e-spec.ts`)가 신설된 것도 이 결함 클래스(단위 mock 이 코드와
같은 착각을 공유해 GREEN 을 만드는 유형)에 대한 적절한 대응이다. 남은 것은 CRITICAL/WARNING 급이
아니라 INFO 수준의 구조적 관찰뿐이다 — 신규 튜플 회귀 테스트가 붙지 않은 나머지 legacy 테스트
다수가 여전히 비현실적(행 배열) mock 을 쓰고 있어, 이번에 진단된 결함 클래스가 향후 새 소비
지점에서 재발할 잠재 경로가 완전히는 닫히지 않았다는 점인데, 이는 plan 문서 스스로도 이미
backlog(구조적 래퍼/AST 검토)로 인지하고 있다.

## 위험도

LOW
