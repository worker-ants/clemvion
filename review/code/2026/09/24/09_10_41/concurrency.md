# 동시성(Concurrency) 리뷰 — `member-owner-toctou` (owner 승격 TOCTOU 수정 후속)

## 요약

이번 diff 는 `WorkspacesService.removeMember()` 의 owner 보호 가드 TOCTOU 를 닫은
직전 커밋(`7c7910504`)에 대해 같은 턴의 `/ai-review` (`review/code/2026/09/24/08_09_57`)
가 낸 WARNING 6건을 조치한 결과물(`06aa6d5e1`)과, 중복 단위 테스트를 정리한 후속
커밋(`24f7a1ddf`), 그리고 문서(CHANGELOG·plan)·리뷰 아카이브 파일들이다. 이 세션에서
직접 원본 소스(`workspaces.service.ts`, `workspaces.service.spec.ts`,
`member-remove-concurrency.e2e-spec.ts`, `test/helpers/concurrency.ts`)를 열어
현재 상태를 재검증했다.

핵심 메커니즘(원자적 `DELETE({ id, workspaceId, role: Not('owner') })` + Postgres
READ COMMITTED 의 EvalPlanQual 재평가로 `transferOwnership()` 의 `pessimistic_write`
와 충돌 시 승격된 행을 자동 제외)은 이전 두 라운드(`08_09_57`, `08_46_47`)의 concurrency
리뷰가 이미 검증했고, 이번 재확인에서도 새 락 도입 없이 올바르게 원자적임을 확인했다.

이번 diff 의 실질(동시성 관점 신규 내용)은 전 라운드 WARNING 3("제3 상태" — `affected===0`
재조회가 "존재+owner" / "부재" 두 갈래만 다뤄 "존재+owner 아님(이양 연쇄로 강등됨)" 을 404 로
오보하던 문제)의 수정이다. `still?.role === 'owner'` 판정을 `if (still)`(존재 여부만 봄)로
바꿔, "행이 남아 있으면 DELETE 평가 시점엔 owner 였다"는 함의만으로 403/404 를 가른다 —
술어가 `role` 하나뿐이므로 이 함의는 항상 성립하며, 이후 강등되더라도 "막은 것은 owner 였다"
는 사실 자체는 변하지 않는다는 논증이 맞다. 단위 테스트가 승격→403, 강등 연쇄를 봐도 403,
행 소멸→404 세 상태를 분리해 고정했고, `RESOLUTION.md` 의 뮤턴트 A/B′/B″/C 표가 각 분기를
실측(예측=실측)으로 죽였다 — 뮤테이션 근거가 신뢰할 만하다.

새로 도입된 경쟁조건·데드락·비원자성·await 누락은 발견하지 못했다.

## 발견사항

없음 — 이번 diff 범위에서 새로운 Critical/Warning 급 동시성 결함을 찾지 못했다.

- **[INFO]** (연속성 확인, 이번 diff 대상 아님) `transferOwnership()` 독스트링이 "두 멤버를
  단일 `IN` 쿼리로 동시에 락"(`workspaces.service.ts:716`)이라고 적지만 실제 구현은
  `requesterMembership`(`:745`)·`targetMembership`(`:764`) 을 **순차** `findOne(...,
  { lock: 'pessimistic_write' })` 두 번으로 잠근다. 이 불일치는 이번 diff 가 만든 것이 아니고
  두 전 라운드(`08_09_57` INFO, `08_46_47` INFO)가 이미 발견·dispositioned 했다 — 앞선
  `workspace` 행의 `pessimistic_write` 가 같은 워크스페이스에 대한 두 `transferOwnership`
  호출을 완전 직렬화하므로 A↔B 교차 이양의 데드락은 실제로 발생하지 않는다. 재-flag 아님, 존재
  확인 목적으로만 기재.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:716` (독스트링) vs
    `:745`, `:764` (구현) — 이번 diff 의 hunk 범위 밖(미변경 코드).
  - 제안: 조치 불요. 별도 트래커 항목으로 이미 존재하면 그대로 유지.

## 확인 사항 (문제 아님 — 근거 실측)

- `removeMember()` 의 원자적 조건부 `DELETE ... WHERE id=$1 AND workspace_id=$2 AND
  role != 'owner'` 는 새 락을 들이지 않고도 `transferOwnership()` 의 대상 행
  `pessimistic_write` 와 상호작용해 TOCTOU 를 닫는다 — 구현·주석·재진입 e2e
  (`member-remove-concurrency.e2e-spec.ts`, 테스트가 `SELECT ... FOR UPDATE` 로 행을 쥐고
  요청이 삭제 대기 중임을 공허성 가드로 확인한 뒤 승격 UPDATE+COMMIT)가 일치한다.
- `affected === 0` 이후 재조회는 무락이지만 데이터를 변경하지 않고 에러 코드 선택에만 쓰이므로,
  재조회와 DELETE 사이에 상태가 다시 바뀌어도 "그 시점의 유효한 직렬화 결과" 중 하나를
  반환하는 것이어서 정합성 훼손은 없다(전 라운드 database 리뷰와 일치).
  이번 diff 가 고친 것은 그 갈래를 가르는 **판별자 자체**(존재 여부 vs role 값)이지 재조회의
  락 유무가 아니다.
- 단위 테스트(`workspaces.service.spec.ts:1567-1609`)가 "DELETE 시점에 owner 로 승격" ·
  "재조회가 강등된 행을 봄" 두 케이스를 분리해 `if (still)` 분기 형태 자체를 고정한다 —
  `still?.role === 'owner'` 로 되돌리는 회귀 편집이 있으면 두 번째 테스트가 즉시 깨진다.
- `VACUITY_GUARD_MS` 를 `test/helpers/concurrency.ts` 에서 export 해 `raceUnderHeldLock` 이
  못 덮는 "요청 하나 + 락 안 mutate" 형태의 재진입 e2e(`integration-rotate-concurrency`,
  `member-remove-concurrency`) 둘이 같은 상수를 쓰게 했다 — 이 상수는 여전히
  `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS)` 검사 범위 안에
  있으므로(`concurrency.ts:36`), 락 상한이 늘어도 안전 마진이 조용히 사라지는 문제가 재발하지
  않는다.
- 신규 e2e 재진입 블록(`member-remove-concurrency.e2e-spec.ts:209-294`)은 전용 워크스페이스를
  새로 만들어 raw `UPDATE role='owner'` 로 생긴 "owner 2명"(애플리케이션 코드로 도달 불가한
  상태)이 공유 fixture 를 오염시키지 않도록 격리했고, `try/finally` 로 `ROLLBACK` +
  pending 요청 드레인을 보장해 락이 걸린 채 남거나 unhandled rejection 이 새지 않는다.
- 워크트리 오염 없음 — 이번 리뷰는 `Read`/`Bash grep`/`sed -n` 으로만 확인했고 저장소 파일을
  뮤테이션하지 않았다. `git status --short` 로 clean 확인 완료(신규 파일 쓰기 외 변경 없음).

## 위험도

LOW — 핵심 TOCTOU 수정은 원자적 조건부 DELETE + Postgres EvalPlanQual 재평가로 정확하며
재진입 e2e 로 결정적 검증됐다. 전 라운드가 지적한 제3 상태 오분류(WARNING)는 분기 형태 자체를
바꿔 해소됐고 뮤테이션 테스트로 뒷받침된다. 이번 diff 범위에서 새로 발견된 경쟁조건·데드락·
원자성 결함은 없다.
