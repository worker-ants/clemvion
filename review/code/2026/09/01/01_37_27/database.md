# 데이터베이스(Database) 코드 리뷰 — 아바타 이미지 업로드 (공개 버킷 + 공개 URL)

## 발견사항

- **[INFO]** (확인 결과, 문제 없음) 이번 라운드의 실질 코드 델타는 DB 동작을 바꾸지 않는다 —
  `isLocked()` 에 시계 비대칭을 disclose 하는 JSDoc 과, 업로드 실패 축을 잠그는 테스트 1건뿐
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `isLocked` (JSDoc 추가,
    commit `9b1ba58ae`) / `codebase/backend/src/modules/users/users-avatar.service.spec.ts`
    (`'업로드 자체가 실패하면 DB 도 S3 도 건드리지 않고 전파한다'`)
  - 상세: 직전 라운드(`review/code/2026/09/01/01_19_27/database.md`)가 검토한 시점(commit
    `f24584a35`, 7R) 이후 이 브랜치에 추가된 유일한 코드 변경은 `git show 9b1ba58ae`
    로 확인한 대로 (1) `isLocked()` 위에 "쓰기는 DB `NOW()`, 읽기는 앱 서버 시계" 라는
    비대칭을 설명하는 JSDoc 블록, (2) `S3Service.upload()` 가 실패했을 때
    `savedPatch`(=`userRepository.update` 호출 여부)가 `undefined` 이고
    `s3.delete` 도 호출되지 않음을 단언하는 신규 테스트뿐이다. 프로덕션 코드 로직은
    한 줄도 바뀌지 않았다.
  - 제안: 없음 — 두 변경 모두 기존에 이미 성립하던 동작(순차 실행 순서상 `upload()` 예외가
    던져지면 그 뒤의 `userRepository.update()` 호출 자체가 실행되지 않음)을 문서화·고정할
    뿐이라 신규 위험이 없다.

- **[INFO]** `isLocked()` 의 쓰기/읽기 시계 비대칭은 DB 정합성 결함이 아니라 명시적으로
  disclose 된 허용 오차이며, 근거가 측정 가능하다
  - 위치: `codebase/backend/src/modules/users/users.service.ts` `isLocked` /
    `incrementLoginAttempts`
  - 상세: `incrementLoginAttempts` 는 `locked_until` 을 `NOW() + ($3 || ' minutes')::interval`
    로 **DB 시계** 기준으로 쓰는데, `isLocked()` 는 그 값을 `new Date() > user.lockedUntil`
    로 **앱 서버 시계**와 비교한다. 두 값의 소스가 다르므로 앱 서버와 DB 서버 간 시계
    드리프트가 있으면 잠금 지속 시간이 그만큼 늘거나 준다. 다만 이는 데이터 정합성
    (row 값 자체)을 해치지 않고 판정 시점의 오차로만 나타나며, NTP 동기 환경에서는
    초 단위이고 잠금 자체가 10분이라 실질 영향이 작다. 없애려면 `isLocked()` 호출마다
    `SELECT NOW()` 를 추가로 쳐야 하는데 이는 **모든 로그인 시도**가 부담하는 비용이라,
    비용 대비 이득이 낮다는 판단이 JSDoc 에 근거와 함께 남아 있다. 재개 조건(시계가
    크게 어긋난 배포에서 잠금 시간이 눈에 띄게 달라지면 DB 기준 판정으로 전환)도 명시돼
    새로 지적할 사항이 없다.
  - 제안: 없음. 다중 앱 인스턴스 환경에서 NTP 동기화가 깨지는 사고가 실제로 관측되면
    그때 `isLocked` 판정도 DB `NOW()` 기반으로 전환하는 것을 재고할 것.

