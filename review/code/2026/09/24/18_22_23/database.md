# 데이터베이스(Database) 리뷰

## 발견사항

해당 없음.

이번 변경은 `@nestjs/typeorm` 패키지를 `^11.0.3` → `^12.0.1` 로 올리는 의존성 버전 범프
(`codebase/backend/package.json:44`, `pnpm-lock.yaml`)와 두 개의 계획 문서
(`plan/in-progress/deps-typeorm12.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`),
그리고 consistency-check 산출물(`review/consistency/2026/09/24/17_31_27/*`)로 구성된다.

- `pnpm-lock.yaml` 확인 결과 실제 DB 드라이버/ORM 코어인 `typeorm` 은 `0.3.31` 로 **변경되지 않았고**,
  peer 인 `@nestjs/common` 도 `11.1.27` 로 그대로다 — 바뀐 것은 NestJS 래퍼 모듈(`@nestjs/typeorm`)
  뿐이며, 이 래퍼가 노출하는 `TypeOrmModule.forRoot`/`forFeature` 등 API·커넥션 옵션을 실제로 사용하는
  코드(예: `TypeOrmModule.forRootAsync` 설정, entity, migration, repository, query builder 호출부)는
  이번 diff 에 포함되어 있지 않다.
- 엔티티/마이그레이션/리포지토리/쿼리 파일 변경 없음 → 인덱스, N+1, 트랜잭션, 마이그레이션 안전성,
  스키마 설계, SQL 인젝션, 페이지네이션 관점에서 검토할 대상 코드가 없다.
- 커넥션 관리(관점 6)와 관련해서는, 메이저 버전 범프이므로 이론적으로 `@nestjs/typeorm` 의
  모듈 라이프사이클(`onModuleDestroy`/connection teardown 등) 동작 변경 가능성이 있으나, 해당 설정
  파일이 이번 diff 범위 밖이라 이 리뷰에서 직접 확인할 대상이 없다. 다만 plan 문서(`deps-typeorm12.md`)
  가 backend unit 473스위트/9950(불변)·build(Docker 포함) PASS·e2e 380 PASS 를 검증 완료로 기록해
  두었고, DB 레이어를 실제로 구동하는 e2e 가 통과했다는 점은 커넥션 초기화/해제 관점에서도 참고할
  만한 근거다 — 다만 이는 DB reviewer 가 직접 실측한 것이 아니라 plan 문서의 서술을 그대로 인용한
  것임을 밝힌다.

뮤테이션 검증: 불필요(수정 대상 DB 코드 없음). 저장소 파일에 어떤 쓰기도 하지 않았다
(`git status --short` 실행 안 함 — 애초에 아무것도 건드리지 않았다).

## 요약

이번 변경 범위(`codebase/backend/package.json`·`pnpm-lock.yaml`·계획 문서 2건·consistency 산출물)에는
데이터베이스 스키마·쿼리·트랜잭션·마이그레이션·커넥션 설정 코드가 전혀 포함되어 있지 않다. `typeorm`
코어 버전은 그대로이고 `@nestjs/typeorm` 래퍼만 메이저 범프되었으며, 이 래퍼를 사용하는 설정/코드
파일은 diff 에 없어 DB 관점의 실질적 검토 대상이 없다.

## 위험도

NONE
