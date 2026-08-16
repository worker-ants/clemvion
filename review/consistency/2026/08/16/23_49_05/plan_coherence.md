# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 검토 범위
- Target: `spec/5-system/14-external-interaction-api.md` · `6-websocket-protocol.md` · `12-webhook.md` (diff-base `origin/main`, HEAD worktree `eia-masking-followups-3cd512`)
- 대조: `plan/in-progress/**` 전수(요약 번들 + 관련 파일 직접 Read/grep)

## 발견사항

- **[INFO]** `spec/5-system/6-websocket-protocol.md` 편집으로 벌어진 라인 인용 오프셋이, 이미 존재하던 stale 인용을 더 벌렸다
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 (구 `:181-194` 블록이 `:181-201`, +7행) + `## Rationale` strip-only 보강 (구 `:1080-1085` 부근이 +4행) — 총 +11행, 그 뒤 모든 콘텐츠가 하방 이동
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-28 #9)" 미해결 항목(`- [ ]`, 문서 내 524행) — `spec/5-system/6-websocket-protocol.md:375` "replay 중 cancel" 표현을 가리킴. 같은 문서 476행 표에도 동일 라인 인용
  - 상세: 실측 결과 `"replay 중 cancel"` 텍스트는 `origin/main` 기준 이미 `:391`(인용된 `:375`보다 16행 아래)에 있었고 — 즉 이 인용은 **target 이전부터** 이미 부정확했다. target 의 diff 가 그 앞쪽에 11행을 더 끼워 넣어, post-diff 기준 실제 위치는 `:398`, 반면 `:375` 는 이제 `execution.retry_last_turn` ack 예시의 `"error": {"code": "RETRY_STATE_NOT_FOUND", ...}` JSON 줄을 가리킨다 — 완전히 무관한 내용. `spec-draft-eia-62-waiting-payload.md:62,197` 의 `6-websocket-protocol.md:394,975`/`:519` 인용도 같은 패턴(각각 origin/main 기준 이미 `:398`/`:979`/`:1062`, 즉 편집 전부터 4~7행 어긋나 있었고 이번 diff 로 추가 +7~11행 벌어짐)
  - 다만 이 저장소 자체가 이미 "라인 인용은 리팩터마다 stale 해진다"를 반복 교훈으로 기록해 뒀고, 이번 target 의 자매 작업(`ws-event-types-extract.md`)은 `websocket.service.ts` 를 편집할 때 `grep -rn 'websocket\.service\.ts:' plan/ spec/` 로 전수 인용을 확인·심볼 기준으로 전환했다. 이번 target 은 `6-websocket-protocol.md` 자체를 두 군데 편집했지만, "검토 요청 관점"에는 `nodeName→nodeLabel` 정정 하나만 좁게 확인했고 파일 전체에 대한 동일 grep 절차는 보이지 않는다
  - 제안: 새 CRITICAL/WARNING 은 아니다(원인이 target 이 아니라 선재 drift) — 다음에 `spec-update-node-cancellation-shutdown-classification.md` #9 를 집행하는 사람이 잘못된 위치를 열지 않도록, developer/planner 턴에서 `grep -rn "6-websocket-protocol\.md:[0-9]" plan/ spec/` 로 전수 재확인 후 심볼/섹션 기준 인용으로 바꾸거나 라인 번호를 갱신할 것을 권장한다(같은 PR 에서 안 해도 되지만, 후속 티켓으로 등재 가치가 있다)

## 대조 확인 (충돌 없음 — 근거만 남김)

- **미해결 결정 우회 여부**: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커) 는 §R17 잔여 항목을 ①(WS emit 값-마스킹)·②(내부 REST `inputData`/`outputData`)·③(workflow-assistant LLM 도구, `17_12_34` W1 — "두 마스킹 의미 중 우선순위가 결정 항목")으로 구분한다. target 은 ①·②만 flip 하고 ③은 "잔여 (범위 밖 유지)"로 명시적으로 열어 둔 채 그대로 두었다 — 미해결 결정을 일방적으로 내리지 않았다. 마찬가지로 "자격증명 없는 연결 문자열·내부 호스트명"(`09_51_00` W1)·"`SECRET_LEAK_PATTERNS` 가 bare `token=` 미검출"(같은 축) 두 열린 항목도 target 이 닫힌 것처럼 서술하지 않는다
- **plan 체크리스트 대 diff 정합**: `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트의 코드/spec 항목은 전부 `[x]`이며 실제 diff(`git diff origin/main...HEAD`)와 커밋(`1b8fd5cc7`·`fe6a54c80`)이 이를 뒷받침한다. 남은 미체크는 `--impl-done`·push 게이트뿐 — 본 검토가 그 단계이므로 정상
- **draft plan 대 실제 spec diff**: `plan/in-progress/spec-draft-eia-fanout-masking.md`(project-planner draft)의 변경 1/2/3 문구가 실제 `spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`·`12-webhook.md` diff 와 사실상 동일 — 사전에 합의된 초안이 그대로 반영됐다
- **선행 plan**: `plan/complete/eia-internal-rest-error-masking.md`(내부 REST `Execution.error` 마스킹 + `SecretResolver` 예외 결정)는 이미 머지·complete 상태(`a8b0cbfdd`)이며 target 이 전제하는 선행 조건이 충족돼 있다. `plan/in-progress/spec-sync-websocket-protocol-gaps.md`(WS 미구현 backlog)·`ws-event-types-extract.md`(값/타입 분리 리팩터, 수렴 완료)는 target 과 같은 파일을 다루지만 축이 달라 충돌 없음
- **웹챗/디스코드/슬랙 등 신규 채널 plan**(`chat-channel-discord-gateway.md` 등, "사용자 결정 필요" 로 미착수)은 마스킹·fanout 키워드와 무관 — 후속 항목 영향 없음

## 요약
Target 은 자신이 명시한 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 열린 항목 ①·②만 정확히 닫고, ③ 및 두 개의 별도 열린 결정 항목(연결 문자열 패턴·bare `token=`)은 의도적으로 손대지 않고 그대로 두어 미해결 결정을 우회하지 않았다. 자신의 plan 체크리스트·draft spec 초안과 실제 diff 사이에 괴리가 없고, 선행 plan(내부 REST 마스킹)은 이미 완료·머지돼 전제 조건도 충족된다. 유일한 관찰 사항은 `6-websocket-protocol.md` 편집으로 인한 라인-오프셋 이동이 다른 in-progress plan(`spec-update-node-cancellation-shutdown-classification.md` #9 등)의 이미 부정확했던 라인 인용을 조금 더 벌렸다는 점인데, 이는 target 이 새로 만든 결함이 아니라 이 저장소에 반복 기록된 선재 drift 패턴의 연장이라 INFO 로만 남긴다.

## 위험도
LOW
