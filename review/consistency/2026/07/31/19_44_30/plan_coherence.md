# Plan 정합성 검토 — spec/data-flow/

## 검토 방법

`spec/data-flow/` 8개 문서(bundled: `0-overview.md`·`1-audit.md`·`3-execution.md`·`10-triggers.md`·
`11-workflow.md`·`12-workspace.md`·`13-agent-memory.md`·`14-chat-channel.md`)를 전문 정독하고,
prompt 에 번들된 `plan/in-progress/` 8개 문서를 정독했다. 컨텍스트 예산 초과로 생략된 plan 56개 ·
data-flow 8개 파일은 "없음=문제없음" 으로 취급하지 않고, 파일명·내용상 target 과 교차 가능성이
있는 다음 문서를 저장소에서 직접 절대경로로 열어 실측했다: `spec-workflow-version-snapshot-drift.md`,
`exec-intake-followups.md`, `spec-sync-{websocket-protocol,external-interaction-api,user-profile,common}-gaps.md`,
`audit-residual-triage.md`, `node-cancellation-residual-signal-propagation.md`,
`spec-update-node-cancellation-shutdown-classification.md`, `retry-turn-terminal-guard.md`,
`ie-resume-turn-boundary-cancel.md`, `chat-channel-{discord-gateway,slack-socket-mode,visual-ssr-png}.md`,
`webchat-{command-failure-is-not-termination,spec-rationale-followup,evidence-pointers}.md`,
`node-output-redesign/README.md`, `rag-quality-improvement.md`. 실제 `spec/1-data-model.md:572` ·
`spec/data-flow/3-execution.md` 라인도 대조했다.

## 발견사항

- **[WARNING] SIGTERM/graceful-shutdown 취소 분류가 미해결 (a)/(b) 결정에 걸려 있는데 target 이 그 축과 알려진 잔여 gap 을 언급하지 않음**
  - target 위치: `spec/data-flow/3-execution.md` §3.3 "비정상 종료 회수" 표의 `ShutdownStateService.onApplicationShutdown` 행(300행) — "NodeExecution + Execution 각각 atomic UPDATE — `failed` + `error.code='SERVER_INTERRUPTED'`". 같은 문서 §3.1/§3.2 상태 다이어그램의 `SERVER_INTERRUPTED → failed` 전이(252·268·279행)도 동일 축.
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`(frontmatter `spec_impact` 에 `spec/data-flow/3-execution.md` 명시) "## 결정이 필요하다 (택일)" — (a) 기존 `failed` 유지 vs (b) `cancelled` 로 재정의, 두 체크박스 모두 `[ ]` 미결("미결은 이 문서 최상단의 (a)/(b) 택일 결정뿐이며, 그 결정은 여전히 사용자 몫이다"). `plan/in-progress/node-cancellation-residual-signal-propagation.md` "### 백로그" 절의 "graceful shutdown 의 `FAILED`(`SERVER_INTERRUPTED`) 를 가드가 감지하지 못한다" 항목.
  - 상세: target 은 SIGTERM grace 초과 시의 atomic UPDATE 를 최종 상태처럼 서술해, shutdown 이 깔끔히 종결되는 것으로 읽힌다. 그러나 두 plan 이 공통 실측한 사실은 — 취소 관측 가드 `assertExecutionNotCancelled` 는 `CANCELLED` 만 검사하고 `FAILED`(`SERVER_INTERRUPTED`)는 보지 않으므로, 위 UPDATE 이후에도 같은 프로세스의 dispatch 루프가 살아 있으면 계속 노드를 dispatch 할 수 있다는 것이다 — "이 PR 이 `stop()` 에 대해 막은 것과 같은 결함이 shutdown 경로엔 남는다"(node-cancellation-residual-signal-propagation.md). 이 gap 의 해소 방식(`assertExecutionNotCancelled` 관측 대상을 `status IN (CANCELLED, FAILED)` 로 확장할지)은 정확히 위 (a)/(b) 결정에 종속돼 있는데 아직 확정되지 않았다. target 은 이 미결 정책 축이나 잔여 위험을 전혀 언급하지 않는다. (참고로 target 이 (a)/(b) 중 하나를 일방적으로 선점한 것은 아니다 — 서술된 `failed` 분류는 현재 구현의 사실이다.)
  - 제안: `spec-update-node-cancellation-shutdown-classification.md` 자신이 "(b) 채택 시 동반 갱신" 목록에 `data-flow/3-execution.md` 를 이미 명시하고 있으므로, 결정이 나기 전까지는 target §3.3 행 또는 각주에 "dispatch 루프가 이 UPDATE 를 즉시 관측하지 못할 수 있음(가드가 CANCELLED 만 검사) — 분류 정책은 결정 대기(`spec-update-node-cancellation-shutdown-classification.md`)" 정도의 상호참조를 추가해 두는 편이 안전하다.

- **[INFO] `execution-engine-residual-gaps.md` G1 의 "장래 도입 여지" 서술이 이후 확정된 won't-do 결정과 어긋남 — data-flow 범위 밖, 참고용**
  - target 위치: 해당 없음(`spec/data-flow/`는 이 축을 서술하지 않아 자체로는 정합).
  - 관련 plan: `plan/in-progress/execution-engine-residual-gaps.md` G1 절(2026-07-05, "WS 시작 경로를 실제 도입하려면 별도 product 결정 + `6-websocket-protocol §4.2` Planned 승격 선행. 그때 동일 gate 를 함께 적용한다는 의도는 §11 에 보존됨") vs `plan/in-progress/spec-sync-websocket-protocol-gaps.md` "## 비채택 (won't-do) — 종결 2026-07-08" 절(`execution.start`/`execution.stop` WS 명령 영구 미도입 확정).
  - 상세: G1 철회 시점(07-05)엔 "WS 실행 시작"이 미결 future option 취급이었으나 3일 뒤(07-08) 사용자가 이를 영구 won't-do 로 확정했다. G1 절의 "그때 동일 gate 를 적용한다" 문장은 이제 일어나지 않을 시나리오를 전제로 한 죽은 서술이 됐고, 두 plan 사이에 상호참조가 없어 이 staleness 가 어디에도 반영되지 않았다.
  - 제안: `spec/data-flow/` 자체엔 영향 없어 이 checker 범위 밖이지만, `execution-engine-residual-gaps.md` 또는 `spec/5-system/4-execution-engine.md §11` 다음 정리 시 함께 반영할 후보로 남긴다.

- **[INFO] AI Agent Tool Area 재설계의 미결 결정과 target 의 스키마 레벨 서술 — 실질 충돌 아님, 저강도 관찰**
  - target 위치: `spec/data-flow/11-workflow.md` §1.2 "노드 컨테이너 / Tool Area 배치" 표, Rationale "노드 배치 두 축의 mutual exclusion".
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` "## 결정 기록" — 도구 등록 모델(a/b/c 안 포함) 등 5항목 전부 `TBD`.
  - 상세: target 은 `tool_owner_id`/`chk_node_placement` 라는 DB 스키마·그래프 필터링 메커니즘을 사실대로 서술할 뿐, "일반 노드를 도구로 연결"하는 실제 기능(제거된 `toolNodeIds`, 캔버스 Tool Area UX)의 재설계 방향을 선점하지 않는다 — 실측 확인 결과 `graph-builder.ts`/`reachable-nodes.ts` 는 `toolOwnerId` 를 필터링만 하고, 프런트에는 Tool Area 드래그 UI 자체가 없다(`toolNodeIds` 는 스키마에서 완전히 제거되고 legacy passthrough 로만 남음). 실질 충돌은 아니라고 판단.
  - 제안: 조치 불필요. 재설계 결정이 내려지는 시점(특히 (a) Tool Area 부활 채택 시)에 §1.2 표·Rationale 을 갱신 대상으로만 인지해 두면 충분.

