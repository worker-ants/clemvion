# Cross-Spec 일관성 검토 — `nodeOutput` allowlist (EIA §R17 잔여 해소)

## 대상 변경 요약

`spec/5-system/14-external-interaction-api.md` §R17 말미의 "`nodeOutput` 일반 키 allowlist (미구현·잔여)" 항목을
"해소 (2026-08-23) — 단 `getStatus` 한 출구에 한정" 으로 갱신하고, `getStatus` waiting `nodeOutput` 출구에
`allowlistNodeOutputKeys`(신규 `codebase/backend/src/shared/utils/node-output-allowlist.ts`, fail-closed,
`NodeHandlerOutput` 공개 키에 컴파일타임 결속)를 적용. terminal `result`/`error`, SSE/fanout(`toFanoutEnvelope`)은
의도적으로 deny-list 유지 — 표로 열거해 비대칭을 spec 자신이 명시.

## 발견사항

- **[WARNING]** `spec/conventions/conversation-thread.md` 가 이제 stale 해진 "잔여 항목" 서술을 그대로 갖고 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 (line ~1780) — "~~`nodeOutput` 일반 키
    allowlist (미구현·잔여)~~ 해소 (2026-08-23)"
  - 충돌 대상: `spec/conventions/conversation-thread.md` 소비처 갱신(2026-07-09) 단락, 다음 문장:
    > "conversationConfig 이외의 일반 `nodeOutput` 키-allowlist 만 잔여 항목(상세·근거·trade-off:
    > [EIA §R17](../5-system/14-external-interaction-api.md))."
  - 상세: 이 문장은 EIA §R17 을 "상세·근거·trade-off" 의 SoT 로 명시 인용하면서, 그 SoT 가 이미 뒤집은 상태
    ("해소 (2026-08-23)")를 여전히 "잔여" 로 서술한다. `git diff origin/main...HEAD` 확인 결과
    `conversation-thread.md` 는 본 PR 에서 전혀 수정되지 않았다 — 즉 target 변경이 인용 대상(§R17)만 갱신하고
    그 문장을 그대로 인용하는 위성 문서는 갱신하지 않아 새로 stale 해졌다. 이 저장소가 반복 지적해 온 "plan
    서술은 철회로 거짓이 될 수 있다"·"두 군데 동기화 누락" 패턴과 같은 형태이며, `conversation-thread.md` 만
    읽는 독자(예: 이후 세션이 "잔여 항목" 문구를 근거로 이미 끝난 작업을 다시 plan 에 등재)에게 오도 가능성이
    있다. 실제로 EIA 자신의 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 는 이 항목을
    `[x]` 로 닫고 SSE/fanout 잔여만 별도 `[ ]` 로 새로 등재했는데, `conversation-thread.md` 의 문장은 그 구분
    (`getStatus` 만 해소·SSE 는 잔여)조차 반영하지 못한 채 뭉뚱그려 "잔여" 라고만 말해 §R17 신규 표(4행)의
    세밀한 비대칭 정보도 유실시킨다.
  - 제안: `conversation-thread.md` 388행의 해당 문장을 §R17 의 최신 상태로 동기화한다. 예:
    "`getStatus` waiting 출구의 `nodeOutput` 키-allowlist 는 해소됐다(2026-08-23, `allowlistNodeOutputKeys`);
    SSE/fanout 표면은 여전히 deny-list 잔여다 — 상세: [EIA §R17]." 코드 변경은 불필요, `spec/` 전용 정정.

## 요약

핵심 변경(§R17 allowlist 도입)은 내부적으로 잘 정합돼 있다 — `NODE_OUTPUT_ALLOWED_KEYS` 는
`spec/conventions/node-output.md` Principle 0 의 `NodeHandlerOutput` 5필드(`config`/`output`/`meta`/`port`/`status`)
및 "internal top-level 필드 허용 예외"(`_resumeState`/`_retryState`, `_resumeCheckpoint`)와 정확히 대응하고,
`getStatus` §5.3 wire 예시(`buttonConfig.nodeOutput` / `nodeOutput`)·구현(`interaction.service.ts`)·
`spec/conventions/egress-masking.md`(깊이 기반 축과 별개 축임을 명시)·SSE/fanout 비대칭(스스로 표로 열거,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 후속 항목으로 정확히 등재)까지 모두 서로
모순 없이 맞물린다. 유일한 발견은 §R17 을 "상세·근거" SoT 로 인용하던 `spec/conventions/conversation-thread.md`
의 한 문장이 target 변경으로 인해 새로 stale 해진 것으로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC ·
계층 책임 어느 축에서도 직접적 모순은 발견되지 않았다.

## 위험도

LOW
