# Plan 정합성 검토 — `spec/5-system/` (impl-done, nodeoutput-allowlist)

## 발견사항

- **[WARNING]** 형제 in-progress plan 이 이미 종결된 트래커 항목을 "미완료" 로 인용 중
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "적용 범위는 총칭이 아니라 열거다" 표 (diff 로 신설된 구간) — 근거인 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 불릿 `**getStatus 일반 nodeOutput 키-allowlist** (§R17 잔여)` 가 이번 PR 에서 `[ ]` → `[x]` **종결**로 flip 됐다(`→ 종결 (2026-08-23)` 근거 문단 포함).
  - 관련 plan: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` (worktree `eia-r8-cache-scope-4ae434`, `status: in-progress`, 아직 완료 안 됨) 의 (7) 항목, 178~182행
  - 상세: 해당 plan 은 자기 §R17 재서술 작업에 대한 가드레일로 다음을 명시적으로 남겨 뒀다 — *"§R17 재서술 시 열린 항목을 지우지 말 것 … `spec-sync-external-interaction-api-gaps.md` 가 `getStatus 일반 nodeOutput 키-allowlist (§R17 잔여)` 를 **미완료로 추적 중**이다 … 그 불릿을 보존하고, **문구가 바뀌면 형제 트래커의 인용도 함께 갱신한다**"*. 이번 PR 은 정확히 그 트리거 조건(§R17 재서술 + 해당 불릿 문구·상태 변경)을 밟았지만, `spec-draft-eia-62-waiting-payload.md` 자체는 diff 에 포함되지 않았다(`git diff origin/main...HEAD` 로 확인 — 이 파일은 변경분 없음). 따라서 그 plan 은 지금 시점에도 이미 닫힌 항목을 "미완료로 추적 중" 이라고 잘못 서술하고 있다.
    - 참고로 이 flip 자체는 정당하다 — `plan/complete/nodeoutput-allowlist.md` 가 3 라운드 `/ai-review`(CRITICAL 0 수렴) + `--impl-prep` consistency-check(`18_30_40`, W1/W2 반영)를 거쳐 실제로 `NodeHandlerOutput` 파생 fail-closed allowlist 를 구현했고, §R17 표를 "REST 1곳 적용 · terminal 2곳 의도적 제외 · SSE 잔여"로 열거해 뒀다. 이 지적은 그 작업의 정당성이 아니라 **인용 동기화 누락**에 관한 것이다.
  - 제안: `spec-draft-eia-62-waiting-payload.md` (7) 항목의 해당 문단에 "2026-08-23 `nodeoutput-allowlist` PR 이 REST `getStatus` 출구를 종결했다(SSE/fanout 은 별도 잔여 항목으로 분리)" 각주를 달아 인용을 갱신할 것. 이 파일은 별개 worktree/작업이므로 이번 PR 범위에서 직접 고칠 의무는 없지만, 다음에 그 plan 을 만지는 세션이 stale 인용으로 오도되지 않도록 planner 인계 메모로 남겨 둘 필요가 있다.

## 확인했으나 문제 없음 (참고)

- 신규 SSE/fanout 잔여 항목(`spec-sync-external-interaction-api-gaps.md` 신설 불릿)과 `node-output-allowlist.ts` 재배치 항목은 `toFanoutEnvelope`/`waitForFormSubmission`/`waitForButtonInteraction`/`processButtonResumeTurn`/`nodeOutputForEvent` 등 구체 호출부까지 실측해 등재했고, 다른 `plan/in-progress/**` 어디에도 동일 표면을 다루는 중복·상충 항목이 없다(grep 확인).
- `retry-turn-terminal-guard.md` 는 `_retryState` 를 다루지만 **내부 원자 claim** 로직(재진입 가드) 관점이라 이번 PR 의 **외부 egress 필터링** 관점과 표면만 같고 관심사가 달라 충돌 없음.
- `chat-channel-visual-ssr-png.md` (`status: backlog`, 미착수)의 `nodeOutput.payload.*` 소비 가정은 fanout(SSE) 경로를 타는데, 이번 PR 은 SSE 경로를 의도적으로 건드리지 않았으므로(§R17 표에 "SSE 잔여" 로 명시) 영향 없음.
- `eia-terminal-payload.md`·`ie-resume-turn-boundary-cancel.md` 의 §R17 인용은 일반 strip 범위(`redactSecrets`/`deepRedactSecrets`) 서술이라 이번 diff(일반 키 allowlist 신설)와 별개 항목을 가리켜 충돌 없음.
- `plan/complete/nodeoutput-allowlist.md` 자신의 착수 전 프로브가 트래커 원문의 전제("그대로 실린다")가 낡았음을 스스로 발견·기록했고, 실제 원인(deny-list fail-open)으로 정정해 뒀다 — 이는 정합성 결함이 아니라 모범적인 self-correction.

## 요약

이번 PR 은 `spec/5-system/14-external-interaction-api.md` §R17 을 "REST `getStatus` 출구 1곳 fail-closed 적용 · terminal 2곳 의도적 제외 · SSE/fanout 잔여" 로 재서술하며, 그 근거가 되는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 항목을 정당하게 종결(`[x]`)하고 SSE 잔여·유틸 재배치 두 신규 후속 항목을 구체 호출부까지 실측해 등재했다 — plan 정합성 관점에서 절차(착수 전 프로브 → impl-prep → 구현 → 3라운드 ai-review 수렴 → 트래커 갱신)가 매우 충실하다. 다만 이 트래커 항목을 "미완료" 로 인용하며 "문구가 바뀌면 함께 갱신하라" 고 스스로 지시해 둔 별개의 in-progress plan(`spec-draft-eia-62-waiting-payload.md`, 다른 worktree)이 이번 flip 을 반영하지 못해 stale 인용이 하나 남았다. 기능적 충돌이나 미해결 결정 우회는 없고, 후속 인용 동기화 누락 1건만 확인됐다.

## 위험도
LOW
