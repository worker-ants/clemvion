# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-chat-channel-binder-drift.md`

## 검토 방법

target draft 가 verbatim 으로 인용한 4개 편집 대상(ⓐ~ⓔ)을 실제 `spec/**` 현재 상태와 대조하고,
`review_guard._glob_to_regex` 정본 구현·실제 `codebase/backend/src/modules/triggers/` 파일 목록으로
draft 의 정량 주장(글롭 매칭 수·8/10 미등재 등)을 재현했다. 그 위에서, draft 가 "드리프트 범위는
3곳" 이라고 선언한 완결성 주장 자체를 검증하기 위해 T1(`#1319`)·T2(`#1320`)로 이동한 심볼 전체
(`setupChatChannel` 외에 `assertInboundSigningPlaintextByProvider` 등)를 `spec/` 전체에서
`TriggersService\.` 접두 패턴으로 재검색했다.

## 발견사항

- **[WARNING]** T1 이 옮긴 다른 심볼(`assertInboundSigningPlaintextByProvider`)의 `TriggersService.` 접두가 draft 스코프 밖에 남는다
  - target 위치: `plan/in-progress/spec-draft-chat-channel-binder-drift.md` §③ "귀속 표기 3곳" 및 그 앞 문단 — *"드리프트 범위는 3곳이다 — 나머지 6곳은 대상이 아니다... **주어를 확인해 가른 결과**다"*
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297`
  - 상세: 두 파일 모두 *"Backend 의 `TriggersService.assertInboundSigningPlaintextByProvider` 가 trigger 생성 시점에 정규식 검증"* 이라고 클래스 접두를 달아 서술한다. 그런데 이 함수는 `git log --oneline -- codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 로 확인하면 커밋 `ba634a4b0`("chat-channel 입력 규칙을 `TriggersService` 에서 떼어낸다... `#1319`") 로 **T1 에서 이미 `TriggersService` 밖으로 이동**했다. 현재 `triggers.service.ts` / `chat-channel-binder.service.ts` 어디에도 이 함수가 없고(`grep` 0건), `chat-channel-input-rules.ts` 의 독립 exported pure function(DI 없음)이다. draft 는 "전수 분류(출현 9건)" 를 문자열 `setupChatChannel` 로만 수행했는데, 같은 T1 이동이 만든 또 다른 클래스-접두 드리프트가 다른 grep 축(함수명이 다름)에 있어 그 분류에 걸리지 않았다. draft 의 "3곳" 완결 선언이 실제로는 "`setupChatChannel` 이라는 한 심볼 기준 3곳" 이라 스코프가 한 칸 좁다.
  - 제안: draft §③ 에 네 번째 항목으로 이 두 파일을 추가하거나, 명시적으로 "이 턴은 `setupChatChannel` 심볼만 다루고 `assertInboundSigningPlaintextByProvider` 귀속은 별도 트래커 항목" 이라고 스코프를 좁혀 적어 완결성 주장과 실제 범위를 맞출 것.

- **[WARNING]** 편집 대상 파일(`data-flow/14-chat-channel.md`) 안에서도 §0 수정과 §1.3 표 헤더가 어긋난다
  - target 위치: draft ⓒ 편집(`data-flow/14-chat-channel.md` §0 구현 파일 목록, 29번째 줄을 두 줄로 분리)
  - 충돌 대상: 같은 파일 §1.3 `spec/data-flow/14-chat-channel.md:148~150` — `| 단계 | 흐름 (\`triggers.service.ts\`) | sink |` 표 헤더 및 "최초 setup" 행의 `setupChatChannel` 서술
  - 상세: draft 의 ⓒ 수정은 §0 목록에서 `setupChatChannel`/`teardownChatChannel` 을 `chat-channel-binder.service.ts` 로, `rotateBotToken`/`cleanupRotatedChatChannelTokens` 만 `triggers.service.ts` 로 남기도록 가른다. 그런데 바로 아래 §1.3 은 표 전체(회전·cleanup 뿐 아니라 "최초 setup" 행까지)를 `흐름 (\`triggers.service.ts\`)` 한 열로 묶어 서술한다 — "최초 setup" 행이 바로 `setupChatChannel` 이므로, ⓒ 적용 후 이 파일은 §0(정확)과 §1.3(구식)이 서로 다른 파일을 지목하는 내부 불일치 상태가 된다. draft 의 "전수 분류 9건" 은 리터럴 문자열 `setupChatChannel` 출현만 셌고, 이 표 헤더는 그 문자열을 포함하지 않아(헤더 자체엔 함수명이 없다) 분류에서 누락됐다.
  - 제안: §1.3 표 헤더를 열 분리하거나(예: "최초 setup" 행만 별도 각주로 `chat-channel-binder.service.ts` 귀속을 밝힘), 최소한 헤더 옆에 "회전/cleanup 은 `triggers.service.ts`, 최초 setup 은 `chat-channel-binder.service.ts`" 주석을 추가.

