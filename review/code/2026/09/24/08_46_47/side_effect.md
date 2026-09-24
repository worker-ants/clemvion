# 부작용(Side Effect) 리뷰 — `removeMember()` owner 보호 가드 TOCTOU 수정

## 발견사항

- **[INFO]** `removeMember()` 관찰 가능 동작이 동시성 창에서 의도적으로 바뀐다(회귀 아님, 계약 강화)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:854-873` (`removeMember`)
  - 상세: 종전에는 `affected === 0` 이 항상 `404 MEMBER_NOT_FOUND` 하나로 귀결됐다. 이제 같은 0 이 "행 소실"(404) 과 "owner 였음"(403 `CANNOT_REMOVE_OWNER`) 두 갈래로 갈리고, DELETE 문 자체에 `role: Not('owner')` 술어가 더해져 0-행 경로에서만 한 번 더 무락 `findOne` 을 수행한다. 즉 같은 입력·같은 동시성 타이밍이라도 API 응답이 고친 전(200, 멤버 삭제됨)과 후(403, 행 유지)로 달라진다 — `CHANGELOG.md` 와 `plan/in-progress/member-owner-toctou.md` 가 이 변경을 명시적으로 서술하고 e2e(`member-remove-concurrency.e2e-spec.ts` 신규 `it`)가 고치기 전 RED(`Expected 403, Received 200`)로 판별력을 확인했으므로 의도된 계약 변경이다. `removeMember` 의 공개 시그니처(파라미터·반환 타입)는 변경되지 않았다.
  - 제안: 조치 불요 — 문서·테스트로 뒷받침된 의도된 동작 변경.

- **[INFO]** 0-행 경로에 새 무락 DB 왕복이 추가됨 — 드문 경로 한정, 잠그지 않음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:863-865`
  - 상세: `affected === 0` 일 때만 `memberRepository.findOne` 을 한 번 더 호출한다. 정상 경로(단일 요청, 겹침 없음)에는 영향이 없고, 동시 제거·동시 owner 이양이 겹치는 드문 레이스에서만 추가 라운드트립이 생긴다. 재조회는 잠그지 않으며 에러 코드 선택에만 관여해(데이터를 바꾸지 않음) 별도 부작용은 없다.
  - 제안: 조치 불요.

