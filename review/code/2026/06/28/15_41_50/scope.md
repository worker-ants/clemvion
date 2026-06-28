# 변경 범위(Scope) 리뷰

## 발견사항

### [INFO] `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` — 직접 목적과 무관한 타임아웃 수정
- 위치: `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`, `it("has no broken in-repo links...")` 타임아웃 5000ms → 30000ms
- 상세: 이번 작업 목적(인증 webhook 1MB body 게이트 + 공개 webhook 보호 우회 버그 수정)과 직접 관련이 없는 프런트엔드 테스트 파일 수정이다. 변경 자체는 "CI 병렬 실행 시 CPU 경합으로 flaky 타임아웃 발생"이라는 무관한 이유에서 비롯됐으며, 파일 내 주석도 그 이유를 명시하고 있다. 단 1줄(타임아웃 값과 이유 주석 3줄)이며 기능 동작 변경이 없어 위험도는 극히 낮다.
- 제안: 별도 커밋으로 분리하는 것이 이상적이나, 변경 규모가 4줄이고 기능 위험이 없어 현 PR 포함은 허용 범위다.

### [INFO] `GlobalExceptionFilter` — 413 단독이 아닌 4xx 전체를 http-error 경로로 처리
- 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`, `mapHttpErrorLike` 메서드 — `errStatus >= 400 && errStatus < 500` 조건
- 상세: 이번 작업의 직접 목표는 413 `PAYLOAD_TOO_LARGE` 매핑이나, 구현은 4xx 전체(400–499)를 http-error 경로로 처리한다. 현실적으로 NestJS `HttpException`이 아닌 http-errors 4xx가 이 분기에 도달하는 경우는 body-parser 413이 유일하며, 기존 NestJS HttpException 분기가 400/401/403/404 등을 먼저 처리하므로 실질적인 영향 범위 확장은 없다. 의도적으로 방어적 구현을 선택한 것으로 over-engineering이 아니다.
- 제안: 현행 유지. 향후 다른 http-errors 미들웨어가 4xx를 throw할 경우 이 경로를 타게 된다는 점을 팀이 인식하면 충분.

### [INFO] `plan/in-progress/spec-sync-webhook-gaps.md` — 체크박스 갱신 및 구현 기록
- 위치: `plan/in-progress/spec-sync-webhook-gaps.md`, `- [ ]` → `- [x]` 변경
- 상세: CLAUDE.md 규약상 구현 커밋에 plan 체크박스 갱신을 포함해야 한다. 의무 동기화 변경이며 범위 내 필수 수정이다.
- 제안: 없음.

### [INFO] `spec/` 3파일 갱신 — 구현과 직결된 "planned → implemented" 반영
- 위치: `spec/5-system/12-webhook.md`, `spec/5-system/2-api-convention.md`, `spec/5-system/3-error-handling.md`
- 상세: WH-NF-02 상태 갱신, 413 HTTP 상태코드 표 추가, `PAYLOAD_TOO_LARGE` 에러코드 등재 — 세 문서 모두 이번 구현이 직접 요구하는 spec 동기화다. SDD 규약상 의무 갱신이며 별도 기능 확장이 아니다.
- 제안: 없음.

### [INFO] `review/code/2026/06/28/15_00_36/` 하위 리뷰 산출물 — 이전 세션 RESOLUTION 포함
- 위치: `review/code/2026/06/28/15_00_36/RESOLUTION.md`, `SUMMARY.md`, 각 reviewer 파일들
- 상세: 이전 리뷰 세션(15_00_36)의 RESOLUTION과 각 reviewer 산출물이 이번 changeset에 포함되어 있다. CLAUDE.md 규약에서 `review/` 디렉터리는 gitignored가 아니며 RESOLUTION도 커밋에 포함해야 한다고 명시되어 있다. 의무 포함 항목이다.
- 제안: 없음.

## 요약

이번 변경셋 전체(38개 파일)는 "인증 webhook 1MB body 게이트(WH-NF-02 옵션 C) + 공개 webhook 보호 우회 버그 수정"이라는 단일 목적에 직결된다. 핵심 구현 파일(`hooks-body-parser.ts`, `http-exception.filter.ts`, `main.ts`, `public-webhook-throttle.guard.ts`, `hooks.controller.ts`, `hooks.service.ts`), 단위/e2e 테스트, CHANGELOG, spec 3파일, plan 파일, 이전 리뷰 RESOLUTION 산출물 — 모두 규약상 필수이거나 이번 기능과 직접 연결된 변경이다. `GlobalExceptionFilter`의 4xx 전체 처리는 목표보다 조금 넓은 구현이나 의도적·안전한 선택으로 over-engineering이 아니다. `spec-link-integrity.test.ts` 타임아웃 상향 1건만 이번 목적과 무관한 부속 수정이며 규모가 4줄로 극히 작다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅 혼입, 설정 변경, 임포트 정리 등 범위 일탈 징후는 발견되지 않았다.

## 위험도

NONE
