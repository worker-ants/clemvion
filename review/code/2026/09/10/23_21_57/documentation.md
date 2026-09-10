# 문서화(Documentation) 리뷰 — `impl-chat-channel-patch-token`

## 개요

리뷰 대상은 `ChatChannelUpdateConfigDto` 신설(D-1) · `setupChatChannel` secret 쓰기 게이팅(D-2) ·
관련 서비스/테스트/e2e 변경(D-3 포함) 7개 코드/plan 파일과, 같은 커밋에 동봉된
`review/consistency/2026/09/10/{21_37_56,22_45_26}/**` consistency-check 산출물 16개다.
후자는 사람이 손으로 쓴 애플리케이션 문서가 아니라 다른 sub-agent 가 생성한 검토 세션
아티팩트(`review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)이며 이미 그 자체가 문서 정합성을
스스로 검토·수렴(21_37_56: CRITICAL 1건 발견 → 22_45_26: BLOCK:NO 로 해소)한 기록이라, 이번
문서화 리뷰의 본 스코프(코드 diff 의 독스트링/주석/README/API 문서)에서는 형식 준수 여부만
확인하고 본문 판정은 재검토하지 않았다. 코드 변경 자체는 JSDoc/스펙 인용/설계 근거 문서화
수준이 이 저장소 평균 대비 상당히 높다 — DTO·서비스 신규 코드 대부분에 "왜"를 설명하는
장문 JSDoc, 표, `@see` 스펙 링크가 동반된다. 아래는 그 안에서 실측으로 확인한 결함이다.

## 발견사항

- **[WARNING]** `assertChatChannelInputSafe` 최상단 JSDoc 이 이번 diff 로 추가된 `mode` 매개변수와
  분기를 반영하지 못해, "Provider-issued plaintext 분기" 절이 이제 `create` 경로에만 적용된다는
  사실이 문서에 없다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — 함수 `assertChatChannelInputSafe`
    JSDoc(파일 상 601~617행, 함수 시그니처는 618~621행). 프롬프트 diff 게이트로는 618~621행
    (`private assertChatChannelInputSafe(` ~ `): void {`)만 노출되고, 그 위 JSDoc 본문(601~615행)은
    diff 컨텍스트 밖이라 게이트가 없어 직접 `Read` 로 원본을 열어 확인했다.
  - 상세: 이 JSDoc 은 이번 diff 이전부터 있던 문장으로("Provider-issued plaintext 분기
    (`inboundSigningPlaintext`): telegram: 본 필드 입력 시 400 / slack: **필수**. hex 32 chars /
    discord: **필수**. hex 64 chars"), 함수 본문에 새로 추가된 `if (mode === 'update') { ...
    this.assertPatchCarriesNoSecrets(chatChannel); return; }` 분기를 반영하지 않은 채 그대로
    남았다. 그 결과 이 JSDoc 만 읽으면 "slack/discord 는 `inboundSigningPlaintext` 가 항상 필수"로
    읽히는데, 실제로는 `mode === 'update'`(PATCH) 에서는 이 필드가 **완전히 금지**된다 — "필수"에서
    "금지"로 정반대다. 파일 상단에 이번 diff 로 새로 추가된 `ChatChannelInputMode` 타입 JSDoc(50~60행)
    은 이 create/update 분기를 정확히 설명하고 있어 다른 자리를 먼저 읽으면 오해를 피할 수 있지만,
    함수 바로 위 JSDoc 은 그 지식을 갱신하지 않은 채 낡은 상태로 남아 "오래된 주석"에 해당한다.
  - 제안: 함수 JSDoc 에 한 줄 추가 — 예: "`mode==='update'` 일 때는 이 절 전체가 적용되지 않고
    `assertPatchCarriesNoSecrets` 가 두 필드(`botToken`·`inboundSigningPlaintext`)를 무조건 금지한다."
    또는 "Provider-issued plaintext 분기" 절 앞에 "(`mode==='create'` 전용)" 를 명시.

- **[INFO]** 신설 에러 메시지 하나가 한 문장 안에서 해요체와 합쇼체를 혼용한다 — 같은 diff 의
  형제 메시지들과도 어투가 어긋난다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:703`
    (`assertChatChannelAlreadySetUp` 내부 `BadRequestException` 메시지)
  - 상세: `'chatChannel 최초 설정은 트리거 생성(POST /api/triggers)에서만 할 수 있어요. PATCH 는
    bot token 을 받지 않으므로 채널을 새로 붙일 수 없습니다.'` — 첫 문장은 "~할 수 있어요"(해요체),
    둘째 문장은 "~없습니다"(합쇼체)로 한 메시지 안에서 어투가 바뀐다. 같은 diff 가 새로 추가한
    형제 메시지들(`botToken 은 PATCH 로 변경할 수 없습니다. … 사용하세요.` / `inboundSigningPlaintext
    는 PATCH 로 변경할 수 없습니다. … 재생성하세요.`, 모두 707~713행대)은 전부 합쇼체로 일관돼
    사용자에게 노출되는 API 에러 메시지 톤이 한 기능 안에서 들쭉날쭉해진다. (참고: 706행 근처의
    기존 메시지 `Schedule 타입 트리거는 …할 수 있어요 (…)`는 이 diff 이전부터 해요체를 써 온
    선례라, "이 파일 전체가 합쇼체여야 한다"는 규범은 아니다 — 다만 신규로 쓴 한 문장 내부에서
    스스로 어투를 바꾼 것은 그 선례와도 무관한 별개의 결함이다.)
  - 제안: `'…할 수 있습니다. PATCH 는 bot token 을 받지 않으므로 채널을 새로 붙일 수 없습니다.'`
    처럼 문장 내 어투를 통일한다.

- **[INFO]** `plan/in-progress/impl-chat-channel-patch-token.md` D-2 설계 절의 코드 라인 인용이
  같은 PR 의 구현으로 이미 어긋났다 — 다음 사람이 "설계가 실제로 그 자리에 적용됐는지" 대조할 때
  혼동을 준다.
  - 위치: `plan/in-progress/impl-chat-channel-patch-token.md` `## 설계` 절 D-2 아래 인용 표
    (`> | 자리 | 무엇 | PATCH 에서 |` 표, `:948-952` · `:957-969` · `:981-993` 세 행) — 프롬프트
    diff 게이트로는 46~54행.
  - 상세: 표가 가리키는 세 쓰기 지점은 이번 diff 로 `triggers.service.ts` 상단에 새 타입/주석
    50줄 이상이 추가되면서 실제로는 각각 1067행(bot token rotate) · 1082행(provider-issued
    signing) · 1113행(server-issued signing, telegram)으로 이동했다 — `grep -n "쓰기 ①\|쓰기
    ②\|쓰기 ③"` 로 확인. `## 착수 전 실측` 표(27~32행)의 `:948-952` 인용은 "착수 **전**" 상태를
    명시적으로 표시한 절이라 문제가 아니지만, `## 설계` 절의 동일 번호는 "지금부터 무엇을 어떻게
    바꿀지"를 지시하는 문맥이라 구현 완료 시점에는 이미 stale 한 좌표가 됐다. 실제 코드는 이 문제를
    스스로 해결했다 — `setupChatChannel` 본문에 `[쓰기 ①]`/`[쓰기 ②]`/`[쓰기 ③]` 앵커 주석을
    새로 붙여 줄 번호 대신 이름으로 참조할 수 있게 했는데, plan 문서의 설계 절은 그 앵커로
    갱신되지 않았다.
  - 제안: D-2 표의 `:948-952` 등 줄 번호를 코드가 이미 채택한 앵커 표기(`[쓰기 ①] bot token
    rotate` 등)로 바꾸면 plan 이 살아있는 동안(아직 `plan/complete/` 로 이동 전) 줄 번호 drift 에
    영향받지 않는다.

## 확인한 것 — 문제 없음

- `ChatChannelUpdateConfigDto` 클래스 JSDoc(`chat-channel-config.dto.ts`)은 `OmitType` 채택 이유·
  침묵 대신 명시적 거부를 택한 이유·`Patch` 대신 `Update` 명명 이유·spec 3곳 앵커 링크를 모두
  갖춰 신규 공개 클래스 문서화 기준을 충분히 만족한다.
- `setupChatChannel` 의 신규 JSDoc 은 3-쓰기 표와 `storeUserSuppliedSecrets` 네이밍 근거를 함께
  설명해, 이 함수를 처음 보는 사람이 "두 곳만 막고 세 번째는 왜 무조건 유지하는지"를 코드만
  보고 알 수 있게 한다.
- `update-trigger.dto.ts` 의 `chatChannel` 필드 JSDoc 은 기존 "부분 갱신 — 전체 객체 다시 send"
  설명이 남아 있어도, 바로 아래 새 JSDoc("생성용과 다른 DTO 다 — PATCH 는 botToken ·
  inboundSigningPlaintext 를 받지 않는다")이 그 위에 덧붙어 오독 소지를 없앤다.
  `@ApiPropertyOptional({ type: () => ChatChannelUpdateConfigDto })` 로 Swagger 산출물도 함께
  갱신됐다.
  - PATCH 금지 필드(`botToken`·`inboundSigningPlaintext`)의 `@ApiPropertyOptional` description 이
    각각 400 사유·대체 엔드포인트·`writeOnly: true` 를 명시해, 별도 API 문서 갱신 없이도 Swagger
    UI 자체가 계약을 설명한다 — 이번 변경 규모에서 별도 API 문서 파일 갱신은 불필요.
  - README 검색 결과 `codebase/backend/README.md` 는 `chatChannel`/`botToken` 을 언급하지 않아
    갱신 대상이 아니다. 신규 환경변수·설정 옵션도 이번 diff 에 없다.
- `trigger-dto-validation.spec.ts` · `triggers.service.spec.ts` 의 신규 `describe`/`it` 블록은
  "왜 이 suite 가 생성 경로로 재조준됐는가", "왜 두 곳만 게이팅하고 세 번째는 유지해야 하는가"를
  주석으로 설명해 테스트 자체가 좋은 실행 가능 예제 역할을 한다. `[실측]` 테스트는 5개 필드
  전부의 `details.field` 실제 값을 표로 단언해, 후속 planner 턴이 spec 표기(§5.4.1/§5.4.1.1)를
  고칠 근거를 코드에 정본으로 남긴다.
- `trigger-workflow-ref.e2e-spec.ts` 의 caveat 갱신은 이 저장소 리뷰 인용 관례(`review-citations.md`)에
  맞춰 이전 CRITICAL 인용을 "해소됨" 기록으로 교체했고, 더 이상 유효하지 않은 경고 블록을 방치하지
  않았다 — 오래된 주석 문제의 모범적인 반대 사례다.
- CHANGELOG: 이 저장소는 CHANGELOG 파일 대신 spec 문서의 `## Rationale` 절(R-CC-21 등)을 변경
  이력으로 쓰는 관례이며, 그 spec 정정은 developer 권한 밖이라 이 plan 이 planner 후속으로
  올바르게 넘겼다(plan "발견한 경계" 절, `consistency` SUMMARY 인계 표) — 별도 조치 불요.

## 요약

핵심 신규 코드(DTO·서비스·테스트)의 문서화 수준은 높다 — 설계 근거·spec 앵커·표 형태 요약이
일관되게 동반된다. 다만 (1) `assertChatChannelInputSafe` 최상단 JSDoc 이 이번에 추가된
`mode` 분기를 반영하지 못해 "slack/discord 는 필수"라는 이제 create 전용인 서술이 갱신 없이
남았고(WARNING), (2) 신설 에러 메시지 하나가 문장 내에서 해요체/합쇼체를 섞어 형제 메시지와
어투가 어긋나며(INFO), (3) `plan/in-progress/impl-chat-channel-patch-token.md` 설계 절의 코드
줄 번호 인용이 같은 PR 의 구현으로 이미 stale 해졌다(INFO, 코드 자체는 앵커 주석으로 이미
자가교정). 세 건 모두 기능 결함이 아니라 다음 독자를 오도할 수 있는 문서 정확성 문제이며, 구조적
(README/CHANGELOG/API 문서) 누락은 없다.

## 위험도

LOW
