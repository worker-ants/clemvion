# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec 이 발견한 CRITICAL 1건(§5.4.1/R-CC-21 불변식과 Telegram server-issued 서명 회전의 모순)이 남아 있어 호출자가 차단해야 함.

## 전체 위험도
**CRITICAL** — "PATCH 는 어떤 비밀도 쓰지 않는다"는 신설 불변식(§5.4.1·R-CC-21)이 Telegram 의 server-issued inbound-signing 회전 메커니즘과 정면 충돌한다. 문면대로 구현하면 Telegram 챗봇이 무관한 PATCH 한 번으로 영구히 응답 불능이 되거나(rotate 로직을 skip 할 경우), 반대로 "값이 요청 전후로 동일하다"는 spec 서술 자체가 거짓으로 남는다(기존 rotate 로직을 유지할 경우). 근본 원인은 spec 본문(API 계약 서술)에 있어 developer 권한 밖이므로 아래 §planner 인계로 넘긴다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec (rationale_continuity·plan_coherence 가 같은 지점을 WARNING 각도로 교차 확인) | `chatChannel` 포함 PATCH 의 "inbound signing 불변" 서술이 Telegram 의 server-issued 회전 동작과 직접 모순 — 문면대로 구현하면 Telegram inbound 인증이 깨지거나 spec 서술이 거짓이 됨 | `spec/5-system/15-chat-channel.md` §5.4.1 신설행("secret store 에 저장된 bot token 을 바꾸지 않는다") 및 `### R-CC-21`("PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다"); `spec/data-flow/14-chat-channel.md` §1.3 신설행("inbound signing 값은 요청 전후로 동일하다", provider 무관 무조건 서술) | `spec/4-nodes/7-trigger/providers/telegram.md` §3.1 `setupChannel`(매 호출마다 `secret_token` 신규 랜덤 발급); `spec/conventions/chat-channel-adapter.md` §2.4/§5.5(a); `codebase/backend/src/modules/triggers/triggers.service.ts:981-993`(provider-issued 축과 명시적으로 구분된 무조건 rotate 블록) | `spec/5-system/15-chat-channel.md` §5.4.1 신설행·R-CC-21, `spec/data-flow/14-chat-channel.md` §1.3 신설행 세 곳 모두에 "PATCH 가 쓰지 않는 비밀은 (1) `botToken`, (2) `inboundSigningPlaintext`(slack/discord) 두 축 한정이며, Telegram 의 server-issued `issuedInboundSigning` 은 `setupChannel()` 재호출의 자연스러운 부수효과로 계속 갱신·저장된다"는 explicit carve-out 추가. §5.4.1.1 의 "slack/discord 한정" 제목과 동일 패턴. API 계약 정정이라 **planner 턴 필요** |

## planner 인계 (권한 밖 Critical)

