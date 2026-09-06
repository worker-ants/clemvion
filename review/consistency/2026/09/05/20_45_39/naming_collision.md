# 신규 식별자 충돌 검토

## 범위와 방법

- `--impl-done` 모드. scope `spec/5-system/` 의 spec 텍스트 델타는 **0개 파일** — 이 브랜치는
  spec 을 바꾸지 않았다 (정상, 코드 전용 PR).
- 실제 신규 식별자는 구현 diff 에서 나온다. HEAD 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
  `git diff origin/main...HEAD -- codebase/ spec/`(28개 파일) + `CHANGELOG.md` +
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 직접 실행해 신규 식별자를
  추출하고, 각각을 저장소 전수 grep 으로 기존 사용처와 대조했다.
- 이 브랜치는 `origin/main`(`9a9c024a6`) 대비 4개 커밋(`dfb2664af` 트리거 회전 secret 스윕 1차 ·
  `cb17f0870` §5.4 금지-조합 정정 + 래칫 가드 신설 · `f7909a004` 리뷰 산출물 · `a6f582680` 래칫
  양성 대조군 vacuous 수정)을 얹은 상태다. **동일 세션에서 이 diff 는 이미 두 차례
  (`review/consistency/2026/09/05/18_23_03`, `19_08_19`) naming_collision 검토를 거쳤다** — 이번
  라운드는 그 사이 반영된 수정(특히 이전 라운드가 낸 WARNING 의 반영 여부)까지 포함해 재확인한다.

## 발견사항

새 요구사항 ID·새 API endpoint(method+path)·새 webhook/queue/SSE 이벤트명·새 환경변수·config
key·새 spec 파일 경로 — 이 다섯 축에서는 신규 식별자 자체가 없다 (diff 전수 확인: `@Get/@Post/
@Patch/@Delete` 신규 라우트 0건, `process.env.*` 신규 참조 0건, spec 파일 추가·개명 0건,
`git diff --diff-filter=A` 결과 `codebase/backend/src/repo-guards/__tests__/fixtures/dto/
responses/optional-nullable.fixture.ts` 신규 테스트 fixture 1건뿐).

- **[해소 확인] 이전 라운드(`19_08_19`) WARNING — `OPTIONAL_NULLABLE_DRIFT` vs
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 근접 명명 중복 SoT.** 그 라운드는 신규
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(`swagger-dto-contract.spec.ts`, 저장소 전수 78건)와 기존
  `OPTIONAL_NULLABLE_DRIFT`(`execution-response.dto.spec.ts`, `ExecutionDto` 10건)가 완전히
  동일한 10개 대상을 상호 참조 없이 각자 고정해, 한쪽만 상환하면 다른 쪽이 조용히 stale
  해질 위험을 지적했다(제안 (b): 양쪽에 서로를 가리키는 포인터 추가). 코드를 직접 재확인한
  결과 이번 커밋들이 그 제안대로 수정을 반영했다 —
  - `execution-response.dto.spec.ts:62-70` 의 `OPTIONAL_NULLABLE_DRIFT` JSDoc 에 "저장소
    전체 판은 따로 있다 — `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건) 의 부분집합이므로 함께
    줄여야 한다 (`review/consistency/2026/09/05/19_08_19` W5)" 포인터 추가.
  - `swagger-dto-contract.spec.ts` 의 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` JSDoc 에도 "이
    목록은 응답 DTO 전수를 덮는다. `OPTIONAL_NULLABLE_DRIFT`(`ExecutionDto` 10건)는 그
    부분집합이고 ... 함께 줄인다" 역방향 포인터 추가.
  이제 두 상수 이름은 여전히 근접하지만(`OPTIONAL_NULLABLE_DRIFT` / `EXPECTED_OPTIONAL_
  NULLABLE_DRIFT`) 각 정의 지점에 상호 참조·상환 절차가 명시돼 "조용히 stale 해지는" 실질
  위험은 제거됐다고 판단한다. 등급을 낮춰 **INFO** 로만 재기록한다 — 두 이름이 여전히 눈으로
  구분하기 어려운 근접 명명이라는 관찰 자체는 유효하므로, `spec/5-system/2-api-convention.md`
  "검증 층" 절에 "상수 레벨 근접 명명 시 상호 포인터 필수" 한 줄을 정식화해 두면 다음 sweep 이
  같은 패턴을 반복할 때 참고할 근거가 된다 (강제 아님, 제안).

- **[INFO]** 신규 fixture 클래스 `OptionalNullableOffenderFixtureDto`
  (`repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`, 이번 라운드가
  추가로 반영한 vacuous-test 수정 커밋 `a6f582680`에서 도입) — 기존 인터페이스
  `OptionalNullableOffender`(`swagger-dto-contract-guard.ts`)와 이름이 근접하지만 접미사
  `FixtureDto` 로 의도적으로 구분되고, 파일 자체가 "래칫의 스캔 범위(`src/modules`) 밖" 임을
  전용 대조군 테스트(`fixture 는 프로덕션 스캔 범위 밖이다 — 베이스라인 무오염`)로 고정한다.
  저장소 전수 grep 결과 동명 정의처 없음. 충돌 없음.
- **[INFO]** `EXPECTED_OPTIONAL_NULLABLE_DRIFT`·`OptionalNullableOffender`·
  `isResponseDtoFile`·`findOptionalNullableResponseFields`·`RATCHET_FIXTURE` — 전부 grep 결과
  저장소 내 유일 정의처. 기존 다른 의미 사용처 없음.
- **[INFO]** `ContractCheckOptions.allowMissing` 신설 — 기존 `allowUndeclared` 와 이름 대칭
  구조로 설계됐고 `response-contract.spec.ts` 에 "두 축은 갈려 있다" 전용 테스트가 있어 혼동
  방지가 코드에 내장돼 있다. 충돌 없음.
