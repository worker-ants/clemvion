# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** OpenAPI 스키마 좁힘(optional+nullable → required)은 실제 wire 형식을 바꾸는 것이 아니라 문서/타입 선언을 실제 런타임과 맞추는 정정이다 — 하위 호환.
  - 위치: `codebase/backend/src/modules/workflow-versions/dto/responses/workflow-version-response.dto.ts:36-40`(`WorkflowVersionListItemDto.changeSummary`), `:46-50`(`WorkflowVersionListItemDto.creator`), `:70-74`(`WorkflowVersionDto.changeSummary`), `:84-88`(`WorkflowVersionDto.creator`)
  - 상세: `creator?: WorkflowVersionCreatorDto | null` → `creator: WorkflowVersionCreatorDto`, `changeSummary?: string | null` → `changeSummary: string | null`(required+nullable). `workflow-versions.service.ts:97-116`(`CREATOR_PROJECTION`·`VERSION_METADATA_SELECT`)와 DB 스키마(`created_by UUID NOT NULL REFERENCES "user"(id)`, `ON DELETE` 없음)를 근거로 `creator`가 항상 로드됨을 실측했고, 두 조회(`findByWorkflow`/`findOne`) 모두 이 투영을 이미 쓰고 있었다 — 즉 종전 optional+nullable 선언이 **실제보다 넓게** 잘못 문서화돼 있었을 뿐, 이번 변경으로 실제 응답 바이트가 바뀌지는 않는다. OpenAPI 스펙만 놓고 보면 optional→required 전환은 코드 생성 클라이언트 입장에서 "이전엔 옵셔널 체크가 필요했지만 이제는 항상 값이 있다고 가정 가능"으로, 일반적으로 안전한 방향의 스키마 좁힘이다(반대 방향, 즉 required→optional 이었다면 breaking이었을 것). `CHANGELOG.md:26-31`에 소비자 대상으로 명시적으로 공지된 점도 적절하다.
  - 제안: 없음 — 실측·테스트(단위/e2e/뮤테이션)로 뒷받침된 정정이며 별도 조치 불요.

- **[INFO]** 버전 API 는 URL 버전 관리를 쓰지 않는 단일 버전 운영(`spec/5-system/2-api-convention.md` §1 "버전: URL 경로에 포함하지 않음")이므로, 이번처럼 실제 동작 변화 없는 스키마 문서 정정에는 버전 범프가 요구되지 않는다 — 규약과 부합.

- **[INFO]** 같은 spec 문서(`spec/3-workflow-editor/5-version-history.md`)의 §7.2 가 응답 타입을 엔티티와 동명(`WorkflowVersion`)으로 표기하는 기존 이격은 이번 PR 의 diff 범위 밖이며, `review/consistency/2026/09/26/23_55_27/convention_compliance.md`(WARNING 1·2)가 이미 잡아 `plan/in-progress/spec-draft-nullable-notation-followups.md:1056-1062`에 planner 후속 항목으로 등재돼 있다. 중복 지적하지 않음 — API 계약 관점에서 재확인만 남긴다.

- **[INFO]** 목록(`GET /workflows/:wfId/versions`) 엔드포인트에 계약 대조(schema contract)가 전혀 없던 갭을 이번 PR 이 메웠다 — `codebase/backend/test/workflow-crud.e2e-spec.ts:573-579`에서 `expectNoUserSecrets(list.body)` + `WorkflowVersionListItemDto` 계약 대조를 추가. `creator`가 required 로 바뀌면서 부재·`null` 이 즉시 위반으로 잡히고, 중첩 `$ref` 라 `User` 다른 컬럼이 실려도 미선언으로 검출된다(뮤턴트 M5 로 실측 확인, `select`에서 `creator` 투영을 빼자 이름 축이 KILLED). 회귀 방지 관점에서 API 계약 커버리지가 개선된 항목이다.

- **[INFO]** 래칫(`swagger-dto-contract.spec.ts:426-429`)만으로는 "optional+nullable → optional(단독)"으로의 부분 회귀를 못 잡는다는 한계(뮤턴트 M2 로 실측: 래칫 GREEN, 캐너리만 RED)를 인지하고 `workflow-version-response.dto.spec.ts` 를 신설해 선언을 직접 고정했다 — API 계약 가드 계층화가 적절하다.

에러 응답 형식(HTTP 상태 코드), 요청 검증, URL/경로 설계, 페이지네이션, 인증/인가는 이번 diff 의 변경 범위에 포함되지 않으며 기존 동작을 그대로 유지한다(예: `assertWorkspaceOwnership`의 `NotFoundException({code: 'RESOURCE_NOT_FOUND', ...})`, `createVersion`의 `ConflictException({code: 'WORKFLOW_VERSION_CONFLICT', ...})` 등 기존 에러 계약 불변).

## 요약

본 변경은 워크플로 버전 목록·상세 응답의 `creator`·`changeSummary` 필드를 §5.4 규약이 금지하는 "optional + nullable" 조합에서 실제 런타임과 일치하는 기본형(`creator` required 참조, `changeSummary` required+nullable)으로 정정하는 OpenAPI 계약 정확성 개선이다. DB 제약(FK NOT NULL, ON DELETE 없음)과 두 조회의 `select`/`relations` 구성을 근거로 실제 값이 항상 존재함을 실측했고, 실제 wire 바이트는 변경되지 않아 하위 호환이며 breaking change 가 아니다. 단일 버전 운영 정책상 버전 범프도 불필요하다. 래칫 갱신 + 신규 DTO 선언 캐너리 + 목록 엔드포인트 e2e 계약 대조 신설(부재였던 갭 해소) + 뮤테이션 검증까지 계층적으로 뒷받침되어 있고, 서비스의 `select` 리터럴을 `VERSION_METADATA_SELECT` 상수로 통합한 리팩터도 두 자매 조회 간 드리프트를 막는 기존 실패 패턴(하나만 투영 누락)을 재발 방지하는 방향이다. 유일하게 남은 이격(spec §7.2 의 엔티티-동명 응답 타입 표기)은 이번 diff 범위 밖의 기존 상태로, 이미 consistency-check 에서 WARNING 처리 후 planner 트래커에 등재돼 있어 별도 조치가 필요 없다.

## 위험도

LOW
