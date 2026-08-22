# Plan 정합성 검토 — spec-draft-egress-masking-convention.md

## 발견사항

- **[WARNING]** 좌표계 표·"마스킹은 한 번" 절이 `websocket.service.ts` 절대 라인 번호를 인용 — 형제 plan 이 이미 학습·집행한 "라인 인용은 stale 해진다" 교훈을 적용하지 않음
  - target 위치: `plan/in-progress/spec-draft-egress-masking-convention.md` §"실측한 좌표계" 표 5행 아래 각주(`interaction.service.ts:112` / `websocket.service.ts:422`), §"마스킹은 한 번" 2번(`websocket.service.ts:406-417`), §검증 기준 3번째 불릿("파일:라인 또는 심볼")
  - 관련 plan: `plan/in-progress/ws-event-types-extract.md` (같은 worktree 계열 `eia-r8-cache-scope-4ae434`, 2026-08-15 착수)
  - 상세: `ws-event-types-extract.md` 는 `websocket.service.ts` 를 리팩터하면서 "`websocket.service.ts:<line>` 를 절대 라인 번호로 인용하는 다른 3개 in-progress plan
    (`node-output-redesign/background.md` · `spec-draft-eia-62-waiting-payload.md` ·
    `spec-draft-eia-notification-payload-contract.md`)이 이 이동으로 조용히 stale 해진다"
    는 것을 `18_53_27 plan_coherence W2` 로 실제로 겪었고, 세 문서 전부를 **심볼 기준**으로 전환한
    뒤 "이 저장소가 이미 기록한 교훈 — 라인 인용은 리팩터마다 stale 해진다" 라고 명시적으로 남겼다
    (해당 3개 문서는 현재 `websocket.service.ts:` 절대 라인 인용이 0건으로 확인됨). target 문서는
    이 교훈이 기록된 **이후**(target `started: 2026-08-22` vs 교훈 기록 `2026-08-15`) 작성됐는데도
    같은 파일에 대해 `:422`, `:406-417` 절대 라인을 인용하고, 검증 기준에서도 "파일:라인 또는
    심볼" 을 명시적으로 허용해 이 패턴을 다시 승인한다. 현재는 두 인용 모두 정확함을 실측
    확인했으나(`stripExternalOnlyFields(` 호출부 = `:422`, `toFanoutEnvelope` JSDoc 블록 =
    `:406-417`), `websocket.service.ts` 는 `interaction.service.ts` 와 함께 여전히 다수의
    in-progress plan(`ie-resume-turn-boundary-cancel.md`, `update-returning-tuple-shape.md`,
    `spec-sync-external-interaction-api-gaps.md`, `spec-draft-eia-62-waiting-payload.md` 등)이
    동시에 건드리는 활성 리팩터 대상 파일이다. target 은 **영구 spec 문서**(`spec/conventions/egress-masking.md`)의 청사진이고, Rationale 은 스스로 "영구적인 cross-file 사실은 문서를 가질
    자격이 있다" 고 주장한다 — 그 영구 문서의 load-bearing 근거가 stale 라인 번호면, 이미 한 번
    겪은 실패 모드가 이번엔 **plan 이 아니라 정식 spec** 층에서 재발한다.
  - 제안: target(및 이후 실제 신설될 `spec/conventions/egress-masking.md`)의 좌표계 표·"마스킹은
    한 번" 절 인용을 심볼 기준(`stripExternalOnlyFields()` 호출부 / `toFanoutEnvelope` JSDoc 등)
    으로 전환하거나, 최소한 "라인은 실측 시점 스냅샷이며 stale 해질 수 있다" 는 caveat 를 명시.
    검증 기준의 "파일:라인 또는 심볼" 문구도 이 저장소 관행에 맞춰 심볼 우선으로 조정 검토.

- **[INFO]** `chatChannel` egress 노출이 target 의 "마스킹은 한 번" 서술 안에 등장하지만, 그 필드의 spec 미문서화 갭은 형제 plan 에 여전히 열려 있고 target 이 이를 참조하지 않음
  - target 위치: `plan/in-progress/spec-draft-egress-masking-convention.md` §"마스킹은 한 번 — 그 뒤 단계는 마커를 덮지 않는다" 2번 (`attachRoutingContext` / `chatChannel`)
  - 관련 plan: `plan/in-progress/spec-draft-eia-notification-payload-contract.md` §"후속 (developer)" — `- [ ] **chatChannel 이 문서 없이 외부로 나간다**`
  - 상세: 해당 열린 항목은 "`attachRoutingContext` 가 `{provider, conversationKey, …}` 를 fanout
    envelope 에 넣는데 `stripExternalOnlyFields` 는 그 이전에 돌아 strip 대상이 아니다 …
    spec 어디에도 없는 필드다. 이번 draft 범위는 넓히지 않고 별건으로 판단" 이라 적혀 있다.
    실측 확인 결과 `attachRoutingContext` 는 `chatChannel` 에 `sanitizePayloadForWs`(키-이름
    마스킹, `websocket.service.ts:445`)를 이미 적용하므로 **마스킹 자체는 안전**하지만, 그
    필드가 EIA/WS payload 스키마 어디에도 문서화되지 않은 상태는 여전히 미해소다. target 이
    바로 그 호출부(`attachRoutingContext`)를 자기 "마스킹은 한 번" 규율의 예시로 쓰면서도, 같은
    호출부에 걸린 이 미해소 문서화 갭을 언급·상호참조하지 않아 새 convention 문서가 "이 경계는
    이미 다 다뤄졌다" 는 인상을 줄 수 있다.
  - 제안: target 또는 신설 문서의 "소유하지 않는다" 표·잔여 목록에 `chatChannel` 문서화 갭에 대한
    포인터 한 줄(→ `spec-draft-eia-notification-payload-contract.md` 열린 항목) 추가 검토. 차단
    사유는 아님.

## 요약
target 은 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)가 "신설 여부는 planner 판단"
으로 열어 둔 항목을 좁게 처분하고, 마커 값·마스킹 정책·`outputData` echo 등 이미 주인이 있는
영역은 명시적으로 소유권 밖에 두는 등 미해결 결정을 우회하지 않는다. `spec-draft-eia-62-waiting-payload.md`
가 이미 확정한 `MAX_SANITIZE_DEPTH=10`·`stripExternalOnlyFields` 동작·§R17 마스킹 서술과도
정합하며, 값이 반영된 이후 시점에 작성돼 선행 plan 과 충돌하지 않는다. 다만 같은 worktree
계열의 형제 plan(`ws-event-types-extract.md`)이 바로 이 파일(`websocket.service.ts`)에 대해
"라인 인용은 리팩터마다 stale 해진다" 는 교훈을 실측으로 얻고 3개 형제 문서를 심볼 기준으로
전환까지 마쳤는데, target 은 그 교훈 이후 작성되고도 같은 파일을 절대 라인으로 인용하며 검증
기준에서 그 패턴을 다시 허용한다 — 영구 spec 문서로 승격될 근거가 stale 위험을 안고 출발하는
형태라 WARNING 으로 반영을 권고한다. 그 외에는 후속 항목 무효화나 미해소 선행 조건이 관측되지
않았다(단, 컨텍스트 예산으로 인해 `plan/in-progress/**` 의 약 50개 문서가 프롬프트에서 절단돼
직접 파일시스템으로 보완 확인했다 — masking 관련 키워드로 grep 한 결과 이번 발견 두 건 외 추가
충돌은 나오지 않았다).

## 위험도
LOW
