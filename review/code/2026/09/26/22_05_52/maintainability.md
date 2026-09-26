# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 새로 추가된 클래스 내부 주석이 형제 프로퍼티 doc 과 다른 스타일(`//` vs `/** */`)을 쓴다
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:76-77` (`CanvasSaveResultDto` 내부, `workflow` 프로퍼티와 `nodes` 프로퍼티 사이)
  - 상세: `CanvasSaveResultDto` 의 모든 프로퍼티는 `/** 저장 후 워크플로우 */` 식의 JSDoc 블록 주석으로 문서화돼 있는데, 이번에 추가된 "왜 `type: 'object'` 로 두면 안 되는가" 설명은 두 줄짜리 `//` 라인 주석이다. 내용 자체는 유용한 회귀 방지 근거(향후 누군가 `items: { type: 'object' }` 로 되돌리는 것을 막는 문맥)이지만, 같은 클래스 안에서 주석 스타일이 갈려 읽는 흐름이 끊긴다.
  - 제안: 다른 프로퍼티처럼 `/** ... */` 블록으로 통일하거나, `nodes`/`edges` 프로퍼티 바로 위의 JSDoc(`/** 저장 후 노드 배열 */`) 안에 이유를 합쳐 적는다.

- **[INFO]** 저장 응답 형태 대조(길이 검증 + 계약 대조) 3줄이 e2e 파일 내 두 테스트(C, 신규 I)에 거의 그대로 반복된다
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `it('C. duplicate → …')` 블록의 `expect(save.body.data.nodes).toHaveLength(5); expect(save.body.data.edges).toHaveLength(2); assertMatchesContract(save.body.data, await contractForDto(CanvasSaveResultDto));` 와 `it('I. 버전 복원 → …')` 블록의 대응 3줄(`assertMatchesContract(restored.body.data, await contractForDto(CanvasSaveResultDto));` 포함)
  - 상세: 두 테스트가 검증하는 분기(신규 생성 vs 기존 노드 갱신)가 다르다는 점에서 각 테스트가 자기 완결적으로 읽혀야 하는 e2e 관례(이 코드베이스의 기존 스타일)에는 맞지만, `CanvasSaveResultDto` 계약 대조 자체는 재사용 가능한 형태다.
  - 제안: 현재 수준(3~4줄)에서는 헬퍼로 뽑을 실익이 크지 않아 유지해도 무방하나, 이후 이 계약 대조가 세 번째 호출부에 등장하면 `expectCanvasSaveShape(body, {nodes, edges})` 같은 공용 헬퍼로 추출을 고려할 것.

## 요약

리뷰 대상 diff 는 스코프가 작고(DTO 필드 타입 선언 변경 3줄 + 신규 단위 테스트 30줄 + e2e 테스트 1건 추가 + CHANGELOG/plan 문서), 목적이 명확하다 — 응답 `nodes`/`edges` 를 `Record<string, unknown>[]` 에서 기존 `NodeDto[]`/`EdgeDto[]` 로 바꿔 이미 있는 컨벤션(`workflow: WorkflowDto` 처럼 `type: () => [Dto]` 로 참조)에 맞췄다. 네이밍·함수 길이·중첩 깊이·순환 복잡도 모두 특이사항이 없고, `NodeDto`/`EdgeDto` 를 `edges`/`nodes` 모듈에서 그대로 재사용해 순환 의존도 만들지 않았다(단방향 import 확인). 신규 단위 테스트(`workflow-response.dto.spec.ts`)는 `it.each` 로 두 케이스를 테이블화해 간결하고, e2e 신규 케이스(I)는 기존 케이스(C)와 다른 코드 경로(갱신 vs 생성)를 검증한다는 목적이 주석으로 명확히 설명돼 있다. `ExportWorkflowDto` 가 같은 미선언(`type: 'object'`) 패턴을 아직 갖고 있어 일견 비일관으로 보이지만, 이는 이번 PR 이 스코프 밖으로 명시적으로 분리해 후속 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재한 것이므로 결함이 아니다. 지적한 두 건은 모두 INFO 수준의 사소한 스타일/중복이며 병합을 막을 이유가 없다.

## 위험도

NONE
