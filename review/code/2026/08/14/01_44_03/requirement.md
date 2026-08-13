# 요구사항(Requirement) 리뷰

## 리뷰 범위

`origin/main...HEAD` (16 commits, `8332d9a20`~`103dee234`). 핵심 결함: TypeORM 0.3.31 + pg 가
`UPDATE`/`DELETE ... RETURNING` 을 `[rows, rowCount]` **튜플**로 돌려주는데(SELECT/INSERT 는 행
배열), 8곳(auth-oauth 1 · execution-engine 2 · knowledge-base 5)이 이를 행 배열로 오인해 소셜
로그인 상시 실패·admission cap 미집행(우회 경로로 결과만 우연히 맞음)·KB CAS 락 미작동·재큐
`documentId` undefined 를 냈다. 공용 헬퍼 `updateReturningRows(result, detail)` 로 흡수하고
8곳 전부와 자체 회귀 테스트를 추가했다. 이미 7라운드의 ai-review/consistency 왕복을 거친
diff 이며, 본 리뷰는 그 최종 상태를 독립적으로 재검증했다.

## 독립 검증 (재실행 결과)

- `npx jest src/common/utils/{update-returning-rows,assert-row-array,__testing__/source-scan}.spec.ts` → 3 suites / 25 passed
- `npx jest src/modules/auth/auth-oauth.service.spec.ts` → 16 passed
- `npx jest src/modules/knowledge-base/knowledge-base.service.spec.ts` → 57 passed
- `npx jest src/modules/execution-engine/execution-engine.service.spec.ts` → 448 passed
- `npx tsc -p tsconfig.json --noEmit` → 199 errors, 전부 이 PR 이 손대지 않은 파일/줄(baseline ratchet 199 와 일치 — 신규 타입 에러 0)
- `npx eslint <6개 변경 소스 파일> --max-warnings 0` → 0 warning
- `grep -rn "RETURNING" src --include=*.ts` 전수 재점검: `notifications.service.ts` 의 QueryBuilder `.update().execute()` 경로는 `UpdateResult.raw` 를 쓰는 별개 메커니즘이라 이 버그 클래스와 무관(정확히 스코프 밖) — 8곳 목록에서 빠진 것이 누락이 아님을 확인. `integration-oauth.service.ts`·`agent-memory-admin.service.ts`·`stuck-document-recovery.service.ts` 는 이미 튜플/비-튜플을 올바르게 처리하고 있음을 직접 코드로 확인(문서 주장과 일치).
- `assert-row-array.spec.ts` 의 "자매 지점 전수" 가드가 `execution-engine.service.ts` 의 남은 `assertRowArray` 호출(`lockNonTerminalExecutionRow`)이 `SELECT ... FOR UPDATE` 이고, `executions.service.ts` 의 `computeChainDepth` 도 `SELECT` 임을 실제 코드로 확인 — `updateReturningRows` 로 옮기지 않은 것이 맞다(SELECT는 튜플 문제 없음).
- `spec/data-flow/2-auth.md:127-128` (`DELETE FROM auth_oauth_state WHERE state=? AND expires_at > now RETURNING *`, "row 없으면 400 OAUTH_STATE_MISMATCH", "row.provider ≠ :provider 도 거부")와 수정 후 `auth-oauth.service.ts:handleCallback` 의 line-level 대조 — 일치.

## 발견사항

- **[INFO]** `[SPEC-DRIFT]` — `spec/conventions/node-cancellation.md` 의 §2.4 표 (`retry 재진입 종결 경로 terminal 가드` 행)가 여전히 "mutation 13/13 검증" 이라고 서술한다. 이번 수정으로 그 방어(`persisted===false` 분기)가 `8332d9a20`(2026-08-13) 이전엔 한 번도 실제로 발동하지 않았다는 사실이 드러났으므로 이 각주는 낡았다.
  - 위치: `spec/conventions/node-cancellation.md:198`
  - 상세: 코드는 이제 옳다(헬퍼로 교체돼 `persisted` 가 실신호가 됨) — spec 각주만 "mock 경계 안쪽만 검증했다" 는 배경을 반영하지 못한 채 남아 있다. 이는 이 PR 이 만든 새 문제가 아니라, `retry-turn-terminal-guard.md`·`spec-update-node-cancellation-shutdown-classification.md` 두 plan 문서가 **이미 명시적으로 project-planner 위임 항목(5번째 caveat)**으로 등재해 둔 상태다 — `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-08-14 #12)" 절이 정확히 이 표 행을 caveat 대상으로 지목한다.
  - 제안: 코드는 유지, spec 반영은 이미 위임 티켓에 등재됨(추가 조치 불요) — planner 턴에서 `node-cancellation.md:198` 표 행에 "8332d9a20 이전엔 실효되지 않았다" caveat 삽입.

- **[INFO]** `auth-oauth.service.ts` 의 `AuthOAuthStateRow.mode` 필드는 선언만 되고 `handleCallback` 안에서 소비되지 않는다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (interface `AuthOAuthStateRow`, `handleCallback`)
  - 상세: `git show origin/main:...auth-oauth.service.ts` 로 대조한 결과 이 PR 이전에도 `record.mode` 는 읽힌 적이 없다 — 이번 변경이 만든 회귀가 아니라 기존부터 있던 dead field 다.
  - 제안: 조치 불요(정보성). 필요 시 별도 정리 백로그.

## 요약

핵심 결함(UPDATE/DELETE RETURNING 튜플 오인)의 수정은 8개 소비 지점 전부를 정확히 커버하며, 각 지점에
"튜플 길이 2와 실제로 갈리는" 판별 fixture(`[[], 0]` vs `[[{id}], 1]`, graph 3건 등)로 뮤테이션 방어력
있는 회귀 테스트를 붙였다. `spec/data-flow/2-auth.md` 의 OAuth state 소비 시퀀스와 line-level 로
일치하며, 잔여 `assertRowArray` 두 지점(SELECT 전용)은 헬퍼 분리 기준과 정확히 부합한다. TDD 스위트
529건 재실행 전부 GREEN, typecheck 는 기존 199-에러 baseline 과 동일(신규 에러 0), lint 0 warning으로
독립 재검증했다. CHANGELOG 는 배포 영향(관측 결과 1~5)까지 포함해 최종적으로 반영돼 있다. 유일한
잔여 항목은 `node-cancellation.md` §2.4 의 낡은 "mutation 13/13 검증" 각주인데, 이는 코드 결함이
아니라 spec 각주 갱신 누락(SPEC-DRIFT)이며 이미 별도 plan 위임 티켓에 등재돼 있어 추가 조치가
필요 없다. Critical/Warning 급 신규 발견사항 없음.

## 위험도

NONE
