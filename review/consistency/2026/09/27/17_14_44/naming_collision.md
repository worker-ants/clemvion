# 신규 식별자 충돌 검토 — patch-null-validation (--impl-prep, scope=spec/2-navigation/)

## 조사 범위

- Target: `spec/2-navigation/` (번들 — `2-trigger-list.md` · `1-workflow-list.md` · `3-schedule.md` 본문 전문, 나머지 15개 파일은 예산 초과로 절단)
- 실제 diff: `git status` 기준 신규 파일 2개뿐 — `codebase/backend/src/common/utils/optional-non-null.ts`, `optional-non-null.spec.ts` (구현 미착수, `plan/in-progress/patch-null-validation.md` 는 `spec_impact: none`)
- 이 plan 이 도입하는 새 식별자 후보: 데코레이터 함수명 `IsOptionalNonNull`, 파일 경로 `src/common/utils/optional-non-null.ts`. 나머지는 21개 기존 PATCH 라우트의 기존 필드에서 `@IsOptional()` → `@IsOptionalNonNull()` 데코레이터 **교체**이며, 신규 엔티티·DTO·endpoint·이벤트·ENV·에러 코드는 도입하지 않는다.

## 발견사항

관점별 검토 결과, 도입되는 새 식별자가 기존 사용처와 충돌하는 사례를 발견하지 못했다.

- **엔티티/타입명 충돌 없음** — `IsOptionalNonNull` 은 `grep -rn "IsOptionalNonNull"` 결과 신규 파일(`optional-non-null.ts`/`.spec.ts`)과 plan 문서 자신에서만 나타나며, `class-validator` 표준 데코레이터명과도 겹치지 않는다. 유사 토큰 `NonNullable`(TS 유틸리티 타입, `triggers.service.ts:1266` 등)은 다른 문법 위치(타입 vs 데코레이터)라 혼동 가능성이 낮다.
- **파일 경로 충돌 없음** — `codebase/backend/src/common/utils/optional-non-null.ts` 는 동일 디렉터리에 기존 파일과 이름이 겹치지 않는다. 해당 디렉터리는 `*.util.ts` 접미사 파일과 접미사 없는 파일이 이미 혼재해 있어(`omit-undefined.ts`, `timezone.ts` 등 접미사 없음 vs `crypto.util.ts` 등) 접미사 없는 새 파일명이 기존 컨벤션을 새로 깨는 것은 아니다(기존에도 양쪽 패턴이 공존).
- **환경변수·설정키 충돌 없음** — 이 plan 은 ENV/config key 를 신설하지 않는다.
- **API endpoint 충돌 없음** — plan 이 다루는 21개 PATCH 라우트는 전부 기존에 이미 선언된 endpoint(`PATCH /api/triggers/:id`, `/api/workflows/:id`, `/api/folders/:id`, `/api/schedules/:id`, `/api/auth-configs/:id` 등, `spec/2-navigation/2-trigger-list.md §3`·`1-workflow-list.md §3`·`3-schedule.md §4` 에 이미 문서화)이며, 새 endpoint 를 추가하지 않는다.
- **이벤트/메시지명 충돌 없음** — webhook·queue·sse 이벤트를 신설하지 않는다.
- **요구사항 ID 충돌 없음** — 새 요구사항 ID 를 부여하지 않는다 (`spec_impact: none`).
- **에러 코드 재사용, 신규 코드 아님** — null 거부 시 반환하는 `400 VALIDATION_ERROR` 는 `spec/conventions/error-codes.md` 가 이미 "시스템 전역 공용 코드"로 정의한 기존 코드를 그대로 재사용한다. 새 `details.code`/`details.field` 값을 신설하지 않으므로(class-validator 표준 파이프 경로) 기존 도메인별 에러 코드와 충돌 여지가 없다.

## 요약

이번 target(`spec/2-navigation/` 번들 + `plan/in-progress/patch-null-validation.md` + 실제 diff)이 도입하는 새 식별자는 데코레이터 `IsOptionalNonNull` 과 그 파일 경로 하나뿐이며, 나머지는 21개 기존 PATCH 라우트의 기존 필드 검증기를 교체하는 작업이라 신규 엔티티·endpoint·이벤트·ENV·에러 코드를 만들지 않는다. grep 전수 확인 결과 `IsOptionalNonNull` 은 코드베이스·spec·plan 어디에도 다른 의미로 선점되어 있지 않았고, 파일 경로도 기존 디렉터리 명명 관례(접미사 유/무 혼재)를 벗어나지 않는다. 신규 식별자 충돌 관점에서는 차단 사유가 없다.

## 위험도

NONE
