# 테스트(Testing) 리뷰 — chat-channel-input-rules 추출 (impl-chat-channel-binder)

## 검토 범위

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (신규, 순수 함수 6개 export)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (해당 6개 메서드를 신규 모듈 호출로 치환, 순수 이동)
- `plan/in-progress/impl-chat-channel-binder.md`, `review/consistency/2026/09/11/14_59_33/*` — plan/consistency 산출물. 테스트 관점 발견사항 없음(코드 변경이 아님) — 다만 plan 체크리스트의 테스트 관련 공백은 아래 발견사항에서 참조.

리뷰 중 저장소 파일은 수정하지 않았다(읽기·grep·격리된 node 스니펫 실행만). `git status --short` 로 원상태 확인 완료 — 변경 없음.

## 사실관계 실측 (판단 근거)

- 커밋 `2ae81077c`(`refactor(triggers): chat-channel 입력 규칙을 TriggersService 에서 떼어낸다`)의 `git show --numstat -- '*.spec.ts'` 결과는 **공백(diff 0줄)** — "테스트 무편집 이동" 주장이 사실과 일치한다.
- `triggers.service.spec.ts` 안에 `service['assertX']` 류의 private-메서드 직접 접근/spy 패턴은 **0건**(grep 확인) — 메서드를 모듈 함수로 옮겨도 은닉 결합이 깨질 자리가 없었다.
- `npx jest src/modules/triggers/triggers.service.spec.ts` 재실행: **123 passed, 1 skipped** — 회귀 없음, GREEN.
- 옮겨진 6개 함수 중 5개(`assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertChatChannelAlreadySetUp`/`stripChatChannelPlaintext`/`assertInboundSigningPlaintextByProvider`)는 `triggers.service.spec.ts` 안에서 `botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/`inboundSigningPlaintext` 각 필드의 null/빈문자열/누락/형식오류 조합, provider 전환 거부, PATCH 최초-설정 거부 케이스로 촘촘히 간접 커버된다(실측: grep 라인 다수 확인).
- 6번째 함수 `translateSetupChannelError` 는 **전체 backend 테스트베이스에서 직접·간접 테스트가 0건**이다(`grep -rn "translateSetupChannelError\|BOT_TOKEN_INVALID\|CHAT_CHANNEL_SETUP_FAILED" --include="*.spec.ts"` → discord adapter 자체 에러 메시지 테스트 1건만 존재, `TriggersService` 를 통한 변환 결과를 단언하는 테스트는 없음).

## 발견사항

- **[WARNING]** `translateSetupChannelError` 의 401/403 정규식 판별이 자신이 문서에서 예로 든 discord 케이스와 실제로 어긋나는데, 이를 잡을 테스트가 없다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:304-318` (함수 `translateSetupChannelError`), 원인 쪽은 `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:93-94` (verify_key 불일치 시 `throw new Error('BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와 불일치')`).
  - 상세: `translateSetupChannelError` 의 docstring(게이트 296-302)은 "adapter 가 throw 하는 Error 의 message 에 status code 가 포함됨을 가정"한다고 적고 discord 케이스로 `"Discord getApplicationMe failed: 403"` 같은 패턴을 예시로 든다. 그런데 discord adapter 의 실제 verify_key 불일치 분기는 숫자 401/403 없이 `"BOT_TOKEN_INVALID: ..."` 문자열만 던진다. 이 메시지를 실제로 `translateSetupChannelError(new Error(msg))` 에 넣어 재현한 결과(격리된 node 스니펫), `/\b(401|403)\b/` 매치가 실패해 의도한 400 `BOT_TOKEN_INVALID` 가 아니라 fallback 502 `CHAT_CHANNEL_SETUP_FAILED` 로 떨어진다. 즉 "잘못된 앱/키 등록"이라는 사용자 원인 오류가 서버 오류(502)로 응답될 수 있다. 이 함수는 이번 PR 이 verbatim 으로 옮겼을 뿐이라 회귀는 아니지만(옮기기 전 `triggers.service.ts` 에서도 테스트 0건이었다), 지금이 DI 없는 순수 함수로 분리돼 가장 싸게 테스트를 붙일 수 있는 시점이다 — 이 gap 을 이번에 놓치면 다음에도 같은 이유로 놓친다.
  - 제안: `translateSetupChannelError` 에 대한 전용 유닛 테스트를 추가한다 — 최소 (a) `"...401..."`/`"...403..."` 포함 메시지 → `BOT_TOKEN_INVALID`, (b) 그 외 메시지 → `CHAT_CHANNEL_SETUP_FAILED`, (c) discord adapter 가 실제로 던지는 `"BOT_TOKEN_INVALID: ..."` 리터럴(숫자 없음) 을 넣어 **의도한 매핑이 맞는지**(현재는 안 맞는다) 검증하는 케이스. (c) 가 RED 로 나오면 정규식을 `/\b(401|403)\b/` 대신 discord 의 리터럴 코드명까지 포괄하도록 넓히거나, adapter 쪽에서 메시지에 실제 HTTP status 를 싣도록 조정할지 판단 근거가 된다.

