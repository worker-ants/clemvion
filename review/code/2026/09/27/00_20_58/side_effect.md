# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 워크플로 버전 응답 DTO 의 OpenAPI 계약 변경 — `creator`/`changeSummary` 가 optional → required 로 광고된다 (공개 인터페이스 변경)
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:39-40, 49-50` (`WorkflowVersionListItemDto`), `:73-74, 87-88` (`WorkflowVersionDto`)
  - 상세: `@ApiPropertyOptional({ nullable: true })` + `field?: T | null` → `@ApiProperty(...)` + `field: T`(또는 `T | null` non-optional)로 바뀌면서, 이 DTO 를 SoT 로 생성되는 OpenAPI 스펙·클라이언트 코드에서 `creator`·`changeSummary` 가 이제 "항상 존재" 로 광고된다. 이는 생성 클라이언트 타입을 좁히는 **의도된 계약 변경**이고, plan(`plan/in-progress/workflow-version-creator.md`)의 실측(FK `NOT NULL REFERENCES "user"(id)`, `ON DELETE` 없음, `select` 가 항상 두 키를 실음)과 e2e(H 케이스)로 뒷받침되며 CHANGELOG 에도 명시돼 있다. 런타임 응답 자체는 바뀌지 않으므로(값은 이미 항상 존재) 하위호환 파괴는 아니지만, 이 스키마를 바탕으로 코드를 생성하는 외부/프런트엔드 소비자가 있다면 재생성 시 옵셔널 체이닝을 걷어내는 연쇄 편집이 필요할 수 있다.
  - 제안: 별도 조치 불필요 — 이미 CHANGELOG·plan·`--impl-prep`/`--impl-done` 절차로 문서화됨. 참고용으로만 남긴다.

- **[INFO]** `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫에서 4행 제거 — 화이트리스트가 좁아짐(허용 폭 감소)
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` 함수 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 정의부(제거된 4개 항목 — 게이트 없는 삭제 줄이라 정확한 줄 번호는 Read 로 확인: 원본 파일 기준 `workflow-version-response.dto.ts:WorkflowVersionDto.changeSummary` 등 4항목)
  - 상세: 래칫에서 항목을 빼는 것은 의도된 강화(회귀 시 실패하도록)이며 부작용이 아니다. 다만 이 래칫은 "추가"는 감시하지 않고 "감소"만 실패시키는 단방향 게이트라, 이번 PR 처럼 DTO 선언을 실제로 고쳐야만 안전하게 뺄 수 있다 — DTO 변경(파일 3)과 이 삭제(파일 6)가 같은 커밋 세트에 함께 있음을 확인했다. 분리 배포 시 순서가 바뀌면 래칫이 먼저 실패한다는 점만 참고.
  - 제안: 없음(이미 동일 PR 내 동기화 확인됨).

- **[NONE]** `VERSION_METADATA_SELECT` 도입 — 새 모듈 레벨 상수지만 `Object.freeze(... as const)` 로 불변이며, 두 조회에서 스프레드(`{ ...VERSION_METADATA_SELECT, ... }`)로만 사용돼 매 호출마다 새 객체가 만들어진다. 공유 가변 상태·전역 변수 위험 없음.
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:109-116`(정의), `:158`(`findByWorkflow` 사용), `:177-180`(`findOne` 사용)

- **[NONE]** 시그니처 변경 없음 — `WorkflowVersionsService.findByWorkflow`/`findOne` 의 파라미터·반환 타입(`WorkflowVersionListItem[]`/`WorkflowVersionDetailProjection`)은 그대로다. `select` 객체의 키 구성도 리팩터 전후로 동일(단위 테스트 `workflow-versions.service.spec.ts:95-108`, `:121-133`이 리터럴 전체를 그대로 대조해 확인).

- **[NONE]** 파일시스템·환경 변수·네트워크 호출·이벤트/콜백 변경 없음. `plan/`·`review/consistency/`·`CHANGELOG.md` 에 추가된 신규 파일들은 프로젝트 워크플로 규약(plan 작성, 통합 검토 산출물)에 따른 의도된 산출물이며 애플리케이션 코드의 예측 불가 파일시스템 부작용이 아니다.

## 요약

이번 변경은 §5.4 금지 조합(optional+nullable) DTO 선언을 실제 런타임 보장(`creator`·`changeSummary` 항상 존재)에 맞춰 `required`로 좁히고, 두 조회(`findByWorkflow`/`findOne`)의 중복 `select` 리터럴을 불변 상수(`VERSION_METADATA_SELECT`)로 추출한 순수 리팩터 + 계약 정정이다. 상태 변경·전역 가변 변수·시그니처 파괴·의도치 않은 I/O·네트워크·이벤트 부작용은 발견되지 않았다. 유일하게 언급할 만한 항목은 OpenAPI 스키마상 `creator`/`changeSummary` 가 optional에서 required로 바뀌는 공개 인터페이스 변경인데, 이는 DB 제약(FK NOT NULL, ON DELETE 없음) 실측과 e2e 검증으로 뒷받침된 의도된 변경이며 CHANGELOG·plan에 이미 문서화되어 있다. 관련 래칫(`EXPECTED_OPTIONAL_NULLABLE_DRIFT`) 항목 제거도 같은 커밋 세트 내에서 DTO 변경과 동기화되어 있음을 확인했다.

## 위험도

LOW
