# RESOLUTION — `14_47_14`

ai-review **CRITICAL 0 / WARNING 2** · 위험도 **LOW**. 둘 다 조치, INFO 1건 함께.

직전 라운드(`13_58_27`)가 WARNING 10 이었고 그중 넷이 동작·커버리지였다. 이번 라운드는
**둘 다 재발 방지 성격**이다 — 발견의 성격이 동작 → 구조 → 예방으로 내려왔다.

## W1 — 자매 주석에 극성 캐비엇이 없다 (maintainability)

**조치 완료. 이 지적은 내가 직전 라운드에 실제로 빠진 함정을 가리킨다.**

이번 PR 로 `finalizeFailedExecution` 의 주석(*"형제와 동일한 guarded 경로"*)이 **표면적으로**
참이 됐다 — 이제 둘 다 반환값을 읽는다. 그런데 `!persisted` **이후**는 극성이 반대다:

| 함수 | 목적 | `!persisted` 처리 |
|---|---|---|
| `finalizeFailedExecution` | FAILED 로 **덮어쓰지 말라** | **무조건 skip** |
| `finalizeCancelledExecution` | 취소를 **알려라** | 재조회 → `CANCELLED` 면 **발행** |

캐비엇이 `finalizeCancelledExecution` 쪽에만 있었다. 이쪽만 읽고 새 guarded 경로를 만들면
무조건 skip 을 기본으로 가정한다 — **내가 직전 라운드에 정확히 그렇게 했고, 사용자가 누른
Stop 이 무음이 됐다.**

자매 주석에 극성 캐비엇 한 줄 추가. 리뷰어가 *"이 저장소는 정확히 이 문구를 원인으로 같은
결함 클래스를 세 번 CRITICAL 로 겪었다고 스스로 기록"* 한 것을 지적했고, 사실이다.

## W2 — 큐레이션 목록만 순회하는 가드에 새 필드가 안 들어갔다 (testing)

**조치 완료.** `execution-status-response.dto.spec.ts` 의 §5.4 부재 표현 회귀 가드가
`it.each([['result'], ['error']])` 로 **손으로 고른 목록**만 순회한다. `durationMs` 가
같은 규약(`nullable: true`)을 따른다고 DTO·spec 세 곳에 써 놓고 이 목록에는 없었다.

`durationMs` 추가 + **목록 자체가 커버리지**라는 사실을 주석에 명시.

**판별력**: DTO 에서 `nullable: true` 를 제거한 뮤턴트에서 **RED**.

> 이 저장소의 기록된 교훈 그대로다 — *"입력 집합 자체가 커버리지 → 줄이는(또는 늘리지 않는)
> 편집은 늘 조용히 통과한다"*.

## INFO 처분

| # | 처분 |
|---|---|
| 18 (CHANGELOG 경로 축약) | **조치** — `GET /api/external/executions/:id` 로 통일 |
| 16 (`returningSpy` 스코프) | 무조치 — 사소, 같은 describe 내 단일 사용 |
| 17 (1행 매칭 직접 테스트) | 무조치 — 기존 W15 가 간접 확인, 리뷰어도 "비긴급" |
| 21 (FAILED 재진입 로그 문구) | 무조치 — **오발행 없음**이 확인됐고 문구 정확도만의 문제 |
| 22 (이중 발행 이론적 가능성) | 무조치 — 리뷰어가 **이번 diff 의 회귀 아님**으로 명시 |
| 24 (webhook 신뢰성 절 한 줄) | 무조치 — 같은 사실이 CHANGELOG·§6.5·plan 3곳에 이미 있다 |
| 나머지 INFO | positive finding / 기결정 / 범위 밖(등재됨) |

## 이 PR 이 닫은 것

| 항목 | 상태 |
|---|---|
| ① `finalizeCancelledExecution` 이 DB 와 무관하게 emit | **닫힘** — 0행의 두 의미를 가른다. 양방향 뮤턴트 RED |
| ② retry-turn CANCELLED 재진입 DB≠emit | **닫힘** — `RETURNING` 되읽기. 판별 fixture 1234 vs 600000 |
| ③ REST 재조회에 `durationMs` 부재 | **닫힘** — 영속 컬럼 그대로. 정확집합 가드 갱신 |
| 문서가 구현보다 넓던 자리 3곳 | **닫힘** — 서술을 낮추는 대신 구현을 올림 |

## 검증

- 백엔드 **425 suites / 8729 passed** · lint `--max-warnings 0` **0 errors** · 타입 **199**
- W2 판별력: `nullable` 제거 뮤턴트 **RED**
- 직전 라운드의 TEST WORKFLOW 4스테이지(lint/unit/build/**e2e 276**) PASS 이후,
  이번 변경은 **주석 1줄 · 테스트 목록 1항목 · CHANGELOG 문자열**뿐이다
