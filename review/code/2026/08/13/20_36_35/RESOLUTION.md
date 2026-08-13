# RESOLUTION — `20_36_35`

CRITICAL 2 / WARNING 8. **CRITICAL 2건 + WARNING 6건 조치**, 2건은 근거를 적어 넘긴다.

## CRITICAL 1 — 같은 결함이 소셜 로그인에 살아 있었다 (requirement)

**지적이 맞고, 내 감사가 틀렸다.** 확인:

```ts
// auth-oauth.service.ts handleCallback
const consumed = await this.dataSource.query<AuthOAuthState[]>(
  'DELETE FROM auth_oauth_state WHERE state = $1 AND expires_at > NOW() RETURNING *', [state]);
if (consumed.length === 0) { throw … }        // 항상 2 → 만료·재사용 state 를 못 거절
const record = consumed[0];                    // 행이 아니라 **행 배열**
if (record.provider !== provider) { throw … }  // undefined !== 'google' → **항상 참**
```

→ **모든 정상 콜백이 `OAUTH_STATE_MISMATCH` 로 실패.** Google/GitHub 로그인 상시 불가.

**왜 내 "전역 감사" 가 놓쳤나.** 감사 스크립트가 SQL 첫 키워드를 이렇게 찾았다:

```python
re.search(r"`\s*\n?\s*(WITH|SELECT|UPDATE|DELETE|INSERT)", sql, re.I)
```

**백틱으로 시작하는 SQL 만** 봤다. 이 쿼리는 작은따옴표다. 도구의 사각지대가 곧 감사의
사각지대였고, 나는 그 결과를 "전역 감사" 라고 불렀다. 정규식을 따옴표 무관으로 고쳐 재실행:

| 재감사 결과 | |
|---|---|
| 미처방 신규 | `auth-oauth.service.ts:140` **1건** |
| 오탐 | engine 2곳(헬퍼가 SQL 아래라 탐지 창 밖), `integration-oauth` 2곳 |

`integration-oauth.service.ts` 는 리뷰어 말대로 **이미 정확**했다 — 튜플을 명시 타입으로
받고 `queryResult[0]` 을 쓰며, 주석에 *"TypeORM 0.3.x 의 PostgresQueryRunner 는 DELETE
결과를 `[rowsArray, rowCount]` 튜플로 반환"* 이라고 적혀 있다. **이 지식이 이미 있던 네 번째
자리**다. 세 곳이 알고 있었는데 네 번째가 몰라서 로그인이 깨져 있었다.

**조치**: RED→GREEN 으로 수정. 실측 shape 테스트 2건(성공 콜백 / 0행 거절) 추가 →
수정 전 *"정상 콜백이 성공해야 한다"* 가 RED, 수정 후 16 passed. 구조적 가드의 `EXPECTED`
에도 이 파일을 추가했다.

> 이 스위트도 `[validState]`(행 배열)를 mock 하고 있었다 — engine 과 **똑같은 원인**이다.
> e2e 도 없다. 반증 증거가 없었기에 4개월간 아무도 못 봤다.

## CRITICAL 2 — 고친 함수 안에 정반대 옛 주석 (documentation)

**조치 완료.** `admitExecutionOrDefer` 안에 *"`RETURNING id` 이므로 실제 shape 은 행
배열이다"* 가 남아 있었다 — **이번 결함의 근본 원인이 된 바로 그 믿음**이다. 새 주석을 20줄
아래 붙여 놓고 거짓 문장을 남긴 셈이라, 다음 사람이 위를 읽으면 같은 실수를 한다. 삭제하고
하나로 통합했다.

## WARNING 조치

| # | 처분 |
|---|---|
| 1 | **부분 조치 — 뒤 라운드가 반증했다.** kb CAS 락 1곳은 맞다. 그러나 *"engine `updateExecutionStatus` 는 이미 기존 스위트가 real-shape mock 으로 덮는다"* 는 **검증 없이 쓴 거짓**이다. `22_45_24` CRITICAL 1 이 잡았고, 확인해 보니 그 지점을 잡는 건 비배열 가드 테스트뿐이라 **튜플과 행 배열을 의미로 가르는 테스트는 없었다.** `22_45_24` RESOLUTION 에서 판별 테스트 2건을 추가하고 뮤테이션으로 확인했다 |
| 2 | **부분 조치 — 7곳이 아니라 6곳이었다.** `retryFailedDocuments` 의 embedding 분기가 남았고, 33줄 아래 짝인 graph 분기는 고쳐져 있어 나란히 보면 티가 났다(`22_45_24` WARNING 2). 다음 라운드에서 마저 고쳤다 |
| 4 | **조치** — 헬퍼에 선택적 `detail` 인자 복원. `assertRowArray` 가 주던 호출부 문맥(어느 execution·어느 상태 전이)을 잃지 않는다 |
| 5 | **조치** — prettier 오류 정정, `lint --max-warnings 0` 통과 확인 |
| 6 | **조치** — 헬퍼 JSDoc 에 관용구 4종 표 + "신규 지점은 이 헬퍼, 나머지 셋은 과거 호환 유지" 명시 |
| 7 | **조치** — 구조적 가드 실패 시 "개수 변화 ≠ 회귀" 판단 절차를 주석으로 |
| 3 | **넘김** — CHANGELOG. 이 저장소의 Unreleased 관행은 맞으나, 이번 건은 **배포 영향 서술(W8)** 과 함께 써야 의미가 있고 그건 릴리스 시점 판단이다. plan 후속에 등재 |
| 8 | **넘김(관측 항목)** — 배포 후 행동 변화(admission 2s 지연 소멸·cap 실제 발동·KB 409 첫 관측)는 조치가 아니라 **관측 계획**이다. plan 에 등재했고 e2e 로 (a)는 이미 실측(4191→2242ms) |

## 부수 발견 — 직전 PR 의 가드가 나를 잡았다

`assert-row-array.spec.ts` 의 구조적 가드가 RED 로 떨어졌다. 내가 `assertRowArray` 2곳을
`updateReturningRows` 로 바꿨기 때문이다 — **가드가 설계대로 동작했다.** 두 헬퍼의 분담을
명시하며 갱신했다: **SELECT → `assertRowArray`, UPDATE/DELETE → `updateReturningRows`**.

## 검증

- auth-oauth **RED→GREEN** (16 passed), kb CAS 락 뮤테이션 **사살**
- 64 스위트 **1368 passed**
- `lint --max-warnings 0` 통과 · ratchet **199/38 baseline 일치**
