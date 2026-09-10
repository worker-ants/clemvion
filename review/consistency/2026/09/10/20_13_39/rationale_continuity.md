# Rationale 연속성 검토 — `plan/in-progress/spec-draft-chat-channel-patch-token.md`

검토 대상: `#1308` CRITICAL 두 건("chatChannel PATCH 가 bot token single-path 를 우회한다" · "`ChatChannelCard` 편집-저장이 항상 400")의 planner 처방 draft.
대조 spec: `spec/5-system/15-chat-channel.md`(§5.4.1/§5.4.1.1, R-CC-10~R-CC-20), `spec/2-navigation/2-trigger-list.md`(§3), `spec/5-system/3-error-handling.md`(§2.1).
검증은 draft 본문 + 실제 코드(`codebase/backend/src/modules/triggers/triggers.service.ts`, `chat-channel-config.dto.ts`, `secret-resolver.service.ts`, `codebase/frontend/.../chat-channel-card.tsx`)를 직접 열어 대조했다.

## 발견사항

### [CRITICAL] 신설 Rationale ID `R-CC-17` 은 비어 있지 않다 — 기존 항목과 충돌

- **target 위치**: draft `## 변경안 § C`(파일 L109) — `### C. \`15-chat-channel.md\` 신설 Rationale \`R-CC-17\` — 우회의 형태와 처방의 함정`
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md:689` `### R-CC-17. \`render_form\` v1 임시 텍스트 fallback + presentation renderer shape 처리` (이미 존재하는 항목). 같은 파일의 `### Rationale ID 컨벤션`(L616 부근)은 "기존 R1~R9 / R-K 는 하위 호환 위해 그대로 유지(rename 시 cross-link 깨짐 위험)"라고 명시적으로 ID 불변성/유일성을 규약화하고 있다.
- **상세**: `grep -n "^### R-CC-"` 로 시퀀스를 실측하면 `R-CC-10, 11, 12, 13, 15, 16, 17, 18, 19, 20` 이 존재하고 **최댓값은 R-CC-20**, `R-CC-14`/`R-CC-21`은 존재하지 않는다. draft 가 신설하려는 `R-CC-17` 은 이미 "AI Agent `render_form` v1 fallback + renderer shape 추출 우선순위" 라는 **전혀 다른 주제**로 채워져 있고, `spec/conventions/chat-channel-adapter.md:382`가 정확히 그 anchor(`#r-cc-17-render_form-v1-임시-텍스트-fallback--presentation-renderer-shape-처리`)로 외부 참조하며, 같은 파일 `R-CC-16(c)`(L680 근처)도 내부에서 참조한다. draft 그대로 편집을 넣으면 (a) 기존 heading 을 덮어써 이미 합의된 render_form Rationale 이 소거되거나, (b) 같은 텍스트/anchor 를 가진 두 heading 이 공존해 두 교차참조 중 최소 하나가 엉뚱한 섹션으로 링크된다. 이 문서 자신이 "Rationale ID 컨벤션" 절에서 경고한 정확히 그 사고(cross-link 파괴)가 채번 실수로 재발하는 사례다.
- **제안**: 신설 항목은 현재 시퀀스 최댓값(R-CC-20) 다음인 **`R-CC-21`** 로 채번한다. draft §C 제목·본문 내 자기참조·변경안 표 전부 동일하게 정정.

### [WARNING] R-CC-10 본문이 확장된 차단 범위를 반영하지 않음 — 선례(전방 포인터/인라인 정정)를 따르지 않음