> 위 Critical 은 근본 원인이 spec 본문(API 계약 서술) 정정이라 developer 권한 밖입니다. 여기 실려도
> 등급은 CRITICAL 그대로이고 `BLOCK: YES` 도 그대로입니다 — 다음 행동을 지정하는 표입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | 정정 대상이 spec/ 본문(API 계약 서술)이며 개정 성격상 developer 자기-반증형 소정정 예외 조건 2("예고·트리거 문장만")을 충족하지 않음 — developer 는 `spec/` read-only | project-planner | `spec/5-system/15-chat-channel.md` §5.4.1 신설행 + `### R-CC-21` 요약문; `spec/data-flow/14-chat-channel.md` §1.3 신설행 — 세 곳에 Telegram server-issued carve-out 명시 | `plan/in-progress/impl-chat-channel-patch-token.md` "발견한 경계 — R-CC-21 산문이 구현보다 넓다 (planner 위임)" 절 + 체크리스트 마지막 미체크 항목. plan_coherence 확인 결과 origin 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에는 아직 미등재 — plan 종료 전 등재 필요 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `CCH-AD-02` 요구사항 문구가 "enable/신규 생성"으로만 한정돼, §5.4.1 이 신설한 "chatChannel 포함 일반 PATCH → setupChannel 재호출" 트리거 조건을 포괄하지 않음 | `spec/5-system/15-chat-channel.md` §3.1 `CCH-AD-02` | 같은 문서 §5.4.1 신설행, §7 `R8`(멱등성 전제) | `CCH-AD-02` 문구에 "및 `chatChannel` 필드가 포함된 일반 PATCH" 추가하거나 §5.4.1 로 forward-link |
| 2 | plan_coherence | §5.4.1/§5.4.1.1 표 2행("트리거 활성화 PATCH → setupChannel 재호출, token 변경 없음")이 조사 세션에서 제기된 미해소 불확실성(`update()` 의 `if (chatChannel)` 게이트로 인해 활성화 PATCH 가 실제로는 setupChannel 을 재호출하지 않을 수 있음)을 캐비아트 없이 확정 서술 | `spec/5-system/15-chat-channel.md` §5.4.1 표 2행 및 §5.4.1.1 동형 행 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 미해소 항목("§5.4.1 표 2행이 구현과 어긋날 수 있다") | 자매 행(rotation 행)과 동일한 "미확정 — 후속 확인 대기" 캐비아트 부여, 또는 별도 판정 turn 으로의 cross-link 명시 |
| 3 | naming_collision | 신규 DTO 명 `ChatChannelPatchConfigDto` 가 이 코드베이스에 없던 "Patch" 접두 패턴을 처음 도입 — 부모 요청 DTO(`UpdateTriggerDto`)와 형제 nested DTO(`NotificationConfigDto`·`InteractionConfigDto`)는 모두 Create/Update 축 어휘를 씀 | `plan/in-progress/impl-chat-channel-patch-token.md` D-1 설계 | `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:16`(`UpdateTriggerDto`), `notification-config.dto.ts:86`, `interaction-config.dto.ts:27` | `ChatChannelUpdateConfigDto` 등 기존 어휘에 맞춘 이름으로 변경 검토, 또는 "Patch" 사용 근거(비밀 쓰기 차단 의미 강조)를 D-1 설계에 한 줄 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `INVALID_BOT_TOKEN`(컨트롤러 입력검증) vs `BOT_TOKEN_INVALID`(provider 401/403) — 근접 애너그램 에러 코드, 실충돌은 없음 | `spec/5-system/15-chat-channel.md` §5.4 응답 계약 표 | 가독성 리스크만 기록. rename 은 breaking change 이므로 운영상 혼동 사례 없으면 유지 |
| 2 | convention_compliance + plan_coherence | `details.field` "미확정 — 후속 e2e 확인 대기" placeholder 는 이미 추적 중이나, plan 체크리스트의 캡처 범위가 신규 2필드(`botToken`·`inboundSigningPlaintext`)로만 좁게 읽힐 소지 — 기존 3필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)도 같은 불확실성 대상 | §5.4.1·§5.4.1.1 전 필드 | e2e 실측 시 신규 2필드뿐 아니라 기존 3필드까지 함께 캡처해 한 번에 문서 전체 캐비아트 해소 |
| 3 | convention_compliance | R-CC-21 "처방의 함정" 절의 리뷰 인용에 세션 경로(`hh_mm_ss`)가 없음 | `spec/5-system/15-chat-channel.md` R-CC-21 | 해당 리뷰 라운드 경로 인용 추가 검토(문서에 기존 경로-인용 선례가 없어 강제 사유는 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | §5.4.1/R-CC-21 "비밀 불변" 서술이 Telegram server-issued 서명 회전과 정면 모순 |
| rationale_continuity | MEDIUM | R-CC-21 요약문("어떤 비밀도 쓰지 않는다")이 §4.1·§5.4.1.1·자매 spec R-12 가 그은 경계보다 넓게 서술 — plan 이 발견했으나 아직 미정정 |
| convention_compliance | NONE | `spec/conventions/**` 전 축(에러 봉투·감사 액션·secret ref·swagger writeOnly·Rationale ID) 위반 없음, INFO 2건만 |
| plan_coherence | MEDIUM | R-CC-21 발견 후속이 developer plan 안에만 존재하고 상위 트래커에 미등재; §5.4.1 표 2행 캐비아트 누락 |
| naming_collision | LOW | `ChatChannelPatchConfigDto` — 신규 "Patch" 접두 패턴이 부모 DTO 어휘(Update)와 불일치 |

## 권장 조치사항
1. **(BLOCK 해소)** planner 턴에서 `spec/5-system/15-chat-channel.md` §5.4.1 신설행·`R-CC-21` 요약문과 `spec/data-flow/14-chat-channel.md` §1.3 신설행 세 곳에 Telegram server-issued inbound-signing carve-out 을 명시한다(§5.4.1.1 "slack/discord 한정" 제목과 동일 패턴). 위 §planner 인계 참조.
2. 이번 impl-prep 세션에서 D-2 를 구현할 때는 plan 이 이미 식별한 코드 축을 그대로 따른다 — `triggers.service.ts:948-952`, `:957-969` 만 PATCH 경로에서 게이팅하고 `:981-993`(Telegram server-issued rotate)은 무조건 유지해 회귀를 만들지 않는다.
3. plan 이 `plan/complete/` 로 이동하기 전에 R-CC-21 산문 폭 정정 발견을 `plan/in-progress/spec-draft-nullable-notation-followups.md`(또는 신규 planner 트래커)에 별도 항목으로 등재한다.
4. `spec/5-system/15-chat-channel.md` §5.4.1/§5.4.1.1 표의 "트리거 활성화 PATCH" 행에 자매 항목과 동일한 "미확정" 캐비아트를 부여하거나 별도 판정 turn 으로의 cross-link 을 남긴다.
5. `ChatChannelPatchConfigDto` 명명을 `UpdateTriggerDto` 어휘에 맞춰 재검토하거나 "Patch" 사용 근거를 D-1 설계에 기록한다(WARNING).
6. e2e 로 `details.field` 를 실측할 때 신규 2필드뿐 아니라 기존 3필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)까지 함께 캡처한다(INFO).

