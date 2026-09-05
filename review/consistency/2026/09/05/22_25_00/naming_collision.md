# 신규 식별자 충돌 검토

## 범위와 방법

- `--impl-done` 모드, scope `spec/5-system/`. 해당 spec 영역의 텍스트 델타는 **0개 파일** —
  이 브랜치는 spec 을 바꾸지 않는 코드 전용 PR 이다 (정상, CRITICAL 사유 아님).
- prompt 번들의 diff 본문은 예산 초과로 절단돼 있었으므로, HEAD 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/sweep-response-contract-5ba0ad`)에서
  `git diff origin/main...HEAD`(120개 파일, `review/`·`CHANGELOG.md`·`plan/` 포함, 순수
  `codebase/` 는 30개 파일 / 1857줄)를 직접 실행해 신규 식별자를 전수 추출했다.
- `git log --oneline origin/main..HEAD` 로 7개 커밋을 확인했고, 그중 최신 2개
  (`67881bbd4`, `7e85da873`)는 이 세션의 직전 naming_collision 라운드(`21_40_38`) **이후**
  추가된 커밋이라 그 내용까지 diff 로 직접 재확인했다 (`TriggerWorkflowRefDto` 도입 포함).
- 도입된 모든 신규/변경 식별자(DTO 클래스명·필드명·상수명·함수명·메서드명·옵션 필드·파일
  경로)를 저장소 전체(`codebase/`)에 대해 grep 전수 대조했다.

## 발견사항

새 요구사항 ID·새 API endpoint(method+path)·새 webhook/queue/SSE 이벤트명·새 환경변수·config
key·새 spec 파일 경로 — 이 다섯 축에서는 **신규 식별자 자체가 없다** (diff 전수 확인:
`@Get/@Post/@Patch/@Delete` 신규 라우트 0건, `process.env.*`/`registerAs`/migration 파일 신규
참조 0건, spec 파일 추가·개명 0건, BullMQ 큐/이벤트 신규 정의 0건).

이 diff 는 `#1288`(§5.4 응답-계약 검증자)이 검출한 drift 를 메우는 스윕으로, **이미 wire 로
나가고 있던 값**을 DTO 선언에 뒤늦게 반영하는 성격이라 신규 개념 도입이 거의 없다. 그럼에도
전수 대조한 신규 코드 식별자는 다음과 같고, 전부 **충돌 없음**으로 판정했다.

