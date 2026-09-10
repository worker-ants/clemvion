# 정식 규약 준수 검토 — impl-chat-channel-patch-token (--impl-done, scope=spec/5-system)

## 검토 방법 메모

`_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 실제 diff 본문·`spec/5-system/15-chat-channel.md`
전문·`spec/conventions/**` 전문이 플레이스홀더로 절단돼 있었다. 프롬프트 자체 지시("여기 없다는
사실을 근거로 삼지 말 것")에 따라 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e`,
현재 CWD 와 일치)에서 직접 재취득했다:

- `git diff origin/main...HEAD` (16개 파일 / 1662줄) 전체 — 특히
  `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` ·
  `update-trigger.dto.ts` · `triggers.controller.ts` · `triggers.service.ts` ·
  `chat-channel/providers/slack/slack.adapter.ts` · frontend `06-integrations-and-config/{slack,discord}.{mdx,en.mdx}`
- `spec/conventions/{error-codes,swagger,secret-store}.md` 전문
- `spec/5-system/15-chat-channel.md` §5.4.1 · §5.4.1.1 · R-CC-21 (grep 발췌)
- 직전 라운드 산출물 — `review/consistency/2026/09/11/01_10_44/convention_compliance.md`,
  `review/code/2026/09/11/01_52_59/RESOLUTION.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`,
  `plan/complete/impl-chat-channel-patch-token.md`
- `git log origin/main..HEAD` (10 커밋) — 이번 diff 가 이미 7라운드 code review + 5라운드
  consistency review 를 거쳐 수렴한 상태임을 확인

이 PR 은 `spec/5-system` 을 **변경하지 않는다**(scope 델타 0, 코드 전용 PR — 정상). 아래는
그 상태에서 코드가 기존 `spec/conventions/**` 를 얼마나 정확히 따르는지에 대한 재검증이다.

## 발견사항

이번 라운드(diff 자체는 직전 convention_compliance 라운드 이후 변경 없음 — `git log` 상 마지막
코드 변경 커밋은 `84a6aeaa8`, 그 뒤 `0f5180e34` 는 `review/**` 문서만 추가)에서 **신규
CRITICAL/WARNING 은 발견하지 못했다.** 아래는 독립 재확인 과정에서 나온 INFO 2건이다 (1건은
직전 라운드가 이미 등재한 것의 재확인, 1건은 이번에 추가로 관측한 세부 사항).

- **[INFO] `ChatChannelUpdateConfigDto` — "Update" 가 접두어가 아니라 중간에 온다 (기존 백로그 항목의 세부 보강)**
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:378`
    (`export class ChatChannelUpdateConfigDto extends OmitType(...)`)
  - 위반 규약: 문서화된 정식 규약은 없음(명문 규칙 부재) — 저장소 **관행**과의 거리. 관련
    백로그: `plan/in-progress/spec-draft-nullable-notation-followups.md` L2120-2123
    ("swagger.md §1 에 '부분 갱신 DTO 는 `Update` 접두 — `Patch` 금지' 를 규약으로 승격할지").
  - 상세: 이 diff 의 주장("`Patch` 접두 클래스 0건, 관례는 `Create`/`Update` 축")은 grep 으로
    재확인해 사실이다. 다만 그 관례를 한 단계 더 좁혀 보면, 저장소의 기존 "Update" DTO **18개
    전원**(`UpdateTriggerDto`·`UpdateWorkflowDto`·`UpdateNodeDto`·`UpdateWorkspaceDto`·
    `UpdateAuthConfigDto` 등)이 `Update` 를 **클래스명 맨 앞 접두어**로 쓴다(`Update<Noun>Dto`).
    신규 `ChatChannelUpdateConfigDto` 는 `Update` 가 `ChatChannel` 과 `ConfigDto` **사이**에 온다
    — "Patch 금지, Update 채택" 이라는 상위 결정은 맞게 따랐지만, **`Update` 의 위치(접두 vs
    중위)** 축에서는 18/18 기존 선례와 다른 첫 사례다. 저장소 전체에서 "Update" 가 접두어가
    아닌 DTO 클래스는 이 파일이 유일하다(재확인 grep, 0건 다른 사례). `ChatChannelConfigDto`
    라는 형제 클래스명이 이미 존재해 `UpdateChatChannelConfigDto` 로 지으면 "Update" +
    "ChatChannelConfigDto"(기존 클래스명 그대로)가 자연히 합성되므로, 현재 이름이 임의는
    아니고 나름의 내부 논리(부모 DTO 명을 보존)를 갖는다 — 다만 그 논리 자체가 문서화된
    규약은 아니다.
  - 제안: planner 가 위 백로그 항목(§Update-접두 규약화)을 처리할 때, "Patch 금지" 뿐 아니라
    "Update 는 접두어 위치" 까지 함께 명문화하거나(그러면 이 클래스는 `UpdateChatChannelConfigDto`
    로 rename 대상이 된다), 반대로 "부모 DTO 명 보존을 위해 중위 Update 허용" 을 예외로
    명시하는 것이 좋다. 지금처럼 명문 규칙이 없는 상태에서는 CRITICAL/WARNING 급 위반이
    아니며, 소급 rename 을 요구할 근거도 없다.

- **[INFO] `swagger.md` 줄번호 인용 드리프트 — 직전 라운드 재확인, 미해소 상태 유지**
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:365`
    (`// (spec/conventions/swagger.md:315, 2026-09-05 규약화. ...)`)
  - 위반 규약: 전용 규약 없음(`review-citations.md` 는 `review/**` 세션 인용만 다루고 spec 내부
    줄번호 인용 형식은 규정하지 않음).
  - 상세: 실측 시점(2026-09-11) 기준 `spec/conventions/swagger.md` 의 해당 문장("플러그인이
    `introspectComments` 로 JSDoc 을 `description` 에 그대로 싣는다")은 315행이 아니라
    **317행**이다. 직전 라운드(`01_10_44`)가 이미 같은 2줄 드리프트를 "사소, 비긴급"으로
    등재했고, 그 이후 코드 변경이 없어 상태가 그대로다. 인용된 사실 자체(2026-09-05 규약화)는
    정확하다.
  - 제안: 급하지 않음. 다음에 이 파일을 건드릴 때 줄 번호 대신 절 이름(`§3`)으로 바꾸면
    향후 drift 에 면역이 된다.

## 준수 확인 (재검증 — 위반 아님)

- **`secrets.rotate()` 채택** (`secret-store.md` §2.2·§5.1 표) — 이 PR 이 `SecretResolver.store()`
  를 `rotate()` 로 바꾼 것(`slack.adapter.ts` JSDoc, `chat-channel-config.dto.ts` JSDoc)은
  컨벤션 문서 §2.2 표("Trigger 생성/setup 경로는 `rotate()` 권장 — UPSERT 멱등성")·§5.1 예시
  코드(`await this.secrets.rotate(ref, workspaceId, dto.chatChannel.inboundSigningPlaintext)`,
  L375)와 **문자 그대로 일치**한다.
- **에러 코드 명명** (`error-codes.md` §1) — 신규 검증 실패는 모두 `VALIDATION_ERROR`
  (기존 `UPPER_SNAKE_CASE` prefix-less 공용 코드) 를 재사용하며 신규 코드를 만들지 않았다 —
  §1 원칙(의미가 갈릴 때만 신설) 과 일치.
- **`details` 형태 dual-mode** (`spec/5-system/2-api-convention.md` §5.3 "details 의 형태는
  두 가지이고 둘 다 유효하다") — 컨트롤러 Swagger 설명이 적은 "비어있지 않은 값 → 배열/중첩
  경로, `null`/`''` → 단일 object/flat" 비대칭은 이 문서가 명시적으로 허용하는 두 형태(배열 ·
  객체)의 조합이며, e2e 실측(`trigger-dto-validation.spec.ts`)으로 고정돼 있다.
- **`writeOnly: true` 의무** (`swagger.md` §1-5) — 신규 `ChatChannelUpdateConfigDto.botToken`·
  `inboundSigningPlaintext` override 필드 모두 `writeOnly: true` 동반.
- **DTO 설명 "보안·정책 캐비엇" 지시** (`swagger.md` §3) — 두 필드의 설명이 40자 지향 상한을
  넘지만, "요청 값이 정책으로 거부될 수 있는 필드" 캐비엇 대상이라 길이 축소 대상이 아니다 —
  규약이 요구하는 대로 24h grace·audit action 우회 근거까지 적었다.
- **JSDoc/`//` 서사 분리** (`swagger.md` §3 "내부 서사는 JSDoc 이 아니라 `//` 에") —
  `ChatChannelUpdateConfigDto` 클래스 JSDoc 에는 소비자용 요약 + `@see` 만 있고, "왜 `OmitType`
  인가"·"왜 `Patch` 가 아니라 `Update` 인가" 같은 경위 서술은 전부 그 아래 `//` 블록에 있다
  (4라운드 전 커밋 `464f2ba1a` 에서 이미 이 구조로 정정됨 — 이번 재확인에서 회귀 없음 확인).
- **`OmitType` 사용** (`swagger.md` §5 "중복 필드는 `PickType`/`OmitType`/`PartialType`") —
  부모(`ChatChannelConfigDto`)의 필수 데코레이터 상속 충돌(`@IsString` vs `@IsEmpty`)을
  정확히 인지하고 두 필드를 재선언한 것도 타당한 사용.
- **i18n 사용자 가이드** (`i18n-userguide.md`) — `slack.mdx`/`discord.mdx` 신규 §5.5/§6.5 와
  `.en.mdx` 대응 절이 ko/en 쌍으로 함께 갱신됐고, 해요체 통일·`R-CC-21`/`D-1`/`spec/...` 같은
  내부 SoT 참조 미노출을 재확인(grep 전수 대조). `details.field='chatChannel.botToken'` 등
  코드 값 노출은 §5.4.1 정합화된 값(중첩 경로 갈래)과 일치한다.
- **HTTP 상태 코드 400 선택** (`spec/5-system/2-api-convention.md` §6) — 신규
  `assertChatChannelAlreadySetUp`(최초 설정·provider 전환 차단)이 400 `VALIDATION_ERROR` 를
  쓰는 것에 대해 code review 라운드가 이미 "422 가 더 맞을 수 있다"는 관점을 INFO 로 등재했으나,
  같은 컨트롤러의 기존 선례(schedule 타입 불허 필드 = 400)와 형태가 일치하고 판단은 spec
  결정 사안(개발자 권한 밖)이라 재차 플래그하지 않는다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
  에 이미 등재.
- **spec 문면 drift (`store()` vs `rotate()`, `details.field` placeholder)** — `spec/5-system`
  9곳이 여전히 `store()` 로 적혀 있고 §5.4.1/§5.4.1.1 의 `details.field` 표기가 미확정
  placeholder 인 것은 **이 PR 이 만든 결함이 아니며 spec 은 이번 PR 범위 밖(델타 0)**이다.
  developer 는 이를 자기-반증형 소정정 대상(API 계약 문장이라 조건 2 미충족)으로 판단해 직접
  고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 인계로
  정확히 등재했다 — 거버넌스 경계(spec 쓰기는 planner 전용) 준수.

## 요약

이번 diff(`chatChannel` PATCH 비밀 차단 + `ChatChannelUpdateConfigDto` 신설)는 이미 7라운드
code review 와 5라운드 consistency review 를 거쳐 CRITICAL 0 · WARNING 은 전부 사전 존재/구조적
관찰로 수렴한 상태이며, 이번 convention-compliance 재검증에서도 명명·에러 코드·출력 포맷
(`details` 배열/객체 dual-mode)·Swagger DTO 패턴(`writeOnly`·`OmitType`·JSDoc/`//` 분리)·
secret-store 호출 패턴(`rotate()`) 전 축에서 `spec/conventions/**` 를 정확히 인용하며 따르고
있음을 재확인했다. 새로 찾은 것은 CRITICAL/WARNING 이 아니라 INFO 2건뿐이다 — (1) 신규 DTO
`ChatChannelUpdateConfigDto` 가 "Patch 금지·Update 채택" 상위 규칙은 지키지만 "Update 접두어
위치" 축에서는 저장소 18/18 기존 선례와 다른 첫 사례(명문 규칙 부재라 위반은 아님, 기존
백로그 항목에 보강할 세부), (2) 직전 라운드가 이미 등재한 `swagger.md` 줄번호 인용 2줄 드리프트가
아직 미해소. `spec/5-system` 자체의 기존 drift(`store()` 표기·`details.field` placeholder)는
이 PR 범위 밖이며 developer 가 거버넌스 경계를 지켜 planner 트래커에 정확히 인계해 두었다.

## 위험도

NONE
