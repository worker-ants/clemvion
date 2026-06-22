# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능.

## 전체 위험도
**LOW** — 5개 checker 중 Critical/Warning 수준 위배 없음. WARNING 1건(convention_compliance, 노드 이름 표기 혼재 — 실질 영향 미미), INFO 다수. plan_coherence·naming_collision 은 위험도 NONE.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| — | — | 없음 | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `1-node-common.md` §1.3 포트 구성 표에서 `Information Extractor`(레이블)와 §2.6.3의 `information_extractor`(코드 식별자) 혼재 — 동일 문서 안 섹션별 패턴은 자연스러우나 표 내 일관성 결여 | `spec/3-workflow-editor/1-node-common.md` §1.3, §2.6.3 | — | §1.3 표는 사람이 읽는 레이블로 통일, 코드 식별자 필요 섹션(§2.6 등)은 `lower_snake_case`로 통일. 실질 영향 미미하므로 blocking 아님 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Tool Area 제거 범위 불명확 — `0-canvas.md §12`는 "스키마에서 제거" 서술, `spec/1-data-model.md §2.6`에 `tool_owner_id` 컬럼 잔류, `4-ai-assistant.md §5.2`에 `toolOwnerId?` 필드 잔류 | `spec/3-workflow-editor/0-canvas.md §12`, `4-ai-assistant.md §5.2`, `spec/1-data-model.md §2.6` | `0-canvas.md §12` 박스의 "제거됨" 범위를 "config JSON의 `toolNodeIds`·`toolOverrides` 및 캔버스 UX 비활성"으로 명확히 서술 |
| 2 | cross_spec | `3-execution.md §8.1` WebSocket 이벤트명 표기 혼용 — 이벤트 표는 점 구분 소문자(`execution.node.started`), §10.5 타임라인은 대문자 스네이크케이스(`NODE_STARTED`) | `spec/3-workflow-editor/3-execution.md §8.1, §10.5` | §10.5 대문자 표기를 §8.1 정식 이벤트명으로 통일하거나 동의어 주석 추가 |
| 3 | cross_spec | AI Assistant 편집 차단 정책 구현 상태 불일치 — `0-canvas.md §5.4.2`는 편집 차단 UI 기술, `4-ai-assistant.md §12.2`는 `ASSISTANT_WORKFLOW_RUNNING` 거부 가드 미구현 명시 | `spec/3-workflow-editor/4-ai-assistant.md §12.2`, `0-canvas.md §5.4.2` | 두 문서 상호 참조로 연결, AI Assistant 측 미구현이 동일 정책 범위임 명시 |
| 4 | cross_spec | auto-form 이행 완료 목록 SoT 단일화 필요 — `1-node-common.md §2.6.3`이 SoT이나 개별 노드 spec과 정합 미확인 | `spec/3-workflow-editor/1-node-common.md §2.6.3`, `spec/4-nodes/3-ai/` 하위 노드 spec | 개별 AI 노드 spec의 UI 설정 트랙 서술을 "SoT: `1-node-common.md §2.6.3` 참조"로 단일화 |
| 5 | cross_spec | `2-edge.md §7` Tool Area 연결 규칙이 비활성 상태 미반영 — 현재형으로 서술 중 | `spec/3-workflow-editor/2-edge.md §7` | `0-canvas.md §12`와 동일하게 "현재 비활성 — Tool Area 재작성 시 갱신" 박스 추가 |
| 6 | rationale_continuity | `toolOwnerId?` 필드 잔류 근거 미명시 — Tool Area 폐기 결정(`0-canvas.md §12`) 이후 `4-ai-assistant.md §5.2`에 필드가 근거 없이 잔류 | `spec/3-workflow-editor/4-ai-assistant.md §5.2` | 필드에 "§12 비활성화 중에도 canvas node 데이터 일부로 포함(서버 무시)" 또는 "신규 연결 설계 확정 시 갱신" 주석 추가 |
| 7 | rationale_continuity | `0-canvas.md §11.4` 중첩 시각 표현(미구현)이 §11.2 "시각 containment 미사용" 결정과 충돌 상태로 잔존, 재검토 조건 미명시 | `spec/3-workflow-editor/0-canvas.md §11.4` | §11.2 Rationale에 "컨테이너 시각 박스 도입 시 §11.4 재검토 대상" 한 줄 추가 |
| 8 | rationale_continuity | `ai_agent` auto-form 이행 결정 Rationale 누락 — §2.6.3 목록에 포함됐으나 R-3에 근거 없음 | `spec/3-workflow-editor/1-node-common.md §2.6.3`, Rationale R-3 | R-3 또는 별도 R-4로 `ai_agent` auto-form 이행 결정 근거 추가 |
| 9 | convention_compliance | `_product-overview.md` YAML frontmatter 없음 — 폴더 내 다른 spec 파일과 불일치 | `spec/3-workflow-editor/_product-overview.md` | PRD 진입 문서 frontmatter 규약 미명시 상태이므로 현재 위반 아님. 규약 명문화 필요 시 `spec/conventions/`에 추가 |
| 10 | convention_compliance | `5-version-history.md` frontmatter `id: workflow-version-history` — 폴더 내 다른 파일의 단순 slug 패턴과 불일치 | `spec/3-workflow-editor/5-version-history.md` | `id: version-history`로 단순화 또는 규약에 "폴더 scope 내 고유하면 충분" 명시 |
| 11 | convention_compliance | `1-node-common.md §2.4` `policy` enum 값(`lower_snake_case`)과 `node-output.md §3.2` `error.code`(`UPPER_SNAKE_CASE`) 규칙 혼동 유발 가능 — 실제 위반 아님 | `spec/3-workflow-editor/1-node-common.md §2.4` | "`policy` enum은 `lower_snake_case`, `error.code`는 `UPPER_SNAKE_CASE`" 한 줄 주석 추가 |
| 12 | convention_compliance | `0-canvas.md §12` "재작성 예정" 섹션에 대응 plan 파일 링크 없음 | `spec/3-workflow-editor/0-canvas.md §12` | `> plan: plan/in-progress/ai-agent-tool-connection-rewrite.md` 명시 |
| 13 | convention_compliance | `3-execution.md` `## Rationale` 섹션 부재 — 권장 사항 미충족 | `spec/3-workflow-editor/3-execution.md` | 설계 결정 누적 시 섹션 추가. 현재 의무 아님 |
| 14 | plan_coherence | M-3 plan(`02-architecture.md`) M-3 항목 체크박스가 1단계(AssistantToolRouter) 완료 후에도 미착수 표시 잔류 가능 | `plan/in-progress/refactor/02-architecture.md` M-3 항목 | 커밋 후 "1단계(AssistantToolRouter) 완료 — Guard/Persistence 후속 PR" 진행 상태 주석 추가 |
| 15 | naming_collision | `EXECUTION_NOT_FOUND` — 도구 result 페이로드와 HTTP 에러 응답 양쪽에서 동일 코드명 사용 (의도적 재사용) | `spec/3-workflow-editor/4-ai-assistant.md §4.1.1` | 현 상태 유지. 의미 일관성 향상 의도 |
| 16 | naming_collision | `CYCLE_DETECTED`·`UNKNOWN_NODE_TYPE`·`CONTAINER_INVALID_CHILD` — 실행 엔진 에러코드와 도구 결과 에러코드 명칭 공유 (의도적 재사용) | `spec/3-workflow-editor/4-ai-assistant.md §4.1.1` | 현 상태 유지. shadow workflow 검증 레이어의 의도적 설계 |
| 17 | naming_collision | `event: auto_resume`(Assistant SSE)과 `event: execution.resumed`(실행 WebSocket) — 개념적 유사성, 채널·트리거 모두 상이 | `spec/3-workflow-editor/4-ai-assistant.md §5.3`, `3-execution.md §8.1` | 현 상태 유지. 충분히 구분됨 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Tool Area 비활성 상태가 canvas·edge·data-model 세 문서에 다른 수준으로만 반영. WebSocket 이벤트명 표기 혼용. INFO 4건 |
| rationale_continuity | LOW | `toolOwnerId?` 잔류 근거 미명시, 컨테이너 시각 containment 충돌 상태 잔존, `ai_agent` auto-form Rationale 누락. INFO 3건 |
| convention_compliance | LOW | WARNING 1건(노드 이름 표기 혼재, 실질 영향 미미). 규약 직접 위반 없음. INFO 6건 |
| plan_coherence | NONE | M-3 구현이 미해결 결정 우회·선행 plan 전제 충돌 없음. plan 체크박스 갱신 권장(INFO) |
| naming_collision | NONE | 신규 식별자 충돌 없음. 에러코드 재사용은 의도적 패턴. INFO 3건 |

## 권장 조치사항
1. (BLOCK 없음 — 즉시 구현 착수 가능)
2. (착수 전 선택적) `spec/3-workflow-editor/0-canvas.md §12` 박스의 "제거됨" 범위를 config JSON 필드 비활성으로 명확히 서술하고 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 링크 추가 — INFO #1, #12 해소.
3. (착수 전 선택적) `spec/3-workflow-editor/2-edge.md §7` 상단에 "현재 비활성" 박스 추가 — INFO #5 해소.
4. (구현 완료 후) `plan/in-progress/refactor/02-architecture.md` M-3 항목에 "1단계 완료, Guard/Persistence 후속" 진행 상태 주석 — INFO #14 해소.
5. (장기) `spec/3-workflow-editor/3-execution.md §10.5` WebSocket 이벤트명 표기를 §8.1 정식 이름(`execution.node.started` 등)으로 통일 — INFO #2 해소.
