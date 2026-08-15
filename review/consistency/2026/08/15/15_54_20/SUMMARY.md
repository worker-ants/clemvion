# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 전문 확보, 재시도 필요 항목 없음)

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, `node-cancellation.md` 신규 행이 문서 스스로 선언한 스코프(취소 전용) 밖의 함수(워커 크래시 `FAILED` 종결)를 잘못된 섹션에 등재한 WARNING 1건이 실질적 문서 정합성 위반.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `finalizeStalledExhausted`(워커 크래시 → `FAILED` 종결, 사용자 취소와 무관)가 `node-cancellation.md` §6 표에 §2.4 "취소 관측 가드" 항목으로 신규 등재됨. 문서 자신의 Overview/§2.4 도입부가 "cancellation(취소) 전용" 스코프를 명시하는데, 이 함수는 그 스코프 밖(FAILED, non-cancelled). 대응 본문·Rationale 도 없이 표 1행만 추가돼 §6 의 기존 작성 패턴(행마다 본문+Rationale 동반)과도 어긋남 | `spec/conventions/node-cancellation.md` §6 표 신규 행 (`finalizeStalledExhausted`) | 문서 자신의 Overview·§2.4 스코프 선언; 자매 함수 `markWebChatIdleTimeout` 의 선례(코드 패턴 유사해도 spec 주제는 별도 문서 `data-flow/15-external-interaction.md` 가 SoT)와 불일치; `4-execution-engine.md §7.1`(워커 크래시 복구, 이 함수의 실제 SoT)은 이번 트랜잭션 원자화를 반영 안 함 | 이 행+상세 서술을 `spec/5-system/4-execution-engine.md` §7.1(또는 그 Rationale)로 이전하고 node-cancellation.md 에서 제거하거나, 유지할 경우 "cancellation 이 아니지만 동일 원자성 패턴을 공유하는 인접 함수" 로 별도 각주/부록 처리 + §6 표 상단에 스코프 확장 선언 추가(Rationale 기록 포함) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 워크스페이스 JWT 클레임 rename(`workspaceId`→`activeWorkspaceId`) 이후 옛 이름이 남은 표기 (동작 영향 없음, 이번 diff 무관 선재 상태) | `spec/5-system/3-error-handling.md` §1.3, `WORKSPACE_ID_REQUIRED` 행 | "JWT `activeWorkspaceId`(legacy `workspaceId` dual-read) 둘 다 없음" 등으로 동기화. 낮은 우선순위 |
| 2 | plan_coherence | `eia-stalled-atomicity.md` 본문 "## 조치" 5항목은 전부 `[x]`, 같은 diff 로 자매 트래커도 `[x]` 갱신됐으나 문서 하단 `## 체크리스트`(6항목)는 전부 `[ ]` 로 미동기 — 이 저장소가 반복 지적해온 본문↔체크리스트 지연 패턴 재발 | `plan/in-progress/eia-stalled-atomicity.md` `## 체크리스트` | 커밋 직전 "자매 트래커 동시 갱신" 항목을 `[x]` 로 동기화. 나머지(`/ai-review`·`--impl-done`·push)는 아직 미수행이므로 그대로 유지 |
| 3 | rationale_continuity | `finalizeStalledExhausted` 는 자매 함수(`cancelParkedExecution`/`markWebChatIdleTimeout`)와 트랜잭션 구조는 동형화됐으나 함수 레벨 try/catch 는 미도입 — 다만 caller(`execution-run.processor.ts:88`)가 이미 `.catch()` 로 예외 흡수 중이라 실질 동작은 동등, Rationale 위반 아님 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334-3413` | 조치 불요(선택). 완전 대칭을 원하면 별도 리팩터 항목으로 트래커 등재 가능(코드 일관성 이슈, code-review 영역) |
| 4 | cross_spec / convention_compliance / plan_coherence / naming_collision (공통) | 프롬프트 번들이 컨텍스트 예산 초과로 `spec/5-system/4-execution-engine.md`·`14-external-interaction-api.md` 등 다수 파일과 `plan/in-progress/` 대다수를 절단 — 이번 라운드는 전 checker 가 실제 워크트리 파일을 직접 Read/diff 대조해 우회함 | `_prompts/*.md` 번들 전반 | 후속 impl-prep 실행 시에도 "번들에 없다 ≠ 없다" 원칙 유지, 관련성 높은 파일은 직접 Read 로 보완할 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `1-auth.md` 는 타 영역과 광범위하게 정합. `workspaceId` legacy 표기 잔존 1건(INFO)만 발견 |
| rationale_continuity | NONE | `finalizeStalledExhausted` 트랜잭션화는 기존 "짝 상태 갱신=단일 트랜잭션" 원칙을 완성하는 방향, 번복 없음 |
| convention_compliance | MEDIUM | `node-cancellation.md` 신규 행이 문서 자신의 취소 전용 스코프 밖 함수를 잘못 편입 (WARNING) |
| plan_coherence | LOW | plan 간 충돌·미해소 선행조건 없음. 문서 내부 본문↔체크리스트 지연 1건(INFO) |
| naming_collision | NONE | 신규 식별자(요구사항 ID/엔티티/endpoint/이벤트/env/파일경로) 없음. 기존 식별자 재사용만 확인 |

## 권장 조치사항
1. (WARNING 해소 우선) `node-cancellation.md` §6 신규 행을 `4-execution-engine.md §7.1`(워커 크래시 복구)로 이전하거나, 유지 시 스코프 확장을 문서 상단에 명시 + Rationale 기록.
2. `eia-stalled-atomicity.md` 의 `## 체크리스트` 중 "자매 트래커 동시 갱신" 항목을 `[x]` 로 동기화.
3. (선택, 낮은 우선순위) `3-error-handling.md §1.3` 의 `workspaceId` 표기를 `activeWorkspaceId`(legacy dual-read) 로 갱신.