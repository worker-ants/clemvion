# 정식 규약 준수 검토 — spec/2-navigation/

## 검토 범위와 방법

- 검토 모드: `--impl-prep`, scope=`spec/2-navigation/`.
- 프롬프트 번들은 컨텍스트 예산 초과로 `spec/2-navigation/` 21개 파일 중 15개(`4-integration.md`·`6-config.md`·
  `_product-overview.md`·`_layout.md` 등)의 본문을 생략했다. 생략된 파일은 본 리뷰에서 **직접 `Read`로 재확인하지
  않은 부분은 "위반 없음"이 아니라 "미검증"으로 표기한다.
- 전문(全文)이 번들에 포함된 `1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`는 텍스트 전체를 직접 대조했고,
  `_product-overview.md`·`_layout.md`는 구조(제목·섹션 헤더)만 파일시스템에서 직접 열어 표본 확인했다.
- `spec/conventions/**`도 번들에서 대부분 생략(예산 초과)되어, `error-codes.md`·`swagger.md`·`review-citations.md`·
  `secret-store.md`·`audit-actions.md`·`chat-channel-adapter.md`(§2.3)를 파일시스템에서 직접 열어 대조했다.
- `1-workflow-list.md §3.1`(폴더 API)이 인용하는 실제 구현(`folders.controller.ts`·`folders.service.ts`·DTO)도
  직접 열어 스펙 서술과 swagger 규약 준수 여부를 교차 확인했다.

## 발견사항

검토한 세 파일(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)의 본문에서 `spec/conventions/**`을
**직접 위반하는 새로운 CRITICAL/WARNING 사례는 찾지 못했다.** 오히려 이 세 문서는 에러 코드
(`VALIDATION_ERROR`·`RESOURCE_CONFLICT`·`DUPLICATE_NODE_LABEL`·`INVALID_FIELD` 등 UPPER_SNAKE_CASE, 도메인
prefix 예외 포함)·감사 액션(`trigger.chat_channel_bot_token_rotated` 등 `audit-actions.md` §3 레지스트리와 완전
일치)·`uiMapping`(`formMode`/`visualNode`/`buttonLayout`) enum 값(`chat-channel-adapter.md` §2.3과 완전 일치)·
파일 명명(`N-name.md`, `_product-overview.md`, `_layout.md`)·DTO 명명(`Update<Entity>Dto` top-level vs nested
로컬 패턴)까지 인용된 규약과 정밀하게 맞춰져 있고, 드리프트가 있는 자리는 문서 스스로 "Planned"/"실측" 각주로
정직하게 표시해 두었다(예: `formatVersion` 미방출, telegram 정규식 미구현, `ownership`/`ownership 필터` 무시 동작 등).

교차 검증 중 발견한 두 건은 **spec 문서 자체의 위반이 아니라 문서가 인용하는 구현 쪽의 알려진 드리프트**이며,
둘 다 이미 별도 plan/tracker로 추적·처리 중이라 새 CRITICAL/WARNING이 아니라 INFO로만 기록한다(중복 플래깅 방지).

