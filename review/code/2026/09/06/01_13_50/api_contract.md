# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 가 프런트엔드 소비 0곳인 내부 카운터임에도 공개 응답 계약에 선언됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`IntegrationDto.consecutiveNetworkFailures` 필드, PR diff 게이트 160~167줄)
  - 상세: 필드 자신의 JSDoc 이 "프런트엔드 참조가 0곳이라 유일하게 소비되지 않는 필드" 라고 인정하며, 제거는 wire 변경(breaking)이라 별도 항목으로 미룬다고 명시한다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에도 후속 항목으로 등재돼 있어 은닉된 확장이 아니라 판단이 문서화된 상태다. API 계약 관점에서는 "필요 이상으로 넓은 응답 표면(over-exposure)" 이 남아 있다는 사실만 재확인해 둔다 — 내부 헬스 카운터를 공개 계약에 상시 노출하는 것은 향후 그 값의 의미·계산 방식을 바꿀 때도 wire 호환성을 신경 써야 한다는 부채를 남긴다.
  - 제안: 조치 불요(이미 트래커에 등재·유예 사유 명시). 다음에 이 필드를 손댈 때 제거 여부를 다시 검토할 것.

- **[INFO]** `IntegrationDto.appUrl` 이 URL 문자열 필드인데 `format: 'uri'` 없이 `type: String` 만 선언한다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`IntegrationDto.appUrl`, PR diff 게이트 140~141줄)
  - 상세: 같은 파일의 다른 URL 성격 필드들과 비교했을 때 OpenAPI 스키마 완성도 측면에서 `format: 'uri'` 를 붙이면 스키마 소비자(코드젠·문서 뷰어)에게 더 정확한 힌트가 된다. 기능적 결함은 아니며 `nullable: true`·`example: null` 등 §5.4 기본형 요건은 정확히 충족한다.
  - 제안: 사소하므로 이번 PR을 막을 사유는 아니다. 다음 편집 시 `format: 'uri'` 추가를 고려.

## 확인 사항 (문제 없음 — 근거 기록)

- **하위 호환성**: `ScheduleDto.trigger` / `TriggerDto.workflow` 를 엔티티 전체에서 참조 수준(`id`/`name`/`workflowId`(+`workflow.name`) 등)으로 좁힌 것은 wire 상 필드 제거를 수반하는 breaking change다. 다만 CHANGELOG.md 에 영향 범위(내부 FE `lib/api/schedules.ts` `RawSchedule` 단일 소비처, 배포되는 `@workflow/sdk` 는 schedule API 미사용)를 실측 근거와 함께 명시했고, 3라운드에 걸쳐 이미 처분됐다(`review/code/2026/09/05/21_40_37` RESOLUTION #7, `22_24_58` RESOLUTION #4). 나머지 24개 필드 추가(`createdBy`·`lastTriggeredAt`·`appUrl`·`mallId`·`documentCount`·`chatChannelHealth` 등)는 "이미 wire 에 실려 나가고 있던 값의 선언 보정" 이라 실제 wire 변경이 없다 — 순수 가산적(additive) 문서화다.
- **에러 응답**: `SchedulesController.toResponse` 가 신설한 `InternalServerErrorException({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' })` 는 `spec/5-system/3-error-handling.md` 의 `INTERNAL_ERROR` 행에 적힌 고정 문구와 글자 그대로 일치하고, `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`)가 `HttpException.getResponse()` 의 `code`/`message` 를 표준 봉투 `{ error: { code, message, requestId } }` 로 정확히 감싼다 — 기존 에러 응답 계약과 일관된다. 컨트롤러 unit 테스트가 진단 문자열(스케줄 ID·조인 구조)이 응답 바디로 새지 않는 것까지 직렬화 전체를 검사해 CWE-209 재발을 막는다.
- **응답 형식/스키마 준수**: `swagger-dto-contract-guard.ts` 에 신설된 `findOptionalNullableResponseFields`(§5.4 금지 조합 `required:false`+`nullable:true` 래칫)와 기존 undeclared-key 검증자가 응답 DTO 전수(현재 78건 drift 고정)를 대조하고, `response-contract.ts` 의 `assertMatchesContract`/`contractForDto` 가 e2e 14개 엔드포인트에 실제 wire 응답 대 DTO 선언을 실측 대조로 배선됐다. `allowMissing` 옵션은 "spec 본문에 Planned 로 이미 적힌 갭" 으로 용례가 좁게 제한돼 있고(`workflow-crud.e2e-spec.ts` 의 `formatVersion` 이 유일한 사용처, 출처 주석 포함) 남용 여지가 낮다.
- **버전 관리/URL 설계/페이지네이션/인증인가**: 이번 변경은 기존 엔드포인트의 응답 DTO 선언·정화 로직·테스트 배선에 한정되며 신규 엔드포인트·URL 경로 변경·페이지네이션 로직 변경·인증/인가 가드 변경이 없다. `Roles('editor')` 등 기존 가드는 그대로 유지된다.

## 요약

이 변경 묶음은 §5.4 응답-계약 검증자를 4→18개 DTO로 넓히면서 실측으로 드러난 트리거 회전 secret(엔티티 컬럼 미스트립 + 조인을 통한 2차 유출)을 스케줄·트리거 두 응답 경계에서 참조 수준으로 좁혀 막고, 그 과정에서 발견된 "응답에는 있는데 DTO가 선언하지 않은" 24개 필드를 실제 wire에 맞춰 문서화한 것이다. `ScheduleDto.trigger`/`TriggerDto.workflow` 축소는 wire 상 breaking change이지만 CHANGELOG에 영향 범위·근거(단일 FE 소비처, SDK 미사용)를 실측으로 남겼고 이미 여러 라운드의 리뷰에서 breaking-change 항목으로 명시적으로 처분됐다. 신설된 500 에러 경로는 `3-error-handling.md`의 고정 문구·표준 에러 봉투와 정확히 일치하며 진단 정보 누출(CWE-209)도 unit 테스트로 방어된다. 정적 래칫(§5.4 금지 조합) + 런타임 계약 대조(`assertMatchesContract`) 이중 방어가 응답 스키마 드리프트 재발을 구조적으로 막는다. 남은 것은 이미 트래커에 등재된 `consecutiveNetworkFailures` 내부 필드 노출(INFO)과 `appUrl` 의 `format:'uri'` 누락(INFO) 정도로, API 계약 관점에서 이 PR을 막을 사유가 없다.

## 위험도
LOW
