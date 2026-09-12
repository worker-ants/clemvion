---
worktree: filter-pg-invalid-text
started: 2026-09-12
owner: developer
spec_impact: none
---

# 커서의 id 성분이 검증 없이 `uuid` 컬럼에 바인딩된다 — 인증 사용자가 500 을 낼 수 있다

트래커 항목 *"`GlobalExceptionFilter` 가 SQLSTATE 22P02 를 분류하지 않는다"* 로 착수했는데,
**등재할 때 적어 둔 처방이 실측에 반증됐고 그 아래에 진짜 결함 2건이 있었다.** 아래 순서로 적는다.

> **스코프 고지** — 이 문서는 **keyset 커서의 id 성분 검증**이다. `#1328`(경로 파라미터
> `ParseUUIDPipe`)과 같은 결함 클래스(비-UUID 가 `uuid` 컬럼까지 흘러 22P02 → 500)지만 입구가
> 다르다.

## A. 등재된 처방(필터에 22P02 → 400 분기)은 **이 저장소에서 틀리다**

착수 조건으로 *"지금 22P02 로 500 을 받는 자리가 어디이고 그중 400 이 맞지 않은 곳이 있는지를
먼저 세라"* 를 적어 뒀다. 세어 보니 **400 이 맞지 않은 곳이 있다 — 그리고 spec 이 이미 그
이유를 적어 두었다.**

`spec/5-system/3-error-handling.md §1` (`VALIDATION_ERROR` 행):

> **JWT 클레임은 검증하지 않는다** — 서버가 서명한 값이라 거기서 400 을 내면 **서버 버그를
> 클라이언트 오류로 보고**하게 된다.

필터는 값의 **출처를 모른다**. 22P02 를 일괄 400 으로 바꾸면 바로 이 원칙을 어긴다 — 서버가
만든 잘못된 값이 DB 까지 갔을 때도 "클라이언트 잘못" 이라고 답하게 된다.

