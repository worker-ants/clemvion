# Plan 정합성 검토 — spec-draft-chat-channel-conventions.md

## 검토 개요

target(`plan/in-progress/spec-draft-chat-channel-conventions.md`)이 닫으려는 세 tracker
항목(`code` 규약 · `Update` 접두 · `setupChannel` 멱등 각주)을
`plan/in-progress/spec-draft-nullable-notation-followups.md`에서 직접 대조했다. 세 항목
모두 그 tracker 가 `(planner + 결정)` 또는 `(planner)` 권한으로 명시해 둔 열린 항목이고,
target 의 CV-1·CV-2·CV-3 는 정확히 그 항목이 요구한 결정을 내린다 — "미해결 결정 우회"가
아니라 그 결정을 만드는 의도된 절차다. 중복 등재(멱등 각주가 `2130`·`2235` 두 줄에
등재된 것)도 target 이 스스로 지목해 병합을 계획하고 있다.

다만 한 가지 후속 항목이 target 의 변경안·체크리스트 어디에도 반영되지 않은 채 조용히
깨지게 된다.

## 발견사항

- **[WARNING]** CV-2 의 `swagger.md` 신규 §1-7 삽입이 이미 알려진 취약 인용(citation)을
  실제로 stale 하게 만드는데, 그 후속이 target 의 변경안·"이 턴에 하지 않는 것"·체크리스트
  어디에도 등재돼 있지 않다.
  - target 위치: `## 결정` CV-2, `## 변경안` #2("`conventions/swagger.md` 신규 `§1-7`")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2135-2145`
    (`swagger.md §1` `Update` 접두 규약 승격 결정 항목의 **"부수"** 절)
  - 상세: 그 tracker 항목의 "부수"는 *"`chat-channel-config.dto.ts:365` 의
    `swagger.md:315` 인용을 `§3` 절 참조로 바꾼다 — 인용 자체는 실측상 정확하지만
    checker 가 두 라운드 연속 오탐을 냈다. 줄 번호가 읽는 쪽에 모호하다는 신호다"* 라고
    적는다. 즉 지금은 **참인 줄-번호 인용**이지만 언젠가 무효화될 수 있어 §3 참조로
    바꾸자는 예방 조치였다.
    실측 확인 결과, `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:365`
    는 지금도 `// (`spec/conventions/swagger.md:315`, 2026-09-05 규약화. ...)` 를 그대로
    쓰고, `spec/conventions/swagger.md:315` 는 지금도 실제로 그 절
    (`**JSDoc 은 공개 OpenAPI 로 나간다 ...**`)의 제목 줄이다 — 아직 깨지지 않았다.
    그런데 target 의 CV-2 는 `§1) DTO 패턴`(41~198줄, `§1-1`~`§1-6` 만 존재) 안에 새
    소절 `§1-7` 을 삽입하겠다고 명시한다. 그 삽입점(198줄 부근)은 인용 대상인 315줄보다
    **앞**이므로, 삽입되는 줄 수만큼 315줄 이하 전체가 밀린다 — 지금까지 "checker 오탐을
    유발할 수 있는 잠재적 취약 인용"이었던 것이 이 PR 병합 직후 **실제로 틀린 인용**이
    된다. 저장소 전체를 다시 검색해도 `swagger.md:[0-9]+` 형태의 줄-번호 인용은 이
    한 곳뿐이라 다른 자리가 대신 잡아주지도 않고, 이런 자유형 인용의 줄-번호 정확성을
    검증하는 docs 가드도 없다(`dto-jsdoc-citation-guard.ts` 는 리뷰 인용 날짜만 센다) —
    즉 이 drift 는 CI 어디서도 잡히지 않는다.
    target 의 checklist 는 tracker 의 `Update` 접두 항목을 "종결" 대상으로만 적고
    있어, 그 항목 안에 있던 "부수"(코드 파일 인용 수정, `codebase/**` 라 developer 권한)가
    항목과 함께 체크되어 사라질 위험이 있다.
  - 제안: (a) target 의 "이 턴에 하지 않는 것"/신규 등재 목록에 *"`chat-channel-config.dto.ts:365`
    의 `swagger.md:315` 인용이 §1-7 삽입으로 stale 해진다 — §3 참조 형태로 수정
    (developer)"* 를 명시적으로 추가하거나, (b) tracker 항목을 닫을 때 이 "부수"만 별도
    미해결 항목으로 재등재해 소실을 막는다. 지금 상태로 병합하면 tracker 가 예방하려던
    바로 그 실패 모드(줄-번호 인용 drift)가 이 PR 자신의 편집으로 발생하고 아무도
    추적하지 않는다.

## 요약

target 이 닫으려는 세 tracker 결정 항목(`code` 규약·`Update` 접두·멱등 각주)은 전부 그
tracker 가 planner 몫으로 명시해 둔 열린 결정이고, target 의 CV-1~CV-3 는 그 결정을
정확히 채운다 — 미해결 결정을 우회하는 것이 아니라 의도된 절차다. 중복 등재도 target
스스로 식별해 병합을 계획했다. 다만 CV-2 가 `swagger.md` 에 새 소절을 삽입하는 부수효과로,
같은 tracker 항목에 딸려 있던 코드 인용 정정 후속(`chat-channel-config.dto.ts:365`)이
따라오지 않아 그 항목을 닫으면 조용히 유실될 위험이 있다. 이 한 건을 제외하면 plan
정합성 관점에서 target 은 잘 정렬돼 있다.

## 위험도
LOW
