# Plan 정합성 검토 — `spec/5-system/` (impl-done, diff-base `origin/main`)

## 범위 확인

`git diff origin/main --stat -- spec/` 실측 (HEAD `20ec30308`):

```
spec/5-system/14-external-interaction-api.md | 59 +++++++++++++++++++++++-----
spec/5-system/15-chat-channel.md             |  2 +-
spec/5-system/6-websocket-protocol.md        | 10 +++--
spec/conventions/chat-channel-adapter.md     | 15 +++++++--
spec/conventions/conversation-thread.md      |  2 +-
```

target 선언 scope(`spec/5-system/`) 안의 3개 파일 diff 를 전수 확인했다. 최신 커밋
`20ec30308`(`.failed` 의 `error` 는 문자열이다)까지 반영된 상태.

## 대조한 plan 문서

- `plan/complete/node-output-envelope.md` — 이번 작업 계열의 원 plan. `status: complete`
  (2026-08-24). `spec_impact` 가 `spec/5-system/6-websocket-protocol.md` ·
  `14-external-interaction-api.md` · `15-chat-channel.md` · `conventions/chat-channel-adapter.md`
  를 planner-턴 카테고리로, `conventions/conversation-thread.md` 를 자기-반증형 소정정
  카테고리로 명시 열거 — target diff 의 5개 변경 파일과 정확히 일치.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 정본 트래커(§R17 계열).
  `20ec30308` 이 고치는 지점(§4.1 `.failed` `error` 문자열 정정)이 이 트래커의
  `- [ ] 🔴 system_error 재시도 배너가 라이브 WS 경로에서 안 뜬다` 항목(2026-08-24 등재,
  `12_24_55` cross_spec CRITICAL) 안에 **"그 문구는 2026-08-24 에 정정했다"** 로 이미
  갱신돼 있고, 같은 커밋에서 이 plan 파일 자체도 함께 수정됐다(`git log` 확인, 동일 커밋
  `20ec30308`) — spec 텍스트와 트래커 서술이 어긋나지 않는다. 프런트 코드 수정은 의도적으로
  이 PR 범위 밖으로 남겨 `[ ]` 미해결 상태 유지 — "별건 트래커에 등재했다" 는 본문 주장과
  실제 상태가 일치한다(빈 약속 아님).
  - `envelope.output` allowlist 폐쇄(2026-08-24) 항목도 `[x]` 로 갱신돼 있고 반증된 유예
    근거·실측(e2e DB 조회)이 `<details>` 로 보존됨 — target 의 §4.4/§R17 diff 와 동일 사실.
  - 파생 후속(`finalAdapted ?? nodeOutputCache` 폴백 잠재 경로, provider spec 3곳
    `output.rendered` 판정 미확정, WS §3.2 채널 표 누락, §4.4 `nodeType` carve-out 각주 등)은
    전부 개별 `[ ]` 로 등재돼 있고 "이번엔 안 고친 이유 + 재개 신호"가 각각 기록됨 —
    target 의 diff scope(`spec/5-system/` 만, providers 문서·frontend 코드 제외)와
    이 트래커의 defer 판단이 정확히 맞물린다.
- `plan/in-progress/spec-sync-websocket-protocol-gaps.md` — WS spec 의 미구현/won't-do
  트래커. target diff 는 이 트래커가 다루는 항목(§4.5 이벤트, §1.3 in-band 갱신, §4.2
  start/stop, §1.2 서브프로토콜)을 건드리지 않는다 — 충돌 없음.
- `plan/in-progress/spec-draft-eia-62-waiting-payload.md` — §R17 이력 blockquote 가
  "2026-08-24 갱신: 그 잔여도 닫혔다" 로 이미 갱신, 구 서술은 취소선 처리 — target 이
  §4.4 에 쓴 동일 사실과 어긋나지 않는다. 이 문서가 열어 둔 유일한 사용자 결정 사항
  ("이미 유출된 데이터에 대한 사후 대응 — 운영 판단 필요")은 target 이 다루는 범위(문서
  정정)와 무관해 충돌 표면이 아니다.
- `plan/in-progress/eia-terminal-payload.md` — "범위(사용자 결정: 둘 다)" 는 종결 payload
  일괄 정리에 대한 결정이며, target 이 다루는 `execution.node.*`/§4.1 지점과 다른 스코프.
  grep 상 target 이 수정한 문구를 인용하는 곳 없음.

## 검토 관점별 판정

1. **미해결 결정과의 충돌** — 없음. target 이 내리는 결정(`.failed.error` 는 string,
   `execution.node.*` 의 `envelope.output` 도 fail-closed allowlist)은 모두 어느 plan 도
   "결정 필요" 로 열어 둔 적 없는 **사실 정정**(실측 기반)이며, 오히려 트래커가 CRITICAL 로
   지목한 지점을 target 이 닫는 관계다.
2. **선행 plan 미해소** — 없음. target 이 전제하는 실측(4곳 전수 emit 확인, e2e DB 조회
   84행 전수)은 `plan/complete/node-output-envelope.md` 본문과 `spec-sync-external-interaction-api-gaps.md`
   트래커 양쪽에 동일하게 기록돼 drift 가 없다.
3. **후속 항목 누락** — 없음. target 정정이 만드는 파생 후속(프런트 `extractNodeErrorPayload`
   버그, provider spec 3곳의 `output.rendered` 판정, `finalAdapted` 폴백 위험)은 전부
   `spec-sync-external-interaction-api-gaps.md` 에 개별 `[ ]` 항목 + "안 고친 이유 + 착수 시
   지침 + 재개 신호"로 이미 등재돼 있다 — 조용히 사라진 후속 항목을 찾지 못했다.

## 참고 (INFO, 위험도 영향 없음)

- `plan/complete/node-output-envelope.md` 는 `status: complete` 로 이동됐지만, 그 이후에도
  같은 scope 파일(`6-websocket-protocol.md`·`14-external-interaction-api.md`)에 대해
  `spec-sync-external-interaction-api-gaps.md`(별도 in-progress 트래커) 경유로 추가 CRITICAL
  정정이 계속 커밋되고 있다(`20ec30308` 등). 완료 plan 을 재오픈하지 않고 정본 트래커 쪽에서
  이력을 이어가는 패턴 자체는 이 저장소에서 이미 반복적으로 쓰인 방식이고 cross-reference 도
  누락 없이 유지되고 있어 문제로 등재하지 않는다 — 다만 다음 세션이 "complete" 라벨만 보고
  이 파일군을 안정 상태로 오판하지 않도록, 착수 전에는 `spec-sync-external-interaction-api-gaps.md`
  최신 항목도 함께 훑을 것.

## 요약

target(`spec/5-system/` 3파일 diff, HEAD `20ec30308`까지)은 원 plan
(`plan/complete/node-output-envelope.md`)의 `spec_impact` 범위와 정확히 일치하고, 최신
커밋이 고친 `.failed.error` 문자열 정정까지 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)에
동일 커밋으로 동기화돼 있다. 미해결 결정을 우회하는 서술이 없고, 이 정정이 전제하는 실측도
plan 본문에 기록돼 있으며, 파생 가능한 후속 항목들은 전부 정본 트래커에 개별 항목 +
재개 신호로 등재돼 누락이 없다. plan 정합성 관점에서 갱신이 필요한 지점을 찾지 못했다.

## 위험도

NONE
