# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** 동일한 결정 서술(rationale)이 3곳에 사실상 같은 문장으로 반복 기재됨
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:46-53` (JSDoc), `plan/in-progress/swagger-decisions.md:32-39` (`## ②` 절), `plan/in-progress/spec-sync-external-interaction-api-gaps.md:987-995` (트래커 항목)
  - 상세: "`parameterValues ?? input.parameters` 는 처음부터 back-compat 경로다 / `deprecated: true` 는 비파괴로 클라이언트를 유도한다" 는 동일 논지가 DTO 소스 docstring, 작업 plan 본문, spec-sync 트래커 세 곳에 거의 같은 문장으로 중복돼 있다. 결정이 향후 번복되면 세 곳을 모두 찾아 갱신해야 한다.
  - 제안: 이 저장소는 "결정을 소스 코드 지점에도 남겨 다음 리뷰가 재조사하지 않게 한다"는 관행을 이미 채택하고 있고(`button-slug.util.ts`, `execution-seq-allocator.service.ts` 등에서 동일 패턴 확인), plan 트래커와 plan 문서·DTO 세 곳 모두 정본이 아니라 각기 다른 소비자(트래커=이력 SoT, DTO=코드 옆 근거)를 겨냥하므로 의도된 트레이드오프로 보인다. 별도 조치는 불요하나, 향후 이 결정이 재검토될 경우 세 지점을 함께 갱신해야 한다는 점만 인지해 두면 된다.

- **[INFO]** `ExecuteWorkflowDto.input` 필드 JSDoc 이 API 문서 설명과 의사결정 서사가 뒤섞여 19줄로 길다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:41-59`
  - 상세: 필드 하나의 JSDoc 안에 "형태 차이 설명"(42-44) + "`deprecated` 채택 근거"(46-53) + "마커 거부 공동 적용 근거"(55-58) 세 개의 서로 다른 관심사가 인용 블록(`>`)으로 나열돼 있다. 클래스 레벨 docstring(3-29줄)도 이미 유사하게 길다.
  - 제안: 현재 스타일은 이 코드베이스의 기존 관행(결정 배경을 코드 인접 지점에 남기는 패턴)과 일치하므로 구조 자체를 바꿀 필요는 없다. 다만 필드가 더 늘어나면 가독성이 저하될 수 있어, 향후에는 `> 근거: spec/...#anchor` 형태로 상세 서사는 spec 으로 옮기고 코드에는 요약만 남기는 방향(swagger.md 가 이번에 §3 보안·정책 캐비엇에 적용한 것과 동일한 패턴)을 고려할 수 있다.

- **[INFO]** 신규 테스트 태그 `[결정]` 이 기존 `[캐너리]`/`[가드]`/`[대조군]` 라벨 컨벤션에 자연스럽게 합류함 (긍정적 관찰)
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts:163`
  - 상세: 새 라벨을 도입했지만 기존 파일의 명명 패턴(대괄호 태그로 테스트 의도 분류)과 일관되며, `preferred`/`input` 변수명도 목적을 명확히 드러낸다. 대조군 단언(`preferred.deprecated).toBeFalsy()`)까지 포함해 "한쪽만 보면 둘 다 deprecated 로 바꿔도 통과한다"는 실패 모드를 docstring 에 명시한 점도 좋다.

## 요약

이번 diff 는 실질적으로 backend DTO 데코레이터 옵션 1줄(`deprecated: true`) 추가, 이를 고정하는 unit 테스트 1건, 그리고 관련 plan/spec 문서 갱신으로 구성돼 있어 함수 길이·중첩·순환 복잡도·매직 넘버 등 전형적인 유지보수성 위험이 발생할 표면 자체가 거의 없다. 유일하게 짚을 만한 지점은 결정 서사(rationale)가 DTO docstring·plan 문서·트래커 세 곳에 유사 문장으로 중복된다는 점과 필드 JSDoc 이 길다는 점인데, 둘 다 이 저장소가 이미 채택한 "결정을 코드 인접 지점에도 남긴다"는 관행과 일치하는 의도된 트레이드오프로 판단된다. 네이밍·테스트 라벨 컨벤션은 기존 파일 스타일과 일관되게 유지됐고, swagger.md 의 길이 규칙 개정도 산문 두 줄을 표 형태로 바꿔 오히려 가독성을 개선했다.

## 위험도
NONE