- **[INFO]** `TriggersService.sanitizeChatChannelForResponse` → `sanitizeForResponse` 개명,
  `SchedulesController.toResponse` 신설 — 둘 다 `private` 메서드라 클래스 경계 밖에서 이름이
  부딪히지 않고, `ExecutionsService.toResponseExecution` 과도 문자열이 달라 정확한 충돌은
  아니다. "응답 경계에서 엔티티를 변환한다"는 동일 패턴이 서비스마다 다른 이름
  (`sanitizeForResponse`/`toResponse`/`toResponseExecution`)으로 반복되는 것은 여전히 유효한
  관찰이나 충돌은 아니라서 INFO 유지.
- **[INFO]** `TRIGGER_RESPONSE_STRIP_COLUMNS`(엔티티 컬럼 스트립) · `NOTIFICATION_SIGNING_
  STRIP_KEYS`(`config.notification.signing` 안의 키 스트립, 이번 라운드가 새로 발견한 목록 —
  이전 두 라운드 리포트에는 없었다) — 기존 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`(`config.
  chatChannel` 안의 키)와 이름·역할이 명확히 분리돼 있고, JSDoc 이 "같은 등급의 비밀이 세
  곳에 산다"고 세 상수의 관계를 명시적으로 적어 둔다. 저장소 전수 grep 결과 동명 다른 의미
  사용처 없음. 충돌 없음.
- **[INFO]** 신규 DTO 필드 (`IntegrationDto.appUrl/mallId/tokenExpiresAt/lastRotatedAt/
  lastUsedAt/consecutiveNetworkFailures`, `KnowledgeBaseDto.documentCount/
  embeddingModelConfigId/rerankMode/rerankCandidateK/rerankScoreThreshold/rerankConfigId/
  rerankLlmConfigId`, `AlertRuleDto.createdBy/lastTriggeredAt`, `TriggerDto` 의
  `chatChannelHealth/chatChannelLastError/chatChannelSetupAt/chatChannelRotatedAt/
  notificationHealth/notificationLastError/notificationRotatedAt`) — 전수 grep 결과 모두
  대응 엔티티 컬럼명과 정확히 일치하고 의미도 동일하다(`createdBy` 는 `integration`·
  `workflow`·`workflow-version` 엔티티에서 이미 "생성자 user id" 로 쓰이는 것과 동일 의미).
  새 의미로 기존 식별자를 재사용한 사례 없음.
- **[INFO]** 신규 DTO 클래스 `ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto` —
  코드베이스 전체에 `*RefDto` 명명 패턴이 이전에 없었다(최초 도입). 기존 정의와 충돌 없음.
  `ScheduleDto.trigger` 필드도 다른 응답 DTO 에 동명 필드가 없어 형태 충돌 없음.
- **[INFO]** `contractForDto` 는 기존 공개 함수를 메모이즈 캐싱 래퍼로 바꾸고 내부에
  `buildContractForDto`(신규, 비공개)·`contractCache`(모듈 스코프 `Map`, 신규)를 분리했다 —
  공개 API 시그니처(`contractForDto(Dto)`)는 그대로라 호출부 영향 없고, 신규 식별자 둘 다
  grep 상 유일 정의처.

## 그 외 점검 관점별 결과 (충돌 없음)

- **요구사항 ID**: 신규 ID 없음 (spec 델타 0).
- **API endpoint**: 신규 endpoint 없음 — 기존 `GET/POST/PATCH /api/schedules*`,
  `/api/triggers*`, `/api/integrations*`, `/api/knowledge-bases*`, `/api/alerts*` 의 **응답
  필드**만 확장. method+path 신규 등록 0건.
- **이벤트/메시지명**: 신규 webhook·queue·SSE 이벤트 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로**: 신규 파일은 테스트 fixture 1개(`repo-guards/__tests__/fixtures/dto/
  responses/optional-nullable.fixture.ts`)뿐 — 형제 파일들의 `dto/responses/*.fixture.ts`
  명명 컨벤션과 일치하고, 스캔 범위 밖(`repo-guards/`)에 있어 프로덕션 명명 공간과 겹치지
  않는다. 충돌 없음.

## 요약

이 브랜치는 `spec/5-system/` 을 건드리지 않는 코드 전용 sweep(§5.4 응답-계약 검증자 배선
확대 + 트리거 회전 secret 유출 수정 + §5.4 금지-조합 정정 + 래칫 가드 신설 + 그 가드의
vacuous 대조군 수정)이라, 요구사항 ID·API endpoint·이벤트명·환경변수·spec 파일 경로 축에서는
신규 식별자 충돌이 없다. 동일 세션의 두 선행 naming_collision 검토(`18_23_03`, `19_08_19`)가
이미 이 diff 계열을 전수 대조했고, 유일하게 남았던 WARNING(`OPTIONAL_NULLABLE_DRIFT` vs
`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 근접 명명 중복 SoT)은 이번 라운드가 반영한 커밋에서 양쪽
JSDoc 에 상호 포인터를 추가하는 것으로 해소됐음을 코드에서 직접 확인했다. 이번 라운드가 새로
포함하는 커밋(`a6f582680`, 래칫 양성 대조군 fixture 교체)이 도입한 신규 식별자(`Optional
NullableOffenderFixtureDto` 등)도 전수 대조 결과 충돌이 없다. 남는 것은 전부 INFO 수준의
명명 일관성 관찰(응답 경계 변환 헬퍼가 서비스마다 다른 이름을 쓰는 것, 근접한 두 drift 상수
이름)이며 기능적·계약적 충돌은 없다.

## 위험도

NONE
