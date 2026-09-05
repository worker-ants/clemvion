# API 계약(API Contract) 리뷰

## 발견사항

- **[WARNING]** `GET/POST/PATCH /api/schedules`(+`:id`) 응답의 `trigger` 필드가 (버그로 새어나가던) **Trigger 엔티티 전체**에서 4개 참조 필드(`id`/`name`/`workflowId`/`workflow.name`)로 좁혀지는 breaking change다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` — `private toResponse<T extends Schedule>(schedule: T)` (신설, `findAll`/`findOne`/`create`/`update` 4곳에 적용); `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:90-91` (`trigger?: ScheduleTriggerRefDto`)
  - 상세: 종전에는 `leftJoinAndSelect('s.trigger', 't')` / `relations: ['trigger', 'trigger.workflow']` 로 Trigger 엔티티 전체가 응답에 실렸다 — `type`·`config`·`endpointPath`·`authConfigId`·`cronExpression` 뿐 아니라 회전 secret 컬럼(`notificationSecretV2`·`chatChannelTokenV2`)까지 wire 로 나가고 있었다(§5.4 스윕이 검출). 이번 PR 은 응답 경계에서 4필드로 좁힌다 — 보안상 필요한 수정이나, 선언되지 않았을 뿐 실제로 존재하던 필드를 참조하는 소비자가 있었다면 조용히 깨진다. CHANGELOG·RESOLUTION(`review/code/2026/09/05/18_23_02/RESOLUTION.md` W9)에 프런트엔드 소비처 실측(4곳)과 "보안상 되돌릴 사안 아님" 판단이 이미 기록되어 있고, `schedule-trigger.e2e-spec.ts` 가 남아야 할 4필드를 양성으로(`Object.keys(...).sort()`) 고정한다 — 처리 자체는 타당하다. 다만 이 API 를 직접 소비하는 외부/서드파티 클라이언트(응답을 그대로 로깅·캐시·재전송하는 통합)에 대한 검증은 이번에도 범위 밖이며, API 버전 negotiation 체계가 없는 저장소라 이런 breaking change 가 조용히 배포된다는 사실 자체는 남는다.
  - 제안: 조치 완료로 간주(재수정 불요) — 다만 외부 소비자가 있는지 재확인, 있다면 공지·마이그레이션 기간 고려.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` — 프런트엔드 참조가 0곳인 순수 내부 health 카운터가 공개 API 응답에 새로 "선언"(이미 나가고 있었음)된다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `consecutiveNetworkFailures: number` (신설 선언)
  - 상세: 선언 자체는 "이미 나가고 있던 것을 실제에 맞춘다"는 이번 스윕의 원칙에 부합하고, 제거는 wire 변경(파괴적)이라 별도 트래킹이 필요하다는 CHANGELOG 의 판단도 타당하다. 다만 API 계약 관점에서는 내부 구현 카운터가 OpenAPI 공개 스키마에 영구 등재되는 결과이므로, 다음에 이 필드를 지우려면 이번처럼 CHANGELOG 를 동반한 별도 breaking-change PR 이 필요하다는 점을 남긴다.
  - 제안: 조치 불요(추적됨) — 참고 기록.