- **[INFO]** `providers/telegram.md` 의 caller 서술이 (b) 항목과 동일 패턴인데 draft 범위 밖
  - target 위치: draft ⓑ 편집(`chat-channel-adapter.md` §2.4 JSDoc, *"caller (\`TriggersService.setupChatChannel\`)"* → *"caller (\`ChatChannelBinderService.setupChatChannel\` — ... )"*)
  - 충돌 대상: `spec/4-nodes/7-trigger/providers/telegram.md:58` — *"plaintext 는 SetupResult.issuedInboundSigning 로 1회만 노출 → caller (TriggersService) 가 SecretResolver.rotate(...) 로 보관"*
  - 상세: 동일한 사실("`setupChannel` 이후 caller 가 `rotate()` 로 보관")을 서로 다른 두 spec 파일이 서술하는데, draft 적용 후 `chat-channel-adapter.md` 는 "`ChatChannelBinderService`(binder) 가 caller, `TriggersService` 는 그 binder 를 호출)" 로 정정되는 반면 `telegram.md` 는 여전히 "caller (TriggersService)" 로 남아 같은 사실에 대해 두 파일이 다른 문구를 갖게 된다. 클래스 리터럴은 없지만 괄호 안 클래스명 표기가 (b) 와 같은 패턴이라 grep(`setupChatChannel`)에 걸리지 않았을 뿐 실질은 동일한 드리프트.
  - 제안: 여유가 있다면 같은 턴에 `telegram.md:58` 도 "caller (`ChatChannelBinderService` — `TriggersService` 가 호출)" 식으로 맞추거나, 트래커에 후속 항목으로 명시.

## 그 외 확인된 사항 (문제 없음)

- ⓐⓑⓒⓓⓔ 5개 verbatim 인용은 모두 현재 `spec/**` 내용과 정확히 일치 (문자 단위 대조).
- `code:` glob 3개(`chat-channel-*.ts` · `dto/chat-channel-*.dto.ts` · `trigger-callback-url*.ts`) 를 `review_guard._glob_to_regex` 로 재현 매칭한 결과 10개 일치·차집합 0 — draft 의 정량 주장과 실측이 일치. `_MAX_GLOB_WILDCARDS=6` 대비 사용 3, 상한 내.
- `chat-channel-binder.service.ts` 의 `setupChatChannel`/`teardownChatChannel` public 메서드, `triggers.service.ts` 의 `this.chatChannelBinder.setupChatChannel(...)`/`teardownChatChannel(...)` 호출부 존재를 코드에서 직접 확인 — §7 새 5파일 및 주석 정정 내용과 부합.
- `secret-store.md §5.5` 코드 예시(라인 355~382)는 특정 클래스에 귀속되지 않는 범용 예시라 draft 가 "코드 예시라 불변" 으로 분류한 판단은 타당.
- `spec/conventions/spec-impl-evidence.md` R-1 이 "글로브 허용" 을 이미 정식 채택한 컨벤션이라, draft 의 glob 결정이 이 상위 규약과 상충하지 않고 오히려 그 규약이 지적한 약점(stale glob 검출 불가)을 실측으로 보완하는 방향과 일치한다.
- `spec/4-nodes/7-trigger/providers/discord.md:76` · `spec/2-navigation/2-trigger-list.md:155` 의 접두 없는 `assertInboundSigningPlaintextByProvider` 언급은 이동 후에도 참 — 문제 없음.
- `TriggersService.` 접두가 붙은 다른 참조들(`findByEndpointPath` · `update()` · `remove()`/`delete()` · `assertAuthConfigInWorkspace` · `assertNotificationUrlSafe` · `rotateNotificationSecret` · `promoteRotatedNotificationSecrets` · `revokePerTriggerToken` · `rotateBotToken`)은 모두 실제로 `TriggersService` 에 남아 있는 메서드로, T1/T2 이동과 무관하며 정확하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 동일 트래커 항목(§"`setupChatChannel` 귀속 표기 3곳...")이 있으나 이 draft 가 그 항목을 그대로 승계·종결하는 구조라 중복 작업 충돌은 없다. 단, 그 트래커 항목 자체도 "3곳" 프레이밍이라 위 WARNING 의 근본 원인(원 소스가 `setupChatChannel` 한 심볼 기준으로만 스캔됨)을 공유한다.

## 요약

target draft 가 인용하는 5개 편집 대상은 현재 `spec/**` 상태와 문자 단위로 일치하고, glob 매칭·코드 심볼 존재 등 정량 주장은 모두 재현 검증에 통과해 데이터 모델·API 계약·상태 전이·RBAC 축에서는 충돌이 없다. 다만 draft 가 스스로 내세우는 "드리프트 범위는 3곳" 이라는 완결성 주장은 검증 결과 사실이 아니다 — 같은 T1/T2 이동이 만든 동일 성격의 클래스-접두 드리프트가 `providers/slack.md`·`providers/discord.md`(다른 함수명이라 draft 의 grep 축에 안 걸림)와, 심지어 draft 가 직접 편집하는 `data-flow/14-chat-channel.md` 내부(§0 대 §1.3)에도 남아 있다. 기능을 깨뜨리는 CRITICAL 급 모순은 아니지만, "전수 분류로 닫았다" 는 draft 의 근거 자체를 좁게 만들어 다음 사람이 또 같은 클래스의 결함을 반복해서 만날 위험이 있다.

## 위험도
MEDIUM
