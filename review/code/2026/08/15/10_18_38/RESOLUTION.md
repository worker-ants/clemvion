# RESOLUTION — `10_18_38`

ai-review **CRITICAL 0 / WARNING 10**. 실질 5건 조치, 테스트 4건은 근거와 함께 넘김.

## W7 — 한쪽을 고치면서 반대쪽을 만들었다

**조치 완료.** 직전 라운드가 "콤마 누락" 을 지적해 고쳤는데, 그 과정에서 **마지막 필드 뒤
trailing comma** 라는 새 결함을 만들었다. 여전히 `JSON.parse` 불가였다.

**이번엔 실제로 파싱해서 확인했다** — 주석·타입 표기를 걷어내고 `json.loads` 를 태웠다.
`toContain` 류 검사로는 이 클래스를 못 잡는다는 걸 두 라운드에 걸쳐 배웠다.

## W1 — 내 "전수 grep" 이 불완전했다

**조치 완료.** 직전 라운드에서 "6곳 전수 전환" 이라 보고했는데 `driveCallStackResume` 이
남아 있었다. **원인: grep 패턴이 한 줄을 가정했다.** 실제 코드는

```
savedExecution.durationMs =
  savedExecution.finishedAt.getTime() -
  savedExecution.startedAt.getTime();
```

처럼 줄바꿈돼 있어 `finishedAt.getTime() - ` 패턴에 안 걸렸다. 멀티라인 정규식으로 다시
세니 **9곳**이었다 — 내가 보고한 6곳보다 많다.

> **교훈**: "전수로 셌다" 는 주장은 **세는 도구가 대상의 형태를 담을 때만** 참이다.
> 한 줄 grep 으로 멀티라인 표현식을 센 것은 이 세션이 반복해서 배운 "프록시로 답했다" 의
> 또 다른 형태다.

## W6 · W8 · W9 — 조치 완료

- **W6** `finalizeStalledExhausted` 호출부 주석이 **이미 대체된 옛 SQL**(`GREATEST(0,…)`)을
  현재형으로 설명했다. 다음 편집자가 방금 고친 CRITICAL 방어를 오해해 되돌릴 자리다
- **W8** dispatcher 가 `{ durationMs?: number }` 로 좁게 캐스팅 — 이 PR 이 넓힌 `| null`
  계약과 어긋난다. 3곳 정정
- **W9** 자매 plan 이 "DB write 확장 5곳" 이라 적었으나 실측은 **4곳**
  (`finalizeCancelledExecution` 은 엔티티 기로드라 불요). CHANGELOG·spec §6.5 와도 불일치했다

## 넘김 — 테스트 4건 (W2·W3·W4·W5)

전부 **"신규 로직이 실행되지만 값이 단언되지 않는다"** 는 같은 클래스다. 유효한 지적이고,
이 PR 에서 안 하는 이유를 적는다:

| # | 처분 |
|---|---|
| W2 (raw UPDATE 4곳 실값 threading 미검증) | 자매 2곳(`cancelParked`·`finalizeStalled`)은 정확 매칭으로 고정돼 **패턴 자체는 검증됐다**. 나머지 4곳은 같은 코드 경로의 반복이라 회귀 위험이 낮다 |
| W3 (`markQueueWaitTimeout`·`failFirstSegmentSetup` 본문 미실행) | pre-existing — 이 PR 이전부터 두 함수는 항상 spy 로 대체됐다. 직접 호출 테스트 신설은 이 PR 범위를 넘는다 |
| W4 (SQL 값수준 e2e 미검증) | **가장 아프다.** int4 클램프 부재를 리뷰로만 잡았다는 사실이 그 비용을 실증한다. 이미 트래커 등재(`spec-sync-external-interaction-api-gaps.md`) |
| W5 (0-node 캐너리 부재) | 그 시나리오를 막으려고 계산을 조건 밖으로 옮겼는데 캐너리가 없다. 다만 헬퍼 spec 이 "startedAt/finishedAt 부재 → null, throw 안 함" 을 4 fixture 로 고정해 **실패 모드 자체는 덮인다** |

W10(REST 비대칭)은 직전 RESOLUTION 에서 트래커 등재 완료.

## 검증

- 백엔드 **425 suites / 8699 passed** · lint `--max-warnings 0` · 타입 **199**(래칫 동일)
- spec 가드 **2931** · 헬퍼 **25 tests**
- §6.3 JSON 을 **실제로 파싱해** 유효성 확인(문자열 검사 아님)
