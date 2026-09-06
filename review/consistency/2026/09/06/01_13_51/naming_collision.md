# 신규 식별자 충돌 검토

## 검토 범위 참고

`spec/5-system/` 의 `origin/main` 대비 **spec 파일 델타는 0개**다 (`git diff origin/main...HEAD -- spec/` 무출력) — 이 브랜치는 §5.4 응답-계약 스윕의 **구현**(DTO 필드 선언 보강, 정적/런타임 검증자 확장, 트리거·스케줄 응답 정화)만 다루고 spec 문서는 건드리지 않았다. 따라서 "신규 spec 식별자"는 없고, 검토는 구현 diff(`git diff origin/main...HEAD -- codebase/ CHANGELOG.md`, 34 files / 1909 insertions)가 도입하는 코드 식별자가 (a) 서로, (b) 이미 읽은 `spec/5-system/1-auth.md`·`2-api-convention.md` 번들 및 저장소 grep 결과와 충돌하는지를 대조했다.

## 발견사항

- **[WARNING]** `TriggerWorkflowRefDto` ↔ `ScheduleTriggerWorkflowRefDto` — 접두어 하나 차이인데 필드 구성이 다르다
  - target 신규 식별자: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` 의 `TriggerWorkflowRefDto { id, name }` 와 `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` 의 `ScheduleTriggerWorkflowRefDto { name }` (신규, 이번 diff 에서 나란히 도입)
  - 기존 사용처: 저장소 전체에서 `RefDto` 접미사를 쓰는 타입은 이 두 개뿐이다(`grep -rl "RefDto" codebase/backend/src/modules` → 두 파일만 매치) — 즉 이번 diff 가 "워크플로우 참조 DTO" 라는 개념을 두 자리에서 거의 같은 이름으로 동시에 만들었다
  - 상세: 이름이 `{Schedule}Trigger{Workflow}RefDto` vs `Trigger{Workflow}RefDto` 로 접두어 `Schedule`/`Trigger` 하나만 다르고, 나머지 `TriggerWorkflowRefDto`/`WorkflowRefDto` 부분이 동일하다. 그런데 실제 필드는 다르다 — 트리거 쪽은 `{id, name}`(화면이 `id` 로 링크를 건다), 스케줄 쪽은 `{name}` 하나뿐(화면이 이름만 표시). 향후 리팩터링·자동완성 과정에서 한쪽을 다른 쪽으로 잘못 치환하면 `id` 가 조용히 사라지거나(트리거→스케줄 방향은 무해) 존재하지 않는 `id` 참조로 컴파일 에러가 날 뿐 아니라, 컴파일 에러가 나지 않는 방향(스케줄→트리거)으로 스왑하면 `id` 필드가 `undefined` 인 채로 API 계약을 깨는 조용한 회귀가 될 수 있다
  - 이미 적용된 완화: 이번 diff 자신이 두 파일 JSDoc 에 "이름이 접두어 하나만 다르므로 한쪽을 다른 쪽으로 갈아 끼우지 말 것"이라고 상호 참조하며 명시했고, 이 혼동 위험은 이미 `review/consistency/2026/09/06/00_48_52` W2 에서 지적되어 반영된 것으로 diff 주석이 밝히고 있다(재발 항목 아님, 알려진 채로 수용된 트레이드오프)
  - 제안: 추가 조치는 불필요해 보이지만, 더 명확히 하려면 스케줄 쪽 이름을 `ScheduleTriggerWorkflowNameRefDto` 처럼 필드 구성을 반영한 이름으로 바꾸는 안을 고려할 수 있다(다만 이미 문서화된 의도적 선택이라 강제 사유는 아님)

## 대조 결과 (충돌 없음으로 판정한 항목)

다음은 점검했지만 실제 충돌로 보지 않은 항목이다(참고용):

- **DTO 신규 필드명 재사용** — `documentCount`(`KnowledgeBaseDto`, 신규)는 이미 `knowledge-base-response.dto.ts` 의 재임베딩/재추출 ack DTO 두 곳과 `KnowledgeBase` 엔티티 컬럼에 동일 의미로 쓰이고 있었다(`grep documentCount codebase/backend/src/modules/knowledge-base` 로 확인) — 같은 개념의 일관된 재사용이지 충돌이 아니다.
- **`createdBy`/`lastUsedAt`/`lastRotatedAt`/`tokenExpiresAt`** — `AlertRuleDto.createdBy`(신규, nullable) 는 `WorkflowDto`/`IntegrationDto`/`WorkflowVersionDto` 의 비-nullable `createdBy` 와 타입이 다르지만, 각 리소스의 생성자 삭제 가능성 차이를 반영한 도메인상 정당한 차이이고 필드 "의미"는 동일하다(생성한 사용자 ID) — 다른 의미로 쓰이는 진짜 충돌이 아니다. `IntegrationDto.lastUsedAt`(신규)도 `AuthConfigDto.lastUsedAt`/`AuthConfigUsageDto.lastUsedAt` 과 동일 의미(마지막 사용 시각)로 일관된다.
- **`sanitizeForResponse`**(`TriggersService`, `sanitizeChatChannelForResponse` 에서 rename) — private 메서드이고 저장소 전체에서 동명 정의가 이 파일 하나뿐이다.
- **`omitKeys`/`narrowWorkflowRef`/`OptionalNullableOffender`/`isResponseDtoFile`/`findOptionalNullableResponseFields`/`expectNarrowedScheduleTriggerRef`** — 모두 저장소 전체에서 단일 정의이고 기존 식별자와 겹치지 않는다.
- **API endpoint / 환경변수 / 이벤트명** — 이번 diff 는 신규 endpoint·env var·webhook/queue/SSE 이벤트를 추가하지 않는다(기존 엔드포인트의 응답 DTO 선언·정화 로직만 변경). `spec/5-system/2-api-convention.md` §5.4 가 이미 문서화한 두 검증자(`swagger-dto-contract-guard.ts`, `response-contract.ts`) 이름과도 diff 의 실제 파일명이 정확히 일치한다.
- **파일 경로** — 신규 파일(`schedule-trigger-ref.ts`, `optional-nullable.fixture.ts`, `schedule-trigger.e2e-spec.ts`)은 각각 `shared/testing/`·`repo-guards/__tests__/fixtures/dto/responses/`·`test/` 의 기존 명명 컨벤션을 따르며 기존 파일과 경로가 겹치지 않는다.

## 요약

이 PR 은 spec 문서를 변경하지 않고(§5-system 델타 0) 코드 레벨에서만 신규 식별자를 도입한다. 검토 결과 진짜 의미 충돌(CRITICAL)은 없었다. 유일하게 주목할 만한 것은 `TriggerWorkflowRefDto`/`ScheduleTriggerWorkflowRefDto` 라는, 접두어 하나 차이지만 필드 구성이 다른 두 신규 DTO 쌍인데, 이는 diff 자신이 이전 리뷰 라운드의 지적(W2)을 반영해 양쪽 JSDoc 에 상호 경고 주석을 남겨 이미 완화한 상태다. 나머지 필드명 재사용(`documentCount`·`createdBy`·`lastUsedAt` 등)은 모두 기존 관행과 일관된 재사용이며 신규 endpoint·env var·이벤트명도 없어 그 축의 충돌 위험은 해당 없음(N/A)이다.

## 위험도

LOW
