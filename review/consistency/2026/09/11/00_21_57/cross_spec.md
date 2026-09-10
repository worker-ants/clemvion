# Cross-Spec 일관성 검토 — `spec/5-system` (chatChannel PATCH 비밀 차단, impl-done)

## 검토 범위와 방법

`--impl-done` 모드, scope=`spec/5-system`, diff-base=`origin/main`. 이 브랜치의 `spec/5-system` 델타는
**0개 파일**(코드 전용 PR, `spec_impact: none`)이라, 검토 대상은 "구현이 기존 spec 여러 영역의 정의와
충돌하는가"다. 워킹트리(`/Volumes/.../impl-chat-channel-patch-token-a17c4e`)에서
`git diff origin/main...HEAD` 를 절대경로로 직접 열어 실 diff 11개 파일(백엔드 DTO/서비스/컨트롤러/테스트,
e2e 캐너리, frontend docs mdx 4개)을 확인했고, 프롬프트 번들이 예산 초과로 생략한 `15-chat-channel.md`
· `2-api-convention.md`(일부) · `3-error-handling.md`(일부) · `git diff` 본문은 디스크에서 직접 읽었다.
`plan/in-progress/impl-chat-channel-patch-token.md` 와 `plan/in-progress/spec-draft-nullable-notation-followups.md`
의 기존 실측·추적 항목을 대조해 이미 등재된 항목의 중복 재-flag 을 피했다.

## 발견사항

- **[WARNING]** `SecretResolver.store()` vs `.rotate()` — chat-channel 비밀 저장 호출을 가리키는
  용어가 4개 spec 파일 9곳에서 canonical 인터페이스 계약과 반대로 적혀 있다 (impl-prep 단계에서 이미
  발견됐고 이 PR 은 spec 을 건드리지 않아 여전히 미해소 상태로 남아 있음을 확인)
  - target 위치: `spec/5-system/15-chat-channel.md:200,201,373,390`
  - 충돌 대상: `spec/conventions/secret-store.md` §2/§2.1(`store()`=이미 존재하면 throw / `rotate()`=UPSERT,
    "Trigger 생성(chatChannel 포함) → `rotate()` 권장" + §5.5 예시 코드가 전부 `rotate()`),
    `spec/conventions/chat-channel-adapter.md:354,359`, `spec/4-nodes/7-trigger/providers/telegram.md:58,219`,
    `spec/4-nodes/7-trigger/providers/slack.md:278`
  - 상세: 이번 diff(`triggers.service.ts`)가 실제로 호출하는 메서드는 전수 `this.secrets.rotate(...)`
    (bot token 회전 `[쓰기 ①]` · slack/discord provider-issued signing `[쓰기 ②]` · telegram
    server-issued signing `[쓰기 ③]` 모두)이고 `secrets.store(` 호출은 0건이다. `setupChannel()` 은
    CCH-AD-02 에 의해 생성·활성화·`chatChannel` PATCH 세 갈래에서 반복 호출되는 멱등 함수라, 만약
    문면대로 `store()` (중복 시 throw)를 쓴다면 두 번째 호출부터 setup 이 깨져야 하는데 실제로는
    그렇지 않다 — 9곳의 `.store()` 표기가 stale/오기이고 `secret-store.md` + 실제 호출부가 정본이다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-11 자로 이미
    planner 후속 항목으로 등재돼 있다(`spec/5-system/15-chat-channel.md:200,201,373,390` 등 7~9곳
    일괄 `.store()` → `.rotate()` 정정). 이 라운드에서 새로 발견한 것은 아니며, spec 미변경 상태를
    재확인한 것 — planner 턴 착수 시 처리 대상으로 유지.

