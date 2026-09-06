# 보안(Security) 리뷰

## 발견사항

- **[INFO]** `chatChannelLastError`/`notificationLastError` 가 신규 DTO 선언(`@ApiProperty`)으로
  wire 상시 노출을 공식화하는데, 그 값은 외부 어댑터 실패 시 `err.message` 를 그대로
  `slice(0, 1024)` 한 자유 텍스트다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:81,98`
    (선언), `codebase/backend/src/modules/triggers/triggers.service.ts:891` (`chatChannelLastError:
    message.slice(0, 1024)`, `setupChannel` catch 블록).
  - 상세: 이 필드 자체와 채우는 로직은 이번 diff 가 새로 만든 것이 아니라 이미 존재하던
    엔티티 컬럼·로직이며(엔티티가 raw 로 나가던 것을 DTO 선언에 맞춘 것뿐, CHANGELOG 가
    명시), 원인이 사용자 입력이 아니라 외부 chat-channel provider 의 실패 메시지라 즉각적인
    인젝션 경로는 아니다. 다만 향후 어댑터가 바뀌어 provider 응답 본문(자격 증명이 섞인
    에러 payload 등)을 그대로 message 에 담게 되면, 그 문자열이 이제 공식적으로 워크스페이스
    멤버에게 wire 로 노출된다는 사실이 코드 경계에 문서화돼 있지 않다. 동일 지적이
    `review/code/2026/09/05/20_45_37/RESOLUTION.md` INFO#7 에 이미 등재·"조치 불요(추적)"로
    처분돼 있다.
  - 제안: 신규 지적 아님 — 기존 처분 유지. 어댑터 쪽에서 `err.message` 조합 방식이 바뀔 때
    "provider raw body 를 message 에 담지 않는다" 불변식을 그 자리에 남기는 것을 권고.

- **[INFO]** `triggers.service.spec.ts` 신규 fixture 에 `'wsk_live_secret'` 형태의 문자열
  리터럴이 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:203` (주석은
    `:202`, 그 외 `chatChannelTokenV2: 'secret://triggers/t1/bot-token.v2'` 는 `:205`,
    `secret: 'plaintext-should-be-stripped'` 는 `:213`).
  - 상세: naive 시크릿 스캐너가 `wsk_live_...` 패턴을 실제 API 키로 오탐할 수 있는 형태이나,
    이는 `notificationSecretV2` 스트립 회귀를 검증하려고 넣은 **가짜 mock 값**이고
    `triggerRepo.findOne.mockResolvedValue(...)` 안에서만 쓰인다 — 실 시크릿 스토어·외부
    서비스와 무관, 실제 자격 증명이 아니다.
  - 제안: 조치 불요. 참고로만 남김(향후 secret-scanning CI 도입 시 allowlist 필요할 수 있음).

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드가 전혀 소비하지 않는
  내부 health 카운터인데 이번 diff 로 응답 계약에 정식 선언된다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:161`
    (`consecutiveNetworkFailures: number;`).
  - 상세: 심각한 정보 노출은 아니다(내부 재시도/health 카운터, 자격 증명이나 PII 아님).
    다만 워크스페이스 멤버에게 백엔드 재시도 상태를 드러내 공격 타이밍 추정에 미미하게
    쓰일 여지가 있다. PR 자신의 주석과 plan 트래커가 "wire 변경이라 이번엔 제거하지 않고
    별도 항목으로 미룬다"고 이미 명시하고 있어 은닉된 확장이 아니다.
  - 제안: 조치 불요 — 이미 별도 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md`)
    으로 등재됨.

## 확인한 것 (결함 아님 — 근거 기록)

- **트리거 회전 secret 유출 수정 검증**: `TriggersService.sanitizeForResponse`
  (`codebase/backend/src/modules/triggers/triggers.service.ts:576-639`)가 (1)
  `config.chatChannel` 내부 키, (2) `config.notification.signing` 내부 키, (3)
  `trigger` 엔티티 컬럼(`notificationSecretV2`/`chatChannelTokenV2`) 세 곳을 모두 덮고,
  조기 return 이 제거돼 chat-channel 이 아닌 트리거도 정화를 거친다. 호출부
  `findAll`(:203)·`findOneDetail`(:226,231,232)·`create`(:322)·`update`(:407) 전부가
  `sanitizeForResponse` 를 거쳐 나간다 — `Read` 로 직접 확인. 컨트롤러가 직접 노출하는
  경로 중 이 정화를 우회하는 곳은 없다(`findById` 는 서비스 내부에서만 쓰이고
  controller 는 `findOneDetail` 을 호출).
