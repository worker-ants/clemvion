# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 발견사항

- **[INFO]** 직전 라운드(`10_52_07`)의 W4 가 이번 커밋으로 정확히 해소됐다 — 교차 확인
  - target 위치: `spec/5-system/14-external-interaction-api.md` §6.5(`execution.cancelled`
    페이로드) — `durationMs` 서술에 새로 추가된 blockquote
    "**알려진 예외 1건**: retry-turn 처리 중 사용자가 Stop 하면 … 희귀 레이스가 아니라
    결정적으로 발생한다"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    `## retry-turn 재진입 시 DB 와 emit 의 durationMs 가 어긋난다 (2026-08-15 등재,
    10_34_51 W1)` 절
  - 상세: target 이 이 blockquote 에서 "추적: spec-sync-external-interaction-api-gaps.md —
    이 문서의 관행대로 알려진 갭은 invariant 옆에 적는다" 라고 스스로 주장하는데, 실제로
    그 plan 파일을 열어 대조한 결과 해당 절이 **존재**하고(`finalizeGuarded` 의 CANCELLED
    분기가 `COALESCE(duration_ms, :new)` 로 DB 는 T1 을 보존하지만 emit 은 in-memory
    T2 를 싣는다는 동일 사실을 서술) 두 개의 미해결 체크박스(`.returning(['duration_ms'])`
    추가·`finalizeCancelledExecution` 자매 항목)로 후속 조치까지 등재돼 있다. 즉 target 의
    "알려진 갭" 주장은 **근거가 실재**하며 허위 포인터가 아니다. 또한 이 문단은 직전
    consistency 라운드(`10_52_07`)가 낸 WARNING(W4 — "이 PR 이 DB=wire 불변식을 못박았는데
    같은 리뷰 사이클이 이미 찾은 반례에 캐비엇이 없었다")를 정확히 겨냥해 해소한 커밋
    (`a67ec89b7`)의 산출물이다 — target 이 미해결 결정을 우회한 것이 아니라, 직전 라운드가
    지적한 문서-코드 간극을 **결정 없이(사실 서술만으로) 닫은** 정상 경로다.
  - 제안: 조치 불요. 이번 라운드에서 새로 발견된 정합성 문제는 없다 — 기록 목적의 INFO.

- **[INFO]** `retry-turn-terminal-guard.md` #2 를 가리키는 줄 번호 인용의 staleness는
  이번 라운드에서도 변화 없음 (이월)
  - target 위치: (간접) `plan/in-progress/eia-terminal-payload.md`
    `## 다른 plan 과의 관계` — "같은 코드 블록(`retry-turn.service.ts` `failRetryExecution`
    `:956~965`)을 겨냥한다" 인용
  - 관련 plan: `plan/in-progress/retry-turn-terminal-guard.md` 코드 표 #2 행
    (`EXECUTION_CANCELLED` payload 의 `cancelledBy` 누락, 아직 미완료)
  - 상세: `git log 8a0c2348b..HEAD -- codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    결과 0건 — 직전 라운드(`10_52_07`) 이후 이 파일이 전혀 변경되지 않았으므로 그 라운드가
    이미 저위험으로 판정한 상태(줄 번호는 stale 이지만 함수 심볼로 특정 가능, 겨냥하는
    emit 호출부·`cancelledBy` 누락이라는 실질 내용은 여전히 target 의 §6 필드 집합 표
    "경로 1곳 누락" 서술과 정합)가 그대로 유지된다. **결정 충돌·실질 추적 실패는 없다.**
  - 제안: 조치 불요. `retry-turn-terminal-guard.md` #2 착수 시 자연히 현재 코드를 다시
    읽으므로 별도 대응 없이도 무방하다(직전 라운드 판정과 동일).

## 요약

이번 diff(`spec/5-system/14-external-interaction-api.md` §6.5 — retry-turn 재진입 시
DB≠emit `durationMs` 불일치를 "알려진 예외 1건" blockquote 로 명문화 + 취소 경로 3종
전체를 "실행 시간이 아니라 대기 시간" 으로 재서술)는 직전 라운드(`10_52_07`)가 WARNING
으로 지적한 항목(못박은 invariant 옆에 이미 아는 반례가 빠져 있음)을 정확히 겨냥해
해소한 커밋(`a67ec89b7`)의 결과다. target 이 "추적: spec-sync-external-interaction-api-gaps.md"
라 건 포인터를 직접 열어 대조한 결과 해당 항목이 실제로 존재하고 미해결 후속(`.returning`
추가·자매 함수 대칭 처리)까지 정확히 등재돼 있어 **허위 포인터가 아니다**. `eia-terminal-payload.md`
·`spec-draft-eia-notification-payload-contract.md`·`spec-sync-external-interaction-api-gaps.md`
세 자매 트래커 모두 `durationMs` 를 "구현됨(2026-08-15)" 으로 동기 전환한 상태를 유지하고
있고, 이번 라운드 diff 로 인해 새로 벌어진 자매 미동기화는 없다. 오늘 이 세션이 반복
지적해 온 "미해결 결정 우회"·"선행 plan 미해소"·"자매 트래커 drift" 패턴 중 어느 것도
이번 delta 에서는 재현되지 않았다. `spec-draft-eia-r8-alignment.md`(§R8 idempotency 캐시
스코프, 워크트리 슬러그의 원 출처)도 체크리스트가 전부 완료 상태로 이번 diff 와 충돌하는
미해결 결정을 남기고 있지 않다. 남은 것은 이전 라운드부터 이월된 저위험 INFO(retry-turn
줄 번호 staleness, 이번 라운드 무변화) 하나뿐이다.

## 위험도

NONE
