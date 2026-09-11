# 정식 규약 준수 검토 — `spec/5-system/` (impl-done, T2 chat-channel-binder 추출)

## 검토 방법 메모

프롬프트 번들이 컨텍스트 예산으로 절단돼 `## 구현 변경 사항` diff 본문이 전혀 실리지 않았다
(참조 텍스트만 있고 실제 diff 는 없음 — "예산 절단" 시나리오). 실제 판정을 위해 워킹트리를
직접 열었다:

- `git diff origin/main --stat` 로 실제 변경 파일 확정 (8 codebase 파일 + `plan/in-progress/impl-chat-channel-binder-t2.md`).
- `chat-channel-binder.service.ts`(292줄, 신규) · `trigger-callback-url.ts`(57줄, 신규) ·
  `triggers.service.ts`(258줄 삭제 위주) · `triggers.module.ts` · 관련 `*.spec.ts` 3종을 `Read`/`git diff`로 직접 대조.
- `spec/5-system/15-chat-channel.md` 전문, `spec/conventions/spec-impl-evidence.md`,
  `spec/conventions/review-citations.md` 를 `Read` 로 직접 열어 규약 원문과 대조 (번들에서 절단됨).
- 직전 라운드 산출물 `review/consistency/2026/09/11/17_39_32/convention_compliance.md` 와
  `plan/in-progress/impl-chat-channel-binder-t2.md` / `plan/in-progress/spec-draft-nullable-notation-followups.md`
  를 읽어 이미 등재된 항목과의 중복을 피했다.