- **[INFO]** `ExportWorkflowDto.formatVersion` 이 OpenAPI 스키마 상 `required` 로 선언돼 있으나 실제 export 구현은 emit 하지 않아, 공개 계약이 실제 동작보다 넓은 상태가 이번 PR 이후에도 남는다.
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` — `assertMatchesContract(exportRes.body.data, await contractForDto(ExportWorkflowDto), { allowMissing: ['formatVersion'] })`
  - 상세: 이 갭은 이번 PR 이 만든 것이 아니라 `spec/2-navigation/1-workflow-list.md` 에 이미 "Planned" 로 문서화된 기존 결함이며, 새로 도입된 `allowMissing` 옵션으로 계약-검증 e2e 를 통과시키되 갭 자체는 명시적으로 스코프 밖에 두었다(주석·plan 출처 인용 포함). 다만 "공개 OpenAPI 스키마가 항상 존재한다고 선언하는 필드가 실제로는 없을 수 있다"는 사실 자체는 strict 코드젠 클라이언트 입장에서 여전히 유효한 계약 위반이므로 재확인차 기록한다.
  - 제안: 조치 불요(이미 plan 에 추적, `allowMissing` 은 그 갭을 닫을 때 함께 제거하는 것이 완료 조건으로 명시됨).

- **[정보/양호]** 응답 검증 인프라(`response-contract.ts`)의 `allowMissing` 신규 옵션 설계가 계약 완화 오남용을 구조적으로 제한한다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `ContractCheckOptions.allowMissing`
  - 상세: `allowUndeclared`(응답에 더 있어도 봐준다)의 거울상으로 "문서가 약속한 것을 구현이 아직 안 지킨다"는 더 위험한 방향이라 문서 주석이 "정당한 용례는 spec 본문에 Planned 로 이미 적혀 있는 경우뿐" 이라고 명시적으로 좁혀 두었고, 실제 유일한 호출부(`workflow-crud.e2e-spec.ts`)도 그 규약을 그대로 따른다. `allowMissing`/`allowUndeclared` 는 이름이 정확히 일치할 때만 면제하며 서로의 축을 침범하지 않음을 신규 유닛 테스트가 고정한다.
  - 제안: 없음 — 설계·용례 모두 적절.

- **[정보/양호]** `swagger-dto-contract-guard.ts` 의 신규 §5.4 "금지 조합" 축(`required:false` + `nullable:true`, 응답 DTO 한정)이 이번 PR 이 새로 선언한 필드들과 기존 78건을 정확히 대조해 양방향 래칫으로 고정한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (`findOptionalNullableResponseFields`, `isResponseDtoFile`), `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (`EXPECTED_OPTIONAL_NULLABLE_DRIFT`)
  - 상세: 요청 DTO(`/dto/responses/` 경로가 아닌)는 명시적으로 제외해 PATCH 부분 업데이트의 tri-state(키 생략/`null`/값) 의미를 침해하지 않는다. 이번 PR 이 새로 선언한 응답 필드들은 전부 기본형(`@ApiProperty` + 컬럼 nullable 이면 `nullable:true`, 상시 부재 가능이면 `@ApiPropertyOptional()`+`| null` 없음)을 따라 이 금지 조합에 걸리지 않는다 — `swagger-dto-contract.spec.ts` 를 실측(grep)해 확인.
  - 제안: 없음 — 긍정적 관찰.

## 요약

이번 변경은 새 breaking API 를 도입하는 기능 추가가 아니라, §5.4 응답-계약 스윕이 실측으로 드러낸 실제 결함(트리거 회전 secret 두 컬럼의 wire 유출, `GET /api/schedules` 조인을 통한 같은 secret 재유출, 5개 DTO 의 선언-실제 불일치)을 바로잡는 교정 PR 이다. 유일한 실질 breaking change 는 `schedule.trigger` 응답을 엔티티 전체에서 참조 4필드로 좁힌 것인데, 이는 보안상 필요했고 프런트엔드 소비 필드와 정확히 일치함이 실측·e2e 로 고정되었으며 CHANGELOG 에 영향 범위가 명시돼 있어 잔여 위험은 낮다(외부 서드파티 소비자 존재 여부만 검증 범위 밖으로 남는다). 신규 선언 23개 필드는 전부 `@ApiPropertyOptional`/nullable 기본형이라 하위 호환을 깨지 않으며, 새로 도입된 응답-DTO 전수 "금지 조합" 래칫이 같은 결함 클래스의 재발을 구조적으로 막는다. 에러 응답 형식·HTTP 상태 코드·요청 검증·URL 설계·페이지네이션·인증/인가는 이번 변경으로 영향받지 않는다. `ExportWorkflowDto.formatVersion`·`consecutiveNetworkFailures` 노출처럼 이미 추적 중인 경미한 갭만 참고 기록으로 남긴다.

## 위험도

LOW
