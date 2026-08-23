# Plan 정합성 검토 — sse-nodeoutput-allowlist (spec/5-system/)

## 발견사항

- **[WARNING]** `spec-draft-eia-62-waiting-payload.md` 가 방금 닫힌 SSE/fanout 잔여를 여전히
  "잔여" 로 서술한다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 표의 SSE/fanout 행
    (deny-list "잔여" → **fail-closed allowlist**, 2026-08-23 flip) 및
    `spec/5-system/6-websocket-protocol.md` §4.4 blockquote (내부 WS/SSE 가 `nodeOutput`
    키 집합을 공유하지 않는다는 단서 추가)
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` L183-187
  - 상세: 이 in-progress plan 은 (이전 `nodeoutput-allowlist` PR 이 REST `getStatus` 만 닫은
    시점을 반영해) *"→ 그 불릿은 이제 종결됐다 (2026-08-23, `nodeoutput-allowlist` PR). 다만
    부분 종결이다 — REST `getStatus` waiting 출구만 fail-closed allowlist 를 받고, terminal
    `result`/`error` 는 작성자 데이터라 의도적 제외, **SSE·fanout 은 잔여**로 정본 트래커에
    별도 항목이 서 있다. §R17 의 범위 표가 그 셋의 SoT 다."* 라고 적어 뒀다. 그런데 본 PR
    (`sse-nodeoutput-allowlist`)이 바로 그 "SSE·fanout 잔여" 항목을 닫았다 —
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 불릿이 `[x]` 로
    체크됐고, `spec/5-system/14-external-interaction-api.md` §R17 표의 SSE 행도
    "fail-closed allowlist" 로 flip 됐으며, CHANGELOG.md 도 같은 날 자기 정정을 실었다.
    `spec-draft-eia-62-waiting-payload.md` 의 위 문장만 갱신되지 않아 **"SSE·fanout 은
    잔여" + "정본 트래커에 별도 항목이 서 있다"** 라는 서술이 지금은 거짓이다. 이 문장은
    스스로를 "§R17 표가 SoT" 라 안전장치를 걸어 뒀지만, 문장 자체가 단정적으로 잔여를
    주장하므로 §R17 표를 직접 대조하지 않고 이 plan 만 읽는 후속 세션은 오도될 수 있다.
  - 제안: `spec-draft-eia-62-waiting-payload.md` L183-187 에 SSE/fanout 도 2026-08-23
    (`sse-nodeoutput-allowlist` PR)에 닫혔다는 후속 각주를 추가한다 (target 쪽은 이미
    올바르므로 plan 쪽만 갱신하면 된다). 취소선 등재 이력이므로 원문은 보존하고 추가
    각주만 붙이는 편이 이 저장소의 관례("취소선 + 정정")와 맞는다.

## 요약

target 변경(§R17 SSE/fanout 행 flip, WS §4.4 `nodeOutput` 키 비공유 단서)의 정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)는 체크박스·재개 신호·재배치 defer 판단까지
전부 diff 와 정합했고, "결정 필요" 로 남겨둔 항목(wire-only 키 8개의 `node-output.md`
Principle 0 편입, fanout chokepoint 강제, 캐너리 describe 블록 이동, `node-output-allowlist.ts`
재배치)도 모두 열린 채로 올바르게 planner/developer 소관으로 넘겨져 있어 우회 사례가
없다. 유일한 흠은 인접 in-progress plan(`spec-draft-eia-62-waiting-payload.md`)에 남은
"SSE·fanout 은 잔여" 서술이 이번 PR 로 반증됐는데 그 문서 자체는 갱신되지 않은 점이며,
이는 차단성 결정 충돌이 아니라 후속 문서 동기화 누락이다.

## 위험도
LOW
