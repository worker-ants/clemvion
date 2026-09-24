# 데이터베이스(Database) 리뷰

## 검토 범위 확인

본 변경 세트(75개 파일)는 다음 범주로 구성된다.

- `PROJECT.md`, `codebase/backend/jest.config.ts`, `codebase/backend/package.json`,
  `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts`,
  `codebase/backend/test/jest-e2e.json`: Jest 를 `node --experimental-vm-modules` 로 구동해
  ESM 전용 패키지(`uuid`, `@nestjs/typeorm@12` 등)를 네이티브 로드하도록 바꾸는 CI/테스트
  하니스 변경.
- `plan/in-progress/jest-esm-native-load.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`,
  `plan/in-progress/spec-draft-nullable-notation-followups.md`: 위 작업 및 후속 NestJS 12
  업그레이드 계획 문서.
- `review/code/**`, `review/consistency/**` 하위 다수 파일: 이전 라운드 코드 리뷰·일관성
  검토 산출물(SUMMARY, RESOLUTION, 각 관점별 리포트 md, meta.json, `_retry_state.json` 등).
  이 중 `database.md` 로 명명된 파일들도 포함되어 있으나, 이는 **과거 라운드의 DB 리뷰
  결과 문서**(review 산출물)이지 실제 데이터베이스 스키마·쿼리·엔티티 코드가 아니다.

실제 소스 코드 변경은 전부 Jest 실행 방식(트랜스폼/ESM 로딩) 과 테스트 스크립트에 국한되며,
엔티티, 마이그레이션, 리포지토리, 쿼리 빌더, 트랜잭션, 커넥션 풀 설정 등 데이터베이스
계층 코드는 diff 에 존재하지 않는다. `esm-native-load.spec.ts` 도 ESM/CJS 모듈 로딩 가능
여부를 검증하는 테스트이며 DB I/O 를 다루지 않는다.

따라서 인덱스, N+1, 트랜잭션, 마이그레이션 안전성, 스키마 설계, 커넥션 관리, SQL 인젝션,
대량 데이터 페이지네이션 등 8개 점검 관점 모두 해당 변경분에 적용할 대상이 없다.

## 요약

이번 변경은 Jest 를 `--experimental-vm-modules` 로 구동해 ESM 전용 패키지(특히
`@nestjs/typeorm@12`)를 네이티브 로드하도록 하는 CI/테스트 하니스 개선과 그에 따른 계획
문서·리뷰 산출물 갱신으로, 데이터베이스 스키마·쿼리·트랜잭션·마이그레이션 등 DB 계층 코드
변경이 전혀 포함되어 있지 않다. 데이터베이스 관점에서 검토할 대상이 없다.

## 위험도

NONE
