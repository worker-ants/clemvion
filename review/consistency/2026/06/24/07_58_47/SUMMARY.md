# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**MEDIUM** — WS 프로토콜 payload 불일치(execution.retry_last_turn: nodeId vs nodeExecutionId) 및 Plan 미결정 영역(Tool Area, 시각 containment) 회피 조건부로 차단 사유 없음

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `execution.retry_last_turn` payload 가 `nodeId` 로 기재 — WS SoT 는 `nodeExecutionId` (구현자가 `nodeId` 사용 시 서버 retry 로직 오작동) | `spec/3-workflow-editor/3-execution.md §8.2` | `spec/5-system/6-websocket-protocol.md §4.2` | `3-execution.md §8.2` 해당 행 payload 를 `executionId, nodeExecutionId` 로 수정 |
| 2 | Cross-Spec | `execution.md §8.1` WS 이벤트 payload 약식 기술 — `nodeExecutionId` / `nodeName` / `nodeType` 누락, `execution.user_message` 이벤트 전체 누락 | `spec/3-workflow-editor/3-execution.md §8.1` | `spec/5-system/6-websocket-protocol.md §4.1` | §8.1 을 WS spec §4.1 전체 payload 로 업데이트하거나, "payload 상세는 WS 프로토콜 §4.1 SoT" 링크 명시 |
| 3 | Plan Coherence | `0-canvas.md §12` Tool Area 재작성 예정 — `ai-agent-tool-connection-rewrite.md` 디자인 결정 5개 전부 TBD. 해당 영역 구현 착수 시 미결정 우회 발생 | `spec/3-workflow-editor/0-canvas.md §12` | `plan/in-progress/ai-agent-tool-connection-rewrite.md` | 구현 범위에 §12 Tool Area 미포함 확인. 포함 시 해당 plan §1 결정 확정 선행 |
| 4 | Plan Coherence | `0-canvas.md §11.4` 시각 containment 중첩 틴트 — 시각 containment 도입 여부 미결정 상태에서 구현 시 §11.2(미사용 결정)와 충돌 위험 | `spec/3-workflow-editor/0-canvas.md §11.4` | `plan/in-progress/spec-sync-canvas-gaps.md`, `0-canvas.md §11.2` | §11.4 구현 전 시각 containment 도입 여부를 spec 결정으로 확정하거나, impl-prep 범위에서 §11.4 제외 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | canvas §5.3.4 summaryTemplate 표에서 Filter 노드 누락 | `spec/3-workflow-editor/0-canvas.md §5.3.4` | `\| Filter \| {inputField} · {N} conditions · {combineMode} \|` 행 추가 |
| 2 | Cross-Spec | canvas §4.1 팔레트 다이어그램 Logic 섹션에서 Filter 노드 누락 | `spec/3-workflow-editor/0-canvas.md §4.1` | `▼ Logic` 다이어그램에 Filter 행 추가 |
| 3 | Cross-Spec | canvas §11.3.2 Ungroup 설명에 `background` 포트 오기재 (컨테이너에는 없는 포트) | `spec/3-workflow-editor/0-canvas.md §11.3.2` | "컨테이너의 `body` 포트(와 자식 → `emit` 포트) 엣지만 제거"로 수정 |
| 4 | Rationale Continuity | `0-canvas.md §11.1` 시각 containment 치수/확장 표현이 §11.2 "시각 containment 미사용" 결정과 긴장 관계 — Planned 표기 미흡 | `spec/3-workflow-editor/0-canvas.md §11.1` | 미구현 치수·확장 행에 `_(미구현 Planned: 시각 containment 도입 시)_` 명시 |
| 5 | Rationale Continuity | `0-canvas.md §12` Tool Area 기각된 인터랙션 본문 잔류 — 섹션 박스 경고 외 서브섹션 보호 없음 | `spec/3-workflow-editor/0-canvas.md §12.2–12.4` | §12.2–12.4 각 서브섹션 위에 "재작성 예정" 박스 또는 `_(제거됨)_` 처리 |
| 6 | Rationale Continuity | `3-execution.md §6` 브레이크포인트 — Rationale 및 미구현 표기와 정합 확인 완료. 구현 범위에서 §6 제외 여부를 plan 에 명시 권고 | `spec/3-workflow-editor/3-execution.md §6` | plan 에 §6 브레이크포인트 제외 명시 |
| 7 | Convention Compliance | `3-execution.md §3` 섹션 번호 역전 (§3.4 → §3.6 → §3.5 순서) | `spec/3-workflow-editor/3-execution.md §3` | §3.5 와 §3.6 순서 교체 또는 AI Multi Turn 을 §3.4.1 로 리넘버링 |
| 8 | Convention Compliance | `0-canvas.md §5.3.1` 과 §5.3.2 경고 메시지 표기 혼용 (`⚠ Not configured` vs `⚠ Condition not set` 패턴) | `spec/3-workflow-editor/0-canvas.md §5.3.1–5.3.2` | §5.3.1 다이어그램과 §5.3.2 표의 대응 관계를 주석으로 명시 |
| 9 | Convention Compliance | `1-node-common.md §2.6.2` widget 카운트 제목 "21종" — override 전용 3종 포함 명확성 부족 | `spec/3-workflow-editor/1-node-common.md §2.6.2` | 제목을 "21종 (렌더 가능 18종 + override 전용 3종)"으로 변경 또는 각주 추가 |
| 10 | Convention Compliance | `2-edge.md §3.1` 포트 타입 순서가 `1-node-common.md §1.2` SoT 와 불일치 (에러/시스템 순서 역전) | `spec/3-workflow-editor/2-edge.md §3.1` | 행 순서를 `1-node-common.md §1.2` 기준(데이터→시스템→에러→컨테이너)으로 정렬 |
| 11 | Plan Coherence | `0-canvas.md` frontmatter `pending_plans` 에 미완료 plan 2개 (`ai-agent-tool-connection-rewrite`, `spec-sync-canvas-gaps`) 등재 | `spec/3-workflow-editor/0-canvas.md` | 구현 범위가 해당 plan 추적 항목과 겹칠 경우 체크박스 갱신 |
| 12 | Plan Coherence | `2-edge.md` frontmatter `pending_plans` 에 미완료 plan 2개 (`ai-agent-tool-connection-rewrite`, `spec-sync-edge-gaps`) 등재 | `spec/3-workflow-editor/2-edge.md` | 구현 범위가 엣지 연결 규칙·사이클 검사와 겹치는지 확인 후 plan 갱신 |
| 13 | Naming Collision | `DUPLICATE_NAME` 에러 코드가 에러 카탈로그에 미등록 (테스트 데이터셋 이름 중복 에러) | `spec/3-workflow-editor/3-execution.md §9`, `spec/1-data-model.md §2.13.3` | `spec/5-system/3-error-handling.md` 에러 카탈로그에 `DUPLICATE_NAME` 등록 |
| 14 | Naming Collision | `spec/4-nodes/*/0-common.md` 파일들이 frontmatter `id: common` 중복 공유 — target 미도입 pre-existing 이슈 | `spec/4-nodes/` 전체 | 향후 카테고리별 고유 ID 부여 권장 (target 책임 범위 외) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | `execution.retry_last_turn` payload nodeId vs nodeExecutionId 불일치(W), §8.1 payload 약식 기술 및 user_message 누락(W), Filter 누락 2건(I), Ungroup background 오기재(I) |
| Rationale Continuity | LOW | §11.1 시각 containment 치수 Planned 표기 미흡(I), §12 기각 인터랙션 본문 잔류(I), §6 브레이크포인트 정합 확인(I) |
| Convention Compliance | NONE | §3 섹션 번호 역전(I), 경고 메시지 표기 혼용(I), widget 카운트 명확성(I), 포트 색상 순서 불일치(I) — Critical/Warning 0건 |
| Plan Coherence | LOW | §12 Tool Area TBD 5건 미결정(W), §11.4 시각 containment 미결정(W), pending_plans 미완료 2건(I) |
| Naming Collision | NONE | DUPLICATE_NAME 에러 카탈로그 미등록(I), id: common 중복 pre-existing(I) — 의미 충돌 없음 |

