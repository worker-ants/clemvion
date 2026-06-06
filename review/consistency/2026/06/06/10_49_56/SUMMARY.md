# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

검토 모드: `--impl-done`
Target: `spec/5-system` + `spec/1-data-model.md` (diff vs origin/main)
검토 일시: 2026-06-06

---

## 전체 위험도

**LOW** — Critical 위배 0건. Warning 5건(문서 동기화·레이블 정리 수준). Info 14건.

---

## Critical 위배 (BLOCK 사유)

해당 없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W1 | Cross-Spec | `data-flow/3-execution.md` 가 PR-B2a 이전 상태("멀티턴 AI fast-path 잠정 유지")를 유지 — top-level 멀티턴 AI 재개 경로 오독 유발 | `spec/5-system/4-execution-engine.md` §4.x (PR-B2a 완료 선언) | `spec/data-flow/3-execution.md` line 52, line 111~112 | `3-execution.md` line 52 note 를 B2a 완료 반영으로 수정; §1.3 sequence diagram `alt` 분기를 "중첩 executeInline 한정" 으로 범위 한정하고 else 분기에 "폼/버튼·top-level 멀티턴 AI = rehydration slow-path" 명시 |
| W2 | Cross-Spec | `data-flow/3-execution.md` §1.3 rehydration 재구성 목록에 `resume_call_stack` 누락 — PR-B2b 구현 참조 기준 흐릿 | `spec/5-system/4-execution-engine.md` §6.2, §7.5 | `spec/data-flow/3-execution.md` line 114 | `ExecutionContext 재구성` 항목에 `resume_call_stack?` 추가 + "PR-B2b 구현 예정(exec-park D6)" 괄호 주석 |
| W3 | Convention Compliance | `spec/5-system/1-auth.md §1.5.4` 표의 `forbidden`·`rate_limited` 행에 "historical-artifact, 초대 API 한정" 인라인 마커 없어 다른 도메인 적용으로 오독 가능 | `spec/5-system/1-auth.md §1.5.4` 에러 응답 표 | `spec/conventions/error-codes.md §3` | 두 행의 설명 셀에 `(historical-artifact, 초대 API 한정)` 인라인 주석 추가 |
| W4 | Plan Coherence | `impl-exec-concurrency-cap` 브랜치(PR2b)가 `spec/5-system/4-execution-engine.md` 구 모델 보유 중 — PR-B2 머지 후 rebase 선행 조건 이행 추적 메커니즘 부재 | `plan/in-progress/exec-park-durable-resume.md` (W4 이미 인지) | `plan/in-progress/exec-intake-queue-impl.md` PR2b 착수 조건 | PR-B2 머지 완료 후 PR2b rebase 이행 확인 요청; plan 에 이행 추적 항목 추가 |
| W5 | Naming Collision | `D6` 레이블이 `spec/4-nodes/3-ai/` 영역의 "AI 노드 output 경로 단일화" 결정과 동일 단문자 사용 — self-disclaimer callout 있으나 검색·인덱스 레벨 namespace 분리 불완전 | `spec/5-system/4-execution-engine.md` §7.5, §Rationale | `spec/4-nodes/3-ai/1-ai-agent.md:751` 외 2건 | `exec-D6` 또는 `EE-D6` 로 prefix namespace 분리, 또는 spec 본문에서는 "call-stack durable" 기능 명칭으로만 참조 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I1 | Cross-Spec | `data-flow/3-execution.md` §2.1 Postgres 매핑 표에 `conversation_thread`·`user_variables`·`resume_call_stack` 세 컬럼 미등재 | `spec/data-flow/3-execution.md` §2.1 | `waiting_for_input 진입 시` 케이스 행에 park 시 갱신 컬럼 3개 추가 |
| I2 | Rationale Continuity | PR-B2 분할(B2a/B2b)로 인한 "B1·B2 분리 불가" 원칙 표현 완화 — 실질 위반 아님(park-site scope 단위 이행 명시됨) | `spec/5-system/4-execution-engine.md` §Rationale | 필요 시 "B1·B2 분리 불가는 park-site scope 단위 적용" 1줄 명문화(현재도 이해 가능) |
| I3 | Rationale Continuity | `_continuationCheckpoint` 기각 결정과 `resume_call_stack` 신규 컬럼의 관계 — 직교 목적 명시로 충분 | `spec/5-system/4-execution-engine.md` §6.2, §Rationale; `spec/1-data-model.md` | `spec/1-data-model.md` `resume_call_stack` 필드 설명에 기각과의 구분 1줄 inline 추가(선택) |
| I4 | Rationale Continuity | `per-node task queue` 기각과 exec-park D6 관계 — 현 Rationale 구분 서술 충분 | `spec/5-system/4-execution-engine.md` §Rationale exec-park D6 | 변경 불필요 |
| I5 | Convention Compliance | `10-graph-rag.md` — `## Overview (제품 정의)` + `## 1. 개요` 이중 구조로 3섹션 계층 비직관적 | `spec/5-system/10-graph-rag.md` 상단 | 두 섹션 의도에 맞게 재편하거나 현행 구조 의도 주석 명시 |
| I6 | Convention Compliance | `11-mcp-client.md §6.2` — `skipReason`의 `lower_snake_case` 사용이 `node-output.md §3.2`와 레이어 다름(진단 필드 vs 에러 코드) — 현 설명 충분 | `spec/5-system/11-mcp-client.md §6.2` | 추가 조치 불필요 |
| I7 | Convention Compliance | `11-mcp-client.md §8.1` — `tool_result.error` 구조가 MCP 프로토콜 레이어(≠ `node-output.md §3.2` 노드 핸들러 레이어) — 직접 위반 아님 | `spec/5-system/11-mcp-client.md §8.1` | `tool_result.error` 가 MCP 프로토콜 레이어임을 brief 주석 명시 권장 |
| I8 | Convention Compliance | `10-graph-rag.md` frontmatter `id: graph-rag` — 파일명 숫자 prefix 제외 패턴. 일관 사용 시 무방 | `spec/5-system/10-graph-rag.md` frontmatter | 향후 가드 확장 시 `id = basename-without-numeric-prefix` 패턴 명문화 |
| I9 | Convention Compliance | `cafe24-api-catalog/application/appstore-orders.md` `order` wrapper 행 설명이 정렬 파라미터 설명으로 잘못 기재(복사 오류 추정) | `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` | wrapper 행 설명을 `(응답 객체)` 로 교정 |
| I10 | Plan Coherence | `spec-sync-auth-gaps.md`·`spec-sync-mcp-client-gaps.md`(worktree `spec-sync-audit`) 미구현 항목 spec 위임 — `--impl-done` 갭 적발은 설계 의도와 일치 | `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md` | 무조치 |
| I11 | Plan Coherence | `spec-sync-audit` worktree 가 향후 `1-auth.md`·`11-mcp-client.md` 편집 착수 시 당시 `--impl-done` 결과와 교차 검토 필요 | `plan/in-progress/spec-sync-auth-gaps.md`, `spec-sync-mcp-client-gaps.md` | 편집 착수 전 해당 시점 갭 목록과 조율 |
| I12 | Naming Collision | `CALL_STACK_SCHEMA_VERSION` vs `CHECKPOINT_SCHEMA_VERSION` — 동형 패턴 상수 병존(값 모두 1). JSDoc 독립성 주석 있어 현 수준 충분 | `resume-call-stack.types.ts:48` vs `execution-engine.service.ts:284` | 추가 조치 불필요 |
| I13 | Naming Collision | `resume_call_stack` 컬럼명 — 기존 `conversation_thread`·`user_variables` 와 동형 패턴, 충돌 없음 | `spec/1-data-model.md:467` | 추가 조치 불필요 |
| I14 | Naming Collision | `PR-B2a`/`PR-B2b` 레이블 — `spec/4-nodes/6-presentation/0-common.md:415` 의 `PR-B2` 단수 언급이 분할 이전 표기로 stale 가능 | `spec/4-nodes/6-presentation/0-common.md:415` | 해당 위치 `PR-B2a/B2b` 로 갱신하거나 "PR-B2(분할됨)" 주석 추가 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `spec/data-flow/3-execution.md` 가 PR-B2a 완료 이전 상태 유지(WARNING 2건); §2.1 매핑 표 3컬럼 누락(INFO 1건) |
| Rationale Continuity | LOW | 과거 결정(B1·B2 분리 불가, `_continuationCheckpoint` 기각, per-node 기각)과의 충돌 없음. INFO 3건(표현 보완 선택) |
| Convention Compliance | LOW | Critical 직접 위반 없음. `1-auth.md` 표 가독성 WARNING 1건; 문서 구조·레이어 혼동 INFO 5건 |
| Plan Coherence | LOW | `impl-exec-concurrency-cap` rebase 이행 추적 부재 WARNING 1건; 미구현 항목 spec 명시는 설계 의도와 정합(INFO 2건) |
| Naming Collision | LOW | `D6` 레이블 namespace 미분리 WARNING 1건; 나머지 식별자 충돌 없음(INFO 3건) |