이 PR(T2, `spec_impact: none`)은 `TriggersService.setupChatChannel`/`teardownChatChannel` 을
새 `ChatChannelBinderService` 로 옮기는 **순수 이동**이다 — DTO·컨트롤러·에러 코드·감사 액션·
Redis 키 등 이전 라운드가 이미 대조 완료한 표면은 이번 diff 가 건드리지 않았음을
`git diff --stat -- codebase/backend/src/modules/triggers/triggers.controller.ts codebase/backend/src/modules/triggers/dto/` 로 확인했다 (출력 없음 = 무변경). 따라서 그 표면들은 재검증하지 않았다.

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md` 의 `code:` frontmatter 가 이번 이동으로 신설된
  구현 경로를 가리키지 않는다
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter (6~9행) — `triggers/` 하위
    명시 경로 4개(`chat-channel-config.dto.ts` · `triggers.service.ts` · `triggers.controller.ts` ·
    `chat-channel-token-rotator.service.ts`)만 나열, `modules/triggers/**` glob 아님
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` 필드 정의 — "본 spec 이
    약속한 surface 의 구현 경로")
  - 상세: `git -C <워킹트리> diff origin/main --stat` 로 실측한 바, 이번 T2 가 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts`(292줄, `setupChatChannel`/`teardownChatChannel` 정의)와 `trigger-callback-url.ts`(57줄, `buildTriggerCallbackUrl` 정의)를 신설했다. 두 파일 모두 `15-chat-channel.md` 가 "약속한 surface"(§5.4.1 secret 쓰기 게이팅, §CCH-AD-02/03 setup/teardown 계약, callback URL 조립)의 **유일한 구현 위치**가 됐지만 frontmatter `code:` 목록엔 없다. `spec-code-paths.test.ts` 가드는 "글로브가 ≥1 파일에 매치하는가"만 보므로 기존 4개 명시 경로가 여전히 존재해 **빌드는 통과**한다 — 즉 빌드 게이트를 깨지는 않지만, `spec-impl-evidence.md` 가 명시한 "구현 경로 완전성"의 의도와는 어긋난다. 같은 클래스의 결함이 T1(`impl-chat-channel-binder`)의 `chat-channel-input-rules.ts` 신설 때도 났고(3라운드 연속 관측 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 해당 항목의 "2026-09-11 재갱신 — 대상은 6개가 아니라 8개다" 각주), 이번 T2 로 그 갭이 6개 → **8개**로 커졌다.
  - 이미 등재됨: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "`15-chat-channel.md` frontmatter `code:` …" 항목(2026-09-11 재갱신 각주)이 정확히 이 갭을 8개로 재측정해 planner 항목으로 잡아 두었고, glob 전환(`modules/triggers/**`) 대안까지 병기돼 있다 — **이 발견은 새 정보가 아니라 독립 재확인**이다. `developer` 는 `spec/` 쓰기 권한이 없어(자기-반증형 소정정 조건 1 불성립 — 그 frontmatter 는 이전 planner 턴이 씀) 이 PR 이 직접 고칠 수 없는 것도 맞다.
  - §7 "구현 파일 구조" 절(528~538행)도 같은 갭이다 — `triggers/` 블록에 신규 3파일(T1 1 + T2 2)이 없다. **거짓은 아니다**(`triggers.service.ts` 행 "setupChannel / teardownChannel / rotateBotToken **호출** 추가"는 위임 후에도 참) — 누락이다. 같은 planner 항목에 이미 병기돼 있다(`--impl-prep 17_39_32` INFO#1 인용).
  - 제안: 새로 고칠 필요 없음(developer 범위 밖, planner 턴 대기 중) — 다만 SUMMARY 집계 시 "이미 트래커에 등재됨 · 이 PR 을 막을 사유 아님"으로 반영 권장.

- **[INFO]** `spec/conventions/secret-store.md` · `spec/conventions/chat-channel-adapter.md` ·
  `spec/data-flow/14-chat-channel.md` 3곳의 `setupChatChannel` 귀속 표기가 이번 이동으로 부정확해졌다
  - target 위치(참조 자료, target 본체인 `spec/5-system/` 밖): `secret-store.md:146`
    (`` `triggers.service.ts.setupChatChannel` 구현체 ``) · `chat-channel-adapter.md:369`
    (`` (`TriggersService.setupChatChannel`) ``) · `data-flow/14-chat-channel.md:29`
    (`` triggers.service.ts` — `setupChatChannel` / `rotateBotToken` / ... ``)
  - 위반 규약: 특정 conventions 문서의 조항이라기보다 spec-impl-evidence.md 의 "spec 서술이
    실제 구현 위치를 정확히 가리켜야 한다"는 취지에 인접
  - 상세: `git -C <워킹트리> grep -n "setupChatChannel" codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 로 확인한 바 `setupChatChannel`/`teardownChatChannel` 은 이제 `ChatChannelBinderService`(같은 폴더의 별도 클래스)에 정의돼 있고 `TriggersService` 는 `this.chatChannelBinder.setupChatChannel(...)` 로 호출만 한다(`triggers.service.ts:448,565,855`). 위 3곳은 클래스/파일 접두를 붙여 `TriggersService`/`triggers.service.ts` 를 **정의처**로 서술하므로 이제 부정확하다. 실질(그 규칙이 언제 도는지)은 변함없고 **심볼 경로만** 틀렸다.
  - 이미 등재됨: 같은 트래커 파일의 "`setupChatChannel` 귀속 표기 3곳이 T2 이동으로 낡는다" 항목(2026-09-11 등재, `--impl-prep 17_39_32` W2 — `rationale_continuity`+`plan_coherence` 독립 지적)이 이 3곳을 정확히 같은 줄로 특정해 planner 턴으로 이미 넘겨 뒀다. `spec/5-system/15-chat-channel.md` 자체 본문(339·355·432·532·627·801행)은 대조 결과 `TriggersService.setupChatChannel` 식의 클래스 귀속 서술이 없어(함수명만 인용하거나 "호출 추가"로 서술) **target 문서 자체는 이 드리프트에 걸리지 않는다** — 그래서 INFO 로 낮춘다.
  - 제안: 조치 불요(이미 planner 트래커에 정확히 등재, 처방 문구까지 준비됨). 언급은 SUMMARY 교차 확인용.

## 준수 확인 (참고 — 위반 아님)

- **명명**: `ChatChannelBinderService`(PascalCase, `@Injectable()`), `chat-channel-binder.service.ts`(kebab + `.service.ts`) 는 형제 `chat-channel-token-rotator.service.ts` 와 동일 패턴 — 저장소 NestJS 명명 관행과 일치. `trigger-callback-url.ts` 는 의존 0 순수 함수 모듈이라 `.service.ts` 접미를 붙이지 않은 것도 T1 선례(`chat-channel-input-rules.ts`)와 일관.
- **review-citations.md 준수**: 이번 diff 의 `codebase/**` 신규 주석이 인용한 세션은 모두 `review/code/2026/09/11/18_04_36` · `18_42_05` · `19_06_54` · `review/consistency/2026/09/11/17_39_32` 등 **전체 경로 형식**이며 bare `hh_mm_ss` 는 0건(전수 grep 확인) — §2 "전체 경로(권장)" 준수. `plan/in-progress/impl-chat-channel-binder-t2.md` 안의 bare 인용(`` `18_04_36` `` 등)은 §3 표가 `plan/**` 문서를 명시적으로 규약 "대상 아님"으로 갈라 둔 항목이라 위반이 아니다.
- **secret-store.md 의미론**: 이동된 `setupChatChannel` 내부의 `rotate()`(UPSERT, botToken/inbound-signing) 사용, `secret://triggers/{id}/{bot-token,inbound-signing}` URI 스킴(`buildSecretRef({ scope: 'triggers', ... })`) 은 원본 그대로 옮겨졌고 §2.1/§5.5 규약과 여전히 일치 — 이동이 시맨틱을 바꾸지 않았음을 직접 코드로 확인.
- **DTO/Swagger/에러코드/감사액션 표면**: 이번 diff 는 `triggers.controller.ts`·`dto/**` 를 건드리지 않음(`git diff --stat` 출력 0) — 직전 라운드(`17_39_32`)가 확인한 rotate-bot-token OpenAPI 데코레이터 갭(W3, 사전 존재·범위 밖)·`readOnly` INFO 는 이번 diff 로 악화되지도 개선되지도 않았다. 재검증 불필요.
- **spec-impl-evidence.md 빌드 게이트**: `code:` 목록 미갱신에도 불구, 목록에 남아 있는 4개 명시 경로가 여전히 실존해 `spec-code-paths.test.ts` 는 그대로 통과 — 이번 diff 가 build-time 가드를 깨지는 않는다(확인 목적으로 명시).

## 요약

이번 T2 리팩토링(`ChatChannelBinderService`/`buildTriggerCallbackUrl` 추출)은 명명·DI 패턴·secret-store 의미론·review-citations 인용 형식 모두 기존 정식 규약과 정확히 일치한다. 유일한 컴플라이언스 격차는 `spec/5-system/15-chat-channel.md` 의 `code:` frontmatter 와 §7 파일 구조가 신설 구현 경로(T1 1개 + T2 2개, 누적 8개)를 아직 반영하지 못한 것과, 그로 인해 `secret-store.md`/`chat-channel-adapter.md`/`data-flow/14-chat-channel.md`(target 밖) 3곳의 클래스-귀속 서술이 부정확해진 것이다. 두 항목 모두 이 developer 세션이 새로 발견한 것이 아니라 `--impl-prep`(`17_39_32`) 라운드가 이미 짚었고 `plan/in-progress/spec-draft-nullable-notation-followups.md` durable 트래커에 정확한 줄 번호·처방과 함께 planner 턴 항목으로 등재돼 있음을 직접 대조해 확인했다 — developer 는 `spec/` 쓰기 권한이 없어 이 PR(`spec_impact: none`) 이 직접 고칠 수 없는 것도 규약(자기-반증형 소정정 조건 1 불성립)과 일치한다. 따라서 이 PR 자체를 막을 사유는 없다.

## 위험도

LOW
