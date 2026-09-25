# Plan 정합성 검토 — `plan/in-progress/changelog-backfill-12.md`

## 발견사항

- **[WARNING]** `#1270` 판정이 원 plan `ws-token-expired-socket-lifetime-impl.md` 의 미해결 후속 3건과 단절
  - target 위치: `plan/in-progress/changelog-backfill-12.md` §A 표 `#1270` 행 — "WS 토큰 만료 타이머에 `.unref()` ... 나머지 넷 ... 은 오늘 도달 불가 · 동작 불변"
  - 관련 plan: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` (커밋 `6501c19bc` = 실제 `#1270`, "이월 INFO 5건 정리" — target 행이 나열한 다섯 항목: cutoff 주석·`expiryTimers` non-optional화·상수 승격·선제 해제·`.unref()` 과 정확히 일치)
  - 상세: 이 plan 은 여전히 `in-progress` 이고, `.unref()` 도입이 만든 트레이드오프를 다루는 항목이 **셋 다 미해결**로 남아 있다.
    1. L183-195 `- [ ]` **"셧다운 중 만료 콜백 미실행"** — "`.unref()` 를 걸었으므로 그 타이머만 남은 상태에서는 프로세스가 콜백 발화 전에 종료될 수 있다"고 명시하고, "배포 런북에 그 사실을 적는다. 관측되면 `unref` 를 걷고 셧다운 훅에서 명시적으로 해제하는 쪽으로 바꾼다"고 처방한다.
    2. L179-181 은 그 "배포 런북"이 **아직 실체 문서가 아니다** — "지금은 이 plan(`ws-token-expired-socket-lifetime-impl.md`)이 트래커 역할을 한다"고 스스로 적는다. 즉 이 트레이드오프의 유일한 기록처가 지금 이 in-progress plan 자신이다.
    3. L168-177 `- [ ]` "만료 타이머 지터" — 동시 접속 코호트가 900초 주기로 뭉치는 문제가 planner 턴 대기 중이며, 같은 배포 런북 참조를 공유한다.
    target 문서는 `#1270` 을 "오늘 관측되는 변화 — 셧다운 지연 방지"로만 판정·기록하려 하는데, 그 판정의 반대편(셧다운 중 통지 누락 가능성이라는 알려진 캐비엇)이 아직 어디에도 정착되지 않은 채 이 in-progress plan 에만 걸려 있다는 사실을 target 이 참조하지 않는다. CHANGELOG 항목은 기준 ①·③이 요구하는 "운영자가 관측하는 동작"·"무엇이 뚫려 있었고 무엇이 바뀌는가"를 적는 자리인데, 이 캐비엇을 빠뜨리면 운영자에게 절반만 보이는 기록이 된다.
  - 제안: target §A `#1270` 행(또는 실제 CHANGELOG 항목 작성 시)에 "그레이스풀 셧다운 중 사전 통지가 못 갈 수 있다"는 한 줄을 함께 적거나, 최소한 target 체크리스트(§C)에 "원 plan `ws-token-expired-socket-lifetime-impl.md` 의 미해결 후속과 대조" 항목을 추가해 두 문서가 같은 트레이드오프를 다르게 말하지 않게 한다. 원 plan 의 배포 런북 항목을 이 기회에 실체화(CHANGELOG 항목이 그 런북 역할의 일부를 흡수)할지도 함께 판단할 것.

## 요약

target 문서(`changelog-backfill-12.md`)가 판정 대상으로 삼은 12건 PR 목록·근거는 트래커(`spec-draft-nullable-notation-followups.md` L5189-5199)와 그 상위 완료 plan(`plan/complete/changelog-criteria.md` §B)이 등재한 12건과 정확히 일치하고, 엔티티 선언 두 건(`#1354`·`#1358`)의 "동작 불변" 판정도 각각의 완료 plan(`entity-schema-declaration-drift.md`·`entity-column-declaration-drift.md`)의 기존 결론과 부합한다. 기준 ①에 "OpenAPI 로 광고하는 계약"을 보태는 §B 의 수정은 CHANGELOG.md 상단 블록(비-spec 문서)에 대한 것이고 이를 미러링하는 두 리뷰어 문서는 구체 문구가 아니라 범주명만 인용하므로 동반 갱신 대상이 아니다 — 미해결 결정을 우회하는 지점은 없다. 다만 `#1270` 을 "오늘 관측되는 변화"로 단순 판정하는 지점이, 같은 변경의 반대급부(셧다운 중 통지 누락 가능)를 아직 미해결로 들고 있는 `ws-token-expired-socket-lifetime-impl.md` 와 단절돼 있다 — CRITICAL 은 아니지만 실제 CHANGELOG 항목 작성 전에 대조가 필요하다.

## 위험도
LOW
