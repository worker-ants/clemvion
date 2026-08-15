# 변경 범위(Scope) 리뷰 — eia-db-wire-invariant (① finalizeCancelledExecution / ② retry-turn RETURNING / ③ REST durationMs)

## 조사 방법

프롬프트의 diff 게이트 + 6개 파일(대용량으로 truncate 된 `.ts` 5개, `CHANGELOG.md` 1개)은
`git log --oneline -5` + `git diff --stat HEAD~1 HEAD` 로 실제 커밋(692dfa00e)과 대조해
20개 파일·867(+)/16(-) 전량이 프롬프트에 반영됐음을 확인했다. plan 문서
(`plan/in-progress/eia-db-wire-invariant.md`)의 "범위 밖 (등재됨)" 절과 체크리스트를 기준선으로
각 파일 diff 가 ①②③ 중 어디에 속하는지 대조했다.

## 발견사항

- **[INFO]** retry-turn `.returning()` 되읽기가 `duration_ms` 뿐 아니라 `finished_at` 도 함께 되쓴다 — item②의 표제("DB≠emit **durationMs**")보다 한 컬럼 넓다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:667-677` (`if (persistedFinishedAt instanceof Date) { execution.finishedAt = persistedFinishedAt; } ...`)
  - 상세: plan 항목②는 표제상 `durationMs` DB≠emit 불일치를 겨냥하지만, 실제 `.returning(['duration_ms', 'finished_at'])` 되읽기는 `finishedAt` 도 in-memory 에 되쓴다. 인접 주석("finishedAt 도 같은 COALESCE 대상이다 — 반쪽만 되쓰면 in-memory 가 두 시각을 섞어 갖는다")이 근거를 명시하고, 기존 코드도 이미 `COALESCE` UPDATE 에 `newFinishedAt` 파라미터를 넣고 있었으므로 신규 값이 아니라 **기존에 이미 COALESCE 대상이던 컬럼을 완전하게 되읽는 것**뿐이다 — 새 기능 추가가 아니라 부분 되쓰기로 인한 새 불일치(half-written state)를 막는 방어적 완결성에 가깝다. plan 체크리스트 문구("영속값을 되읽기")도 `duration_ms` 로 한정하지 않는다. 다만 이 `finishedAt` 되쓰기 자체를 단언하는 회귀 테스트는 diff 에 보이지 않는다(diff 는 `durationMs` 값만 단언).
  - 제안: 스코프 위반으로 보지 않는다(조치 불요). 다만 커버리지 리뷰어가 `finishedAt` 되쓰기 회귀 테스트 부재를 별도로 짚을 만하다 — 스코프 리뷰의 관할은 아니라 참고만 남긴다.

- **[INFO]** `review/consistency/2026/08/15/13_43_10/**` 6개 파일이 이 코드 PR 커밋에 함께 포함됨
  - 위치: `review/consistency/2026/08/15/13_43_10/{SUMMARY.md,_retry_state.json,convention_compliance.md,cross_spec.md,meta.json,naming_collision.md,plan_coherence.md,rationale_continuity.md}`
  - 상세: CLAUDE.md 의 skill 쓰기권한 표는 `review/consistency/**` 를 consistency-checker 소관으로 명시하고 developer 는 `review/**/RESOLUTION.md` 만 명시한다. 그러나 plan 문서 체크리스트에 `--impl-prep BLOCK: NO (13_43_10)` 를 착수 증빙으로 요구하고 있고, 이 저장소의 표준 워크플로(`developer` 는 구현 착수 직전 `consistency-check --impl-prep` 의무, 그 산출물은 `review/consistency/**`)상 정상적으로 생성된 게이트 산출물이다. 코드 변경과 무관한 편집이 아니라 이 PR 착수를 승인한 근거 문서이므로 스코프 위반으로 보지 않는다.
  - 제안: 조치 불요.

## 확인했으나 문제 없음 (스코프 정합 — 참고용)

- 8개 코드/테스트 파일(`execution-engine.service.ts/.spec.ts`, `retry-turn.service.ts/.spec.ts`, `execution-status-response.dto.ts`, `interaction.service.ts/.spec.ts`, `CHANGELOG.md`)의 모든 hunk 가 plan 의 ①②③ 중 정확히 하나에 대응한다 — 임포트 추가(`toFiniteNumber`)도 ②구현에 직접 필요한 것 하나뿐, drive-by 정리 없음.
- `retry-turn.service.spec.ts` 의 `setParameter`/`returning` mock 확장이 새 테스트 하나에 그치지 않고 파일 전역 기본 mock(73-88행)·다른 describe 블록(1250-1255, 1355-1361행)까지 퍼져 있으나, 이는 프로덕션 코드가 같은 query builder 체인에 `.returning()` 호출을 추가했기 때문에 **불완전한 mock 이 다른 무관한 테스트를 조용히 vacuous 하게 만드는 것을 막기 위한 방어**(주석이 `#1171` 선례를 명시 인용)다 — 리팩토링이 아니라 이번 프로덕션 변경의 직접적 파급.
- `spec/5-system/14-external-interaction-api.md`·`spec/conventions/node-cancellation.md` 의 spec 편집은 각각 §5.3 REST 필드(③)·§6.5 캐비엇 해소(②)·§2.4 매트릭스+Rationale 정정(①)에 정확히 대응하며, 저장소 관행(취소선+해소노트 보존)을 그대로 따른다 — 원문 삭제 없음.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 갱신은 자매 트래커 동시 갱신 요구사항(plan 체크리스트, consistency WARNING #3 대응)에 정확히 대응하며 문구도 "실측 후 정정 + 날짜" 관행을 따른다.
- plan 문서(`eia-db-wire-invariant.md`) 자체가 "범위 밖 (등재됨)" 절에서 `finalizeStalledExhausted` 트랜잭션·관용구 헬퍼 추출·종결 emit 타입 파사드·프런트엔드 Duration 컬럼을 명시적으로 제외해 뒀고, 실제 diff 에도 이 네 가지 중 어떤 것도 나타나지 않는다 — 스코프 규율이 스스로 검증됨.
- 포맷팅·주석 전용 변경, 사용하지 않는 임포트, 설정 파일 변경은 20개 파일 전체에서 발견되지 않았다.

## 요약

20개 파일·867(+)/16(-) 전량이 plan `eia-db-wire-invariant.md` 의 ①(finalizeCancelledExecution guarded UPDATE 결과 미확인)·②(retry-turn CANCELLED 재진입 RETURNING)·③(REST durationMs 추가) 세 항목과 그 스펙/트래커 미러, 그리고 착수 전 의무 게이트 산출물(consistency-check impl-prep)로 정확히 설명된다. 요청 외 리팩토링·기능 확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 주석/임포트 변경은 발견되지 않았다. 유일하게 주목할 지점은 retry-turn 되읽기가 plan 표제(`durationMs`)보다 한 컬럼(`finishedAt`) 넓게 되쓴다는 점인데, 이는 기존에 이미 COALESCE 대상이던 컬럼의 완전한 되읽기이며 인접 주석이 근거를 명시해 스코프 위반이 아니라 INFO 로 남긴다.

## 위험도

NONE
