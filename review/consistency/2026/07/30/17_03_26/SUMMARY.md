# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 1건(`spec-impl-evidence.md §2.1` pending_plans 누락)은
구현 착수를 막지 않는 문서 위생 사안.

## 전체 위험도
**MEDIUM** — Critical 없음. 5개 checker 중 4개는 NONE/LOW 이나, Convention Compliance 가 실질적
build-gate 위험을 동반한 WARNING 1건(신규 명문화된 미구현 계약의 책임 plan 미등재)을 확인했다.

## Critical 위배 (BLOCK 사유)

없음 — 5개 checker 전원 CRITICAL 급 발견 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `status: partial` 문서가 이번 diff 로 새로 명문화한 미구현 계약(`복제`=노드·엣지 포함 캔버스 전체 복사)의 책임 plan 이 `pending_plans:` 목록에서 누락. 코드(`workflows.service.ts:216-233` `duplicate()`)는 여전히 메타 row 만 INSERT하는 미구현 상태 | `spec/2-navigation/1-workflow-list.md` frontmatter (라인 2-13) | `spec/conventions/spec-impl-evidence.md §2.1`(status:partial ⇒ pending_plans ✓ 의무) — 현재 목록엔 무관한 표면(§2.7 마켓플레이스 링크)을 책임지는 `marketplace-and-plugin-sdk.md` 만 있고, 실제 책임 plan `plan/in-progress/workflow-duplicate-nodes-edges.md` 는 전 저장소 grep 0건(역참조 없음) | frontmatter `pending_plans:` 에 `plan/in-progress/workflow-duplicate-nodes-edges.md` 추가. plan 이 `plan/complete/` 로 이동하면 경로도 동기화 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity + Convention Compliance (동일 지적 중복 통합) | 신규 Rationale 인용 "[워크플로우 에디터 §7 Rationale]" 이 실제로는 `3-execution.md` 의 `### R-2.2 테스트 데이터셋 저장 — 권한·소유 모델`(§2.2 하위)을 가리켜야 함 — 섹션 번호 오기. 문서 실제 §7("실행 히스토리 (인-에디터)")은 duplicate·clone 과 무관한 내용이라 독자가 링크를 따라가면 엉뚱한 절에 도달 | `spec/data-flow/11-workflow.md` `## Rationale` > "duplicate 는 캔버스 전체를 복제한다(메타-only 서술의 철회)" 절 (약 라인 252) | `[워크플로우 에디터 §7 Rationale]` → `[워크플로우 실행 §2.2 / R-2.2]` 로 라벨 정정 + `spec/1-data-model.md:522` 가 이미 쓰는 것과 동일한 앵커(`#r-22-테스트-데이터셋-저장--권한소유-모델-2026-06-14`) 사용 |
| 2 | Convention Compliance | plan 은 "기각한 대안 2건 이관 완료"라 선언했으나 spec 에는 1건("복제본에 Manual Trigger 자동 생성")만 명시적 "기각한 대안" 라벨로 반영되고, 나머지 1건("spec 을 코드에 맞춰 하향 확정")은 "철회" 절 말미 한 문장으로 축약돼 형식이 비대칭 | `spec/data-flow/11-workflow.md` `## Rationale` "복제가 버전 이력·트리거·데이터셋을 승계하지 않는 이유" 절 (라인 266-278) | 두 번째 기각 대안도 "기각한 대안 — spec 을 코드에 맞춰 하향 확정: …" 형식으로 명시하면 plan 의 "이관 완료" 선언과 spec 실물이 정확히 대칭(필수는 아님 — 내용 자체는 이미 존재) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | 데이터 모델(§2.4/§2.6/§2.7/§2.8/§2.13/§2.13.3/§2.15)·참조 무결성·sub-workflow 외부 참조·API 계약(응답 타입·frontend 소비부)·요구사항 ID(`NAV-WF-04`)·상태 전이(Manual Trigger 불변식)·RBAC·계층 책임(WorkflowsService 직접 쓰기 선례)·graph-warning 3중 가드까지 저장소 원본 대조 — 충돌 없음. 1차(`--spec`) INFO 2건도 커밋 본문에 반영 확인 |
| Rationale Continuity | LOW | INFO 1건(Rationale 인용 섹션 번호 오기). "메타-only" 철회가 합의된 트레이드오프가 아니라 `db496a3c2` drift-sync 부작용이었음을 커밋 실측(`git show`/`git log --follow`)으로 재확인 — 기각 대안 재도입·합의 원칙 위반·무근거 번복 없음 |
| Convention Compliance | LOW | WARNING 1건(`1-workflow-list.md` pending_plans 누락, `spec-impl-evidence.md §2.1`) + INFO 2건(인용 오기, 기각 대안 라벨 비대칭). Swagger/error-codes/migrations/명명 규약은 전 영역 저촉 없음 확인 |
| Plan Coherence | NONE | `workflow-duplicate-nodes-edges.md` TO-BE(§1.1~§1.4)를 문구 수준까지 정확히 구현. 미해결 결정·선행 plan 미해소·후속 항목 누락 없음. 1차 라운드 INFO 6건 전부 반영 확인 |
| Naming Collision | NONE | 신규 요구사항 ID·엔티티/타입·API endpoint·이벤트·환경변수·spec 파일 도입 없음. 언급 식별자 전부 기존 코드/spec 재사용을 파일 실측으로 확인. 직전 라운드 INFO(§2.1 표 workflow/node/edge 비대칭) 해소 확인 |

## 권장 조치사항
1. (BLOCK 해소 불필요 — Critical 없음) `WorkflowsService.duplicate()` 구현
   (`codebase/backend/src/modules/workflows/workflows.service.ts:216-233`) 착수는 즉시 가능.
2. `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` 에
   `plan/in-progress/workflow-duplicate-nodes-edges.md` 추가 — WARNING 해소. 다른 in-progress plan
   (`marketplace-and-plugin-sdk.md`)이 먼저 완료돼 `plan/complete/` 로 이동할 경우
   `spec-status-lifecycle.test.ts` 가 이 문서를 `implemented` 로 잘못 승격 압박할 수 있으므로, 구현
   착수와 병행하거나 그 전에 처리 권장.
3. `spec/data-flow/11-workflow.md` Rationale 절의 "[워크플로우 에디터 §7 Rationale]" 인용을
   "[워크플로우 실행 §2.2 / R-2.2]" 로 정정(섹션 번호 오기, `spec/1-data-model.md:522` 의 기존 정확한
   인용 패턴 참고).
4. (선택) 두 번째 기각 대안("spec 을 코드에 맞춰 하향 확정")도 명시적 "기각한 대안" 라벨로 표기해 plan
   의 이관 완료 선언과 spec 실물을 대칭화.