---

## 권장 조치사항

1. **(단기 — W1)** `spec/data-flow/3-execution.md` line 52 note 및 §1.3 sequence diagram `alt` 분기를 PR-B2a 완료 반영으로 갱신. top-level vs 중첩 executeInline 구분 명시.
2. **(단기 — W2)** `spec/data-flow/3-execution.md` line 114 `ExecutionContext 재구성` 목록에 `resume_call_stack?` 추가 + PR-B2b 예정 주석.
3. **(단기 — W3)** `spec/5-system/1-auth.md §1.5.4` 표 `forbidden`·`rate_limited` 행 설명 셀에 `(historical-artifact, 초대 API 한정)` 인라인 주석 추가.
4. **(단기 — W4)** PR-B2 머지 완료 후 `impl-exec-concurrency-cap` 브랜치의 rebase 이행 확인을 plan 에 추적 항목으로 명시.
5. **(권장 — W5)** `spec/5-system/4-execution-engine.md` 의 `exec-park D6` 레이블을 `exec-D6` / `EE-D6` 등 prefix 로 namespace 분리 검토, 또는 spec 본문에서 "call-stack durable" 기능 명칭으로만 참조.
6. **(선택 — I1)** `spec/data-flow/3-execution.md` §2.1 `execution` 테이블 행에 park 시 갱신 컬럼 3개 추가.
7. **(선택 — I9)** `spec/conventions/cafe24-api-catalog/application/appstore-orders.md` `order` wrapper 행 설명을 `(응답 객체)` 로 교정.
8. **(선택 — I14)** `spec/4-nodes/6-presentation/0-common.md:415` 의 `PR-B2` 단수 언급을 분할 반영(`PR-B2a/B2b` 또는 "PR-B2(분할됨)" 주석).