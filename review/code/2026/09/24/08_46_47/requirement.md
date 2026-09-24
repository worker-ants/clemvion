# 요구사항(Requirement) 리뷰 — member-owner-toctou (2라운드)

## 대상 및 방법

핵심 변경은 `WorkspacesService.removeMember()` 의 «owner 는 제거할 수 없다» 가드를 무락
`findOne` 위에서만 판정하지 않고, 원자적 `DELETE … WHERE role != 'owner'` 술어 + `affected===0`
2차 판별(재조회로 404/403 분기)로 옮긴 TOCTOU 수정이다. 1라운드 리뷰(`review/code/2026/09/24/08_09_57`,
Critical 0 · Warning 6)가 이미 전 관점에서 훑었고, 이번 diff 는 그 6건 조치(`06aa6d5e1`) +
RESOLUTION 문서화(`44d5dc429`)가 반영된 상태다. `Read`/`Grep` 으로 `workspaces.service.ts`,
`workspaces.service.spec.ts`, `member-remove-concurrency.e2e-spec.ts`, `test/helpers/concurrency.ts`,
`spec/data-flow/12-workspace.md`, `spec/5-system/1-auth.md` 원본을 직접 열어 diff 게이트 번호와
대조했다. 저장소에 뮤테이션은 가하지 않았다(`git status --short` 확인, 세션 산출물 디렉터리 외
변경 없음).

## 발견사항

- **[INFO]** 권한 검사 순서 오라클(비-멤버도 owner 조기 가드로 대상 role 을 추론 가능)은 이 diff 의
  회귀가 아니라 기존 결함이며, 이미 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`
  §F)와 1라운드 리뷰(WARNING #2, `06aa6d5e1` 로 서술 정정 완료)에 등재돼 있다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()` 내
    `if (member.role === 'owner') this.throwCannotRemoveOwner();` 가 `assertAdmin()` 호출보다
    앞선다(현재 이 순서 그대로, 828번째 줄 근방 `if (member.role === 'owner')`).
  - 상세: `RolesGuard` 가 `handlerConsumesWorkspaceId=false` 면 단락하고 이 핸들러는
    `@Param('id')` 를 쓰므로(가드 계층에서 멤버십 검사가 전혀 돌지 않음), 서비스의
    `member.role==='owner'` 이른 가드가 임의 인증 사용자에게 대상의 owner 여부를 오라클처럼
    노출한다. 단위 테스트(`admin/owner 가 아니면 ADMIN_REQUIRED 로 거부…`)도 주석으로 "검사 순서에
    결합하지 않는다"고 명시해 이 결함을 알고 우회 설계했음을 확인.
  - 제안: 조치 불요(이미 별도 트래커 항목, 이 PR 스코프 아님) — 재-flag 아님, 확인 차 기록.

- **[INFO]** `affected===0` 이후 무락 재조회는 존재 여부만 보고 role 을 다시 묻지 않는다
  (`if (still) this.throwCannotRemoveOwner();`). "이양 연쇄"(승격→강등)에서도 404 대신 403 을
  일관되게 반환하도록 의도된 설계이며, 단위 테스트 3종(owner 승격/강등/행 소멸)이 세 분기를
  모두 고정한다. `role: Not('owner')` 술어가 유일한 DELETE 판별식이므로 "행이 남아 있는데
  0행" 은 "그 시점에 owner 였다"는 것 외의 해석이 없다는 추론이 맞는다 — 재-검증했고 결함 없음.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:859-873`
    (`if (affected === 0) { … const still = await this.memberRepository.findOne(...) …}`).

- **[INFO]** spec fidelity — `spec/data-flow/12-workspace.md:141` (`DELETE
  /api/workspaces/:id/members/:memberId` … "owner 는 제거 불가")과 `spec/5-system/1-auth.md:378,553`
  (`CANNOT_REMOVE_OWNER` 각주)는 "거부된다"는 결과만 규정하고 동시성 메커니즘을 규정하지 않는다.
  이번 PR 의 원자적 `DELETE` + 술어 방식은 그 문장을 동시성 하에서도 참으로 만드는 구현
  디테일이라 spec 문언과 상충하지 않는다 — `plan/in-progress/member-owner-toctou.md` §C 가
  `spec_impact: none` 으로 판단한 근거가 코드와 spec 본문 대조로도 확인된다. 형제 셋
  (`deleteWorkspace`/`leaveWorkspace`/`transferOwnership`, `12-workspace.md:188-189`)은
  비관적 락 메커니즘을 spec 에 명시하는데 `removeMember` 행(`:141`)만 없는 비대칭은 이미
  planner 항목으로 등재됐다(`spec-draft-nullable-notation-followups.md` 신규 블록, "developer,
  낮음"). SPEC-DRIFT 로 분류하지 않는 이유: spec 문언 자체는 여전히 참이고(요구사항 결과 불변,
  메커니즘 미기술은 처음부터 spec 의 공백이었지 이 PR 이 깨뜨린 서술이 아님) — 코드가 spec 을
  반증한 것이 아니라 spec 이 애초에 메커니즘 레벨을 다루지 않는 회색지대다.

