# 동시성(Concurrency) 리뷰 — `member-owner-toctou`

## 요약

이 변경은 `WorkspacesService.removeMember()` 의 «owner 는 제거할 수 없다» 가드가
무락 `findOne` 위에 있어 읽기와 DELETE 사이에 동시 `transferOwnership` 이 대상을
owner 로 승격시키면 owner 가 지워지던 TOCTOU 를 닫는다. 처방은 새 락을 들이지
않고 `delete({ id, workspaceId, role: Not('owner') })` 로 owner 판정을 DELETE
문장 자체의 술어로 옮기고, Postgres READ COMMITTED 의 EvalPlanQual(동시 UPDATE 에
대한 WHERE 재평가) 에 원자성을 위임한다. `transferOwnership()` 이 대상 행에
`pessimistic_write` 를 쥐므로 겹친 DELETE 는 커밋을 기다렸다가 갱신된 행 버전에
대해 조건을 재평가한다 — 이 메커니즘 자체는 코드·주석·재진입 e2e(`member-remove-
concurrency.e2e-spec.ts`, 락을 쥔 뒤 승격을 끼워 COMMIT)로 실측 검증되어 있다.

전 라운드(`review/code/2026/09/24/08_09_57`) 가 지적한 WARNING 3(재조회가 «존재+
owner 아님» 제3 상태를 다루지 않아 실재 멤버를 404 로 오보) 은 이번 diff 에서
`still?.role === 'owner'` → `if (still)` 로 분기 형태 자체를 바꿔 해소됐다. DELETE
의 술어가 `role` 하나뿐이므로 재조회 시점에 행이 남아 있다는 것 자체가 «DELETE
평가 시점엔 owner 였다» 를 함의한다는 논증이 맞고, 단위 테스트가 세 상태(owner 로
승격 → 403, 강등 연쇄를 봐도 403, 행 소멸 → 404) 를 각각 분리해 뮤턴트(B′/B″) 로
고정한다. e2e 도 전용 워크스페이스로 격리돼 이전 WARNING 4(공유 fixture 오염) 도
해소됐고, `VACUITY_GUARD_MS` export 로 WARNING 5(가드 상수 3중 하드코딩) 도
닫혔다. `transferOwnership()` 의 두 멤버 락이 실제로는 순차 `pessimistic_write`
두 번(독스트링의 "단일 IN 쿼리"와 불일치)이지만, 그 앞에 걸리는 `workspace` 행의
`pessimistic_write` 가 같은 워크스페이스에 대한 두 `transferOwnership` 호출을
완전 직렬화하므로 A↔B 교차 이양의 ABBA 데드락은 실제로는 발생하지 않는다 — 이
관찰은 이번 diff 의 대상이 아니고 전 라운드 INFO 4 로 이미 dispositioned 됐다.

이번 diff 범위(`workspaces.service.ts`/`.spec.ts`, 두 e2e 파일, 테스트 헬퍼,
CHANGELOG·plan 문서) 안에서 새로 도입된 경쟁조건·데드락·비원자성·await 누락은
발견되지 않았다. 조기 가드(`member.role === 'owner'`, `assertAdmin` 이전)가 여전히
무락이라는 점은 설계상 backstop 으로 문서화·검증되어 있고, 그 자체의 권한순서
노출 문제는 동시성이 아니라 인가(security) 관점이라 별도 트래커 항목으로 이미
분리되어 있다.

## 발견사항

없음 — 이번 diff 가 새로 만든 경쟁조건·데드락·원자성 결함을 찾지 못했다.

- **[INFO]** `transferOwnership()` 독스트링 "두 멤버를 단일 IN 쿼리로 동시에 락" 은
  실제 구현(순차 `findOne(..., {lock:'pessimistic_write'})` 두 번)과 다르다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `transferOwnership()` 메서드(이번 diff 범위 밖, 미변경 코드)
  - 상세: 이 diff 의 대상 파일이 아니며, 앞선 `workspace` 행 `pessimistic_write` 락이 같은 워크스페이스에 대한 동시 이양 요청을 직렬화해 실질적 데드락 위험은 없다(같은 자리를 `review/code/2026/09/24/08_09_57/SUMMARY.md` INFO 4 가 이미 지적·dispositioned: "이번 PR 스코프 아님"). 이번 라운드에서도 여전히 사실이므로 연속성 차원에서만 재확인.
  - 제안: 조치 불요 — 기존 트래커/INFO 처분 유지.

## 위험도

LOW — 새로 발견된 동시성 결함 없음. 핵심 TOCTOU 수정(원자적 조건부 DELETE + EvalPlanQual 재평가)은 e2e 재진입 테스트로 결정적 검증되었고, 전 라운드에서 지적된 제3 상태 분기 오류·테스트 오염·상수 중복은 이번 diff 에서 모두 해소됨을 확인했다.
