# 정식 규약 준수 검토 — convention_compliance

## 스코프 메모 (조립 예산 초과)

프롬프트 번들이 컨텍스트 예산을 초과해 `spec/5-system/14-external-interaction-api.md`(EIA 본문, 이번 diff 가 직접 관련된 spec)를 포함한 **spec/5-system 16개 파일 전량**과 `spec/conventions/` 대부분(`error-codes.md`/`execution-context.md`/`node-output.md`/`secret-store.md`/`swagger.md`/`redis-keys.md` 등), 그리고 `git diff origin/main...HEAD -- code_areas` 자체가 "본문 생략됨" 처리되어 프롬프트에 없었다. 번들 누락을 "해당 내용 없음"으로 오판하지 않기 위해, 지시대로 워킹트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 `git diff origin/main...HEAD`, `spec/5-system/14-external-interaction-api.md`, 관련 `spec/conventions/*.md` 를 직접 Read/grep 로 재확인한 뒤 아래를 작성했다.

## 실제 diff 요약 (origin/main...HEAD)

`spec/**` 변경 없음. 코드/plan/리뷰 아티팩트만 변경:
- `codebase/backend/src/shared/utils/terminal-error-payload.ts` — `toTerminalErrorPayload` 의 egress 초크포인트에 `redactTerminalError`(신규, 비export) 추가. `message`/`details` 에 `deepRedactSecrets` 적용
- `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts` — 상단 docstring만 수정(적용 범위를 "WS/알림/이메일"→"알림 표면 한정"으로 좁힘)
- `codebase/backend/src/shared/utils/terminal-error-payload.spec.ts` — 마스킹 테스트 8건 추가
- `plan/in-progress/eia-terminal-error-sanitize.md` — 신규 plan 문서
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 체크리스트 갱신
- `CHANGELOG.md` — Unreleased 항목 추가
- `review/code/**`, `review/consistency/**` — 직전 리뷰 라운드 산출물(이미 존재하는 아티팩트)

즉 이번 라운드에서 검토 대상이 될 "정식 규약(spec/conventions/**) 위반 표면"은 극히 좁다 — 새 API·DTO·에러코드·URL·이벤트 페이로드 스키마 신설이 없고, 기존 `TerminalErrorPayload` wire shape(`{code, message, nodeId, details?}`, EIA §6.4)도 불변이다.

## 점검 관점별 확인

1. **명명 규약** — 신규 함수 `redactTerminalError`(비export, 모듈 내부)는 기존 `redactSecrets`/`deepRedactSecrets`/`redactThreadForPublic`/`stripAndRedact`/`sanitizePayloadForWs` 등과 동일 `redact*`/`sanitize*` 계열 네이밍을 따른다. 새 API endpoint·DTO·에러코드 신설 없음 — 위반 없음.
2. **출력 포맷 규약** — `TerminalErrorPayload` 필드 집합·타입은 그대로다(`code: string|null`, `message: string`, `nodeId: string|null`, `details?`). 변경은 `message`/`details` **값**의 마스킹뿐이며 [`spec/5-system/14-external-interaction-api.md` §6.4](spec/5-system/14-external-interaction-api.md) 의 wire 계약을 깨지 않는다. `code: string|null`이므로 `error-codes.md` §1 명명 규약(신규 코드 미신설) 대상도 아니다.
3. **문서 구조 규약** — 신규 `plan/in-progress/eia-terminal-error-sanitize.md` 는 frontmatter 에 `worktree`/`started`/`owner`/`branch`/`spec_impact: none` 을 모두 갖춰 `.claude/docs/plan-lifecycle.md` 스키마를 준수한다(`spec/` 미변경과 `spec_impact: none` 이 실측과 일치 — `git diff --stat -- spec/` 결과 0건 확인).
4. **API 문서 규약(swagger.md)** — `TerminalErrorPayload` 는 REST 응답 DTO 가 아니라 WS/SSE/webhook 공용 emit 유틸이라 `@nestjs/swagger` 데코레이터 대상이 아니다. swagger DTO/controller 변경 없음 — 해당 없음.
5. **금지 항목** — `deepRedactSecrets` 를 DB write 시점이 아닌 egress 시점에 적용한 것은 EIA §R17 "egress-only masking" 원칙과 표현이 정확히 일치한다(spec 원문 `- **egress-only(의도)**: 내부 소비처(...)는 faithful 텍스트를 유지한다` — 코드 주석의 "EIA §R17 의 egress-only masking 원칙" 인용과 부합). 자매 유틸과 방어 강도가 비대칭이라는 사실(`CONNECTION_STRING_PATTERN`/`STACK_TRACE_PATTERN` 미적용)은 은폐되지 않고 JSDoc·CHANGELOG·`spec-sync-external-interaction-api-gaps.md` 세 곳에 명시적으로 등재돼 있다 — "자매 함수 미적용" 류의 침묵 누락이 아니라 공개된 스코프 결정이다.

### 발견사항

- **[INFO]** CHANGELOG/plan 문서의 EIA 섹션 인용 번호 오류(§3.3 → 실제로는 §3.1)
  - target 위치: `CHANGELOG.md` "Unreleased — 종결 이벤트 `error` 가 자격증명 마스킹 없이…" 항목 2번째 문단 ("EIA outbound webhook(§3.3)"), `plan/in-progress/eia-terminal-error-sanitize.md` "실측 — 네 고리를 다 확인했다" 표의 "도달 범위" 행 ("EIA outbound webhook(§3.3)")
  - 위반 규약: 엄밀히는 `spec/conventions/**` 항목이 아니라 spec 본문(`spec/5-system/14-external-interaction-api.md`)에 대한 인용 정확성 문제 — cross_spec 검토 영역과 인접. 다만 문서 신뢰성 관점에서 함께 보고한다.
  - 상세: `spec/5-system/14-external-interaction-api.md` 에서 `§3.3` 은 "인증"(Authentication, EIA-AU-*) 섹션이고, "Outbound Notification (Notification Webhook)" 요구사항은 `§3.1`(EIA-NX-*)이다. 실제 outbound webhook 페이로드 스펙은 `§6`("API 명세 — Outbound Notification") + `§6.4`(`execution.failed` 페이로드)에 있다. 두 문서 모두 마스킹이 적용되는 채널을 "WS + SSE(§5.2) + EIA outbound webhook(§3.3)" 으로 나열하는데, §3.3 인용은 실제로는 인증 요구사항을 가리켜 근거로 부적절하다.
  - 제안: `(§3.3)` → `(§3.1)` 또는 페이로드 형식까지 정확히 짚으려면 `(§3.1·§6.4)` 로 정정. 코드 주석(`terminal-error-payload.ts`) 은 애초에 절 번호를 인용하지 않아 문제 없음 — CHANGELOG·plan 두 문서만 정정 대상.

## 요약

이번 diff 는 `spec/`를 전혀 건드리지 않고 EIA 종결 이벤트(`toTerminalErrorPayload`)의 egress 마스킹을 좁고 문서화된 스코프로 추가한 코드+plan 변경이다. 신규 API·DTO·에러코드·wire 스키마가 없어 `spec/conventions/**` 가 규율하는 명명·출력포맷·API문서 규약 표면 자체가 거의 열리지 않았고, 열린 유일한 지점(EIA §R17 egress-only masking 원칙 인용)은 spec 원문과 정확히 부합한다. 유일하게 확인된 흠은 CHANGELOG·plan 문서의 EIA 섹션 인용 오탈(§3.3→§3.1)로, 정식 규약 위반이 아니라 인접 문서 정확성 이슈다.

## 위험도
LOW