- **[WARNING]** `details.field` 형태 — `15-chat-channel.md` §5.4.1/§5.4.1.1 과
  `2-navigation/2-trigger-list.md` PATCH 에러 표는 `botTokenRef`/`inboundSigningPlaintext` 위반을
  **flat** (`details.field='botTokenRef'`) 로 적는데, 이번 PR 이 새로 만든 실측 테스트가 실제 값은
  **비어있지 않은 값일 때 중첩 경로**(`chatChannel.botTokenRef` 등, `details` 는 배열)임을 확정했다
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1(L375) · §5.4.1.1(L392) — `details.field`
    표기
  - 충돌 대상: (1) `spec/5-system/3-error-handling.md` §2.1 — *"`details[].field` 는 중첩/배열 경로를
    `nodes[3].type` 형식으로 유지한다"* (전역 `CustomValidationPipe` 의 일반 규약). (2)
    `spec/2-navigation/2-trigger-list.md` L119-120, L176 — 같은 flat 표기 반복
  - 상세: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` 의 신규
    `[실측]` 케이스가 `CustomValidationPipe` 에 실제 PATCH 바디를 통과시켜 5필드
    (`botToken`/`inboundSigningPlaintext`/`botTokenRef`/`inboundSigningRef`/`inboundSigning`) 전부
    `chatChannel.<field>` 로 나가는 것을 고정했다(비어있지 않은 값 갈래). `null`/`''` 값만 `@IsEmpty()`
    를 통과해 서비스 가드(`assertPatchCarriesNoSecrets`/`assertChatChannelInputSafe`)가 **flat** 이름으로
    거부하고 이때는 `details` 가 단일 object 다 — 즉 답은 "하나"가 아니라 값의 형태에 따라 갈리는
    "둘"인데, spec 문면은 어느 갈래도 명시하지 않고 flat 만 확정적으로 적어 실제 HTTP 응답(비어있지
    않은 값 — 가장 흔한 오용 케이스)과 어긋난다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 2026-09-11 실측표와 함께
    이미 planner 후속으로 등재돼 있다(`15-chat-channel.md` §5.4.1·§5.4.1.1 placeholder/flat 표기,
    `2-trigger-list.md:119-120,176` 정정 대상 명시). 새 발견은 아니며, 이 게이트가 이 상태를 다시
    확인해 planner 턴 전까지 계속 열려 있음을 기록한다.

- **[INFO]** 이번 PR 이 신설한 두 검증 분기(`assertChatChannelAlreadySetUp` — chatChannel 최초 부착을
  PATCH 로 시도 시 `details.field='chatChannel'` 거부, provider 전환 시도 시
  `details.field='provider'` 거부)가 `triggers.controller.ts` 의 `@ApiBadRequestResponse` 인라인
  설명에는 상세히 문서화됐지만, SoT 인 `spec/5-system/15-chat-channel.md` §5.4.1 표와
  `spec/2-navigation/2-trigger-list.md` PATCH 에러 표(`type`/`botTokenRef`/`inboundSigningPlaintext`/
  `endpoint_path` 등 기존 `details.field` 값을 나열하는 문단)에는 아직 반영되지 않았다
  - target 위치: (신규 코드) `codebase/backend/src/modules/triggers/triggers.service.ts`
    `assertChatChannelAlreadySetUp` / `codebase/backend/src/modules/triggers/triggers.controller.ts`
    (L119 부근 `@ApiBadRequestResponse`)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` PATCH 문단(`> PATCH /api/triggers/:id 본문은...`)
    — 기존 `details.field` 값(`type`/`botTokenRef`/`inboundSigningPlaintext`/`endpoint_path`)은
    나열하지만 `chatChannel`/`provider` 는 없음. `spec/5-system/15-chat-channel.md` §5.4.1 표의
    `provider` 행도 "read-only (생성 후 변경 불가)" 라는 정성적 서술만 있고 구체적 400 계약이 없음
  - 상세: provider 불변식 자체는 `2-trigger-list.md` R-12·§2.3.1 이 이미 정책으로 선언하고 있어
    **모순은 아니다** — 다만 그 정책을 실제로 강제하는 400 응답의 정확한 형태(코드/필드명)가 아직
    SoT 문서 어디에도 등재돼 있지 않다. `2-trigger-list.md` 는 다른 유사 위반(예: schedule 타입 PATCH
    제약, `endpoint_path` 충돌)은 `details.field` 값까지 명시하는 관례가 있어, 이 두 신규 분기만
    빠진 상태는 문서 완결성 관점에서 비일관적이다. `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에도 아직 등재되지 않은 새 항목으로 보인다.
  - 제안: 다음 planner 턴에서 `2-trigger-list.md` PATCH 문단과 `15-chat-channel.md` §5.4.1 표에
    `chatChannel`(최초 부착 차단)·`provider`(전환 차단) 의 `details.field` 값을 추가 등재.
    블로킹 사유는 아님(코드가 이미 컨트롤러 Swagger 로 문서화돼 있고, 동작 자체는 기존 정책과
    충돌하지 않음).

## 검증되어 충돌 없음으로 확인된 항목 (참고)

- `ChatChannelUpdateConfigDto`(`OmitType` + `@IsEmpty()` on `botToken`/`inboundSigningPlaintext`) 는
  `spec/5-system/15-chat-channel.md` R-CC-21·§5.4.1·§5.4.1.1 이 서술하는 정책(PATCH 는 두 비밀 필드를
  받지 않는다, telegram server-issued 서명은 예외)과 정확히 일치한다.
- `details` 배열/객체 두 형태 공존은 `spec/5-system/2-api-convention.md` §5.3 "도메인 세부 사유를 어디에
  싣는가" 섹션이 이미 명시적으로 두 형태 모두 유효하다고 선언하고 있어, 서비스 층
  `BadRequestException({ code, message, details: { field } })` (객체 형태) 사용은 이 규약과 충돌하지
  않는다.
- `provider` PATCH 불변식은 `spec/2-navigation/2-trigger-list.md` R-12(*"변경하려면 트리거 삭제·재생성"*)
  와 정합하며, `assertChatChannelAlreadySetUp` 의 provider 전환 차단 로직은 그 정책을 정확히 구현한다.
- Editor 이상 권한 요구(`@ApiForbiddenResponse` 'editor 이상 권한 필요')는
  `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스의 `Trigger: Editor=CRUD` 행과 일치 — 신규 RBAC 충돌 없음.
