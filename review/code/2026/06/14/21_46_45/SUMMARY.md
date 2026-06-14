# Code Review 통합 보고서 (review #5 — final)

## 전체 위험도
**MEDIUM** — Critical 0. WARNING 2건(모두 minor: 1건은 이미 조치 완료된 false finding, 1건은 Swagger description 상세도). 이전 사이클의 CRITICAL(사용자 문서 VALIDATION_FAILED)·다수 WARNING 은 INFO 로 해소 확인됨. router 가 documentation·requirement 2명만 선별(diff 가 문서/spec 위주).

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 판정 |
|---|----------|----------|------|------|
| 1 | 요구사항/plan | `spec-sync-form-gaps.md` 체크박스가 "비-file 완료"/"min·max·pattern Planned" 분리 안 됨 | plan §4/§6.2 | **이미 조치(false finding)** — 커밋 98d6d7cd 에서 `[x] field-level(필수/type/minLength·maxLength/select)` + `[ ] min/max/pattern` + `[ ] file` 3줄로 분리 완료 |
| 2 | 문서화/Swagger | `interaction.controller.ts:70` `@ApiBadRequestResponse` description 이 `details[]` 만 표기, `executions.controller` 의 `details[{field,message,code:INVALID_FIELD}]` 보다 간결 | `interaction.controller.ts:70` | **ACCEPTED(minor)** — 응답 shape 자체는 정확(VALIDATION_ERROR + details[]). 항목 내부 구조는 EIA spec §5.1 + executions.controller Swagger + 본 PR 의 §R13 표에 명시. 본 endpoint 의 다른 ApiResponse 와 동일한 간결도 유지. optional polish 로 follow-up |

## 참고 (INFO) — 이전 사이클 조치 확인

- 사용자 문서 `triggers.mdx`/`.en.mdx`: `VALIDATION_ERROR` + `error.details[{field,message,code}]` 갱신 완료 (이전 CRITICAL 해소).
- spec 4파일(chat-channel-adapter §4.1·§4.2, slack:116, widget-app:44): `VALIDATION_FAILED` → `VALIDATION_ERROR` 정정 완료.
- SoT 표: EIA §R13 + 실행 엔진 §7.5.2 에 `FormValidationError` 행 추가 완료.
- `ValidationDetail.code`: `'INVALID_FIELD'` 리터럴 narrowing 완료. `idempotency.interceptor` 주석 3건 정정 완료.
- 검증 범위(필수·type(email/number)·minLength/maxLength·select/radio) plan 명시 범위와 정합. min/max/pattern·file 은 Planned 추적.

## 권장 조치사항 (모두 deferred/accepted — RESOLUTION.md 참조)

1. W-1 — 이미 조치 (no-op).
2. W-2 — ACCEPTED minor (optional follow-up).
3. INFO-5/6/7 (WS §4.2 details 미포함 부연, form Rationale 섹션, cross-import Rationale) — project-planner 후속(spec 완성 시점).

## 라우터 결정
실행: `requirement`, `documentation` (router_safety 강제). 제외 12명 (diff 가 문서/spec/review 산출물 위주 — source 코드 변경 최소).
