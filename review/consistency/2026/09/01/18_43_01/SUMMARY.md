# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 CRITICAL 0건. WARNING 2건, INFO 다수는 발견되었으나 모두 차단 사유 아님.

## 전체 위험도
**LOW** — 코드 전용 PR(retry 성공 종결 시 잔존 `error` 정리 + 취소 오분류 방지 + 관측성 보강). spec 정합성·rationale 연속성·규약 준수 관점은 전부 NONE. 유일한 LOW 는 plan 문서 자체의 stale 마스터 표(§코드 표) 및 신규 private 메서드의 근접 명명.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 Critical 없음.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | `retry-turn-terminal-guard.md` §코드 표("단일 진실 목록")가 이번 라운드(C-4)에 완료된 #5·#9·#10 항목을 여전히 "P3"(미해결)로 표기 — 본문 라운드별 체크박스는 갱신됐으나 표 자체는 diff 미포함(무변경) | `plan/in-progress/retry-turn-terminal-guard.md:508-530` (§코드 표), 관련 코드 `retry-turn.service.ts` `prepareSuccessTermination`/`markSpawnedRowFailed`/`finalizeGuarded` JSDoc | 이 plan 이 스스로 "단일 진실 목록"으로 지정한 표 자신 — 같은 문서 안에서 반복된 "여러 사본 중 하나만 갱신" 패턴의 재발 | §코드 표 #5·#9·#10 행에 "완료 (2026-09-01, C-4)" 표시 + 해당 라운드 절 참조 추가 |
| 2 | naming_collision | 신규 private 메서드 `RetryTurnService.markSpawnedRowFailed` 가 기존 `ExecutionEngineService.markSpawnedRowFailedOnPublishError` 와 근접 명명 — 이번 작업 중 실제로 grep 부분일치 오판(추출 완료로 오판)을 1회 유발한 이력이 plan 에 기록됨 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:724` (신규) | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5387` (기존, 다른 클래스·다른 트리거: WS publish 실패 vs 재조회 실패) | (필수 아님) 신규 메서드 JSDoc 에 "cf. `markSpawnedRowFailedOnPublishError` (다른 클래스, WS publish 실패 전용)" 교차 참조 추가, 또는 향후 `markExecutionFailed` 공용 헬퍼 승격 시 통합 검토 대상에 포함 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `Execution.error` 엔티티 타입에 `\| null` 추가는 `spec/1-data-model.md` §2.13 이 이미 명시한 nullable 정의와 일치 — 기존 code-spec 불일치 해소 | `codebase/backend/src/modules/executions/entities/execution.entity.ts` | 없음 |
| 2 | cross_spec | retry 성공 종결 시 `error=null` 처방은 `spec/5-system/14-external-interaction-api.md` 의 상태별 `error` 필드 존재 규칙(completed 시 null)과 정합 — 기존 EIA 계약을 code 가 뒤늦게 충족 | `retry-turn.service.ts` `prepareSuccessTermination` | 없음 |
| 3 | cross_spec | 취소 오분류 방지(`assertLinkedTransitionApplied`)는 `spec/5-system/4-execution-engine.md`·`node-cancellation.md` 문서화된 상태 전이·취소 불변식과 상충 없음 | `ai-turn-orchestrator.service.ts` | 없음 |
| 4 | cross_spec | 원자 consume SQL 테스트 보강은 이미 문서화된 SQL 형태를 재확인(동작 불변) | `retry-turn.service.spec.ts` | 없음 |
| 5 | cross_spec / plan_coherence | plan frontmatter `spec_impact` 가 이번 diff 의 spec 델타(0)와 다르지만, 두 plan 모두 본문에 사유(project-planner 위임 잔여)를 이미 명시 | `plan/in-progress/retry-turn-terminal-guard.md`, `plan/in-progress/ie-resume-turn-boundary-cancel.md` frontmatter | 없음 — 별도 트래킹 중 |
| 6 | rationale_continuity | `prepareSuccessTermination`(성공 시 `error=null`)은 W16(취소 시 `error` 미저장)과 다른 상태 전이이며 코드 JSDoc 이 명시적으로 구분 인용 | `retry-turn.service.ts` `prepareSuccessTermination()` vs `finalizeGuarded()` CANCELLED 분기(미변경) | 없음 |
| 7 | rationale_continuity | `markNodeCancelled` reject 흡수는 기존 "choke point 예외" 패턴(ai-review WARNING #1, 2026-07-27)의 확장 — plan 문서가 `#1259` 감사 실패 흡수 선례를 직접 인용 | `ai-turn-orchestrator.service.ts` `assertLinkedTransitionApplied()` | 짝 NodeExecution 이 non-terminal 로 잔류할 수 있는 trade-off 는 plan 의 "우선순위 판단" 열린 항목(`markExecutionFailed` 공용 헬퍼 승격)에 재개 신호 유지 |
| 8 | convention_compliance | `node-cancellation.md` `pending_plans:` 가 `spec_impact` 를 선언한 활성 plan 3건(`retry-turn-terminal-guard.md`, `ie-resume-turn-boundary-cancel.md`, `spec-update-node-cancellation-shutdown-classification.md`) 중 일부를 역등재하지 않음 — R-5 취지 위반 소지, 사전 존재 드리프트(이번 diff 미기인), build 가드 미검출 | `spec/conventions/node-cancellation.md` frontmatter | 다음 `node-cancellation.md` planner 턴에서 `pending_plans:` 를 활성 plan 3~4건과 동기화 (developer 권한 밖) |
| 9 | naming_collision | 라운드 라벨 `C-4` 가 `spec-draft-avatar-storage-key.md:145` 에서 전혀 다른 의미(표 항목 번호)로 이미 쓰이고 있음 — 문서 스코프 로컬이라 실질 충돌 없음 | `plan/in-progress/ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md` (신규 공유 사용) vs `spec-draft-avatar-storage-key.md` (기존, 무관) | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0(코드 전용 PR 정상). 변경분은 오히려 기존 spec(nullable `error`, EIA `completed` 시 `error=null`, 취소 불변식)과의 잠재 불일치를 해소. Critical/Warning 없음 |
| rationale_continuity | NONE | W16·choke point 예외·`#1259` 선례를 정확히 인용하며 구분된 새 결정 문서화. 기각된 대안 재도입·합의 원칙 위반 없음 |
| convention_compliance | NONE | 실체 적용 규약(`node-cancellation.md` §2.3/§2.4/§5.1) 불변식을 강화하는 방향. 신규 API/DTO/에러코드/마이그레이션 없음. `pending_plans:` 역등재 누락은 사전 존재 INFO |
| plan_coherence | LOW | C-4 처분이 두 plan 의 미해결 결정(택일 대기 등)을 우회·선점하지 않음. 단 `retry-turn-terminal-guard.md` §코드 표가 완료 항목 3건 미반영(WARNING) |
| naming_collision | LOW | spec 레벨 신규 식별자 없음(spec 델타 0). 코드 레벨 `markSpawnedRowFailed` 근접 명명이 실제 grep 오판 1회 유발(WARNING). `C-4` 라벨 재사용은 무해(INFO) |

## 권장 조치사항
1. (BLOCK 해소 대상 없음 — 필수 조치 아님, 권고 사항)
2. `retry-turn-terminal-guard.md` §코드 표(508-530행) #5·#9·#10 행을 이번 C-4 라운드 완료로 갱신하고 해당 라운드 절을 교차 참조.
3. `markSpawnedRowFailed`(신규, retry-turn.service.ts) JSDoc 에 `markSpawnedRowFailedOnPublishError`(execution-engine.service.ts) 와의 차이점(트리거·소유 서비스)을 한 줄 교차 참조로 명시해 향후 grep 오판 재발 방지.
4. 후속 `node-cancellation.md` planner 턴에서 `pending_plans:` 를 `spec_impact` 선언 활성 plan 전체(3~4건)와 동기화.
