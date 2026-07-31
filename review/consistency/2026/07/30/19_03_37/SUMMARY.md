# Consistency Check 통합 보고서

**BLOCK: NO** — CRITICAL 발견 없음 (WARNING 1건 · INFO 2건, 전부 비차단)

## 전체 위험도
**LOW** — 5개 checker 중 4개(Rationale Continuity·Convention Compliance·Plan Coherence·Naming Collision)는 NONE, Cross-Spec 만 LOW(사전 존재 데이터모델 불일치 1건 발견). 이번 target(`spec/data-flow/11-workflow.md` §1.5/§2.1/Rationale, `spec/2-navigation/1-workflow-list.md` — `workflow-duplicate-nodes-edges` plan 의 `POST /api/workflows/:id/duplicate` 계약 정정 + 구현 완료)의 핵심 변경은 구현(HEAD)·데이터모델·요구사항ID·상태전이·RBAC·계층책임·명명규약·plan 정합·신규 식별자 전 축에서 충돌 없음이 확인됐다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| (없음) | | | | | |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `workflow_version.snapshot` 필드 구성이 두 spec 문서에서 서로 반대로 서술됨 — data-flow 쪽은 `settings` **제외**·`name`/`description` **포함**을 명시하는데, data-model.md 쪽은 `settings` **포함**을 명시(name/description 언급 없음). 실제 코드(`buildSnapshot()`)는 data-flow 서술과 일치 — data-model.md 쪽이 stale. `origin/main` 시점부터 이미 존재하던 불일치로 이번 PR 이 만든 것은 아니나, target 스코프(`spec/data-flow/`) 내에서 데이터모델 SoT(`spec/1-data-model.md`)와 직접 모순되는 살아있는 서술이라 보고 | `spec/data-flow/11-workflow.md:61` 및 `## Rationale` "버전 스냅샷 = JSONB" 절(~232행) | `spec/1-data-model.md:572` §2.15 WorkflowVersion `snapshot` 행 | `spec/1-data-model.md` §2.15 `snapshot` 설명을 "워크플로우 캔버스 스냅샷 (name, description, nodes, edges — workflow.settings 는 제외)" 로 정정. 이번 PR 스코프 밖 사안이므로 이번 PR 을 막을 사유는 아니며, 별도 경량 spec-only 후속 PR 로 처리 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Rationale Continuity | 신설 Rationale("duplicate 가 export/import 를 재사용하지 않는 이유")이 동일 논리를 이미 코드 수준에서 선언한 "신뢰 경계" 선례(`restoreVersion`/`importWorkflow` 주석 — 워크스페이스 내부 기검증 데이터 vs 외부·신규 미신뢰 데이터 구분)를 명시 인용하지 않음. 결론은 완전 일치, 충돌 없음 — 계보 추적성 보강 제안일 뿐이며 이전 `--spec` 라운드에서 이미 비차단으로 판단된 사안 | `spec/data-flow/11-workflow.md` `## Rationale` > "duplicate 가 export/import 를 재사용하지 않는 이유" | (선택, 비차단) 해당 문단에 "이는 `restoreVersion`/`importWorkflow` 가 이미 구분해 둔 신뢰 경계의 세 번째 적용" 한 문장 추가하면 코드-스펙 원칙 계보가 더 명확해짐 |
| 2 | Plan Coherence | `/ai-review` RESOLUTION 이 "요청 범위 밖"으로 명시 보류한 INFO 10건(`findById` TOCTOU, 메타-트랜잭션 밖 타이밍, naming drift 등)이, 이 plan 이 `plan/complete/` 로 이동한 뒤에는 `review/code/2026/07/30/17_54_27/RESOLUTION.md` 경로로만 추적 가능해짐(전부 리뷰어 자신이 "필수 아님"으로 표기한 항목이라 유실 위험은 낮음) | `plan/in-progress/workflow-duplicate-nodes-edges.md` (곧 `plan/complete/` 이동 예정) | 필수 조치 아님. 이동 시 완료 노트에 RESOLUTION.md 경로를 포인터로 한 줄 남기면 추적성 보강 (선택) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 구현(HEAD 워킹트리)·데이터모델·요구사항ID(`NAV-WF-04`)·상태전이·RBAC·계층책임 전 축에서 target 정합 확인(직전 `--spec`/`--impl-prep` 라운드 NONE 판정 재확인). 단 `workflow_version.snapshot` 구성이 `spec/1-data-model.md` §2.15 와 상충(사전 존재, 이번 PR 무관하나 target 스코프 내 발견) — WARNING 1건 |
| Rationale Continuity | NONE | "nodes/edges 미복제" 문구 철회의 전제(합의된 트레이드오프가 아니라 `db496a3c2` 감사 시점 drift 부산물)를 `git show`/`git log -L` 로 독자 재검증해 사실과 일치 확인. 신설 Rationale 3개 절이 구현 코드·테스트와 1:1 대응(REPEATABLE READ, llmConfigId 비주입, 버전/트리거/데이터셋 비승계). 이전 두 라운드 INFO 전건(2+1) 반영 확인. 신규 INFO 1건(코드 선례 미인용, 선택 보강)만 |
| Convention Compliance | NONE | 이전 라운드 WARNING 1건(`pending_plans` 미등재)·INFO 3건(Rationale 절번호 오기·"기각한 대안" 라벨 누락·Swagger description 미갱신) 전부 해소 확인(코드·spec 직접 대조). 명명규약·에러코드(UPPER_SNAKE_CASE)·migrations·spec-impl-evidence·문서 3섹션 구조 신규 위반 없음 |
| Plan Coherence | NONE | plan 체크리스트가 실제 상태와 정확히 일치(라이프사이클 잔여 2건만 미체크). 32개 `plan/in-progress/**` 문서 재grep 결과 미해결 결정 충돌·선행 plan 미해소·후속 항목 누락 없음 |
| Naming Collision | NONE | 신규 요구사항ID·엔티티/타입·API endpoint·이벤트명·환경변수·spec 파일경로 도입 없음. 완료된 코드(`duplicate()` 재구현, 지역변수 포함) 까지 재확인 완료 |

## 권장 조치사항
1. (BLOCK 해소 불요 — Critical 없음) 별도 경량 spec-only 후속 PR 로 `spec/1-data-model.md` §2.15 `snapshot` 설명을 실제 코드(`buildSnapshot()`) 및 `spec/data-flow/11-workflow.md` 서술에 맞춰 "name, description, nodes, edges 포함 · settings 제외" 로 정정.
2. (선택) `spec/data-flow/11-workflow.md` `## Rationale` 에 `restoreVersion`/`importWorkflow` 신뢰 경계 선례를 인용하는 한 문장 추가.
3. (선택) `plan/in-progress/workflow-duplicate-nodes-edges.md` 를 `plan/complete/` 로 이동할 때, `review/code/2026/07/30/17_54_27/RESOLUTION.md` 의 보류 INFO 10건 경로를 완료 노트에 포인터로 남길 것.