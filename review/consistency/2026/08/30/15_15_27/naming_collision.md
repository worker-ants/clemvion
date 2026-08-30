# 신규 식별자 충돌 검토 — raw-update-guard-scope (impl-done)

## 검토 범위 확인

- 검토 모드: `--impl-done`, scope=`spec/data-flow/`, diff-base=`origin/main`
- 실제 diff(`git diff origin/main...HEAD -- code_areas`)는 아래 **5개 파일**에만 존재하며 전부
  `codebase/backend/src/**` 코드다. `spec/**` 에 대한 diff 는 **0건**이다:
  - `codebase/backend/src/common/__test-utils__/source-scan.spec.ts`
  - `codebase/backend/src/common/__test-utils__/source-scan.ts`
  - `codebase/backend/src/common/utils/update-returning-rows.spec.ts`
  - `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.spec.ts`
  - `codebase/backend/src/modules/knowledge-base/graph/kb-stats.helper.ts`
- 프롬프트에 번들된 `spec/data-flow/*.md` (2-auth.md, 0-overview.md, 1-audit.md, 3-execution.md,
  9-observability.md, 11-workflow.md 등)는 모두 **변경 없는 참조 컨텍스트**다 — 위 diff 헤더 목록에
  이들 경로가 전혀 등장하지 않는 것으로 확인.

이 PR 은 raw `UPDATE/DELETE … RETURNING` 미가드 지점을 손으로 고른 목록이 아니라 `src/**` 전수에서
발견하는 테스트 하드닝(`countRawUpdateReturning` / `hasRawUpdateReturning` / `findUnguarded`)과
`kb-stats.helper.ts` 의 타입 정정(비튜플→튜플)뿐이다. **spec 문서상의 신규 요구사항 ID·엔티티/DTO명·
API endpoint·이벤트명·ENV/설정키·spec 파일 경로는 단 하나도 신설되지 않았다.**

## 점검 관점별 결과

### 1. 요구사항 ID 충돌
해당 없음 — 이 PR 은 spec 을 변경하지 않는다. 새로 부여된 요구사항 ID가 없다.

### 2. 엔티티/타입명 충돌
새로 도입된 코드 심볼:
- `countRawUpdateReturning(src: string): number` (`source-scan.ts`)
- `hasRawUpdateReturning(src: string): boolean` (`source-scan.ts`)
- `findUnguarded(...)`, `discover()`, `listSources()`, `ALLOWED`, `MIN_REASON_LENGTH`, `SRC`, `CALL`
  (전부 `update-returning-rows.spec.ts` 내부 지역 스코프, export 없음)

`git grep` 로 저장소 전체(`codebase/**`)에서 위 식별자들의 기존 정의/사용을 확인했으나 diff 가
도입한 지점 외에는 **일치하는 이름이 없다**. `updateReturningRows` (기존 함수, `update-returning-rows.ts`)
와 신규 `countRawUpdateReturning`/`hasRawUpdateReturning`/`findUnguarded` 는 이름이 서로 구별되어
혼동 여지가 낮다.

### 3. API endpoint 충돌
해당 없음 — 이 PR 은 controller/route 를 추가하지 않는다.

### 4. 이벤트/메시지명 충돌
해당 없음 — webhook/queue/SSE 이벤트를 추가하지 않는다. `spec/data-flow/0-overview.md §4` 의
BullMQ 큐 카탈로그(18개)도 diff 대상이 아니다.

### 5. 환경변수·설정키 충돌
해당 없음 — 신규 ENV var/config key 없음.

### 6. 파일 경로 충돌
해당 없음 — 신규 spec 파일이 생성되지 않았다. 변경된 5개 코드 파일 경로는 모두 기존 파일의 수정이며
새 경로가 아니다.

## 요약

이번 diff 는 `spec/data-flow/` 범위로 지정됐으나 실제로는 spec 을 전혀 건드리지 않는 순수 코드
하드닝(raw UPDATE/DELETE…RETURNING 미가드 지점 발견형 가드 + `kb-stats.helper.ts` 튜플 타입 정정)이다.
새로 도입된 함수/식별자(`countRawUpdateReturning`, `hasRawUpdateReturning`, `findUnguarded` 등)는
저장소 전수 검색 결과 기존 사용처와 이름이 겹치지 않으며, 요구사항 ID·엔티티/DTO명·API endpoint·
이벤트명·ENV/설정키·spec 파일 경로 중 어느 것도 신설되지 않아 신규 식별자 충돌 관점에서 지적할
사항이 없다.

## 위험도

NONE
