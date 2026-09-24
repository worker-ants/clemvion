# Database 리뷰 — `removeMember` 인가 순서 재배치

## 발견사항

- **[INFO]** 쿼리 재배치는 새 쿼리를 추가하지 않았고, 거부 경로에서는 오히려 쿼리 수가 줄었다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:814-851` (`removeMember`)
  - 상세: 변경 전 순서는 `findOne(member)` → self 위임 → `member.role==='owner'` 검사 →
    `assertAdmin`(내부에서 `getMemberRole` 재호출) 이었다. 변경 후는
    `getMemberRole(requester)`(831) → 미가입이면 즉시 종료(832) → `findOne(member)`(834) →
    self 위임(838-842) → `ADMIN_ROLES.has(requesterRole)`(847, 이미 읽어둔 값 재사용) →
    `member.role==='owner'`(850) 순이다. 정상 admin 제거 경로는 두 쿼리(`getMemberRole` +
    `findOne`)로 이전과 동일하고, 비-멤버가 존재하지 않거나 owner/비-owner 대상을 찌르는 거부
    경로는 `getMemberRole` 1회만으로 끝나 이전(대상 `findOne` + `assertAdmin` 의 `getMemberRole`
    2회)보다 쿼리가 줄었다. N+1 이나 추가 라운드트립은 없다.
  - 제안: 없음(정보성 확인).

- **[INFO]** `getMemberRole`/`removeMember` 의 조회는 기존 유니크 인덱스로 커버되며 이번 diff 는
  쿼리 형태를 바꾸지 않았다
  - 위치: `codebase/backend/src/modules/workspaces/entities/workspace-member.entity.ts:13`
    (`@Unique(['workspaceId', 'userId'])`), 사용처
    `codebase/backend/src/modules/workspaces/workspaces.service.ts:112-117` (`getMemberRole`)
  - 상세: `getMemberRole` 은 `where: { workspaceId, userId }` 로 조회하며 이 조합은
    `workspace_member` 의 `UNIQUE(workspace_id, user_id)` 제약이 만드는 인덱스로 인덱스
    스캔이 된다. `removeMember` 안의 대상 조회(`findOne({ where: { id: memberId, workspaceId } })`)
    는 PK(`id`) 인덱스를 탄다. 이번 변경은 두 쿼리의 **호출 순서**만 바꿨을 뿐 조건절·인덱스
    요구사항은 그대로다 — 새 인덱스가 필요한 새 접근 패턴은 없다.
  - 제안: 없음.

- **[INFO]** 동시성을 다루는 단일 원자적 `DELETE`(`role: Not('owner')` 술어 + `affected===0`
  명시 비교)는 이번 diff 의 변경 대상이 아니며 그대로 유지된다
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:877-896`
  - 상세: 락 없는 읽기 위에 단일 `DELETE` 문으로 동시 제거·동시 `transferOwnership` 을 가르는
    기존 설계(코드 주석에 Postgres READ COMMITTED 의 EvalPlanQual 근거까지 명시)는 이번 PR 에서
    변경되지 않았다. 인가 순서 재배치가 이 트랜잭션 경계나 원자성 보장에 영향을 주지 않는다.
    다만 이 DELETE 문은 그 자체로 단문(single statement)이라 별도 `@Transaction()` 래핑 없이도
    원자적이라는 전제가 맞다 — 재확인 결과 이견 없음.
  - 제안: 없음.

- **[INFO]** SQL 인젝션 표면 없음
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:694-697, 727-730` (신규 e2e 테스트의
    raw SQL)
  - 상세: 신규 e2e 테스트가 추가한 두 raw 쿼리(`SELECT id, role FROM workspace_member WHERE
    workspace_id = $1`, `SELECT COUNT(*)::text ... WHERE workspace_id = $1`)는 `pg` 드라이버의
    포지셔널 파라미터(`$1`)를 사용해 문자열 접합이 없다. 서비스 코드 쪽도 TypeORM `where` 객체
    기반이라 파라미터화가 유지된다.
  - 제안: 없음.

- **[INFO]** 마이그레이션/스키마 변경 없음
  - 위치: N/A (`git diff --stat` 확인 결과 변경 파일은
    `workspaces.service.ts`/`workspaces.service.spec.ts`/`workspace-rbac.e2e-spec.ts` 3개뿐)
  - 상세: 엔티티·마이그레이션 파일 변경이 diff 에 없다. 무중단 배포 관점에서 검토할 스키마
    변경이 없다.
  - 제안: 없음.

## 요약

이번 변경은 `removeMember` 의 **인가 판정 순서**(멤버십 → 대상 존재 → self 위임 → admin →
owner)를 재배치해 비-멤버가 응답 차이로 대상의 존재·owner 여부를 알아내는 오라클을 막는
보안/인가 성격의 수정이며, 순수 데이터베이스 관점에서는 스키마·마이그레이션·인덱스·트랜잭션
경계의 변경이 전혀 없다. 재배치된 두 쿼리(`getMemberRole`, `findOne`)는 기존 유니크 인덱스와
PK 인덱스로 그대로 커버되고, 정상 경로의 쿼리 수는 동일하며 거부 경로는 오히려 쿼리 1회로
줄었다(N+1 없음). 동시성을 처리하는 원자적 `DELETE` + `affected===0` 비교 로직은 손대지 않았고,
신규 e2e 테스트의 raw SQL 도 파라미터화돼 있다. DB 관점에서 지적할 결함이 없다.

## 위험도

NONE
