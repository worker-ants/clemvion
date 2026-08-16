# Plan 정합성 검토 — `plan/in-progress/spec-draft-ws-types-canonical-location.md`

## 검증 방법

target 이 스스로 근거로 든 선행 plan `plan/in-progress/ws-event-types-extract.md` (컨텍스트 예산
초과로 번들에서 절단됨) 을 직접 읽고, target 의 7+1개 변경안을 그 plan 의 "후속 (이 PR 범위 밖)"
백로그와 항목 단위로 대조했다. 추가로 target 이 인용하는 7개 spec 위치의 **현재 실제 텍스트**를
`sed` 로 직접 읽어 "현재:" 인용문과 바이트 단위로 일치하는지 확인했고, `websocket-events.types.ts`
가 실제로 `origin/main` 에 병합돼 있는지(`git merge-base --is-ancestor`), 두 spec 파일의
frontmatter `code:` 상태(3-execution.md 는 미등재·6-websocket-protocol.md 는 이미 등재)를
실측했다. 같은 7개 spec 파일에 spec_impact 가 겹치는 다른 in-progress plan
(`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`,
`update-returning-tuple-shape.md`, `rag-quality-improvement.md`)의 실제 편집 위치와 처리 상태도
확인했다.

## 발견사항

- **[WARNING]** target 이 자신의 직접 출처인 `ws-event-types-extract.md` 의 후속 체크리스트를
  닫는 절차를 갖고 있지 않다
  - target 위치: 문서 전체 (frontmatter 에 `pending_plans:` 없음, 본문에 역참조 없음)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` §"후속 (이 PR 범위 밖)" (L299-334) ·
    §"그 밖" (L336-354)
  - 상세: target 의 7개 변경안 + ⑧ 항목은 `ws-event-types-extract.md` 의 "후속" 목록과 **정확히
    1:1 대응**한다(항목 수·순서·내용 전부 일치 — 대조 결과 누락·추가 없음, 아래 표). 이 자체는
    강한 정합성 증거다. 다만 target 어디에도 "이 draft 가 적용되면 `ws-event-types-extract.md`
    의 해당 체크박스 8개를 닫는다" 는 절차가 없다. 그 결과 target 적용 후에도
    `ws-event-types-extract.md` 는 이미 해소된 항목을 계속 미해결(`[ ]`)로 보여주게 되고, 다음
    사람이 같은 항목을 "아직 안 한 일"로 오인해 중복 조사할 위험이 있다. 이 저장소가 이미
    반복 기록한 실패 형태(체크리스트-plan 상태 비동기)와 같은 클래스다.

    | target 항목 | `ws-event-types-extract.md` "후속" 대응 항목 |
    |---|---|
    | ① `3-execution.md:657` + frontmatter code | L320-321 (동일) |
    | ② `10-graph-rag.md:552` | L322 (동일) |
    | ③ `6-websocket-protocol.md:740` | L324 (동일) |
    | ④ `6-websocket-protocol.md:1034` (부분만 stale) | L325-326 (동일) |
    | ⑤ `8-embedding-pipeline.md:276` | L323 (동일) |
    | ⑥ `data-flow/6-knowledge-base.md:288` | L327 (동일) |
    | ⑦ `data-flow/0-overview.md:110` (R10 인용) | L328-329 (동일) |
    | ⑧ `4-execution-engine.md` §4.4 보완 | "그 밖" L345-346 (동일) |
    | 범위 밖: `NotificationEventType` 개명 | "그 밖" L338-341 (target 도 동일하게 범위 밖 처리 — 정합) |
  - 제안: target frontmatter 에 `pending_plans: [plan/in-progress/ws-event-types-extract.md]`
    추가(자매 draft 인 `spec-draft-eia-notification-payload-contract.md` 가 쓰는 것과 같은
    관행) + "체크리스트" 절에 "적용 후 `ws-event-types-extract.md` 의 후속 목록 8항목 체크"
    단계를 명시. 또는 반대로 `ws-event-types-extract.md` 쪽에 "이 후속은
    `spec-draft-ws-types-canonical-location.md` 가 집행한다"는 역포인터를 지금 남겨도 된다
    (이 세션이 다른 자매 plan 에서 실제로 쓴 패턴 — `spec-draft-eia-notification-payload-contract.md`
    L255 "retry-turn-terminal-guard.md #2 역포인터").

- **[INFO]** 선행 plan `ws-event-types-extract.md` 자체의 체크리스트가 실제 병합 상태보다 뒤처져
  있다 (target 의 결함은 아니지만 선행조건 판단에 영향)
  - target 위치: 해당 없음 (참고 정보)
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` §체크리스트 (L293-297)
  - 상세: 그 문서의 체크리스트는 "push 게이트 통과 → PR"·"plan/complete/ 이동 시 spec_impact
    갱신" 을 아직 `[ ]` 로 남겼지만, 실측 결과 그 커밋(`c6dd5cb89`, #1175)은 이미
    `origin/main` 의 조상이고 `websocket-events.types.ts` 도 현재 워크트리에 실재한다. 즉
    target 의 전제("#1175 가 …로 옮겼다")는 **사실로 확정**돼 있어 target 자체의 선행조건
    미해소 문제는 아니다 — 다만 선행 plan 문서 쪽의 마무리(체크박스 정리·`plan/complete/`
    이동)가 안 된 채 남아 있다는 점만 기록해 둔다.

- **[INFO]** target 의 7개 "현재:" 인용은 현재 spec 파일과 정확히 일치 — line-anchor 리스크
  낮음
  - target 위치: 변경안 ①~⑦
  - 관련 plan: 없음 (교차 확인용 실측)
  - 상세: 같은 7개 spec 파일에 spec_impact 가 겹치는 두 개의 대형 draft
    (`spec-draft-eia-62-waiting-payload.md`, `spec-draft-eia-notification-payload-contract.md`)
    가 이미 `6-websocket-protocol.md`/`3-execution.md` 를 편집했지만, 두 plan 모두 체크리스트의
    spec 반영 항목이 커밋 완료(`4b13ca5ae` 등) 상태이고, 실측한 현재 라인 740/1034/657 의
    텍스트가 target 의 "현재:" 인용과 정확히 일치했다. 따라서 지금 시점 기준으로는 라인 인용
    stale 위험이 실현되지 않았다 — 다만 이는 우연한 정렬(다른 plan 이 먼저 끝났기 때문)이지
    target 자체가 심볼 기준 인용으로 설계돼 있어서가 아니다. 향후 같은 파일을 건드리는 draft 가
    생기면 재확인이 필요하다.

## 요약

target 은 자신이 인용한 선행 plan `ws-event-types-extract.md` 의 "후속" 백로그를 항목 수·구성
모두 정확히 1:1 로 재현하며, 그 plan 이 "일괄 치환하면 틀린다"고 남긴 구분(옮긴 선언 12개 vs
안 옮긴 메서드/facade)도 그대로 반영했다. 7개 spec 위치의 "현재:" 인용문은 실제 파일 내용과
바이트 단위로 일치했고, #1175 가 `origin/main` 에 실제로 병합돼 있어 target 의 전제(선행조건)도
사실로 확정된다. 미해결 결정을 우회하는 항목은 없었고, 겹치는 spec_impact 를 가진 다른
in-progress plan 들과도 라인 충돌이 관측되지 않았다. 유일한 실질 갭은 target 이 자신의 출처인
`ws-event-types-extract.md` 의 후속 체크리스트를 닫는 역참조/절차를 갖고 있지 않다는 것으로,
CRITICAL 급 충돌은 아니지만 plan 위생 관점의 WARNING 이다.

## 위험도
LOW
