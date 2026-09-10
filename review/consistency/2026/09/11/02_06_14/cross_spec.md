# Cross-Spec 일관성 검토 — chatChannel PATCH 비밀 차단 (impl-done, scope=spec/5-system, 5차 라운드)

## 검토 범위 메모

`spec/5-system` 자체의 diff 는 이번에도 **0개 파일**이다 — 이 브랜치는 spec 을 바꾸지 않는다.
구현 diff 는 `codebase/backend/src/modules/triggers/**`(DTO·controller·service·테스트) 16개
파일이며, 직전 cross-spec 라운드(`review/consistency/2026/09/11/01_10_44`, BLOCK: NO) 이후
추가된 커밋은 두 개뿐이다:

- `84a6aeaa8` — 내부 3필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`) null/`''` 뮤테이션
  테스트 추가 + `codebase/**` 3곳(`slack.adapter.ts:65`·`triggers.service.ts:755`·
  `chat-channel-config.dto.ts:252`)의 `store()`→`rotate()` 주석 정정.
- `0f5180e34` — 리뷰 산출물(RESOLUTION/SUMMARY) 등재. 코드·spec 변경 없음.

둘 다 **기존에 이미 발견·등재된 항목의 마무리**이지 새 표면을 열지 않는다. 아래는 워킹트리
직접 대조로 재확인한 결과다.

## 발견사항

- **[WARNING]** `details.field` 실제 표현(값에 따라 중첩/flat 분기) vs SoT spec 문면(flat 확정
  또는 미확정) 불일치 — **직전 라운드부터 지속, 신규 아님**
  - target 위치: (구현) `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    `botTokenRef` JSDoc(`details.field='chatChannel.botTokenRef' — 비어있지 않은 값일 때 …
    null/''는 서비스 층에서 flat 'botTokenRef'`), `triggers.controller.ts` PATCH
    `@ApiBadRequestResponse` 신규 서술(값의 형태에 따라 배열/object, 중첩/flat 분기를 명시),
    `triggers.service.ts` `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1 표(`config.chatChannel.botTokenRef(ref)
    는 400 (details.field='botTokenRef')`, `botToken(plaintext) 도 400 (details.field 는
    미확정 — 후속 e2e 확인 대기)`) · `spec/2-navigation/2-trigger-list.md` L119-120, L176, R-12
  - 상세: 이번 diff(및 그 직전 라운드가 만든 실측 테스트 `trigger-dto-validation.spec.ts`)는
    5필드(`botToken`·`botTokenRef`·`inboundSigning`·`inboundSigningPlaintext`·`inboundSigningRef`)
    모두 **값이 비어있지 않으면** 전역 `CustomValidationPipe` 가 `chatChannel.<field>` 중첩
    경로 + 배열 `details` 를 내고, **null/빈 문자열이면** 서비스 가드가 flat `<field>` + 단일
    object `details` 를 낸다는 것을 재확인했다. 코드 쪽(Swagger 설명·JSDoc)은 이제 이 두 갈래를
    정확히 문서화하지만, **공식 SoT 인 두 spec 파일의 본문은 여전히 구 표기(flat 확정 또는
    "미확정")를 유지**한다 — 이번 diff 가 spec 을 건드리지 않으므로 이 간극은 그대로 남는다.
  - 제안: (기존 결정 유지) `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1 과
    `spec/2-navigation/2-trigger-list.md` L119-120·L176·R-12 를 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    의 실측 표(값 존재 시 중첩+배열 / null·빈 문자열 시 flat+object)로 planner 턴에서 갱신.
    developer 는 이 문장들을 스스로 쓰지 않았으므로(§자기-반증형 소정정 조건 1 미충족) 직접
    고칠 수 없다 — **이미 그 트래커에 미해결(`- [ ]`)로 등재돼 있고, 직전 4회 `--impl-done`
    cross_spec 라운드(23_54_09·00_21_57·00_45_19·01_10_44) 모두 "신규 등재 불요"로 확인했다.**
    이번 라운드도 동일 판정을 유지한다 — 새로 발견된 것이 아니라 지속 관측이다.

- **[INFO]** 신규 400 분기 2종(최초 chatChannel 설정을 PATCH 로 시도 / provider 전환 시도)이
  두 SoT 표에 미등재 — **직전 라운드부터 지속**
  - target 위치: `triggers.service.ts` `assertChatChannelAlreadySetUp`
    (`details.field='chatChannel'` / `details.field='provider'`), `triggers.controller.ts` PATCH
    `@ApiBadRequestResponse` "(2) chatChannel 이 없는 트리거에 처음 붙이려는 경우 … (3) provider
    를 바꾸려는 경우" 서술
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1 표, `spec/2-navigation/2-trigger-list.md`
    L118·R-12(`provider … 변경하려면 트리거 삭제·재생성` — 원칙은 이미 명시, HTTP 400 표면화는
    미기술)
  - 상세: `provider` read-only 원칙 자체는 `2-trigger-list.md` L118/R-12 와 **방향이 일치**한다
    (코드 주석도 그 문장을 직접 인용). 다만 그 원칙이 **PATCH 400 `VALIDATION_ERROR`
    (`details.field='provider'`)** 로 표면화된다는 사실과, "PATCH 로 chatChannel 최초 부착 불가"
    (`details.field='chatChannel'`, 완전히 새로운 규칙)는 두 SoT 문서 어디에도 행으로 없다.
    이 diff 는 그 상태를 바꾸지 않았다.
  - 제안: (기존 결정 유지) `15-chat-channel.md` §5.4.1 표에 두 행 추가, `2-trigger-list.md` R-12
    에 400 사유 cross-link 추가 — 트래커에 이미 등재(`--impl-done` `00_21_57` W3 근거).

- **[INFO]** provider-issued inbound signing 저장 API 서술(`store()`) — **코드 측은 이번
  라운드에서 해소, spec 측 9곳만 잔존**
  - target 위치: (해소됨) `slack.adapter.ts:65`·`triggers.service.ts:755`·
    `chat-channel-config.dto.ts:252` — 직전 라운드(`01_10_44`)가 지적한 코드 주석의
    `store()`→`rotate()` drift 를 이번 diff(`84a6aeaa8`)가 정정했다(developer 권한 내,
    코드 주석이라 spec 이 아님).
  - 충돌 대상(잔존): `spec/5-system/15-chat-channel.md:200,201,373,390`,
    `spec/conventions/chat-channel-adapter.md:354,359`, `spec/4-nodes/7-trigger/providers/telegram.md:58,219`,
    `spec/4-nodes/7-trigger/providers/slack.md:278` — 총 9곳이 여전히 `SecretResolver.store()`
    라 적지만 실제 호출은 전수 `rotate()`(UPSERT)다.
  - 상세: 코드 쪽 drift 는 이번 세션에서 닫혔으므로 위험이 줄었다 — 남은 것은 순수 `spec/`
    영역 9곳이며 이는 developer 권한 밖(§자기-반증형 소정정 조건 2 — 서술 문장은 예고가 아니라
    기존 API 계약 설명이라 예외 대상도 아님)이라 planner 턴을 요구한다. 트래커에 정확한 개수(9)와
    자리가 이미 확정돼 있다.
  - 제안: planner 턴에서 위 9곳을 `rotate()`(UPSERT)로 일괄 정정 — 새 결정 사항 없음, 이미
    스케줄된 항목.

## 요약

이번 라운드(5차)에서 `spec/5-system` 및 인접 영역과의 **신규** cross-spec 모순은 발견되지
않았다. 직전 라운드 이후 추가된 두 커밋은 (1) 내부 3필드의 null/빈 문자열 갈래에 뮤테이션
테스트를 보강하고 (2) `codebase/**` 3곳의 `store()`/`rotate()` 주석 drift 를 정정한 것으로,
둘 다 이미 알려진 항목을 좁히는 작업이지 새 표면을 열지 않는다. 남아 있는 발견사항(①
`details.field` 표기 vs 실제 값-형태별 분기, ② 신규 400 분기 2종의 SoT 미등재, ③ 잔여
`store()` spec 문면 9곳)은 전부 **4회 이상의 선행 `--impl-done` cross_spec 라운드가 동일하게
지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 중앙 트래커에 실측·근거와
함께 이미 등재돼 developer 권한 밖(§자기-반증형 소정정 미충족)의 planner 후속으로 명시적으로
넘겨져 있다.** 이 diff 는 그 상태를 악화시키지도, 새로운 미등재 항목을 만들지도 않았다.
치명적(작동 불가) 수준의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은
없다.

## 위험도

LOW
