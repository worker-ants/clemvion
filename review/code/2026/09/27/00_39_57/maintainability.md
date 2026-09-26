# 유지보수성(Maintainability) 리뷰 — workflow-version-creator

## 발견사항

- **[INFO]** DTO 필드 선언 + 근거 주석이 두 클래스에 걸쳐 문자 그대로 중복된다 (`changeSummary`, `creator`)
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:36-40`(`WorkflowVersionListItemDto.changeSummary`), `:46-50`(`WorkflowVersionListItemDto.creator`), `:70-74`(`WorkflowVersionDto.changeSummary`), `:84-88`(`WorkflowVersionDto.creator`)
  - 상세: 이번 PR 이 두 클래스에 새로 붙인 2줄짜리 근거 주석("§5.4 기본형 — …", "항상 실린다 — …")이 두 자리에 한 글자도 다르지 않게 중복돼 있다. 서비스 쪽(`workflow-versions.service.ts`)은 정확히 같은 형태의 손-복제 문제(select 리터럴이 두 메서드에 중복돼 한쪽만 갱신되며 `CREATOR_PROJECTION` 누락이 났던 과거 Critical)를 이번 PR 에서 `VERSION_METADATA_SELECT` 상수로 뽑아 제거했지만, DTO 클래스 쪽은 (이 PR 이전부터 있던 이중 선언 구조에) 같은 형태의 새 주석을 그대로 복제해 얹었다 — 다음에 한쪽 데코레이터/주석만 고치고 다른 쪽을 놓치는 편집 표면이 여전히 남아 있다.
  - 완화 요인: 신설된 `workflow-version-response.dto.spec.ts` 가 `it.each` 로 두 DTO 의 `creator`/`changeSummary` **선언**(스키마 `required`·`properties`)을 동시에 고정하므로, 필드 타입/required 여부가 한쪽만 회귀하면 즉시 잡힌다. 다만 주석 텍스트 자체의 drift(예: 한쪽만 근거 문장을 갱신)는 테스트가 볼 수 없는 영역이다.
  - 제안: 당장 블로킹 사안 아님. 다음에 이 DTO 쌍을 만질 때 `OmitType(WorkflowVersionDto, ['snapshot'])` 같은 매핑 타입으로 `WorkflowVersionListItemDto` 를 `WorkflowVersionDto` 에서 파생시키면 필드·주석이 한 곳에만 존재하게 되어 구조적 중복이 사라진다.

- **[INFO]** 같은 파일에서 나란히 쓰이는 두 select 상수의 명명 접미사가 다르다 — `CREATOR_PROJECTION` vs `VERSION_METADATA_SELECT`
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:97`(`CREATOR_PROJECTION`), `:109`(`VERSION_METADATA_SELECT`)
  - 상세: 둘 다 TypeORM `select`/`relations` 투영을 고정하는 `Object.freeze(... as const)` 상수라는 점에서 같은 역할이다. `CREATOR_PROJECTION`은 관계(`creator`) 하위 투영, `VERSION_METADATA_SELECT`는 최상위 컬럼 선택이라는 층위 차이는 있어 완전한 오분류는 아니지만, 이번 PR 이 `VERSION_METADATA_SELECT` 를 새로 추가하면서 기존 명명(`_PROJECTION`)을 따르지 않아 처음 보는 사람이 둘의 관계(하나가 다른 하나의 형제 상수라는 사실)를 이름만으로 유추하기 조금 더 어렵다.
  - 제안: 급하지 않음. 이름을 맞출 필요까지는 없지만, 두 상수를 함께 설명하는 JSDoc에 "왜 접미가 다른가"를 한 줄 덧붙이면 다음 사람의 오독을 줄일 수 있다.

- **[INFO]** `WorkflowVersionDetailProjection` 의 JSDoc 블록이 PR 을 거듭하며 계속 길어지고 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetailProjection` 타입 선언 바로 위 JSDoc (전체 파일 기준 46-74행)
  - 상세: 이번 PR이 블록 끝에 2026-09-27 프런트엔드 미러 비변경 결정 문단을 추가해, 이미 2026-09-06·09-08 이력을 담고 있던 JSDoc이 더 길어졌다. "근거를 코드 옆에 남긴다"는 이 저장소의 관례에는 부합하지만, 누적되는 이력 서술이 타입 선언 자체의 가독성을 조금씩 갉아먹는 방향이다.
  - 제안: 블로킹 사유 아님. 다음에 한 번 더 늘어나는 시점에는 오래된 이력(예: 2026-09-06 명명 오판 배경) 일부를 `plan/complete/` 관련 문서로 옮기고 "현재 유효한 계약"만 남기는 정리를 고려할 만하다.

- **[INFO]** CHANGELOG 항목 제목이 여전히 `creator` 만 언급한다(본문은 `changeSummary` 도 함께 다룸)
  - 위치: `CHANGELOG.md:26` — `## Unreleased — OpenAPI 가 워크플로 버전 응답의 \`creator\` 를 항상 실리는 필드로 광고한다`
  - 상세: 본문(28-31행)은 `creator`·`changeSummary` 두 필드의 §5.4 정정을 모두 정확히 설명하는데 제목 범위는 그보다 좁다. 이전 리뷰 라운드(`review/code/2026/09/27/00_20_58/documentation.md` INFO)에서 이미 지적됐고 사소·비블로킹으로 처분됐다 — 이번 라운드에도 그대로 남아 있음을 확인했을 뿐, 새 결함은 아니다.
  - 제안: 급하지 않음. 다음에 이 항목을 만질 일이 있으면 제목을 "creator · changeSummary 를 광고한다" 로 넓히면 스캔성이 좋아진다.

가독성·함수 길이·중첩 깊이·매직 넘버·순환 복잡도 관점에서는 지적할 사항이 없다. `VERSION_METADATA_SELECT` 상수 추출(`workflow-versions.service.ts:109-116`)과 그 대칭성을 고정하는 신규 단위 테스트(`workflow-versions.service.spec.ts:169-190`)는 정확히 유지보수성을 개선하는 방향이다. e2e(`workflow-crud.e2e-spec.ts`)에 추가된 목록 계약 대조(566-580행)·`changeSummary` null 값 양성 단언(635-646행)은 기존 파일의 축약된 주석 스타일(«축 1/2/3», «양성 단언이 먼저인 이유» 등)을 일관되게 따르고 있어 스타일 이질감이 없다.

## 요약

이번 diff 는 두 개의 §5.4 금지 조합(`creator`, `changeSummary`)을 기본형으로 정정하고, `findByWorkflow`/`findOne` 이 손으로 중복 선언하던 6개 메타 컬럼 select 를 `VERSION_METADATA_SELECT` 상수로 추출한 좁고 목적이 분명한 변경이다. 신규 단위 테스트(DTO 선언 캐너리, select 대칭성 단언)와 e2e 계약 대조 확장이 회귀를 실질적으로 방지하며, 서비스 쪽 select 중복은 이번 PR 이 정확히 상수화로 제거했다. 유일하게 남는 구조적 관찰은 DTO 클래스 쪽 필드+주석 이중 선언(이 PR 이전부터 있던 구조)이 그대로 남았고 이번 PR이 그 자리에 동일한 긴 주석을 복제해 얹었다는 점인데, 새 대칭 테스트가 그 두 필드의 선언 drift는 잡아 준다. 나머지(상수 명명 접미사 불일치, JSDoc 길이 누적, CHANGELOG 제목 범위)는 모두 이전 리뷰 라운드에서 이미 식별·처분된 INFO 수준 관찰의 재확인이며 이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다.

## 위험도

LOW
