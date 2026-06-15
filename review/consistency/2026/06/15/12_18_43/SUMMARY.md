# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

검토 모드: `--impl-done`
대상 spec: `spec/3-workflow-editor/3-execution.md §2.2` (WorkflowTestDataset)
diff-base: `f34ae00dcd87dc25b5e5b0b5c96d033015612702`
검토 일시: 2026-06-15

---

## 전체 위험도
**LOW** — Critical/HIGH 위배 없음. WARNING 2건(에러코드 의미 중복·도메인 코드 미등록), INFO 다수(Swagger 문서 품질·plan 후속 체크)

---

## Critical 위배 (BLOCK 사유)

_없음_

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `ForbiddenException({ code: 'FORBIDDEN' })` 인라인 명시가 `GlobalExceptionFilter` 기본값(`403→FORBIDDEN`)과 중복 — 의미 부가 없고 필터 처리 방식에 따라 동작 차이 가능 | `workflow-test-datasets.service.ts` L908–L912 (`findAccessible` 내) | `spec/5-system/2-api-convention.md §5.3`, `spec/conventions/error-codes.md §1` | 단순 문자열 throw(`throw new ForbiddenException('Only the owner can modify this dataset')`)로 교체하거나, 의미 있는 도메인 코드(`DATASET_OWNER_REQUIRED`)로 변경. 프론트 코드가 `FORBIDDEN` 분기하는지 먼저 확인. |
| W-2 | Naming Collision | 409 에러코드 `DUPLICATE_NAME` 이 전역 카탈로그 미등록 도메인 코드 — `HttpExceptionFilter.getCodeFromStatus(409)` 기본값 `RESOURCE_CONFLICT` 와 상이하여 클라이언트 혼동 가능 | `workflow-test-datasets.service.ts` `ConflictException({ code: 'DUPLICATE_NAME' })` | `http-exception.filter.ts:99`, `error-response.dto.ts:10`, `spec/5-system/2-api-convention.md §5.3` | (a) `RESOURCE_CONFLICT` 로 통일하거나, (b) `DUPLICATE_NAME` 을 전역 에러코드 카탈로그와 `main.ts` Swagger 설명에 공식 등록하고 `spec §2.2` API 표에 409 코드를 명시 기재. |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/1-data-model.md §1` ER 다이어그램에 `WorkflowTestDataset` 항목 미포함 (§2.13.3 정의는 정확히 존재) | `spec/1-data-model.md §1` ASCII ER 트리 | 다음 spec 갱신 시 Workflow 하위에 `└── WorkflowTestDataset (1:N, via owner_id+workflow_id)` 추가 |
| I-2 | Rationale Continuity | clone 이름 충돌 시 클라이언트 재시도 위임 결정이 R-2.2 Rationale에 미기록 | `workflow-test-datasets.service.ts` `copyName()` 주석, `.mdx` 문서 | `spec/3-workflow-editor/3-execution.md § Rationale R-2.2`에 클론 이름 처리 정책(서버 단일 시도 후 409, 번호 증가 재시도는 클라이언트 책임) 추가 |
| I-3 | Rationale Continuity | 목록 200행 soft limit·페이지네이션 미도입 결정이 spec Rationale에 미기록 | `workflow-test-datasets.service.ts` `list()` 주석 | `spec/3-workflow-editor/3-execution.md § Rationale R-2.2` 또는 §9 비고에 "목록 최대 200행 soft limit, 페이지네이션 미도입 — DoS 방지 + 워크플로우당 수십 건 이하 예상" 명시 |
| I-4 | Convention Compliance | create/update DTO 필드에 JSDoc 한국어 블록 주석 부재 (CLI 플러그인이 `/** */` → Swagger description 자동 변환) | `dto/create-workflow-test-dataset.dto.ts`, `dto/update-workflow-test-dataset.dto.ts` | 각 필드에 `/** 데이터셋 식별 이름 (워크플로우 내 소유자별 unique, 최대 255자) */` 형식 JSDoc 추가. `@ApiProperty` 는 example/enum 보강 용도로 유지. |
| I-5 | Convention Compliance | `list`, `create`, `clone` 엔드포인트에 `@ApiForbiddenResponse` 누락 (`@Roles('editor')` 적용 엔드포인트에 필수) | `workflow-test-datasets.controller.ts` list/create/clone 메서드 | 해당 3개 엔드포인트에 `@ApiForbiddenResponse({ description: 'Editor 이상 역할 필요' })` 추가 (`update`, `remove` 는 이미 적용됨) |
| I-6 | Convention Compliance | 응답 DTO 서버 파생 필드(`id`, `ownerId`, `createdAt`, `updatedAt`, `isOwner`)에 `readOnly: true` 미선언 | `dto/responses/workflow-test-dataset-response.dto.ts` | `@ApiProperty` 에 `readOnly: true` 추가. 다른 모듈의 기존 응답 DTO 적용 현황과 일관성 우선 확인. |
| I-7 | Convention Compliance | 응답 DTO 클래스명 `WorkflowTestDatasetDto` vs 파일명 `workflow-test-dataset-response.dto.ts` — 소폭 불일치 (기능 위반 아님) | `dto/responses/workflow-test-dataset-response.dto.ts` | 코드베이스 다수 모듈이 `Dto` suffix 를 응답 DTO 에 사용하므로 현행 유지가 자연스러움. 타 모듈이 `ResponseDto` 패턴이면 `WorkflowTestDatasetResponseDto` 로 rename 검토. |
| I-8 | Plan Coherence | `plan/in-progress/spec-sync-execution-gaps.md` §2.2 하위 체크리스트(`/consistency-check --impl-done`) 가 `[ ]` 미완료 상태 | `plan/in-progress/spec-sync-execution-gaps.md` | 본 검토 완료 후 해당 체크박스를 `[x]` 로 갱신. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | ER 다이어그램 도해 미갱신(INFO). API 계약·권한 모델·상태전이·계층책임 전 영역 일치. |
| Rationale Continuity | LOW | clone 이름 충돌 처리·목록 200행 limit 등 구현 단독 결정 2건이 spec Rationale에 미기록(INFO). 합의 위반·기각 대안 재도입 없음. |
| Convention Compliance | LOW | WARNING 1건(ForbiddenException 중복 코드), INFO 6건(Swagger 문서 품질). 마이그레이션 명명·API URL·응답 래퍼·DTO 위치·spec frontmatter 규약 준수. |
| Plan Coherence | NONE | 구현-plan 정합 양호. 미해결 결정 우회·선행 미해소·타 plan 무효화 없음. 후속 체크리스트 갱신 필요(INFO). |
| Naming Collision | LOW | `DUPLICATE_NAME` 에러코드 전역 미등록(WARNING). 열거형·엔티티·모듈·DTO·마이그레이션·엔드포인트 경로 모두 충돌 없음. |

---

## 권장 조치사항

1. **(W-1 해소)** `findAccessible` 의 `ForbiddenException({ code: 'FORBIDDEN' })` 을 단순 문자열 throw 또는 의미 있는 도메인 코드(`DATASET_OWNER_REQUIRED`)로 교체. 프론트 코드가 `FORBIDDEN` 분기하는지 먼저 확인.
2. **(W-2 해소)** `DUPLICATE_NAME` 에러코드를 (a) `RESOURCE_CONFLICT` 로 통일하거나, (b) 전역 카탈로그·`main.ts` Swagger 설명·`spec §2.2` API 표에 공식 등록. 프론트 코드와 계약 먼저 확인.
3. **(I-8 후속)** `plan/in-progress/spec-sync-execution-gaps.md` 의 `/consistency-check --impl-done` 체크박스를 `[x]` 로 갱신.
4. **(I-5 Swagger 품질)** `list`, `create`, `clone` 엔드포인트에 `@ApiForbiddenResponse` 추가.
5. **(I-4 Swagger 품질)** create/update DTO 필드에 한국어 JSDoc 블록 주석 추가.
6. **(I-2/I-3 문서화)** `spec/3-workflow-editor/3-execution.md § Rationale R-2.2` 에 clone 이름 충돌 처리 정책과 목록 200행 soft limit 결정 근거 추가 (다음 spec 갱신 시 포함 권장).
7. **(I-1 문서화)** `spec/1-data-model.md §1` ER 다이어그램에 `WorkflowTestDataset` 항목 추가 (다음 spec 갱신 시 포함 권장).