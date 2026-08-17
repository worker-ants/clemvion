# Plan 정합성 검토 — spec/5-system/ (impl-done, eia-fanout-and-internal-data-masking)

## 발견사항

- **[WARNING]** `eia-fanout-and-internal-data-masking.md` frontmatter `spec_impact` 가 실제 변경 spec 파일의 부분집합만 나열
  - target 위치: `spec/5-system/15-chat-channel.md`(CCH-MP-06 마스킹-이후 값 캐비엇, `git diff origin/main...HEAD` 로 +1/-1행 실측 확인) · `spec/5-system/3-error-handling.md`(`nodeName`→`nodeLabel` 정정 + 캐비엇, +7행)
  - 관련 plan: `plan/in-progress/eia-fanout-and-internal-data-masking.md` frontmatter (`:10-13`)
  - 상세: 이번 PR 의 `git diff origin/main...HEAD --stat`(직접 실측)는 `spec/5-system/`
    아래 **5개** 파일을 변경했다 — `12-webhook.md` · `14-external-interaction-api.md` ·
    `15-chat-channel.md` · `3-error-handling.md` · `6-websocket-protocol.md`. 그런데 이 작업의
    책임 plan(`eia-fanout-and-internal-data-masking.md`)의 frontmatter `spec_impact` 는
    **3개**만 선언한다:
    ```
    spec_impact:
      - spec/5-system/14-external-interaction-api.md
      - spec/5-system/6-websocket-protocol.md
      - spec/5-system/12-webhook.md
    ```
    `15-chat-channel.md`·`3-error-handling.md` 가 빠져 있다. 같은 작업의 **planner 트랙
    산출물**인 `plan/complete/spec-draft-eia-fanout-masking.md` 의 frontmatter 는 정확히
    5개 전부(`14-external-interaction-api.md`·`6-websocket-protocol.md`·`12-webhook.md`·
    `15-chat-channel.md`·`3-error-handling.md`)를 나열해 대조군 역할을 한다 — 즉 draft 쪽은
    맞고 developer 트랙 plan 쪽만 낡았다. 체크리스트 항목(`nodeName`→`nodeLabel` 정정,
    CCH-MP-06 캐비엇)이 작업 후반(2026-08-16/17)에 "이미 연 파일이라 곁들여 처리" 로
    추가되면서 frontmatter 갱신이 누락된 것으로 보인다.
  - 참고: `.claude/docs/plan-lifecycle.md` 상 `spec_impact` 는 **완료(`complete/`) 이동
    시점에만** `spec-plan-completion.test.ts` 가 강제하고 `in-progress` 단계는 의무가
    아니다 — 따라서 지금 당장 게이트를 차단하지는 않는다. 다만 이 plan 은 체크리스트
    마지막 두 항목(`--impl-done` 재실행 · push→PR)만 남아 `complete/` 이동이 임박한
    상태이므로, 그 이동 전에 5개로 갱신하지 않으면 Gate C 판정이 실제 diff 와 불일치한
    채로 굳는다.
  - 제안: `eia-fanout-and-internal-data-masking.md` frontmatter 의 `spec_impact` 를
    `plan/complete/spec-draft-eia-fanout-masking.md` 와 동일하게 5개 전부로 갱신.

## 요약

`plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커)와
`plan/in-progress/eia-fanout-and-internal-data-masking.md`는 이번 target 변경(§R17 emit
카탈로그 신설·잔여 ①·② flip·`outputData` 여섯 표면 마스킹·`inputData` 철회·WS §4.1
값-패턴 마스킹 캐비엇·webhook §5.3 스코프 캐비엇)과 매우 높은 수준으로 정합했다 — 트래커의
관련 체크박스가 정확히 이 diff 가 닫은 항목만 `[x]` 로 바뀌었고, `inputData` 철회처럼
CRITICAL 로 반증된 결정은 spec 본문(§R17 잔여②)·트래커·CHANGELOG·plan 4곳에서 일관되게
"철회" 로 반영됐다. 새로 연 항목(SECRET_LEAK_PATTERNS `token=` 갭·`inputData` 프런트
마커 가드 선행 조건·`kb`/`background` WS 채널 검토·유저가이드 Error 탭 캐비엇·WS
재개 경로 재사용 점검)은 전부 열린 채로 정확히 등재됐고 target 이 이를 이미 닫힌 것처럼
과장하는 문구는 발견되지 않았다. 다른 in-progress plan(`spec-update-node-cancellation-
shutdown-classification.md`·`spec-draft-eia-notification-payload-contract.md`·
`retry-turn-terminal-guard.md`·`eia-context-schema-followups.md`·`eia-terminal-payload.md`
등)이 같은 target 파일들을 참조하지만, 겹치는 절(예: `execution.node.cancelled` 행의
3번째 생산자 서술)은 이미 선행 PR 에서 해소돼 있어 이번 diff 와 충돌하지 않았다. 유일한
흠은 문서 위생 성격의 Gate C 드리프트(위 WARNING) 하나뿐이며 결정 우회나 선행 plan
미해소, 실질적 후속 누락은 확인되지 않았다.

## 위험도

LOW
