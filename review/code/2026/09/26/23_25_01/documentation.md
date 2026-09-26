# 문서화(Documentation) 리뷰 — export-workflow-typed

## 검토 대상

- `CHANGELOG.md` — Unreleased 항목 추가
- `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` — `ExportedNodeDto` · `ExportedEdgeDto` 신설, `ExportWorkflowDto.nodes/edges` 타입 강화
- `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts` — 캐너리 확장
- `codebase/backend/test/workflow-crud.e2e-spec.ts` — export 계약 대조 추가
- `plan/in-progress/export-workflow-typed.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (항목 추가)
- `review/consistency/2026/09/26/22_52_28/**` — `--impl-prep` 산출물 (자동 생성, 리뷰 대상 아님)

검증 방법: 위 diff/전체 파일 컨텍스트 열람 + `Read`/`Bash grep`으로 실제 소스(`workflows.service.ts` `exportWorkflow`, `spec/2-navigation/1-workflow-list.md` §3.2, `codebase/frontend/src/lib/api/workflows.ts`)를 대조. 저장소 파일은 뮤테이션하지 않았다(읽기 전용 확인만 수행) — 원복 필요 없음.

## 발견사항

- **[INFO]** `ExportedNodeDto`/`ExportedEdgeDto` 필드 문서가 실제 생산자 코드와 정확히 일치함 — 결함 아님, 긍정 확인
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:147-219` (`ExportedNodeDto`/`ExportedEdgeDto` 전체)
  - 상세: `WorkflowsService.exportWorkflow`(`codebase/backend/src/modules/workflows/workflows.service.ts:456-498`)의 노드 10키·엣지 6키 순서·이름이 새 DTO 선언과 1:1로 일치한다(`type/category/label/positionX/positionY/config/isDisabled/description/containerIndex/toolOwnerIndex`, `sourceNodeIndex/sourcePort/targetNodeIndex/targetPort/type/condition`). CHANGELOG 의 "노드 10필드"·"엣지 6필드" 수치도 실측과 맞는다. `string | null`→`type: object` emit 회피를 위한 `type: String` 명시와 그 근거를 적은 인라인 주석(`:177-179`)도 캐너리(`workflow-response.dto.spec.ts:43-48`)의 단언과 정확히 대응한다. 별도 조치 불요.
  - 제안: 없음(기록용).

- **[INFO]** DTO 재사용 배제 근거 주석이 이전 consistency-check 의 INFO 제안을 정확히 반영함
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:139-142` (`ExportedNodeDto` 선언 직전 `//` 블록)
  - 상세: `review/consistency/2026/09/26/22_52_28/rationale_continuity.md` INFO#1("`ExportedNodeDto`/`ExportedEdgeDto`가 index-기반 계약이라는 설계 의도를 코드 주석에 명시하라")이 요구한 내용이 그대로 구현에 반영됐다. `NodeDto`/`EdgeDto`를 재사용하지 않는 이유(UUID 미포함·index 정규화)와 import 요청 DTO(`ImportNodeDto`/`ImportEdgeDto`)를 쓰지 않는 이유(옵셔널·non-nullable 지위 불일치)를 함께 설명해 향후 "일관성" 명목의 되돌리기 실수를 방지한다.
  - 제안: 없음(기록용).

- **[INFO]** CHANGELOG 항목이 기준(`CHANGELOG.md` 상단 성문화)에 정확히 부합하고 스코프 경계(`formatVersion` 기존 갭)를 명시적으로 재확인함
  - 위치: `CHANGELOG.md` (새 `## Unreleased — OpenAPI 가 워크플로우 export 응답의 노드 · 엣지 형태를 광고한다` 항목)
  - 상세: 이 변경은 기준 1번("OpenAPI 로 광고하는 계약의 변화")에 해당해 항목이 필요하며 실제로 추가됐다. "서버는 원래 이 형태를 돌려주고 있었다 — 응답 자체는 그대로다"라는 문구로 wire 비변경을 명확히 하고, `formatVersion` 미해결 갭을 괄호로 재확인해 "문서가 구현보다 넓게 보장한다"는 흔한 실패 유형을 피했다. `spec/2-navigation/1-workflow-list.md` §3.2 의 기존 ⚠️ 서술과도 정확히 일치한다.
  - 제안: 없음(기록용).

- **[INFO]** e2e 신규 단언의 인라인 주석이 실제 테스트 데이터(5노드 그래프)와 일치
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts:315-321` (C 케이스, `assertMatchesContract(dupExport...)` 앞 주석)
  - 상세: "F 의 export 는 노드 1 · 엣지 0 이라 원소 대조가 약하다"는 근거 문구를 F 케이스(`:438-473`)와 대조하면 정확하다 — F 는 `POST /workflows` 가 자동 생성하는 Manual Trigger 1노드·0엣지만 갖는다. C 의 5노드·2엣지 그래프(`buildFiveNodeGraphPayload`)는 `containerIndex`/`toolOwnerIndex` 가 채워진 노드와 `null` 인 노드를 모두 포함해 주석의 주장대로 원소 형태 검증이 더 강하다.
  - 제안: 없음(기록용).

- **[INFO]** plan tracker(`spec-draft-nullable-notation-followups.md`) 신규 항목의 frontmatter `spec_impact` 동기화가 이미 충족되어 있음
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:3649-3655` (§9.4 관련 보강 문단)
  - 상세: 이 보강이 겨냥하는 두 파일(`spec/2-navigation/4-integration.md`, `spec/5-system/2-api-convention.md`)은 frontmatter `spec_impact` 리스트에 이미 등재돼 있어(각각 line 68, 11) 과거 반복됐던 "항목 추가 시 frontmatter 동기화 누락" 실패 모드(같은 문서의 frontmatter 주석이 스스로 자백하는 이력)가 재발하지 않았다. 새로 추가된 다른 항목("프런트엔드 export 타입이 `null` 을 적지 않는다")의 대상은 spec 파일이 아니라 `codebase/frontend/src/lib/api/workflows.ts`이므로 frontmatter 추가 대상이 아니고, 실제로도 추가되지 않았다 — 올바른 판단.
  - 제안: 없음(기록용).

발견된 CRITICAL/WARNING 없음. 위 항목들은 모두 "결함 없음을 확인"하는 긍정적 기록(INFO)이며, 조치를 요구하지 않는다.

## 요약

이 변경은 `GET /workflows/:id/export` 응답의 `nodes`/`edges`를 타입 없는 객체 배열에서 `ExportedNodeDto`/`ExportedEdgeDto`로 광고하는 순수 문서화(OpenAPI 계약) 강화 PR이며, 문서화 관점에서는 모범적으로 처리됐다. CHANGELOG 항목은 성문화된 기준에 정확히 부합하고 알려진 갭(`formatVersion`)을 재확인했으며, DTO 필드 JSDoc·인라인 주석은 실제 생산자 코드(`WorkflowsService.exportWorkflow`)와 필드 순서·개수까지 정확히 일치한다. `NodeDto`/`EdgeDto`·import 요청 DTO를 재사용하지 않는 설계 근거를 코드 주석으로 남겨 직전 consistency-check 의 INFO 제안을 그대로 이행했고, e2e 신규 단언의 주석도 실제 테스트 픽스처와 부합한다. plan 문서(`export-workflow-typed.md`)는 실측·뮤턴트 표·체크리스트를 갖춰 변경 이력을 충실히 남겼고, 후속 트래커(`spec-draft-nullable-notation-followups.md`) 항목 추가도 frontmatter 동기화 규율을 지켰다. README·API 문서(Swagger)·설정 문서·예제 코드 관점에서 별도 갱신이 필요한 신규 기능·환경변수는 없다. Critical/Warning 없음.

## 위험도

NONE