- **target 위치**: draft `## 결정 § D-1`(L57-70), `## 변경안 § C`(L109-119) — "R-CC-10 은 *결정*(single-path)을 갖고 있으므로 그대로 두고" 라는 서술
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md:610` R-CC-10 본문 — "single-path 채택: 토큰 변경은 항상 `POST …/rotate-bot-token` 이며 **PATCH body 의 `botTokenRef` 변경은 차단한다**."
- **상세**: draft 가 "R-CC-10 의 결정 자체는 안 바꾼다"고 판단한 것은 **맞다** — single-path 원칙(토큰 변경은 rotate API 로만)은 그대로다. 다만 R-CC-10 본문 문장은 차단 **메커니즘의 범위**를 "`botTokenRef` 변경 차단"이라고 구체적으로 서술하고 있고, 변경 A(§5.4.1 표를 값 필드까지 확장)가 반영되면 이 문장은 더 이상 전체 그림을 정확히 설명하지 못한다(반증되는 건 아니지만 불완전해진다). 이 문서에는 이미 두 개의 선례가 있다: (i) §5.4.1 본문의 "*(2026-08-11 정정 — 이 자리에 …)*" 인라인 각주(L378), (ii) R9 본문의 "본 R9 논거는 lifecycle 케이스 전용이다. rate-limit 케이스의 skip vs 큐 결정은 [R-CC-19] 가 별도 다룬다"는 전방 포인터. draft 는 이 두 관행 중 어느 것도 R-CC-10 에 적용하지 않고, 새 항목(R-CC-21) 쪽에서만 R-CC-10 을 인용한다 — 단방향 참조라 R-CC-10 을 먼저 읽는 사람은 확장 사실을 모른다.
- **제안**: R-CC-10 본문 끝(또는 §5.4.1 표 각주)에 한 줄 추가: "(2026-09-10 확장 — PATCH 차단 대상이 `botTokenRef`(ref) 뿐 아니라 값 필드 `botToken` 까지 포함하도록 넓어졌다. 상세: R-CC-21.)" R9→R-CC-19 관계와 동일한 패턴.

### [INFO] §5.4.1.1 의 botToken/inboundSigning 대조 논거는 흔들리지 않는다 — 명시적으로 한 줄 덧붙일 것

- **target 위치**: draft `## 변경안 § B`(L103-107)
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md:392-397` §5.4.1.1 v1 차단의 정당화(botToken=외부 provider 등록 vs inboundSigning=우리 측 저장만)
- **상세**: §5.4.1.1 의 대조 축은 "외부 provider 에 **등록**되어 rotate-API+grace 가 필요한가"(자원 성격 → rotate 메커니즘 유무)이고, draft 의 변경 축은 "PATCH 에서 **무엇을**(필드명 vs 값) 차단하는가"다. 두 축은 직교라서 botToken 차단 대상을 값까지 넓혀도 botToken 이 rotate-API+24h grace 를 갖고 inboundSigning 은 v1 에 rotate-API 가 없다는 §5.4.1.1 의 결론 자체는 바뀌지 않는다. 오히려 inboundSigning 쪽은 이미 (규정상) 필드명(`inboundSigningRef`)과 값(`inboundSigningPlaintext`/`inboundSigning`) 양쪽을 막게 문서화돼 있어(`spec/2-navigation/2-trigger-list.md:176`), botToken 이 그 패턴에 뒤늦게 합류하는 모양이 되어 두 자원 정책의 **표면적 정합성은 오히려 개선**된다. 충돌 아님.
- **제안**: §B 문단에 "이 확장은 §5.4.1.1 의 botToken/inboundSigning 자원-성격 대조(rotate API 유무)를 변경하지 않는다 — 그 대조는 여전히 유효하다"는 한 줄을 명시적으로 추가해, 이후 독자가 "차단 축 확장"을 "자원 대조 폐기"로 오독하지 않게 할 것 (예방적 INFO).

### [WARNING] D-1 의 근거("형제 세 필드가 이미 400으로 막고 있다")가 실측과 다르다 — `inboundSigningPlaintext` 는 slack/discord 에서 이미 §5.4.1.1/§3 규정을 위반 중이고, draft 의 "ChatChannelCard 는 무수정으로 통과" 결론도 그 두 provider 에는 성립하지 않는다

- **target 위치**: draft `## 결정 § D-1`(L59-61) — "이 문서가 이미 형제 세 필드(`botTokenRef` · `inboundSigningPlaintext` · `inboundSigning`)를 전부 400 으로 막고 있어 그 관례와도 어긋난다"; `## 이 turn 에서 하지 않는 것`(L135-141) — "`ChatChannelCard` 프런트 수정 … 그 카드는 지금 코드 그대로 통과한다"
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md:176` — "`chatChannel.inboundSigning` / `inboundSigningPlaintext` 도 PATCH 로 변경 불가 … 위반 시 400"; `spec/5-system/15-chat-channel.md:390` §5.4.1.1 표 "회전(rotation)" 행 — "v1 미정의 — PATCH body 의 … `inboundSigningPlaintext` / `inboundSigning` 직접 변경은 400 … 로 차단"
- **상세** (실측, `origin/main` 기준 현재 코드):
  - `assertInboundSigningPlaintextByProvider`(`codebase/backend/src/modules/triggers/triggers.service.ts:642-670`)는 provider 분기가 **비대칭**이다 — telegram 은 "존재하면 400"(문서와 일치)이지만, slack/discord 는 **정반대로 "부재하면 400"(필수)**이고 유효한 hex 값을 실어 보내면 **거부되지 않고 통과**한다.
  - `assertChatChannelInputSafe`(같은 파일 `:575-604`)는 `create()`(L401)와 `update()`(L482) 양쪽에서 무조건 호출되며, `botTokenRef`/`inboundSigningRef`/`inboundSigning` 세 필드만 리터럴로 차단한다 — `inboundSigningPlaintext` 자체는 여기서 막히지 않는다(provider 분기 함수가 별도로 처리).
  - `setupChatChannel`(`:915-994`)은 `providerIssuedPlaintext`(=`inboundSigningPlaintext`)가 non-empty string 이면 **무조건** `secrets.rotate(inboundSigningRef, ws, providerIssuedPlaintext)`(`:961-967`)를 호출한다 — create/update 구분 없음.
  - 결론: slack/discord provider 의 chatChannel PATCH 가 유효한 `inboundSigningPlaintext` 를 실으면, 문서(§5.4.1.1·2-trigger-list §3)가 "v1 차단"으로 못박은 그 회전이 **오늘 이미 통과된다** — botToken 과 정확히 같은 유형("required 필드 + PATCH·POST 공유 DTO + 무조건 rotate")의 우회가 이미 하나 더 있다.
  - 한편 `ChatChannelCard`(frontend, `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:340-366`)의 PATCH payload 는 `inboundSigningPlaintext` 를 **절대 싣지 않는다**. 즉 slack/discord provider 트리거는 D-1/D-2 를 그대로 적용해도 `inboundSigningPlaintext` 필수-누락으로 **여전히 매번 400** 이다 — draft 가 "이 turn 에서 하지 않는 것"에서 내린 "그 카드는 지금 코드 그대로 통과한다"는 결론은 **telegram 에만** 성립하고 slack/discord 에는 성립하지 않는다. 즉 `#1308`의 두 번째 CRITICAL("`ChatChannelCard` 편집-저장이 항상 400")은 draft 가 주장하는 만큼 완전히 닫히지 않는다.
