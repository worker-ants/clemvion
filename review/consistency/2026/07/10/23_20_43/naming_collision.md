# 신규 식별자 충돌 검토 — getStatus() 컬럼 projection

- target: `git diff origin/main...HEAD` (worktree `optimize-getstatus-projection-78853c`)
- 변경 파일: `codebase/backend/src/modules/external-interaction/interaction.service.ts`,
  `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts`,
  `plan/in-progress/eia-getstatus-column-projection.md`,
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (1줄 stale 인용 정정)

## 발견사항

없음. 아래는 검토 질문별 확인 근거.

### 1. `STATUS_PROJECTION_COLUMNS` — backend 전역 충돌 여부

```
grep -rn "STATUS_PROJECTION_COLUMNS" codebase/backend/src
→ interaction.service.ts:66 (선언), :272 (사용) 뿐 — 유일 정의.

grep -rn "PROJECTION\|_COLUMNS" codebase/backend/src
→ interaction.service.ts 의 STATUS_PROJECTION_COLUMNS 2건
→ catalog-sync.spec.ts 의 MIN_CATALOG_COLUMNS (cafe24 메타데이터 CSV 파싱, 완전 무관 도메인·이름도 다름)
→ interaction.service.spec.ts 의 BASE_COLUMNS (아래 3번 참조, 같은 PR 내 테스트 헬퍼)
```

module-level 비-export `const` 로 선언되어(`export` 키워드 없음) 파일 스코프에 갇힌다. 동일 파일 내
다른 3개 호출부(`interact`:175, `refreshToken`:228, `loadAndAssertAlive`:399)는 각자 인라인
`select: ['id','status']` 를 쓰고 이 상수를 참조하지 않아 재사용 충돌도 없다. 유사 목적의 기존
공용 projection 상수(`*_COLUMNS`, `*_PROJECTION` 패턴)는 backend 전체에 없음 — 이 PR 이 이런
네이밍 패턴을 처음 도입하지만, scope 가 파일-local 이라 향후 동명 전역 상수가 생기더라도 충돌
가능성은 없다(별도 모듈 namespace).

판정: 충돌 없음.

### 2. 테스트 파일 내 `THREAD` / `DURABLE_THREAD` / `BASE_COLUMNS` scoping

파일의 top-level `describe` 블록 구조 확인:

```
459: describe('InteractionService.getStatus', () => { ... })       ← DURABLE_THREAD 선언(545행)
753: describe('InteractionService.getStatus — 컬럼 projection (2단계 조회)', () => { ... })  ← THREAD(773)/BASE_COLUMNS(760) 선언
```

두 `describe` 는 **형제(sibling) 최상위 블록**이며 서로 중첩되지 않는다(하나가 `});` 로 닫힌 뒤
다음 `describe(` 가 시작). `const` 는 각 `describe` 콜백 함수의 렉시컬 스코프에 갇히므로:

- `DURABLE_THREAD` (459-describe 전용) 와 `THREAD` (753-describe 전용) 는 이름이 달라 애초에
  충돌하지 않고, 설령 이름이 같았어도 서로 다른 함수 스코프라 shadowing 문제가 없다.
- `BASE_COLUMNS` 는 753-describe 안에서만 선언되며 파일 내 다른 곳에 동명 식별자 없음.

Jest 는 collection phase 에서 모든 `describe` 콜백을 동기 실행하지만, 각 콜백은 독립 클로저이므로
런타임 변수 충돌은 발생하지 않는다. 실제로 `pnpm test` 대상 spec 41/41 green (plan 체크리스트 §7)
이 이를 방증.

판정: 충돌/shadowing 없음.

### 3. `selectOf` / `whereOf` — 파일 내 기존 헬퍼와 충돌 여부

```
grep -n "selectOf\|whereOf" codebase/backend/src/modules/external-interaction/interaction.service.spec.ts
→ 둘 다 753-describe 블록 내부(755행, 769행)에서만 선언·사용. 그 외 위치(파일 전역, 459-describe 등)
  에 동명 함수/변수 없음.
```

기존 459-describe 블록은 `execution.conversationThread` 를 직접 목객체 프로퍼티로 다루며 별도
select/where 추출 헬퍼를 두지 않았다(코드 리뷰 코멘트에 "1단계/2단계 구분 못 함" 명시 — 의도적
분리). 신규 헬퍼 2개는 새 describe 스코프 전용이라 기존 코드와 겹치지 않는다.

판정: 충돌 없음.

### 4. 신규 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수

diff 전체(`git diff origin/main...HEAD`)를 재확인:

- 신규 `export class`/`export interface`/`export type` 없음 (grep 결과 0건).
- 신규 `@Get/@Post/@Put/@Patch/@Delete` 데코레이터 없음 — endpoint 추가/변경 없음
  (`getStatus()` 는 기존 `GET /api/external/executions/:id` 핸들러의 내부 조회 로직만 변경).
- `process.env.*` 신규 참조 없음 — 환경변수 도입 없음.
- webhook/queue/SSE 이벤트명 추가 없음. `redactThreadForPublic` 재사용(신규 아님), SSE
  `waiting_for_input` wire shape 도 그대로(코드 주석 "wire 형식 무변경" 명시, plan 문서도 동일 결론).
- 요구사항 ID: 코드/plan 모두 기존 `EIA §5.3`, `§R17`(2026-07-09 기 도입, 이번 PR 은 재참조만),
  `§4`(storage cap) 를 인용할 뿐 새 `§`/`R`번호를 신설하지 않음.
- `spec-sync-external-interaction-api-gaps.md` 변경분(1줄)은 stale 코드 라인 인용(`interaction.service.ts:247-296`)
  갱신뿐 — 신규 식별자 없음.

판정: 신규 요구사항 ID·엔티티·endpoint·이벤트·환경변수 도입 없음 확인.

### 5. plan 파일명 충돌

```
find . -name "eia-getstatus-column-projection.md" -not -path "*/node_modules/*"
→ ./plan/in-progress/eia-getstatus-column-projection.md (단일)

ls plan/in-progress | grep -i "getstatus\|projection\|eia-"
→ eia-getstatus-column-projection.md 뿐

ls plan/complete 2>/dev/null | grep -i "getstatus\|projection"
→ (없음)
```

`plan/in-progress/` 와 `plan/complete/` 어디에도 동명·유사명 파일 없음. 명명 컨벤션(`<영역>-<주제>-<서술>.md`,
kebab-case)도 기존 `spec-sync-external-interaction-api-gaps.md` 등과 일관.

판정: 충돌 없음.

## 요약

이번 변경은 `InteractionService.getStatus()` 의 DB 조회를 2단계 projection 으로 최적화하는
순수 내부 리팩터로, 도입된 신규 식별자(`STATUS_PROJECTION_COLUMNS` 모듈 상수, 테스트 지역
헬퍼 `selectOf`/`whereOf`, 테스트 지역 상수 `BASE_COLUMNS`/`THREAD`, plan 파일 1개)가 모두
파일-local 또는 describe-local 스코프에 갇혀 있어 backend 전역 어디와도 이름이 겹치지 않는다.
동일 파일 내 두 개의 최상위 `describe` 블록(`DURABLE_THREAD` vs `THREAD`)도 형제 스코프라
shadowing 이 발생하지 않으며, 41/41 테스트 green 이 이를 실증한다. 요구사항 ID·엔티티·API
endpoint·이벤트명·환경변수 신규 도입이 전혀 없고(모두 기존 §5.3/§R17 재참조), plan 파일명도
기존 컨벤션과 충돌 없이 유일하다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE

STATUS: OK
