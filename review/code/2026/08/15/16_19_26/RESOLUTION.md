# RESOLUTION — `16_19_26`

ai-review **CRITICAL 0 / WARNING 2** · `--impl-done` (`16_19_57`) **BLOCK: NO**. 전부 조치.

## W1 — 같은 함수 안에서 자매를 또 놓쳤다 (testing)

**조치 완료.** 직전 라운드에 자식 `NodeExecution` cascade 의 WHERE 를 하드닝하면서
**바로 위 Execution UPDATE 의 `WHERE id = :id` 는 안 봤다.** 리뷰어가 뮤테이션으로
생존을 실측했다(3 테스트 전부 GREEN 유지).

오식별하면 **엉뚱한 실행을 마킹**하거나 **진짜 stalled 를 조용히 no-op** 시킨다.

성공 테스트 + 트랜잭션 테스트 **두 곳**에 단언 추가(후자는 "두 UPDATE 가 같은 execution 을
겨냥하는가" — 트랜잭션에 묶여도 대상이 어긋나면 원자성이 무의미하다).

**판별력**: `id = :id` → `id = :wrong` 뮤턴트에서 **2건 RED**.

> 이 브랜치에서 **"자매를 전수로 세라"** 가 또 반복됐다. 이번엔 다른 파일이나 다른 함수가
> 아니라 **같은 함수의 바로 위 문장**이었다.

## W2 — WARNING 을 고치며 새 중복을 만들었다 (maintainability)

**조치 완료.** 직전 라운드의 *"JSDoc 미갱신"* 을 고치면서 JSDoc 문단을 추가했는데,
**바로 아래 인라인 주석의 같은 설명을 지우지 않아** 약 90% 동일한 문장이 두 곳에 남았다.
자매 `cancelParkedExecution` 은 근거를 JSDoc 한 곳에만 둔다.

인라인 주석을 *"근거는 위 JSDoc 참조"* 한 줄로 축약. 한쪽만 갱신돼 모순되는 것을 막는다.

## `--impl-done` (`16_19_57`) WARNING 2건 — 둘 다 조치

| # | 항목 | 처분 |
|---|---|---|
| 1 | *"실 DB e2e 는 정본 트래커에 등재돼 있다"* 가 **거짓** | **조치** — 그 문서에 "실 DB"·"롤백" 문자열 **0건**이었고 지목한 자매 plan 은 다른 함수를 다뤘다. 실제로 등재 + 서술 정정. **이 형태가 네 번째다** |
| 2 | #1172 로 머지된 plan 이 `[ ]` 로 stale | **조치** — 체크박스 갱신 후 `git mv` 로 `plan/complete/` 이관(`R097` rename 확인), 인입 참조 2건 경로도 같은 커밋에서 갱신 |

INFO2(Rationale 미러)도 함께 반영했다 — 원자화 서술이 §7.1 본문에만 있고 Rationale 에
없어 분산돼 있었다.

## INFO 처분

| # | 처분 |
|---|---|
| 1 (함수 레벨 try/catch 비대칭) | 무조치 — 유일 호출부가 `.catch()` 로 흡수해 **최종 동작 동등**. 직전 라운드·consistency 모두 "무조치(선택)" 판정 |
| 2 (롤백 mock 미검증) | **트래커 등재됨** — 이번 `--impl-done` W1 으로 실제 항목이 생겼다 |
| 3·4 (보일러플레이트·관용구 삼중화) | 정본 트래커에 defer 근거와 함께 등재됨 |
| 5·6 (이론적 race·락 순서) | pre-existing, JSDoc 에 명시됨. 이번 diff 가 만들거나 넓히지 않았다 |
| 7·8 (관측 상태 변화·커넥션 보유) | 원자성 수정의 목적 그 자체 / 저빈도 경로라 무시 가능 |
| 9·10 | 직전 라운드 지적 반영 재확인 (positive) |

## 검증

- 백엔드 **425 suites / 8730 passed** · lint `--max-warnings 0` **0 errors** · 타입 **199**
- 판별력: Execution `WHERE id` 변조 **2건 RED** (이번) · 트랜잭션 제거 **3/3 RED** ·
  cascade WHERE 변조 **RED** · `affected=0` 조기 return 제거 **RED**
- TEST WORKFLOW 4스테이지 PASS (lint / unit / build / **e2e 276**)
