# 보안(Security) 코드 리뷰

## 검토 범위

이번 라운드(`review/code/2026/09/11/18_42_05`)는 직전 라운드
`review/code/2026/09/11/18_04_36` 의 WARNING 4건에 대한 fix 커밋
(`92f4b0607`)을 포함한 diff다. `git diff origin/main...HEAD`(merge-base
`ba634a4b0`)로 실제 코드 변경 범위를 확정했다:

- `chat-channel-binder.service.ts`(신규, 292줄) / `trigger-callback-url.ts`(신규, 57줄):
  `TriggersService` 의 private 메서드 `setupChatChannel`/`teardownChatChannel`/`buildCallbackUrl`
  을 그대로 옮긴 Extract-Class 리팩터. `triggers.service.ts` 는 258줄 삭제(호출부만 교체) — 순수 이동.
- 이번 fix 라운드가 실제로 바꾼 유일한 런타임 코드: `buildTriggerCallbackUrl` 시그니처를
  위치 인자 `(baseUrl, endpointPath)` → 이름 인자 `{ baseUrl, endpointPath }` 로 변경(호출부 2곳
  동반 수정). **보안에 영향을 주는 로직 변경은 없다** — secret 쓰기 게이팅
  (`storeUserSuppliedSecrets`) · `inboundSigningRefSurvives` 술어 · best-effort catch · 에러
  메시지 저장 방식 전부 이동 전과 바이트 단위로 동일함을 `git show 92f4b0607`/`git diff
  origin/main...HEAD`로 직접 대조 확인.
- 나머지 diff는 신규 단위 테스트 2개 파일(`chat-channel-binder.service.spec.ts`,
  `trigger-callback-url.spec.ts`), 모듈 provider 등록(`triggers.module.ts`), 기존 spec 파일의
  provider 목록 추가, `plan/**`·`review/**` 문서 산출물.

`chat-channel-binder.service.ts` 원문을 직접 `Read`로 열어 secret store 3-쓰기 게이팅
로직(PATCH 에서 사용자 제공 비밀은 건너뛰고 telegram server-issued 서명만 무조건 재저장)과
`buildSecretRef`(정규식 화이트리스트로 `secret://<scope>/<resourceId>/<name>` 형식 강제, 위반 시
throw)를 확인했으며, 두 CRITICAL을 닫은 선행 커밋 `fad828884`(R-CC-21 PATCH 비밀 미기록)의 상태가
이번 이동 후에도 그대로 보존됨을 확인했다.

## 저장소 위생 — 병렬 리뷰 오염 여부 확인

직전 라운드 `dependency.md`가 `chat-channel-binder.service.ts`에서 `storeUserSuppliedSecrets`
→ `true`로 바뀐 미커밋 뮤테이션(다른 reviewer 추정)을 관측했다고 기록했다. 이번 세션 시작 시점
`git status --short` 결과 워크트리는 clean(이번 세션이 만든 `review/code/2026/09/11/18_42_05/`
디렉터리만 untracked)이며, 그 뮤테이션은 이미 원복되어 남아있지 않다. 코드에 아무것도 쓰거나
고치지 않았다(읽기 전용 확인만 수행) — 뮤테이션 규약에 따른 별도 원복 조치 불필요.

## 발견사항

