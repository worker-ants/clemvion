# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `GET/POST/PATCH /api/schedules` 가 응답 경계에서 `trigger` 관계 부재를
  전부 `500 INTERNAL_ERROR` 로 처리하도록 바뀌어, 손상된 행 하나가 **목록 조회 전체**를
  실패시킨다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()`
    (findAll 에서 `page.data.map((s) => this.toResponse(s))` 로 호출)
  - 상세: `Schedule.trigger_id` 는 NOT NULL 1:1 + FK `onDelete: 'CASCADE'` 라 정상 데이터로는
    도달 불가능하다는 근거가 붙어 있고, CHANGELOG·plan 트래커에 "의도된 트레이드오프"로
    명시돼 있다(`review/code/2026/09/06/01_13_50` W3 에서 이미 논의·수용됨). 대안(그 행만
    건너뛰기)은 `ScheduleDto.trigger` 가 §5.4 기본형(`@ApiProperty`, 상시 존재)이라
    선택할 수 없다는 설명도 타당하다. 에러 응답 형식도 `spec/5-system/3-error-handling.md`
    의 고정 문구·`code` 규약과 일치하고, 진단 정보(스케줄 id·조인 구조)는 서버 로그로만
    가고 응답 바디에는 새지 않는 것을 `http-exception.filter.ts` 로 직접 확인했다.
    새로운 취약점은 아니지만, 목록 API 의 가용성이 단일 행 데이터 손상에 전면 결합된다는
    점은 API 계약 관점에서 기록해 둘 가치가 있다.
  - 제안: 조치 불요(이미 근거 문서화·다회 리뷰 완료). 재발 시 "부분 성공 + 문제 행만 표시"
    전략을 재검토할 수 있다는 점만 인지.

- **[INFO]** `ScheduleDto.trigger` / `TriggerDto.workflow` 가 조인된 엔티티 **전체**에서
  참조 2~4필드로 좁혀져, 기존에(의도치 않게) 그 엔티티의 다른 필드를 읽던 클라이언트가
  있었다면 breaking change 다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:70-101`(`toResponse`),
    `codebase/backend/src/modules/triggers/triggers.service.ts`(`narrowWorkflowRef`,
    `sanitizeForResponse`)
  - 상세: CHANGELOG.md 에 소비처 전수 검색 결과(프런트엔드 `lib/api/schedules.ts` 의
    `RawSchedule` 타입이 정확히 남긴 4필드만 사용, `@workflow/sdk` 는 schedule/trigger API
    를 다루지 않음)가 근거로 실려 있고, 원래 노출 대상에는 회전 비밀 컬럼
    (`notificationSecretV2`·`chatChannelTokenV2`)이 섞여 있었으므로 보안 수정 성격이 강하다.
    문서화된 breaking change 로 잘 처리된 사례다.
  - 제안: 조치 불요. 참고용 기록.

- **[INFO]** `ExportWorkflowDto.formatVersion` 은 `required: true` 로 선언돼 있지만 실제
  export 구현이 그 키를 방출하지 않아, 선언과 구현이 어긋난 상태를 `allowMissing` 옵션으로
  런타임 계약 검증에서만 눈감아 준다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (`assertMatchesContract(..., {
    allowMissing: ['formatVersion'] })`), `codebase/backend/src/shared/testing/response-contract.ts`
    (`ContractCheckOptions.allowMissing`)
  - 상세: `spec/2-navigation/1-workflow-list.md` 에 "포맷 버전 협상은 미구현 (Planned)"으로
    이미 문서화된 갭이고, 코드 주석이 "그 갭을 닫는 PR 이 이 줄을 지우는 것이 완료 조건"
    이라고 못 박아 다음 착수자에게 이관 조건까지 남겼다. 다만 `ExportWorkflowDto` 의
    OpenAPI 스키마 자체는 여전히 `formatVersion` 을 required 로 광고하므로, 이 DTO 를
    그대로 소비하는 외부 클라이언트/코드 생성기 입장에서는 존재하지 않는 필드에 의존할
    위험이 남아 있다.
  - 제안: 조치 불요(이번 PR 범위 밖, 추적됨). 갭을 닫을 때 `required: false` 로 낮추거나
    실제로 값을 채우는 두 방법 중 하나로 마무리할 것.

