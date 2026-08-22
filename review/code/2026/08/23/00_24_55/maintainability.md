# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** 동일한 "DTO 를 `@Body()` 타입으로 바꾸면 계약이 좁아진다" 비교표가 3곳에 거의 verbatim 중복된다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:16-21` (docstring 표) / `plan/complete/execute-body-openapi.md` §"핵심 판단" 표(24-27줄) / `plan/in-progress/spec-sync-external-interaction-api-gaps.md` `execute` 항목의 "닫았다" 블록 표(958-960줄)
  - 상세: "class-validator 데코레이터 없이 타입하면 모든 요청 거부 / 데코레이터를 달면 여분 키가 400" 이라는 2행 비교표가 DTO 클래스 docstring, 완료 plan 문서, spec-sync 트래커 세 군데에 표 형태 그대로 박제돼 있다. 코드 동작에는 영향 없지만, 이후 이 결정이 뒤집히거나(예: 검증을 실제로 켜는 후속 작업) 세부 문구가 수정될 때 세 곳 중 일부만 갱신되면 나머지가 stale 해질 위험이 있다.
  - 제안: DTO docstring 을 SoT 로 유지하고 plan/tracker 쪽은 표를 재기술하지 말고 "근거: `execute-workflow.dto.ts` docstring" 형태의 링크로 축약하는 것을 고려. 다만 완료된 plan 문서는 봉인되어 이후 갱신 대상이 아니고, 이 저장소는 결정 근거를 plan/tracker에도 온전히 남기는 것을 관례로 삼고 있어(과거 세션 rationale-continuity 관례) 지금 규모에서는 허용 가능한 트레이드오프다 — 심각도는 INFO 유지.

- **[INFO]** `ExecuteWorkflowDto` 클래스 docstring(29줄)이 클래스 본문(2개 필드, 23줄)보다 길다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:3-29`
  - 상세: 왜 `@Body()` 파라미터 타입으로 쓰지 않는지에 대한 설명·실측 표·경고 문구가 클래스 정의 자체보다 길어, 이 파일을 여는 개발자가 실제 필드 정의(핵심 정보)까지 스크롤해야 한다. 의도(향후 오용 방지)는 명확하고 저장소 관례상 근거를 코드 옆에 남기는 패턴이 반복적으로 쓰이므로 결함은 아니다.
  - 제안: 현재 형태를 유지해도 무방하나, 후속 확장 시 표·경고 블록을 `plan/complete/execute-body-openapi.md` 로 옮기고 docstring 은 "왜" 1~2문장 + 링크로 축약하는 선택지도 있음(필수 아님).

- **[INFO]** `ExecuteWorkflowDto.input` 과 `ExecuteNodeDto.input` 이 같은 컨트롤러의 OpenAPI 표면에서 동일 필드명·다른 의미로 병존한다
  - 위치: `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts:41-50` (JSDoc 이 이미 `{@link ExecuteNodeDto.input}` 과의 차이를 명시)
  - 상세: 필드명만으로는 두 DTO 를 구분할 수 없어 grep/자동완성 시 혼동 가능성이 있으나, JSDoc 교차 참조로 이미 명시적으로 구분해 뒀다. 신규 지적이 아니며 심각도를 올릴 근거 없음.
  - 제안: 조치 불요 — 현재 docstring 교차 참조로 충분히 완화됨.

- **[INFO]** `workflows-execute-body.spec.ts` 에서 `new CustomValidationPipe()` 인스턴스 생성이 2개 테스트 블록에서 각각 반복된다
  - 위치: `codebase/backend/src/modules/workflows/workflows-execute-body.spec.ts` — `[캐너리] 여분 top-level 키를 실은 본문도 파이프를 통과한다` 테스트, `[대조군] DTO 로 타입하면 파이프가 거부한다` (`it.each`) 테스트
  - 상세: 두 곳 모두 `const pipe = new CustomValidationPipe();` 를 각자 만든다. 상태 없는 객체라 `beforeEach` 로 공유해도 결과는 같지만, 캐너리와 대조군을 의도적으로 시각적으로 분리해 각자 독립적으로 읽히게 하는 효과도 있어 결함이라 보기 어렵다.
  - 제안: 조치 불요(선택적으로 `beforeEach` 로 통합 가능하나 현재도 가독성에 문제 없음).

## 요약

이번 라운드는 신규 DTO(`execute-workflow.dto.ts`), 캐너리+가드 테스트(`workflows-execute-body.spec.ts`), 컨트롤러 최소 변경(`@ApiBody` 데코레이터 1줄 + 주석 3줄), plan 문서 갱신, 그리고 직전 리뷰 라운드(`00_07_27`)의 산출물 커밋으로 구성된다. 직전 라운드에서 지적된 Warning 3건(마커 규칙 누락 · plan 체크박스 stale · OpenAPI 노출 자체를 검증하지 않는 캐너리)은 모두 반영이 확인됐다 — `input` description 에 마커 거부 문구가 추가됐고, `plan/complete/execute-body-openapi.md` 체크박스는 전부 `[x]` 이며, `workflows-execute-body.spec.ts` 에 실 컨트롤러 메타데이터·렌더링 스키마를 직접 단언하는 가드 4건이 추가돼 형제 DTO 오참조 같은 실수를 잡을 수 있게 됐다. 함수 길이·중첩 깊이·순환 복잡도·매직 넘버 등 전통적 유지보수성 위험 요소는 이 diff 범위에서 실질적으로 없다. 네이밍과 스타일은 형제 DTO(`execute-node.dto.ts`, `re-run.dto.ts`)·자매 스펙(`interact-ack-response.dto.spec.ts`)과 일관되며, 유일한 잔여 특징은 동일 rationale 표가 코드 docstring·plan·트래커 세 곳에 중복 기재된 점인데 이는 저장소가 채택한 의도적 관례와 부합해 심각도를 올릴 근거가 없다. 전반적으로 유지보수성 관점에서 실질적 위험은 없다.

## 위험도
NONE
