파일 쓰기 권한이 필요합니다. 권한을 허용해 주시면 `review/2026-03-30_17-32-45/SUMMARY.md`에 통합 보고서를 저장하겠습니다.

그 전에 분석 결과를 먼저 공유드리겠습니다.

---

# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `AuthService`의 레이어 경계 위반(워크스페이스 생성 로직 중복)과 `findOrCreatePersonalWorkspace`의 TOCTOU 경쟁 조건이 운영 환경에서 데이터 정합성 문제를 야기할 수 있음

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/의존성 | `AuthService`가 `DataSource` 직접 주입 후 `Workspace`, `WorkspaceMember` 엔티티를 직접 조작. `WorkspacesService.createPersonalWorkspace()`와 동일한 로직이 두 곳에 중복 구현 (SRP 위반, 레이어 경계 붕괴) | `auth.service.ts` L93–122 | `WorkspacesService.createPersonalWorkspace()`에 `manager?: EntityManager` 파라미터 추가하여 트랜잭션 컨텍스트 위임. `AuthService`에서 엔티티 직접 import 제거 |
| 2 | 동시성 | `findOrCreatePersonalWorkspace`의 TOCTOU 경쟁 조건. 조회 후 생성 사이 동시 요청 시 중복 워크스페이스 생성 가능. DB 유니크 제약 없으면 실제 중복 저장됨 | `workspaces.service.ts` L55–64 | DB 레벨 `(ownerId, type)` 복합 유니크 제약 추가 후 upsert 패턴 적용 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 데이터 정합성 | 트랜잭션 완료 후 `generateTokens` 실패 시 이메일은 인증됐으나 토큰 미발급 상태. 재시도 시 토큰이 이미 null로 업데이트되어 `verifyEmail` 재시도 불가 | `auth.service.ts` `verifyEmail()` L107–127 | refresh token 저장도 동일 트랜잭션에 포함하거나 재로그인 유도 경로 제공 |
| 2 | 부작용 | `generateTokens`가 `findOrCreatePersonalWorkspace`를 호출하여 토큰 생성에 워크스페이스 생성 부수 효과 내포. `refresh()` 흐름에서도 실행되어 삭제된 사용자 워크스페이스 자동 재생성 가능 | `auth.service.ts` `generateTokens()` L307–318 | `generateTokens`는 워크스페이스 ID를 파라미터로 전달받도록 변경, `findOrCreatePersonalWorkspace`는 `login`/`verifyEmail` 호출 지점에서 명시적 처리 |
| 3 | 데이터 정합성 | `verifyEmail` 트랜잭션 내 이미 인증된 사용자(`emailVerified: true`) 및 기존 워크스페이스 존재 여부 확인 로직 없음 | `auth.service.ts` `verifyEmail()` 트랜잭션 블록 | 트랜잭션 전 이미 인증된 사용자 조기 반환 처리 추가 |
| 4 | 동시성/DB | `createPersonalWorkspace`가 트랜잭션 없이 workspace → member 순차 저장. 중간 실패 시 멤버 없는 고아 워크스페이스 생성 | `workspaces.service.ts` `createPersonalWorkspace()` L17–46 | `createPersonalWorkspace` 내부를 트랜잭션으로 래핑 |
| 5 | 보안 | 이메일 인증/비밀번호 재설정 토큰을 `console.log`로 출력. 환경 구분 없이 프로덕션 로그에 민감 토큰 평문 노출 가능 | `auth.service.ts` L63–65, L255–256 | `NODE_ENV !== 'production'` 조건으로 감싸거나 mailer service로 교체 |
| 6 | 보안 | slug가 `localPart-XXXX` (4자리 hex, 65,536가지)로 생성되어 엔트로피 부족. 이메일 주소를 아는 공격자의 열거 가능 | `auth.service.ts` L112–113, `workspaces.service.ts` L24–25 | suffix를 8자리 이상으로 확장 |
| 7 | 테스트 | 트랜잭션 내부 동작 검증 부족. `getRepository`가 모든 엔티티에 동일한 mock 반환하여 엔티티별 검증 불가. User 업데이트/Workspace 생성/WorkspaceMember 생성 assertion 없음 | `auth.service.spec.ts` `mockDataSource` L101–125 | 엔티티 타입별 다른 mock 반환, 각 레포지토리 메서드 호출 assertion 추가 |
| 8 | 테스트 | 이미 인증된 사용자 재시도 케이스, `findOrCreatePersonalWorkspace` 실패 케이스 미커버 | `auth.service.spec.ts` | 해당 시나리오 테스트 추가 |
| 9 | 보안/정합성 | `generateTokens(userByToken)` 호출 시 stale 객체 전달. 트랜잭션에서 업데이트된 `emailVerified` 최신 상태 미반영 | `auth.service.ts` `verifyEmail()` → `generateTokens()` | 트랜잭션 완료 후 DB 재조회 또는 트랜잭션 내부에서 최신 객체 반환 |
| 10 | 성능 | `generateTokens` 매 호출마다 `findPersonalWorkspace` + `getMemberRole` 최소 2회 DB 조회 | `auth.service.ts` `generateTokens()` | 기존 토큰 payload 활용 또는 캐싱 레이어 고려 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | DB 인덱스 | `findPersonalWorkspace` 쿼리에 `(ownerId, type)` 복합 인덱스 부재 | `workspaces.service.ts` | CRITICAL의 유니크 제약으로 동시 해결 가능 |
| 2 | DB 인덱스 | `getMemberRole` 쿼리에 `(workspaceId, userId)` 복합 인덱스 부재 | `workspaces.service.ts` | `WorkspaceMember` 엔티티에 복합 유니크 인덱스 추가 |
| 3 | 타입 안전성 | `null as unknown as string` 이중 캐스팅으로 nullable 필드 타입 우회 | `auth.service.ts` L100–101, L275–276 | `User` 엔티티의 토큰 필드를 `string \| null`로 수정 |
| 4 | 테스트 품질 | `jest.spyOn(service as never, 'findUserByVerifyToken' as never)` private 메서드 직접 spy — 리팩토링 시 타입 오류 없이 조용히 깨질 위험 | `auth.service.spec.ts` L349, L368, L381 | `protected`로 변경하거나 repository mock으로 간접 제어 |
| 5 | 테스트 품질 | `as never` 타입 단언 남용 | `auth.service.spec.ts` L342, L343 | `as Partial<Workspace>` 사용 |
| 6 | 성능(테스트) | `bcrypt.hash('Test123!@#', 12)` 각 테스트마다 반복 호출로 CI 속도 저하 | `auth.service.spec.ts` | `beforeAll` 한 번 생성 또는 rounds=1 또는 mock |
| 7 | 성능 | `verifyEmail` 후 `generateTokens`에서 방금 생성한 워크스페이스를 재조회 (불필요한 2 쿼리) | `auth.service.ts` L117 | 생성된 워크스페이스 정보를 직접 전달 |
| 8 | 문서화 | `findOrCreatePersonalWorkspace` JSDoc 없음, `generateTokens` 동작 변경 주석 미반영 | `workspaces.service.ts` L54–63 | 메서드 역할 및 idempotent 특성 주석 추가 |
| 9 | 문서화 | TODO 주석에 이슈 트래킹 연결 없음 | `auth.service.ts` L67, L268 | 이슈 번호 참조 추가 |
| 10 | 테스트 품질 | `createPersonalWorkspace` slug 형식 및 엣지 케이스 검증 없음 | `workspaces.service.spec.ts` | slug 패턴 assertion 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | HIGH | TOCTOU 경쟁 조건, `createPersonalWorkspace` 비원자성 |
| architecture | HIGH | `AuthService` 레이어 경계 붕괴, `generateTokens` 부수 효과 |
| api_contract | MEDIUM | 서비스 계층 책임 침범, 이중 접근 구조 |
| database | MEDIUM | 트랜잭션 경계 불일치, 정합성 문제, 인덱스 부재 |
| side_effect | MEDIUM | `generateTokens` 부수 효과, 트랜잭션 범위 불일치 |
| requirement | MEDIUM | 재인증 처리 누락, TOCTOU |
| performance | MEDIUM | 반복 DB 조회, 불필요한 재조회 |
| dependency | MEDIUM | 모듈 경계 위반, 로직 중복 |
| security | MEDIUM | 토큰 프로덕션 노출, slug 엔트로피 부족 |
| scope | MEDIUM | 엔티티 직접 접근, 로직 이중화 |
| testing | MEDIUM | 트랜잭션 검증 부족, 엣지 케이스 미커버 |
| maintainability | MEDIUM | 로직 중복, `as never` 남용 |
| documentation | LOW | JSDoc 부재, 변경 주석 미반영 |