- **신규 DTO 필드** (`AlertRuleDto.{createdBy,lastTriggeredAt}` · `IntegrationDto.
  {appUrl,mallId,tokenExpiresAt,lastRotatedAt,lastUsedAt,consecutiveNetworkFailures}` ·
  `KnowledgeBaseDto.{documentCount,embeddingModelConfigId,rerankMode,rerankCandidateK,
  rerankScoreThreshold,rerankConfigId,rerankLlmConfigId}` · `TriggerDto.{chatChannelHealth,
  chatChannelLastError,chatChannelSetupAt,chatChannelRotatedAt,notificationHealth,
  notificationLastError,notificationRotatedAt,workflow}` · `ScheduleDto.trigger`) — 전부
  대응 엔티티 컬럼명과 철자·의미가 **정확히 일치**한다 (직접 확인: `integration.entity.ts`
  의 `mallId`/`tokenExpiresAt`/`lastUsedAt`/`lastRotatedAt`/`consecutiveNetworkFailures`,
  `knowledge-base.entity.ts` 의 `documentCount`/`rerankMode`/`rerankCandidateK`/
  `rerankScoreThreshold`/`rerankConfigId`/`rerankLlmConfigId`/`embeddingModelConfigId`,
  `alert-rule.entity.ts` 의 `createdBy`/`lastTriggeredAt`). `chatChannelHealth`/
  `notificationHealth` 의 타입 `TriggerChatChannelHealth`/`TriggerNotificationHealth` 도
  이 diff 가 신설한 것이 아니라 기존 `trigger.entity.ts`(#1272)에 이미 있던 것을 import
  했을 뿐이다. `appUrl` 은 엔티티 컬럼은 아니지만 `IntegrationsService.toPublic` 이 이미
  wire 로 내보내던 필드이고, `common/config/oauth.config.ts` 의 `OAuthConfig.appUrl`(백엔드
  자신의 `APP_URL`)과는 **동일 문자열이나 스코프가 다른 별개 식별자**다(하나는 서버 설정
  객체 속성, 하나는 응답 DTO 필드) — TypeScript 타입 경계가 분리돼 있고, 오히려 같은
  코드베이스의 `IntegrationOAuthService`(cafe24/makeshop OAuth 흐름 응답 `{ mode,
  integrationId, appUrl, callbackUrl, ... }`)가 이미 "설치된 앱의 관리자 URL" 이라는 동일
  의미로 `appUrl` 을 써 왔으므로 의미 충돌도 아니다. 새 의미로 기존 식별자를 재사용한
  사례는 없음.

- **신규 DTO 클래스** `ScheduleTriggerRefDto`·`ScheduleTriggerWorkflowRefDto`
  (`schedule-response.dto.ts`)·`TriggerWorkflowRefDto`(`trigger-response.dto.ts`, 최신
  커밋 `7e85da873` 도입) — 저장소 전체에 `*RefDto` 명명 패턴이 이 스윕 이전에는 없었다
  (`RefreshTokenDto` 류는 "refresh" 의 약어일 뿐 무관). 세 클래스 모두 grep 상 유일
  정의처이며, 서로 다른 파일에서 서로 다른 필드셋(`ScheduleTriggerRefDto`=트리거 참조 3~4
  필드, `TriggerWorkflowRefDto`=워크플로우 참조 2필드)을 갖고 있어 형태 충돌도 없다.

- **메서드/함수 개명·신설** — `TriggersService.sanitizeChatChannelForResponse` →
  `sanitizeForResponse`(rename), `SchedulesController.toResponse`(신규 private) — 둘 다
  `private` 이라 클래스 경계 밖에서 부딪히지 않고, `ExecutionsService.toResponseExecution`
  과도 문자열이 달라 정확한 이름 충돌은 아니다. "응답 경계에서 엔티티를 얕게 변환한다"는
  동일 패턴이 서비스마다 다른 이름으로 반복되는 것은 여전히 유효한 관찰이나(이전 라운드들이
  동일하게 지적) 충돌은 아니다.

- **신규 상수** `NOTIFICATION_SIGNING_STRIP_KEYS`·`TRIGGER_RESPONSE_STRIP_COLUMNS` —
  기존 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`와 이름·역할이 분리돼 있고 JSDoc 이 "같은 등급의
  비밀이 세 곳에 산다"고 관계를 명시한다. `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(신규,
  `swagger-dto-contract.spec.ts`, 응답 DTO 전수 78건)와 기존 `OPTIONAL_NULLABLE_DRIFT`
  (`execution-response.dto.spec.ts`, `ExecutionDto` 10건 부분집합) — **직전 라운드
  (`19_08_19`)가 WARNING 으로 지적했던 근접 명명·무교차 참조 문제는 이후 커밋에서 이미
  해소돼 있음을 diff 로 직접 재확인**했다: 두 상수의 JSDoc 이 이제 서로를 명시적으로
  가리킨다(`execution-response.dto.spec.ts` 는 "저장소 전체 판은 따로 있다 —
  `EXPECTED_OPTIONAL_NULLABLE_DRIFT`(78건)의 부분집합이므로 함께 줄여야 한다", 반대쪽도
  역방향 포인터). 현재 상태는 충돌이 아니라 문서화된 자매 관계다.

- **옵션 필드·내부 캐시** `ContractCheckOptions.allowMissing`(기존 `allowUndeclared` 와
  이름 대칭, "두 축은 갈려 있다" 전용 테스트 보유) · `contractCache`/`buildContractForDto`
  (`contractForDto` 내부 분리, 공개 시그니처 불변) — 전부 grep 상 유일 정의처, 기존 다른
  의미 사용처 없음.

- **신규 가드 함수** `findOptionalNullableResponseFields`·`isResponseDtoFile`·interface
  `OptionalNullableOffender`·fixture 클래스 `OptionalNullableOffenderFixtureDto`(양성
  대조군, `repo-guards/__tests__/fixtures/dto/responses/optional-nullable.fixture.ts`) —
  전부 grep 상 유일 정의처. fixture 파일은 `dto/responses/` 경로 술어를 통과시키면서도
  스캔 범위(`src/modules`) 밖에 두려는 의도적 배치이며 전용 대조군 테스트("fixture 는
  프로덕션 스캔 범위 밖이다")로 프로덕션 베이스라인 무오염을 고정한다.

- **파일 경로**: `git diff --diff-filter=A` 기준 신규 파일은 위 fixture 1개뿐. 기존
  `repo-guards/__tests__/*-fixture.ts`(하이픈 접미사, 평면 배치) 컨벤션과 접미사·배치가
  다르지만(`fixtures/dto/responses/*.fixture.ts`, 점 접미사, 중첩), 이는 경로 술어를
  통과시켜야 하는 실질적 제약 때문이고 다른 파일과 경로가 겹치지도 않는다 — 충돌 아님,
  다음에 유사 fixture 를 추가할 때 참고할 컨벤션 문서가 없다는 INFO 수준 관찰만 유효
  (이전 라운드가 이미 동일하게 기록).

## 이전 라운드 대비 신규 확인 사항

이 세션 안에서 이미 4차례(`18_23_03`·`19_08_19`·`20_45_39`·`21_40_38`) 같은 diff 계열의
naming_collision 검토가 수행됐다. 이번 라운드가 추가로 포함하는 두 커밋
(`67881bbd4`·`7e85da873`)의 신규 식별자는 `TriggerWorkflowRefDto` 하나이며, 위에서 확인한
대로 기존 정의와 충돌이 없다. 그 외 두 커밋은 기존에 이미 검토된 식별자(`sanitizeForResponse`
· `allowMissing` · `ScheduleDto.trigger` 등)의 **동작 정정**(대칭 브랜치 복구, `Object.assign`
undefined 덮어쓰기 수정)이며 새 식별자를 도입하지 않는다.

## 그 외 점검 관점별 결과

- **요구사항 ID**: 신규 ID 없음 (spec 델타 0).
- **API endpoint**: 신규 endpoint 없음 — 기존 `/api/schedules*`·`/api/triggers*`·
  `/api/integrations*`·`/api/knowledge-bases*`·`/api/alerts*` 의 **응답 필드**만 확장.
- **이벤트/메시지명**: 신규 webhook·queue·SSE 이벤트 없음.
- **환경변수·설정키**: 신규 ENV/config key 없음.
- **파일 경로**: 신규 파일 1개(테스트 fixture, 위 서술), 명명 컨벤션 위반은 실질적 제약에
  따른 의도적 이탈이며 기존 파일과 경로 충돌 없음.

## 요약

이 브랜치는 `spec/5-system/` 을 건드리지 않는 코드 전용 sweep(§5.4 응답-계약 검증자 배선
확대·트리거 회전 secret 유출 수정·금지 조합 정정+래칫 가드 신설·대칭 분기 복구)이라, 요구사항
ID·API endpoint·이벤트명·환경변수·spec 파일 경로 축에서는 신규 식별자 충돌이 원천적으로
없다. 새로 도입된 코드 식별자(DTO 필드 23개·클래스 3개·상수 4개·함수/메서드 6개·fixture
1개)를 저장소 전수 grep 으로 대조한 결과 기존에 다른 의미로 이미 쓰이고 있는 동일 식별자는
없었다 — DTO 필드는 예외 없이 대응 엔티티 컬럼과 이름·의미가 일치했고, 유일하게 문자열이
겹치는 `appUrl`(신규 `IntegrationDto.appUrl` vs 기존 `OAuthConfig.appUrl`)도 스코프가 분리된
별개 식별자이며 오히려 같은 도메인 내 기존 `IntegrationOAuthService` 응답과 의미가 일치한다.
직전 라운드가 WARNING 으로 남겼던 `OPTIONAL_NULLABLE_DRIFT` vs
`EXPECTED_OPTIONAL_NULLABLE_DRIFT` 근접 명명 문제는 이후 커밋의 상호 JSDoc 포인터 추가로
이미 해소된 상태임을 코드에서 직접 재확인했다. 최신 두 커밋이 새로 들여온 유일한 식별자
(`TriggerWorkflowRefDto`)도 충돌이 없다.

## 위험도

NONE
