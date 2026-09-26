# 문서화(Documentation) 리뷰 — canvas-save-typed

## 발견사항

- **[INFO] `ExportWorkflowDto.nodes`/`.edges` 는 이번 수정과 같은 문제(타입 없는 객체 배열)를 여전히 안고 있다**
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `ExportWorkflowDto` 클래스(`nodes: Record<string, unknown>[]` · `edges: Record<string, unknown>[]`, `@ApiProperty({ type: 'array', items: { type: 'object' } })`)
  - 상세: `CanvasSaveResultDto` 에서 방금 고친 것과 똑같은 패턴(`items: { type: 'object' }` → 응답 계약 검증자가 원소 안으로 내려가지 않음)이 같은 파일의 `ExportWorkflowDto` 에 그대로 남아 있다. 다만 이는 누락이 아니라 의도적 스코프 조정이다 — `plan/in-progress/canvas-save-typed.md` §방향-5 에서 "새 DTO 가 필요하다"며 별도 항목으로 미뤘고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 1313~1320행에 새 트래커 항목으로 등재됐으며, `review/consistency/2026/09/26/21_38_44/cross_spec.md` 도 이 스코프 분리가 `spec/2-navigation/1-workflow-list.md` §3.2(인덱스 기반 참조라 `NodeDto`/`EdgeDto` 재사용 불가)와 정합적이라고 확인했다. 문서화 관점에서 지적할 결함은 아니고, 트래커 항목이 실제로 존재하므로 추적 누락도 아니다 — 다음 리뷰어가 "왜 `ExportWorkflowDto` 는 안 고쳤나"를 재지적하지 않도록 기록해 둔다.
  - 제안: 조치 불요. 이미 트래커에 등재됨.

- **[INFO] `plan/in-progress/canvas-save-typed.md` 체크리스트가 `/ai-review`·`--impl-done`·트래커 항목 닫기 세 줄을 미완으로 남긴 채 커밋됐다**
  - 위치: `plan/in-progress/canvas-save-typed.md` — `## 체크리스트` 섹션 (67~74행)
  - 상세: 사용자가 "머지했어"라고 알린 시점에 plan 파일은 아직 `plan/in-progress/`에 있고 세 체크박스가 미완이다. 이는 본 워크플로(이 문서화 리뷰 자체가 `/ai-review` 단계)가 아직 끝나지 않았기 때문으로 보이며, 정상적인 중간 상태다. 다만 이 PR 이 실제로 머지된 뒤에는 `--impl-done` 실행과 `plan/complete/` 로의 이동, 트래커(`spec-draft-nullable-notation-followups.md`) 항목 닫기가 마무리 커밋으로 남아야 한다(memory: "plan 체크박스 = 실제 상태" — 체크와 `complete/` 이동은 한 동작).
  - 제안: 리뷰·수정 반영 후 `--impl-done` 실행 → 체크리스트 완료 → `plan/complete/` 이동 → 트래커 항목 닫기를 마무리 커밋에서 함께 처리할 것.

- **[INFO] 신설 회귀 가드(`workflow-response.dto.spec.ts`)의 JSDoc이 "왜 e2e만으로 부족한가"를 명시적으로 설명해 모범적이다**
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts:6-14`
  - 상세: 이 파일은 신규 추가된 순수 문서 자산 성격의 유닛 테스트로, 다른 리뷰 관점(코드 품질)에서 다룰 사안은 아니지만 문서화 관점에서 특기할 만하다 — 헤더 주석이 "e2e 계약 대조가 `type: 'object'` 원소 내부로 내려가지 않는다"는 비직관적인 검증자 한계를 설명해, 이 테스트가 왜 필요한지 다음 사람이 바로 이해할 수 있게 한다. 별도 조치 불필요.

## 항목별 점검

1. **독스트링/JSDoc** — `CanvasSaveResultDto` 필드 주석(`/** 저장 후 노드 배열 */` 등)이 타입 변경 후에도 여전히 정확하다. 새 인라인 주석(`workflow-response.dto.ts:76-77`)이 이전 설계의 문제("타입 없는 객체로 두면 검증자가 안으로 내려가지 않는다")를 사후적으로 설명해 재발 방지 문서 역할을 한다 — 적절.
2. **README** — 새 기능·설정 추가 없음(순수 OpenAPI 스키마 정밀화). README 업데이트 불필요.
3. **API 문서** — 이번 변경의 본질이 API 문서(OpenAPI) 정합화다. `CHANGELOG.md`(26~30행)가 "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다"라고 정확히 명시해 클라이언트 생성기 영향과 런타임 무영향을 구분했다. 적절.
4. **주석 정확성** — e2e 스펙의 새 주석(`workflow-crud.e2e-spec.ts` 272~273행 "새 노드 생성 가지" / 585~591행 "복원은 기존 행을 고친다")은 실제 `WorkflowsService.syncNodes`/`syncEdges`(`workflows.service.ts`)의 생성/갱신 분기 구조와 부합함을 확인했다(diff에는 없으나 기존 소스로 대조). 오래된 주석·불일치 없음.
5. **인라인 주석** — e2e 신규 케이스 I 의 주석("갱신 가지를 탔다는 증거 — 노드 id 가 저장 때와 같다")이 복잡한 분기 로직(생성 vs 갱신 가지)을 잘 설명한다. 적절.
6. **CHANGELOG** — `## Unreleased — OpenAPI 가 캔버스 저장 · 버전 복원 응답의 노드 · 엣지 형태를 광고한다` 항목이 CHANGELOG.md 상단 기준("API 응답 · OpenAPI 로 광고하는 계약의 변화")에 정확히 부합하고, 형식(접두·응답 불변 명시)도 관례를 따른다. 누락 없음.
7. **설정 문서** — 새 환경변수·설정 옵션 없음. 해당 없음.
8. **예제 코드** — 신규 `it.each` 유닛 테스트와 e2e 케이스 I 자체가 `NodeDto`/`EdgeDto` 참조 패턴의 실행 가능한 예시 역할을 겸한다. 별도 예제 불필요.

## 요약

이번 변경(`CanvasSaveResultDto.nodes`/`.edges` 를 `NodeDto[]`/`EdgeDto[]` 로 선언하는 순수 OpenAPI 정밀화)은 문서화 관점에서 결함이 없다. CHANGELOG 항목이 관례(무엇이 항목을 만드는가 §1)에 정확히 부합하고, 신규 유닛/e2e 테스트의 주석·JSDoc이 "왜 필요한가"를 상세히 설명하며, plan 문서(`canvas-save-typed.md`)가 실측·방향·뮤턴트 결과·`--impl-prep` 처분까지 자기완결적으로 기록돼 있다. 동일 문제가 남아 있는 `ExportWorkflowDto` 는 스코프 밖으로 명시적으로 미뤄졌고 후속 트래커 항목도 실재해 추적 누락이 아니다. plan 체크리스트의 `/ai-review`·`--impl-done`·트래커 닫기 세 항목이 아직 미완인 점만 마무리 커밋에서 챙기면 된다.

## 위험도

NONE
