# 보안(Security) 코드 리뷰

## 대상 요약

이번 라운드(`16_16_44`)는 직전 두 보안 리뷰(`review/code/2026/09/11/15_31_54/security.md`,
`review/code/2026/09/11/15_57_42/security.md`, 둘 다 위험도 NONE)가 검증한 프로덕션 파일
(`codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`,
`codebase/backend/src/modules/triggers/triggers.service.ts`)의 **판정 로직을 추가로 바꾸지
않는다**. `git log --oneline origin/main..HEAD`(`2ae81077c` → `6dc2b7d60` → `81d2a8c18`)로 확인한
결과, 이번 라운드의 신규 커밋 `81d2a8c18` 이 건드리는 것은:

1. `chat-channel-input-rules.spec.ts` — 뮤테이션 커버리지 공백을 닫는 신규 테스트 케이스
   (provider 정규식 교차 검증, `assertPatchCarriesNoSecrets` 대칭 필드, `mode==='update'`
   디스패치, `chatChannel===undefined` 조기 반환, `assertChatChannelAlreadySetUp` 양성 경로) —
   **테스트 파일뿐**.
2. `chat-channel-input-rules.ts` — **6줄, JSDoc 주석 추가뿐**
   (`translateSetupChannelError` 의 "discord verify_key 불일치는 502 로 떨어진다"는 기존 캐너리
   동작을 소스에도 명시). 실행 로직 변경 0줄.
3. `plan/in-progress/impl-chat-channel-binder.md` 1줄 · plan 트래커 문서 · 이전 라운드
   리뷰 산출물(`review/code/2026/09/11/15_31_54/**`) — 코드 아님.

즉 이번 diff 의 보안 표면은 **직전 라운드에서 이미 NONE 으로 확정된 상태 그대로**다.

## 검증 절차

- `git show 2ae81077c -- .../triggers.service.ts`(순수 이동 diff)를 다시 열어, 6개 함수
  (`assertChatChannelInputSafe`(오버로드 2)·`assertPatchCarriesNoSecrets`·
  `assertChatChannelAlreadySetUp`·`stripChatChannelPlaintext`·
  `assertInboundSigningPlaintextByProvider`·`translateSetupChannelError`) 본문이 `private` →
  `export function` 전환 외에 **한 글자도 바뀌지 않았음**을 재확인 — `translateSetupChannelError`
  의 `details.reason: message.slice(0, 256)` 노출 관행도 이동 전부터 존재하던 동일 코드.
- `git show 6dc2b7d60`, `git show 81d2a8c18` 의 `--stat` 로 두 후속 커밋이
  `chat-channel-input-rules.ts` 를 건드리는 범위가 **JSDoc 6줄**(`81d2a8c18`)뿐임을 확인 —
  `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/
  `assertInboundSigningPlaintextByProvider`/`stripChatChannelPlaintext`/
  `assertChatChannelAlreadySetUp` 의 실행 코드(비밀 필드 차단·정규식·provider 분기)는
  세 커밋 통틀어 `2ae81077c` 이후 무변경.
- `chat-channel-input-rules.ts` 전체 파일을 `Read` — `assertPatchCarriesNoSecrets` 가
  `botToken` **과** `inboundSigningPlaintext` 두 필드를 모두 차단하는 코드가 이미 존재함을
  직접 확인(커밋 메시지의 W1 "대칭 필드 누락"은 **테스트 커버리지 갭**이었지 프로덕션 가드
  누락이 아니었다 — 실제 코드 92-158줄에 두 검사가 처음부터 나란히 있다).
- `assertInboundSigningPlaintextByProvider` 본문의 `SLACK_SIGNING_SECRET_REGEX`/
  `DISCORD_PUBLIC_KEY_REGEX` 분기(267-289줄)가 `provider === 'slack'`/`'discord'` 조건으로
  올바르게 갈려 있음을 확인 — 커밋의 W2 "정규식 스왑이 GREEN"도 **테스트가 교차 케이스를
  누락**했던 것이지 실제 검증식이 뒤바뀐 것은 아니었다(코드 자체는 처음부터 provider별로 옳은
  정규식을 골라 쓴다).
- `git show 81d2a8c18 -- .../chat-channel-input-rules.spec.ts` 를 열어 신규 fixture 값
  (`'a'.repeat(32/64)`, `'Z'.repeat(...)`, `'1:a'` 등)이 전부 합성 값이며 실제 자격증명·시크릿
  패턴을 하드코딩하지 않았음을 확인.
- 저장소 트리에는 아무것도 쓰지 않았다(전부 `Read`/`git show`/`grep` 만 사용) — `git status
  --short` 로 확인할 잔여물 없음.

## 발견사항

- **[INFO]** (직전 두 라운드 INFO carry-forward, 이번 라운드에서도 상태 불변)
  `assertInboundSigningPlaintextByProvider` 가 `private` 메서드에서 module-level export 함수로
  남아 있어, "`mode==='create'` 자리에서만 호출돼야 한다"는 불변식이 캡슐화가 아니라 JSDoc/주석
  규율에만 의존한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:227`
    (`assertInboundSigningPlaintextByProvider` 선언)
  - 상세: `grep -rln "assertInboundSigningPlaintextByProvider"`(프로덕션 코드 기준) 결과 호출자는
    여전히 `triggers.service.ts`(정확히는 그 안에서 재수출된 `assertChatChannelInputSafe`) 1곳
    뿐이라 오늘 시점 악용 가능한 신규 경로는 없다. 이번 라운드가 새로 악화시킨 것도 아니다.
  - 제안: 직전 라운드와 동일 — 신규 호출자가 생길 때 `mode` 단일 진입점만 노출하는 관례를
    코드리뷰/lint 로 강제할 것을 고려. 등급 상향 근거 없음.

