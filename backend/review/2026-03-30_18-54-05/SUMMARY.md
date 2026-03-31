# Code Review 통합 보고서

## 전체 위험도
**HIGH** — SQL 마이그레이션이 트랜잭션 블록 제한으로 배포 실패를 유발하며, 인증 가드 누락과 부적절한 오류 응답이 복합적으로 발견됨

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | `ALTER TYPE ... ADD VALUE`는 트랜잭션 블록 내 실행 불가. Flyway 등 마이그레이션 도구는 기본적으로 DDL을 트랜잭션으로 감싸므로 `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`으로 배포 실패 | `V003__add_trigger_category.sql:2` | `-- flyway:nonTransactional` 주석 추가 + `IF NOT EXISTS` 적용: `ALTER TYPE node_category ADD VALUE IF NOT EXISTS 'trigger' BEFORE 'logic';` |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / API | `@UseGuards(JwtAuthGuard)` 명시적 선언 부재. 글로벌 가드가 없다면 인증 없이 엔드포인트 접근 가능하며, `payload`가 `undefined`가 되어 `payload.sub` 참조 시 런타임 오류 발생 | `users.controller.ts:10-11` | 컨트롤러 또는 메서드 레벨에 `@UseGuards(JwtAuthGuard)` 명시적 추가. 전역 적용 시 주석으로 의도 명시 |
| 2 | API Contract | 사용자 미발견 시 `{ data: null }` + HTTP 200 반환. 삭제된 계정으로 유효한 JWT를 가진 사용자가 오류 없이 통과되며, REST 관례 위반 | `users.controller.ts:14-16` | `throw new NotFoundException('User not found')` 사용 |
| 3 | Database | `IF NOT EXISTS` 없어 멱등성 미보장. 이미 `'trigger'` 값이 존재하는 환경에서 재실행 시 `ERROR: enum label "trigger" already exists` 오류 발생 | `V003__add_trigger_category.sql:2` | `ADD VALUE IF NOT EXISTS` 로 변경 (PostgreSQL 9.3+) |
| 4 | Architecture | 컨트롤러가 응답 직렬화(필드 선택) 책임을 직접 담당. 프레젠테이션 레이어에 데이터 변환 책임이 포함되어 SRP 위반 | `users.controller.ts:13-24` | `UserProfileDto` 정의 후 서비스/mapper에서 변환하거나 `class-transformer` 활용 |
| 5 | Testing | SQL 마이그레이션에 대한 통합 테스트 없음. `trigger` 카테고리 노드 생성/조회 흐름 검증 불가 | `V003__add_trigger_category.sql` | `execution-engine` 또는 워크플로우 관련 테스트에 `trigger` 카테고리 노드 포함 테스트 케이스 추가 |
| 6 | Testing | 인증 가드 미적용 시나리오(401 Unauthorized) 테스트 누락. 미인증 요청에 대한 동작 미검증 | `users.controller.spec.ts` | 가드 mock 처리 및 인증 실패 케이스 테스트 추가 |
| 7 | Testing | `UsersService.findById` 예외 발생 시 컨트롤러 동작 미검증. 현재 구현에 예외 처리 로직 없어 500 에러 노출 가능 | `users.controller.spec.ts` | `mockRejectedValue(new Error('DB error'))` 케이스 추가 |
| 8 | Documentation | `GET /users/me` 엔드포인트에 Swagger 데코레이터(`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse`) 누락. 인증 요구사항이 API 문서에 드러나지 않음 | `users.controller.ts:11-24` | `@ApiTags('users')`, `@ApiBearerAuth()`, `@ApiOperation`, `@ApiResponse` 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | PostgreSQL enum 값은 추가 후 삭제 불가. 롤백 시나리오에서 `'trigger'` 값이 DB에 잔존 | `V003__add_trigger_category.sql` | 다운 마이그레이션 스크립트에 enum 값 제거 불가 사실 문서화. 장기적으로 `VARCHAR` + check constraint 또는 참조 테이블 방식 검토 |
| 2 | Database | `BEFORE 'logic'` 순서 지정은 enum 비교 연산자(`<`, `>`)에 영향. 순서 기반 비교 코드가 있다면 영향 가능 | `V003__add_trigger_category.sql:2` | `node_category` enum에 순서 비교를 사용하는 코드 확인 |
| 3 | Performance | `GET /users/me`는 고빈도 엔드포인트이나 매 요청마다 전체 user row DB 조회 발생. 불필요한 민감 필드 포함 데이터 전송 | `users.controller.ts:12-22` | `findById`에서 필요한 필드만 SELECT 프로젝션 적용 또는 `findProfileById` 메서드 추가. Redis TTL 캐시(`user:{id}`, TTL 60s) 적용 검토 |
| 4 | Testing | `mockUser as never` 타입 캐스팅으로 타입 안전성 우회 | `users.controller.spec.ts:56` | `import type { User }` 후 `mockResolvedValue(mockUser as User)` 로 명시적 타입 사용 |
| 5 | Testing | 민감 필드(`passwordHash`, `twoFactorSecret` 등) 제외 검증 테스트에 명시적 assertion 부재 | `users.controller.spec.ts:60-70` | `expect(result.data).not.toHaveProperty('passwordHash')` 등 명시적 assertion 추가 |
| 6 | Maintainability | 테스트 `mockUser`에 컨트롤러와 무관한 내부 필드 과다 포함으로 테스트 의도 파악 어려움 | `users.controller.spec.ts:8-29` | 컨트롤러가 실제 사용하는 필드만 포함한 최소 목업 사용 |
| 7 | Maintainability | `mockUser` 객체가 모듈 수준에서 생성되어 날짜 값이 테스트 실행 시점에 고정. 날짜 기반 검증 추가 시 불안정한 테스트 원인 가능 | `users.controller.spec.ts:20-21` | `beforeEach` 내부로 이동하거나 고정 날짜(`new Date('2024-01-01')`) 사용 |
| 8 | API Contract | 응답 `{ data: ... }` 래퍼 구조의 다른 엔드포인트와의 일관성 확인 필요 | `users.controller.ts:17-25` | 전역 인터셉터(TransformInterceptor)로 응답 형식 통일 권장 |
| 9 | Architecture | `users.module.ts`에 `UsersController` 등록 여부 직접 확인 불가 | `users.controller.ts` (신규 파일) | 모듈 파일에서 `controllers` 배열 등록 확인 |
| 10 | Requirement | `user.locale`, `user.theme`가 DB에서 null일 경우 그대로 반환. 스펙상 기본값 존재 시 미처리 | `users.controller.ts:18-21` | 스펙 확인 후 필요시 `locale: user.locale ?? 'ko'` 형태로 기본값 보장 |
| 11 | Documentation | `GET /users/me` 엔드포인트가 `spec/` API 스펙 문서에 반영되었는지 확인 필요 | 프로젝트 수준 | `spec/` 경로 API 스펙 문서에 해당 엔드포인트 명세 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| database | HIGH | `ALTER TYPE ADD VALUE` 트랜잭션 블록 실행 불가 — 배포 실패 위험 |
| api_contract | MEDIUM | 인증 가드 미선언, user not found 시 200 반환 |
| requirement | MEDIUM | 인증 가드 누락, 404 미반환 |
| testing | MEDIUM | 인증/예외/마이그레이션 테스트 누락 |
| side_effect | MEDIUM | SQL 마이그레이션 트랜잭션 제한 부작용 |
| architecture | LOW | 컨트롤러의 직렬화 책임 혼재, NotFoundException 미사용 |
| documentation | LOW | Swagger 데코레이터 누락 |
| maintainability | LOW | 응답 직렬화 로직 결합, 과도한 test mock |
| performance | LOW | 고빈도 엔드포인트 캐싱 부재, SELECT 프로젝션 최적화 가능 |
| security | LOW | 인증 가드 명시성 부재, 200+null 반환 |
| dependency | LOW | 인증 가드 의존 관계 미선언 |
| scope | LOW | 인증 가드 명시적 선언 여부 확인 필요 |
| concurrency | NONE | 동시성 이슈 없음 |

