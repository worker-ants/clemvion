# Rationale 연속성 검토 결과

## 검토 범위 확인

`_prompts/rationale_continuity.md` 에 담긴 target 은 `spec/5-system/` 번들(전 파일 실 diff 없음 — `git diff origin/main -- spec/` 결과 0)과, 컨텍스트 예산 초과로 프롬프트에서 생략된 `<git diff origin/main...HEAD -- code_areas>` (38,198자) 다. 생략된 diff 를 직접 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`, 현재 branch `claude/raw-query-audit-followups`)에서 `git diff origin/main` 으로 재확인했다. 변경 파일 10개:

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (신규)
- `codebase/backend/src/common/utils/assert-row-array.spec.ts` (자매 가드 수 갱신)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` + `.spec.ts`
- `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (신규 e2e)

내용: TypeORM 0.3.31 + pg 가 `UPDATE`/`DELETE ... RETURNING` 을 `[rows, rowCount]` 튜플로 반환하는데(반면 `SELECT`/`INSERT` 는 행 배열), 기존 코드가 이를 행 배열로 오인해 `.length` 판정이 사실상 상시 참/거짓으로 고정되어 있던 버그를 고치는 PR. 신규 헬퍼 `updateReturningRows()` 로 3개 모듈(admission gate·OAuth state 소비·KB CAS 락)의 소비 지점을 통일했다.

## 발견사항

없음 (CRITICAL/WARNING 대상 없음).

- **[INFO]** admission gate·OAuth state·KB CAS 락 버그 수정은 spec Rationale 을 오히려 **강화**함
  - target 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (admission 트랜잭션 블록, `updateExecutionStatus`), `codebase/backend/src/modules/auth/auth-oauth.service.ts` (`handleCallback` state 소비), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (`reExtractAll`/`reEmbedAll`/재큐 3곳)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "동시성 cap admission gate — consumer-side + cancelled(timeout) (PR2b, 2026-07-04)" (per-workspace advisory lock + 조건부 UPDATE RETURNING 으로 카운트→비교→전이); `spec/data-flow/2-auth.md` §Rationale "OAuth state 의 one-shot DELETE" (단일 원자 `DELETE ... RETURNING` 으로 동시 callback 중 정확히 한 요청만 state 획득); KB CAS 락은 `reextract_status`/`reembed_status` 조건부 UPDATE 관용구(§본문, `idle→in_progress`)
  - 상세: 이 diff 는 위 세 Rationale 이 선언한 **설계**(advisory lock + 조건부 UPDATE, one-shot DELETE, CAS 락)를 바꾸지 않는다. 바뀐 것은 그 UPDATE/DELETE 결과의 **파싱**뿐이다 — 드라이버가 튜플을 돌려주는데 코드가 행 배열로 읽어 `rows.length===1`/`consumed.length===0`/`acquired.length===0` 같은 판정이 사실상 상수였다(4개월간 admission cap 거절 분기·OAuth 정상 콜백·KB 동시 재추출 거절이 전부 사문화). 즉 spec 이 이미 올바르게 서술한 invariant 를 구현이 실제로는 지키지 못하고 있던 상태를 코드가 이제 정합시킨 것 — Rationale 의 "대안 재도입"·"원칙 위반"·"무근거 번복" 어디에도 해당하지 않는다. spec 본문 자체는 이번 PR 에서 변경되지 않았다(`git diff origin/main -- spec/` 결과 없음).
  - 제안: 조치 불요(정보성). 다만 이 저장소의 다른 Rationale 항목들(예: `4-execution-engine.md`의 "orphan pending backstop", `10-parallel.md`의 "waitAll=false" 항목)은 유사한 "코드가 spec 의도를 배신했던 과거"를 §Rationale 각주로 남기는 관례가 있다. 원한다면 후속 spec PR 에서 "동시성 cap admission gate" 항목 말미에 "TypeORM 0.3.31+pg 의 UPDATE/DELETE RETURNING 튜플 shape 로 인해 2026-04~08 사이 cap 거절 분기가 사문화됐었다(픽스: `update-returning-rows.ts`)" 한 줄을 덧붙이는 것을 고려할 수 있으나, 이는 회귀 방지용 역사 기록이지 필수 Rationale 갱신은 아니다(설계 결정 자체가 바뀌지 않았으므로).

## 요약

이번 diff 는 spec 문서를 전혀 변경하지 않았고(`spec/5-system/` 대상 실 diff 0), 코드 변경도 기존 Rationale 이 선언한 세 가지 핵심 invariant(admission gate 의 advisory-lock + 조건부 UPDATE, OAuth state 의 one-shot DELETE, KB reextract/reembed 의 CAS 락)를 **뒤집지 않고 오히려 실제로 작동하게 복구**하는 버그 수정이다. 기각된 대안을 재도입하거나, 합의된 설계 원칙을 우회하거나, 근거 없이 과거 결정을 번복한 흔적은 없다. 새 헬퍼(`updateReturningRows`)의 도입 배경과 각 소비 지점의 회귀 이유는 코드 주석 자체가 상세히(사실상 Rationale 수준으로) 기록하고 있어 추적성도 충분하다.

## 위험도

NONE
