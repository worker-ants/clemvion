# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(Cross-Spec / Rationale Continuity / Convention Compliance / Plan Coherence / Naming Collision) 전원 전문 확보(인라인 authoritative; `convention_compliance.md` 는 디스크에 파일이 없어 인라인 전문으로 신규 영속화 완료). Critical 발견 없음.

## 전체 위험도
**LOW** — Convention Compliance 가 지적한 WARNING 1건(트리거 이력 API 문서 밀도 갭) 외에는 전부 NONE/INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — Critical 자체가 없으므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `GET /api/triggers/:id/history` 가 다른 목록 endpoint 와 달리 페이지네이션 여부·응답 shape 미표기 (실제로는 `@ApiOkWrappedArrayResponse` 최근 10건 고정 배열, 비페이징) | `spec/2-navigation/2-trigger-list.md` §3 API 표, `GET /api/triggers/:id/history` 행 | `spec/conventions/swagger.md` §5-2 (`ApiOkWrappedArrayResponse` vs `ApiOkPaginatedResponse`), 동일 표 내 다른 목록 endpoint 의 문서화 관행 | 해당 행에 "최근 10건 고정 배열(비페이징) — [swagger §5-2] `ApiOkWrappedArrayResponse` 패턴" 한 줄 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `NodeDto`/`EdgeDto` 의 기존 §5.4 optional+nullable "금지 조합" 필드(`description`/`containerId`/`toolOwnerId`/`condition`)가 `CanvasSaveResultDto.nodes`/`.edges` 타입 정밀화로 `save`/`restore` 두 엔드포인트 스키마에 처음 가시화됨. 이미 `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(클래스 단위)에 얼려진 기존 drift라 새 실패 유발 근거는 없음 | `workflow-response.dto.ts` `CanvasSaveResultDto.nodes`/`.edges`; `swagger-dto-contract.spec.ts:405-407,365` | 조치 불필요. `--impl-done` 전 `swagger-dto-contract.spec.ts` + response-contract e2e 가 두 엔드포인트에서도 GREEN 인지 1회 확인 권장 |
| 2 | Cross-Spec | `ExportWorkflowDto.nodes`/`.edges`(index 참조 기반, 형태 다름)를 이번 범위에서 제외하고 별도 트래커 항목으로 미루는 판단은 `spec/2-navigation/1-workflow-list.md` §3.2 와 정합 | plan §방향-5 | 조치 불필요(확인만) |
| 3 | Rationale Continuity | `2-trigger-list.md` R-15 의 "capability token" 프레이밍이 `1-data-model.md` Rationale(웹훅 endpoint_path 전역 유일, 2026-09-18)의 최신 위협모델 정정과 뉘앙스 차이 — 실제 API 계약(§2.3.1)은 이미 정확해 동작 갭은 없음 | `spec/2-navigation/2-trigger-list.md` R-15, §2.5 | R-15에 "capability token 가정은 무단 실행 방지에 한정, 경로 가로채기 방지는 [1-data-model.md Rationale] 별도 담당" 한 줄 상호참조 추가 |
| 4 | Rationale Continuity | 컨텍스트 예산으로 `spec/2-navigation/` 하위 15개 파일(4-integration·9-user-profile 등) 본문 미검토 — 이번 라운드 판정 범위 밖 | `spec/2-navigation/{4-integration,5-knowledge-base,...,_layout}.md` 등 15개 | 이 파일들을 건드리는 impl-prep 이 있으면 개별 Read 로 재확인 |
| 5 | Convention Compliance | rotate-secret 응답 예시가 `{data:...}` 봉투 생략 — 문서 전반의 일관된 문체라 스타일 불일치 아님 | `spec/2-navigation/2-trigger-list.md` §3 rotate-secret 행 | 필요 시 `_layout.md` 등에 "응답 예시는 `{data}` 봉투 생략, payload 만 표기" 각주 |
| 6 | Naming Collision | 계획이 언급한 신규 e2e 케이스("I": 5노드 저장→복원)의 배치 파일이 미확정 — 기존 `workflow-crud.e2e-spec.ts` 로 추정되나 확정 필요 | `plan/in-progress/canvas-save-typed.md` (신규 e2e 케이스 항목) | 구현 시점에 기존 `*.e2e-spec.ts` 명명 컨벤션만 따르면 충분, 차단 아님 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `NodeDto`/`EdgeDto` 재사용은 기존 계층 경계 내 자연스러운 재사용, cross-spec 충돌 없음. 기존 drift 가 새 엔드포인트에 가시화되는 점만 INFO |
| Rationale Continuity | NONE | 전문 검토한 3개 문서는 자체 Rationale과 본문이 일관, 폐기 이력도 명시적. capability token 뉘앙스와 15개 파일 미검토는 INFO |
| Convention Compliance | LOW | 정식 규약(DTO 명명·secret 패턴·audit action·에러 코드 등) 정밀 준수. 트리거 이력 API 문서 밀도 갭 WARNING 1건 |
| Plan Coherence | NONE | `canvas-save-typed.md` 는 이미 "선행 조건 없는 스윕"으로 분류된 트래커 항목을 닫는 좁은 범위 작업. 동일 코드를 건드리는 다른 in-progress plan(감사 로깅·GraphViz 명명)과 층이 달라 비충돌 |
| Naming Collision | NONE | 브랜치 diff 는 plan 문서 추가뿐(spec/codebase 미변경). 계획이 예고하는 유일한 변경은 기존 `NodeDto`/`EdgeDto` 참조 재사용 — 신규 식별자 없음 |

## 권장 조치사항
1. (WARNING 해소) `spec/2-navigation/2-trigger-list.md` §3 `GET /api/triggers/:id/history` 행에 "최근 10건 고정 배열(비페이징) — swagger §5-2 `ApiOkWrappedArrayResponse` 패턴" 문구 추가.
2. `--impl-done` 전 `swagger-dto-contract.spec.ts` 및 response-contract 기반 e2e 가 `save`/`restore` 두 엔드포인트에서 기존과 동일하게 GREEN 인지 확인 (기존 drift 가시화 대비).
3. (선택) R-15에 `1-data-model.md` Rationale 로의 상호참조 한 줄 추가해 capability-token 뉘앙스 명확화.
4. (선택) rotate-secret 등 응답 예시의 `{data}` 봉투 생략 스타일을 문서 전역 각주로 명시할지 검토.
5. 신규 e2e 케이스("I") 배치 파일은 구현 시점에 기존 `*.e2e-spec.ts` 명명 컨벤션 확인 후 확정.