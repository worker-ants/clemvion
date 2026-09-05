# Rationale 연속성 검토

## 검토 범위

- Target: `spec/5-system/` (`--impl-done`, diff-base `origin/main`)
- scope(`spec/5-system`) 델타: 0개 파일 (spec 자체는 변경 없음 — 코드 전용 PR 이라 정상)
- 실제 구현 diff: 25개 파일 / 560+ 줄 — 프롬프트 번들이 diff 본문을 예산 절단했으므로
  HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
  `git diff origin/main...HEAD` 를 직접 실행해 diff·엔티티·컨트롤러·기존 회귀 가드
  (`execution-response.dto.spec.ts`)를 확보한 뒤 검토했다.
- 커밋: `dfb2664af` "트리거 회전 secret 이 두 경로로 나가고 있었다 — §5.4 스윕 1차"
  (직전 커밋 `f5d97aa39` #1288 의 후속).

## 발견사항

- **[CRITICAL]** §5.4 가 응답 바디에서 명시적으로 **금지**하는 `Optional + nullable`
  조합이 17개 신규 필드·5개 DTO 에 재도입됨
  - target 위치:
    - `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` —
      `chatChannelLastError`·`chatChannelSetupAt`·`chatChannelRotatedAt`·
      `notificationLastError`·`notificationRotatedAt` (5개)
    - `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` —
      `appUrl`·`mallId`·`tokenExpiresAt`·`lastRotatedAt`·`lastUsedAt` (5개)
    - `codebase/backend/src/modules/knowledge-base/dto/responses/knowledge-base-response.dto.ts` —
      `embeddingModelConfigId`·`rerankScoreThreshold`·`rerankConfigId`·`rerankLlmConfigId` (4개)
    - `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` —
      `createdBy`·`lastTriggeredAt` (2개)
    - `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` —
      `ScheduleDto.trigger` (`ScheduleTriggerRefDto | null`, 1개)
    - 전부 `@ApiPropertyOptional({ nullable: true, ... })` + `field?: T | null` 형태로
      선언됐다 (diff 확인 — 예: `trigger-response.dto.ts` `chatChannelLastError?: string | null;`,
      `integration-response.dto.ts` `appUrl?: string | null;` 등).
  - 과거 결정 출처: **`spec/5-system/2-api-convention.md` §5.4** 본문의 DTO 선언 매핑
    표 — *"키를 생략하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` **금지**)"*
    / *"`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable: true })` + `field: T | null`"*.
    이 규칙은 코드에도 그대로 이식돼 있다 —
    `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.spec.ts`
    (§5.4 회귀 가드)가 `@ApiPropertyOptional({ nullable: true })` 조합을 문자 그대로
    *"**§5.4 가 응답 바디에서 금지하는 조합**"* 이라 주석에 명시하고, 기존 10개
    (`chainId`·`durationMs`·`error`·`executedBy`·`finishedAt`·`inputData`·`outputData`·
    `parentExecutionId`·`reRunOf`·`triggerId`)를 `OPTIONAL_NULLABLE_DRIFT` 로 이름 붙여
    "**고치는 것이 아니라 고정한다**" — 즉 이 조합은 이미 있는 10건만 동결 대상이고
    **더 늘려도 되는 패턴이 아니다**라고 명시적으로 선언해 뒀다. 직전 리뷰
    (`review/consistency/2026/09/05/15_53_59/rationale_continuity.md`)도 이 동결 범위를
    "spec 이 정한 소급 예외 범위 안"이라고 승인한 바 있다.
  - 상세: 다섯 DTO 를 각각 확인한 결과, 위 17개 필드는 전부 **엔티티 컬럼(또는 항상
    할당되는 파생 필드)이라 wire 에서 키가 결코 생략되지 않는다** — §5.4 표가 정한
    "present-when-available"(키 생략) 대상이 아니라 "상시 존재 + 값만 null 가능" 대상이다.
    - `Trigger` 엔티티: `chat_channel_last_error`/`chat_channel_setup_at`/
      `chat_channel_rotated_at`/`notification_last_error`/`notification_rotated_at` 모두
      `nullable: true` 컬럼(값만 null)이며 트리거 타입과 무관하게 모든 row 에 존재한다.
      (참고 — 같은 엔티티의 `chatChannelHealth`/`notificationHealth` 는 `default: 'unknown'`
      **non-null** 컬럼인데도 `@ApiPropertyOptional()`(키 생략형, `| null` 없음)로
      선언돼 있다 — 이쪽은 §5.4 의 "금지 조합"은 아니지만 항상 존재하는 필드를 선택적으로
      과소 선언한 것이라 같은 성격의 인접 결함이다.)
    - `Integration.toPublic()`: `appUrl`(파생)은 두 반환 분기(`credsUnreadable` 여부와
      무관) 모두에서 항상 key 로 할당되고, `mallId`/`tokenExpiresAt`/`lastRotatedAt`/
      `lastUsedAt` 은 `sanitizedEntity` spread 로 항상 실린다 (엔티티 컬럼, `nullable: true`).
    - `KnowledgeBase` 엔티티: `embedding_model_config_id`/`rerank_config_id`/
      `rerank_score_threshold`/`rerank_llm_config_id` 전부 `nullable: true` **컬럼**(컨트롤러가
      엔티티 그대로 반환).
    - `AlertRule` 엔티티: `last_triggered_at`/`created_by` 도 `nullable: true` 컬럼.
    - `Schedule` 엔티티: `trigger_id`(FK) 는 **non-nullable** — 스케줄은 도메인상 항상
      정확히 하나의 트리거를 갖는다. `findAll`/`findById` 양쪽 모두 `relations`/
      `leftJoinAndSelect` 로 트리거를 항상 로드한다. 즉 `trigger` 키가 응답에서 빠지는
      경로가 현재 코드에는 없어 보이는데도, DTO 주석은 *"조회 경로에 따라 없을 수 있다"*
      며 optional 로 선언했다 — 실측 없이 방어적으로 느슨하게 잡은 것으로 보인다.
    - 세 검증 층(§5.4 자신이 표로 나열한 `swagger-dto-contract-guard`(선언↔선언
      self-consistency 만 봄) · `response-contract.ts`(값↔선언, 느슨한 선언은 절대
      위반으로 안 잡음) · `execution-response.dto.spec.ts` 류 스키마-형태 회귀 가드(이번
      5개 DTO 에는 신설되지 않음)) **어느 것도 이 위반을 잡지 못한다** — §5.4 문서 자신이
      "그래서 두 검증자가 있다"고 설명하는 바로 그 사각지대를, 이번 diff 가 §5.4 준수를
      명목으로 내건 PR 안에서 정확히 재현했다.
  - 제안: 17개 필드 각각에 대해 실제로 키가 생략되는 호출 경로가 있는지 재확인한다.
    (본 검토에서 확인한 한) 전부 항상 존재하므로 `@ApiPropertyOptional({ nullable: true })`
    를 `@ApiProperty({ nullable: true })` + `field: T | null` (`?` 제거)로 정정하는 것이
    맞다. 만약 정말 생략되는 경로가 있다면 그 근거(§5.4 기준 (a)/(b))를 필드별 주석/spec
    에 명시한다. 어느 쪽이든, `execution-response.dto.spec.ts` 패턴처럼 이번 5개 DTO 에도
    OpenAPI 스키마 형태 회귀 가드를 신설해 앞으로 이 "금지 조합" 이 §5.4 인용만으로
    조용히 통과하는 일을 막는다. `chatChannelHealth`/`notificationHealth`/`documentCount`/
    `rerankMode`/`rerankCandidateK` (Optional·non-nullable, 항상 존재) 도 같은 이유로
    `@ApiProperty()`(required) 로 좁히는 것을 함께 검토한다.

## 그 밖에 확인했으나 연속성 위반이 아닌 것 (참고)

- `TriggersService.sanitizeChatChannelForResponse → sanitizeForResponse` 로 넓혀
  엔티티 컬럼(`notificationSecretV2`/`chatChannelTokenV2`) 도 스트립하고 조기 return 을
  제거한 보안 수정은, 직전 커밋(#1288)이 확립한 "엔티티 그대로 반환 시 select:false 는
  fail-silent 위험이 있어 응답 경계에서 stripping" 패턴을 그대로 따른 것이며 그 근거를
  코드 주석에 재인용했다 — 반전이 아니라 연장.
- `contractForDto` 에 캐시를 넣어 "매 호출마다 `beforeAll` 변수를 만들라"는 종전 JSDoc
  지침을 대체한 것은 spec `## Rationale` 항목이 아니라 코드 내부 구현 편의 문서였고,
  하위 호환 개선이라 반전으로 보지 않는다.
- `allowMissing` 옵션 신설은 `ExportWorkflowDto.formatVersion` 처럼 **실제로
  `spec/2-navigation/1-workflow-list.md`("포맷 버전 협상은 미구현 (Planned)")에 이미
  적힌 갭**만을 표현하도록 설계·테스트(vacuous 방지 캐너리 포함)돼 있어, "선례 없는 근거
  소급 부여" 패턴이 아니다 — 인용을 spec 원문과 대조해 정확함을 확인했다.
- 24개 필드를 "이미 나가고 있었으니 선언만 맞춘다"고 처리한 전반적 접근 자체는, 직전
  리뷰가 이미 승인한 "§5.4 가 정한 소급 예외(이미 존재하던 wire 를 뒤늦게 선언·고정·추적)"
  범위 안의 패턴이다 — 문제는 그 "선언"이 §5.4 가 명시적으로 금지하는 조합을 새로
  택했다는, 위 CRITICAL 항목의 좁은 지점뿐이다.

## 요약

이번 diff 는 트리거 회전 secret 유출이라는 실제 보안 결함을 정확히 짚어 고치고, §5.4
검증 인프라를 4→18개 DTO 로 확장하는 성실한 후속 작업이다. 다만 그 스윕이 "선언을 실제에
맞춘다"며 새로 추가한 17개 필드 선언이 하나같이 `@ApiPropertyOptional({ nullable: true })`
형태를 택했는데, 이는 `spec/5-system/2-api-convention.md §5.4` 본문이 문자 그대로 금지하고
코드의 기존 회귀 가드(`execution-response.dto.spec.ts`, `OPTIONAL_NULLABLE_DRIFT`)가 "10건
동결, 확대 금지"로 명시해 둔 바로 그 조합이다. 두 개의 기존 검증 층 어느 쪽도 이 위반을
탐지하지 못하는 사각지대이므로, §5.4 준수를 표방하는 이번 PR 이 §5.4 를 어기는 새 사례를
그 사각지대 안에 조용히 늘렸다는 점이 이번 검토의 핵심 지적이다.

## 위험도

CRITICAL
