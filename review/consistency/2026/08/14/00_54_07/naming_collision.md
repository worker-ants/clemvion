# 신규 식별자 충돌 검토

## 사전 확인 — target 스코프 실측 (중요)

프롬프트가 지목한 target `spec/5-system/`(1-auth.md·3-error-handling.md 등)은 **HEAD 워킹트리에서
`origin/main` 대비 diff 가 0 이다**:

```
git diff origin/main...HEAD --stat -- spec/          →  (출력 없음)
git diff origin/main...HEAD --stat -- spec/5-system/ →  (출력 없음)
```

즉 프롬프트에 번들된 `1-auth.md`(WebAuthn·초대 토큰·세션 등) 본문은 이 PR 이 새로 도입한
내용이 아니라 기존에 이미 존재하던 spec 본문이며, 이 PR 은 spec 을 전혀 건드리지 않는다.
실제 diff 는 `codebase/` 에만 있다 (branch `claude/raw-query-audit-followups`,
`git diff origin/main...HEAD --stat -- codebase/` 로 확인):

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` (수정 — `AuthOAuthStateRow` 인터페이스 신규)
- `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` (수정)
- `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (수정 — 신규 식별자 없음, 기존 헬퍼 사용)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (수정 — 신규 식별자 없음, 기존 헬퍼 사용)
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (주석·기대값 갱신만)

내용은 `UPDATE ... RETURNING` / `DELETE ... RETURNING` 이 TypeORM+pg 에서 `[rows, rowCount]`
튜플을 반환한다는 실측을 바탕으로, 이를 직접 `.length`/`[0]`/`.map` 하던 지점들을 새 헬퍼로
교체하는 버그 픽스다. 신규 요구사항 ID·API endpoint·webhook/queue/SSE 이벤트명·ENV
var·spec 파일 경로는 이 PR 에 전혀 등장하지 않는다 — 아래는 실제로 도입된 두 코드 식별자만
대상으로 한 충돌 점검이다.

## 발견사항

없음 (충돌 없음). 점검한 항목:

- **`updateReturningRows` (함수, `common/utils/update-returning-rows.ts`)** — 저장소 전역에서
  이 이름의 다른 정의는 없다(`git grep updateReturningRows` 결과 정의 1곳 + import 3곳
  (`auth-oauth.service.ts`·`execution-engine.service.ts`·`knowledge-base.service.ts`)뿐). 자매
  헬퍼 `assertRowArray`(SELECT 전용)와 역할이 문서화된 대로 분리되어 있고 이름도 겹치지 않는다.
- **`AuthOAuthStateRow` (interface, `modules/auth/auth-oauth.service.ts` 로컬)** — 기존
  TypeORM 엔티티 `AuthOAuthState`(`modules/auth/entities/auth-oauth-state.entity.ts`)와 이름이
  유사하지만 동일 식별자가 아니며, 의미 충돌도 아니다: `AuthOAuthState` 는 엔티티(camelCase 매핑),
  `AuthOAuthStateRow` 는 raw SQL 행 shape(snake_case)이고 그 차이가 파일 내 docstring 에 명시돼
  있다. `XRow` 접미사로 raw DB row 타입을 명명하는 패턴은 이 저장소에 기존 선례가 있다
  (`execution-engine.service.ts` 의 `WaitingNodeRow`, `rag-search.service.ts` 의 `KbRow`/
  `RawSearchRow`, `scripts/generate-golden-set.ts` 의 `ChunkRow`) — 기존 컨벤션을 따른 명명이라
  혼동 소지가 낮다 (WARNING 아닌 INFO 수준으로 하향).
- **에러 코드 `OAUTH_STATE_MISMATCH`** — 이 PR 이 새로 발행하는 코드가 아니라 기존에
  `spec/2-navigation/4-integration.md`·`spec/conventions/error-codes.md`·
  `spec/data-flow/2-auth.md` 에 이미 등재된 코드를 그대로 재사용한다 (로직 버그만 수정, 응답
  계약은 불변).
- **`E2E_BASE_URL` (신규 e2e 스펙의 env 참조)** — 신규 ENV var 가 아니라 저장소의 모든
  `*.e2e-spec.ts` 가 공유하는 기존 관용구(`process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011'`)
  를 그대로 복제했다.
- **파일 경로** `common/utils/update-returning-rows.ts` — sibling `assert-row-array.ts` 와 동일한
  kebab-case 관용구를 따르며 기존 파일과 겹치지 않는다.

## 요약

프롬프트가 지목한 target(`spec/5-system/`)은 이 PR(`origin/main` 대비 HEAD)에서 실제로는 전혀
변경되지 않았다 — spec 파일 diff 는 0줄이다. 실제 변경은 `codebase/` 의 `UPDATE/DELETE
RETURNING` 튜플 처리 버그 픽스(`updateReturningRows` 헬퍼 신설 + auth-oauth/execution-engine/
knowledge-base 3개 소비 지점 교체)뿐이며, 여기서 새로 도입된 식별자는 함수 `updateReturningRows`
와 로컬 인터페이스 `AuthOAuthStateRow` 두 개뿐이다. 둘 다 저장소 전역에서 유일하고, 유사 명명
(`AuthOAuthState` 엔티티)과의 관계도 기존 `XRow` 컨벤션을 따라 문서화돼 있어 실질적 충돌이나
혼동 위험이 없다. 요구사항 ID·API endpoint·이벤트명·ENV var·spec 파일 경로 축에서는 애초에
신규 도입이 없다.

## 위험도

NONE