- **[INFO]** 에러코드 `CANNOT_REMOVE_OWNER` 는 중앙 에러 카탈로그(`spec/5-system/3-error-handling.md`
  §1)에 미등재 상태이나, 이는 기존 갭이고 이번 diff 가 만들지 않았으며 이미 별도 planner
  트래커 항목(`spec-draft-nullable-notation-followups.md`, 2026-09-24 등재)으로 분리돼 있다.
  중복 지적 아님.

## 기능 완전성 / 엣지 케이스 / 반환값 점검

- `affected===0` 의 두 원인(행 소멸 vs owner 승격)을 재조회 1회로 정확히 분기 — 4가지 단위
  테스트(승격/강등/소멸/정상삭제)와 뮤턴트 3종(A: 술어 제거, B″: 존재-분기 제거, C: `affected`
  비교 완화)이 모두 예측=실측으로 고정됐다(`review/code/2026/09/24/08_09_57/RESOLUTION.md` 재측정
  표, `plan/in-progress/member-owner-toctou.md` §E 뮤턴트 표와 일치).
- `still` 재조회는 락을 쥐지 않으므로 그 사이 추가 변경이 있어도 "에러 코드 선택"에만 영향
  (데이터 정합성은 이미 원자적 DELETE 문장에서 확정) — 경계 케이스가 소진적으로 다뤄졌다.
- e2e 재현(`member-remove-concurrency.e2e-spec.ts`)은 레이스가 아니라 재진입(테스트가 행 락을
  쥐고 승격을 끼워 넣음)으로 결정적 인터리빙을 만들고, 공허성 가드(`Promise.race` +
  `VACUITY_GUARD_MS`)로 "겹침이 실제로 만들어졌음"을 검증한 뒤 단언한다 — 거짓 GREEN 방지
  설계가 적절하다. `finally` 블록의 `ROLLBACK` + `pending?.catch()` 드레인도 단언 실패 시
  대기 요청을 남기지 않도록 방어한다.
- 신규 e2e 는 전용 워크스페이스(`createTeamWorkspace`)를 사용해 raw UPDATE 가 만드는 "owner
  2명"(애플리케이션 도달 불가 상태)이 공유 fixture 를 오염시키지 않도록 격리했다 — 1라운드
  W4 지적이 정확히 반영됨.
- `VACUITY_GUARD_MS` export 로 재진입 e2e 두 파일이 공유 — 1라운드 W5 지적 반영, 향후 락
  타임아웃 변경 시 `assertGuardBelowKnownTimeouts` 검사 범위 안에 값이 들어옴.
- `Not('owner')` 가 TypeORM `delete()` 에서 실제로 SQL `WHERE role != 'owner'` 로 렌더되는지는
  jest deep-equality 로 확인 불가(`sessions.service.spec.ts` 와 동일한 이유로 `criteria.role.type`/
  `.value` 를 직접 검사) — 렌더링 자체의 정합성은 신규 e2e 가 실 DB 오라클로만 고정한다는 설계가
  단위/e2e 두 레이어의 책임 분담으로 타당하다.

## TODO/FIXME 여부

diff 대상 6개 코드/테스트 파일에서 `TODO`/`FIXME`/`HACK`/`XXX` 패턴 없음(`git diff` grep 확인).

## 요약

`removeMember()` owner 보호 가드의 TOCTOU 를 원자적 `DELETE … WHERE role != 'owner'` +
`affected===0` 2차 재조회로 닫는 구현이 의도(가드를 "무락 읽기" 가 아니라 "삭제 문장 자체" 로
옮겨 동시 `transferOwnership` 과의 경합에서도 owner 삭제를 막는다)를 정확히 구현한다. 재조회의
분기 로직(존재-여부만 판정, role 재확인 없음)은 1라운드 리뷰의 W3(제3 상태) 지적을 반영해 이미
한 차례 교정됐고, 그 교정이 만든 "일어날 수 없는 옛 mock" 문제도 뮤턴트 재측정으로 스스로
발견·수정했다(`235d03e2c`→`06aa6d5e1`→`44d5dc429`). 단위 4종 + e2e 재진입 1종 + 뮤턴트 3종
전부 예측=실측이며, spec 본문(`12-workspace.md:141`, `1-auth.md §3.2 각주`)과 결과 수준에서
불일치가 없다(메커니즘 미기술은 기존 spec 공백이지 이 PR 의 드리프트가 아니며 이미 planner
항목으로 분리됨). 새로 발견된 Critical/Warning 급 결함은 없고, 유일한 지속 이슈(권한 검사 순서
오라클)는 이 diff 이전부터 존재했고 트래커에 정확히 등재돼 있다.

## 위험도

NONE
