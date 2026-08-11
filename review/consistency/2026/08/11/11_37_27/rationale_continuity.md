# Rationale 연속성 검토 — spec/7-channel-web-chat (impl-done)

## 검토 초점 (이번 라운드)

직전 라운드 WARNING(§R4 의 EIA §5.5 인용이 실제로는 반대를 말하는 절을 가리킴)에 대한 수정을 재검증한다.
target 은 인용을 코드 SoT(`interaction.controller.ts`)로 바꾸고 "[EIA §5.5] 본문은 이 분기를 아직 담지 않는다"
는 캐비엇을 추가했으며, 갭을 EIA 소유 plan(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에
등재했다고 서술한다. 이번 라운드는 **그 서술의 정확성**(캐비엇이 실제 EIA 본문 상태와 일치하는지)을 CRITICAL
기준으로 엄격히 검증하는 데 집중했다. 비-CRITICAL 사안은 발견사항으로 올리지 않고 요약에만 기록한다.

## 검증 절차 및 근거

1. **target 서술** (`3-auth-session.md §3.1`, 라인 130-133):
   > `/refresh-token` 이 실제로 내는 분기다 — 코드 SoT 는 `interaction.controller.ts` 의
   > `@ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })` 다. **[EIA §5.5] 본문은 이 분기를 아직 담지
   > 않는다**(그 자리를 `401` 로만 적는다) — 그 갭은 EIA 소유이며
   > [`spec-sync-external-interaction-api-gaps.md`](../../plan/in-progress/spec-sync-external-interaction-api-gaps.md)
   > 에서 다룬다.

2. **코드 SoT 대조** (워킹트리 절대경로로 직접 확인):
   - `codebase/backend/src/modules/external-interaction/interaction.controller.ts:138-149` — `refreshToken`
     핸들러에 `@ApiGoneResponse({ description: 'EXECUTION_TERMINATED' })` 가 실제로 존재.
   - `codebase/backend/src/modules/external-interaction/interaction.service.ts:247-259` — `refreshToken()` 이
     execution 이 terminal 상태면 `throw new GoneException({ error: { code: 'EXECUTION_TERMINATED', ... } })` 를
     실제로 낸다(HTTP 410).
   - → **"코드 SoT" 인용은 정확** — 지어낸 참조가 아니라 실제 데코레이터·throw 지점.

3. **EIA §5.5 본문 대조** (`spec/5-system/14-external-interaction-api.md:505-518`):
   ```
   ### 5.5 토큰 갱신 — POST /api/external/executions/:executionId/refresh-token
   ...
   200 OK { token, expiresAt }
   401 Unauthorized   // execution 종료됨, 또는 expiresAt 까지 30분 이상 남음
   ```
   → §5.5 는 실제로 `410` 을 전혀 언급하지 않고, execution 종료 사유를 **`401`** 자리에 뭉뚱그려 적고 있다.
   target 의 "본문은 이 분기를 아직 담지 않는다(그 자리를 401 로만 적는다)" 캐비엇은 **정확히 현재 상태와 일치**한다
   — 과장도 축소도 없다.

4. **갭 등재 대조** (`plan/in-progress/spec-sync-external-interaction-api-gaps.md:49-64`):
   `## §5.5 가 410(EXECUTION_TERMINATED) 분기를 담지 않는다 (2026-08-11 등재)` 섹션이 실제로 존재하며,
   - "구현이 하는 일을 spec 이 안 적는다"는 방향까지 정확히 서술
   - 어떻게 드러났는지(`cross_spec`·`rationale_continuity` 두 checker 가 독립적으로 이전 라운드 인용 오류를 잡음)
     까지 기록
   - `[ ] §5.5 에 410 Gone (EXECUTION_TERMINATED) 응답 추가` + `[ ] 추가 후 §R4 의 캐비엇 제거` 체크박스로
     후속 작업이 명시적으로 남아 있음(frontmatter `owner: planner`, `related spec: 14-external-interaction-api.md`
     — EIA 소유가 맞음).
   → target 의 "그 갭은 EIA 소유이며 …에서 다룬다" 서술과 정확히 일치.

5. **부수 확인**: 같은 diff 에서 도입된 `isTerminalAuthError()`(`eia-client.ts`)가 `401`/`410` 을 함께 재시도-불가
   실패로 취급하도록 `use-token-refresh.ts`/테스트에 일관 적용되어 있어, R4 본문("재차 실패는 401/410 만
   뜻한다")과 구현이 어긋나지 않는다. 새로운 Rationale 위반·기각된 대안 재도입 징후는 발견되지 않았다.

## 발견사항

없음 — CRITICAL 등급 사안이 발견되지 않았다. (비-CRITICAL 관찰은 아래 요약에 기록하고 별도 항목화하지 않는다.)

## 요약

이전 라운드 WARNING 은 이번 라운드에서 정확하게 처분됐다. `3-auth-session.md §3.1`(R4 관련 서술)이 EIA §5.5 를
가리키던 인용을 실제 코드 SoT(`interaction.controller.ts`/`interaction.service.ts` 의 `@ApiGoneResponse`·
`GoneException`)로 교체했고, "EIA §5.5 본문은 이 분기를 아직 담지 않는다" 캐비엇은 실제 EIA 문서 상태(§5.5 가
`401` 만 적고 `410` 을 언급하지 않음)와 정확히 일치한다. 갭은 지어낸 참조가 아니라 `plan/in-progress/
spec-sync-external-interaction-api-gaps.md` 에 EIA 소유로 실제 등재돼 있고, "이전 인용 오류가 두 checker 에게
독립적으로 잡혔다"는 경위와 "§5.5 갱신 후 캐비엇 제거"라는 후속 작업까지 명시돼 추적 가능하다. 같은 diff 에서
도입된 `isTerminalAuthError()` 공유 술어도 R4 가 규정한 "재차 실패는 401/410 만" 이라는 경계를 정확히 구현해
Rationale 과 코드 사이에 새로운 불일치를 만들지 않았다. Rationale 연속성 관점에서 이번 target 은 과거 기각된
대안을 되살리거나 합의 원칙을 우회하는 지점이 없다.

## 위험도

NONE
