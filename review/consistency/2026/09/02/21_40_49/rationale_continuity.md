# Rationale 연속성 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위와 방법

- 전량 본문 검토: `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md`,
  `spec/5-system/2-api-convention.md` (프롬프트 번들에 전문 포함) — 본문과 각 문서 자체의
  `## Rationale` 을 줄 단위로 대조.
- 발췌 검토: 프롬프트가 함께 실은 "관련 Rationale 발췌" — `2-navigation/9-user-profile.md`,
  `1-data-model.md`, `data-flow/2-auth.md`, `0-overview.md`, `2-navigation/1-workflow-list.md`,
  `2-navigation/2-trigger-list.md`, `2-navigation/4-integration.md`(Cafe24/MakeShop 대목) 등의
  `## Rationale` 을 대조.
- 보완 검토(리포지토리 직접 열람): 프롬프트 예산 초과로 본문이 생략된 15개 `spec/5-system/*`
  파일(`4-execution-engine.md`·`6-websocket-protocol.md`·`14-external-interaction-api.md`·
  `12-webhook.md`·`15-chat-channel.md` 등) 중 상호참조 빈도가 높은 5개를 리포지토리에서 직접 열어
  `## Rationale` 하위 헤더 목록을 확인. 그중 "번복" 표시가 붙은 항목 2건을 본문과 대조.
- 교차 검증: `1-auth.md §"부트 캐너리"` 가 인용하는 "이미 기각한 라우트별 opt-in 마커" 주장을
  출처인 `spec/data-flow/12-workspace.md §"멤버십 검증은 가드 1곳에서"` 원문과 대조해 사실 여부
  확인(허구 Rationale 여부 점검, 메모리 `feedback_rationale_rejected_alternatives_need_history`
  대응).
- 관련 `plan/in-progress/*` 3건(`auth-change-password-oauth-only-code-split.md`,
  `auth-guard-reflection-hardening.md`)을 열어 target spec 이 그 plan 이 이미 처분한 대안을
  이유 없이 되살리고 있지 않은지 확인.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO] 예산 초과로 생략된 15개 파일의 본문-Rationale 전수 대조는 미수행**
  - target 위치: `spec/5-system/4-execution-engine.md`·`6-websocket-protocol.md`·
    `8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·
    `13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·
    `17-agent-memory.md`·`_product-overview.md`·`5-expression-language.md`·`7-llm-client.md`·
    `11-mcp-client.md`·`16-system-status-api.md` (프롬프트 번들에서 "컨텍스트 예산 초과로 절단"
    표시)
  - 과거 결정 출처: 해당 없음 (커버리지 한계 기록)
  - 상세: 위 15개 파일은 `spec/5-system/` 전체 분량의 과반을 차지한다(예: execution-engine
    227,603자, EIA 132,157자, websocket-protocol 100,401자). 리포지토리에서 5개 파일
    (`4-execution-engine`·`6-websocket-protocol`·`14-external-interaction-api`·`12-webhook`·
    `15-chat-channel`)의 `## Rationale` 하위 헤더 목록만 직접 확인했고, 그중 "번복" 표시가 붙은
    2건(execution-engine `"Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 'WARN #6
    미영속' 번복)"`, `"failed → running 재진입 전이 (옛 'park 도달 후 발효' 번복)"`, EIA
    `"R17. getStatus 의 currentNode/context 실값 노출 (null placeholder 부분 번복)"`)은 모두
    새 근거가 함께 적힌 정상적 사례였다. 그러나 헤더만 훑었을 뿐 각 파일의 본문 전체를
    Rationale 과 줄 단위로 대조하지는 않았으므로, 이 15개 파일 안에 있을 수 있는 조용한
    Rationale 위반은 본 리포트가 보증하지 못한다.
  - 제안: 다음 라운드에서 이 15개 파일을 단독 scope(`--impl-prep <file>`)로 나눠 돌리면 예산
    절단 없이 전수 대조가 가능하다.

## 정합성이 확인된 주요 사례 (참고용 — 위반 아님)

