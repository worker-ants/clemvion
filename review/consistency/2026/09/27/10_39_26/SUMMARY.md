# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 전문 확보, Critical 발견 없음.

## 전체 위험도
**LOW** — Critical 없음. Folder 모듈(RBAC 매트릭스 미등재, 신설 e2e 의 frontmatter `code:` 미등재, 인접 tracker 항목 비인지)에 걸친 WARNING 3건이 서로 다른 checker 에서 중복 없이 확인됨. 착수 자체를 저지할 사유는 아님.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Folder 리소스가 RBAC 리소스별 권한 매트릭스(§3.2)에 등재되지 않았으나, 다른 두 문서가 이미 Folder RBAC 적용을 전제 | `spec/2-navigation/1-workflow-list.md` §3.1 (Folder API 를 `editor+` 로 인라인 표기, §3.2 인용 없음) | `spec/5-system/1-auth.md` §3.2 (Folder 행 부재) / `spec/5-system/_product-overview.md` NF-SC-02 (Folder 가드 적용 이미 ✅) | `1-auth.md` §3.2 에 `Folder \| CRUD \| CRUD \| CRUD \| R` 행 추가, 또는 SoT 위임 각주 명시. planner 턴에서 `spec/5-system/1-auth.md` 동시 갱신 |
| 2 | rationale_continuity | 신설 `folders.e2e-spec.ts` (§3.1 폴더 API 계약을 1차 시행)가 `1-workflow-list.md` frontmatter `code:` 에 등재될 계획이 없음 — `data-model.md` Rationale·`2-trigger-list.md` 의 "자기 도메인 1차 시행 e2e 는 소유 spec 문서 `code:` 에 등재" 관행과 거리 | `plan/in-progress/folders-contract-e2e.md` "방향" §4 (e2e 신설 계획, frontmatter 갱신 언급 없음) | `spec/1-data-model.md` Rationale "code: 에 전용 e2e 가드 셋(2026-09-19)" / `spec/2-navigation/2-trigger-list.md` frontmatter 실천 사례 | plan §7 또는 §4 에 `1-workflow-list.md` frontmatter `code:` 에 `codebase/backend/test/folders.e2e-spec.ts` 를 "시행 코드 — §3.1 루트 폴더 생성 응답의 `parentId` 표현을 고정" 주석과 함께 추가하는 단계 명시. 의도적 제외라면 배제 근거를 plan 에 기록 |
| 3 | plan_coherence | `1-workflow-list.md` §3.1 폴더 API 에 인접한 기존 미해소 tracker 항목(응답 envelope 미기술 + 완료된 `pending_plans` 참조 오류)을 이번 착수가 인지·교차 참조하지 않음 | `spec/2-navigation/1-workflow-list.md` frontmatter `pending_plans:` (완료된 `workflow-duplicate-nodes-edges.md` 참조 잔존) + §3.1 `GET /api/folders` 행 | `plan/in-progress/spec-draft-nullable-notation-followups.md` line ~6253 미체크 항목 (2026-09-20 등재) | `folders-contract-e2e.md` 실행 시 (a) `GET /api/folders` 응답 envelope 을 §3.1 에 한 줄 보강하거나, (b) 최소한 plan 본문에 "이 tracker 항목은 별도 스코프" 라고 명시. `pending_plans:` 완료 참조 제거는 별도 planner 턴 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | Folder 목록 API 응답 envelope(페이지네이션 여부) 미기술 — Folder 고유 문제 아니라 `ApiOkWrappedArrayResponse` 를 쓰는 다수 컨트롤러 전역의 기존 격차 | `spec/2-navigation/1-workflow-list.md` §3.1 `GET /api/folders` vs `spec/5-system/2-api-convention.md` §5.2 | 이번 target PR 범위 밖. `api-convention.md` §5.2 "비-페이징 고정 컬렉션" 예외 목록 확장은 별도 스윕(`spec-draft-nullable-notation-followups.md`)에 |
| 2 | convention_compliance | 폴더 API 컨트롤러가 `FolderDto` 를 광고하지만 서비스는 TypeORM `Folder` 엔티티를 그대로 반환 (현재 relations 미로드로 즉시 유출은 없음) | `spec/2-navigation/1-workflow-list.md` §3.1 / `folders.controller.ts`·`folders.service.ts` | `swagger.md` §5-1 이 명시하는 entity-passthrough 실패 패턴과 동일 구조. `folders-contract-e2e.md` 후속 또는 별도 항목으로 서비스에서 명시적 `FolderDto` 매핑 추적 |
| 3 | convention_compliance | `ExportWorkflowDto.formatVersion` 이 `@ApiProperty()`(필수)로 선언됐지만 실구현은 방출 안 함 — spec 문서 자체는 이미 "Planned" 로 정직하게 명시 | `spec/2-navigation/1-workflow-list.md` §3.2 | 이미 `spec-draft-nullable-notation-followups.md` 가 추적 중, 새 조치 불필요 |
| 4 | plan_coherence | `§5.4 스윕 2차` tracker 후보 목록(10개) 중 `WorkflowVersionDto`·`WorkflowVersionListItemDto`·`NodeDto`·`EdgeDto` 4개가 선행 PR(#1411~#1413)로 이미 닫혔는데 목록이 갱신 안 됨 | `plan/in-progress/spec-draft-nullable-notation-followups.md` line 1368-1373 | 체크리스트 7 실행 시 `FolderDto` 제거뿐 아니라 이미 닫힌 4개도 함께 목록에서 제외 |
| 5 | naming_collision | `folders.e2e-spec.ts` 파일명이 형제 도메인(트리거·스케줄·워크플로)의 `<도메인>-<시나리오>` 명명 관례와 약간 다른 형태(도메인 단독형) | `codebase/backend/test/folders.e2e-spec.ts` (신설 예정) | 강제 아님. 나란히 두려면 `folder-crud.e2e-spec.ts` 대안 고려 가능 |
| 6 | naming_collision | "폴더" 라는 한글 단어가 지식 베이스 영역(`KB-DC-03`)에서도 비-formal 의미로 쓰임 — 현재 실제 식별자 충돌 아님 | `spec/4-nodes/4-integration/_product-overview.md:123` 등 | 조치 불필요. 지식 베이스 쪽에 "폴더" 가 formal 엔티티로 승격되면 그때 재검토 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | Folder 가 RBAC §3.2 매트릭스에 미등재(WARNING). 데이터 모델·요구사항 ID·복제 승계 등은 전부 정합 확인 |
| rationale_continuity | LOW | §5.4 방향 전환은 규약 준수(문제 없음). 신설 e2e 의 `code:` 미등재만 WARNING |
| convention_compliance | NONE | 검증 범위 내 정식 규약 직접 위반 없음. entity-passthrough·`formatVersion` 미방출은 기존 추적 중인 구현 드리프트(INFO) — 단 15개 파일 미검증(예산 초과) |
| plan_coherence | LOW | §5.4 전환 판단 자체는 target 과 일치. 인접 미해소 tracker 항목 비인지 + 스윕 후보 목록 stale 이 WARNING/INFO |
| naming_collision | NONE | 신규 식별자 3종 모두 기존 코드베이스·spec 전역과 충돌 없음. 파일명 관례 차이·한글 다의어는 INFO |

## 권장 조치사항

1. `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스에 Folder 행을 추가하거나 SoT 위임 각주를 명시한다 (WARNING #1, planner 턴).
2. `folders-contract-e2e.md` 실행 시 신설 `folders.e2e-spec.ts` 를 `1-workflow-list.md` frontmatter `code:` 에 "시행 코드 — §3.1 ..." 주석과 함께 등재한다 (WARNING #2).
3. `folders-contract-e2e.md` 본문에 `spec-draft-nullable-notation-followups.md` 의 인접 미해소 항목(응답 envelope 미기술 + `pending_plans` 완료 참조 오류)과의 스코프 관계를 명시하거나, 가능하면 `GET /api/folders` 응답 envelope 한 줄을 §3.1 에 함께 보강한다 (WARNING #3).
4. §5.4 스윕 2차 tracker 후보 목록에서 이미 닫힌 4개 DTO 를 함께 정리한다 (INFO #4, 사소).
5. 나머지 INFO(entity passthrough, `formatVersion` 미방출, 파일명 관례, 한글 다의어)는 기존 트래커가 이미 추적 중이거나 조치 불요 — 참고만.

**미검증 스코프 고지**: `convention_compliance`·`cross_spec` 모두 프롬프트 예산 초과로 `spec/2-navigation/` 21개 파일 중 다수(`4-integration.md`·`6-config.md`·`_product-overview.md`·`_layout.md` 등 15개)의 본문 전체 대조를 하지 못했다고 명시했다. 이 부분은 "위반 없음" 이 아니라 "미검증" 이며, 위 위험도 판정은 검증된 범위(주로 `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md` 및 Folder 모듈)에 한정된다.