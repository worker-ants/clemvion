# 유지보수성(Maintainability) 리뷰 — export-workflow-typed

## 발견사항

- **[INFO]** `ExportedNodeDto`/`ExportedEdgeDto` 가 `NodeDto`/`EdgeDto` 와 필드 구조(10키/6키 대부분)를 상당 부분 중복 선언한다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:147-219` (`ExportedNodeDto`, `ExportedEdgeDto` 전체)
  - 상세: `type`·`category`·`label`·`positionX`·`positionY`·`config`·`isDisabled`·`description` 필드가 기존 `NodeDto` 와 거의 동일한 선언을 반복한다. 다만 이는 무심코 생긴 중복이 아니라 파일 상단 주석(139-142행)이 "UUID 미포함·index 참조·요청 DTO 와의 nullable/optional 지위 차이"를 근거로 명시적으로 정당화한 의도된 분리다(`--impl-prep` INFO 3 반영 결과). 코드베이스에 이미 `cafe24`/`makeshop` 미러처럼 의도된 중복 패턴이 존재하므로 일관성 관점에서도 이례적이지 않다. 조치 불필요, 참고용으로만 남긴다.
  - 제안: 없음 (근거 주석이 이미 다음 사람의 "DRY 하게 합치자" 재발견을 막고 있음).

- **[INFO]** 부모 DTO `ExportWorkflowDto`(현재형 "Export")와 신규 원소 DTO `ExportedNodeDto`/`ExportedEdgeDto`(과거분사형 "Exported")의 명명 시제가 다르다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:224`(`ExportWorkflowDto`), `:147`(`ExportedNodeDto`), `:195`(`ExportedEdgeDto`)
  - 상세: "export 동작의 결과"(`ExportWorkflowDto`)와 "export 된 상태의 원소"(`ExportedNodeDto`)를 구분하려는 의도로는 읽히지만, 같은 파일 안에서 두 시제가 섞여 처음 보는 사람이 검색(grep)할 때 접두어를 통일해서 떠올리기 어려울 수 있다.
  - 제안: 별도 수정 불요 — 이름이 짧고 클래스 수가 적어 혼동 비용이 낮다. 향후 export 관련 DTO 가 더 늘어나면 명명 규칙을 `spec/conventions/swagger.md` 등에 한 줄 명시하는 것을 고려.

- **[INFO]** `workflow-response.dto.spec.ts` 의 리팩터링이 중복을 실제로 줄였다 (`CanvasSaveResultDto` 전용 `describe`/`it.each` 두 벌을 하나의 파라미터화 테이블로 통합).
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.spec.ts:23-41`
  - 상세: `{ dto, key, ref }` 객체 배열 + 동적 타이틀(`$dto.name`) 패턴은 Jest 관용구를 벗어나지 않으면서도 이후 새 응답 DTO 가 추가될 때 배열에 한 줄만 더하면 되도록 확장성을 높였다. 부정적 발견이 아니라 유지보수성 개선으로 기록.
  - 제안: 없음.

- **[INFO]** `description` 필드의 `@ApiProperty({ type: String, nullable: true })` 위에 붙은 3줄 주석(swagger CLI 플러그인 유무에 따른 `string | null` emit 차이)이 코드베이스 관례상 이례적으로 상세하지만, 비직관적인 프레임워크 동작을 다음 사람이 "단순화"해서 회귀를 만드는 것을 막는 근거 주석이라 적절하다.
  - 위치: `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts:176-179`
  - 제안: 없음.

## 요약

이번 변경(`ExportedNodeDto`/`ExportedEdgeDto` 신설 및 관련 테스트·e2e·CHANGELOG 반영)은 클래스·함수 길이, 중첩 깊이, 순환 복잡도 관점에서 문제가 없다 — 신규 코드는 데코레이터가 붙은 평탄한 필드 선언과 짧은 테스트 케이스뿐이며 조건문·반복문 중첩이 없다. 네이밍은 기존 `NodeDto`/`EdgeDto` 컨벤션(`type: string`, `category: NodeCategory` 등)을 그대로 따르고, 왜 기존 DTO 를 재사용하지 않는지에 대한 근거를 파일·plan 양쪽에 남겨 다음 사람의 재발견 비용을 낮췄다. 테스트 파일은 두 DTO 를 한 테이블로 통합해 오히려 기존보다 중복이 줄었다. 발견된 사항은 모두 INFO 수준의 참고 관찰(의도된 필드 중복, 부모/자식 DTO 명명 시제 불일치)로, 조치가 필요한 결함은 없다. `review/consistency/**` 산출물(파일 7-14)은 이미 생성된 리포트 문서로 코드 메트릭 대상이 아니며 기존 산출물 포맷 관례를 따른다.

## 위험도

NONE
