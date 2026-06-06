# Cross-Spec 일관성 검토 결과

검토 대상: `spec/7-channel-web-chat` (eager-start §R6 변경 포함)
검토 모드: `--impl-done` (구현 완료 후 검토, diff-base=origin/main)
검토일: 2026-06-06

---

## 발견사항

### [INFO] `spec/7-channel-web-chat/1-widget-app.md §R6` — AI Agent §6.2 참조 근거 정합성 확인

- **target 위치**: `1-widget-app.md §3 (상태기계)`, `§R6` Rationale
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md §6.2`
- **상세**: target 은 "AI Agent `multi_turn` 은 첫 사용자 메시지 전엔 LLM 을 호출하지 않고 즉시 `waiting_for_input` 으로 진입" 이라 주장하며, 이를 §R6 의 eager-start 비용 근거로 쓴다. `1-ai-agent.md §6.2` 를 실제 조회하면 "1. 첫 번째 턴 (노드 진입 직후): … b. 즉시 `status: 'waiting_for_input'` 으로 진입 — 첫 턴 LLM 호출은 사용자 메시지 수신 후로 미룬다" 로 동일하게 기술되어 있다. 모순 없음. 참조 링크(`[AI Agent §6.2]`)도 정확하다.
- **제안**: 이슈 없음. 확인 차원 기록.

---

### [INFO] `spec/7-channel-web-chat/0-architecture.md §3` — SSE wire 필드명 drift 언급이 여전히 backlog

- **target 위치**: `0-architecture.md §3` 마지막 bullet (SSE wire 필드명 주석)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md §6.2`, `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md §4.4`
- **상세**: target 은 "EIA §6.2 / WS §4.4 는 `nodeId`/`node.id` 로 표기돼 wire 와 drift — 별도 backlog" 라고 명시한다. 이번 변경(eager-start)이 해당 drift 를 해소하거나 악화시키지 않는다. 기존 known-issue 를 재확인한 것이며, 이번 PR 에서 새로 발생한 불일치가 아님.
- **제안**: 이슈 없음. 별도 backlog(EIA/WS spec 필드명 정합 이슈)에서 추적.

---

### [INFO] `EIA §5.2` — `execution.replay_unavailable` 클라이언트 fallback 기술 정합

- **target 위치**: `1-widget-app.md §3.1` (재연결 복구, "버퍼(5분) 만료 후" 단락)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md §5.2 (EIA-NF-03, EIA-IN-07)`
- **상세**: target 은 "위젯은 버퍼 만료를 로컬 시간 기준(>5분)으로 판단한다(EIA `replay_unavailable` 구현 시 이벤트 기반으로 교체 — EIA-NF-03 연계 TODO)" 로 기술. EIA §5.2 는 동일하게 "`replay_unavailable` emit 이 미구현이므로 브라우저 클라이언트는 버퍼 만료를 로컬 시간 기준(>5분)으로 판단" + "향후 교체" 를 서술한다. 양측이 동일한 fallback 정책을 기술하며 상호 참조한다. 모순 없음.
- **제안**: 이슈 없음.

---

### [WARNING] `firstMessage` 폐기 — EIA §4.1 webhook payload 스키마에 `firstMessage` 언급 잔존 여부 확인 필요

- **target 위치**: `3-auth-session.md §3 step 1`, `0-architecture.md §3`, `1-widget-app.md §3·§R6`, `eia-client.ts`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md §4.1` (webhook 트리거 응답), `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md`
- **상세**: target spec 전체에서 `firstMessage` 가 폐기됐고(`§R6`), `eia-client.ts` 타입도 `firstMessage` 필드를 제거했다. EIA §4.1 과 webhook spec `§3.1` 은 webhook `POST /api/hooks/:path` 의 **request body** 스키마를 정의하는데, 이 스키마에 `firstMessage` 가 언급돼 있었는지 확인했다. 현재 조회 범위에서는 EIA·webhook spec 이 webhook request body 에 `firstMessage` 를 정식 필드로 정의한 증거가 없다(EIA spec 은 주로 응답·SSE·interact 쪽을 정의). 따라서 직접 충돌은 없지만, 만약 EIA/webhook spec 이 별도 위치에서 `firstMessage` 를 request body 필드로 명시했다면 삭제 동기화가 필요하다.
- **제안**: EIA §4.1 / webhook §3.1 의 request body 스키마에 `firstMessage` 언급이 있으면 해당 줄을 제거하거나 "폐기됨 — channel-web-chat §R6 참조" 로 표기. 현 검토 범위에서는 없는 것으로 판단되므로 WARNING 으로 기록(경계 확인 권장).

---

### [INFO] `Workspace.settings.interactionAllowedOrigins` — 데이터 모델 SoT 참조 정합

