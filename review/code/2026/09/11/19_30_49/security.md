# 보안(Security) 코드 리뷰 — `impl-chat-channel-binder-t2` (2026-09-11 19:30 라운드)

## 검토 범위

이번 라운드(`19_30_49`)의 diff 는 직전 세 라운드(`18_04_36`→`18_42_05`→`19_06_54`)에서 이미
CRITICAL 0 으로 수렴한 리팩터(`TriggersService` private 메서드 → `ChatChannelBinderService`/
`buildTriggerCallbackUrl` 분리)에 대한 **후속 test-hardening 커밋 3개**(`92f4b0607`·`8f43b1f56`·
`68bb34e73`)를 반영한 것이다. 프로덕션 코드 변경은 `trigger-callback-url.ts` 의 인자를 위치
→ 이름(named) 파라미터로 바꾼 것과 `chat-channel-binder.service.ts` 의 호출부 갱신(8줄)뿐이고,
나머지는 전부 신규/보강 테스트(`chat-channel-binder.service.spec.ts`, `trigger-callback-url.spec.ts`,
`triggers.service.spec.ts` 보강)와 plan/review 문서다.

실제 소스는 `Read` 로 직접 열어 최신 상태를 확인했다:
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (전체)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (전체)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.spec.ts` (전체)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`create`/`update`/`rotateBotToken` 발췌)
- `codebase/backend/src/modules/secret-store/secret-ref.ts` (전체)

`git status --short` 로 시작 시점 워킹트리가 깨끗함을 확인했고(`review/code/2026/09/11/19_30_49/`
디렉터리 자체만 untracked), 저장소 파일을 뮤테이션하지 않았다(읽기만 수행) — 종료 시점도
동일하게 clean 함을 재확인했다.

## 점검 관점별 결과

1. **인젝션**: `Repository.update({ id: trigger.id }, {...})` 형태의 TypeORM 파라미터화 쿼리만
   사용 — SQL 인젝션 표면 없음. `buildSecretRef({ scope, resourceId, name })` 은 `trigger.id`
   (DB PK, UUID)를 `resourceId` 로 쓰고 `scope`/`name` 은 코드 리터럴이라 사용자 입력이 URI
   조립에 직접 섞이지 않는다 — 조립 후 `SECRET_URI_REGEX` 로 재검증까지 한다
   (`codebase/backend/src/modules/secret-store/secret-ref.ts`). 커맨드/LDAP/경로 탐색 해당 없음.
2. **하드코딩된 시크릿**: 없음. `trigger-callback-url.ts` 의 `'http://localhost:3011'` 은 dev
   fallback URL 이지 시크릿이 아니다.
3. **인증/인가**: 이번 diff 는 컨트롤러 가드/정책을 건드리지 않는다. `chatChannelBinder` 는
   `TriggersModule` 안에서만 쓰이고(`exports` 없음), 호출 경로(`create`/`update`/`remove`)는
   기존 워크스페이스 스코프 조회(`findById(id, workspaceId)`)를 그대로 통과한 뒤에만 도달한다.
4. **입력 검증**: `chat-channel-input-rules.ts` 의 `assertChatChannelInputSafe` 오버로드가
   `mode: 'create' | 'update'` 를 타입 레벨에서 DTO 와 묶어, PATCH 경로에서
   `assertPatchCarriesNoSecrets`(botToken·inboundSigningPlaintext 거부)가 반드시 타도록
   강제한다. `assertInboundSigningPlaintextByProvider` 는 slack/discord 값에 대해
   `SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` 로 형식 검증 후에만 통과시킨다.
   생성 전용 검증이 좁은 타입으로 막혀 있어 "PATCH 에서 부르면 컴파일 실패"가 되는 설계다.
5. **OWASP Top 10 기타**: A05(Security Misconfiguration)·A08(Software/Data Integrity) 관점에서
   새로 열린 표면 없음. `mergeExternalConfig` 가 `config.chatChannel` 을 통째로 교체하는
   read‑merge‑write 패턴(동시 PATCH 간 lost-update 가능)은 **사전 존재**하며 이미
   `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 항목으로 등재돼 있다
   (이번 diff 가 새로 만든 것이 아니고 순수 이동).
6. **암호화**: 이 diff 자체는 해시/암호화 알고리즘을 다루지 않는다(`secrets.rotate`/`resolve`
   는 `SecretResolverService` 위임, 별도 리뷰 라운드 대상). Slack/Discord 서명 검증용
   정규식은 형식 검증(hex 32/64)이며 알고리즘 선택과 무관.
7. **에러 처리**: `chatChannelLastError: message.slice(0, 1024)`, `translateSetupChannelError`
   의 `details.reason: message.slice(0, 256)` 모두 길이 상한이 있고, 클라이언트에는
   `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 같은 정형 코드 + 잘린 reason 만 노출된다.
   스택 트레이스·내부 경로·시크릿 값이 응답에 실리는 지점은 발견하지 못했다(secret 값 자체는
   `stripChatChannelPlaintext`/`sanitizeForResponse` 4축 정화로 응답 이전에 제거됨, 이 부분은
   `triggers.service.ts` 기존 로직 — 이번 diff 범위 밖).
8. **의존성 보안**: `package.json`/lockfile 변경 없음(순수 내부 리팩터 + 테스트 추가).

## 발견사항

이번 diff 범위(테스트 3종 + 이름 인자 리팩터)에서 **새로 도입된 보안 결함은 없다.**

- **[INFO]** (사전 존재, 정보성) `config` JSONB 컬럼 read‑merge‑write 로 인한 동시 PATCH 간
  lost-update 가능성.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` `setupChatChannel`
    — `const newConfig = { ...(trigger.config ?? {}), chatChannel: mergedChannel }; await this.triggerRepository.update(...)`
    (실패 경로의 `fallbackConfig` 도 동일 패턴).
  - 상세: 무결성(A08) 관점에서 기록해 둘 가치는 있으나, 이 diff 가 새로 만든 것이 아니라
    `TriggersService` 에서 그대로 옮겨온 기존 동작이고 이미 별도 트래커
    (`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재돼 있다.
  - 제안: 이번 PR 의 조치 대상 아님 — 후속 항목에서 advisory lock/optimistic version 등으로 처리.
- **[INFO]** (사전 존재, 정보성) `rotateBotToken` 엔드포인트의 OpenAPI 데코레이터 부재는 보안
  결함이 아니라 문서화 갭이며, `--impl-prep` 산출물에 이미 등재돼 이번 리뷰에서 중복 등재하지
  않는다.

CRITICAL/WARNING 급 보안 발견사항은 없다.

## 요약

이번 라운드는 이전 세 라운드(18_04_36→19_06_54)를 거치며 CRITICAL 0 으로 수렴한 chat-channel
바인딩 리팩터에 대한 test-hardening 커밋만 추가한 것으로, 프로덕션 로직 변경은 콜백 URL 조립
함수의 인자를 이름 기반으로 바꾼 것뿐이다. 직접 소스를 열어 재확인한 결과 PATCH 경로는 여전히
사용자 비밀(botToken·inboundSigningPlaintext)을 타입·런타임 이중으로 거부하고, provider 전환도
차단하며, secret ref 조립은 파라미터화돼 있고 응답 정화 로직도 그대로 유지된다. SQL/커맨드
인젝션, 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 신규 결함은
발견되지 않았다. 유일한 기록 사항은 사전 존재하며 이미 트래킹 중인 lost-update 패턴(정보성)뿐이다.

## 위험도

NONE
