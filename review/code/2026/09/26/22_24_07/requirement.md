# 요구사항(Requirement) 리뷰 — canvas-save-typed (머지 후 재검토)

## 발견사항

- **[INFO]** 관련 spec 은 응답의 최상위 형태(`{ workflow, nodes, edges }`)만 규정하고 원소 타입(`NodeDto`/`EdgeDto`)은 규정하지 않는다 — spec fidelity 상 이 변경과 충돌 없음
  - 위치: `spec/data-flow/11-workflow.md` (`Wf-->>C: 200 { workflow, nodes, edges }` 시퀀스 라인), `spec/3-workflow-editor/5-version-history.md` §7.3 (`응답: { workflow, nodes, edges } (saveCanvas 와 동일).`)
  - 상세: 두 spec 문서를 직접 Read 로 열어 대조했다. 둘 다 최상위 키 집합만 적고 `nodes`/`edges` 원소의 필드 스키마는 규정하지 않는다. 같은 문서 §7.2 의 `VersionSnapshot` 인터페이스(버전 스냅샷 JSONB 의 스키마, 별개 자료구조)는 필드를 나열하지만 이는 `/save`·`/restore` 응답 자체가 아니라 `GET /workflows/:wfId/versions/:versionId` 의 `snapshot` 필드 스키마이므로 이번 DTO 변경과 대상이 다르다. 따라서 plan(`plan/in-progress/canvas-save-typed.md`)의 `spec_impact: none` 판단은 실측과 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 엔티티 ↔ DTO 1:1 매핑 주장을 소스 대조로 재확인 — 사실과 일치
  - 위치: `codebase/backend/src/modules/nodes/entities/node.entity.ts`, `codebase/backend/src/modules/edges/entities/edge.entity.ts` vs `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts`(`NodeDto`), `codebase/backend/src/modules/edges/dto/responses/edge-response.dto.ts`(`EdgeDto`)
  - 상세: `Node` 엔티티의 스칼라 컬럼(`id · workflowId · type · category · label · positionX · positionY · config · isDisabled · description · containerId · toolOwnerId · createdAt · updatedAt`)이 `NodeDto` 필드와 정확히 일치하고, 관계 필드(`workflow · container · toolOwner`)는 DTO 에 없다. `workflows.service.ts` 의 `syncNodes`(1066행)·`syncEdges`(1124행)를 직접 읽어, `manager.create`/기존 행 수정 어느 분기도 relation 객체를 세팅하지 않고(둘 다 `nullable` non-eager 관계) 컬럼만 채움을 확인했다 — 응답 wire 에 undeclared 필드가 실릴 위험이 없다는 plan·이전 리뷰의 주장이 맞다.
  - 제안: 조치 불요.

- **[INFO]** `restoreVersion` 이 `saveCanvas` 를 재사용한다는 주장 확인 — 사실과 일치
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` (`restoreVersion`, 705행 → 742행에서 `this.saveCanvas(...)` 호출)
  - 상세: 복원은 스냅샷을 `SaveCanvasDto` 로 변환해 `saveCanvas(..., skipLegacyDataGates=true)` 를 그대로 호출한다. 신규 e2e 케이스 I 의 전제("응답은 저장과 같은 `CanvasSaveResultDto` 다")가 코드와 일치한다.
  - 제안: 조치 불요.

- **[INFO]** 1R 리뷰에서 지적된 WARNING(e2e I 가 노드 개수를 고정하지 않음)의 조치가 현재 소스에 실제로 반영돼 있음을 직접 확인
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:609` (`expect(saved.body.data.nodes).toHaveLength(5);`)
  - 상세: RESOLUTION.md(`review/code/2026/09/26/22_05_52/RESOLUTION.md`)가 커밋 `2ca8a7767` 로 조치했다고 적은 내용을, 현재 워크트리의 실제 `workflow-crud.e2e-spec.ts` 를 Read 로 열어 대조했다 — 저장 응답(`saved`)에도 `nodes` 5개 단언이 존재해 "양쪽이 빈 배열이어도 통과" 하는 vacuous 경로가 막혀 있다. 문서 주장과 실제 코드가 일치한다.
  - 제안: 조치 불요.

- **[INFO]** plan 자체 체크리스트와 트래커 원 항목이 아직 미완(`[ ]`)인 채로 머지 시점을 맞았다 — 마무리 스텝 잔존
  - 위치: `plan/in-progress/canvas-save-typed.md` `## 체크리스트` (`/ai-review` · `--impl-done` · `트래커 항목 닫기` 세 줄), `plan/in-progress/spec-draft-nullable-notation-followups.md` (`CanvasSaveResultDto.nodes`/`.edges` 항목, `- [ ]`로 시작하는 줄)
  - 상세: 두 파일을 직접 Read 로 열어 확인했다 — 트래커 원 항목이 여전히 미체크고, plan 도 `--impl-done`/트래커 닫기를 `[ ]` 로 남겨 뒀다. 이미 이전 라운드(1R) 의 documentation 리뷰·SUMMARY INFO#4 가 "정상적인 중간 상태, `--impl-done` 이후 마무리 커밋에서 처리" 로 처분한 사안과 동일하다. 다만 이번 트리거가 "머지했어" 이므로, 이 마무리 스텝(impl-done 실행 → 체크리스트 완료 → `plan/complete/` 이동 → 트래커 `[x]`)이 이제 수행돼야 할 시점이라는 점을 다시 명시해 둔다 — 기능 결함은 아니고 워크플로 마무리 누락 여부만 남은 것이다.
  - 제안: 코드 조치 불요. `--impl-done` → plan 체크리스트 완료 → `plan/complete/` 이동 → `spec-draft-nullable-notation-followups.md` 해당 항목 `[x]` 전환을 이어서 수행할 것.

## 요약

이 변경은 `POST /workflows/:id/save` · `POST /workflows/:id/versions/:versionId/restore` 응답의 `nodes`/`edges` OpenAPI 선언을 무제약 `object` 배열에서 `NodeDto[]`/`EdgeDto[]` 참조로 정밀화하는 순수 계약 문서화 개선이며, 의도한 기능(선언 정확화 + 회귀 방지 계약 층 신설)을 완전히 구현했다. 소스를 직접 열어 (1) `Node`/`Edge` 엔티티 컬럼과 `NodeDto`/`EdgeDto` 필드가 관계 제외 1:1 로 일치하고, (2) `syncNodes`/`syncEdges` 가 relation 객체를 세팅하지 않아 undeclared 노출 위험이 없으며, (3) `restoreVersion` 이 실제로 `saveCanvas` 를 재사용하고, (4) 1R 에서 지적된 vacuous-테스트 WARNING(e2e I 의 노드 수 미고정)이 현재 코드에 실제로 조치돼 있음을 재확인했다. 관련 spec(`spec/data-flow/11-workflow.md`, `spec/3-workflow-editor/5-version-history.md` §7.3) 은 최상위 키만 규정해 이 변경과 충돌하지 않으며 `spec_impact: none` 판단이 실측과 맞다. 남은 사안은 기능 결함이 아니라 워크플로 마무리(plan `--impl-done`·`plan/complete/` 이동·트래커 체크박스)뿐이다. 저장소 파일은 뮤테이션하지 않았고(`git status --short` 로 확인, 리뷰 세션 디렉터리 외 변경 없음) 모두 읽기 전용으로 검증했다.

## 위험도
LOW
