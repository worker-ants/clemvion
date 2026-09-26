# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** DTO 필드 선언 + 해설 주석이 두 클래스에 걸쳐 문자 그대로 중복된다 (`changeSummary`, `creator`)
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:36-40`(`WorkflowVersionListItemDto.changeSummary`), `:70-74`(`WorkflowVersionDto.changeSummary`), `:46-50`(`WorkflowVersionListItemDto.creator`), `:84-88`(`WorkflowVersionDto.creator`)
  - 상세: 이번 PR 이 두 클래스에 각각 새로 붙인 2줄짜리 근거 주석("§5.4 기본형 — …", "항상 실린다 — …")이 두 곳에 완전히 동일한 문장으로 중복돼 있다. 이 저장소는 정확히 같은 형태의 손-복제 문제(`select` 리터럴이 두 메서드에 중복돼 한쪽만 수정되며 생긴 `CREATOR_PROJECTION` 누락, `review/code/2026/09/06/10_13_22` Critical 1)를 이미 한 번 겪었고, 이번 PR 은 그 교훈으로 `VERSION_METADATA_SELECT` 상수를 뽑아 서비스 쪽 중복은 정확히 제거했다. 반면 DTO 클래스 쪽은 원래부터(이 PR 이전부터) 필드를 두 번 손으로 선언하는 구조였고, 이번 PR 은 그 기존 이중 선언에 동일한 긴 주석을 그대로 복제해 얹었다 — 다음에 한쪽 데코레이터만 고치고 다른 쪽 주석/데코레이터를 놓치는 회귀가 재발할 표면이 넓어졌다.
  - 완화 요인: 새로 추가된 `workflow-version-response.dto.spec.ts` 가 `it.each`로 두 DTO 클래스의 `creator`/`changeSummary` 선언을 동일한 방식으로 동시에 고정하므로, 이 두 필드에 한해서는 편집 누락이 나면 테스트가 잡는다. 그래서 즉시 위험하지는 않지만, 주석 텍스트 자체의 drift(예: 한쪽만 근거 문장을 갱신)는 테스트가 못 잡는다.
  - 제안: 당장 블로킹할 사안은 아니나, 다음에 이 DTO 쌍을 건드릴 기회에 `@nestjs/swagger`의 `OmitType(WorkflowVersionDto, ['snapshot'])` 같은 매핑 타입으로 `WorkflowVersionListItemDto`를 `WorkflowVersionDto`에서 파생시키는 리팩터를 고려할 만하다 — 데코레이터·주석이 한 곳에만 존재하게 되어 이 클래스의 구조적 중복 자체가 사라진다.

- **[INFO]** 관련 두 상수의 접미사가 다르다 — `CREATOR_PROJECTION` vs `VERSION_METADATA_SELECT`
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:97`(`CREATOR_PROJECTION`), `:109`(`VERSION_METADATA_SELECT`)
  - 상세: 둘 다 TypeORM `select` 절의 일부를 고정하는 frozen 객체 상수라는 점에서 같은 역할이지만 이름 패턴이 `_PROJECTION`/`_SELECT`로 갈린다. `CREATOR_PROJECTION`은 관계(`creator`) 하위 투영, `VERSION_METADATA_SELECT`는 최상위 컬럼 선택이라는 위치 차이는 있어 완전한 오분류는 아니지만, 같은 파일에서 나란히 쓰이는 두 select 관련 상수의 명명 규칙이 통일돼 있지 않아 처음 보는 사람이 둘의 관계를 유추하기 조금 더 어렵다.
  - 제안: 급하지 않음. 이름을 통일할 필요는 없지만, 두 상수를 함께 설명하는 JSDoc에 "왜 접미가 다른가"를 한 줄 덧붙이면 다음 사람의 오독을 줄일 수 있다.

- **[INFO]** `WorkflowVersionDetailProjection`의 JSDoc 블록이 PR을 거듭하며 계속 길어지고 있다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetailProjection` 타입 선언 바로 위 JSDoc (전체 파일 컨텍스트 46-74행)
  - 상세: 이번 PR이 그 블록 끝에 2026-09-27 프런트엔드 미러 비-변경 결정 문단을 추가해, 이미 2026-09-06·2026-09-08 이력을 담고 있던 JSDoc이 더 길어졌다. 이 저장소의 문화(근거를 코드 옆에 남겨 다음 판단 기준으로 삼음)에는 부합하지만, 누적되는 역사 서술이 타입 선언 자체의 가독성을 조금씩 갉아먹는 방향이라는 점은 인지해 둘 만하다.
  - 제안: 현재로선 블로킹 사유 아님. 이 JSDoc이 한 번 더 늘어나는 시점에는 오래된 이력(예: 2026-09-06 오탐 배경) 일부를 `plan/complete/`의 관련 문서로 옮기고 여기는 "현재 유효한 계약"만 남기는 정리를 고려할 만하다.

## 요약

이번 diff는 두 개의 §5.4 금지 조합(`creator`, `changeSummary`)을 기본형으로 되돌리고, `findByWorkflow`/`findOne`이 손으로 중복 선언하던 6개 메타 컬럼 select를 `VERSION_METADATA_SELECT` 상수로 추출한 좁고 목적이 분명한 변경이다. 새 단위 테스트(`workflow-version-response.dto.spec.ts`, select 대칭성 테스트)와 e2e 계약 대조 확장이 선언 회귀를 실질적으로 방지하고 있어 전반적으로 유지보수성을 개선하는 방향의 변경이다. 유일하게 짚을 만한 점은 서비스 쪽 select 중복은 상수화로 없앴지만 DTO 클래스 쪽의 필드+주석 이중 선언(이 PR 이전부터 있던 구조)은 그대로 남아 있고, 이번 PR이 그 자리에 긴 설명 주석까지 복제해 얹었다는 것 — 다만 새로 추가된 대칭 테스트가 그 두 필드에 한해 drift를 잡아 준다. 나머지는 명명·JSDoc 길이에 대한 사소한 관찰 수준(INFO)이며 가독성·함수 길이·중첩·매직 넘버·복잡도 관점에서는 문제가 없다.

## 위험도

LOW