- **[INFO]** 외부 adapter(Slack/Discord/Telegram) 오류 메시지가 `chatChannelLastError` 로 DB에
  저장되고 `TriggerResponseDto.chatChannelLastError` 로 워크스페이스 멤버에게 노출된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` —
    `setupChatChannel` 의 catch 블록, `chatChannelLastError: message.slice(0, 1024)` (파일 내
    `async setupChatChannel(...)` 메서드 하단 catch 절)
  - 상세: `err instanceof Error ? err.message : String(err)` 원문을 그대로 저장한다. 직전 라운드
    security 리뷰(`review/code/2026/09/11/18_04_36/security.md`)가 이미 지적했고, 이동 전
    `triggers.service.ts` 원본 private 메서드에도 동일하게 있던 사전 존재 동작임을 `git diff
    origin/main...HEAD`로 재확인했다 — 이번 diff가 새로 만들거나 악화시킨 것이 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. 후속으로 provider 원문 메시지 대신 분류 코드로 대체하는 것을
    고려(이미 트래커에 등재됨, `spec-draft-nullable-notation-followups.md` 등).

- **[INFO]** 신규 테스트 파일(`chat-channel-binder.service.spec.ts`,
  `trigger-callback-url.spec.ts`)의 fixture 문자열(`'secret://x'`, `'xoxb-fake-token'` 류,
  `'https://workflow-api.getit.co.kr'`)은 전부 명백한 가짜 값이며 실제 자격증명이 아니다.
  하드코딩된 시크릿 없음.

## 점검 관점별 확인 결과 (해당 없음/문제 없음)

- **인젝션**: `buildTriggerCallbackUrl` 은 문자열 결합으로 URL을 조립하지만 시그니처 변경(이름
  인자화) 외에 조립 로직(`replace(/\/$/, '')`, `replace(/^\//, '')`) 자체는 변경되지 않았다.
  `endpointPath`는 DTO 레벨 검증(기존, 이번 diff 밖)에 의존하며 이번 diff가 그 검증 경로를 바꾸지
  않는다. `triggerRepository.update`/`findOne`은 TypeORM 파라미터 바인딩만 사용.
- **하드코딩된 시크릿**: 없음. `http://localhost:3011` fallback은 dev 전용 기본 호스트 리터럴일 뿐
  시크릿이 아니며, `app.config.ts`가 `APP_URL` 미설정 시 이미 같은 값으로 fallback하므로 프로덕션
  경로에서 발화하지 않음(파일 JSDoc이 실측 근거와 함께 명시).
- **인증/인가**: 이번 diff는 컨트롤러/가드 계층을 건드리지 않는다. 호출부(`create`/`update`/
  `remove`)는 이전과 동일하게 `findById(id, workspaceId)`로 워크스페이스 스코프가 확정된
  `trigger`를 넘긴다 — 회귀 없음.
- **입력 검증**: PATCH의 `storeUserSuppliedSecrets: false` 게이팅, telegram server-issued 서명
  예외, `inboundSigningRefSurvives` fail-open 방지 로직 모두 이동 전후 동일(라인 단위 대조 완료).
- **암호화**: `SecretResolverService.rotate/resolve` 호출 방식 변경 없음 — 암호화 자체는 그 서비스
  내부 구현이라 스코프 밖.
- **에러 처리**: 위 INFO 항목(사전 존재) 외 신규 노출 없음.
- **의존성 보안**: 신규 외부 패키지 없음(`package.json`/lockfile 변경 0건), 기존 `@nestjs/*`,
  `typeorm` import 재배치뿐.

## 요약

이번 diff는 chat-channel adapter setup/teardown/URL 조립 로직을 `TriggersService`에서 신규
`ChatChannelBinderService`/`buildTriggerCallbackUrl`로 옮긴 순수 리팩터이며, 이번 fix 라운드가
실제로 바꾼 유일한 런타임 로직은 콜백 URL 함수의 인자를 위치→이름 방식으로 바꾼 것(순서 실수를
타입으로 막던 우연한 방어를 형태로 대체)뿐이다. secret store 3-쓰기 게이팅·PATCH 비밀 미기록
(R-CC-21)·`inboundSigningRef` fail-open 방지 로직은 선행 커밋(`fad828884`)이 고친 상태 그대로
바이트 단위 보존됨을 직접 대조로 확인했다. 신규 테스트 fixture에 실제 자격증명 없음, 신규 외부
의존성 없음, 컨트롤러/인가 계층 변경 없음. 유일한 언급 사항(외부 adapter 에러 메시지의
`chatChannelLastError` 노출)은 이번 PR 이전부터 존재하던 동작으로 이미 트래커에 등재돼 있어 이
PR을 막을 사유가 아니다. 직전 라운드에서 관측된 병렬 리뷰어의 미커밋 뮤테이션(`storeUserSuppliedSecrets`
→ `true`)은 이번 세션 시작 시점 이미 원복돼 있음을 `git status --short`로 확인했다.

## 위험도

NONE
