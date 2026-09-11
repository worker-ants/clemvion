# 요구사항(Requirement) 리뷰 — `impl-chat-channel-binder` (fixup 라운드, `6dc2b7d60`)

## 스코프 확인

`origin/main`(`3796c7308`) 대비 이 브랜치 diff 는 커밋 2개다 — `2ae81077c`(T1 순수 이동) +
`6dc2b7d60`(직전 `/ai-review` `15_31_54` 의 CRITICAL 1·WARNING 4 를 처분한 fixup). 코드 변경은
`chat-channel-input-rules.ts`(신규)·`chat-channel-input-rules.spec.ts`(신규)·`triggers.service.ts`
(호출부 치환)뿐이고, 나머지는 plan/tracker/이전 리뷰 산출물이다. 아래는 저장소를 건드리지 않고
`Read`/`Grep`/`git log`/`git diff`와 **읽기 전용 jest 실행 1회**(`git status --short` 로 잔여물
없음 확인, 파일 쓰기 없음)로 직접 검증한 결과다.

## 발견사항

- **[INFO] 이전 라운드 CRITICAL("등재했다"는 주장이 거짓)이 이번 커밋에서 실측으로 해소됨**
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:93-116`(철회 서술 + 실제 결정),
    `plan/in-progress/spec-draft-nullable-notation-followups.md:2523-2560`(신규 트래커 항목 3건)
  - 상세: `grep -n "assertInboundSigningPlaintextByProvider" plan/in-progress/spec-draft-nullable-notation-followups.md` 로 직접 확인 — `slack.md:275`/`discord.md:297` 귀속 정정 항목,
    `translateSetupChannelError` 502 캐너리 항목, 구조 정리 6건 항목이 실재한다. plan 체크리스트도
    T1 이동·뮤테이션 5/5 RED·`run-test.sh` GREEN 항목이 `[x]`로 갱신됐다. 이전 라운드에서
    "커밋 메시지만 주장하고 산출물엔 없다"던 격차가 이번 라운드에는 없다.
  - 제안: 없음 — 이미 처분됨. 참고 기록.

- **[SPEC-DRIFT] WARNING** `assertInboundSigningPlaintextByProvider` 의 `TriggersService.` 접두
  귀속이 spec 본문 2곳에서 여전히 문법적으로 성립하지 않음 (developer 권한 밖, 트래커 등재 완료)
  - 위치: `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297`
    — 둘 다 `"Backend 의 TriggersService.assertInboundSigningPlaintextByProvider 가 trigger 생성
    시점에 정규식 검증"` 형태
  - 상세: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:227`
    (`export function assertInboundSigningPlaintextByProvider`)를 직접 열어 확인 — 이 함수는 이제
    `TriggersService` 의 메서드가 아니라 module-level 함수이고, `triggers.service.ts:404,487`
    호출부는 함수를 import 해 부를 뿐 클래스 멤버가 아니다. 실질(트리거 생성 시점 검증, 위반 시
    400 `VALIDATION_ERROR`, `details.field='inboundSigningPlaintext'`, `details.code='INVALID_FIELD'`)
    은 여전히 정확히 참이다 — 코드가 맞고 spec 표기(심볼 경로)만 낡았다. 같은 함수를 클래스 접두
    없이 함수명만 인용하는 3곳(`spec/2-navigation/2-trigger-list.md:155`,
    `spec/4-nodes/7-trigger/providers/discord.md:76`, `spec/5-system/15-chat-channel.md:432`)은
    `grep` 으로 직접 대조한 결과 이동 후에도 여전히 참이라 drift 대상이 아니다 — 트래커의 "2곳"
    범위 판정과 일치한다.
  - 제안: 코드 되돌리기 아님. `slack.md:275`/`discord.md:297` 를 "Backend 의 `TriggersService`
    가 `chat-channel-input-rules.assertInboundSigningPlaintextByProvider` 를 호출해 트리거 생성
    시점에 검증"으로 정정 — planner 턴 대상이며 이미 durable 트래커(`spec-draft-nullable-notation-followups.md:2523`)에 등재돼 있으니 신규 조치는 불필요, 다음 planner 세션이 처리하면 된다.

- **[INFO] `chat-channel-input-rules.ts` 의 spec 앵커·에러 봉투가 line-level 로 spec 본문과 일치**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:168-193`
    (`assertChatChannelAlreadySetUp`) vs `spec/5-system/15-chat-channel.md:391-411`(§5.4.1.2)
  - 상세: spec 표의 두 행(`chatChannel` 없는 트리거에 사후 부착 → `details.field='chatChannel'`;
    provider 변경 → `details.field='provider'`, 둘 다 `details[].code='INVALID_FIELD'`)과 코드의
    `details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD }` /
    `details: { field: 'provider', code: ErrorCode.INVALID_FIELD }` 가 정확히 일치함을 직접
    대조했다. `ErrorCode.INVALID_FIELD`(`error-codes.ts:116`)의 실제 값도 `'INVALID_FIELD'` 로
    확인. 메시지 문구(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`)도 5필드 전부 동일 상수를 그대로
    참조해 이동 전후 등가성이 깨지지 않았다.
  - 제안: 없음 — 조치 불필요, 확인 기록.

- **[INFO] 신규 단위 테스트 12건을 직접 실행해 통과 확인, 커버리지 공백 없음**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (전체)
  - 상세: `npx jest src/modules/triggers/chat-channel-input-rules.spec.ts` 를 직접 실행 —
    `Tests: 12 passed, 12 total`(`git status --short` 로 잔여물 없음 확인). 이 파일은 `mode==='create'`
    경로와 개별 가드 함수(`assertPatchCarriesNoSecrets`·`assertInboundSigningPlaintextByProvider`·
    `stripChatChannelPlaintext`·`assertChatChannelAlreadySetUp`·`translateSetupChannelError`)를
    직접 호출해 검증한다. `mode==='update'` 디스패치 경로(`assertChatChannelInputSafe(chatChannel,
    'update')` → 내부적으로 `assertPatchCarriesNoSecrets` 호출)는 이 새 파일에 없지만
    `triggers.service.spec.ts:3070-3109`(무편집 기존 스위트, `BLOCKED_FIELD_CASES` 5필드 × PATCH)가
    이미 서비스 경유로 그 경로를 덮고 있어 — 신규 파일과 기존 스위트를 합치면 create/update 두
    디스패치 분기 모두 실제로 실행·단언된다. 공백 없음.
  - 제안: 없음.

- **[INFO] 오버로드 시그니처가 실제 DTO 타입과 컴파일 타임에 정합**
  - 위치: `chat-channel-input-rules.ts:83-90`(오버로드 선언) vs
    `dto/create-trigger.dto.ts:123`(`chatChannel?: ChatChannelConfigDto`),
    `dto/update-trigger.dto.ts:109`(`chatChannel?: ChatChannelUpdateConfigDto`)
  - 상세: `create()`/`update()` 호출부(`triggers.service.ts:404,487`)의 `chatChannel` 인자 타입이
    각각 오버로드의 `mode: 'create'`/`mode: 'update'` 짝과 정확히 일치함을 직접 확인 — `mode`
    문자열과 DTO 타입이 짝을 벗어나면 컴파일 에러가 나는 설계 의도(`#1314` 재발 방지, docstring
    `:79-82`)가 실제로 성립한다.
  - 제안: 없음.

