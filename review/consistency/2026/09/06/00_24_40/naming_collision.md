# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

- target(`spec/5-system/`) 델타: **0개 파일** — 이 브랜치는 `spec/5-system/` 를 바꾸지 않았다.
  즉 이 검토 관점(target 문서가 "새로 부여하는" 요구사항 ID·엔티티명·endpoint·이벤트명·
  env var·spec 파일 경로)의 대상이 되는 **신규 spec 식별자 자체가 없다**. 이는 코드 전용
  PR 에서 정상이며 그 자체로 결함이 아니다.
- 대신 실제 구현 diff(HEAD 워킹트리, `git diff origin/main`)를 직접 열어, 이번 PR(§5.4
  응답-계약 스윕 후속: `codebase/backend/src/modules/{schedules,triggers,alerts,
  integrations,knowledge-base}/dto/responses/*`, `shared/testing/response-contract.ts`,
  `repo-guards/__tests__/swagger-dto-contract-guard.ts` 등)이 코드 레벨에서 새로 도입한
  식별자들이 기존 사용처와 충돌하는지 점검했다.

## 점검한 신규 식별자와 결과

| 신규 식별자 | 종류 | 도입 위치 | 충돌 여부 |
|---|---|---|---|
| `ScheduleTriggerWorkflowRefDto` | DTO 클래스 | `schedules/dto/responses/schedule-response.dto.ts` | 전역 유일 (grep 1건) — 충돌 없음 |
| `ScheduleTriggerRefDto` | DTO 클래스 | 〃 | 전역 유일 — 충돌 없음 |
| `TriggerWorkflowRefDto` | DTO 클래스 | `triggers/dto/responses/trigger-response.dto.ts` | 전역 유일 — 충돌 없음 |
| `OptionalNullableOffenderFixtureDto` | 테스트 fixture DTO | `repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` (신규 파일) | 전역 유일, API 미노출 — 충돌 없음 |
| `OptionalNullableOffender` | interface | `repo-guards/__tests__/swagger-dto-contract-guard.ts` | 전역 유일 — 충돌 없음 |
| `isResponseDtoFile` / `findOptionalNullableResponseFields` | 함수 | 〃 | 전역 유일 — 충돌 없음 |
| `EXPECTED_OPTIONAL_NULLABLE_DRIFT` | 상수 | `swagger-dto-contract.spec.ts` | 전역 유일 — 충돌 없음 |
| `allowMissing` (ContractCheckOptions 필드) | DTO 옵션 키 | `shared/testing/response-contract.ts` | `allowUndeclared` 의 "거울상"으로 의도적 명명, 기존 옵션과 이름 충돌 없음 |
| `contractCache` / `buildContractForDto` | module 내부 상태·함수 | 〃 | module-private, 전역 유일 — 충돌 없음 |
| `sanitizeForResponse` (← `sanitizeChatChannelForResponse` rename) | private 메서드 | `triggers/triggers.service.ts` | 클래스 범위 private, 전역 grep 결과 참조처(주석 포함) 전부 동일 rename 반영 — 충돌 없음 |
| `omitKeys` / `stripChatChannelSecrets` / `stripInteractionSecrets` / `stripNotificationSigningSecrets` / `deleteSecretColumns` / `narrowWorkflowRef` | module-scope 함수 | 〃 | 파일 내부 전용, 전역 유일 — 충돌 없음 |
| `NOTIFICATION_SIGNING_STRIP_KEYS` / `TRIGGER_RESPONSE_STRIP_COLUMNS` / `INTERACTION_RESPONSE_STRIP_KEYS` | 상수 | 〃 | 전역 유일 — 충돌 없음 |
| `chatChannelHealth`·`chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt`·`notificationHealth`·`notificationLastError`·`notificationRotatedAt`(`TriggerDto`), `appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt`·`consecutiveNetworkFailures`(`IntegrationDto`), `documentCount`·`embeddingModelConfigId`·`rerankMode`·`rerankCandidateK`·`rerankScoreThreshold`·`rerankConfigId`·`rerankLlmConfigId`(`KnowledgeBaseDto`), `createdBy`·`lastTriggeredAt`(`AlertRuleDto`) | DTO 필드 | 각 `dto/responses/*.dto.ts` | 전부 **이미 wire 로 나가고 있던 기존 엔티티 컬럼**을 뒤늦게 선언한 것 — 신규 개념 도입이 아니라 기존 사실의 문서화. 이름은 엔티티 컬럼명과 1:1 대응하므로 다른 의미로 이미 쓰이는 동명 식별자와 충돌하지 않음 |
| `TriggerChatChannelHealth` / `TriggerNotificationHealth` (참조 타입) | 타입 alias | `triggers/entities/trigger.entity.ts` | 이번 diff 로 **변경되지 않음**(diff 0줄) — DTO 가 기존 타입을 참조만 함. 충돌 대상 아님 |

새 API endpoint, 새 webhook/queue/SSE 이벤트명, 새 환경변수, 새 spec 파일 경로는 이번 diff
에 없다(`git diff origin/main --stat` 전수 확인 — 신규 파일은 위 fixture 1개뿐이며 나머지는
기존 파일 수정).

## 발견사항

없음 — CRITICAL/WARNING 등급 충돌 미발견.

- **[INFO]** `ScheduleTriggerWorkflowRefDto`/`ScheduleTriggerRefDto` vs `TriggerWorkflowRefDto` 명명 근접
  - target 신규 식별자: `ScheduleTriggerWorkflowRefDto` (schedules 모듈), `TriggerWorkflowRefDto` (triggers 모듈)
  - 기존 사용처: 충돌 아님 — 두 파일 모두 이번 PR 신규 도입이며 서로 다른 모듈 소유
  - 상세: 둘 다 "트리거에 달린 워크플로우 참조"를 표현하지만 소유 모듈 접두사(`Schedule`/`Trigger`)로 구분되어 있어 실질 충돌은 아니다. 다만 이름이 매우 비슷해(`ScheduleTriggerWorkflowRefDto` vs `TriggerWorkflowRefDto`) 향후 grep/자동완성 시 혼동 가능성이 있다.
  - 제안: 현 상태로 문제 없음(각 DTO 파일 로컬 스코프, 접두사로 소유 모듈이 명확). 추후 두 모듈에서 공유 가능한 형태로 통합할 필요가 생기면 `TriggerRefDto`(공용) 로 리팩터링을 고려할 수 있으나 이번 PR 범위에서 조치 불요.

## 요약

이 PR 은 `spec/5-system/` 를 변경하지 않아(델타 0) 검토 관점이 겨냥하는 "target 문서가 새로 부여하는 spec 식별자"가 존재하지 않는다. 실제 구현 diff(§5.4 응답-계약 스윕 후속 — 5개 응답 DTO 필드 선언 보정, `TriggersService` 시크릿 스트립 로직 확장, `response-contract.ts`/`swagger-dto-contract-guard.ts` 검증자 강화)에서 새로 도입된 클래스명·함수명·상수명·DTO 필드명을 전수 grep 대조한 결과, 기존 코드베이스·spec 어디에서도 다른 의미로 이미 쓰이고 있는 동일 식별자는 발견되지 않았다. 새 API endpoint·이벤트명·환경변수·spec 파일 경로 도입도 없다. `ScheduleTriggerWorkflowRefDto`/`TriggerWorkflowRefDto` 간 명명 근접은 실질 충돌이 아닌 INFO 수준 참고 사항이다.

## 위험도

NONE