- **[INFO]** (직전 두 라운드 INFO carry-forward, 이번 라운드에서도 상태 불변) `translateSetupChannelError`
  가 provider adapter 의 `Error.message` 최대 256자를 `details.reason` 에 그대로 담아 클라이언트에
  반환하는 관행
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:310-323`
  - 상세: 이번 라운드에서 이 함수에 가해진 유일한 변경은 6줄 JSDoc 추가(위 discord verify_key
    캐너리 설명)뿐이고 실행 로직은 무변경. adapter(`slack.adapter.ts`/`discord.adapter.ts`/
    `telegram.adapter.ts`)가 던지는 메시지가 여전히 `"... failed: 401"` 류의 정형 문자열뿐임은
    직전 라운드에서 이미 실측 확인됨 — 새로 악화된 노출 경로 없음.
  - 제안: 직전 라운드와 동일(별도 항목으로 트래킹, 이번 PR 범위 아님·새 결함 아님).

## 점검했으나 문제 없음 (참고)

- **비밀 필드 차단 불변식**: `botTokenRef`/`inboundSigningRef`/`inboundSigning` 외부 입력 거부
  (3중), PATCH 의 `botToken`/`inboundSigningPlaintext` 차단(`assertPatchCarriesNoSecrets`) —
  실행 코드 무변경. 이번 라운드가 추가한 테스트(`assertChatChannelInputSafe` 공개 진입점을 통한
  `update` 디스패치 검증, `assertPatchCarriesNoSecrets` 의 두 필드 각각 검증)는 **기존에 이미
  올바르던 가드**에 대한 커버리지 강화이지 새 방어 로직 도입이 아니다.
- **provider 형식 검증**: `SLACK_SIGNING_SECRET_REGEX`(hex32)/`DISCORD_PUBLIC_KEY_REGEX`(hex64)
  분기가 provider 별로 정확히 대응됨을 소스에서 직접 재확인 — 신규 교차-길이 테스트가 검증하는
  대상 코드 자체는 변경되지 않았다(회귀 방지망 강화일 뿐).
- **`stripChatChannelPlaintext`**: `mergeExternalConfig` 호출 전 `botToken`/
  `inboundSigningPlaintext` 제거 로직 무변경.
- **`assertChatChannelAlreadySetUp`**: provider mismatch 거부 로직 무변경. 신규 "provider 동일 시
  통과(양성 경로)" 테스트는 기존 로직의 반대편 분기를 검증할 뿐 로직 변경 아님.
- **하드코딩된 시크릿**: 신규 테스트 fixture 전수 확인 — 전부 `'a'.repeat(n)` 류 합성 값, 실제
  자격증명·API 키·토큰 없음.
- **인젝션(SQL/커맨드/경로탐색)**: 이번 diff 는 문자열 길이·정규식 매칭·구조분해뿐 — DB 쿼리·쉘
  명령·파일 경로 조합 없음.
- **인가/workspace 스코프**: `triggers.service.ts` 의 `create`/`update` 호출부(workspace 검사
  포함)는 이번 라운드에서 전혀 수정되지 않음.
- **`#1314` CRITICAL(`inboundSigningRef` fail-open) 재발 여부**: `setupChatChannel`/
  `teardownChatChannel`(T2, 이번 PR 범위 밖)은 이번 세 커밋 어디에서도 손대지 않음 — 재발 없음.

## 요약

이번 라운드는 직전 두 보안 리뷰가 NONE 으로 확정한 `chat-channel-input-rules.ts`/
`triggers.service.ts` 의 보안 판정 로직을 추가로 변경하지 않는다. 신규 커밋(`81d2a8c18`)이 건드리는
것은 (1) 프로덕션 코드 JSDoc 6줄(discord verify_key 캐너리 문서화, 실행 로직 무변경)과 (2) 뮤테이션
테스트로 실측된 커버리지 공백(정규식 교차 케이스·`assertPatchCarriesNoSecrets` 대칭 필드 등)을 닫는
테스트 전용 추가뿐이다. 직접 소스를 대조한 결과 커밋 메시지가 "W1/W2 결함"이라 부르는 것은 **테스트가
놓쳤던 갭**이었지, 실제 프로덕션 가드(비밀 필드 차단·provider별 정규식 분기)는 이동 전부터 지금까지
한 번도 뚫린 적이 없다. 새로 발견된 보안 결함은 없으며, 두 라운드째 이어지는 INFO 2건(느슨해진
캡슐화, 에러 메시지 슬라이스 노출 관행)은 이번 라운드에서도 상태가 악화되지 않았다.

## 위험도

NONE
