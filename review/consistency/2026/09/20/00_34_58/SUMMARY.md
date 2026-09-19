# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전문 확보, Critical 발견 0건

## 전체 위험도
**LOW** — Critical 없음. WARNING 2건(응답 포맷 문서화 공백)과 INFO 다수(대부분 dangling 참조·범위 절단 한계 고지)

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `GET /api/folders` 목록 응답 출력 포맷 미선언 — 실제 구현은 `{ data: FolderDto[] }` 배열 wrap(pagination 없음)인데 spec 표에는 형태 언급이 없음 | `spec/2-navigation/1-workflow-list.md` §3.1, `GET /api/folders` 행 | `spec/conventions/swagger.md` §5-2, `spec/5-system/2-api-convention.md` §5.2; 실측: `codebase/backend/src/modules/folders/folders.controller.ts:43-54` (`@ApiOkWrappedArrayResponse`) | 해당 행에 "배열 응답(`{ data: FolderDto[] }`), 페이지네이션 없음" 한 줄 추가 |
| 2 | convention_compliance | `GET /api/triggers/:id/history` 응답의 출력 포맷·상한이 spec 에 없음 — 실제 구현은 배열 wrap + 최대 10건 캡핑 | `spec/2-navigation/2-trigger-list.md` §3 API 표, 해당 행 | `spec/conventions/swagger.md` §5-2; 실측: `codebase/backend/src/modules/triggers/triggers.controller.ts:155-173` (`@ApiOkWrappedArrayResponse(..., { description: '최근 실행 이력 (최대 10건)' })`) | §3 표 또는 §2.1/R-6 에 "최근 10건 상한, 배열 응답(페이지네이션 없음)" 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Folder 리소스가 중앙 RBAC 매트릭스에 행이 없음 (값 자체는 인접 리소스와 정합적이라 모순은 아님) | `spec/5-system/1-auth.md` §3.2 ↔ `spec/2-navigation/1-workflow-list.md` §3.1 | 다음 auth.md 정비 시 Folder 행 또는 "Workflow 하위 리소스로 취급" 각주 추가 |
| 2 | cross_spec | 조립 프롬프트 예산 초과로 `spec/2-navigation/` 15개 파일 + 관련 spec 109개 중 105개가 플레이스홀더 처리됨 — 표본 대조만 수행, 전수 대조 아님 | `spec/2-navigation/4-integration.md`·`6-config.md`·`_layout.md` 등 | 해당 파일들이 실제 수정 대상이 되는 라운드에서 예산 증량 또는 타겟 파일 별도 Read 로 재검증 |
| 3 | convention_compliance | `spec/2-navigation/` 파일 번호열에 `12-` 결번 — 과거 문서가 점유했다가 재배치되며 사라진 오래된 상태, 이번 작업과 무관 | `spec/2-navigation/` 디렉터리 전체 | 조치 불요. 신규 파일 추가 시 `12-` 재사용으로 인한 과거 git 이력 혼동만 유의 |
| 4 | plan_coherence | 이번 `--impl-prep` 호출의 target(`spec/2-navigation/`)이 이 worktree 의 실제 in-progress 작업(`plan/in-progress/column-guard-gaps.md`, 백엔드 컬럼 가드 테스트, `spec_impact: none`)과 코드·spec 어느 축으로도 접점이 없음 | 전체 (`spec/2-navigation/`) | 호출자/orchestrator 쪽에서 이 호출의 target 인자가 이번 세션 실제 작업과 맞는지 확인. 의도된 별도 배치 스캔이라면 무시 가능 |
| 5 | plan_coherence | `1-workflow-list.md` frontmatter `pending_plans` 가 이미 완료된 plan(`plan/complete/workflow-duplicate-nodes-edges.md`)을 계속 가리킴 — existence-only 가드는 경로가 실재하므로 통과, dangling 참조는 못 잡음 | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` | 완료된 항목을 `pending_plans` 에서 제거 (남는 미구현 surface 는 marketplace 템플릿 링크 하나로 별도 커버됨) |
| 6 | plan_coherence | `2-trigger-list.md` §2.3.1 이 존재하지 않는 plan `eia-trigger-edit-ui` 를 인용 — 단 과거 리뷰(`plan/complete/spec-draft-webhook-endpoint-path-global-unique.md:192`)에서 이미 "조치 안 함"으로 처분된 사안, 재지적은 오탐에 가까움 | `spec/2-navigation/2-trigger-list.md` §2.3.1 | 새 조치 불필요. 필요시 `spec-draft-nullable-notation-followups.md` 열린 목록에 처분 이력을 한 줄로 등재해 반복 지적 방지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Folder RBAC 매트릭스 행 누락(INFO), 예산 절단으로 15개 파일·105개 관련 spec 미검증(INFO). Critical 없음 |
| rationale_continuity | NONE | 발견사항 없음 — `1-data-model.md` Rationale("`code:` 전용 e2e 가드 셋" 비대칭 원칙 등)과 완전 정합, 핵심 기술 전제(Postgres read-only 세션의 `CREATE TEMP TABLE` 거부)를 pg18 실측으로 재확인 |
| convention_compliance | LOW | `GET /api/folders`·`GET /api/triggers/:id/history` 응답 포맷 미선언 2건(WARNING) — 구현은 정상 동작 중이나 spec 표에 형태 미기재. `12-` 결번은 조치불요 INFO |
| plan_coherence | LOW | 이번 호출 target 이 실제 in-progress 작업(column-guard-gaps)과 무관(INFO), dangling `pending_plans` 2건(INFO, 그중 1건은 이미 처분됨). CRITICAL 급 충돌 없음 |
| naming_collision | NONE | 이번 target 이 `spec_impact: none` plan 기준이라 신규 식별자 자체가 없음. 기존 식별자(요구사항 ID·엔티티·endpoint·audit 액션·ENV 변수 등) 전수 grep 교차검증 결과 충돌 없음 |

## 권장 조치사항
1. `spec/2-navigation/1-workflow-list.md` §3.1 `GET /api/folders` 행에 응답 형태(`{ data: FolderDto[] }`, pagination 없음) 명시 — WARNING #1 해소.
2. `spec/2-navigation/2-trigger-list.md` §3 (또는 §2.1/R-6)에 `GET /api/triggers/:id/history` 응답 상한(최근 10건)·배열 형태 명시 — WARNING #2 해소.
3. (선택) `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans` 에서 완료된 `workflow-duplicate-nodes-edges.md` 항목 제거.
4. (선택) `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스에 Folder 행 추가 검토.
5. (프로세스 확인, 조치 아님) 이번 `--impl-prep` target(`spec/2-navigation/`)이 이 worktree 의 실제 작업(`column-guard-gaps`, 무관한 백엔드 컬럼 가드 테스트)과 맞는지 호출자 쪽에서 재확인 — target 이 의도된 것이면 무시 가능.
