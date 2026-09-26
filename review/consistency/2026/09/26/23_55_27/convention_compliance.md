# 정식 규약 준수 검토 — `spec/3-workflow-editor/` (--impl-prep, workflow-version-creator)

검토 대상: `spec/3-workflow-editor/5-version-history.md` (구현 대상 plan `plan/in-progress/workflow-version-creator.md` 이
`WorkflowVersionListItemDto`/`WorkflowVersionDto` 의 `creator`·`changeSummary` 선언과 공유 `select` 상수화를
다루므로, 이 spec 이 그 변경의 SoT). 대조 규약: `spec/conventions/swagger.md`, `spec/5-system/2-api-convention.md §5.4`,
`CLAUDE.md`/`project-planner` SKILL 의 문서 구조 규약.

plan 자체가 이미 "spec `§7.1` 표는 두 엔드포인트 모두 `changeSummary`·`creator` 를 «포함» 으로 적어 required 선언과
맞는다 → `spec_impact: none`" 이라고 실측해 두었고, 이 검토에서도 그 판단은 재확인된다(§7.1 표, target 88-102행).
아래는 그와 별개로 드러난, 이 plan 의 스코프 밖이지만 같은 문서에 이미 존재하는 규약 이격이다.

## 발견사항

- **[WARNING] §7.2 가 응답 타입을 엔티티와 동명인 `WorkflowVersion` 으로 적는다 — 실제 응답 DTO 는 `WorkflowVersionDto`**
  - target 위치: `spec/3-workflow-editor/5-version-history.md` §7.2 "버전 상세" (target 104-108행: "응답: `WorkflowVersion` 단건 + `snapshot` 포함.")
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "엔티티(`entities/*.entity.ts`)를 그대로 노출하지 말고, API 응답 형태에 맞춰 별도 DTO 를 만듭니다"
  - 상세: 실제 코드에서 `codebase/backend/src/modules/workflow-versions/entities/workflow-version.entity.ts` 는 TypeORM 엔티티 클래스명이 정확히 `WorkflowVersion` 이고, 응답에 실제로 쓰이는 클래스는 `dto/responses/workflow-version-response.dto.ts` 의 `WorkflowVersionDto` 다(컨트롤러가 `@ApiOkWrappedResponse(WorkflowVersionDto, ...)` 로 광고). spec 문장이 DTO 접미 없이 엔티티와 완전히 같은 이름을 쓰면서, 바로 위 §7.1 이 형제 엔드포인트를 `WorkflowVersionListItemDto[]` 로 정확히 `Dto` 접미까지 적은 것과 내부적으로도 비대칭이다. 다음 사람이 이 문장만 보고 "엔티티를 그대로 반환한다"고 오독할 여지가 있다 — 이 규약이 정확히 막으려는 오독이다.
  - 제안: "응답: `WorkflowVersionDto` 단건 + `snapshot` 포함." 으로 정정. 이 PR 의 diff 범위(§7.1/§7.2 표의 "포함" 여부)는 건드리지 않으므로 별도 소정정 라인으로 처리 가능.

- **[WARNING] `## Rationale` 섹션 부재 — 같은 디렉터리의 다른 5개 파일과 구조가 다르다**
  - target 위치: `spec/3-workflow-editor/5-version-history.md` 전체 (문서 끝까지 `## Rationale` 헤더 없음)
  - 위반 규약: `CLAUDE.md` "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" · `.claude/skills/project-planner/SKILL.md` "## 명명 컨벤션"/"## Spec 문서 구조 (3섹션 권장)" — `## Rationale`: "결정 배경·근거·폐기된 대안"
  - 상세: `spec/3-workflow-editor/` 의 나머지 5개 파일(`0-canvas.md`·`1-node-common.md`·`2-edge.md`·`3-execution.md`·`4-ai-assistant.md`) 은 전부 `## Rationale` 섹션을 갖고 있는데 `5-version-history.md` 만 없다. 그 결과 결정 근거가 본문 괄호 안에 흩어져 있다 — 예: §7.1 "`snapshot` 필드는 응답에서 의도적으로 제외된다(목록 over-fetch 방지, m-3)"(target 95-96행), §6 "**페이지 리로드**(편집기 in-memory 상태와 서버 상태가 완전히 교체되므로)"(target 85행). 둘 다 전형적인 Rationale 내용(왜 이렇게 설계했는가)인데 본문에 인라인으로 묻혀 있어, 이 디렉터리의 다른 문서를 먼저 읽은 사람의 기대(끝에 Rationale 절)와 어긋난다.
  - 제안: 이번 plan 의 diff 범위는 아니므로 블로킹 사유는 아니다(권장 규약이자 pre-existing 상태). 다음에 이 문서를 건드릴 때 위 두 인라인 근거를 `## Rationale` 로 승격하는 것을 권한다.

- **[INFO] §7.1~§7.3 이 `TransformInterceptor` 의 `{ data: ... }` 래핑을 응답 표기에 명시하지 않는다**
  - target 위치: `spec/3-workflow-editor/5-version-history.md` §7.1(95행) · §7.2(108행) · §7.3(144행)
  - 위반 규약: `spec/conventions/swagger.md` §2-5 (성공 응답은 `TransformInterceptor` 가 `{ data: ... }` 로 감싼다)
  - 상세: 세 응답 모두 "응답: `WorkflowVersionListItemDto[]`" / "응답: `WorkflowVersion` 단건 ..." / "응답: `{ workflow, nodes, edges }`" 로 페이로드 형태만 적고 바깥 봉투를 생략한다. 같은 저장소의 다른 API 스펙(`spec/5-system/16-system-status-api.md` "응답: `{ data: SystemStatusOverviewDto }` (전역 `TransformInterceptor` 의 `{data}` 래핑 준수)", `spec/5-system/1-auth.md` WebAuthn credential 목록 항목)은 봉투까지 명시적으로 적는 관례를 보인다. 실제 컨트롤러는 `ApiOkWrappedArrayResponse`/`ApiOkWrappedResponse` 를 올바르게 쓰고 있어 기능적 위반은 아니며, 문서 완전성 차원의 사소한 불일치다.
  - 제안: 급하지 않음. 다음 편집 시 "`{ data: WorkflowVersionListItemDto[] }`" 식으로 봉투를 명시하면 §16/§1-auth 스타일과 맞는다.

## 요약

이번 merge(`workflow-version-creator` plan)의 실제 diff — `WorkflowVersionListItemDto`/`WorkflowVersionDto` 의
`creator`·`changeSummary` 선언 정정과 `select` 상수화 — 는 대상 spec(`5-version-history.md` §7.1 표)이 이미 두 필드를
"포함"으로 기술하고 있어 `spec_impact: none` 판단이 타당하고, 이 검토에서도 §5.4(부재 표현 규약) 관점의 새로운 충돌은
찾지 못했다. 다만 같은 문서에 이미 존재하던 두 건의 구조적 이격 — §7.2 의 엔티티-동명 응답 표기(`WorkflowVersion` vs
실제 `WorkflowVersionDto`)와 `## Rationale` 섹션 부재 — 은 이번 plan 의 스코프는 아니지만 문서 신뢰도를 낮추는
방향이라 기록해 둔다. 응답 봉투(`{ data: ... }`) 미기재는 사소한 표기 완전성 문제로 INFO 수준이다.

## 위험도

LOW
