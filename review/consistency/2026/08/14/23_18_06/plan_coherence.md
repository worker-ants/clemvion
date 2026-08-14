# Plan 정합성 검토 — spec/5-system/ (--impl-done)

## 발견사항

- **[WARNING]** `error` 객체화 완료가 자매 plan 2건의 stale 항목에 아직 전파되지 않았다
  - target 위치: `spec/5-system/14-external-interaction-api.md:572`(§6 필드 집합 표 `error` 행 — 이번 diff 로 "구현됨 — 형태 불일치" → "구현됨"으로 갱신, `failed` 는 전 경로 object 로 확정) 및 `:782-785`(§6.4 Rationale — `code` 를 만드는 경로가 여럿임을 반영)
  - 관련 plan:
    - `plan/in-progress/spec-sync-external-interaction-api-gaps.md:20-23` — `- [ ] **execution.failed 의 error 를 객체로 통일**` 항목이 "일부 경로가 아직 string 을 싣는다(`execution-engine.service.ts` L656·L3291, `retry-turn.service.ts` L956)" 라고 여전히 서술
    - `plan/in-progress/spec-draft-eia-notification-payload-contract.md:104-105` — 필드 집합 표의 `error` 행이 여전히 "구현됨(형태 불일치) — 현행 일부 경로 string" 이고, `:190` 체크리스트 항목("`execution.failed` 의 `error` 를 객체로 통일 … → `chat-channel.dispatcher.ts` back-compat wrap 제거")도 미체크
    - 두 문서 모두 target 인 `spec/5-system/14-external-interaction-api.md` 를 `spec_impact` 로 선언한 진행 중 plan 이다
  - 상세: 이번 PR(커밋 `6aa0699b8`)이 `toTerminalErrorPayload` 로 `execution-engine.service.ts`(`:659`·`:3301`·`:4862`) + `retry-turn.service.ts`(`:963`) 4곳 전부를 object emit 으로 통일했고, target spec 은 그 상태를 정확히 반영해 갱신됐다(`error` 행 캐비엇 제거, diff 로 실측 확인). 그런데 위 두 자매 plan 은 여전히 "일부 경로는 string" 이라는 이제 거짓이 된 전제를 서술하며 대응 체크박스도 미체크 상태다. **`eia-terminal-payload.md:230` 자신도 이 사실을 인지하고 "위 3개 plan 체크박스 동시 갱신" 을 체크리스트에 남겨 뒀지만(`:284-293` "다른 plan 과의 관계" 절에서 3개 plan 을 명시) 실행되지 않았다** — `/ai-review 22_55_51` WARNING #11 이 같은 갭을 지적했고 RESOLUTION 은 `eia-terminal-payload.md` 자체 체크리스트만 갱신했을 뿐, 이 두 자매 plan 파일은 여전히 diff 에 없다(`git diff origin/main --stat` 에 두 파일 미포함).
    - 부가 뉘앙스: `spec-sync-...gaps.md:22-23` 이 근거로 드는 "그래서 `chat-channel.dispatcher.ts` 에 back-compat wrap 이 쌓였고 adapter 타입도 `| string` 을 안고 있다. 통일되면 그 wrap 과 union 을 함께 제거한다" 부분은 **단순 "완료로 flip" 이 아니라 갱신이 필요하다** — 구현팀은 실제로는 wrap 을 제거하지 않고 **의도적으로 레거시 흡수 경로로 유지**했다(`chat-channel.dispatcher.ts:536-539` 신규 주석: "엔진은 이제 전 경로에서 §6.4 object 를 emit 한다 … 아래 string 분기는 그 이전에 큐/버퍼에 적재된 이벤트만을 위한 레거시 흡수 경로로 남긴다"). 즉 체크박스를 그냥 `[x]` 로 바꾸면 "wrap 도 제거했다" 는 잘못된 완료 서술이 된다.
    - `backend-lint-gate-broken-on-main.md:745-762` 의 대응 항목은 이미 `[x]` 이고 잔여를 정확히 `spec-sync-external-interaction-api-gaps.md` 로 위임한다고 적어 갱신 불요 — 3곳 중 이 한 곳만 이미 정합함을 확인.
  - 제안: `spec-sync-external-interaction-api-gaps.md:20-23` 과 `spec-draft-eia-notification-payload-contract.md:104-105,190`을 갱신 — "emit 4곳은 object 로 통일 완료(`toTerminalErrorPayload`, 2026-08-14)" 로 flip 하되, `chat-channel.dispatcher.ts` 의 string 분기는 **레거시 큐 이벤트 흡수용으로 의도적으로 유지**(제거 대상 아님)라는 점을 함께 적을 것. 그 후 `eia-terminal-payload.md:230` 체크.

## 요약

target(`spec/5-system/14-external-interaction-api.md`)이 이번 PR 로 반영한 `error` 객체화 상태 자체는 정확하다 — §6 필드 표·§6.4 Rationale 갱신이 코드(diff)와 실측상 일치하고, 직전 라운드(`22_29_16`)가 지적했던 companion 타입 동기화·범위 분리 결정 위반 위험은 이번 구현(`chat-channel/types.ts` 동반 갱신, "이번 PR"/"다음 PR" 분리 준수, 프런트엔드 소비자 CRITICAL 조치 완료)으로 실제로 해소됐다. 미해결 결정을 일방적으로 우회하는 CRITICAL 은 없다. 다만 target 변경이 무효화한 두 자매 plan(`spec-sync-external-interaction-api-gaps.md`, `spec-draft-eia-notification-payload-contract.md`)의 "일부 경로는 string" 서술 및 관련 체크박스가 아직 갱신되지 않았고, 이는 `eia-terminal-payload.md` 자신이 이미 스스로 지적하고 체크리스트에 남겨 둔(하지만 미집행) 후속 항목이다 — WARNING 으로 등재한다.

## 위험도

MEDIUM
