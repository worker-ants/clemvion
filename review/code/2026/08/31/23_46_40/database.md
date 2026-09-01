# 데이터베이스(Database) 리뷰 — 아바타 업로드 (공개 버킷 + 공개 URL)

## 범위 판단

26개 변경 파일 중 실제 DB(RDBMS) 상호작용이 있는 코드는 `codebase/backend/src/modules/users/users.service.ts` 의
`updateAvatar()` / `update()` (TypeORM `Repository<User>` 사용) 가 유일하다. 나머지는 S3/MinIO 설정,
Swagger, k8s/compose 환경변수, spec/plan 문서, README 등으로 DB 관점에서 무관하다. 신규 마이그레이션·엔티티
변경은 없다 — `avatarUrl` 컬럼은 기존 컬럼이며(`entities/user.entity.ts:28`), `migrations/` 최신 파일은
`V109__workspace_personal_owner_unique.sql` 로 이 PR 과 무관함을 확인했다(`ls codebase/backend/migrations`).

## 발견사항

- **[INFO]** `updateAvatar()` 의 lost-update 방지가 올바르게 구현됨 (긍정 발견)
  - 위치: `codebase/backend/src/modules/users/users.service.ts:113`, `:136-137`, `:139-141`
  - 상세: S3 업로드(네트워크 I/O, 수백 ms~수 초) **앞에서** 읽은 엔티티 스냅샷을 `save()` 하지 않고,
    `this.userRepository.update(userId, { avatarUrl })` 로 **컬럼 단위 UPDATE** 만 실행한다. 락이나
    `@VersionColumn` 없이도, 업로드가 도는 동안 다른 요청이 바꾼 다른 컬럼(로그인 실패 카운터·계정
    잠금·2FA 등)이 조용히 되돌아가는 lost update 를 원천 차단한다. 표준적인 partial-update 패턴이 정확히
    적용됐다.
  - 제안: 없음 — 현재 구현이 올바르다.

- **[INFO]** `avatarUrl` 컬럼 자체에 대한 TOCTOU 경합 — 이미 문서화·유예된 항목, 정합성 파괴 없음
  - 위치: `codebase/backend/src/modules/users/users.service.ts:233-237`(`update()` 의 `previousUrl` 비원자적
    사전 SELECT), `:113`·`:122`(`updateAvatar()` 의 동일 패턴)
  - 상세: `update()` 는 `avatarUrl` 이 페이로드에 있을 때만 `findOne` 으로 `previousUrl` 을 읽고, 이후
    `update()` → `findOneOrFail()` → (값이 바뀌었으면) S3 정리를 수행한다. 이 read-then-write 시퀀스는
    트랜잭션이나 행 잠금으로 보호되지 않아, 동시에 `updateAvatar()`(업로드)와 `update()`(PATCH, 예:
    OAuth 재연동)가 같은 사용자에 대해 겹치면 "나중에 커밋한 UPDATE" 가 `avatarUrl` 컬럼을 덮어써
    "먼저 커밋한" 값을 잃을 수 있다(단일 컬럼 last-write-wins). DB row 자체는 항상 유효한 URL 하나를
    가지므로 **데이터 정합성은 깨지지 않고**, 결과는 S3 상의 고아 객체(과금·용량)로만 나타난다.
    이 클래스의 경합(더블클릭/다중 탭 동시 업로드)은 리뷰 2라운드에서 이미 W5 로 지적되어
    `plan/in-progress/spec-sync-user-profile-gaps.md` 에 재개 신호(`avatars/` 접두 객체 수가 사용자 수를
    유의미하게 웃돌 때)와 함께 명시적으로 유예되어 있다. 새로 발견한 결함이 아니라 기존 유예 판단이
    타당함을 DB 관점에서도 확인한 것이다.
  - 제안: 추가 조치 불필요(문서화된 유예를 유지). 향후 재개 시 per-user advisory lock 또는
    `SELECT ... FOR UPDATE` 로 read-modify-write 를 원자화하는 것을 권장.

