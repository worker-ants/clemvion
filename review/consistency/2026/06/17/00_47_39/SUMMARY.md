# Consistency Check 통합 보고서 (--impl-done)

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 대상: `spec/5-system/4-execution-engine.md` (diff-base: origin/main)
검토 모드: `--impl-done` (구현 완료 후) · 커밋 `7e38716a`+`0bd881c7`
검토 일시: 2026-06-17

## 전체 위험도
**LOW** — engine-split 브랜치의 `NodeBootstrapService` 분리·`WORKFLOW_EXECUTOR` DI 토큰 신설·`forwardRef` 제거는 순수 내부 리팩터링이며, spec 계약 위반·규약 위반·식별자 충돌 없음. 보완 사항은 plan 체크박스 미갱신 및 spec Rationale 부재(INFO 수준)에 한정.

## Critical 위배 (BLOCK 사유)
해당 없음.

## 경고 (WARNING)
해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/4-nodes/0-overview.md §1.0` 의 bootstrap 주어 서술이 신규 `NodeBootstrapService` 트리거 구조와 표면적으로 어긋남 (텍스트 자체는 NodeComponentRegistry 순회로 여전히 참) | `spec/4-nodes/0-overview.md §1.0` | "서버 부팅 시 `NodeBootstrapService.onModuleInit` 이 … `NodeComponentRegistry.bootstrap` 호출" 로 갱신 (project-planner, 체인 종료 시 일괄) |
| 2 | Cross-Spec | `HandlerDependencies` JSDoc wire-point 주석 갱신 — 외부 spec 충돌 없음 | `node-component.interface.ts` | 없음 |
| 3 | Cross-Spec | `nodes.module.ts` forwardRef 제거 — spec 무언급, §4.4 와 별개 쌍 | `nodes.module.ts` | 없음 |
| 4 | Rationale Continuity | `spec/5-system/4-execution-engine.md` Rationale 에 `NodeBootstrapService` 분리·`WORKFLOW_EXECUTOR` 용처(C-1 B옵션 기각과 구별) 미기재 | `spec engine §Rationale` | §Rationale 항 신설 (project-planner, 체인 종료 시 god-class split 전체와 함께) |
| 5 | Rationale Continuity | `NodeBootstrapService` 가 `execution-engine` 모듈 배치 — m-3 권장안(`nodes` 모듈)과 다름 | `node-bootstrap.service.ts` | plan 02-architecture.md m-3 에 최종 배치·사유 기록 (developer, 본 PR 에서 처리) |
| 6 | Rationale Continuity | forwardRef 제거가 §4.4 와 다른 쌍임이 코드 주석으로 명시됨 | `spec §4.4` | 추가 spec 갱신 선택 |
| 7 | Convention Compliance | `pending_plans` 에 `plan/complete/` 이동된 `spec-sync-execution-engine-gaps.md` 잔류 | `spec engine frontmatter` | 즉각 불요 (build 가드 통과 — guard 가 in-progress OR complete 확인) |
| 8 | Convention Compliance | `workflow-executor.interface.ts` 변경이 `4-nodes/0-overview.md` code 글로브 범위이나 기술 계약 보존 | `workflow-executor.interface.ts` | 없음 |
| 9 | Convention Compliance | `WORKFLOW_EXECUTOR` 문자열 DI 토큰 — DI 토큰 형식 규약 없음, 위반 아님 | `workflow-executor.interface.ts:84` | Symbol 선택 검토 가능 |
| 10 | Plan Coherence | C-1 step 1 / m-3 완료 체크박스 미갱신 | `plan 02-architecture.md` | `[x]` 갱신 + PR 기록 (developer, 본 PR) |
| 11 | Plan Coherence | C-1 step 5(EngineDriver) vs m-3(WORKFLOW_EXECUTOR) 구별 외부 독자에 불명확 | `plan 02-architecture.md` | 후속 착수 시 명확화 — 즉각 불요 |
| 12 | Naming Collision | diff 주석 `C-1 step1 (m-3)` 가 파일 경로 없이 인용 | 구현 diff 주석 | 경로 명시 — 선택 |
| 13 | Naming Collision | `NodeBootstrapService` plan 명시(nodes)와 실제(execution-engine) 위치 불일치 | `plan 02-architecture.md L401` | plan 을 실제 위치로 갱신 (developer, 본 PR) |
| 14 | Naming Collision | `WORKFLOW_EXECUTOR` 전역 문자열 — 단일 정의·바인딩, 충돌 없음 | `workflow-executor.interface.ts:84` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | §1.0 bootstrap 주어 표면적 불일치 (INFO) |
| Rationale Continuity | LOW | engine Rationale 에 C-1 step1 결정 미반영; 모듈 배치 m-3 권장과 다름 (INFO) |
| Convention Compliance | NONE | 규약 직접 위반 없음 |
| Plan Coherence | LOW | C-1 step1 / m-3 체크박스 미갱신 (INFO) |
| Naming Collision | NONE | 기능 식별자 충돌 없음, plan 위치 기술 불일치만 |

## 권장 조치사항 (developer 처분)

1. **[본 PR]** `02-architecture.md` C-1 step1 `[x]` + m-3 완료 표기 + L401 배치 기술을 `execution-engine` 모듈로 수정 (INFO-5·10·13).
2. **[체인 종료 시, planner]** `4-execution-engine.md §Rationale` NodeBootstrapService 분리 항 + `4-nodes/0-overview.md §1.0` bootstrap 주어 enrichment (INFO-1·4) — god-class split 전체를 아우르도록 PR4 와 함께 일괄. c1-engine-split.md spec 갱신 phase 에 정식 기록.
3. **[선택]** pending_plans dead-link 정리 (INFO-7), Symbol 토큰 (INFO-9) — 즉각 불요.
