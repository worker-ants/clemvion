# Plan 정합성 검토 — spec/5-system/ (impl-prep, `impl-chat-channel-binder-t2`)

## 발견사항

- **[WARNING]** T2 가 이동시킬 신규 파일 2개가 `15-chat-channel.md` frontmatter `code:` 에
  등재되지 않을 예정 — T1 이 이미 저지른 것과 **같은 결함 클래스의 재발**
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (현재 `triggers/`
    하위는 glob 이 아니라 `triggers.service.ts`·`triggers.controller.ts`·
    `chat-channel-token-rotator.service.ts`·`dto/chat-channel-config.dto.ts` 4개
    **명시 경로**만 등재 — 실측)
  - 관련 plan: `plan/in-progress/impl-chat-channel-binder-t2.md`(본 작업, `spec_impact: none`),
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 2199~2214행("같은 턴에
    병기할 것" 항목, 미해결)
  - 상세: T1(`#1319`)이 신설한 `modules/triggers/chat-channel-input-rules.ts` +
    `.spec.ts` 가 지금도 이 frontmatter `code:` 에 없다는 사실이
    `spec-draft-nullable-notation-followups.md` 에 **"3라운드 연속 관측, 가드는 통과"** 로
    이미 등재돼 있고, 그 이유가 명시돼 있다 — 이 목록은 `modules/chat-channel/**` 한 줄만
    glob 이고 `triggers/` 하위는 전부 파일명 하드코딩이라 신규 파일이 자동으로 안 들어온다.
    "왜 중요한가": `code:` 미등재 파일은 `--impl-done` 게이트의 spec-linked 판정에서 빠져
    **그 파일만 바뀐 변경은 fresh 리뷰를 요구받지 않는다**(지금 R-CC-21 검증 규칙의 정본
    파일이 이 상태). T2 는 `chat-channel-binder.service.ts`(신설) +
    `trigger-callback-url.ts`(신설) 를 만들고 `setupChatChannel`/`teardownChatChannel` 을
    옮기는데, 이 두 파일 역시 같은 명시-경로 목록 방식으로는 **자동 등재되지 않는다** — 열려
    있는 T1 갭에 T2 가 같은 성격의 갭 2개를 더 얹는 셈이다. T2 plan 의 체크리스트(순서 1~5,
    체크리스트 9항목)에는 이 frontmatter 갱신이 **없다**.
  - 제안: T2 체크리스트에 "`15-chat-channel.md` frontmatter `code:` 에
    `chat-channel-binder.service.ts`·`trigger-callback-url.ts` 추가(또는 `triggers/`
    하위를 glob 으로 전환해 재발 자체를 차단)" 항목을 추가할 것. 이는 frontmatter 만의 작은
    편집이라 `spec_impact: none` 과 자연히 상충하므로, `spec_impact` 를
    `[spec/5-system/15-chat-channel.md]` 로 좁게 갱신하거나, 그럴 수 없다면 최소한
    `spec-draft-nullable-notation-followups.md` 의 기존 "같은 턴에 병기할 것" 항목에 T2 의
    신규 파일 2개를 이월 기재해 갭이 더 벌어지는 것을 문서화할 것.

- **[WARNING]** `spec/conventions/` 두 문서가 `setupChatChannel` 의 소유 클래스를
  `TriggersService` 로 현재형 서술 — T2 이동 후 사실이 아니게 된다
  - target 위치: `spec/conventions/secret-store.md:146`(`` `triggers.service.ts.setupChatChannel`
    구현체 모두 `rotate()` 사용 ``), `spec/conventions/chat-channel-adapter.md:369`
    (`SetupResult.issuedInboundSigning` JSDoc — `` caller (`TriggersService.setupChatChannel`)
    가 즉시 `SecretResolver.rotate(...)` ``)
  - 관련 plan: `plan/in-progress/impl-chat-channel-binder-t2.md`(설계 §"새 파일 2개" —
    `chat-channel-binder.service.ts` 의 `ChatChannelBinderService.setupChatChannel`)
  - 상세: 두 인용 모두 **현재 시제**로 "`setupChatChannel` 은 `TriggersService`(또는 그
    파일)에 있다"고 단정한다. T2 가 계획대로 이 메서드를 `ChatChannelBinderService` 로
    옮기면 두 인용은 존재하지 않는 클래스/파일을 가리키게 된다(사실 오류). `secret-store.md:162`
    처럼 "도입 시점" 으로 과거시제 한정한 서술은 영향 없지만, 이 두 곳은 그런 한정이 없다.
    이 저장소가 이미 겪은 "SoT 복제-drift"(`#1112`/`#1113` — 같은 사실이 여러 곳에 박혀
    한쪽만 갱신됨) 와 같은 클래스다. T2 plan 은 이 두 지점을 언급하지 않는다.
  - 제안: T2 완료 후 `--impl-done` 라운드에서 두 인용을 `ChatChannelBinderService.setupChatChannel`
    로 갱신(또는 클래스명을 특정하지 않는 서술로 완화)할 것을 T2 plan 의 "후속" 절에
    미리 등재해 두면 이번처럼 3라운드가 지나서야 발견되는 패턴을 피할 수 있다.