- **[INFO]** `update()` + `findOneOrFail()` 2회 왕복 — `RETURNING` 절로 1회 축소 가능
  - 위치: `codebase/backend/src/modules/users/users.service.ts:137`, `:139-141` (및 `:239-240`)
  - 상세: `updateAvatar()`/`update()` 모두 `repository.update(...)` 로 쓰고 곧바로 `findOneOrFail(...)` 로
    다시 읽어 응답 봉투를 구성한다. 저장소에 이미 `UPDATE … RETURNING` 회귀 가드(`update-returning-rows.spec.ts`,
    CHANGELOG 언급)가 존재하는 것으로 보아 raw QueryBuilder + `RETURNING` 을 쓰면 왕복을 1회로 줄일 수
    있다. 아바타 업로드는 저빈도 경로라 실질적 성능 영향은 미미하다.
  - 제안: 선택 사항. 트래픽이 낮은 경로이므로 우선순위 낮음(INFO).

- **[NONE]** 인덱스: 신규/변경 쿼리는 모두 `where: { id }`(PK) 기반 `findOne`/`update`/`findOneOrFail` 이며
  기존 이메일 중복검사 `emailTakenByOther`(QueryBuilder, `LOWER(:email)`/`!= :id`)는 이번 diff 로 변경되지
  않았다. 인덱스 누락 우려 없음.
- **[NONE]** N+1: `updateAvatar()`/`update()` 모두 반복문 없이 요청당 고정 2~3회 DB 왕복(findOne/update/
  findOneOrFail)이며 배치·리스트 처리 코드가 아니다.
- **[NONE]** 마이그레이션 안전성: 스키마 변경 없음(`avatarUrl` 은 기존 컬럼). 신규 `.sql` 마이그레이션 파일도
  없음 — `codebase/backend/migrations` 최신 파일이 이 PR 과 무관한 `V109__…` 임을 확인했다.
- **[NONE]** 스키마 설계: 신규 테이블/컬럼 없음. `avatarUrl` 컬럼을 외부 URL·자체 업로드 URL 이 공유하는
  기존 설계를 그대로 유지하며, plan 문서에 "S3 key 대신 URL 을 저장" 하는 이유(계약이 URL, OAuth 프로필
  URL 도 같은 컬럼 사용)가 명시적으로 근거되어 있다. 비정규화·정규화 이슈 없음.
- **[NONE]** 커넥션 관리: NestJS DI + TypeORM `Repository<User>` 표준 패턴. 수동 커넥션 획득/해제 없음.
  `S3Service` 는 stateless 로컬 provider로 추가됐고 DB 커넥션과 무관.
- **[NONE]** SQL 인젝션: 신규 코드는 전부 TypeORM Repository API(`findOne`/`update`/`findOneOrFail`)를
  사용하며 파라미터를 객체로 전달한다. Raw SQL/문자열 결합 없음.
- **[NONE]** 대량 데이터: 페이지네이션·대용량 스캔 대상 쿼리 없음. 단건 사용자 row 갱신뿐.

## 뮤테이션/검증 관련

코드 변경 없이 읽기 전용으로 분석했다. 저장소 파일을 고치거나 임시 파일을 만들지 않았으며 `git status --short`
결과 이 세션이 만든 것은 `review/code/**` 산출물뿐임을 확인했다(다른 세션의 변경 아님).

## 요약

이번 변경에서 DB 와 직접 상호작용하는 코드는 `users.service.ts` 의 `updateAvatar()`/`update()` 뿐이며,
S3 업로드가 도는 동안의 lost-update 위험을 컬럼 단위 `UPDATE` 로 정확히 차단한 점이 눈에 띈다. 남은 것은
`avatarUrl` 단일 컬럼에 대한 TOCTOU 경합인데, 이는 데이터 정합성을 해치지 않고(항상 유효한 URL 하나로
수렴) S3 고아 객체로만 나타나며, 이미 리뷰 이전 라운드에서 식별되어 근거와 재개 신호까지 갖춰 plan 에
명시적으로 유예되어 있다. 마이그레이션·엔티티·인덱스·SQL 인젝션·커넥션 관리 관점에서는 이번 diff 가
새로 만든 문제가 없다.

## 위험도

LOW
