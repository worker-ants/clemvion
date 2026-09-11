# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** 모듈 경계 이동이 만든 spec 귀속 drift 가 "등재했다"는 커밋 주장과 달리 어떤 트래커/plan 산출물에도 실려 있지 않다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:227` (`assertInboundSigningPlaintextByProvider` export 정의) · `plan/in-progress/impl-chat-channel-binder.md:93-96` (철회된 "얇은 delegator" 처방)
  - 상세: `assertInboundSigningPlaintextByProvider` 가 `TriggersService` 의 private 메서드에서 module-level 함수(T1)로 이동하면서, `spec/4-nodes/7-trigger/providers/slack.md:275` 와 `discord.md:297` 이 못박은 `TriggersService.assertInboundSigningPlaintextByProvider` 귀속 서술이 문법적으로 성립 불가능해졌다(consistency-check `review/consistency/2026/09/11/14_59_33` WARNING #2, 이미 확인됨). plan 문서는 애초에 "얇은 위임 메서드로 남긴다"(`impl-chat-channel-binder.md:93-96`)는 처방을 세웠으나, 실제 커밋 메시지는 그 처방을 스스로 철회했다 — 호출부(`assertChatChannelInputSafe`)도 같은 모듈로 함께 옮겨져 delegator 가 아무도 호출하지 않는 죽은 코드가 되므로 "문서를 문자적으로 참으로 만들기 위한 잔재"라 판단해 남기지 않았다는 것이다. 그 판단 자체는 합리적이지만, 커밋 메시지는 그 대신 "planner 항목으로 등재"했다고 적는데, `git diff HEAD~1 HEAD --stat -- plan/` 로 확인하면 이 커밋에서 변경된 plan 파일은 신규 `impl-chat-channel-binder.md` 하나뿐이고 그 파일의 체크리스트(`:139-147`)에도, 기존 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에도 "slack.md/discord.md 의 TriggersService.X 표기 정정" 항목이 실제로 추가된 흔적이 없다. 즉 모듈 경계를 옮긴 결과로 생긴 공개 계약(spec 이 가리키는 심볼 경로) 문서화 부채가 **어디에도 추적되지 않는 상태**로 남는다.
  - 제안: 이 라운드(또는 `--impl-done` 이전)에 `plan/in-progress/impl-chat-channel-binder.md` 체크리스트나 `spec-draft-nullable-notation-followups.md` 트래커에 "slack.md:275/discord.md:297 의 `TriggersService.X` 귀속 표기를 `TriggersService` 가 `chat-channel-input-rules` 의 함수를 호출한다는 서술로 정정 (planner 턴)" 항목을 실제로 추가한다. 커밋 메시지의 "등재했다"는 과거형 주장과 실제 산출물이 어긋나지 않도록 맞춘다.

- **[INFO]** `chat-channel-input-rules.ts` 파일명·docstring 이 약속하는 스코프("입력 규칙")보다 실제 내용이 넓다 — 출력측 에러 변환 함수가 섞여 있다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:15-16` (모듈 docstring "chat-channel **입력 규칙**") vs `chat-channel-input-rules.ts:304-318` (`translateSetupChannelError` 정의)
  - 상세: 모듈 상단 docstring 은 이 파일을 "`chat-channel` **입력 규칙**" · "도메인 검증·정화 계층"으로 명시적으로 스코프한다. 그런데 `translateSetupChannelError` 는 입력 검증이 아니라 `adapter.setupChannel` 이 던진 **외부 API 응답 에러를 사후 변환**하는 함수다(401/403 → `BOT_TOKEN_INVALID`, 그 외 → `CHAT_CHANNEL_SETUP_FAILED`). "0개 외부 협력자 의존"이라는 T1 분류 기준(응집 축)은 만족하지만, 파일이 스스로 선언한 "입력 규칙"이라는 응집 축과는 어긋난다. 다음 사람이 "chat-channel 입력을 검증/정화하는 함수를 찾으러" 이 파일을 열었을 때 목적이 다른 함수가 섞여 있어 파일의 책임 경계가 이름보다 흐려진다.
  - 제안: 파일명/docstring 을 "chat-channel 도메인 규칙 (입력 검증 + 외부 에러 변환)"처럼 넓히거나, `translateSetupChannelError` 를 별도 파일(예: `chat-channel-error-translation.ts`)로 분리한다. 지금 당장 급한 문제는 아니므로 다음 관련 편집 시 처리해도 무방하다.

- **[INFO]** `assertPatchCarriesNoSecrets` 가 외부 소비자·spec 앵커 없이 export 되어 모듈의 공개 표면이 불필요하게 넓다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:138-140` (export 선언)
  - 상세: `grep -rn "assertPatchCarriesNoSecrets" codebase/backend/src spec/` 로 확인하면 이 함수는 같은 파일의 `assertChatChannelInputSafe` 내부(:123)에서만 호출되고, `triggers.service.ts` 를 포함한 어떤 외부 모듈도 import 하지 않으며 spec 문서 어디에도 이름으로 언급되지 않는다(같은 조건의 다른 5개 함수 중 4개는 `triggers.service.ts` 가 실제로 import 해 쓰고, 1개(`assertInboundSigningPlaintextByProvider`)는 spec 5곳이 이름으로 참조한다 — 이 함수만 두 근거 다 없다). 인터페이스 분리 관점에서 이 함수는 모듈 내부 구현 세부로 남아도 충분하다.
  - 제안: `export` 를 제거하거나(내부 헬퍼로 강등), 혹은 향후 controller/다른 서비스에서 직접 재사용할 계획이 있다면 그 계획을 docstring 에 한 줄 남긴다.

- **[INFO]** provider 분기 확장성 안전장치가 주석 규율에만 의존 — 컴파일러/런타임이 신규 provider 를 강제로 못 잡는다 (이동 전부터 존재, 이번 PR 은 그대로 옮김)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:222-225` (docstring 경고) · `:233-289` (`assertInboundSigningPlaintextByProvider` 본문 if/else 분기)
  - 상세: `CHAT_CHANNEL_PROVIDERS`(`dto/chat-channel-config.dto.ts:38`)에 4번째 값이 추가돼도 `provider: ChatChannelProvider` 타입 자체는 넓어질 뿐이고, 이 함수의 `if (provider === 'telegram') ... / else { 필수+정규식 }` 구조는 컴파일 에러도 런타임 예외도 내지 않는다 — 새 provider 는 "provider-issued, 값 존재 필수"로 취급되지만 slack/discord 전용 정규식 검사(`provider === 'slack' && ...`, `provider === 'discord' && ...`)를 둘 다 건너뛰어 **형식 검증 없이 통과**한다. docstring 이 이 위험을 명시적으로 경고하고 있어(주석 규율로 대응) 알려진 부채이고 이번 PR 이 새로 만든 문제는 아니지만, "순수 함수로 뽑아 테스트/뮤테이션으로 안전망을 강화한" 이번 이동이 구조적 안전장치(예: `switch` + exhaustive `default: assertNever(provider)`)로 굳힐 좋은 기회였다.
  - 제안: 급하지 않으면 다음 provider 추가 PR 에서 `switch`+`assertNever` 패턴으로 교체해 컴파일 타임 강제로 승격한다.

## 요약

이번 PR 은 `TriggersService` 에서 협력자 의존이 0인 6개 순수 검증/변환 함수를 별도 모듈(`chat-channel-input-rules.ts`)로 뽑아내는 **의도가 분명한 리팩터**다. 이동 범위를 `this.*` 참조 전수 조사로 정하고(T1=0의존 vs T2=6의존), 과거 순환 의존(`#676`)을 되살리지 않도록 `triggers/` 안에 남긴 결정, 오버로드로 `mode`/DTO 타입을 컴파일 타임에 묶어 이전 CRITICAL 재발을 막은 설계, 테스트 diff 0줄 + 뮤테이션 5/5 RED 로 커버리지 이동을 증명한 방법론 모두 아키텍처 관점에서 견고하다. 순환 의존은 없고 레이어 경계도 새로 흐려지지 않았다. 다만 이 이동이 만든 **공개 계약 변화**(spec 두 곳이 가리키던 `TriggersService.X` 심볼이 사라짐)에 대해 developer 가 스스로 "delegator 를 남기지 않기로" 재판단한 근거는 합리적이나, 그 대신 하겠다고 커밋 메시지에 적은 "planner 항목 등재"가 실제 산출물(plan 체크리스트/트래커)에는 반영되지 않아 이 라운드 종료 시점에 추적 공백이 남는다 — 이것이 유일한 실질적 지적이며 나머지는 낮은 우선순위의 응집도/인터페이스 폭 관련 INFO 다.

## 위험도
LOW
