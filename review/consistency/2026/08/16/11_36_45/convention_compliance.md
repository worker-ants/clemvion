# 정식 규약 준수 검토 — convention_compliance (`11_36_45`)

## 방법론 메모

프롬프트 번들은 이번에도 `spec/conventions/` 대부분(`error-codes.md`·`execution-context.md`·`node-output.md`·
`secret-store.md`·`swagger.md`·`redis-keys.md` 등)과 `spec/5-system/` 상당수(`14-external-interaction-api.md`
포함), 그리고 `git diff origin/main...HEAD -- code_areas` 자체를 "컨텍스트 예산 초과 — 본문 생략"으로
비웠다. 번들 placeholder 를 "해당 내용 없음"으로 오판하지 않기 위해 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD`, `spec/5-system/14-external-interaction-api.md`,
`spec/conventions/secret-store.md`, `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`
를 직접 Read/grep 로 재확인했다.

## 실제 diff 요약 (origin/main...HEAD, 6 커밋)

`spec/**` 변경 **0줄**. 코드 변경은 `codebase/backend/src/shared/utils/terminal-error-payload.ts`
(`toTerminalErrorPayload` 의 egress 초크포인트에 module-private `redactTerminalError` 추가, `message`/
`details` 에 `deepRedactSecrets` 적용) + `terminal-error-payload.spec.ts`(테스트 8건) +
`sanitize-error-message.ts`(docstring 정정, 로직 무변경) + `plan/in-progress/eia-terminal-error-sanitize.md`
(신규) + `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(체크리스트) 뿐이다. 새 API·DTO·
에러코드·URL·이벤트 페이로드 스키마 신설이 없고 `TerminalErrorPayload` wire shape(`{code, message, nodeId,
details?}`, EIA §6.4)도 불변 — 이전 두 라운드(`09_25_29`·`10_19_31`)가 이미 확인한 대로 이번 diff 가
여는 `spec/conventions/**` 표면은 매우 좁다. `5d4d8dab7`(11:26, `sanitize-error-message.ts` docstring을
총칭→열거 표로 교체)도 로직 변경 없는 산문 정정이라 동일 결론.

## 점검 관점별 확인

1. **명명 규약** — 신규 식별자는 `redactTerminalError`(비export) 하나뿐이고, 기존 `redactSecrets`/
   `deepRedactSecrets`/`redactThreadForPublic`/`sanitizePayloadForWs` 와 동일 `redact*`/`sanitize*` 계열
   네이밍을 따른다(`10_19_31` 라운드 확인 재검증, 변경 없음). 신규 API endpoint·DTO·에러코드 없음.
2. **출력 포맷 규약** — `TerminalErrorPayload` 필드 집합·타입 불변(`code: string|null`, `message: string`,
   `nodeId: string|null`, `details?`). 변경은 `message`/`details` **값**의 마스킹뿐이며
   `spec/5-system/14-external-interaction-api.md` §6.4 의 wire 계약(§6.4, L774-789)을 깨지 않는다.
   `error.code` 값들(`EXECUTION_TIMEOUT` 등)은 `spec/conventions/error-codes.md §1` 의 의미 기반
   `UPPER_SNAKE_CASE` 명명과 계속 정합.
3. **문서 구조 규약** — `spec/5-system/` 대상 파일 변경 없음, 구조 위반 없음. 신규 `plan/in-progress/
   eia-terminal-error-sanitize.md` frontmatter 는 `worktree`/`started`/`owner`/`branch`/`spec_impact: none`
   을 모두 갖춘다(`spec_impact: none` 은 `git diff --stat -- spec/` 실측 0건과 일치).
4. **API 문서 규약(swagger.md)** — `TerminalErrorPayload` 는 REST 응답 DTO 가 아니라 WS/SSE/webhook 공용
   emit 유틸이라 `@nestjs/swagger` 데코레이터 대상이 아니다. 해당 없음(변경 없음).
5. **금지 항목** — `deepRedactSecrets` 를 DB write 가 아닌 egress 시점에 적용하는 것은 EIA §R17
   "egress-only masking" 원칙과 부합. 방어 강도 비대칭(`CONNECTION_STRING_PATTERN`/`STACK_TRACE_PATTERN`
   미적용)은 JSDoc·CHANGELOG·plan 3곳에 명시적으로 등재돼 은폐되지 않는다 — 금지 패턴 재발 아님.

## 발견사항

### [WARNING] `interaction.triggerToken` 이 `SecretResolver` 를 경유하지 않고 JSONB 평문 보관 (재확인 — 미해소)
- target 위치: `spec/5-system/14-external-interaction-api.md` §7.1 Trigger 엔티티 확장 각주
  (L903: `` `config.interaction.triggerToken` 는 현재 JSONB 평문 (향후 secret store 통합 검토) ``)
- 위반 규약: `spec/conventions/secret-store.md` Overview — "모든 도메인 모듈 (chat-channel / external-
  interaction / 향후 cafe24·OAuth 등) 은 본 convention 의 `SecretResolver` 를 경유해 secret 을 읽고
  쓴다."
- 상세: 같은 모듈(`external-interaction`)의 `notification.signing.secretRef`(`secret://triggers/
  {triggerId}/notification-signing`)는 URI scheme·`SecretResolver` 경유를 정확히 따르는데(§1 예시와
  문자 그대로 일치), 바로 옆 필드인 `interaction.triggerToken`(`itk_*`, `per_trigger` 영구 토큰,
  §7.3/§8.3)은 평문으로 남아 있다. secret-store.md 의 적용 범위 선언은 예외를 두지 않고, `itk_*`
  는 "trigger 가 만드는 모든 execution 에 적용되는 영구 토큰"이라 leak 시 파급력이 notification
  signing secret 과 동급이다(§8.3 이 스스로 그 민감도를 인정). 이번 검토 시점(`git log` 확인)까지도
  `plan/in-progress/**`·`spec/conventions/secret-store.md` 어느 쪽에도 이 필드를 위한 추적 plan 이나
  "비대상" 등재가 없다 — `09_25_29` 라운드가 처음 지적한 이후 두 라운드(`10_19_31`·`11_26_51`)가
  이번 PR 의 diff-scope(마스킹 하드닝) 밖이라는 이유로 재론하지 않았을 뿐, spec 텍스트 자체는
  그대로다.
- 제안: 이번 PR 의 차단 사유는 아니다(diff 무관, developer 권한 밖 — `spec/` read-only). 다음
  `project-planner` 턴에서 택일: (a) `interaction.triggerToken` 을 `secret://triggers/{triggerId}/
  interaction-token` 슬롯으로 옮기고 구현 plan 신설, 또는 (b) 의도된 예외라면 `secret-store.md §1`
  "비대상" 절(현재 `AuthConfig.config` 만 명시)에 `interaction.triggerToken` 을 명시적으로 등재하고
  근거(예: opaque 토큰 자체가 이미 revoke 가능한 비밀이라 별도 암호화 계층 불필요)를 Rationale 에
  남긴다.

### [INFO] R17/§6.4 마스킹 카탈로그 SPEC-DRIFT — 이미 다른 채널로 추적 중 (중복 방지 차원의 교차 참조)
- target 위치: `spec/5-system/14-external-interaction-api.md` §6.4(L770-789), §R17(L1371-1457)
- 위반 규약: 엄밀히는 `spec/conventions/**` 항목이 아니라 spec 본문 자체의 완전성(코드가 구현한 새
  보안 불변식이 spec 카탈로그에 미반영) 문제 — `cross_spec`/`plan_coherence`/`rationale_continuity`
  체커의 1차 소관이며, 이번 세션에서 `10_19_31`(WARNING)·`11_26_51` 코드리뷰(WARNING)가 이미
  등재했고 `plan/in-progress/eia-terminal-error-sanitize.md` "후속" 절에 `project-planner` 턴 항목으로
  명시돼 있다. `spec/conventions/error-codes.md`·`node-output.md` 등 어느 규약도 필드 표에 보안
  캐비엇 기재를 의무화하지 않으므로 본 체커(convention_compliance) 관점에서는 규약 위반으로
  분류하지 않고 정보성으로만 교차 참조한다.
- 제안: 별도 조치 불요(중복 등재 방지). `project-planner` 턴에서 §6.4 필드 표 + R17 5번째 불릿
  갱신 시 함께 해소.

### 확인됨 — 이전 라운드 지적 정정 반영
- `09_25_29`(당시 convention_compliance 로 발견되진 않았으나 인접 체커가 지적)·`10_19_31` INFO1
  이 지적한 `CHANGELOG.md`/`plan/in-progress/eia-terminal-error-sanitize.md` 의 "§3.3" 오인용은
  현재 두 문서 모두 "§3.1"로 정정되어 있음을 실측 확인(`grep` 결과 `§3.3` 잔존 0건).

## 검토 결과 요약 (위반 없음으로 재확인된 항목)

- 문서 구조(`## Overview (제품 정의)` → 본문 → `## Rationale`), 파일명 numeric-prefix, 에러 코드
  `UPPER_SNAKE_CASE`, 에러 응답 봉투(`2-api-convention.md §5.3`), `null` vs 키 생략(§5.4), Redis 키
  네이밍, 감사 액션 명명, swagger Bearer scheme 등록 패턴, `interactionType` 3값 매핑, URL 구조 —
  전부 `09_25_29` 라운드의 직접 대조 결과가 이번 라운드까지 그대로 유효(spec 본문 변경 없음).

## 요약

이번 diff 는 `spec/**`를 전혀 건드리지 않는 좁은 보안 하드닝(egress 마스킹)이라 `spec/conventions/**`
가 규율하는 명명·출력포맷·API문서 표면을 거의 열지 않았고, 열린 유일한 지점(EIA §R17 egress-only
원칙 인용)은 spec 원문과 정확히 부합한다. 신규로 재확인된 것은 이번 PR 과 무관한 **선존** 위반
1건(`interaction.triggerToken` 의 `SecretResolver` 미경유, `secret-store.md` 위반) 뿐이며, 5라운드에
걸쳐 이미 등재·트래킹 중인 SPEC-DRIFT(R17/§6.4 마스킹 카탈로그 미반영)는 본 체커의 직접 소관이
아니라 교차 참조로만 기록한다. 둘 다 이번 PR 을 막을 사유가 아니다.

## 위험도
LOW