> 이건 새로 세운 원칙이 아니라 **기존 정식 Rationale 의 같은 축**이다 —
> [`spec/data-flow/12-workspace.md` §"`X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 — UUID 검증
> 강도 비대칭"](../../spec/data-flow/12-workspace.md). 거기서도 판정의 핵심은 *"이 값이 어느
> 층에서 왔는가"* 이고, 그래서 같은 UUID 인데 입구마다 술어가 다르다. 필터는 **모든 입구의
> 아래**에 있어 그 질문에 답할 수 없다 (`--impl-prep` cross_spec INFO#1).

더 나쁜 것은 **신호가 사라진다**는 점이다. 이번에 결함 2건을 찾은 실마리가 정확히 *"22P02 가
500 으로 뜬다"* 였다. 500 은 "어느 입구가 검증을 빠뜨렸다" 는 뜻이고, 그걸 조용한 400 으로
바꾸면 다음 입구 누락은 아무도 모른다. 저장소가 택한 전략은 **입구마다 조기 거부**이고
(`workspace-context.util.ts` 가 그 선례), 필터의 500 은 그 전략의 **미이행 알람**이다.

실측으로 확인한 인접 사실:

| 축 | 실측 | 판정 |
|---|---|---|
| 필터의 기존 SQLSTATE 분기 | 23505 → 409 **만** | 23502(not-null)는 500 유지 — 캐너리 2개가 고정 중 |
| 23502 를 500 으로 두는 이유 | 앱이 만든 잘못된 row = 서버 버그 | **22P02 도 출처가 서버면 같은 부류** |
| 유일한 "사용자가 SQL 을 쓴다" 경로 (DB Query 노드) | `mapDbError` 로 **자체 catch** → error 포트 | 필터에 도달하지 않음 — 반례 아님 |
| 22P02 의 진단 가능성 | `logger.error("Unhandled exception: …", stack)` 에 드라이버 원문(`invalid input syntax for type uuid: "…"`)+SQL 포함 | 로그로 추적 가능 |

**처분: 필터는 건드리지 않는다.** 트래커 항목은 won't-do 로 종결하되 **근거를 함께** 남긴다
(다음 사람이 같은 제안을 다시 하지 않도록).

## B. 진짜 결함 — keyset 커서 2곳이 id 성분을 검증하지 않는다

필터가 아니라 **입구**를 찾으니 나왔다. 전수: 사용자 입력 커서를 쿼리 조건에 바인딩하는 자리는
**정확히 2곳**이다(세 번째 `integration-expiry-scanner` 는 자기가 만든 id 를 이어 쓰는 내부
배치라 대상 아님).

| 자리 | 검증하는 것 | 검증 안 하는 것 | 실패 시 계약 |
|---|---|---|---|
| `auth/login-history.service.ts` `decodeCursor` | 구분자 · 날짜(`Number.isNaN`) | **id** | `null` 반환 → 조용히 1페이지 |
| `executions/background-runs/background-runs.service.ts` `decodeCursor` | base64·JSON·필드 타입·날짜 | **`i`** | 400 `INVALID_CURSOR` throw |

두 id 가 바인딩되는 컬럼은 **둘 다 `@PrimaryGeneratedColumn('uuid')`** 다
(`LoginHistory.id`, `NodeExecution.id` — 실측). 따라서:

```
GET /api/users/me/login-history?cursor=2026-01-01T00:00:00Z|not-a-uuid
  → (lh.created_at, lh.id) < (:cursorTs, :cursorId) 에 'not-a-uuid' 바인딩
  → SQLSTATE 22P02 → 필터 분기 없음 → 500 INTERNAL_ERROR
```

**인증된 사용자가 임의로 5xx 를 만들 수 있다.** 데이터 누출은 없다(메시지 마스킹됨). 실피해는
운영 쪽이다 — 정상 동작 중인 서버가 5xx 알람을 낸다.

### 처분 — 각자의 **기존 계약을 유지**한 채 id 만 검증한다

계약을 통일하고 싶은 유혹이 있지만(한쪽은 무시, 한쪽은 400), 그건 **관측 가능한 동작 변경**이고
이 결함과 별개 축이다. 각 디코더의 **다른 실패 모드가 이미 하는 일**에 맞춘다:

- `login-history`: 잘못된 날짜·구분자와 **같이** `null` 반환 → 1페이지. (500 → 200)
- `background-runs`: 잘못된 날짜·형태와 **같이** 400 `INVALID_CURSOR`. (500 → 400)

술어는 **새로 만들지 않고** `common/utils/uuid.ts` 의 `isUuidShaped` 를 쓴다 — 그 함수의 존재
이유가 정확히 *"Postgres 가 `uuid` 컬럼 값으로 파싱할 수 있는가"* 이고, 더 엄격한
`isValidUuid` 를 쓰면 **인가 응답을 형식 오류로 뒤바꾸는** 비대칭 규약을 어긴다
(`spec/data-flow/12-workspace.md §Rationale "UUID 검증 강도 비대칭"`).

> **적용 범위가 넓어진다** (`--impl-prep` rationale_continuity INFO#2). 그 Rationale 의 원문
> 서술은 **워크스페이스 헤더**라는 인가 컨텍스트를 주어로 삼는데, 여기서는 커서의 id — 인가
> 입력이 아니라 **리소스 지목** — 에 같은 술어를 쓴다. 원칙 위반은 아니다: 술어가 답하는
> 질문(*"Postgres 가 파싱하는가"*)은 컨텍스트와 무관하고, 커서 id 에 더 엄격한 술어를 쓰면
> **정상 조회 가능한 커서를 거부**하게 된다(nil UUID·v7 등). 다만 그 함수의 소비처가
> 워크스페이스 밖으로 나가므로 여기 적어 둔다.

### 가드는 만들지 않는다 — 그 판단의 근거

`#1328` 은 가드를 만들었다. 거기는 관례가 **135/136** 으로 이미 보편이고 *"id-형 `@Param` 에
`ParseUUIDPipe`"* 라는 **기계적으로 판정 가능한 서명**이 있었다. 여기는 다르다:

- 모집단이 **2**다. 베이스라인 0 을 지키는 가드의 값이 거의 없다.
- *"커서 디코더"* 는 기계적 서명이 없다 — 이름도 형태도 인코딩도 제각각이고(파이프 구분 vs
  base64 JSON), 판정하려면 "이 문자열이 uuid 컬럼에 바인딩되는가" 라는 **데이터플로 분석**이
  필요하다. 정적 스캐너의 범위 밖이다.

대신 **회귀 테스트 2개**로 각 자리를 고정한다. 가드를 안 만드는 근거를 여기 적어 두는 것이
다음 사람이 "왜 #1328 은 가드가 있는데 여기는 없나" 를 묻지 않게 하는 값이다.

## C. 등재만 하는 것

- **두 커서 디코더의 실패 계약이 다르다** (무시 vs 400). 통일은 관측 가능한 동작 변경이라
  제품 결정이 필요하다 — 이번 배치는 각자의 계약을 **유지**했다.
- **두 디코더가 손으로 각각 구현돼 있다.** 공용 keyset-cursor 헬퍼로 묶을 여지가 있으나
  인코딩이 달라(파이프 vs base64) 단순 추출이 아니다.

## D. `--impl-prep` 이 낸 spec 항목 3건 — 전부 planner 소관이라 등재만

`review/consistency/2026/09/12/22_51_25` (**BLOCK: NO**, Critical 0). WARNING 4 중 셋이
spec 문서 갭이고, 하나(체크리스트 대상 미명시)는 위에서 고쳤다.

| # | 갭 | 왜 planner 인가 |
|---|---|---|
| 1 | Background Runs REST 의 에러 코드 4종(`INVALID_CURSOR`·`INVALID_LIMIT`·`EXECUTION_NOT_FOUND`·`BACKGROUND_RUN_NOT_FOUND`)이 중앙 카탈로그(`3-error-handling.md §1`)에 미등재 — §1.5~§1.12 가 예외 없이 지켜 온 관행에서 이 도메인만 빠졌다 | `spec/**` 편집이고 내가 쓴 문장이 아니다 |
| 2 | `2-api-convention.md §8.2` 가 cursor 페이지네이션을 **단일 표준**(opaque base64 · 실패 시 400)으로만 적는데 `login_history` 는 다른 패턴(평문 `<iso>\|<id>` · 실패 시 무시)이다. 그 예외가 어디에도 없다 | 〃 |
| 3 | `3-error-handling.md §1.6` 각주가 `EXECUTION_NOT_FOUND` 를 "표준 코드 재사용" 이라 적는데, 같은 문서 §1.9 가 세운 기준(도메인 특화 wire 리터럴 = 직접 등재)과 어긋난다 | 〃 |

> **2번은 이 배치와 직접 얽힌다.** 나는 두 디코더의 실패 계약을 **각자 유지**하기로 했는데,
> 그건 문서화되지 않은 비대칭을 사실상 **고정**하는 선택이다(checker 의 표현). 그래서
> 양쪽 코드 주석에 *"형제는 다르게 동작한다 — 통일은 제품 결정"* 을 남겨 최소한 코드에서는
> 보이게 한다. 통일 자체는 §C 로 등재한다.

## 체크리스트

- [x] A: **`plan/in-progress/spec-draft-nullable-notation-followups.md`** 의 *"`GlobalExceptionFilter`
      가 SQLSTATE 22P02 를 분류하지 않는다"* 항목을 **won't-do 로 종결** — 그 항목이 적어 둔
      처방(필터에 22P02→400 분기)은 §A 의 결론과 **정면으로 반대**이므로, 대상 파일을 명시하지
      않은 채 진행하면 두 문서가 모순된 채 공존한다 (`--impl-prep` plan_coherence WARNING).
      원문은 취소선으로 남기고 해소 근거를 각주로 단다.
- [x] B: `login-history.service.ts` `decodeCursor` 가 id 를 검증
- [x] B: `background-runs.service.ts` `decodeCursor` 가 `i` 를 검증
- [x] B: 회귀 테스트 **4개** — 각 자리에 (a) 비-UUID 거부 (b) **느슨한 형태 통과** 대조군.
      수정 전 프로브가 실제로 RED 였다: `"cursorId": "not-a-uuid"` 가 `lh.id` 에 바인딩되는
      호출이 그대로 찍혔다. **기존 fixture 가 그 결함을 정상으로 고정하고 있었다** —
      `'applies composite cursor filter'` 의 커서 id 가 `'cursor-id'`(비-UUID)였다.
- [x] B: 뮤테이션 **4/4 예측 일치**, 원복 후 baseline GREEN
      | 뮤턴트 | 예측 | 실측 |
      |---|---|---|
      | M1 login-history 의 id 검증 제거 | RED | RED |
      | M2 background-runs 의 `i` 검증 제거 | RED | RED |
      | M3 [대조군] login-history 를 **엄격한** 술어로 교체 | RED | RED |
      | M4 [대조군] background-runs 를 **엄격한** 술어로 교체 | RED | RED |
      M3·M4 가 핵심이다 — *"`isValidUuid` 를 쓰면 안 된다"* 를 산문이 아니라 **테스트**가
      고정하고 있음을 보인다.
- [x] C: 같은 트래커 파일에 2건 등재 (계약 비대칭 · 디코더 중복)
- [x] `/consistency-check --impl-prep spec/5-system/`
      `review/consistency/2026/09/12/22_51_25` — **BLOCK: NO** (Critical 0 · WARNING 4).
      셋은 spec 갭(§D 등재), 하나는 이 plan 의 체크리스트 결함이라 위에서 고쳤다.
- [x] D: spec 항목 3건 트래커 등재 (전부 **planner 항목**으로 표기)
- [ ] CHANGELOG (완료 — 관측 가능한 변경 2건)
- [ ] `.claude/tools/run-test-all.sh`
- [ ] `/ai-review` + `--impl-done`