- **[INFO] 알려진 기존 버그(discord verify_key 불일치 → 502) — 이번 PR 이 만든 회귀 아니고 캐너리로 적절히 고정됨**
  - 위치: `chat-channel-input-rules.spec.ts:163-184`(캐너리 테스트), `chat-channel-input-rules.ts:304-318`(`translateSetupChannelError`, 판별식 `/\b(401|403)\b/`)
  - 상세: `discord.adapter.ts` 가 던지는 `'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public
    key 와 불일치'` 는 숫자가 없어 판별식에 안 걸리고 502 로 떨어진다 — 의도(400)와 다르다. 이동
    전부터 있던 결함(테스트 0건)이고, 이번 PR 의 주장("동작 보존")과 정확히 부합하게 **고치지
    않고** 캐너리로 현재 동작을 고정했다. 트래커(`spec-draft-nullable-notation-followups.md:2536`)
    에도 등재돼 있어 유실 위험 없음.
  - 제안: 없음 — 이번 PR 범위 밖, 처리 방침(근본 처방 (b) adapter 가 status 를 메시지에 싣게 통일)
    도 트래커에 이미 기록됨.

## 요약

이 라운드(`6dc2b7d60`)는 직전 `/ai-review`(`15_31_54`)가 지적한 CRITICAL("planner 항목 등재"
주장이 실측상 거짓)과 관련 WARNING 을 실제로 처분했다 — durable 트래커에 3개 항목이 실재하고
plan 체크리스트도 실제 상태로 갱신됐음을 `grep`으로 직접 확인했다. 코드 자체(`chat-channel-input-rules.ts`)는 R-CC-21·§5.4.1.2 의 에러 봉투(`details.field`/`details.code`)·메시지 상수·provider
분기·오버로드 타입 결속이 spec 및 기존 상수 파일과 line-level 로 일치하며, 신규 전용 단위
테스트 12건을 직접 실행해 통과를 재현했다. 남은 유일한 실질 항목은 `slack.md:275`/
`discord.md:297` 의 `TriggersService.X` 귀속 표기 SPEC-DRIFT 인데, 이는 developer 권한 밖이고
이미 durable 트래커에 등재돼 다음 planner 턴을 기다리는 정상 상태다. 이번 diff 자체가 새로
도입한 기능적 결함·엣지케이스 누락·반환값 문제는 발견되지 않았다.

## 위험도

LOW — 코드 결함은 없으나(NONE 급), spec 귀속 문구 2곳이 아직 실제 spec 파일에는 정정되지 않은
채 남아 있어(트래킹만 완료, 반영은 별도 planner 턴 필요) NONE 이 아니라 LOW 로 둔다.