- **[INFO]** 업로드 실패 시 부분 DB 상태가 남지 않음을 테스트로 고정 — 트랜잭션 없이도
  정합성이 유지되는 설계가 실측으로 재확인됨
  - 위치: `codebase/backend/src/modules/users/users-avatar.service.spec.ts`
    (`'업로드 자체가 실패하면 DB 도 S3 도 건드리지 않고 전파한다'`) /
    `codebase/backend/src/modules/users/users.service.ts` `updateAvatar`
  - 상세: `updateAvatar` 는 `await this.s3Service.upload(...)` 가 완료된 **뒤에만**
    `this.userRepository.update(userId, { avatarUrl })` 를 호출하는 순차 구조다. S3
    업로드가 예외를 던지면 그 아래 코드는 실행되지 않으므로 DB 는 전혀 건드려지지 않고
    옛 객체 삭제도 시도되지 않는다 — 명시적 트랜잭션이나 try/catch 롤백 없이도 "전부
    성공 아니면 전부 안 함" 이 자연스럽게 성립하는 구조다. 신규 테스트가 `s3.upload`
    를 `mockRejectedValue` 로 실패시켜 `savedPatch`(update 인자) 가 `undefined`,
    `s3.delete` 미호출을 단언해 이 불변식을 회귀로부터 고정했다.
  - 제안: 없음.

## 그 외 점검 결과 (직전 라운드와 동일, 재확인)

- **인덱스**: 이번 라운드에서 추가된 쿼리 없음. `updateAvatar`/`incrementLoginAttempts`
  모두 PK(`id`) 기준 조회·갱신만 사용해 인덱스 누락 우려가 없다.
- **N+1 쿼리**: 반복문 내 개별 쿼리 패턴 없음. `updateAvatar` 는 요청당 SELECT 1 + UPDATE 1
  + (병렬) SELECT 1 로 고정 횟수다.
- **트랜잭션**: `updateAvatar` 는 컬럼 단위 `update()` 로 lost-update 를 원천 차단하고,
  `incrementLoginAttempts` 는 파라미터화된 단일 원자 `UPDATE ... RETURNING` 이다. 둘 다
  명시적 `@Transaction` 없이도 정합성이 성립하는 구조이며 이번 라운드 변경이 그 구조를
  깨지 않았다.
- **마이그레이션 안전성**: 이번 브랜치는 `git diff origin/main...HEAD` 기준 마이그레이션
  파일/엔티티 컬럼 변경이 없다(`avatar_url` 컬럼은 기존 스키마 재사용). DDL 변경이
  없으므로 무중단 배포 lock 위험이 없다.
- **스키마 설계**: 신규 테이블/컬럼 없음. `User` 는 워크스페이스 종속 리소스가 아니므로
  아바타 키 레이아웃(`avatars/{userId}/{uuid}.{ext}`)에 `workspaceId` 가 없는 것도
  설계와 일치한다.
- **커넥션 관리**: 모든 DB 접근이 NestJS `@InjectRepository(User)` 로 주입된 TypeORM
  `Repository`(및 매니저 `query()`)를 통한다 — 수동 커넥션 획득/해제 없음.
- **SQL 인젝션**: `incrementLoginAttempts` 의 raw SQL 은 `$1`/`$2`/`$3` 전부 파라미터
  바인딩이고 문자열 결합이 없다. 나머지는 TypeORM Repository/QueryBuilder API 사용.
- **대량 데이터**: 전부 단일 사용자 row 대상 CRUD 이며 목록 조회·페이지네이션과 무관하다.

## 요약

이번 라운드(01_37_27)는 이전 DB 리뷰(`review/code/2026/09/01/01_19_27/database.md`, LOW)
이후 이 브랜치에 실제로 추가된 코드 변경을 `git show 9b1ba58ae` 로 직접 대조한 결과,
프로덕션 로직 변경은 전혀 없고 (1) `isLocked()` 의 쓰기/읽기 시계 비대칭을 알리는 JSDoc,
(2) S3 업로드 실패 시 DB/S3 모두 건드리지 않음을 고정하는 테스트 1건만 추가됐다. 두
변경 모두 기존에 이미 성립하던 동작을 문서화·고정하는 것이라 새로운 DB 결함이 없으며,
시계 비대칭은 데이터 정합성이 아니라 판정 오차(초 단위, NTP 동기 환경)로 범위가 좁고
근거·재개 조건이 명시돼 있다. 이번 아바타 업로드 기능 전체를 다시 훑어도 신규 마이그레이션
없음, 컬럼 단위 UPDATE 로 lost-update 차단, `incrementLoginAttempts` 의 파라미터화된 원자
`UPDATE ... RETURNING`, N+1·인덱스·커넥션 관리·SQL 인젝션 어느 항목에서도 결함이 없다.

## 위험도

LOW