## 권장 조치사항

1. **(구현 전 필수)** `spec/3-workflow-editor/3-execution.md §8.2` `execution.retry_last_turn` payload 를 `executionId, nodeExecutionId` 로 수정 — WS 프로토콜 SoT 와 lockstep 유지. 미수정 시 retry 서버 로직 오작동 위험.
2. **(구현 범위 명확화)** 본 impl-prep 구현 범위에서 `0-canvas.md §12` Tool Area 와 `§11.4` 시각 containment 영역 제외 여부를 plan 에 명시. 포함 시 각각 `ai-agent-tool-connection-rewrite.md` 결정 확정 및 시각 containment 도입 여부 결정 선행 필요.
3. **(권장)** `3-execution.md §8.1` 을 WS spec §4.1 전체 payload 로 업데이트하거나 SoT 링크 추가 — `execution.user_message` 이벤트 포함.
4. **(INFO 정리 — 선택적)** canvas §4.1 팔레트 다이어그램 및 §5.3.4 summaryTemplate 표에 Filter 노드 추가; §11.3.2 Ungroup `background` 오기재 수정; §3 섹션 번호 역전 교체.
5. **(선택적)** `spec/5-system/3-error-handling.md` 에러 카탈로그에 `DUPLICATE_NAME` 등록.