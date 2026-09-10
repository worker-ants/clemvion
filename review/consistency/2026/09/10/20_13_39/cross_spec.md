# Cross-Spec 일관성 검토 — `spec-draft-chat-channel-patch-token.md`

검토 대상: `plan/in-progress/spec-draft-chat-channel-patch-token.md`
검토 모드: `--spec` (draft)

## 0. 핵심 주장 독립 재현 (요청 사항 — 필수)

draft 의 중심 주장 — **"등재된 처방(`botToken` 을 PATCH DTO 에서 제외)만 하면 저장된 봇 토큰이
파괴된다"** — 을 소스에서 직접 세 고리 전부 확인했다. **결론: 참. 반증 못 함.**

| 고리 | 확인 위치 | 실측 |
|---|---|---|
| ① `update()` 가 `chatChannel` 있으면 무조건 `setupChatChannel` 호출 | `codebase/backend/src/modules/triggers/triggers.service.ts:539` | `if (chatChannel) { await this.setupChatChannel(saved, chatChannel); ... }` — 조건은 `chatChannel` 존재 여부뿐, `botToken` 존재 여부 무관 |
| ② `setupChatChannel` 이 `secrets.rotate` 를 조건 없이 호출 | 같은 파일 943~951행 | `await this.secrets.rotate(botTokenRef, trigger.workspaceId, chatChannelCfg.botToken ?? '');` — `botToken` truthy 체크가 전혀 없다 |
| ③ `SecretResolver.rotate` 에 빈 문자열 가드 없음 | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:129-142` | `encryptSecret(...)` 뒤 바로 UPSERT. `newPlaintext` 가 `''` 여도 그대로 암호화해 기존 row 를 덮어씀 |

부가로 확인한 전제(모두 정확):
- `ChatChannelConfigDto.botToken` 은 `@IsOptional()` 없이 `@IsString() @MaxLength(256)` — **필수**. 그래서 오늘 PATCH+`chatChannel`(botToken 없이)은 컨트롤러에 닿기도 전에 400 이다 — "`ChatChannelCard` 저장이 항상 400" 진단과 일치.
- 프런트 유일 호출자 `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:365-367` 는 `patchChatChannel` 객체에 `botToken` 키를 아예 넣지 않는다(주석까지 draft 서술과 일치).
- `mergeExternalConfig`(`triggers.service.ts:897-908`)는 `next.chatChannel = chatChannel` 로 객체를 통째 교체 → `botTokenRef` 소멸 → `setupChatChannel` 이 `buildSecretRef({scope:'triggers', resourceId: trigger.id, name:'bot-token'})` 로 **재유도**해 다시 채움(D-3 주장, 정확).

이 핵심 주장이 틀렸다면 CRITICAL 이라고 지시받았으나, 독립 재현 결과 **draft 의 진단이 옳다**.
즉 draft 자체는 이 지점에서 반증되지 않았다 — 아래는 그 처방(D-1~D-3, 변경안 A~D)의 세부에서
발견한 것들이다.

---

## 발견사항

### [CRITICAL] 신설 Rationale ID `R-CC-17` 이 같은 문서 안에서 이미 사용 중 — 요구사항 ID 충돌
- **target 위치**: `plan/in-progress/spec-draft-chat-channel-patch-token.md` 변경안 C —
  `` `15-chat-channel.md` 신설 Rationale `R-CC-17` — 우회의 형태와 처방의 함정 ``
- **충돌 대상**: `spec/5-system/15-chat-channel.md:689` `### R-CC-17. \`render_form\` v1 임시 텍스트
  fallback + presentation renderer shape 처리` (기존 R-CC-16 다음, R-CC-18 이전에 이미 존재).
  추가로 이 ID 는 **문서 밖에서도 링크된다**: `spec/conventions/chat-channel-adapter.md:382` 가
  `[R-CC-17](../5-system/15-chat-channel.md#r-cc-17-render_form-v1-임시-텍스트-fallback--presentation-renderer-shape-처리)`
  로 정확히 이 slug 를 인용하고, 같은 문서 내부에서도 683행·704행이 자기참조한다.
- **상세**: `15-chat-channel.md` 의 실제 Rationale 시퀀스는 R-CC-10·11·12·13·15·16·**17**·18·19·20 이다
  (14 는 이력상 결번으로 보이나 17 은 결번이 아니라 **점유 중**). draft 가 "신설 `R-CC-17`" 을 그대로
  추가하면 (a) 기존 섹션을 덮어써 `render_form` v1 fallback 결정을 지워버리거나, (b) 같은 heading
  이 문서에 두 번 생겨 Markdown anchor 가 암묵적으로 분화(`#r-cc-17-...-1` 류)되면서
  `chat-channel-adapter.md:382` 의 상호링크와 15-chat-channel.md 자체의 683/704행 자기참조가 조용히
  깨진다. 어느 쪽이든 기존 결정(ai-agent `render_form` v1 fallback vs modal 격상 경계, CCH-MP-01/03
  분기)의 추적성이 훼손된다.
- **제안**: 새 Rationale 은 `R-CC-21` (기존 최대 번호 R-CC-20 다음)로 번호를 매긴다. draft 본문의
  "변경안 C" 제목·Rationale 섹션 헤더·이 turn 내 다른 어떤 상호참조도 `R-CC-17` 을 `R-CC-21` 로
  일괄 치환해야 한다. `spec_impact` 목록에는 영향 없음(같은 파일 안의 앵커 수정이므로).

---

### [WARNING] D-1 의 "형제 세 필드가 이탈해 있다" 전제 — 그 이탈이 실제로 관측 가능한지 미검증
- **target 위치**: D-1 절 — *"형제 세 필드가 규약에서 이탈해 있다 — §5.4.1 이
  `details.field='botTokenRef'`(접두어 없음)로 적는데, 그것은 서비스 가드
  (`assertChatChannelInputSafe`)가 리터럴을 던지기 때문이다."*
- **충돌 대상**: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:200-244`
  (`botTokenRef`/`inboundSigningRef`/`inboundSigning` 모두 `@IsOptional() @IsEmpty(...)` 로
  **DTO 클래스 자체에도** 선언), `codebase/backend/src/app.module.ts:202`
  (`{ provide: APP_PIPE, useClass: CustomValidationPipe }` — 전역 등록),
  `codebase/backend/src/common/pipes/validation.pipe.ts:29-42` (`flattenErrors` 가 **array** +
  중첩 경로(`chatChannel.botTokenRef`) 산출).
- **상세**: 인용 자체(3-error-handling.md:270)는 정확하고, **§5.4.1 의 스펙 문장**이
  `details.field='botTokenRef'`(접두어 없음, 단일 object)로 적혀 있다는 draft 의 관측도 정확하다.
  그런데 그 "이탈"의 **원인 지목**이 의심스럽다: `botTokenRef`/`inboundSigningRef`/`inboundSigning`
  은 서비스의 `assertChatChannelInputSafe` 뿐 아니라 **DTO 클래스에도** `@IsEmpty()` 로 동일하게
  선언돼 있고, 검증 파이프(`CustomValidationPipe`)는 `APP_PIPE` 로 **전역** 등록돼 컨트롤러 핸들러
  실행 **이전**에 돈다(`triggers.controller.ts:132-137` `@Body() dto: UpdateTriggerDto`). NestJS 는
  파이프가 던지면 핸들러를 호출하지 않으므로, `chatChannel.botTokenRef` 가 실려 오면 **DTO
  레이어(`@IsEmpty()`)가 먼저 400 을 던지고 서비스의 `assertChatChannelInputSafe` 는 도달하지
  못할 가능성이 높다.** 그 경우 실제 HTTP 응답 `details` 는 서비스가 만드는 단일 object
  (`{field:'botTokenRef'}`) 가 아니라 파이프가 만드는 **array**(`[{field:'chatChannel.botTokenRef',
  message:'...', code:'INVALID_FIELD'}]`) 일 것이다 — draft 가 "이탈" 로 지목한 형태 자체가 이미
  실제 런타임과 다를 수 있다는 뜻이다. 흥미롭게도 이 array/중첩경로 형태는 draft 가 신설 필드에
  쓰려는 바로 그 형태(`chatChannel.botToken`)와 같은 계열이다 — 즉 사실이 draft 의 관측과
  반대일 가능성(형제 필드가 이미 array/중첩 형태로 나가고 있을 가능성)이 있다.
  단, 이 파이프 우선순위 판단은 NestJS 파이프 실행 순서에 대한 프레임워크 지식에 근거한 추론이며,
  실제 HTTP 응답을 캡처하는 e2e 단언은 저장소에서 찾지 못했다(`chat-channel-*.e2e-spec.ts` 는
  `botTokenRef` 를 API 가 아니라 DB 직접 UPDATE 로만 주입한다) — **미검증**으로 남겨 둔다.
  같은 서비스 JSDoc(`assertChatChannelInputSafe` 위, 575행 부근)도 *"DTO 단에서도 @IsEmpty ...
  로 1차 검증되지만, error envelope 형식을 spec 의 VALIDATION_ERROR 와 정합시키기 위해 service 단
  추가 검증"* 이라 적어, 이 이중 레이어를 이미 인지하고 있다 — 다만 "정합시키기 위해" 라는 근거는
  서비스 코드가 실제로 도달 가능할 때만 성립한다.
- **제안**: 이 turn 에서 D-1 의 **결정**(present 면 400, `chatChannel.botToken` 중첩경로 채택)은
  그대로 두어도 안전하다 — 어느 메커니즘(DTO exclusion 이든 서비스 literal throw 이든)으로
  구현하든 개발자가 고를 몫이고 D-1 은 계약(형태)만 못박으면 된다. 다만 **"형제 세 필드가 이탈해
  있다" 는 근거 문장**은 확인되지 않은 인과 주장이므로, developer 턴 착수 전 (또는 이 planner
  턴에서) 실제 HTTP 응답을 e2e 로 1회 캡처해 어느 레이어가 실제로 이기는지 확인하고 문구를
  정정하거나 "검증 안 됨" 으로 낮추는 것을 권한다. 최소한 `--impl-done` 리뷰에서 이 가정이
  구현과 다르면 캐너리로 잡힐 것이다.

---

### [WARNING] D-2 가 인용하는 "§5.4.1 표 2행" 자체가 현재 구현에서 발생하지 않는 시나리오일 수 있음
- **target 위치**: D-2 절 — *"이것이 §5.4.1 표 2행(`트리거 활성화 PATCH — 기존 botTokenRef 그대로
  사용, token 변경 없음`)이 이미 선언한 동작이다."*
- **충돌 대상**: `spec/5-system/15-chat-channel.md:375` (`| 트리거 활성화 (\`PATCH
  /api/triggers/:id\` body \`{ isActive: true }\`) | setupChannel() 재호출 — 기존 botTokenRef
  그대로 사용 | token 변경 없음 |`), `codebase/backend/src/modules/triggers/triggers.service.ts:537`
  (`if (chatChannel) { await this.setupChatChannel(...) }`), 프런트 유일 isActive 토글 호출부
  `codebase/frontend/src/app/(main)/w/[slug]/triggers/page.tsx:259`
  (`await triggersApi.update(id, { isActive });` — `chatChannel` 키 없음).
- **상세**: §5.4.1 표 2행은 body 를 명시적으로 `{ isActive: true }` (chatChannel 없음)로 적고
  "setupChannel() 재호출" 이 일어난다고 서술한다. 그러나 `update()` 의 `setupChatChannel` 호출은
  `if (chatChannel)` 로 게이트돼 있고, isActive 토글의 유일한 실제 호출부는 `chatChannel` 을 아예
  싣지 않는다. 즉 **현재 구현에서 순수 `{isActive:true}` PATCH 는 `setupChatChannel`/`setupChannel()`
  을 전혀 호출하지 않는다** — 표 2행이 서술하는 시나리오 자체가 오늘 실행되지 않는 것으로 보인다.
  draft 는 이 행을 "좁게 읽혀 왔던" 선례로 인용해 그 정신을 chatChannel-포함 PATCH 로 확장하는데,
  선례로 삼은 행 자체의 사실관계가 이미 구현과 어긋나 있다면 그 유추의 지지력이 약하다(정책
  방향 자체는 이 draft 의 재판정 표·secret-store.md §5.1 예시로 별도 뒷받침되므로 D-2 결정을
  뒤집을 사안은 아니다).
- **제안**: 변경안 A 를 적용할 때 2행("트리거 활성화") 서술도 함께 실측·정정 대상에 포함할 것을
  고려. 최소한 developer 턴에서 `{isActive:true}` 단독 PATCH 가 `setupChannel()` 을 재호출하는지
  e2e 로 확인하고, 안 한다면 그 행 자체도 갱신(또는 "실제로는 no-op" 로 각주)하는 후속을 등재.

---

### [INFO] `secret-store.md §5.1` 이 이미 이 draft 의 처방(guard) 을 정본 예시로 보여준다 — 교차 문서 정합 강화
- **target 위치**: 변경안 A/B (PATCH 경로 rotate 스킵), Rationale C 의 "처방의 함정" 서술
- **관련 문서**: `spec/conventions/secret-store.md:307-311`
  ```
  if (dto.chatChannel?.botToken) {
    const ref = buildSecretRef({ scope: 'triggers', resourceId: trigger.id, name: 'bot-token' });
    await this.secrets.rotate(ref, workspaceId, dto.chatChannel.botToken);
    ...
  }
  ```
- **상세**: 이 예시는 `botToken` **존재를 조건**으로 `rotate()` 를 호출한다 — 정확히 draft 의
  D-2 가 요구하는 가드 형태다. 반면 실제 `triggers.service.ts:947-951` 의 `setupChatChannel` 은
  이 가드 없이 `chatChannelCfg.botToken ?? ''` 로 무조건 호출한다. 즉 **현재 구현은 이미
  `secret-store.md` 자신이 정본으로 제시한 사용 패턴과 어긋나 있었다** — draft 가 발견한
  CRITICAL 은 이 기존 convention 문서의 관점에서 봐도 위반이다. 이 draft 의 처방(D-2)은 다른
  spec 영역과 충돌하지 않고 오히려 그 영역의 기존 규범과 재정합시킨다 — 방향이 옳다는 교차 증거.
- **제안**: 없음(정합 확인용 기록). 원한다면 변경안 B 의 정당화 문단에 이 교차 근거
  (`secret-store.md §5.1` 이 이미 가드 패턴을 문서화했었다)를 한 줄 추가하면 Rationale 이 더
  튼튼해진다.

---

### [INFO] 변경안 D 가 겨냥한 `2-trigger-list.md:176` 의 "통째로 교체" 서술 — 관측 정확
- **target 위치**: 변경안 D
- **관련 문서**: `spec/2-navigation/2-trigger-list.md:176`
- **상세**: 인용된 문장 *"각 키는 명시되면 해당 객체를 통째로 교체 — 부분 머지가 아니라 전체
  객체를 다시 send 해야 한다"* 를 그대로 확인했다. 문면만 읽으면 PATCH 로 `chatChannel` 을 보낼 때
  `botTokenRef` 를 함께 안 보내면 사라진다는 인상을 준다 — 실제로는 `setupChatChannel` 의 재유도가
  이를 상쇄한다(D-3, 위에서 검증 완료). draft 의 진단·제안 모두 정확하며 다른 영역과 충돌하지 않는다.
- **제안**: 없음.

---

## 요약

draft 의 핵심 안전-경고("등재된 처방만 적용하면 토큰이 파괴된다")는 `triggers.service.ts` ·
`secret-resolver.service.ts` 세 고리 모두 소스에서 독립 재현되어 **사실로 확인**됐고, D-3 의
`mergeExternalConfig`/재유도 서술과 `2-trigger-list.md:176` 관측도 정확하다. `secret-store.md
§5.1` 은 이 draft 의 처방 방향(rotate 를 botToken 존재 조건부로 만드는 것)을 이미 정본 예시로
보여주고 있어 교차 문서 정합성 관점에서 draft 의 결정과 상충하지 않는다. 다만 두 곳에서 draft
자신의 **근거 인용**이 실제 구현·실행 시나리오와 어긋날 가능성을 발견했다 — (1) D-1 이 "형제 세
필드의 이탈" 원인으로 지목한 서비스 가드가 전역 `APP_PIPE`(`CustomValidationPipe`)의 DTO
`@IsEmpty()` 검증에 의해 가려져 실제로는 도달 못 하는 dead code 일 가능성이 있고, 그 경우 실제
런타임 에러 shape 는 draft 가 "이탈" 이라 부른 형태가 아니라 이미 draft 가 신설 필드에 쓰려는
형태(array + 중첩경로)일 수 있다. (2) D-2 가 선례로 인용한 §5.4.1 표 2행(`{isActive:true}` PATCH
→ setupChannel 재호출)이 실제로는 그 시나리오에서 `setupChatChannel` 이 전혀 호출되지 않아
서술과 구현이 이미 어긋나 있을 수 있다. 두 건 모두 draft 의 **결정 자체**를 무효화하지는 않지만
(계약·정책 방향은 여전히 타당) 근거 문장의 정확성 문제이며 developer 턴 착수 전 e2e 로 실측
정정할 가치가 있다. 가장 중대한 발견은 별도 항목인 **요구사항 ID 충돌**: 변경안 C 가 신설하려는
`R-CC-17` 은 같은 문서(`15-chat-channel.md`)의 `render_form` v1 fallback 절이 이미 점유하고
있고, `chat-channel-adapter.md` 가 그 특정 anchor 를 상호링크하고 있어 그대로 적용하면 기존
Rationale 의 추적성이 깨진다 — `R-CC-21` 로 번호를 바꿔야 한다.

## 위험도

**HIGH** — CRITICAL 1건(요구사항 ID 충돌, `R-CC-17` 재사용)이 그대로 반영되면 기존 `render_form`
v1 fallback Rationale 의 anchor/상호링크가 깨진다. 이 draft 의 핵심 기술 진단(토큰 파괴 경로)은
독립 재현으로 확인됐고 다른 CRITICAL 은 발견하지 못했으므로, `R-CC-17`→`R-CC-21` 치환만 반영하면
HIGH 사유는 해소된다. WARNING 2건은 근거 문장의 정확성 문제로 developer 턴 착수 전 확인을 권고.

STATUS: success
