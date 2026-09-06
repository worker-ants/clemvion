# 정식 규약 준수 검토 — `spec/2-navigation/`

**검토 모드**: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`.
**스코프 델타**: 0개 파일 — 이 브랜치(`user-entity-column-defense`)는 `spec/2-navigation/` 을
바꾸지 않았다(구현 diff 는 User 엔티티 노출 가드·workflow-versions·workspace 응답 DTO 등
`spec/2-navigation` 이 다루는 트리거/스케줄 화면과 무관한 영역). 델타 0 을 CRITICAL 의 근거로
쓰지 않았고, 아래 발견사항은 **이 PR 이전부터 존재하던 target 문서 본문**에 대한 정식 규약
준수 감사다.

본 라운드는 프롬프트에 완전히 실린 `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 를
`spec/conventions/error-codes.md`·`swagger.md`·`audit-actions.md` 와 대조하고, 문서가 서술하는
API 출력 형식을 실제 백엔드 구현(`codebase/backend/src/modules/triggers/**`,
`common/filters/http-exception.filter.ts`)과 절대경로로 재확인했다.

## 발견사항

- **[CRITICAL] `TRIGGER_ENDPOINT_PATH_CONFLICT` 서브코드·`details.field='endpoint_path'` 가 실제로 발행되지 않는다 — 문서한 에러 출력 형식이 구현보다 넓다**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API, `PATCH /api/triggers/:id` 설명 바로 아래 blockquote 마지막 줄 — "`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`, `details.field='endpoint_path'`)". 같은 서브코드가 §2.3.1 필드 권한 매트릭스의 `Webhook Configuration | endpointPath` 행에도 반복 인용됨("`(workspace_id, endpoint_path)` UNIQUE 위반 시 409 `RESOURCE_CONFLICT` (세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)").
  - 위반 규약: `spec/conventions/error-codes.md`(에러 코드는 "클라이언트와의 장기 계약" — §1·§Rationale) + `spec/5-system/2-api-convention.md §5.3`(에러 응답 envelope 형식, SoT) + `spec/conventions/swagger.md §5-5`("`ErrorResponseDto` 는 `GlobalExceptionFilter` 출력을 1:1 로 표현"). 세 문서가 공유하는 전제 — spec 이 서술하는 에러 출력 형식은 실제 발행되는 형식과 일치해야 한다 — 를 이 한 항목이 어긴다.
  - 상세: 절대경로로 확인한 결과, `TRIGGER_ENDPOINT_PATH_CONFLICT` 문자열은 저장소 전체(`codebase/`)에 **0건** 존재한다(`grep -rn "TRIGGER_ENDPOINT_PATH_CONFLICT" codebase/` 매치 없음). `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `update()` 는 `endpointPath` UNIQUE 충돌을 직접 catch 하는 코드가 없다(`ConflictException`·`23505`·`throwIfUniqueViolation` 어느 것도 그 파일에 없음). 실제로 이 경로는 `codebase/backend/src/common/filters/http-exception.filter.ts` 의 범용 `isUniqueViolation` 분기(23505 → 409)를 타는데, 그 분기는 `code = 'RESOURCE_CONFLICT'` 만 설정하고 `details` 는 손대지 않는다 — 응답 조립부가 `...(details ? { details } : {})` 이므로 `details` 자체가 응답에서 빠진다. 즉 실제 wire 응답은 `{ error: { code: 'RESOURCE_CONFLICT', message: 'Resource already exists or has been modified concurrently.', requestId } }` 뿐이고, 문서가 단정하는 `TRIGGER_ENDPOINT_PATH_CONFLICT` 서브코드도 `details.field` 도 존재하지 않는다.
    같은 §2.3.1 매트릭스의 다른 모든 `details.field` 주장(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/`inboundSigningPlaintext`/`type`)은 `triggers.service.ts` 의 `assertChatChannelInputSafe`·`assertInboundSigningPlaintextByProvider`·`update()` 서두 분기에 정확히 대응하는 `throw new BadRequestException({ code: 'VALIDATION_ERROR', details: { field: '...' } })` 가 있어 검증된다 — 이 한 항목만 검증되지 않은 채 나머지와 동일한 확정적 어조로 서술돼 있다. 대조군도 있다: `spec/2-navigation/1-workflow-list.md` 의 동일 패턴(폴더 이름 중복 UNIQUE 위반)은 "409 `RESOURCE_CONFLICT`(unique violation → 409 매핑, **전역 exception filter**)" 라고만 적어 실제 동작과 정확히 일치한다. 또한 같은 §3 안에서 `sort`/`order` 쿼리 파라미터가 무시되는 사실은 "⚠️ ... sort/order 반영은 미구현/Planned" 로 정직하게 표기돼 있어, 이 문서 스스로가 "구현과 다른 서술은 Planned 로 표기한다" 는 관행을 실천하고 있다 — `endpoint_path` 항목만 그 관행을 벗어났다.
    프런트엔드 어디에도 `TRIGGER_ENDPOINT_PATH_CONFLICT` 또는 `details.field === 'endpoint_path'` 분기가 없어(grep 0건) 현재 이 문서를 근거로 잘못 구현된 소비자는 없지만, 이 spec 은 `code:` frontmatter 가 가리키는 구현 파일들의 **단일 진실**이라 이후 프런트엔드·통합 문서가 이 문구를 그대로 근거 삼아 `TRIGGER_ENDPOINT_PATH_CONFLICT` 분기를 만들면 실제로는 결코 도달하지 않는 죽은 코드가 된다.
  - 제안: (a) 백엔드에 `endpointPath` UNIQUE 위반을 명시적으로 catch 해 `TRIGGER_ENDPOINT_PATH_CONFLICT` + `details.field='endpoint_path'` 를 실제로 발행하도록 구현하거나 (다른 도메인 전용 충돌 코드들과 동일한 패턴 — `triggers.service.ts` 에 `catch`+`isUniqueViolation` 판별 후 `ConflictException` throw), (b) 구현 계획이 없다면 문구를 실측대로 "409 `RESOURCE_CONFLICT`(전역 unique-violation 매핑, `details` 없음)" 로 정정한다 — 이는 `spec-draft`/`impl-prep` 를 요구하지 않는 순수 사실 정정에 해당하는지 project-planner 판단이 필요하다.

## 요약

`spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 는 명명 규약(kebab-case `id`, API 경로),
audit 액션 명명(`trigger.chat_channel_bot_token_rotated` 등 3건이 `audit-actions.md` §3 레지스트리와
정확히 일치), Swagger DTO 패턴(`chat-channel-config.dto.ts` 의 `writeOnly`/`readOnly` 가 `swagger.md`
§1-5 의무를 그대로 준수), frontmatter `code:` 블록(YAML 인라인 주석 안 씀 — `spec-impl-evidence.md`
§2.1 이 최근 명문화한 파서 함정 없음) 등 대부분의 축에서 정식 규약을 충실히 따른다. 다만 §3 API 의
`endpointPath` UNIQUE 충돌 서술 한 항목이, 같은 문서·같은 절의 다른 모든 에러 코드 서술과 달리
실제 구현(전역 예외 필터의 범용 `RESOURCE_CONFLICT`, `details` 없음)과 어긋나는 구체적 서브코드·
`details.field` 를 확정적으로 단정한다 — 이 프로젝트가 반복해 경계해 온 "문서한 보장이 구현보다
넓다" 결함 클래스의 사례다. 현재 이를 소비하는 프런트엔드 코드는 없어 즉시 장애로 이어지진
않지만, spec 이 구현의 단일 진실이라는 전제(`spec-impl-evidence.md`) 아래에서는 이후 소비자가
잘못된 계약을 신뢰하고 구현할 위험이 있다.

## 위험도
HIGH
