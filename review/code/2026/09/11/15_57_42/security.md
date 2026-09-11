# 보안(Security) 코드 리뷰

## 대상 요약

이번 라운드(`15_57_42`)의 diff 는 직전 보안 리뷰(`review/code/2026/09/11/15_31_54/security.md`,
위험도 NONE)가 대상으로 삼았던 `chat-channel-input-rules.ts` / `triggers.service.ts` 를
**한 줄도 추가 수정하지 않는다** — `git log`로 확인한 결과 두 파일을 건드린 커밋은
`2ae81077c`(순수 이동) 하나뿐이고, 이번 라운드의 신규 커밋 `6dc2b7d60` 은 다음만 변경한다:

1. `chat-channel-input-rules.spec.ts` (신규, 185줄) — 이동된 6개 함수에 대한 전용 단위 테스트
2. `plan/in-progress/impl-chat-channel-binder.md` — 철회된 처방 취소선 처리 + 실제 결정 기록
3. `plan/in-progress/spec-draft-nullable-notation-followups.md` — durable 트래커에 3개 항목
   실제 등재 (spec 귀속 표기 정정 · discord verify_key 캐너리 · 구조 정리 6건)
4. `review/code/2026/09/11/15_31_54/*` — 직전 라운드 리뷰 산출물 커밋 반영(코드 아님)

즉 프로덕션 코드의 보안 표면은 **직전 라운드에서 이미 검증된 상태 그대로**이며, 이번 라운드는
그 라운드의 CRITICAL(코드가 아니라 "등재했다"는 **주장이 거짓**이었던 문서/프로세스 결함)을
바로잡고 테스트 커버리지를 채운 후속 커밋이다.

## 검증 절차

- `git log --oneline -- chat-channel-input-rules.ts triggers.service.ts` — 커밋 1개(`2ae81077c`)
  만 존재, `6dc2b7d60` 에는 두 파일이 포함되지 않음을 확인(순수 이동 이후 로직 무변경).
- `git show 2ae81077c`(전체 diff)를 직접 열어 이동된 6개 함수 본문이 `triggers.service.ts` 원본과
  1:1 대응함을 라인 단위로 대조 — `this.` 접두 제거·`private`→`export function` 전환 외 델타 없음.
- `grep -rln` 으로 `assertPatchCarriesNoSecrets` / `assertInboundSigningPlaintextByProvider` /
  `assertChatChannelInputSafe` / `assertChatChannelAlreadySetUp` / `stripChatChannelPlaintext` /
  `translateSetupChannelError` 의 프로덕션 코드 호출자를 전수 조회 — **`triggers.service.ts`
  1곳뿐**(직전 라운드 실측과 동일, 신규 호출자 없음).
- `grep -n "this\.\(assertChatChannelInputSafe\|...\)"` 로 `triggers.service.ts` 에 이동 전
  `private` 메서드에 대한 잔존 참조가 없음을 재확인(0건).
- 신규 `chat-channel-input-rules.spec.ts` 를 전문 열람 — 픽스처 값(`'secret://x'`, `'z'.repeat(40)`,
  `'xoxb-a'`, `'1:a'` 등)이 전부 합성 값이며 실제 자격증명·시크릿 패턴이 하드코딩되지 않았음을 확인.
- `dto/chat-channel-config.dto.ts` 의 `@IsEmpty` 데코레이터(내부 필드용) 존재를 재확인 —
  DTO 층 1차 검증 + 서비스 층 2차 검증이라는 방어-심층 구조가 이번 diff 로 훼손되지 않음.

## 발견사항

- **[INFO]** (직전 라운드 INFO 1 carry-forward, 미해소) provider 전용 검증 함수가 `private` 메서드
  에서 module-level export 함수로 남아 있어 캡슐화가 여전히 느슨함
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:227`
    (`assertInboundSigningPlaintextByProvider` 선언)
  - 상세: 이 함수는 "`mode === 'create'` 에서만 호출돼야 한다"는 불변식을 JSDoc·주석으로만
    강제한다. exported 함수이므로 이론상 어떤 모듈이든 `assertChatChannelInputSafe` 를 우회해
    PATCH 경로에서 직접 호출할 수 있다. 실측(`grep -rln`)상 오늘 시점 실제 호출자는
    `triggers.service.ts` 1곳뿐이라 즉시 악용 가능한 경로는 없음 — 이번 라운드에서도 상태 불변.
  - 제안: 직전 라운드 제안과 동일(신규 호출자 추가 시 `mode` 단일 진입점만 노출하는 관례 강제).
    새로 악화된 부분이 없으므로 이번 라운드에서 등급을 올릴 근거는 없음.

- **[INFO]** (직전 라운드 INFO 2 carry-forward, 미해소) `translateSetupChannelError` 가 provider
  adapter 의 `Error.message` 최대 256자를 `details.reason` 에 그대로 담아 클라이언트에 반환
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:304`-`317`
  - 상세: 로직은 이동 전과 완전히 동일. 오늘 시점 adapter(`slack.adapter.ts`/`discord.adapter.ts`/
    `telegram.adapter.ts`)가 던지는 메시지는 `"Slack auth.test failed: 401"` 류의 정형 문자열뿐이며
    자격증명·원본 HTTP 응답 본문을 포함하지 않음을 확인(grep 으로 `throw new Error(...)` 호출부
    전수 확인). 즉각적 유출 위험은 낮으나, adapter 구현이 향후 바뀌면 유출 경로가 될 수 있다는
    구조적 관측은 여전히 유효.
  - 제안: 직전 라운드 제안과 동일 — 별도 항목으로 트래킹(이번 PR 범위 아님, 새 결함 아님).