---

## 발견 없는 에이전트

- **concurrency** — 동시성/병렬 처리 이슈 없음 (stateless 읽기 전용 엔드포인트, 단일 DDL)

---

## 권장 조치사항

1. **[즉시 필수]** `V003__add_trigger_category.sql`에 `-- flyway:nonTransactional` 추가 및 `IF NOT EXISTS` 적용 — 미조치 시 배포 실패
2. **[필수]** `UsersController`에 `@UseGuards(JwtAuthGuard)` 명시적 선언 추가 — 인증 우회 가능성 차단
3. **[필수]** user not found 시 `throw new NotFoundException('User not found')` 적용 — REST 관례 준수 및 보안 강화
4. **[필수]** 인증 실패(401), 서비스 예외 전파 테스트 케이스 추가 — 프로덕션 동작 검증 보완
5. **[권장]** `trigger` 카테고리 노드를 포함한 통합 테스트 추가 — 마이그레이션 효과 검증
6. **[권장]** `UserProfileDto` 도입으로 컨트롤러 직렬화 책임 분리
7. **[권장]** Swagger 데코레이터(`@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse`) 추가
8. **[선택]** `findById` SELECT 프로젝션 최적화 및 단기 캐싱 적용 — 고빈도 엔드포인트 성능 개선
9. **[선택]** `spec/` 문서에 `GET /users/me` 엔드포인트 명세 반영