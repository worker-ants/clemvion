# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 동일 결정 근거(표 형태 rationale)가 3곳에 거의 verbatim 으로 중복된다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:16-21` (docstring 표) / `plan/in-progress/execute-body-openapi.md` §"핵심 판단" 표 / `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (`execute` 항목의 "닫았다" 블록 표)
  - 상세: "파라미터 타입을 DTO 로 바꾸면 계약이 좁아진다"는 동일한 2행 비교표가 DTO 클래스 docstring, plan 문서, spec-sync 트래커 세 군데에 반복해서 그대로 박제되어 있다. 코드 자체의 문제는 아니지만, 이후 이 결정이 바뀌거나(예: 검증을 실제로 켜는 후속 작업이 진행될 때) 세 곳 중 한 곳만 갱신되면 나머지가 stale 해질 위험이 있다.
  - 제안: 하나를 SoT 로 정하고(가장 자연스러운 후보는 DTO docstring — 코드와 가장 가깝다) 나머지 두 곳은 표를 재기술하지 말고 링크만 거는 방식으로 정리하는 것을 고려. 다만 이 저장소는 plan/tracker 문서에 결정 근거를 온전히 남기는 것을 관례로 삼고 있어(과거 세션 교훈: "Rationale 기각된 대안은 실제 이력 필수") 지금 규모에서는 허용 가능한 트레이드오프로 보인다 — 심각도는 INFO로 제한.

- **[INFO]** `ExecuteWorkflowDto` 클래스 docstring 이 클래스 본문(2개 필드, 23줄)보다 훨씬 길다(29줄)
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:3-29`
  - 상세: 왜 `@Body()` 파라미터 타입으로 쓰지 않는지에 대한 설명·실측 표·경고 문구가 클래스 정의 자체보다 길다. 의도(향후 실수 방지)는 명확하고 코드베이스 관례상 근거를 코드 옆에 남기는 패턴이 반복적으로 쓰이므로 결함은 아니나, 다음에 이 파일을 여는 개발자가 실제 필드 정의(핵심 정보)를 보기까지 스크롤이 필요하다.
  - 제안: 현재 형태를 유지해도 무방하나, 후속 확장 시 표·경고 블록을 별도 참조 문서(`plan/execute-body-openapi.md`)로 옮기고 docstring 은 "왜"에 대한 1-2문장 + 링크로 축약하는 선택지도 있음.

- **[INFO]** `ExecuteWorkflowDto.input` 과 `ExecuteNodeDto.input` 이 같은 컨트롤러 표면에서 동일한 필드명·다른 의미로 노출된다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:41-52` (`input` 필드, JSDoc 이 이미 `ExecuteNodeDto.input` 과의 차이를 명시)
  - 상세: 코드 검색(`grep input`)이나 IDE 자동완성으로 두 DTO 를 오가며 작업할 때 필드명만으로는 구분되지 않는다. 이미 JSDoc 에서 명시적으로 구분해 뒀고 consistency checker 도 같은 사실을 INFO 로 별도 보고했으므로 신규 지적은 아니며, 심각도를 올릴 근거는 없다.
  - 제안: 별도 조치 불요 — 현재 docstring 교차 참조로 충분히 완화됨.

## 요약

리뷰 대상 diff 는 신규 파일 2개(`execute-workflow.dto.ts`, `workflows-execute-body.spec.ts`)와 기존 컨트롤러에 대한 최소 침습적 변경(import 1줄 + 주석 3줄 + 데코레이터 1줄)으로 구성된다. DTO 클래스는 필드 2개뿐인 단순한 구조이고, 테스트 파일은 캐너리 목적에 맞게 헬퍼 함수(`executeBodyParamType`) 이름과 책임이 명확하며 `it.each` 로 대조군 케이스를 간결하게 표현한다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등 전통적인 유지보수성 위험 요소는 이 diff 범위에서 사실상 없다. 유일하게 주목할 특징은 "왜 이렇게 짰는가"에 대한 rationale 산문이 코드량 대비 매우 길고 3개 문서(docstring·plan·트래커)에 중복 기재된 점인데, 이는 이 저장소가 채택한 의도적 관례(결정 근거를 코드 옆과 plan 양쪽에 남겨 향후 실수를 캐너리로 방지)와 일치하며 실제 결함이라기보다 drift 가능성이 있는 트레이드오프에 가깝다. 네이밍·컨벤션 일관성(형제 `execute-node.dto.ts`, `re-run.dto.ts` 와의 스타일 일치, `additionalProperties: true` 사용 등)도 이미 잘 지켜지고 있다.

## 위험도
NONE
