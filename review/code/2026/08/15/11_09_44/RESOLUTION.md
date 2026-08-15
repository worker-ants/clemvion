# RESOLUTION — `11_09_44`

ai-review **CRITICAL 1 / WARNING 8**. CRITICAL + 문서 3건 조치, 나머지는 트래커 등재분.

## 🔴 CRITICAL — 내가 "고쳤다" 고 선언한 결함이 절반 경로에 남아 있었다

**두 라운드 전 CRITICAL(int4 오버플로 → UPDATE 실패 → 실행 영구 고착)을 SQL 경로에서만
막고 JS 경로(`resolveTerminalDurationMs`)는 그대로 뒀다.** 둘 다 같은
`duration_ms INTEGER` 컬럼에 쓰는데, 나는 한쪽만 보고 "해소" 를 RESOLUTION 에 적었다.

**도달 경로가 실재한다**: `startedAt` 은 생성 시 1회만 세팅되고, 폼·버튼·AI 대기에는
시간 기반 강제취소가 없다. 24.8일 초과 대기 후 **정상 완료**하면 그 완료 처리가 통째로
실패한다.

**조치**: JS 에도 `Math.min(span, PG_INT4_MAX)` 클램프. **상수를 `PG_INT4_MAX` 하나로
export 해 SQL 문자열도 그걸 보간**하게 했다 — 두 경로가 다른 숫자를 쓰면 같은 결함이
또 한쪽에만 남는다. 회귀 테스트 2건(saturate·상수 공유) 고정.

> **교훈**: 직전 RESOLUTION 에 *"방어를 한 방향으로만 세웠다(음수만 보고 상한을 안 봤다)"*
> 고 적었는데, **이번엔 같은 방어를 한 경로에만 세웠다.** 축이 바뀌었을 뿐 형태가 같다.
> "고쳤다" 를 쓸 때 **그 불변식을 공유하는 쌍둥이를 세는 것**이 빠져 있었다.

## W6 · W7 · W5 — 조치 완료

- **W6** 이 PR 이 새로 쓴 `emitCancellationEvent` JSDoc 이 *"엔티티가 없으면 생략한다"*
  고 적었는데 **호출부 4곳 모두 명시적으로 값을 넘긴다.** 내 신규 문서가 내 신규 코드와
  모순이었다
- **W7** "대기 시간" 캐비엇이 `EXECUTION_QUEUE_WAIT_TIMEOUT` 하나만 명명했는데,
  **park 취소(무기한)·위젯 idle(grace 1h)도 같은 특성**이고 그 사실은 같은 PR 의
  트래커에 이미 실측돼 있었다. 셋 다 명명하도록 확장
- **W5** 테스트 제목이 "NaN/Infinity" 인데 NaN 만 실행했다 — 직전 라운드가 "다음 편집 때
  우선 처리" 라 했는데 **그 다음 편집에서도 안 했다.** `it.each` 로 분리

## 넘김 — 전부 트래커 등재분

| # | 처분 |
|---|---|
| W1 (concurrency, `finalizeCancelledExecution` emit≠DB) | **신규 관점이다** — `updateExecutionStatus` 가 `RETURNING` 없이 boolean 만 반환하는 구조가 근본. W2 와 같은 처방(`RETURNING duration_ms`)이라 **함께 다뤄야** 하고, 둘 다 DB write 경로 변경이다. 트래커 W1 항목에 병합 등재 |
| W2 (retry-turn 재진입) | `10_34_51` W1 로 등재 |
| W3 (AVG 집계 오염) | `10_34_51` W3 으로 등재 |
| W4 (`markQueueWaitTimeout` 테스트 부재) | 3라운드 이월. 이 경로만 값의 의미가 다르다("큐 대기")는 지적이 맞다 → 트래커 등재 |
| W8 (REST 비대칭) | `09_58_24` W4 로 등재 + CHANGELOG 고지 |

## 검증

- 백엔드 **425 suites / 8707 passed** · lint `--max-warnings 0` · 타입 **199**(래칫 동일)
- spec 가드 **2931** · 헬퍼 **28 tests**(CRITICAL 회귀 2건 포함)
