# Cross-Spec 일관성 검토 — `spec-draft-review-citations-class-jsdoc`

대상: `plan/in-progress/spec-draft-review-citations-class-jsdoc.md` (적용 대상 `spec/conventions/review-citations.md` §3 · `## Rationale`)

## 검토 방법

번들 예산 초과로 대부분의 `spec/**` 본문이 절단되어 있었으나, 이 draft 는 성격상 두 sibling
convention (`review-citations.md`, `swagger.md`)과 그 시행 코드(가드 2개)·대상 DTO 2개·빌드
산출물 1개·연관 tracker 1개로 영향 범위가 좁아, 그 파일들을 절대경로로 직접 Read 해
1차 소스로 검증했다.

- `spec/conventions/review-citations.md` (전문)
- `spec/conventions/swagger.md` §3 (JSDoc/`//` 분리 규칙 전문)
- `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts` · `dto-jsdoc-citation.spec.ts`
- `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` (`TriggerWorkflowRefDto`)
- `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` (`ScheduleTriggerWorkflowRefDto`)
- 빌드 산출물 `dist/modules/triggers/dto/responses/trigger-response.dto.js` (다른 워크트리 `workflow-version-creator`)
- `@nestjs/swagger` `ApiSchemaOptions` 타입 선언, `nest-cli.json`
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 1277~1301행 (선행 트래커 항목)
- `spec/conventions/spec-impl-evidence.md` 의 `review-citations.md` 참조 대목

## 실측 재검증 결과

draft 의 "실측" 절이 주장하는 사실을 모두 1차 소스로 재확인했다 — 반증되지 않음:

- `trigger-response.dto.js` 의 `_OPENAPI_METADATA_FACTORY()` 는 `id`·`name` 등 **프로퍼티별**
  `description` 만 반환하고, `TriggerWorkflowRefDto` 클래스 JSDoc 문구(«트리거에 연결된
  워크플로우의 참조…»)는 어디에도 없다 — draft 의 주장과 일치.
- `@nestjs/swagger` 의 `ApiSchemaOptions` 에 실제로 `description` 필드가 있다 (`ApiSchema` 데코레이터) — draft 가 클래스 수준 설명의 대안 경로로 제시한 것이 실재한다.
- `dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts` 는 이미 **클래스·프로퍼티 JSDoc 양쪽**을 AST 로 세고 있고, `EXPECTED_DTO_JSDOC_CITATIONS` 가 정확히 draft 가 언급한 두 자리(`ScheduleTriggerWorkflowRefDto`, `TriggerWorkflowRefDto`)를 동결하고 있다 — draft 의 "가드는 이미 함께 센다" 주장과 일치.
- 선행 트래커 `spec-draft-nullable-notation-followups.md` 1277~1301행의 서술(§3 표가 필드/클래스를 안 가른다는 선행 질문, planner 위임)도 draft 의 배경 서술과 정확히 일치.

## 발견사항

이번 draft 는 `spec/conventions/review-citations.md` §3 표 한 항목을 둘로 가르고 `## Rationale`
에 절 하나를 추가하는 것으로 범위가 좁다. 데이터 모델·API 계약(엔드포인트/요청·응답 shape)·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 축도 건드리지 않는다 — 두 DTO 클래스(`TriggerWorkflowRefDto`,
`ScheduleTriggerWorkflowRefDto`) 자체의 필드·타입·엔드포인트는 draft 의 변경 대상이 아니고, 실제
코드 변경(인용을 `//` 로 옮기는 작업)은 별도 developer plan(`dto-class-jsdoc-citation.md`)으로
위임되어 있어 이 draft 자체는 순수 문서 정정이다.

교차 조회한 결과 CRITICAL/WARNING 급 충돌은 발견되지 않았다.

- **[INFO]** 가드 spec 파일의 §3 인용 문구가 draft 반영 후 stale 해지는데, 이미 위임 처리됨
  - target 위치: draft "## 구현 위임" 절
  - 충돌 대상: `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts` 17행 부근 — `review-citations.md §3` 의 옛 문구("DTO·컨트롤러의 JSDoc 은 (인용) 대상이 아니다…")를 docstring 안에 그대로 인용하고 있다.
  - 상세: draft 가 §3 표 행을 분리하면 이 docstring 의 인용문이 더 이상 `review-citations.md` 의 실제 문구와 축자적으로 일치하지 않게 된다. 다만 draft 의 "구현 위임" 절이 "가드 spec 머리 주석의 «DTO 의 JSDoc 은 공개 OpenAPI `description` 이 된다»도 필드/클래스를 갈라 바로잡는다"고 명시적으로 위임해 두었으므로 별도 조치 불요 — 정보용으로만 남긴다.
  - 제안: 없음 (이미 커버됨). 구현 시 해당 docstring 전체(17행·36행 인접 문단)를 함께 갱신하는지만 review 단계에서 확인.

- **[INFO]** `spec-impl-evidence.md` 의 "§3 응답 DTO 축" 서술과의 용어 정합
  - target 위치: draft 변경안 §3 표 (행 분리)
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 설명 — "§3 의 **응답 DTO** 축은 `dto-jsdoc-citation-guard.ts` 가 강제하고, 같은 절의 **컨트롤러** 축은 미강제"
  - 상세: draft 가 §3 을 "DTO 필드·컨트롤러" 행과 "응답 DTO 클래스" 행으로 가르지만, `spec-impl-evidence.md` 는 여전히 "응답 DTO 축"(필드+클래스 통합)/"컨트롤러 축" 이분법으로 서술한다. 실제 가드 범위(클래스+프로퍼티 통합, 컨트롤러 미포함)와는 여전히 일치하므로 사실 관계 충돌은 없다 — 표현 granularity 차이일 뿐이라 동기화가 필수는 아니다.
  - 제안: 굳이 갱신할 필요는 없으나, 다음에 `spec-impl-evidence.md` 를 건드릴 일이 있으면 "응답 DTO(필드·클래스) 축"으로 조금 더 명시해도 좋다 — 비차단.

## 요약

`spec-draft-review-citations-class-jsdoc.md` 는 `review-citations.md §3` 표의 DTO 행 하나를
필드/클래스로 가르는 좁은 범위의 문서 정정이며, 빌드 산출물·가드 코드·선행 트래커를 모두 1차
소스로 재확인한 결과 draft 의 실측 주장은 전부 사실과 일치했다. 데이터 모델, API 계약, 요구사항
ID, 상태 전이, RBAC, 계층 책임 등 다른 spec 영역과 충돌할 표면 자체가 없고(엔드포인트·DTO 필드·
스키마를 바꾸지 않음), 유일하게 걸리는 것은 다른 코드 주석의 문구 동기화 문제인데 이미 draft 의
"구현 위임" 절이 명시적으로 커버하고 있다. Cross-spec 관점에서 이 draft 를 `spec/` 에 반영하는
데 걸리는 것이 없다.

## 위험도

NONE
