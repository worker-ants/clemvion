# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 모드: `--impl-done`
Target: `spec/3-workflow-editor/3-execution.md`
Diff base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`
검토일: 2026-06-15

---

## 전체 위험도

**LOW** — 실질적 기능·계약 충돌 없음. WARNING 1건(컨트롤러 구조 비표준), INFO 다수(문서 동기화 누락·표현 명확화 권장·추적성 개선).

---

## Critical 위배 (BLOCK 사유)

없음.

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `@Controller()` 에 경로 prefix 없이 두 루트 resource path(`/workflows/:workflowId/test-datasets`, `/test-datasets/:id`) 혼재 — 비표준 multi-root 구조 | `workflow-test-datasets.controller.ts` L398 `@Controller()` | `spec/5-system/2-api-convention.md §2.1` (`{base_url}/api/{resource}` 단일 prefix 패턴), 동 §2.2 컨트롤러 예제 | 두 resource path 를 별도 컨트롤러(`WorkflowTestDatasetsByWorkflowController` / `WorkflowTestDatasetsController`)로 분리하거나, 현 구조를 `spec/3-workflow-editor/3-execution.md` Rationale 에 명시해 의도로 확정. API 동작 자체에 영향 없음. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `WorkflowTestDataset` 엔티티가 `spec/1-data-model.md §1` ERD 트리(Workflow 하위 자식 목록)에 미등재 — §2.13.3 상세 정의는 존재 | `spec/1-data-model.md §1` Workflow 하위 트리 | `└── WorkflowTestDataset (1:N, user-owned)` 행 추가 동기화 |
| I-2 | Cross-Spec | `spec/3-workflow-editor/3-execution.md §9` GET 목록 설명에 workspace 격리 전제("같은 workspace 내") 미명시 — 오독 여지 | `spec/3-workflow-editor/3-execution.md §9` GET 목록 설명 | "(같은 workspace 내)" 조건 인라인 명시 권장 |
| I-3 | Cross-Spec | `spec/3-workflow-editor/3-execution.md §2.2` 본문의 "워크스페이스 구성원에게 read-only 노출" 표현이 Viewer 접근 가능으로 오독될 소지 — 실제 구현은 Editor+ 가드 | `spec/3-workflow-editor/3-execution.md §2.2` | "워크스페이스 Editor+ 구성원" 으로 명확화 권장 |
| I-4 | Convention Compliance | create/update DTO 필드에 한국어 JSDoc 없이 `@ApiProperty` 직접 사용 — Swagger CLI 플러그인 `introspectComments: true` 환경에서 규약 §1-1 의 JSDoc 우선 패턴 미준수 | `create-workflow-test-dataset.dto.ts`, `update-workflow-test-dataset.dto.ts` 각 필드 | 각 필드 위에 한국어 JSDoc(`/** 데이터셋 이름 ... */`) 추가. `@ApiProperty` 유지하되 JSDoc 선행 추가. Swagger 문서 노출에는 현재도 문제없음 |
| I-5 | Convention Compliance | 응답 DTO 파일명(`workflow-test-dataset-response.dto.ts`)에 `-response` 있으나 클래스명은 `WorkflowTestDatasetDto`(suffix 불일치) — 프로젝트 관례(`WorkflowDto`, `AgentMemoryDto`)와는 동일 패턴 | `dto/responses/workflow-test-dataset-response.dto.ts` | 변경 불필요. 정보 기록 수준 |
| I-6 | Convention Compliance | `spec/3-workflow-editor/3-execution.md` frontmatter `status: partial` + `pending_plans: [plan/in-progress/spec-sync-execution-gaps.md]` — §2.2 구현 완료 후 plan 파일이 in-progress 에 유효하게 잔류하는지 확인 필요 | `spec/3-workflow-editor/3-execution.md` frontmatter | `spec-pending-plan-existence.test.ts` 빌드 가드가 자동 검증. plan 에 미구현 항목 잔류 시 현 상태 정확. plan 완료 시 `plan/complete/` 이동 및 frontmatter 갱신 |
| I-7 | Plan Coherence | 이전 consistency-check(12_18_43)에서 defer 결론 내린 W-1·W-2(에러코드 `FORBIDDEN`·`DUPLICATE_NAME` 전역 카탈로그 미등록)가 plan 후속 항목으로 미등록 — 추적성 손실 위험 | `plan/in-progress/spec-sync-execution-gaps.md` | `spec-sync-execution-gaps.md` 에 `[ ] 에러코드 카탈로그 등록 — FORBIDDEN·DUPLICATE_NAME (defer)` 항목 추가, 또는 `spec/conventions/error-codes.md §3` 에 INFO-level 각주 등록 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | ERD 트리 문서 동기화 누락(I-1), API 설명 workspace 격리 전제 미명시(I-2), RBAC 표현 오독 소지(I-3) — 기능 충돌 없음 |
| Rationale Continuity | NONE | 기각된 대안 미재도입, 합의 invariant 전부 준수, Rationale 연속성 이상 없음 |
| Convention Compliance | LOW | 컨트롤러 multi-root 비표준 구조(W-1), DTO JSDoc 누락(I-4) — 기능·계약 영향 없음 |
| Plan Coherence | LOW | 에러코드 defer 결정의 plan 후속 항목 미등록(I-7) — 추적성 이슈 |
| Naming Collision | NONE | 모든 신규 식별자(엔티티·DTO·API 경로·i18n 키·마이그레이션·모듈) 충돌 없음 |

---

## 권장 조치사항

1. **(BLOCK 해소 없음)** Critical 발견 없으므로 차단 해소 조치 불필요.
2. **(W-1 — 권장)** `workflow-test-datasets.controller.ts` 의 multi-root 구조를 두 컨트롤러로 분리하거나, `spec/3-workflow-editor/3-execution.md` Rationale 에 현 설계 의도를 명시한다.
3. **(I-1 — 문서 동기화)** `spec/1-data-model.md §1` Workflow 하위 ERD 트리에 `WorkflowTestDataset (1:N)` 행 추가.
4. **(I-2, I-3 — 표현 명확화)** `spec/3-workflow-editor/3-execution.md §9` 및 §2.2 의 workspace 격리 전제·RBAC 표현 보완.
5. **(I-4 — 선택적)** create/update DTO 각 필드에 한국어 JSDoc 추가.
6. **(I-7 — 추적성)** `plan/in-progress/spec-sync-execution-gaps.md` 에 에러코드 카탈로그 defer 항목 등록.