- **[INFO]** `INTERNAL_ERROR` 코드의 에러 메시지 문구가 `GlobalExceptionFilter` 의 두
  기본값(영어)과 `3-error-handling.md`/이번 PR 이 새로 추가한 `schedules.controller.ts`
  의 문구(한국어) 사이에서 세 갈래로 갈린다.
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`
    (`UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE`) vs
    `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()` 의
    `'서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'`
  - 상세: 이 PR 이 만든 drift 는 아니다 — plan 트래커
    (`plan/in-progress/spec-draft-nullable-notation-followups.md`)가 "이 브랜치가 만든
    회귀가 아니다"라며 기존 상태로 명시하고, 필터를 고치면 매핑되지 않은 모든 5xx 문구가
    바뀌어 범위를 넘는다는 이유로 별도 백로그 항목으로만 등재했다. 다만 에러 응답 형식의
    "일관성" 관점에서는 실제 결함이므로 API 계약 리뷰 항목으로도 남긴다.
  - 제안: 조치 불요(이미 별도 항목으로 추적 중). 별도 PR 에서 필터 전역 문구를 정리할 때
    한국어로 통일할 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 소비처가 0곳인
  내부 헬스 카운터인데 이번 스윕으로 공개 응답 DTO 에 정식 선언됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`consecutiveNetworkFailures` 필드)
  - 상세: 이미 응답에 실려 나가고 있던 필드를 "선언을 실제에 맞춘다"는 원칙에 따라 선언만
    보정한 것이라 wire 변경은 아니다. PR 자신의 주석과 plan 트래커가 "제거가 나은 후보지만
    wire 변경이라 별도 항목으로 미룬다"고 스스로 인정하고 있어 은닉된 확장은 아니다. 다만
    API 설계 원칙(내부 구현 세부사항의 불필요한 외부 노출 최소화) 관점에서는 남겨 둔다.
  - 제안: 조치 불요. 별도 트래커 항목에서 제거 여부 결정.

## 요약

이번 변경은 `sweep-response-contract` 스윕의 일환으로, 응답 DTO 선언을 실제 wire 형태에
맞추고(§5.4 검증자 배선 4→18개 DTO), 그 과정에서 발견된 실질적 보안 결함(트리거 회전
secret 이 엔티티 컬럼·`config` JSONB 세 축·스케줄 조인을 통해 총 네 경로로 새고 있던 것)을
고쳤다. API 계약 관점에서는 (1) 필드 추가는 전부 순수 additive 로 하위 호환을 유지하고,
(2) `ScheduleDto.trigger`/`TriggerDto.workflow` 를 엔티티 전체에서 참조 필드로 좁힌
breaking change 는 소비처 전수 검색 근거와 함께 CHANGELOG 에 명시적으로 문서화됐으며,
(3) 신설된 500 에러(스케줄 `trigger` 관계 부재)는 스펙의 고정 에러 코드·문구 규약을
정확히 따르고 진단 정보 누출도 없음을 필터 코드로 직접 확인했고, (4) 목록 API 의
페이지네이션 래퍼(`{ data, pagination }`)는 그대로 유지되며, (5) Swagger 데코레이터
(`@ApiOkWrappedResponse` 등)가 실제 컨트롤러 반환 형태와 일치한다. 발견된 항목은 모두
이미 문서화·추적 중이거나 이번 PR 범위 밖으로 명시적으로 유예된 사안이며, 이번 diff 가
새로 만든 미해결 API 계약 결함은 없다.

## 위험도
LOW
