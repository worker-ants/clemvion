# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `ScheduleDto.trigger` 를 (전체 `Trigger` 엔티티가 새던 상태에서) 4필드 참조
  (`id`·`name`·`workflowId`·`workflow.name`)로 좁힌 것은 `GET/POST/PATCH /api/schedules`
  응답의 하위 호환성 파괴다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()`
    (67-84행), `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`
    `ScheduleTriggerRefDto`(21-50행) 및 `ScheduleDto.trigger`(98-111행)
  - 상세: 이전에는 트리거 엔티티 전 컬럼(비밀 컬럼 포함)이 새고 있었으므로, 그 필드들에
    의존하던 클라이언트가 있었다면 이번 변경으로 조용히 `undefined` 를 받게 된다. 다만 (1)
    이 프로젝트는 API 버전 관리 스킴이 없고(`spec/5-system/2-api-convention.md` 에도 버전
    prefix 규정 없음) breaking change 는 CHANGELOG 고지로만 다루는 것이 기존 컨벤션이며
    (`CHANGELOG.md` 안에 동일 패턴의 "breaking" 항목이 다수 선례로 존재), (2) 이번 축소가
    보안 결함(회전 secret 유출) 수정의 부수효과이고 CHANGELOG 최상단 항목에 영향 범위·권고
    조치까지 상세히 문서화돼 있으며, (3) 유일하게 실제 참조하는 소비처가 사내 프런트엔드
    (`schedules/page.tsx`) 뿐임을 코드 주석·CHANGELOG 양쪽에서 확인했다. 즉 컨벤션 안에서
    처리된 breaking change 이지 이번 PR 이 새로 만든 절차 공백은 아니다.
  - 제안: 조치 불요. 외부(서드파티) API 소비자가 향후 생기면 이 CHANGELOG-only 고지 방식이
    충분한지 재검토할 것.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 응답에 항상 존재하는 내부 카운터인데
  프런트엔드 소비처가 0곳이다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:160-161`
  - 상세: PR 자신의 주석과 CHANGELOG 가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로
    미룬다" 고 명시하고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 에도
    후속 항목으로 등재돼 있다. 최소 노출(불필요한 내부 정보 노출 축소) 관점에서는 아쉽지만,
    스코프 판단이 스스로 문서화돼 있어 은닉된 확장이 아니다.
  - 제안: 조치 불요(이미 트래커에 등재).

- **[INFO]** 응답-계약 이중 검증자(`response-contract.ts` 런타임 값 대조 + `swagger-dto-contract-guard.ts`
  정적 선언 대조, 이번 PR 이 신설한 `required:false`+`nullable:true` 금지-조합 3번째 축 포함)는
  이 리뷰 관점("응답 형식의 일관성·스키마 준수")이 요구하는 것을 정확히 구현한 인프라다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts`,
    `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts`
  - 상세: 두 검증자의 경계(런타임 값 vs 선언 대 선언)가 각 파일 JSDoc 과
    `spec/5-system/2-api-convention.md#검증-층` 양쪽에 명시돼 있어 향후 확장 시 어느 층에
    추가해야 할지 판단 기준이 남는다. 신규 응답 DTO 필드(`TriggerDto`·`IntegrationDto`·
    `KnowledgeBaseDto`·`AlertRuleDto`·`ScheduleDto`) 24개는 전부 §5.4 "기본형"
    (`@ApiProperty` + 컬럼이 nullable 이면 `nullable: true`)으로 일관되게 선언돼 있고, 요청
    바디 전용인 "키 생략형 + nullable" 금지 조합이 응답 DTO에 섞이지 않았음을 직접 대조로
    확인했다.
  - 제안: 조치 불요. 참고용 관찰.

- **[INFO]** `TriggersService.update()` 가 `Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))`
  로 `rest` 를 필터링해, `useDefineForClassFields`(ES2023 타깃) 때문에 optional 필드가
  `undefined` own-property 로 존재해 로드된 값을 덮어쓰던 결함(예: PATCH 응답에서 `name` 이
  사라짐)을 고쳤다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()` (약 385-395행)
  - 상세: 요청 DTO 의 tri-state 계약(키 생략=불변·`null`=초기화·값=설정, §5.4)과 이 필터가
    상충하지 않는지 확인했다 — 필터는 `undefined` 만 제거하고 명시적 `null` 은 그대로
    통과시키므로, PATCH 의 "null 로 초기화" 의미가 보존된다. 요청 검증(§5) 관점에서 부작용
    없음을 확인.
  - 제안: 조치 불요.

## 요약

이번 diff 는 트리거 회전 secret(`notificationSecretV2`·`chatChannelTokenV2`) 이 `GET/POST/PATCH
/api/triggers` 와 `GET/POST/PATCH /api/schedules`(조인 경로) 두 곳으로 새던 보안 결함을
응답 경계(서비스 `sanitizeForResponse` + 컨트롤러 `toResponse`)에서 막고, §5.4 응답-계약
스윕이 실측으로 찾아낸 "응답에는 있는데 선언에 없던" 24개 필드를 5개 DTO 에 정확히 반영하는
작업이다(wire 변경 없음, 문서만 실제에 맞춤). 신규 필드 선언은 전부 §5.4 의 required+nullable
기본형을 일관되게 따르고, 요청 바디 전용인 "키 생략형+nullable" 금지 조합이 응답 DTO 에
새로 섞이지 않았음을 직접 확인했다. 유일한 실질적 하위 호환성 파괴(`ScheduleDto.trigger` 축소)는
보안 수정의 불가피한 부수효과이며 CHANGELOG 에 영향 범위·소비처·권고 조치까지 상세히
문서화돼 있고, 이 프로젝트의 기존 breaking-change 처리 컨벤션(버전 없는 REST + CHANGELOG
고지)과 일치한다. 에러 응답 형식·인증/인가·URL 설계·페이지네이션은 이번 PR 범위에서 변경되지
않았고 기존 컨벤션(`ApiOkPaginatedResponse`, `@Roles`, `@ApiUnauthorizedResponse` 등)을
그대로 따른다. 요청 검증(request DTO)도 이번 PR 에서 변경되지 않았다. Critical/Warning 급
API 계약 결함은 발견되지 않았다 — 이미 5라운드에 걸친 이전 코드/일관성 리뷰가 회전 secret
유출, undeclared 필드, PATCH 응답 필드 소실, 응답 형태가 요청 값(`isActive`)에 따라 갈리던
문제 등을 모두 잡아 수정을 확인했고, 이번 독립 검토에서도 재발이나 신규 결함을 찾지 못했다.

## 위험도

LOW
