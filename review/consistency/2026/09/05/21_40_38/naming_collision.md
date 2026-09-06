# 신규 식별자 충돌 검토

## 검토 범위 및 방법

- `--impl-done` 모드, scope 는 `spec/5-system/` 이지만 **해당 spec 영역의 델타는 0개 파일**(코드 전용 PR). 델타 0은 정상이며 그 자체로 CRITICAL 사유가 아니다.
- prompt 번들에 diff 본문이 예산으로 잘려 있었으므로, 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서 `git diff origin/main -- codebase/` 로 실제 구현 diff(29개 파일, 1698줄)를 직접 재확인했다.
- 도입된 모든 신규/변경 식별자(DTO 클래스명·필드명·상수명·함수명·메서드명·파일 경로)를 추출해 저장소 전체(`codebase/`)와 `spec/` 대상으로 grep 대조했다.

## 이 PR 이 도입한 신규 식별자 목록

- DTO 클래스: `ScheduleTriggerWorkflowRefDto`, `ScheduleTriggerRefDto` (신규), `OptionalNullableOffenderFixtureDto` (신규 테스트 fixture)
- DTO 필드 추가(기존 클래스): `AlertRuleDto.{createdBy,lastTriggeredAt}` · `IntegrationDto.{appUrl,mallId,tokenExpiresAt,lastRotatedAt,lastUsedAt,consecutiveNetworkFailures}` · `KnowledgeBaseDto.{documentCount,embeddingModelConfigId,rerankMode,rerankCandidateK,rerankScoreThreshold,rerankConfigId,rerankLlmConfigId}` · `TriggerDto.{chatChannelHealth,chatChannelLastError,chatChannelSetupAt,chatChannelRotatedAt,notificationHealth,notificationLastError,notificationRotatedAt}` · `ScheduleDto.trigger`
- 메서드/함수: `SchedulesController.toResponse`(private, 신규), `TriggersService.sanitizeChatChannelForResponse` → `sanitizeForResponse`(rename), `findOptionalNullableResponseFields`/`isResponseDtoFile`(신규 가드 함수), `contractForDto`(동기 메모이즈 래퍼로 재구현) / `buildContractForDto`(신규 내부 함수)
- 상수: `NOTIFICATION_SIGNING_STRIP_KEYS`, `TRIGGER_RESPONSE_STRIP_COLUMNS`, `EXPECTED_OPTIONAL_NULLABLE_DRIFT`, `RATCHET_FIXTURE`, `contractCache`
- 옵션 필드: `ContractCheckOptions.allowMissing`
- 신규 파일: `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts` (유일한 `new file`)
- endpoint·env var·이벤트명 신규 추가: **없음** — 전부 기존 endpoint(`GET/POST/PATCH /api/schedules`, `GET/POST/PATCH /api/triggers` 등)의 응답 DTO 선언을 실제 wire 형태에 맞추는 작업이고, CHANGELOG 도 이를 "wire 변경 없음"으로 명시한다.

## 발견사항

### INFO — 신규 fixture 파일이 `repo-guards/__tests__/` 의 기존 fixture 명명·배치 컨벤션과 다르다

- target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`
- 기존 사용처: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-fixture.ts`, `engine-error-code-anchor-fixture.ts`, `eslint-unicorn-peer-fixture.ts` — 모두 `__tests__/` 바로 아래 **평면 배치** + `<name>-fixture.ts`(하이픈) 접미사
- 상세: 신규 파일은 (1) `fixtures/dto/responses/` 하위 디렉터리로 중첩되어 있고 (2) 접미사가 `.fixture.ts`(점)로 기존 `-fixture.ts`(하이픈)와 다르다. diff 주석에 따르면 이는 `isResponseDtoFile()` 술어(경로에 `/dto/responses/` 포함 여부로 판정)를 통과시키면서도 실제 스캔 범위(`src/modules`) 밖에 두기 위한 의도적 설계이므로 결함은 아니다. 다만 저장소 전체에서 유일하게 이 배치·접미사 패턴을 쓰는 파일이라, 다음에 유사한 "양성 대조군 fixture" 를 추가하는 사람이 어느 컨벤션(평면 `-fixture.ts` vs 중첩 `fixtures/**/*.fixture.ts`)을 따라야 할지 판단 기준이 없다.
- 제안: 결정을 되돌릴 필요는 없다(경로 제약이 실질적 이유가 있음). 다만 `repo-guards/__tests__/` 상단(또는 `swagger-dto-contract-guard.ts` 주석)에 "fixture 가 특정 경로 술어를 통과해야 하는 경우 `fixtures/<술어 경로>/*.fixture.ts` 로 중첩, 그 외에는 평면 `-fixture.ts`" 같은 한 줄 규칙을 남기면 다음 충돌(두 접미사 스타일이 뒤섞이는 것)을 예방할 수 있다.

### INFO — `ScheduleTriggerRefDto`/`ScheduleTriggerWorkflowRefDto` 가 저장소 최초의 "narrowed reference DTO" 이며 선례 명명 규칙이 없다

- target 신규 식별자: `ScheduleTriggerRefDto`, `ScheduleTriggerWorkflowRefDto` (`codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts`)
- 기존 사용처: 없음 — `grep "RefDto"` 결과 이 두 클래스가 저장소에서 유일한 `*RefDto` 네이밍이다(`RefreshTokenDto`/`RefreshTokenResponseDto` 는 "refresh" 의 약어일 뿐 무관한 이름이라 실질 충돌 아님).
- 상세: 이번 스윕은 조인 응답을 참조 수준으로 좁히는 최초 사례라 명명 규칙이 없다. 실제 충돌은 없지만, 이후 다른 모듈(예: Trigger 응답이 Workflow 를 좁혀 참조하는 경우)이 동일 패턴을 도입할 때 `<Owner><Referenced>RefDto` 접두 방식을 따를지 다른 스타일(`<Referenced>SummaryDto` 등)을 쓸지 정해진 바가 없어 향후 이름이 갈릴 여지가 있다.
- 제안: 조치 불요(현재는 충돌 없음). 이후 두 번째 "narrowed reference DTO" 가 생기면 그 시점에 컨벤션 문서(`spec/conventions/`)에 패턴을 명문화할 것을 권고.

## 요약

이번 PR(§5.4 응답-계약 스윕)이 도입한 식별자(DTO 클래스 2개, DTO 필드 23개, 상수 5개, 함수/메서드 6개, 신규 파일 1개)를 저장소 전체(`codebase/`) 및 `spec/` 전수와 대조한 결과, 기존에 다른 의미로 이미 쓰이고 있는 동일 식별자는 하나도 없었다. 추가된 DTO 필드는 모두 CHANGELOG 가 명시하듯 "이미 wire 로 나가고 있던 값의 뒤늦은 선언"이라 신규 endpoint·이벤트·env var 도입이 아니며, 새로 확인한 필드명(`chatChannelHealth`, `mallId`, `rerankMode` 등)은 `spec/1-data-model.md`·`spec/2-navigation/*`·엔티티 타입(`TriggerChatChannelHealth` 등)의 기존 정의와 철자·의미가 정확히 일치한다. `sanitizeForResponse`(rename) · `toResponse`(신규 private 메서드) · `NOTIFICATION_SIGNING_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`(신규 상수) · `allowMissing`(신규 옵션) 도 저장소 내 유일한 정의이며 동명 이의어가 없다. 발견된 두 건은 모두 INFO 등급의 "선례 부재/컨벤션 미문서화"이며 즉시 조치가 필요한 충돌이 아니다.

## 위험도

NONE
