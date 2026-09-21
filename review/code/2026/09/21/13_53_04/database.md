# 데이터베이스(Database) 리뷰 — `WorkspacesService.removeMember()` 동시 제거 감사 중복 수정 (3차 라운드)

## 검토 방법

`origin/main...HEAD` 의 `codebase/` diff 는 이전 두 라운드(`review/code/2026/09/21/12_57_05`,
`review/code/2026/09/21/13_28_12`)와 완전히 동일하다 — `git diff origin/main...HEAD --stat -- codebase/`
결과 3파일 413줄 추가/20줄 삭제로 두 라운드 모두와 일치하고, 이번 라운드의 유일한 신규 커밋
(`6f1113a70`)은 `git show --stat` 확인 결과 `plan/*.md` 문서 정정만 포함하며 `codebase/`를 전혀
건드리지 않는다. 나머지 신규 파일(파일 21~41)은 직전 라운드(`13_28_12`)의 리뷰 산출물과
`review/consistency/2026/09/21/12_23_48/**`이며 코드가 아니다. 따라서 DB 관점의 실질 검토 대상은
이전 두 라운드와 동일한 3개 코드 파일이고, 새로 보고할 DB 관점 결함은 없다.

## 발견사항

- **[WARNING]** owner 승격 TOCTOU — `removeMember()`의 owner 보호 가드가 여전히 무락 읽기 위에 있어, 동시 `transferOwnership()`과 겹치면 owner 멤버가 삭제될 수 있다 (이번 라운드가 새로 만든 결함 아님 — 두 차례 선행 리뷰에서 실측·등재·유예된 항목의 3차 재확인)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:809`(무락 `findOne` 스냅샷에 기반한 `member.role === 'owner'` 판정) ~ `:834`(원자적 `delete({id, workspaceId})`). 자기-인지 주석은 `:816-833`.
  - 상세: `member.role === 'owner'` 검사(:809)와 `assertAdmin`(:815)이 `:800-802`의 무락 `findOne` 결과를 근거로 판단한다. 이 읽기와 `:834`의 원자적 `DELETE` 사이에 동시 `transferOwnership()`이 같은 행을 owner로 승격시키면, `removeMember()`는 이미 "owner 아님"을 확인한 뒤이므로 재검사 없이 그대로 `DELETE`를 실행해 owner 행을 지운다. 이 PR이 도입한 `affected === 0` 판별자는 "행이 사라졌는가"만 구분할 뿐 "owner로 바뀌었는가"는 구분하지 못하므로, 이 창에서 owner 삭제는 그대로 성공(200)한다. `plan/in-progress/member-dup-remove.md` §C-2와 `plan/in-progress/spec-draft-nullable-notation-followups.md`에 재진입 기법(locker가 행 락을 쥔 채 `role='owner'`로 UPDATE 후 COMMIT)으로 **실측 재현**됐다(`status=200, rows_remaining=0`). 후보 처방(`delete({..., role: Not('owner')})` + 0행 시 원인 재조회)까지 이미 문서화돼 있고, `review/code/2026/09/21/12_57_05/RESOLUTION.md`가 "코드 무수정, 이번 PR 스코프 밖 유지"로 명시적으로 유예했다고 기록한다. 이번 라운드의 유일한 신규 커밋(`6f1113a70`)도 이 구간을 전혀 건드리지 않는다.
  - 제안: 이번 PR을 막을 사유는 아니다(판별자 재사용 오염을 피하려는 유예 논리가 타당하고, 코드 주석·plan·트래커에 일관되게 정직히 기록돼 있다). 다만 후속 PR에서 `role: Not('owner')` 조건부 `DELETE` + 0행 시 원인 재조회(행 부재 vs owner 승격) 처방을 별도 뮤테이션 테스트와 함께 반드시 닫을 것.

- **[INFO]** 원자적 `DELETE` + `affected === 0` 명시 비교는 인덱스·동시성 관점에서 여전히 적절 — 신규 인덱스 불필요, 변경 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-838`, 엔티티 `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:16`(`@PrimaryGeneratedColumn('uuid') id`)
  - 상세: `DELETE ... WHERE id = $1 AND workspace_id = $2`는 `id`가 PK(자동 인덱스)라 단일 행 PK 조회로 처리되고, `workspace_id` 조건은 방어적 필터일 뿐 별도 인덱스가 필요한 스캔 패턴이 아니다. advisory lock·행 락 없이 DB 단일 문장의 원자성만으로 동시 삭제 두 건 중 정확히 하나만 성공시키는 방식은 형제 PR(#1369~#1372)과 동일한 검증된 패턴이며, `affected`를 `null`/`undefined`(드라이버 미보고)와 `0`(실제 미삭제)으로 명시 구분한 것도 그대로 유지된다. 이 판정을 뒷받침하는 대조군 테스트(`it.each([[undefined],[null]])`, `workspaces.service.spec.ts:1524-1537` 부근)도 변경 없이 유지된다.
  - 제안: 없음 — 참고용 재확인.

- **[INFO]** 감사 로그 기록이 `DELETE`와 같은 트랜잭션에 묶여 있지 않음 (best-effort, 기존 모듈 관례와 일치, 변경 없음)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:834-845`
  - 상세: `memberRepository.delete()`(:834, autocommit) 성공 후 `auditLogsService.record()`를 별도 호출로 실행한다. 감사 기록이 실패해도 `DELETE`는 이미 커밋된 채로 남는다. 형제 5건(#1369~#1372)과 `leaveWorkspace()` 등 모듈 전체에 이미 일관되게 적용된 관례이며, 이번 라운드의 문서 전용 커밋은 이 부분을 건드리지 않는다.
  - 제안: 조치 불요 — 모듈 전체 컨벤션을 바꾸는 사안이라 이 PR 단독 스코프가 아니다.

- **[INFO]** e2e 테스트(`member-remove-concurrency.e2e-spec.ts`)의 DB 커넥션·락·파라미터 바인딩은 적절, 변경 없음
  - 위치: `codebase/backend/test/member-remove-concurrency.e2e-spec.ts:41-59`(connect/end), `:88-118`, `:167-193`(BEGIN/`FOR UPDATE`/COMMIT/ROLLBACK)
  - 상세: `locker` 커넥션이 `SELECT id FROM workspace_member WHERE id = $1 FOR UPDATE`로 단일 행만 잠그고, `finally`에서 항상 `ROLLBACK`을 시도해(`.catch(() => undefined)`) 커넥션이 락을 쥔 채 남지 않는다. `afterAll`에서 `locker.end()`/`db.end()`로 커넥션을 명시적으로 닫는다. 모든 쿼리가 `$1`/`$2` 파라미터 바인딩을 쓰고 문자열 결합이 없어 SQL 인젝션 위험이 없다. 이번 라운드의 신규 커밋(`6f1113a70`)이 이 파일의 주석/plan 서술 중 "형제 다섯은 전부 204" 정정을 다뤘지만, 이는 HTTP 응답 코드 서술의 정정일 뿐 쿼리·락·커넥션 로직 자체는 변경하지 않았다 — `git diff origin/main...HEAD --stat -- codebase/`가 세 라운드 내내 동일 313/20라인임을 재확인.
  - 제안: 없음 — 참고용 재확인.

- **[INFO]** N+1·마이그레이션·대량 데이터/페이지네이션 관점은 해당 없음
  - 상세: 이번 diff(파일 1~3)는 단일 행 조회/삭제 경로(`findOne` 1회 + `delete` 1회)만 다루며, 반복문 내 쿼리, 스키마 변경(마이그레이션), 목록 조회·페이지네이션을 포함하지 않는다. 나머지 파일(파일 4~41, `plan/*.md`·`review/**`)은 계획 문서·이전 리뷰/consistency-check 산출 아티팩트이므로 DB 관점 점검 대상이 아니다.

## 요약

이번 3차 라운드에서 `codebase/` 쪽 diff는 앞선 두 라운드(`12_57_05`, `13_28_12`)와 바이트 단위로 동일하며, 유일한 신규 커밋(`6f1113a70`)은 "동시 삭제 패자의 성공 코드가 라우트별이 아니라 컨트롤러별로 갈린다"는 사실 정정을 담은 문서 전용(plan/e2e 주석) 커밋이라 DB 로직에 영향이 없다. 따라서 핵심 DB 판정(무락 `findOne` → 원자적 `delete({id, workspaceId})` + `affected === 0` 명시 비교)의 인덱스·SQL 인젝션·커넥션 관리·대량 데이터 평가는 이전 두 라운드와 동일하게 문제 없음으로 유지된다. 유일하게 남는 실질 DB 동시성 결함은 owner 보호 가드가 여전히 무락 스냅샷 위에 있어 동시 `transferOwnership()`과 겹치면 owner가 삭제될 수 있는 TOCTOU 창인데, 이는 이번 PR이 새로 만든 회귀가 아니라 이미 두 차례 리뷰에서 실측·문서화·트래커 등재되고 판별자 오염을 근거로 의도적으로 유예된 사안이므로 병합을 막을 사유는 아니지만, 후속 PR에서 반드시 닫아야 한다.

## 위험도

LOW