- **[INFO]** 신규 순수 함수 모듈에 전용 단위 테스트 파일이 없다 — 전 커버리지가 `TriggersService` 경유 간접 테스트에 의존.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` 전체(신규 파일). 대응 스펙 파일 부재: `chat-channel-input-rules.spec.ts` 없음(`find codebase/backend/src/modules/triggers -iname "*chat-channel*"` 확인).
  - 상세: 이 PR 의 설계 근거(plan §"왜 클래스가 아니라 함수인가")는 "의존 0개라 DI 불필요, 테스트 파일 무편집이 순수 이동의 증거"다 — 이는 *이번 이동이 안전했다*는 증거로는 타당하지만, 이동으로 얻으려던 이차 효과인 **테스트 용이성 향상**(NestJS TestingModule/repo·registry·secret mock 없이 순수 함수를 직접 호출해 검증)은 실현되지 않았다. plan 체크리스트(§체크리스트)에도 "T1 대상 직접 유닛 테스트 추가"라는 항목이 없어, 후속 세션이 이 기회를 다시 놓치기 쉽다.
  - 제안: `chat-channel-input-rules.spec.ts` 를 추가해 6개 함수를 mock 없이 직접 호출하는 좁은 유닛 테스트로 옮기거나 보완한다(위 `translateSetupChannelError` 케이스가 첫 항목이 된다). 기존 `triggers.service.spec.ts` 의 통합형 테스트는 "서비스가 이 규칙들을 올바른 시점에 호출하는가"를 계속 담당하도록 역할을 나누면 두 계층(단위/통합)의 책임이 명확해진다.

- **[INFO]** 커밋 메시지가 인용하는 "뮤테이션 5/5 RED" 검증은 1회성 수동 절차로 보이며 저장소에 재현 가능한 스크립트로 남지 않는다.
  - 위치: 커밋 `2ae81077c` 본문 "## 증거" 섹션(코드 아님, plan 도 이를 재실행 가능한 형태로 남기지 않음).
  - 상세: 이 자체는 결함이 아니다 — 실제로 `triggers.service.spec.ts` 123개 테스트가 재실행 시 GREEN 임을 이번 리뷰에서도 재확인했고(위 실측), 옮겨진 5/6 함수는 이 회귀 스위트가 계속 촘촘히 지킨다. 다만 그 "5/5 RED" 라는 수치 자체는 다음 세션이 검증 없이 재인용할 수 있는 서술이므로, 재현 명령(어떤 가드를 어떻게 무력화했는지)을 plan 이나 커밋에 남겨두면 다음 리뷰가 재현 가능한 근거로 쓸 수 있다.

## 요약

이번 변경은 순수 함수 추출로 동작을 보존한 리팩터이며, `git show --numstat -- '*.spec.ts'` 실측 diff 0줄과 `triggers.service.spec.ts` 123 passed 재실행으로 회귀 안전성이 확인된다. private 메서드 직접 접근 패턴이 테스트에 없어 이동으로 인한 은닉 결합 파손 위험도 없다. 다만 옮겨진 6개 함수 중 `translateSetupChannelError` 는 이동 전후를 통틀어 테스트가 전무하며, 실제로 재현해 보니 자신이 예시로 든 discord verify_key 불일치 케이스에서조차 의도한 400 이 아니라 502 로 떨어지는 정규식-메시지 불일치가 있다(사전 존재 결함, 이번 PR 의 회귀는 아님). 또한 이번 추출로 DI 없는 순수 함수가 됐음에도 전용 단위 테스트 파일을 추가하지 않아, 리팩터의 이차 동기인 "테스트 용이성" 개선이 아직 실현되지 않았다.

## 위험도

MEDIUM
