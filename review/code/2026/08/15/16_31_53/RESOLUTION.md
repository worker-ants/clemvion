# RESOLUTION — `16_31_53`

ai-review **CRITICAL 0 / WARNING 1** · 위험도 **LOW**. 조치 완료 + INFO 1건.

## W1 — 자매 둘은 가진 계약 테스트가 이 함수만 없었다 (testing)

**조치 완료. 또 자매 비대칭이다.**

`cancelParkedExecution` / `markWebChatIdleTimeout` 은 **트랜잭션 중간 실패 계약**(예외를
삼키지 않고 그대로 던짐)을 잠그는 전용 테스트를 갖는데 `finalizeStalledExhausted` 만
없었다. 리뷰어가 *"실 DB 롤백 검증과는 다른 층위 — 지금 mock 만으로 닫을 수 있는 갭"* 이라
정확히 구분했다.

이 함수는 함수 레벨 `try/catch` 가 **의도적으로** 없다(유일 호출부의 `.catch()` 가 흡수).
따라서 트랜잭션이 실패하면 **그대로 던져야** 하고, 삼키면 실패가 관측 불가능해진다.
그리고 커밋되지 않았으므로 **종결 이벤트도 나가면 안 된다**.

`nodeQb.execute` 를 `mockRejectedValue` 로 무장해 두 가지를 함께 단언했다.

**판별력**: 트랜잭션을 `try { … } catch { return; }` 로 감싸 예외를 삼키는 뮤턴트에서 **RED**.

## INFO 처분

| # | 처분 |
|---|---|
| 1 (try/catch 비대칭) | **조치** — JSDoc 에 *"의도적으로 없다 + 호출부가 흡수 + 이 계약은 회귀 테스트로 잠겨 있다"* 명시. 다음 사람이 "자매와 완전 동형" 으로 오독하지 않게 |
| 2 (`installCancelTx` 무장 비대칭) | 무조치 — 자매 테스트 파일을 손대는 것은 이번 스코프 밖. 그쪽을 다시 만질 때 백포트 |
| 3 (backstop 과의 이론적 race) | 무조치 — JSDoc 에 이미 수용된 노출로 명시. 이번 diff 가 창을 넓히지 않았다 |
| 4 (실 DB 롤백 미검증) | **이미 트래커 등재** (`16_19_57` W1 로 이번에 만든 항목) |
| 5 (로그 타이밍 이동) | 무조치 — 관측 가능한 최종 결과 동일. 이 로그를 스크래핑하는 코드는 발견되지 않았다 |
| 6 (`emitSpy.mockRestore` 스타일) | 무조치 — `beforeEach` 가 매 테스트 service 를 재생성해 실질 위험 없음 |

## 검증

- 백엔드 **425 suites / 8731 passed** · lint `--max-warnings 0` **0 errors** · 타입 **199**
- 판별력(누적): 트랜잭션 제거 **3/3 RED** · `affected=0` 조기 return 제거 **RED** ·
  cascade WHERE 변조 **RED** · Execution `WHERE id` 변조 **2건 RED** ·
  트랜잭션 예외 삼킴 **RED**
