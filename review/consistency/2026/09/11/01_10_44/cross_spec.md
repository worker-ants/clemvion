# Cross-Spec 일관성 검토 — chatChannel PATCH 비밀 차단 (impl-done, scope=spec/5-system)

## 검토 범위 메모

`spec/5-system` 자체의 diff 는 0개 파일이다(이 브랜치는 spec 을 바꾸지 않았다). 대신 diff 는
`codebase/backend/src/modules/triggers/**`(DTO·controller·service·테스트)를 바꿔 기존 spec
(`spec/5-system/15-chat-channel.md` R-CC-21 / §5.4.1 / §5.4.1.1, `spec/2-navigation/2-trigger-list.md`)이
이미 선언한 정책("PATCH 는 chatChannel 비밀을 받지도 쓰지도 않는다")을 구현했다. 아래 분석은
prompt 번들이 예산 절단으로 생략한 실제 diff(15개 파일 / 1622줄)와 두 spec 파일을 워킹트리에서
직접 대조한 결과다.

## 발견사항

- **[WARNING]** `details.field` 실제 표현(중첩 경로) vs spec 문면(flat/미확정) 불일치
  - target 위치: (구현) `codebase/backend/src/modules/triggers/triggers.controller.ts` PATCH
    `@ApiBadRequestResponse` 신규 서술, `triggers.service.ts` `assertPatchCarriesNoSecrets`,
    `dto/chat-channel-config.dto.ts` `ChatChannelUpdateConfigDto`, 신규 테스트
    `dto/trigger-dto-validation.spec.ts` (`ChatChannelUpdateConfigDto — PATCH 는 비밀을 받지 않는다` describe 블록, 특히 `"[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다"` 케이스)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1 (표 3행: `config.chatChannel.botTokenRef(ref) 는 400 VALIDATION_ERROR (details.field='botTokenRef')`, `config.chatChannel.botToken(plaintext) 도 400 (details.field 는 미확정 — 후속 e2e 확인 대기)`) · `spec/2-navigation/2-trigger-list.md` L176(PATCH 설명) 및 R-12(L333)
  - 상세: 이번 PR 이 새로 작성한 실측 테스트(`trigger-dto-validation.spec.ts`)는 `botToken` /
    `botTokenRef` / `inboundSigning` / `inboundSigningPlaintext` / `inboundSigningRef` 5개
    필드 모두, **값이 비어있지 않으면** 전역 `CustomValidationPipe` 가 `chatChannel.<field>`
    형태의 **중첩 경로**를 `details.field` 로 낸다는 것을 확정했다(`observed` 단언 참고). 이는
    두 spec 문서가 명시한 **flat** `details.field='botTokenRef'` 및 `botToken` 에 대한
    "미확정 — 후속 e2e 확인 대기" 문구와 정면으로 어긋난다. (null/빈 문자열일 때만 서비스
    층이 flat 이름으로 거부하므로, 두 표현이 값의 형태에 따라 실제로 공존한다.) 개발자 스스로도
    `plan/in-progress/impl-chat-channel-patch-token.md`의 "이 턴에 실측해 planner 로 넘길 것"
    표에 "flat 표기(`details.field='botTokenRef'`)를 적은 spec 문면 쪽이 낡았다"고 명시하며
    planner 후속을 요청해 두었다 — 즉 이 발견은 이미 인지되어 있으나 **아직 spec 텍스트에
    반영되지 않은 상태로 병합 대상에 포함**된다.
  - 제안: `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 과 `spec/2-navigation/2-trigger-list.md`
    L176·R-12 의 `details.field` 서술을 `trigger-dto-validation.spec.ts` 의 `[실측]` 값(값
    존재 시 `chatChannel.<field>` 중첩 경로 / null·빈 문자열은 서비스 층 flat 이름)으로
    planner 턴에서 갱신. developer 는 이 문장들을 스스로 쓰지 않았으므로(§자기-반증형 소정정
    조건 1 미충족) 직접 고칠 수 없고, plan 이 이미 그렇게 분류해 두었다 — push 전 게이트에서
    이 항목이 누락되지 않도록 재확인 필요.

- **[INFO]** 신규 400 분기 2종(최초 chatChannel 설정을 PATCH 로 시도 / provider 전환 시도)이
  도메인 spec 표에 아직 등재되지 않음
  - target 위치: `triggers.service.ts` 신규 `assertChatChannelAlreadySetUp` (`details.field='chatChannel'`
    / `details.field='provider'`), `triggers.controller.ts` PATCH `@ApiBadRequestResponse`
    갱신 문구 "(2) chatChannel 이 없는 트리거에 처음 붙이려는 경우 … (3) provider 를 바꾸려는 경우"
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1 표 (4행 중 "최초 트리거 생성"/
    "chatChannel 이 실린 PATCH" 두 행만 있고 "PATCH 로 최초 설정 시도"·"PATCH 로 provider 전환
    시도" 행은 없음), `spec/2-navigation/2-trigger-list.md` R-12("변경하려면 트리거 삭제·재생성"
    — HTTP 표면화 방식은 미기술)
  - 상세: provider 전환 차단 자체는 R-12 의 취지와 **방향은 일치**하지만(코드 주석도
    "`2-trigger-list.md R-12` 도 *변경하려면 트리거 삭제·재생성*이라 적는다" 라고 직접
    인용), 그 취지가 **PATCH 400 `details.field='provider'`** 로 표면화된다는 사실 자체는
    두 spec 어디에도 명시적 행으로 없다. "최초 설정 PATCH 차단"(`details.field='chatChannel'`)은
    아예 새로운 규칙이며 CCH-AD-02("Trigger enable/신규 생성 및 chatChannel 이 실린 일반
    PATCH 시 setupChannel 자동 호출")의 문면만으로는 "PATCH 로 최초 부착이 불가능하다"가
    도출되지 않는다. 기능적으로는 타당한 방어(secret 없이 setupChannel 호출 시 조용한
    degraded 상태를 막음)이나, SoT 문서가 이 표면을 아직 카탈로그화하지 않아 다음 개발자가
    이 두 사유의 존재를 spec 만 보고는 알 수 없다.
  - 제안: `spec/5-system/15-chat-channel.md` §5.4.1 표에 두 행 추가(또는 각주), R-12 에
    "PATCH 시도 시 400 `VALIDATION_ERROR`(`details.field='provider'`)" cross-link 추가.

- **[INFO]** provider-issued inbound signing 저장 API 서술(`store()`) vs 실제 호출(`rotate()`) —
  이번 PR 범위 밖이지만 같은 파일을 재확인시킴
  - target 위치: `triggers.service.ts` `setupChatChannel`([쓰기 ②] 주석 — "PATCH 에서는 건너뛴다")
  - 충돌 대상: `spec/5-system/15-chat-channel.md` L200(`"inboundSigningPlaintext"` 주석 —
    "service 가 `SecretResolver.store(inboundSigningRef, plaintext)` → strip"), L201, L373,
    L390 등 다수 자리가 `store()` 로 서술
  - 상세: 실제 코드는 provider-issued(slack/discord) 든 server-issued(telegram) 든 전부
    `this.secrets.rotate(...)` 만 호출하고 `secrets.store(...)` 호출은 0건이다(developer 의
    `plan/in-progress/impl-chat-channel-patch-token.md` "이 턴에 실측해 planner 로 넘길 것"
    표에도 동일하게 기록됨, 출처 `--impl-prep 22_45_26 cross_spec W`). 이번 diff 가 새로
    만든 불일치는 아니지만, 이번 diff 가 `setupChatChannel` 의 그 호출부를 그대로 확장했으므로
    (게이팅 조건만 추가) 같은 stale 서술이 이번 병합에도 함께 실려 나간다.
  - 제안: 이미 planner 후속으로 추적 중(`15-chat-channel.md` 9자리 정정) — 이번 PR 에서
    새로 발생한 문제는 아니므로 차단 사유는 아니고, 위 WARNING 항목과 같은 planner 턴에서
    함께 처리하도록 확인차 기록.

## 요약

이번 diff 는 `spec/5-system/15-chat-channel.md` 의 기존 R-CC-21 / §5.4.1 / §5.4.1.1 정책(PATCH 는
chatChannel 비밀을 받지도 쓰지도 않는다)을 코드로 정확히 구현했고, `spec/2-navigation/2-trigger-list.md`
와의 provider/RBAC/책임 분할 측면에서 새로운 모순은 발견되지 않았다(오히려 R-12 의 provider
불변 원칙을 서버 레벨에서 처음으로 강제하는 등 spec 취지를 코드로 수렴시켰다). 다만 이 구현이
직접 만들어낸 실측(`details.field` 는 값이 있을 때 중첩 경로)이 두 spec 문서가 여전히 담고 있는
flat/미확정 서술과 어긋나며, developer 자신도 이를 인지해 planner 후속으로 넘겨 두었다 — 이
사실이 push 전 게이트에서 누락되지 않도록 재확인이 필요하다. 그 외 provider-issued signing
저장 API 서술 불일치는 이번 PR 이전부터 있던 별개 항목으로, 같은 계기로 다시 확인됐을 뿐이다.
치명적(작동 불가) 수준의 모순은 없다.

## 위험도

MEDIUM