## 정합성이 확인된 주요 항목 (참고)

아래는 target 변경/서술과 plan 상태가 실제로 잘 맞물려 있음을 실측 확인한 것으로, 별도 조치가
필요하지 않다: (1) `workflow-duplicate-nodes-edges.md` 의 duplicate() 재설계 → `11-workflow.md` §1.5/§2.1/Rationale 완전 반영. (2) `spec-workflow-version-snapshot-drift.md` 의 `1-data-model.md` 수정 → `11-workflow.md` 는 애초에 outlier 가 아니었음(3곳 합의 소스). (3) `exec-intake-followups.md` 의 priority 3-tier·orphan pending backstop → `3-execution.md`/`10-triggers.md` 에 정확히 반영. (4) `execution-engine-residual-gaps.md` G3(continuation seq TTL) → `3-execution.md` §2.3 sliding-window TTL 로 이미 반영, G2 defer 상태와 `3-execution.md` §3.3 서술(전부 `failed` 처리) 정합. (5) `spec-update-node-cancellation-shutdown-classification.md` #6/#7 이행분(취소 생산자 3곳 미러) → `3-execution.md` §3.2 mermaid 라벨에 이미 반영. (6) `retry-turn-terminal-guard.md` W4 → `3-execution.md` §3.1 의 `failed → waiting_for_input` re-park 엣지 이미 반영. (7) `spec-sync-user-profile-gaps.md` 의 에디터 슬러그 phase 2 완료 서술 ↔ `12-workspace.md` Rationale 의 "에디터는 슬러그 라우팅 phase 2 부터" 각주 정합. (8) `spec-sync-external-interaction-api-gaps.md` 의 "분산 SSE/notification fan-out 미구현(오픈)" ↔ `0-overview.md`/`14-chat-channel.md` 의 "단일 sink in-process" 서술 정합(과잉 주장 없음).

## 요약

target(`spec/data-flow/`) 8개 문서는 관련 `plan/in-progress` 항목들과 대체로 잘 정합돼 있다. 이미
완료된 후속 작업(workflow duplicate 재설계, exec-intake 잔여, 워크스페이스 슬러그 phase 2,
`agent_memory`/continuation TTL, node-cancellation 재-throw 가드, retry_last_turn re-park 엣지 등)은
target 에 정확히 반영돼 있고, 여전히 열려 있는 결정(EIA 분산 fan-out, chat-channel 소켓/게이트웨이
백로그, 웹채팅 명령-실패 정책 등)에 대해서도 target 은 섣부른 선점 서술 없이 현재 구현 상태만
사실대로 기술한다. 유일한 실질 gap 은 SIGTERM/graceful-shutdown 취소 분류(§3.3)로, 활성 plan 2건이
명시적으로 추적 중인 미해결 (a)/(b) 결정과 그에 종속된 실측 gap(취소 가드가 `FAILED` 를 관측하지
못함)을 target 이 언급하지 않는다는 점이다 — target 자체가 그 결정을 선점하지는 않으나 상호참조
부재로 "완결된 것처럼" 읽힐 위험이 있어 WARNING 으로 등재한다. 나머지 2건은 data-flow 범위 밖이거나
실질 충돌이 아닌 저강도 관찰(INFO)이다.

## 위험도

LOW