- **스케줄 조인 2차 유출 수정 검증**: `SchedulesController.toResponse()`
  (`codebase/backend/src/modules/schedules/schedules.controller.ts:67-83`)가 `trigger` 를
  `id`/`name`/`workflowId`/`workflow.name` 4필드로 좁히고, `findAll`(:101)·`findOne`(:119)·
  `create`(:194)·`update`(:246) 네 엔드포인트 전부가 이 헬퍼를 거친다 — `runNow`/`getPreview`/
  `remove`/`previewExpression` 은 애초에 `trigger` 를 반환하지 않아 대상 밖이다. 서비스 쪽
  `leftJoinAndSelect('s.trigger','t')`/`relations:['trigger','trigger.workflow']` 가 여전히
  엔티티 전체를 싣지만, 컨트롤러 경계에서 narrowing 되므로 wire 유출은 없다.
- **회귀 테스트의 판별력**: `triggers.service.spec.ts` 신규 2건(비밀 컬럼+signing 키 스트립,
  chat-channel 아닌 트리거의 조기 return 회귀)과 `schedule-trigger.e2e-spec.ts` 신규 C-3
  케이스(생성 비활성 + PATCH 비활성 양쪽에서 `trigger` 키 존속 확인)가 실제로 `git diff`
  상에 존재함을 확인했고, RESOLUTION.md 세 건(`18_23_02`/`19_08_18`/`20_45_37`)이 각 라운드의
  뮤턴트 RED 실측을 기록하고 있다 — 자체 재실행은 하지 않았으나(다른 reviewer 와 공유
  워킹트리이므로 뮤테이션 생략), 서술과 코드가 일치함은 직접 대조했다.
- **§5.4 금지-조합 정적 가드**: `findOptionalNullableResponseFields`
  (`codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:264-311`)는
  응답 DTO(`/dto/responses/` 경로) 만 스캔하고 요청 DTO 는 명시적으로 제외한다. 양성
  대조군 fixture(`optional-nullable.fixture.ts`)는 프로덕션 스캔 범위(`src/modules`) 밖에
  있음을 별도 테스트로 고정해, 가드 자신이 오탐 베이스라인을 오염시키지 않는다.
- **`response-contract.ts` 의 `allowMissing`/메모이제이션**: 둘 다 `src/shared/testing/**`
  아래에 있고 `tsconfig.build.json` 이 이 경로를 프로덕션 빌드에서 제외함을 직접 확인했다
  (`exclude` 배열에 `"src/shared/testing/**"`) — 런타임 노출·경합 조건 우려 없음. 실패
  promise 를 캐시에서 축출하는 로직(`contractForDto`)도 테스트로 고정돼 있다.
- **하드코딩된 실 시크릿 없음**: diff 전체(CHANGELOG·DTO 선언·컨트롤러/서비스·테스트)를
  훑었고, 실제 API 키·비밀번호·인증서·프로덕션 자격 증명은 없다. 문자열은 전부 마스킹된
  예시(`sk-****abcd`, 기존 코드)나 명백한 테스트 mock 값이다.
- **SQL/커맨드/경로 인젝션·인가 우회**: 이번 diff 는 DTO 선언·응답 정화·컨트롤러 narrowing·
  테스트 배선이 전부이고, 신규 쿼리 빌더·동적 커맨드 실행·파일 경로 조작은 없다. 인가
  로직(`@Roles`, `WorkspaceId` 스코핑)은 손대지 않았다.

## 요약

이 diff 의 핵심은 §5.4 응답-계약 검증자를 넓히는 과정에서 실측으로 드러난 보안 결함
두 가지 — 트리거 회전 secret(`notificationSecretV2`) 및 secret store ref
(`chatChannelTokenV2`)가 (a) 트리거 엔티티 컬럼 미스트립으로, (b) `GET /api/schedules` 의
조인을 타고 2차로 — wire 에 노출되던 것을 두 응답 경계(서비스 `sanitizeForResponse`,
컨트롤러 `toResponse`)에서 각각 막은 수정이다. 직접 코드를 읽어 모든 호출부가 정화를
거치는지 확인했고, 결함이 처음 고쳐진 뒤에도 두 차례 더 "한 칸 좁게" 재발했다가(조기
return, `notification.signing.secretRef` 누락, `create`/`update` 비활성 경로의 `trigger`
키 소실) 이전 세 라운드의 리뷰·RESOLUTION 을 거치며 순차로 닫혔음을 `git diff`/파일 대조로
검증했다. 나머지 변경(5개 DTO 24필드 선언 보정, e2e 계약 배선 14곳, 정적 래칫 신설)은 이미
wire 에 나가고 있던 것을 문서화하는 것뿐이라 새로운 노출을 만들지 않는다. 발견된 항목은
모두 INFO 수준(향후 에러 메시지 노출 경로 문서화 권고, 테스트 fixture 의 시크릿-스캐너
오탐 가능성, 이미 트래커에 등재된 내부 카운터 노출)이며 이번 PR 을 막을 사유는 없다.

## 위험도

NONE
