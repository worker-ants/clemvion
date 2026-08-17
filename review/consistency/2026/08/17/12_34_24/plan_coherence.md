### 발견사항

- **[INFO]** 체크박스는 뒤집혔는데 그 옆 "이연 사유" 산문이 그대로 남았다
  - target 위치: (target 자체가 아니라 target 이 갱신한 plan) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:293-299`
  - 관련 plan: 같은 파일, `sanitize-error-message.ts 마커 JSDoc 을 MASKED_MARKERS 에 귀속시키기` 항목
  - 상세: 이번 PR(`8d853b56a`)이 이 체크박스를 `[ ]` → `[x]` 로 뒤집었고, 실제로 `codebase/backend/src/shared/utils/sanitize-error-message.ts` diff 에서 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 선언을 대형 JSDoc 블록 위로 옮겨 그 JSDoc 이 `MASKED_MARKERS` 에 붙도록 재배치했다 — 즉 항목 자체는 **정확히 완료됐다**. 다만 바로 아래 `> **이연 사유**: ... 다음에 이 파일을 여는 작업에 곁들인다.` blockquote 는 과거(이전 PR 라운드)의 "왜 지금 안 고쳤는가" 설명을 그대로 남겨 뒀다 — "지금 고쳤다"는 갱신 없이. 이 트래커 문서 자체가 같은 패턴("체크박스를 옮길 때 그 옆 산문을 같이 읽어라")을 이미 3회 지적했다(`428-431`, `497-499`, `558-565`행) — 이번이 사실상 4번째 재발이나, 판단(완료 여부)에는 영향 없는 순수 문서 staleness다.
  - 제안: plan 쪽에서 `> **이연 사유**` 블록 끝에 `→ **round2 PR(2026-08-17)에서 함께 처리됨**` 한 줄만 추가하면 해소. target(코드/spec) 변경은 불필요.

그 외 점검한 축은 전부 정합:
- `eia-masked-prefill-roundtrip-guard.md`(현재 plan)의 `pending_plans`가 가리키는 `spec-sync-external-interaction-api-gaps.md`의 관련 항목 4개(`sanitize-error-message.ts` JSDoc, 유저가이드 Error 탭 캐비엇, "WS 대기-재개 점검", `inputData` egress 마스킹 잔여)를 실측 대조한 결과 — 체크박스·서술·diff가 서로 어긋나지 않는다.
- `spec/5-system/14-external-interaction-api.md` §R17 에 신설된 "프리필 왕복" 불릿은 `Execution.inputData` 카브아웃의 "닫는 조건"을 **부분 충족**(폼 프리필만, Re-run 모달·에디터 히스토리 로드는 미확장)으로 정확히 서술하며, 해당 트래커 항목(`spec-sync-...md:261`)도 여전히 `[ ]`로 열려 있어 조기 종결 없음.
- 같은 §R17 섹션을 동시에 편집 대상으로 삼는 `plan/in-progress/spec-draft-eia-62-waiting-payload.md`(별도 worktree `eia-r8-cache-scope-4ae434`)가 존재하나, 그 문서의 §R17 관련 미해결 항목(llmCalls strip 서술 확장)은 본 PR 의 diff 범위(폼 프리필 마커 가드)와 겹치지 않아 결정 충돌 없음. (worktree 간 동시 편집 자체는 검토 대상 아님.)
- `codebase/channel-web-chat`의 `DynamicForm` 컴포넌트는 `defaultValue`를 아예 읽지 않아 같은 왕복 오염 취약점이 없음을 실측 확인 — "후속 항목 누락" 의심을 제기했으나 실측으로 반증, 미등재가 정당함.
- 다른 in-progress plan(전문 포함된 6개: retry-turn-terminal-guard·ws-event-types-extract·ai-agent-tool-connection-rewrite·backend-lint-gate-broken-on-main·cafe24-backlog-residual·deps-peer-gating-and-eslint10, 및 목록만 있는 57개)에 `dynamic-form-ui`/`formConfig`/`MASKED_MARKERS`/`sanitize-error-message` 참조가 전무함을 grep 으로 확인 — 후속 무효화·신규 필요 항목 없음.
- plan frontmatter `spec_impact`(`12-background.md`·`14-external-interaction-api.md`·`15-chat-channel.md`)가 실제 spec diff 3개 파일과 정확히 일치.

### 요약
`eia-masking-round2` PR(폼 `defaultValue` 프리필 왕복 오염 차단)은 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 관련 항목들을 정확히 갱신했고, spec §R17 addendum 은 "부분 해소"임을 스스로 명시해 트래커의 미해결 상태와 모순되지 않는다. 유일하게 발견한 것은 트래커 내부의 stale 산문(체크박스는 완료로 바뀌었는데 옆 blockquote 는 과거 이연 사유를 그대로 남김) 하나로, 판정에 영향 없는 저비용 문서 정리 건이다. 미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 축에서도 실질적 문제를 찾지 못했다.

### 위험도
LOW
