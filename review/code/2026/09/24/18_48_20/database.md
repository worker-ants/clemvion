# 데이터베이스(Database) 리뷰

## 발견사항

해당 없음.

이번 라운드(2회차, `18_48_20`)의 변경 대상은 32개 파일로 구성되지만, 실제 애플리케이션/스키마 코드는 단 1줄이다 — `codebase/backend/package.json:44` 의 `@nestjs/typeorm` 캐럿을 `^11.0.3` → `^12.0.1` 로 올린 것과, 그에 따른 `pnpm-lock.yaml` 재계산(및 lockfile 최소화)뿐이다. 나머지는 전부 `PROJECT.md`·`plan/in-progress/*.md`(계획 문서) 와 1라운드 리뷰(`review/code/2026/09/24/18_22_23/**`) · consistency-check(`review/consistency/2026/09/24/17_31_27/**`) 산출물이다.

- `pnpm-lock.yaml` 확인 결과 실제 DB 드라이버/ORM 코어인 `typeorm` 은 `0.3.31` 로 **변경되지 않았고**, peer 인 `@nestjs/common`/`@nestjs/core` 도 `11.1.27` 로 그대로다. 바뀐 것은 NestJS DI 래퍼 모듈(`@nestjs/typeorm`)뿐이며, 이 래퍼가 노출하는 `TypeOrmModule.forRoot`/`forFeature`, `@InjectRepository` 등을 실제로 사용하는 설정·엔티티·마이그레이션·리포지토리·쿼리 빌더 호출부는 이번 diff 에 전혀 포함되어 있지 않다.
- 따라서 점검 관점 1(인덱스)·2(N+1)·3(트랜잭션)·5(스키마 설계)·7(SQL 인젝션)·8(대량 데이터/페이지네이션) 은 검토할 대상 코드 자체가 없다.
- 관점 4(마이그레이션 안전성)도 해당 없음 — 스키마 변경(`migrations/*`) 파일이 diff 에 없다.
- 관점 6(커넥션 관리)에 대해서만 메이저 버전 범프라는 이론적 리스크가 있으나, `plan/in-progress/deps-typeorm12.md` 가 e2e 380 PASS(부팅·런타임 경로 포함) 및 1라운드 리뷰의 독립 재현(`review/code/2026/09/24/18_22_23/testing.md` 등)으로 뒷받침하고 있어 커넥션 라이프사이클 회귀 징후는 없다. 다만 이는 plan 문서·1라운드 산출물의 서술을 인용한 것이며, 이번 DB 리뷰가 별도로 커넥션 풀 동작을 직접 실측한 것은 아니다.
- 신규로 추가된 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `libc:` lockfile 진동 항목은 pnpm 네이티브 optional 패키지 메타데이터에 관한 것으로 DB 관점과 무관하다.
- 1라운드 DB 리뷰(`review/code/2026/09/24/18_22_23/database.md`)도 동일한 결론(NONE)을 냈고, 이번 diff 는 그 결론을 뒤집을 새로운 DB 관련 코드를 추가하지 않았다.

뮤테이션 검증: 불필요(수정 대상 DB 코드 없음). 저장소 파일에 어떤 쓰기도 하지 않았다 — `git status --short` 재확인 결과 이 리뷰 세션 자신의 산출물 외 잔존 변경 없음.

## 요약

이번 변경은 `@nestjs/typeorm` 패키지의 메이저 버전 범프(`^11.0.3` → `^12.0.1`) 한 줄과 그에 따른 lockfile 재계산, 계획 문서·리뷰 산출물로만 구성된다. 실제 DB 드라이버(`typeorm@0.3.31`)와 이를 소비하는 엔티티·마이그레이션·리포지토리·쿼리 코드는 전혀 변경되지 않았으므로 인덱스·N+1·트랜잭션·마이그레이션 안전성·스키마 설계·SQL 인젝션·대량 데이터 페이지네이션 관점에서 검토할 대상이 없다. 커넥션 라이프사이클에 대한 이론적 리스크는 plan 문서의 e2e 검증(380 PASS)으로 뒷받침되나 이번 리뷰가 직접 실측한 것은 아니다.

## 위험도

NONE