- **제안**:
  1. D-1 정당화 문장을 "botTokenRef·inboundSigning(ref/computed) 은 이미 막혀 있으나, `inboundSigningPlaintext` 는 slack/discord 에서 이미 §5.4.1.1/§3 규정을 어기며 통과되고 있다(별도 결함)"로 정정 — "형제 세 필드가 이미 잘 막고 있다"는 근거로 새 결정을 정당화하려면 그 전제부터 실측이 맞아야 한다(이 저장소가 반복 지적받은 결함군).
  2. 이 발견을 "이 turn 에서 하지 않는 것" 목록에 항목으로 추가하거나(별 후속 명시), 구조적 원인이 botToken 과 완전히 동일하므로 **이번 턴에 함께 처리**하는 것을 검토 — 조사 비용이 이미 이 리뷰로 지불됐다.
  3. "`ChatChannelCard` 는 지금 코드 그대로 통과한다"는 결론을 provider 조건부(telegram 한정, slack/discord 는 별개 결함으로 여전히 400)로 명시.

### [확인] "오늘 토큰이 안 지워지는 유일한 이유가 그 400 버그" — `botToken` 한정으로는 사실, 전체 일반화로 읽히면 과장

- 실측: `SecretResolverService.rotate`(`codebase/backend/src/modules/secret-store/secret-resolver.service.ts:129-141`)에 빈 문자열 가드 없음(확인). `assertChatChannelInputSafe`는 `botToken` 자체를 검사하지 않음(확인). `ChatChannelConfigDto.botToken`(`chat-channel-config.dto.ts:187`)은 `@IsString()`이고 `@IsOptional()` 이 없어 부재 시 400(확인). 세 사실이 맞물려 "botToken 필수 → 항상 400"이 botToken 파괴를 막는 **유일한 방어**라는 draft 의 주장은 **botToken 자체에 한해 정확**하다 — 다른 우회 경로(예: whitelist 예외, 별도 optional DTO)는 없음을 확인했다.
- 다만 바로 위 finding 이 보여주듯, 이 "400 버그" 서술을 "PATCH 저장이 항상 400 인 이유는 이것 하나다"로 일반화하면 부정확하다 — slack/discord 는 `inboundSigningPlaintext` 필수성이라는 **두 번째, 독립적인** 400 원인을 갖고 있다.

## 요약

draft 의 핵심 진단(등재된 처방대로 `botToken` 을 DTO 에서 빼기만 하면 `setupChatChannel` 의 무조건 `secrets.rotate(botTokenRef, ws, botToken ?? '')` 가 토큰을 빈 값으로 파괴한다는 것, 그리고 "항상 400" 버그가 오늘 그 파괴를 막는 유일한 방어라는 것)는 코드 대조 결과 정확하며, R-CC-10 의 *결정*(single-path)을 번복하지 않고 §5.4.1.1 의 botToken/inboundSigning 자원 대조와도 충돌하지 않는다 — 오히려 그 대조를 정합하게 만드는 방향이다. 그러나 두 가지 실행 결함이 있다: (1) 신설하려는 Rationale ID `R-CC-17` 이 이미 다른 주제(`render_form` fallback)로 채워져 있어 그대로 적용하면 기존 결정 이력을 파괴하거나 anchor 충돌을 낸다 — 반드시 `R-CC-21` 로 정정해야 한다. (2) draft 가 D-1 의 근거로 삼은 "형제 세 필드가 이미 400으로 막고 있다"는 전제가 `inboundSigningPlaintext`(slack/discord)에는 성립하지 않으며, 그 필드는 이미 이 문서가 명시한 "v1 차단" 규정을 실제로 위반하며 PATCH 를 통과시키고 있다 — 이로 인해 draft 가 주장하는 "`ChatChannelCard` 는 무수정으로 통과한다"는 결론도 telegram 에만 성립한다. 두 결함 모두 draft 를 그대로 커밋하면 이후 독자가 잘못된 전제(닫힌 Rationale 슬롯, 완전히 닫힌 CRITICAL)를 물려받는다는 점에서 병합 전 정정이 필요하다.

## 위험도

HIGH