- frontend `chat-channel-card.tsx` 의 기존 PATCH 저장 로직(botToken/inboundSigningPlaintext 모두
  미전송)은 이번 backend 변경과 이미 정합해 있었고(사전 존재), 이번 PR 은 그 프런트 동작이 실제로
  통과하도록 백엔드를 맞춘 것이라 새 프런트-백엔드 계약 불일치를 만들지 않는다.
- `spec/1-data-model.md` §2.8 Trigger 의 `chat_channel_*` 컬럼·`hasBotToken` derived 필드 정의는
  이번 diff 가 건드리지 않았고 여전히 정합하다.
- 감사 로그 — 이번 diff 는 전부 400 거부(영속 변경 없음) 경로만 추가해 `spec/5-system/1-auth.md` §4.1
  감사 액션 카탈로그에 새로 등재할 이벤트가 없다.

## 요약

이번 구현(`ChatChannelUpdateConfigDto` 도입 + PATCH 비밀-쓰기 게이팅 + provider/최초-설정 불변식
강제)은 `spec/5-system/15-chat-channel.md` 의 R-CC-21·§5.4.1·§5.4.1.1 정책, RBAC 매트릭스, API 규약의
`details` 이원 형태, `2-trigger-list.md` R-12 provider 불변식과 폭넓게 정합하며 새로운 CRITICAL 충돌은
없다. 다만 이 구현이 스스로 실측해 드러낸 두 개의 spec 문면 오류 — (1) `SecretResolver.store()` vs
`.rotate()` 명명, (2) `details.field` flat vs 중첩 경로 — 는 spec 이 코드 전용 PR 이라 여전히 정정되지
않은 채 `spec/5-system`·`spec/2-navigation`·`spec/conventions` 여러 파일에 걸쳐 남아 있고, 둘 다 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속으로 정확히 등재돼 있어
차단 사유는 아니다. 추가로, 이번 PR 이 신설한 두 검증 분기(chatChannel 최초 부착 차단·provider 전환
차단)의 구체적 400 계약이 SoT 문서에는 아직 반영되지 않은 것을 INFO 로 새로 기록한다.

## 위험도

MEDIUM