---

## 권장 조치사항 (우선순위 순)

1. **[CRITICAL]** `WorkspacesService.createPersonalWorkspace()`에 `manager?: EntityManager` 추가 → `AuthService`에서 위임 처리, 엔티티 직접 import 및 `DataSource` 직접 주입 제거
2. **[CRITICAL]** `Workspace(ownerId, type)` 복합 유니크 DB 제약 추가 + `findOrCreatePersonalWorkspace` upsert 패턴 전환, `WorkspaceMember(workspaceId, userId)` 유니크 인덱스 추가
3. **[WARNING]** `generateTokens`에서 워크스페이스 생성 부수 효과 제거 — 워크스페이스 ID를 파라미터로 전달받도록 변경
4. **[WARNING]** `verifyEmail` 트랜잭션 범위 확장 (refresh token 저장 포함) 및 stale 객체 문제 해결, 이미 인증된 사용자 처리 추가
5. **[WARNING]** `createPersonalWorkspace` 트랜잭션으로 래핑 (고아 워크스페이스 방지)
6. **[WARNING]** `console.log` 토큰 출력을 `NODE_ENV !== 'production'` 조건부 처리
7. **[WARNING]** 테스트 개선 — 엔티티별 mock 분리, 엣지 케이스 테스트 추가
8. **[INFO]** slug suffix 8자리 이상 확장, `User` 엔티티 nullable 필드 타입 수정