---

## 호출자(main) 주석 — 두 가지를 기록해 둔다

> 위 본문은 `consistency-summary` 가 쓴 정본이다. 아래 두 줄만 호출자가 덧붙인다.

**1. 개수를 처음에 0 으로 잘못 셌다.** 발견사항이 `## 발견사항` 절의 불릿
(`- **[CRITICAL]** …`)으로 쓰이는데 `^#.*\[CRITICAL\]` 로 헤딩만 훑어 **다섯 파일 전부 0** 을
얻었다. 그 0 을 믿었으면 살아 있는 CRITICAL 을 통과시켰다. 태그 전수(`grep -ho`)로 바꿔 1건을
찾았다 — 이 저장소에서 개수를 반복해 틀린 자리라 방법을 함께 적어 둔다.

**2. 같은 경계를 착수 전 실측에서 나도 찾았지만 한 칸 좁게 결론지었다.** plan 의 「발견한 경계」
절은 *"정본 표 둘은 만족되고 넓은 것은 R-CC-21 **산문**뿐"* 이라고 적었다. 그런데
`spec/data-flow/14-chat-channel.md:151` — 어제 PR #1311 에서 **변경안 G 로 내가 직접 쓴 정본
data-flow 행** — 이 provider 무관 무조건으로 *"`secret_store` 무변경"* 이라 말한다. 산문이 아니라
표 행이고, telegram 에서 거짓이다. **내가 편집한 문서를 내가 검토할 때 한 칸 좁아진 사례**다.