- **[INFO]** `spec-draft-nullable-notation-followups.md` 의 lost-update(동시 PATCH) 후속
  항목이 코드 위치가 `TriggersService` 내부라고 전제한 서술을 유지 중
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 2216~2226행
    (`update() → setupChatChannel()` 구간 트랜잭션 부재, `- [ ]` 미해결)
  - 관련 plan: `plan/in-progress/impl-chat-channel-binder-t2.md`
  - 상세: 이 항목은 T2 가 나누기 전의 호출 경로(`TriggersService.update()` 내부에서
    `this.setupChatChannel()` 직접 호출)를 전제로 처방 후보(advisory lock·`FOR UPDATE`·
    낙관적 버전)를 적어 두었다. T2 이후에는 호출이 서비스 경계를 건너므로(`this.update()`
    → `this.chatChannelBinder.setupChatChannel()`) 같은 트랜잭션/락 안에서 처리하려면
    `EntityManager` 전달 등 인터페이스가 하나 더 필요해진다 — 이 항목을 나중에 집행할 사람이
    T2 의 결과물을 모르면 옛 코드 배치를 찾다 헤맬 수 있다. 다만 T2 자신은 "동작 보존" 이
    유일한 주장이라 이 설계 함의를 지금 처리할 필요는 없다.
  - 제안: T2 완료 시점에 이 항목에 한 줄 각주("호출부가 `ChatChannelBinderService` 로
    이동함 — 락 설계 시 서비스 경계 고려")를 남기는 정도로 충분.

## 요약

`impl-chat-channel-binder-t2` 는 `spec_impact: none` 을 내걸고 순수 코드 이동(동작 보존)을
주장하며, 이동 대상(secret 쓰기 게이팅·ref 보존)의 스코프 확정 근거는 바로 어제~오늘
확정된 R-CC-21/telegram carve-out 결정과 잘 정렬돼 있고 T1/T2 분리 근거도
`spec-draft-nullable-notation-followups.md` 에 이미 상호 참조돼 있어 미해결 결정을 우회하는
움직임은 없다. 다만 실제로 코드를 옮기면 (1) `15-chat-channel.md` frontmatter `code:` 가
신규 파일을 놓치는 문제 — 이는 T1 이 이미 만들어 지금도 열려 있는 바로 그 갭의 재발이고,
(2) `secret-store.md`·`chat-channel-adapter.md` 의 `TriggersService.setupChatChannel` 현재형
인용 2곳이 사실과 어긋나게 된다. `spec_impact: none` 이 이 두 결과를 놓치고 있어, 처리하지
않으면 이전과 같이 여러 라운드 뒤에야 발견될 위험이 있다. 코드 이동 자체를 막을 사유는
없으므로 위험도는 중간으로 판단한다.

## 위험도

MEDIUM