검토 과정에서 "번복처럼 보이지만 실제로는 근거를 갖춘" 사례를 다수 확인했다. 오탐 방지를 위해
기록한다.

- `1-auth.md §Rationale "부트 캐너리"` 가 `SetMetadata + Reflector opt-in 마커` 대안을
  "이미 기각한 패턴" 으로 인용한 근거를 `data-flow/12-workspace.md §"멤버십 검증은 가드
  1곳에서"` 원문과 대조 — "기각된 대안 — 73개 라우트에 `@Roles('viewer')` 부착: opt-in 모델의
  연장이라 74번째 라우트에서 같은 누락이 재발한다(이미 최소 2회 발생)" 문구가 실제로 존재.
  허구 Rationale 아님.
- `plan/in-progress/auth-guard-reflection-hardening.md` 는 부트 캐너리 vs opt-in 마커 재검토
  시 위 `rationale_continuity` 이력을 직접 인용하며 opt-in 마커를 "채택 안 함(근거 확보)" 로
  명시 — 과거 기각을 존중해 재도입하지 않은 모범 사례.
- `plan/in-progress/auth-change-password-oauth-only-code-split.md` 는 초판 권장(B안,
  `PASSWORD_NOT_SET` 신설)을 착수 직전 실측으로 스스로 뒤집으며 "표를 사후 재작성했다 —
  그대로 두면 다음 사람이 폐기된 권장을 읽는다" 고 명시하고 D안(형제 코드 재사용)을 채택했다.
  현재 `spec/5-system/1-auth.md §339·§521·§750`, `3-error-handling.md §1.2/§1.2.1` 본문이
  D안과 정확히 일치한다 — 결정 번복에 새 Rationale 이 동반된 정상 사례.
- `3-error-handling.md §7.2` 의 "구 'liveness probe 용' 결정 번복" 주석은 번복 사실과 새
  근거(readiness 전용 재정의 + `/api/health/live` 신설)를 함께 명시.
- `2-api-convention.md §Rationale "conversationThread를 null로 정규화하지 않는가"` ·
  `"§10.4 재연결 요약 위임"` 등은 모두 기각/유지 판단에 구체적 대안 비교와 트레이드오프를
  함께 적어 두었다.
- `1-auth.md §Rationale "1.1.B-4"` 는 §2.3 세션-revoke 재인증 서술이 실제로는 미구현
  대안(WebAuthn/이메일 OTP)을 과대 서술하고 있던 drift 를 `§2.3.D` 로 정정하며, 정정 사유·
  구현 근거·계보(`spec-draft-email-change` → `refactor-auth-reverify-unify` 유실 → 본 정정
  완결)를 명시 — 무근거 번복이 아니라 이력이 추적 가능한 정합화.

## 요약

`spec/5-system/1-auth.md`·`3-error-handling.md`·`2-api-convention.md` 전문과, 프롬프트가 함께
실은 관련 spec Rationale 발췌를 대조한 결과 기각된 대안의 재도입·합의 원칙 위반·무근거 결정
번복·암묵적 invariant 우회 사례를 찾지 못했다. 오히려 이 세 문서는 최근(2026-08-31~09-02)
발견된 drift 를 정정할 때마다 "무엇을 왜 바꿨는지"·"과거 서술이 어디서부터 틀렸는지"를 실측과
함께 남기는 패턴이 일관돼 있고, 과거 기각(예: 라우트별 opt-in 마커, `Lax` 기본 SameSite, 옛
"park 도달 후 발효" 전이)을 재검토할 때도 그 기각 근거를 인용하며 되돌리지 않는 사례가 다수
확인됐다. 다만 `spec/5-system/` 의 절반 이상을 차지하는 15개 파일이 컨텍스트 예산 초과로 프롬프트
본문에서 생략됐고, 그중 5개의 Rationale 헤더만 spot-check 했을 뿐 본문 전수 대조는 하지 못했다 —
이 커버리지 공백이 본 검토의 유일한 한계다.

## 위험도

NONE