- **[INFO]** e2e 신규 테스트가 `transferOwnership()` 를 우회한 raw SQL 로 "owner 2명"이라는 애플리케이션 코드로는 도달 불가능한 상태를 커밋한다 — 단, 이번 수정으로 **전용 워크스페이스에 격리**돼 이전 라운드 WARNING(공유 workspace 오염, 파일 순서 의존)이 해소됐다
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts` 신규 `it('제거 중 대상이 owner 로 승격되면 지우지 않고 403 이다', ...)` — `createTeamWorkspace(...)` 호출부와 `UPDATE workspace_member SET role = 'owner' WHERE id = $1` 실행부
  - 상세: `review/code/2026/09/24/08_09_57/side_effect.md` 가 지적한 WARNING("raw SQL 오염이 공유 workspace 에 남고 파일 순서에만 의존해 격리된다")은 이번 diff 에서 `isolatedWorkspaceId = await createTeamWorkspace(...)` 로 전용 워크스페이스를 새로 만들어 해소했다 — 다른 테스트가 쓰는 `workspaceId` 공유 fixture 에는 더 이상 영향을 주지 않는다. 다만 그 전용 워크스페이스 자체는 raw UPDATE 로 owner 가 둘인 상태를 영구히 가진 채 테스트 DB 에 남는다(명시적 cleanup 없음) — 같은 파일의 기존 테스트들도 생성한 workspace 를 정리하지 않는 것과 동일한 패턴이라 새로운 관례 위반은 아니고, 격리됐으므로 blast radius 는 그 워크스페이스 하나로 국한된다.
  - 제안: 조치 불요(이미 기록된 트레이드오프, 격리로 위험도가 WARNING→INFO 로 낮아짐). 필요하면 후속으로 테스트 종료 시 원상복구(`role='editor'`)를 고려할 수 있으나 이번 PR 스코프는 아니다.

- **[INFO]** `VACUITY_GUARD_MS` 를 test 헬퍼 모듈에서 `export` 로 승격 — 시각적 인터페이스 확장이지만 프로덕션 코드 밖, 상수·불변
  - 위치: `codebase/backend/test/helpers/concurrency.ts:31` (`export const VACUITY_GUARD_MS = 1_500;`)
  - 상세: 모듈-비공개 상수를 export 로 바꿔 `integration-rotate-concurrency.e2e-spec.ts`·`member-remove-concurrency.e2e-spec.ts` 두 e2e 파일이 import 해 재사용한다. 값 자체(1_500)는 바뀌지 않았고, import 시점에 `assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS)` 를 실행하는 기존 모듈-레벨 부작용도 그대로다(이번 diff 가 새로 만든 것이 아님). 이 상수를 가져다 쓰는 두 자리 모두 프로덕션 코드가 아니라 e2e 테스트이므로 공개 API 계약에는 영향이 없다.
  - 제안: 조치 불요.

## 확인 사항 (문제 아님 — 근거 실측)

- 전역 변수 신규 도입 없음. `WorkspacesService` 인스턴스 필드·모듈 레벨 mutable 상태 변경 없음.
- 환경 변수 읽기/쓰기 신규 없음 — `member-remove-concurrency.e2e-spec.ts` 의 `process.env.E2E_BASE_URL` 참조는 기존 파일 최상단 상수로 이번 diff 대상이 아니다.
- 파일시스템 부작용 없음 — 신규 `.md`/`.json` 산출물(`plan/in-progress/member-owner-toctou.md`, `review/code/2026/09/24/08_09_57/**`)은 프로젝트 컨벤션이 정한 plan/review 아티팩트 정규 위치에 생성된 것으로 예상된 기록이지 예기치 못한 파일 부작용이 아니다.
- 네트워크 호출 신규 없음 — e2e 테스트의 `request(BASE_URL).delete(...)` 는 테스트 대상 앱을 향한 기존 e2e 패턴의 반복이지 새 외부 서비스 호출이 아니다.
- 이벤트/콜백 변경 없음 — 감사 로그(`auditLogsService.record`) 호출은 성공 경로에서만, 종전과 동일하게 한 번 발생한다. 에러 분기(403/404) 어느 쪽도 감사를 남기지 않는 점은 변경 전과 동일.
- `throwCannotRemoveOwner()` 는 `private` 헬퍼로, 두 호출 지점(이른 가드·재조회 가드)이 던지는 예외의 `code`/`message`/HTTP 상태(403)가 동일함을 보장할 뿐 외부 시그니처에는 영향 없다.
- `wireFindOne` 테스트 헬퍼의 신규 3번째 파라미터(`targetOnReread?`)는 optional 이고 스펙 파일 내부 지역 함수라 export 되지 않는다 — 기존 호출부(파라미터 미전달)는 동작 변화 없음. 클로저 변수 `targetReads` 는 `wireFindOne` 호출마다 새로 생성돼 테스트 간 상태가 새지 않는다.
- `member.role === 'owner'` 이른 가드가 `assertAdmin` 보다 먼저 실행되는 순서(비-admin/비-멤버도 owner 여부를 오라클처럼 알 수 있음)는 이번 diff 가 새로 만든 것이 아니라 리팩터 이전부터 있던 기존 코드 순서를 헬퍼 호출로만 감쌌다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` §F 에 별도 트래커 항목으로 이미 등재돼 있어 재-flag 하지 않는다.
- 워크트리 오염 없음: 이번 리뷰 전 과정에서 저장소 파일을 수정/뮤테이션하지 않았다(전량 `Read`/`grep`/`git status` 로만 확인). `git status --short` 결과 이 리뷰 세션 산출 디렉터리(`review/code/2026/09/24/08_46_47/`) 외 변경 없음.

## 요약

핵심 프로덕션 변경(`removeMember()` DELETE 문에 `role: Not('owner')` 술어 추가 + 0-행 재조회 분기)은 공개 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트 발화 어느 것도 건드리지 않는 국소적 변경이며, 유일한 관찰 가능 변화(동시성 창에서의 응답 코드 변경)는 CHANGELOG·plan·e2e 로 충분히 뒷받침된 의도된 버그 수정이다. 직전 라운드(`08_09_57`)가 지적한 유일한 side-effect WARNING — e2e 가 raw SQL 로 공유 workspace 를 오염시키고 그 격리가 파일 순서(주석)에만 의존한다 — 은 이번 diff 에서 전용 워크스페이스 생성으로 구조적으로 해소됐다. 새로 도입된 side effect 는 모두 INFO 수준(드문 경로의 추가 DB 왕복, 격리된 워크스페이스에 남는 "owner 2명" 잔여 상태, 테스트 헬퍼 상수의 export 승격)이며 병합을 막을 사유는 없다.

## 위험도

LOW