- **[INFO]** 폴더 API 컨트롤러가 `FolderDto`를 광고하지만 실제로는 엔티티를 그대로 반환
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 "폴더 관리 API" (frontmatter `code:`가 가리키는
    `codebase/backend/src/modules/folders/folders.controller.ts`·`folders.service.ts`)
  - 위반 규약: `spec/conventions/swagger.md` §5-1 "엔티티(`entities/*.entity.ts`)를 그대로 노출하지 말고, API
    응답 형태에 맞춰 별도 DTO 를 만듭니다"
  - 상세: `FoldersController`의 5개 라우트 모두 `@ApiOkWrappedResponse(FolderDto)` 등으로 `FolderDto`를
    광고하지만, `FoldersService.findAll/findById/create/update`는 TypeORM `Folder` 엔티티 인스턴스를 그대로
    반환한다(별도 DTO 매핑·`ClassSerializerInterceptor` 없음). 현재는 `find/findOne`에 `relations` 옵션이 없어
    `workspace`/`parent` 관계가 로드되지 않으므로 즉시 유출은 없으나, 이 결합(entity passthrough)은 §5-1이
    실제 사고 사례(감사 로그 `User` 엔티티 26키 유출)로 명시한 바로 그 실패 패턴이다. `swagger-dto-contract`
    정적 가드는 선언끼리만 비교해 이 유형을 잡지 못한다고 swagger.md 스스로 적고 있다.
  - 제안: 이미 `plan/in-progress/folders-contract-e2e.md`가 같은 모듈의 `FolderDto.parentId`
    optional+nullable 선언 드리프트(§5.4 금지 조합, `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 래칫)를 다루고 있다.
    해당 plan의 스코프가 필드 선언 정정에 한정돼 있으므로, 엔티티 직접 반환 자체(서비스에서 `FolderDto`로 명시
    매핑)는 그 plan 또는 후속 항목으로 별도 추적할 것을 제안한다. spec 문서(`1-workflow-list.md`) 자체는 이
    사실을 서술하지 않으므로 문서 수정은 불필요(plan의 `spec_impact: none` 판단과 일치).

- **[INFO]** `ExportWorkflowDto.formatVersion`이 필수(`@ApiProperty`)로 선언됐지만 실구현은 방출하지 않음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 "Export/Import JSON 포맷" (해당 문단은 이미
    "⚠️ Swagger 응답 DTO(`ExportWorkflowDto`)는 `formatVersion` 필드를 선언하지만... 미구현 (Planned)"로
    스스로 명시)
  - 위반 규약: `spec/conventions/swagger.md`의 DTO-실응답 일치 원칙(§5-1 Rationale이 인용하는
    `swagger-dto-contract`/`response-contract` 검증 축)
  - 상세: `workflow-response.dto.ts`의 `ExportWorkflowDto.formatVersion`은 `@ApiPropertyOptional`이 아니라
    `@ApiProperty()`(필수)로 선언돼 있는데, export 서비스 어디에도 `formatVersion`을 채우는 코드가 없다(grep
    0건). OpenAPI 스키마는 이 필드가 항상 존재한다고 광고하지만 실제로는 항상 부재하다. spec 문서는 이 갭을
    이미 정직하게 "Planned"로 밝히고 있어 문서 자체의 문제는 아니다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md`가 이미 이 항목을
    "`ExportWorkflowDto.formatVersion`이 required 인데 부재 → `allowMissing` 옵션 신설 + spec 인용 주석"으로
    추적하고 있다(§5.4 스윕 트래커). 새 조치 불필요 — 해당 트래커에서 완결.

## 요약

`spec/2-navigation/1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`는 명명 규약(파일·에러 코드·감사
액션·DTO)·API 문서 규약(swagger 데코레이터·오프너 필드 선언 패턴)·문서 구조(영역 단위 `_product-overview.md` +
`N-name.md` + 말미 `Rationale`) 세 축 모두에서 `spec/conventions/**`와 정밀하게 맞물려 있으며, 알려진 드리프트는
전부 "Planned"/"실측" 각주로 스스로 정직하게 표시해 두었다. 교차 검증 중 발견한 두 건(폴더 API 엔티티 직접 반환,
`ExportWorkflowDto.formatVersion` 필수-미방출)은 스펙 문서 자체의 위반이 아니라 구현 쪽 드리프트이며, 둘 다 이미
별도 진행 중인 plan(`folders-contract-e2e`·`spec-draft-nullable-notation-followups`)이 추적·처리하고 있어 중복
플래깅하지 않고 INFO로만 남긴다. 다만 컨텍스트 예산으로 인해 스코프의 15개 파일(`4-integration.md`·
`6-config.md`·`_product-overview.md` 등)은 전문 대조를 하지 못했으므로 이 부분은 "위반 없음"이 아니라
"미검증"으로 남는다.

## 위험도

NONE — 검증한 범위 내에서 target 문서가 정식 규약을 직접 위반하는 사례를 찾지 못했다. (단, 번들 예산으로 미검증
처리된 15개 파일은 이 판정 밖이다.)
