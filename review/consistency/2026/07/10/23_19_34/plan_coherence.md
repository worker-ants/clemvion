# Plan 정합성 검토 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 모드: `--impl-prep` (착수 전) · target = `spec/5-system/14-external-interaction-api.md` ·
신규 plan = `plan/in-progress/eia-command-waiting-surface-guard.md`

## 발견사항

- **[WARNING]** target spec 의 `pending_plans:` 에 신규 plan 미등재
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter `pending_plans:` (현재 `spec-sync-external-interaction-api-gaps.md` 1건만 등재)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` (신규)
  - 상세: 본 target spec 은 `status: partial` 이며, `pending_plans:` 는 "미구현 surface 를 책임지는 plan" 을 열거하는 `spec-impl-evidence` 컨벤션 §2.1 필드다. 신규 plan 은 spec 표 EIA-IN-13("필수" — 노드 상태와 명령 불일치 시 `409 Conflict`)이 spec 상으로는 이미 완결된 요구사항처럼 보이지만 실제 `resolveWaitingNodeExecutionId`/`processFormResumeTurn` 코드가 이를 강제하지 않는 **실행 gap**을 닫는 작업이다 — `spec-sync-external-interaction-api-gaps.md` 가 추적하는 "미구현 backlog surface" 항목들과는 결이 다르지만, 여전히 "이 spec 의 partial 상태를 해소하는 데 필요한 작업"이라는 점은 같다. 현재 frontmatter 에는 이 사실이 반영되지 않아, `spec-status-lifecycle` 가드가 "`pending_plans` 전부 complete 되면 `implemented` 승격" 판정을 할 때 이 plan 의 진행 상태를 놓칠 수 있다 (guard 자체는 fail 하지 않지만 추적 완결성이 깨짐).
  - 제안: 코드 가이드 자체를 지금 막을 필요는 없음(빌드 가드 위반 아님) — 다만 plan 의 마지막 체크리스트 항목 "spec 동기 (필요 시 project-planner 위임)" 수행 시 `14-external-interaction-api.md` frontmatter `pending_plans:` 에 본 plan 경로를 추가하는 것을 함께 고려할 것.

- **[INFO]** F-1 선행 작업(`hooks.service.ts forwardToInteractionService` 의 nodeId 리터럴 placeholder 교체)이 어느 plan/spec frontmatter 에도 등재되지 않음
  - target 위치: 신규 plan §"후속 항목 F-1"
  - 관련 plan: `plan/conventions/chat-channel-adapter.md` frontmatter `pending_plans:` (`chat-channel-discord-gateway.md` · `chat-channel-slack-socket-mode.md` · `chat-channel-visual-ssr-png.md` 3건만, F-1 무관)
  - 상세: F-1 은 "`hooks.service.ts` 의 `nodeId: 'chat-channel'` placeholder 를 실제 대기 nodeId 조회로 교체"해야 `assertNodeId` 일치 검사를 켤 수 있다고 명시한다. 이 선행 작업은 chat-channel 어댑터 코드 변경이지만, 그 대상 convention(`chat-channel-adapter.md`)의 `pending_plans` 어디에도 나타나지 않는다 — 현재는 신규 plan 자신의 "후속 항목" 절 안에만 존재해 자기완결적이다. 지금 당장 별도 plan 신설을 요구할 정도는 아니나(선행 조건이 명확히 기술돼 blocked 상태로 남아 있음), 이 항목이 실제 착수될 때 추적 누락 위험이 있다.
  - 제안: F-1 착수 시점에 별도 plan 신설 또는 `chat-channel-adapter.md` pending_plans 등재를 함께 검토. 지금 단계에서는 비차단.

- **[INFO]** F-2(채팅 채널 native form modal 대기 중 텍스트 입력 graceful 안내)가 다루는 시나리오는 `spec/conventions/chat-channel-adapter.md` §4.1/§4.2 (Form 입력 시퀀스 규약) 어디에도 아직 명시되지 않은 새 case
  - target 위치: 신규 plan §"후속 항목 F-2"
  - 관련 spec/plan: `spec/conventions/chat-channel-adapter.md` §4.1 native modal 경로 (Slack `views.open`/Discord MODAL) — 현재는 "버튼 클릭 → modal open → submit" 경로만 서술하고, 버튼 게이팅 대기 중 사용자가 채널에 자유 텍스트를 보내는 case 는 다루지 않음. 해당 convention 의 `pending_plans:` (discord-gateway/slack-socket/visual-ssr) 도 이 case 를 포함하지 않음.
  - 상세: F-2 의 전제(본 PR 이후 form 대기 중 `submit_message` 가 `InvalidExecutionStateError` 로 거부됨)는 §4.1/§4.2 native-modal·다단계-시퀀스 규약과 상충하지 않고 오히려 지금까지 비어 있던 gap(사용자가 modal/시퀀스를 무시하고 딴 텍스트를 보내는 경우)을 새로 노출시키는 것이다. 충돌은 없으나, F-2 가 실제 착수될 때 `chat-channel-adapter.md` §4 본문에도 이 케이스의 graceful 안내 규약이 추가돼야 정합이 유지된다.
  - 제안: F-2 착수 시 developer 단독 처리보다 `chat-channel-adapter.md` §4 갱신이 필요할 가능성이 높음 — project-planner 위임 고려 대상으로 plan 자체에 이미 "본 PR 범위 밖"으로 명시돼 있어 지금은 비차단.

- **[INFO]** 발견 출처 plan(`spec-draft-pr874-deferred-docs.md`)과 신규 plan 간 상호 cross-link 부재
  - target 위치: 신규 plan 상단 "> 발견: 2026-07-10 consistency-check `review/consistency/2026/07/10/22_27_01/cross-spec.md`"
  - 관련 plan: `plan/in-progress/spec-draft-pr874-deferred-docs.md` (같은 리뷰 세션에서 파생, 아직 `in-progress`) — 해당 plan 의 "consistency-check 반영 결과" 절 말미에 정확히 같은 결함("`end_conversation` 이 노드 타입을 강제하지 않아 Form 대기 중 호출 시 409 가 아니라 빈 formData 로 조용히 재개될 수 있다. developer 후속으로 분리")을 예고했고, 신규 plan 이 바로 그 후속이다.
  - 상세: 두 plan 은 같은 리뷰(`review/consistency/2026/07/10/22_27_01/`)에서 갈라져 나왔고 내용도 정합하지만(충돌 없음), 서로를 직접 참조하지 않는다 — `spec-draft-pr874-deferred-docs.md` 는 여전히 `in-progress`(마지막 두 체크박스 `doc-guard`·`commit+PR` 미완)라 완료 시점에 이 연결 관계가 사라지지 않도록 주의 필요.
  - 제안: 필수는 아니나, 신규 plan 배경 절에 `spec-draft-pr874-deferred-docs.md` 경로를 명시적으로 cross-link 하면 추적성이 개선됨. 비차단.

- **[INFO]** frontmatter `worktree:` 값이 문서화된 스키마 예시와 다른 형태
  - target 위치: `plan/in-progress/eia-command-waiting-surface-guard.md:2` — `worktree: .claude/worktrees/elegant-driscoll-eebdd6`
  - 관련 문서: `.claude/docs/plan-lifecycle.md §4` 스키마 예시(`worktree: <task_name>-<slug>`, 즉 bare basename) — 샘플링한 다른 in-progress plan 들(`error-codes-catalog-sot.md: error-codes-catalog-sot-e09193`, `exec-intake-followups.md: exec-intake-plan-complete-877df0`, `node-cancellation-inflight-followups.md: grooming-small-dev-08a15a`)도 전부 bare basename 만 사용.
  - 상세: `.claude/hooks/_lib/plan_guard.py` 의 `_normalize_worktree_value` 가 `.claude/worktrees/x` 형태의 leading path 를 정상적으로 strip 하므로 push-gate 연결 판정에는 기능적 문제가 없다. 다만 스타일이 문서 예시·기존 관례와 다르다.
  - 제안: 굳이 지금 고칠 필요는 없음(기능 영향 없음) — 다음 편집 시 `worktree: elegant-driscoll-eebdd6` 로 정규화하면 관례와 일치.

## 위 항목 외 확인된 정합 사항 (참고, 발견 아님)

- `execution-engine-residual-gaps.md`(G1/G2/G3), `error-codes-catalog-sot.md`, `exec-intake-followups.md`, `chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md`/`chat-channel-visual-ssr-png.md`, `node-cancellation-inflight-followups.md` — 전부 다른 영역/다른 코드 경로를 다루며 target 과 충돌하지 않음.
- 신규 에러 코드 불필요 주장은 정확함 — `STATE_MISMATCH`(409)·`INVALID_EXECUTION_STATE`(WS)·`INVALID_STATE`(422) 세 코드 모두 `spec/5-system/3-error-handling.md` §1.3/§1.5/§1.6 에 이미 등재돼 있어 `error-codes-catalog-sot.md` 와 충돌 없음.
- F-1 이 인용하는 "`assertNodeId` 가 존재 여부만 검사" 문제는 `spec/5-system/4-execution-engine.md §7.5.1` 이미 명시한 "nodeId 미일치" 케이스와 정합 — spec 이 이미 요구하는 것을 코드가 구현하지 못한 pre-existing drift 이며, 신규 plan 이 새로 지어낸 결정이 아님.
- target 이 제시하는 "대기표면 → 허용 명령" 매트릭스는 EIA §5.1/WS §4.2/`chat-channel-adapter.md` §4 어디에도 아직 명문화돼 있지 않은 신규 spec surface 다 — plan 체크리스트 마지막 항목("spec 동기")이 이를 인지하고 있어 누락이 아님.
- frontmatter 필수 3필드(`worktree`/`started`/`owner`) 모두 존재 — 스키마 위반 없음 (worktree 값 스타일 이슈는 위 INFO 로 별도 기록).

## 요약

신규 plan `eia-command-waiting-surface-guard.md` 는 기존 `plan/in-progress/` 어떤 미해결 결정과도 충돌하지 않으며, 선행 plan 이 아직 해소하지 못한 전제 조건에 의존하지도 않는다. 새로 지어낸 결정처럼 보이는 부분(명령↔대기표면 매트릭스, 신규 에러 코드 불필요)은 모두 기존 spec 문구(EIA-IN-13, §7.5.1, 3-error-handling 카탈로그)와 정합하는 "이미 약속된 계약의 구현"이다. 다만 (1) target spec 의 `pending_plans:` frontmatter 에 본 plan 이 등재되지 않아 추적 완결성이 약간 흐트러져 있고, (2) F-1/F-2 후속 항목이 관련 convention(`chat-channel-adapter.md`)의 pending_plans 에는 반영되지 않은 채 신규 plan 문서 안에서만 self-contained 로 남아 있으며, (3) 같은 리뷰 세션에서 파생된 자매 plan(`spec-draft-pr874-deferred-docs.md`)과의 상호 cross-link 이 없다. 이들은 모두 비차단 INFO/경미한 WARNING 수준이며, 구현 착수를 막을 사유는 없다.

## 위험도

LOW