- **[INFO]** 신규 캐너리 테스트(`chat-channel-input-rules.spec.ts:178-184`)가 고정한 현재 동작 —
  discord `verify_key` 불일치 시 의도된 400 `BOT_TOKEN_INVALID` 대신 502
  `CHAT_CHANNEL_SETUP_FAILED` 가 반환됨 — 은 **보안 취약점이 아님**을 확인
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:306`
    (`translateSetupChannelError` 의 `/\b(401|403)\b/` 판별식)
  - 상세: 두 경로 모두 채널 setup 을 **거부**한다는 점은 동일하고 차이는 HTTP 상태 코드/에러
    코드뿐이다 — 인증 우회나 정보 과다 노출로 이어지지 않는다. API 계약 정합성 문제이지 보안
    결함이 아니므로 CRITICAL/WARNING 대상이 아니다. `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 트래커 항목으로 정식 등재된 것을 확인.

## 점검했으나 문제 없음 (참고, 직전 라운드와 동일 — 재확인 완료)

- **비밀 필드 3중 차단**: `botTokenRef`/`inboundSigningRef`/`inboundSigning` 외부 입력 거부,
  PATCH 의 `botToken`/`inboundSigningPlaintext` 차단(`assertPatchCarriesNoSecrets`) — 로직 무변경,
  신규 테스트(`chat-channel-input-rules.spec.ts:43-81`)로 커버리지 추가 확인.
- **plaintext DB 잔류 차단**: `stripChatChannelPlaintext` 의 `mergeExternalConfig` 호출 전 제거
  로직 무변경, 신규 테스트(`:116-123`)로 재확인.
- **모드-타입 오버로드 바인딩**: `assertChatChannelInputSafe` 의 `create`/`update` 오버로드가
  컴파일 타임에 DTO 타입과 짝을 강제하는 구조(이전 보안 결함 클래스 재발 방지) — 이동 후에도
  그대로 보존.
- **provider 전환 차단**: `assertChatChannelAlreadySetUp` 의 provider mismatch 거부 — 로직 무변경,
  신규 테스트(`:134-143`)로 재확인.
- **하드코딩된 시크릿**: 신규 테스트 파일 포함 전수 확인 — 실제 자격증명 없음(전부 합성 픽스처).
- **인젝션(SQL/커맨드/경로탐색)**: 이번 diff 는 순수 함수 로직·테스트·문서뿐 — DB 쿼리·쉘 명령·
  파일 경로 조합 없음.
- **인가/workspace 스코프**: 이번 diff 로 변경되지 않음(`triggers.service.ts` 의 `create`/`update`
  호출부는 손대지 않음).
- **`#1314` CRITICAL 재발 여부**: `setupChatChannel`/`teardownChatChannel`(T2, `inboundSigningRef`
  fail-open 방지 로직 포함)은 이번 PR 범위 밖으로 `triggers.service.ts` 에 그대로 남아 있고 이번
  diff 가 건드리지 않음 — 재발 없음.

## 요약

이번 라운드는 직전 보안 리뷰(위험도 NONE)가 검증한 프로덕션 코드(`chat-channel-input-rules.ts`,
`triggers.service.ts`)를 추가로 수정하지 않는다 — 신규 전용 단위 테스트 12케이스, plan/트래커
문서 정정, 직전 리뷰 산출물 커밋이 전부다. 프로덕션 보안 불변식(비밀 필드 차단, plaintext DB
잔류 방지, provider 형식·전환 검증, `#1314` fail-open 방지 로직)은 모두 그대로 보존되어 있고
신규 호출자·신규 시크릿 노출 경로는 발견되지 않았다. 직전 라운드의 CRITICAL(등재 주장이 거짓)은
기술적 보안 취약점이 아니라 프로세스/문서 무결성 결함이었고, 이번 커밋에서 실제 durable 트래커
등재로 해소되었음을 확인했다. 남은 발견사항은 전부 직전 라운드부터 이어지는 INFO 2건(느슨해진
캡슐화, 에러 메시지 슬라이스 노출 관행) — 둘 다 오늘 시점 실제 악용 경로가 없고 이번 라운드에서
상태가 악화되지 않았다.

## 위험도
NONE
