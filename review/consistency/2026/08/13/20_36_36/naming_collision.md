# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

diff(`origin/main...HEAD`)는 아래 5개 파일뿐이며 전부 `codebase/backend/**` 코드다 — `spec/**` `.md` 변경은 0건.

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (기존 호출부 수정)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (테스트 추가)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (기존 호출부 수정)

대응 plan `plan/in-progress/update-returning-tuple-shape.md` 의 frontmatter 는 `spec_impact: none` 으로 명시돼 있고, 실측(TypeORM UPDATE/DELETE 가 `[rows, rowCount]` 튜플을 돌려주는 shape 버그) 도 spec 요구사항이 아니라 기존 spec 이 이미 전제한 동작(CAS 락 거절, admission 판정, 종결 이벤트 emit)을 올바르게 구현하도록 고치는 순수 내부 버그 수정이다. 따라서 본 diff 가 새로 도입하는 "식별자" 는 다음 두 가지뿐이다.

1. 함수명 `updateReturningRows`
2. 파일 경로 `common/utils/update-returning-rows.ts` / `.spec.ts`

요구사항 ID, 엔티티/DTO/인터페이스명, API endpoint, webhook/queue/sse 이벤트명, 환경변수·설정키, spec 파일 경로 — 이 6개 범주 중 실제로 새로 생긴 것은 없다(diff 에 spec 파일도, 신규 ENV var 도, 신규 endpoint 도, 신규 이벤트명도 없음). `KB_REEXTRACT_IN_PROGRESS` / `KB_REEMBED_IN_PROGRESS` 에러 코드나 `EXECUTION_ADMISSION_RETRY_DELAY_MS` 는 diff 이전부터 존재하던 식별자로, 이번 변경은 그 판정 조건만 고쳤을 뿐 새로 만든 것이 아니다(주석에서 언급될 뿐 `+` 라인으로 신규 도입되지 않음).

## 충돌 점검

### 1. `updateReturningRows` 함수명

- repo 전역 grep(`updateReturningRows`) 결과: 정의 1곳(`update-returning-rows.ts`) + 호출부(`execution-engine.service.ts` 2곳, `knowledge-base.service.ts` 5곳) + plan 문서 1곳뿐. 동일 이름의 기존 함수/타입/변수 없음.
- 자매 헬퍼 `assertRowArray`(`common/utils/assert-row-array.ts`)와 이름·역할이 명확히 구분된다 — `assertRowArray` 는 "배열인가" 를 assert, `updateReturningRows` 는 "튜플이면 첫 원소를 꺼낸다" 를 수행. 의미 중복이나 혼동 유발 없음.

### 2. 파일 경로 `common/utils/update-returning-rows.ts`

- `ls codebase/backend/src/common/utils/` 결과 동일 경로의 기존 파일 없음(신규 파일).
- 명명 컨벤션: 해당 디렉터리는 kebab-case 파일명이 다수(`assert-row-array.ts`, `process-in-batches.ts`, `with-timeout.ts`, `smtp-host-guard.ts` 등)이고 일부만 `.util.ts` 접미사(`crypto.util.ts`, `password.util.ts` 등)를 쓴다. 신규 파일은 접미사 없는 다수 패턴을 따라 컨벤션을 깨지 않는다.

### 3. 참조된 기존 ID 재확인 (신규 아님, cross-check 용)

- `RR-PL-05`(plan 본문에서 "이미 문서화된 제한" 으로 언급) → `spec/5-system/13-replay-rerun.md:110` 에 실제로 정의돼 있고 의미도 일치(재시도 chain 추적 모델). 새로 부여된 ID 아니며 충돌 없음.

## 발견사항

없음 — 본 diff 가 새로 도입하는 식별자(`updateReturningRows` 함수, `update-returning-rows.ts`/`.spec.ts` 파일 경로)는 repo 전역에서 유일하며, 기존 명명 컨벤션과도 충돌하지 않는다. spec 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·spec 파일 경로 범주에서는 애초에 신규 도입이 없다(순수 backend 내부 버그 수정, `spec_impact: none`).

## 요약

이번 변경은 TypeORM UPDATE/DELETE 가 `[rows, rowCount]` 튜플을 반환하는 실제 shape 을 다루기 위한 순수 내부 버그 수정으로, spec 문서 변경이 전혀 없고 신규로 도입되는 식별자는 `updateReturningRows` 함수와 그 파일 경로 두 가지뿐이다. 두 식별자 모두 repo 전역에서 유일하고 기존 명명 컨벤션(kebab-case 유틸 파일, camelCase 함수)과 자매 헬퍼 `assertRowArray` 와도 의미·이름이 명확히 구분되어 충돌이나 혼동 소지가 없다.

## 위험도

NONE