- **target 위치**: `4-security.md §2, §3`, `0-architecture.md §4`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/1-data-model.md §2.2 Workspace.settings`
- **상세**: target `4-security.md §2` 는 `interactionAllowedOrigins` 를 "Spec 1-data-model.md §2.2 Workspace.settings 알려진 키" 로 명시 참조한다. 실제 `1-data-model.md §2.2` 를 확인하면 동일 키 `interactionAllowedOrigins: string[]?` 가 이미 정의되어 있고, "EIA §8.5, Channel Web Chat 보안" 참조도 포함돼 있다. 양측 완전 정합.
- **제안**: 이슈 없음.

---

### [INFO] CORS 분기 (`/api/hooks/*` 무제한, `/api/external/*` allowlist) — EIA §8.5 정합

- **target 위치**: `4-security.md §2, §R1`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md §8.5`
- **상세**: target 은 `/api/hooks/*` 는 `*`(무제한), `/api/external/*` 는 `interactionAllowedOrigins` 기반 동적 allowlist 로 분리한다고 명시하고 "EIA §8.5 본문 변경 불요" 라고 언급한다. EIA §8.5 에서 확인되는 "미설정 시 차단" invariant 와 `4-security.md §3` 의 "빌트인 CDN always-allow" 는 명시적으로 조화를 이루도록 기술(`(b) 추가 origin 0 → 빌트인 위젯 CDN origin 만 허용(secure-by-default 유지, EIA §8.5 "미설정 시 차단"과 정합)`)돼 있다. 충돌 없음.
- **제안**: 이슈 없음.

---

### [INFO] `retry_last_turn` 미지원 — EIA-IN-02 정합

- **target 위치**: `0-architecture.md §3` 마지막 bullet
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/14-external-interaction-api.md EIA-IN-02`
- **상세**: target 은 "**`retry_last_turn` 미지원** — EIA 외부 표면 미노출 내부 UI 한정 명령(EIA-IN-02)" 이라 명시. EIA-IN-02 는 지원 명령 목록에서 `retry_last_turn` 을 명시적으로 미포함 처리("내부 UI 한정")한다. 양측 일치.
- **제안**: 이슈 없음.

---

### [INFO] `eager-start` 상태기계 — `panel(transient)` phase 추가

- **target 위치**: `1-widget-app.md §3` 상태 다이어그램
- **충돌 대상**: 이전 spec 에 있던 `collapsed → (첫 입력) booting` 경로
- **상세**: 이번 변경에서 `collapsed → (open) panel(transient) → booting(eager)` 로 상태 전이가 갱신됐다. `panel` 은 `transient` 로 표기되어 위젯 SPA 내부 상태이며 외부(EIA, 데이터 모델, RBAC) 계약에는 노출되지 않는다. 다른 spec 영역이 위젯 내부 phase 이름에 의존하지 않으므로 교차 영역 충돌 없음. `3-auth-session.md §3 step 1` 의 시퀀스("패널 open(런처 클릭) → POST")도 동일 흐름을 기술한다.
- **제안**: 이슈 없음.

---

### [INFO] `updateProfile` 설명 — "다음 시작(패널 open/새 대화)" 으로 갱신

- **target 위치**: `use-widget.ts` 주석 (`다음 시작(패널 open/새 대화)`)
- **충돌 대상**: `spec/7-channel-web-chat/1-widget-app.md §3.2`, `2-sdk.md §5 ChatInstance`
- **상세**: 이전 코드 주석 "다음 시작(첫 메시지/새 대화)"에서 "다음 시작(패널 open/새 대화)"으로 변경됐다. 이는 `1-widget-app.md §3.2` 의 `updateProfile` 설명("다음 워크플로우 시작(패널 open/새 대화)의 webhook payload profile 에 반영")과 정합한다. `2-sdk.md §5 ChatInstance` 의 `updateProfile` 계약과도 충돌 없음.
- **제안**: 이슈 없음.

---

## 요약

`spec/7-channel-web-chat` 의 eager-start(§R6) 변경은 cross-spec 관점에서 심각한 충돌을 발생시키지 않는다. AI Agent §6.2 의 `multi_turn` 첫 진입 즉시 `waiting_for_input` 진입 정책, EIA §5.2 의 SSE 재연결·버퍼 fallback 정책, EIA-IN-02 의 `retry_last_turn` 미노출 정책, `Workspace.settings.interactionAllowedOrigins` 데이터 모델 정의, EIA §8.5 의 CORS 정책 모두 target 의 기술과 정합한다. `firstMessage` 폐기는 위젯 레이어(eia-client.ts 타입 + 테스트) 에서 완전히 제거됐으며, EIA·webhook spec 의 request body 스키마가 `firstMessage` 를 정식 필드로 정의했는지 경계 확인을 권장한다(기존 조회 범위에서는 없는 것으로 판단). 기존 known-issue(SSE wire 필드명 drift, `replay_unavailable` 미구현)는 이번 변경과 무관한 별도 backlog 항목이다.

---

## 위험도

LOW

STATUS: OK
