# RESOLUTION — eia-form-validation (review 21_46_45, final)

대상: `claude/eia-form-validation-0f0d83` — EIA `submit_form` field 검증 구현 + 동반 spec/문서 동기화.
누적 리뷰 사이클: ai-review #1~#5 + consistency `--impl-done` #1~#3. 본 문서는 최종 사이클(#5 / impl-done #3) 기준 종합 disposition.

## 게이트 상태
- **ai-review #5 (21_46_45)**: 전체 위험도 MEDIUM, **Critical 0**, WARNING 2 (모두 minor — 아래).
- **consistency --impl-done #3 (21_46_45)**: **BLOCK: NO** (Critical 0). 구현 ↔ form/EIA/WS spec 정합 확인.
- 단위 6946 pass / lint 0 error / e2e 192 pass (test G 포함).

## WARNING disposition

| # | 발견 | 처리 |
|---|------|------|
| #5-W1 | plan 체크박스 비-file/min·max·pattern 분리 미완 | **이미 조치 (false finding)** — 커밋 98d6d7cd 에서 3줄 분리 완료. no-op |
| #5-W2 | `interaction.controller:70` Swagger description 간결(`details[]`) | **ACCEPTED (minor)** — 응답 shape 정확. 항목 내부 구조는 EIA spec §5.1 + executions.controller + §R13 표 명시. optional polish follow-up |

## 이전 사이클 조치 완료 (요약)
- **[impl-done#2 CRITICAL] 사용자 가이드** `triggers.mdx`/`.en.mdx`: `VALIDATION_FAILED`+`details.fieldErrors` → `VALIDATION_ERROR`+`error.details[{field,message,code}]` (KO/EN). ✅
- **spec 표준화**: `chat-channel-adapter.md`·`slack.md`·`7-channel-web-chat/1-widget-app.md` 구형 코드 정정. ✅
- **SoT 표**: EIA §R13 + 실행 엔진 §7.5.2 `FormValidationError` 행 추가. ✅
- **코드 정밀화**: `ErrorCode.INVALID_FIELD` enum, `ValidationDetail.code` 리터럴 narrowing, JSDoc 정렬/검증범위 명시, idempotency 주석 정정. ✅
- **검증 범위 정밀화**: form §6.2/EIA §5.1/WS §4.2 + plan 을 실제 커버리지(필수·type·minLength·maxLength·select)로 정정, min/max/pattern·file 은 Planned. ✅

## DEFERRED-BACKLOG (별도 plan/PR — 본 PR 범위 외)
1. **레이어 의존 역전** (`execution-engine` → `chat-channel/shared/form-mode`) + **SRP** (`assertFormSubmissionValid`/`coerceForm*` 추출): `src/shared/form-validation/` 등 채널 중립 레이어로 승격. (architecture W-1/W-2)
2. **DB 2-hop 조회** (`assertFormSubmissionValid`): `resolveWaitingNodeExecutionId` 결과 재사용 또는 JOIN 단일화. (performance W-11)
3. **`ValidationDetail` 통합**: `workflow-errors.ts`(execution-engine) ↔ `validation.pipe.ts`(common pipe) 동일 shape 이중 선언. `common`→`modules` 역의존 불가 → `src/common/types/` 승격 cleanup. (naming W-3)
4. **에러 코드 enum 일원화**: 기존 인라인 `'VALIDATION_ERROR'`/`'INVALID_FIELD'` 리터럴 사용처를 `ErrorCode` enum 참조로 점진 교체.

## 후속 PR 필요 (소비자 코드 적응)
- **chat-channel 어댑터 / web-chat SDK** 가 EIA 응답을 `details[]` 로 파싱하도록 적응:
  - `hooks.service.ts` Slack 재질문(`details[0].field`) — 기존 "PR-E 보강" 으로 표기된 미구현 로직.
  - `codebase/channel-web-chat/src/lib/eia-client.ts` 의 `EiaError.detail` (`fieldErrors` → `details`) 파싱.
  본 PR 은 **EIA contract surface(서버 응답 + 계약 문서)** 까지 책임. 소비자 파싱 적응은 각 채널 PR.

## 결론
Critical 0, impl-done BLOCK:NO, 잔여 WARNING 은 already-done/accepted-minor. 게이트 통과 — push 진행.
