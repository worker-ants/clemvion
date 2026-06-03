# Code Review 통합 보고서

대상: `interactionAllowedOrigins` 워크스페이스 설정 API/UI (PATCH/GET `/api/workspaces/:id/settings` + 프론트엔드 `EmbedOriginsCard`)
생성: 2026-06-03

---

## 전체 위험도

**HIGH** — CRITICAL 2건(요구사항 reviewer), WARNING 다수(보안·성능·아키텍처·DB·동시성·API 계약·문서). 핵심 기능 동작 자체는 의도에 부합하나, personal 워크스페이스 type 가드 누락과 DTO 방어 코드 부재가 즉각 수정이 필요한 결함이다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| C1 | 요구사항 | `interactionAllowedOrigins` 필드에 `@IsOptional()` 없고 방어 코드 부재 — ValidationPipe 우회 환경 또는 미래 누락 상황에서 `undefined.map` TypeError 발생 가능 | `update-workspace-settings.dto.ts` 전체, `workspaces.service.ts updateWorkspaceSettings()` | 서비스에서 `const origins = dto.interactionAllowedOrigins ?? [];` 방어 코드 추가, 또는 DTO에 `@Transform` null-safe 처리 |
| C2 | 요구사항 | `updateWorkspaceSettings`에 personal 워크스페이스 type 가드 부재 — 기존 `deleteWorkspace`, `leaveWorkspace` 등 모두 `workspace.type === 'personal'` 체크를 수행하나 신규 메서드는 미검사, 개인 워크스페이스 owner가 settings를 설정 가능한 상태 | `workspaces.service.ts updateWorkspaceSettings()` | workspace 조회 후 `if (workspace.type === 'personal')` 체크 추가 및 `CANNOT_MODIFY_PERSONAL_SETTINGS` 등 에러 반환, 혹은 허용 의도 시 주석으로 명시 + spec 확인 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 보안 | Origin 정규식 `[^/\s?#]+`이 와일드카드(`*`)·비정상 포트 허용 — DB에 의미 없는 값 저장 가능, 관리자 혼란 유발(실제 CORS 차단에는 영향 없음) | `update-workspace-settings.dto.ts` L47 `@Matches` | 와일드카드 명시 차단 정규식으로 강화, 포트 범위 검증(1-65535) 추가 고려 |
| W2 | 보안 / 문서 | DTO `@ApiProperty` description "빈 배열은 모든 origin 차단을 의미합니다"가 실제 CORS 동작(위젯 CDN 항상 허용)과 불일치 — Swagger를 통해 외부 통합 개발자가 오해 가능 | `update-workspace-settings.dto.ts` `@ApiProperty description` | "빈 배열 = 추가 origin 없음(위젯 CDN은 항상 허용됨)" 으로 수정 |
| W3 | 성능 | `updateWorkspaceSettings`·`getWorkspaceSettings` 모두 assertAdmin/getMemberRole → findOne 직렬 2-쿼리 패턴 — 단일 요청당 최소 2회 DB 왕복 | `workspaces.service.ts` | TypeORM JOIN 또는 `relations: ['members']`로 단일 쿼리화, 후속 리팩터링으로 처리 가능 |
| W4 | 성능 / 부작용 | `EmbedOriginsCard` key 기반 remount 전략 + `invalidateQueries` 조합 — 저장 성공 후 isSuccess가 `loaded → pending → loaded` 사이클로 에디터가 두 번 remount, 단기 빈 목록 렌더 가능 | `workspace/settings/page.tsx EmbedOriginsCard` | `invalidateQueries` 대신 `queryClient.setQueryData`로 직접 갱신, 또는 key 계산을 `settingsQuery.data !== undefined` 조건으로 안정화 |
| W5 | 아키텍처 | 컨트롤러 `updateSettings()`가 `WorkspaceDto`를 거치지 않고 엔티티 필드를 인라인 리터럴로 직접 선택 반환 — Swagger `@ApiOkWrappedResponse(WorkspaceDto)` 선언과 실제 응답 shape 불일치 (`settings` 필드 포함되나 스키마에 없음) | `workspaces.controller.ts updateSettings()` L133-141 | `WorkspaceWithSettingsDto` 또는 기존 `WorkspaceDto`에 `settings` 추가, Swagger 선언과 실제 응답 shape 일치 |
| W6 | 아키텍처 / API계약 | `GET :id/settings` Swagger에 요청 DTO `UpdateWorkspaceSettingsDto`를 응답 스키마로 재사용 — 입출력 계약 혼재, 향후 필드 분기 시 즉각 불일치 | `workspaces.controller.ts getSettings()` `@ApiOkWrappedResponse` | 전용 `WorkspaceSettingsResponseDto` 신설 후 적용 |
| W7 | 요구사항 / API계약 | `ADMIN_REQUIRED` 에러 코드가 `spec/5-system/3-error-handling.md §1.2` 공식 카탈로그에 미등재된 채 API 계약에 포함 — 외부 클라이언트 통합 시 예측 가능성 저하 | `workspaces.service.ts assertAdmin()`, e2e 테스트 | spec 에러 카탈로그에 `ADMIN_REQUIRED` 공식 등재 (project-planner 위임) |
| W8 | 요구사항 | `EmbedOriginsCard` JSDoc "별도의 GET 엔드포인트도 (아직) 없으므로 빈 목록에서 시작" 주석이 실제 구현(useQuery로 getSettings 호출)과 불일치 | `workspace/settings/page.tsx EmbedOriginsCard` JSDoc | JSDoc을 실제 구현에 맞게 업데이트 |
| W9 | 요구사항 | Spec fidelity — `spec/2-navigation/9-user-profile.md §6.1` API 표에 신규 엔드포인트 2개 미등재 (SDD 원칙 위반) | `spec/2-navigation/9-user-profile.md §6.1` | `PATCH /api/workspaces/:id/settings`, `GET /api/workspaces/:id/settings` 등재 (project-planner 위임) |
| W10 | 요구사항 | `updateSettings` API 클라이언트 반환 타입 `Promise<void>` — 서버 응답 body 폐기로 저장 후 즉시 서버 정규화 값 반영 불가, 추가 GET 왕복 발생 | `codebase/frontend/src/lib/api/workspaces.ts updateSettings()` | 반환 타입을 workspace shape으로 변경하고 `setQueryData`로 직접 갱신, 또는 현재 void 방식 의도 주석 명시 |
| W11 | 테스트 | DTO `@Matches` 정규식이 trailing slash를 차단하나 서비스 `.replace(/\/$/, '')` 정규화 코드는 trailing slash 허용 전제로 작성 — 서비스 단위 테스트가 DTO 레이어 우회로 실제 불도달 입력을 테스트, 커버리지 과대 표시 | `workspaces.service.ts`, `update-workspace-settings.dto.ts`, `workspaces.service.spec.ts` | DTO 단위 테스트로 trailing slash 차단 여부 명시 확인, 의도가 허용이라면 DTO 정규식 수정 후 일치 |
| W12 | 테스트 | 비멤버의 `updateWorkspaceSettings` 에러 코드(`ADMIN_REQUIRED`) 단위 테스트 미검증 | `workspaces.service.spec.ts` | `memberRepo.findOne.mockResolvedValue(null)` 케이스에 에러 코드 assertion 추가 |
| W13 | 테스트 | `getWorkspaceSettings` WORKSPACE_NOT_FOUND 케이스(멤버이지만 워크스페이스 삭제) 테스트 누락 | `workspaces.service.spec.ts` | `findOne → null` 케이스 테스트 추가 |
| W14 | 테스트 | 컨트롤러 단위 테스트 부재 — `updateSettings`·`getSettings` 응답 shape 및 ParseUUIDPipe 검증 미커버 | `workspaces.controller.ts` | `workspaces.controller.spec.ts`에 신규 케이스 추가 |
| W15 | 동시성 / DB | `updateWorkspaceSettings` read-modify-write 비원자적 패턴 — 두 Admin 동시 편집 시 한 쪽 변경 손실(lost update) 가능, assertAdmin-findOne-save가 단일 트랜잭션 밖에서 실행 | `workspaces.service.ts updateWorkspaceSettings()` | `@Transactional()` 또는 `DataSource.transaction()` 적용, 또는 PostgreSQL `jsonb \|\|` 원자 업데이트 사용 |
| W16 | 문서 | `workspacesApi.updateSettings`·`getSettings` JSDoc 누락 — `Promise<void>` 반환 이유 불명, 부분 교체 의미론 추론 필요 | `codebase/frontend/src/lib/api/workspaces.ts` L906-917 | 최소 한 줄 주석 추가 |
| W17 | 문서 | `web-chat.mdx` Callout "목록이 비어 있으면 도메인 제한을 적용하지 않아요"가 CORS invariant(빈 배열 = CDN만 허용)와 불일치, 임베드 soft 검증 레이어와 CORS 레이어 구분 없이 단순화 | `web-chat.mdx`, `web-chat.en.mdx` | 두 레이어를 구분하여 서술 |
| W18 | 유지보수성 | E2E 테스트 단일 `it` 블록에 6개 이상 독립 시나리오 혼합 — 중간 실패 시 후속 케이스 미실행, 디버깅 어려움 | `workspace-rbac.e2e-spec.ts` G 블록 | `describe('G')` + `beforeAll` 공통 픽스처 후 시나리오별 `it` 분리 |
| W19 | 유지보수성 | `getWorkspaceSettings` 내 `as string[]` 타입 캐스팅 — 런타임 배열 내부 요소의 string 여부 미검증 | `workspaces.service.ts getWorkspaceSettings()` L409 | `WorkspaceSettings` 인터페이스 도입으로 캐스팅 제거, 또는 `filter` 타입 가드 |
| W20 | 유지보수성 | 컨트롤러 `updateSettings` 인라인 필드 매핑 — 엔티티 필드 추가 시 수동 동기화 필요, 누락 위험 | `workspaces.controller.ts` L133-141 | 공통 `toDto()` 헬퍼 또는 `WorkspaceDto` 활용 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | 프론트엔드 클라이언트 사이드 Origin 검증은 UX 목적, 백엔드 DTO가 최종 gate — 현재 구조 적절 | `workspace/settings/page.tsx` L567, L635-645 | 없음 |
| I2 | 보안 | `useHasRole("admin")`이 ROLE_LEVEL >= 비교로 owner 포함 — 보안 결함 아님 | `role-gate.tsx` | 없음 |
| I3 | 보안 | 에러 응답에 민감 정보 노출 없음, UUID 파이프 path injection 방지, ArrayMaxSize/MaxLength DoS 차단, 신규 의존성 없음 | 전체 | 없음 |
| I4 | 아키텍처 | DTO-Service 간 trailing slash 정규화 책임 중복 — DTO 정규식이 차단하면 Service 코드는 dead path | `workspaces.service.ts`, `update-workspace-settings.dto.ts` | DTO 단위 테스트로 trailing slash 차단 확인 후 Service의 `.replace` 제거 |
| I5 | 아키텍처 | `EmbedOriginsCard`/`EmbedOriginsEditor` 분리 방향 적절하나 page.tsx 인라인 정의 | `workspace/settings/page.tsx` | `components/workspace/EmbedOriginsEditor.tsx` 별도 파일 추출 고려 |
| I6 | 아키텍처 | `updateSettings` API 클라이언트 `Promise<void>` — 응답 폐기 설계 결정 명시 부재 | `workspaces.ts updateSettings()` | 주석으로 의도 기록 |
| I7 | 성능 | `origins.includes(value)` O(n) 중복 검사 — ArrayMaxSize(100) 제약으로 실제 비용 무시 가능 | `workspace/settings/page.tsx addOrigin` | 현재 규모에서 변경 불필요 |
| I8 | 성능 | `ORIGIN_PATTERN` 모듈 스코프 상수 — 렌더마다 재생성 없음, 정상 | `workspace/settings/page.tsx` L567 | 없음 |
| I9 | 성능 | `getSettings` HTTP Cache-Control 헤더 미설정 — TanStack Query 기본 staleTime(0ms)으로 탭 포커스마다 재요청 가능 | `workspaces.controller.ts getSettings()` | `staleTime: 60_000` 또는 서버 `Cache-Control: private, max-age=60` 고려 |
| I10 | DB | settings JSONB 컬럼 인덱스 없음 — 현재 id 기반 접근이므로 무영향, 향후 필터링 시 GIN 인덱스 고려 | Workspace entity | 없음(현재) |
| I11 | DB | 마이그레이션 파일 부재 — JSONB 내부 키 추가이므로 DDL 변경 없음. settings 컬럼 NOT NULL 여부 확인 필요 | Workspace entity | settings 컬럼 `NOT NULL DEFAULT '{}'` 확인 |
| I12 | DB | e2e 테스트 raw SQL parameterized query 사용 — SQL injection 없음 | `workspace-rbac.e2e-spec.ts` L478-484 | 없음 |
| I13 | 동시성 | 프론트엔드 저장 중 `addOrigin`/`removeOrigin` 인터랙션 허용 — mutation 완료 후 remount로 미저장 변경 조용히 폐기 가능 | `workspace/settings/page.tsx EmbedOriginsEditor` | mutation isPending 동안 인터랙션 비활성화 고려 |
| I14 | API계약 | 비멤버 접근 시 `ADMIN_REQUIRED` 반환 — 비멤버와 권한 부족 구분 불가, 의미론적 명확성 부족 | `workspaces.service.ts assertAdmin()` | assertAdmin 내부에서 멤버 없음/역할 부족 분리 고려, 혹은 API 문서에 명시 |
| I15 | 테스트 | e2e 테스트 비-멤버 GET 403 에러 코드 미검증 (`status` 만 확인) | `workspace-rbac.e2e-spec.ts` outsiderGet 블록 | `error.code` 검증 추가 |
| I16 | 테스트 | e2e 테스트 admin 역할자의 PATCH /settings 200 케이스 미커버 | `workspace-rbac.e2e-spec.ts` G 블록 | admin 성공 케이스 추가 |
| I17 | 테스트 | DTO 클래스 validator 데코레이터 단위 테스트 부재 | `update-workspace-settings.dto.ts` | `update-workspace-settings.dto.spec.ts` 추가 |
| I18 | 테스트 | 프론트엔드 `EmbedOriginsCard`/`EmbedOriginsEditor` 컴포넌트 테스트 부재 | `workspace/settings/page.tsx` | RTL 기반 컴포넌트 테스트 추가 고려 |
| I19 | 유지보수성 | `ArrayMaxSize(100)`, `MaxLength(2048)` 매직 넘버 — 이름 있는 상수 미추출 | `update-workspace-settings.dto.ts` L10 | 파일 상단 상수 추출 또는 JSDoc 제약 이유 명시 |
| I20 | 유지보수성 | 유사한 ADMIN_REQUIRED 테스트 케이스 2건(editor/viewer) 구조 동일 | `workspaces.service.spec.ts` | `it.each` 패턴으로 통합 고려 |
| I21 | 유지보수성 | `text-[hsl(var(--muted-foreground))]` 인라인 클래스 3회 이상 반복 | `workspace/settings/page.tsx` L661, 695, 699 | 상수 추출 또는 프로젝트 유틸리티 클래스(`text-muted-foreground`) 사용 |
| I22 | 유지보수성 | i18n 키 `saveSettings`/`settingsSaved`/`settingsSaveFailed`가 향후 다른 설정 섹션에서 의미 충돌 가능 | `dict/ko/workspace.ts`, `dict/en/workspace.ts` | 더 구체적인 키명(예: `embedOriginsSaved`) 고려 |
| I23 | 범위 | plan 파일이 spec draft와 구현 tracking을 겸함 — plan-lifecycle 분리 원칙과 정합성 의문 | `plan/in-progress/spec-draft-workspace-settings-api.md` | frontmatter에 통합 plan 역할 명시, 또는 impl plan 분리 |
| I24 | 유저가이드 | `07-workspace-and-team/workspaces-and-members.*`에 "임베드 허용 도메인: Admin+ 편집" 1줄 안내 미포함 | 해당 MDX 파일 | 후속 PR에서 보강 권장 (차단 아님) |
| I25 | 문서 | `ImplAnchor` 컴포넌트가 사용자 대면 가이드 문서에 삽입 — 렌더링 시 사용자 노출 여부 확인 필요 | `web-chat.mdx`, `web-chat.en.mdx` | hidden/dev-only 여부 확인 |
| I26 | 문서 | Mermaid 시퀀스 다이어그램 응답 표기 `{ workspace }` vs 실제 `{ data: workspace }` 불일치 | `plan/in-progress/spec-draft-workspace-settings-api.md` | `{ data: workspace }` 로 수정 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | personal 워크스페이스 type 가드 부재(CRITICAL), DTO 방어 코드 부재(CRITICAL), spec API 표 미등재, JSDoc 불일치 |
| security | MEDIUM | Origin 정규식 와일드카드 허용, DTO ApiProperty description CORS 동작 불일치 |
| testing | MEDIUM | trailing slash 테스트-실제 동작 괴리, 비멤버 에러 코드 미검증, 컨트롤러 테스트 부재 |
| concurrency | MEDIUM | read-modify-write 비원자적 패턴 — 동시 Admin 편집 시 lost update 가능 |
| api_contract | MEDIUM | updateSettings 응답 schema 불일치, 입출력 DTO 혼재, ADMIN_REQUIRED 카탈로그 미등재 |
| documentation | MEDIUM | 빈 배열 의미 서술 CORS invariant 불일치, API 클라이언트 JSDoc 누락 |
| performance | LOW | 직렬 2-쿼리 패턴, key remount + invalidateQueries 조합 깜빡임 |
| architecture | LOW | DTO-Service trailing slash 책임 중복, 컨트롤러 인라인 필드 매핑 |
| side_effect | LOW | 얕은 머지 fragile, API 클라이언트 void 반환으로 정규화 값 즉시 반영 불가 |
| maintainability | LOW | 인라인 필드 매핑 누락 위험, E2E 단일 it 블록 다수 시나리오 혼합 |
| database | LOW | 비원자적 read-modify-write, 중복 SELECT, settings NULL 여부 확인 필요 |
| scope | NONE | 변경 범위 작업 목적과 일치, 이탈 없음 |
| user_guide_sync | LOW | 07-workspace-and-team 권한 안내 1줄 후속 보강 권장 |

---

## 발견 없는 에이전트

없음 (모든 에이전트에서 발견사항 존재).

---

## 권장 조치사항

1. **(즉각 필수)** `updateWorkspaceSettings` 서비스에 `const origins = dto.interactionAllowedOrigins ?? [];` 방어 코드 추가 (C1)
2. **(즉각 필수)** `updateWorkspaceSettings`에 `workspace.type === 'personal'` 체크 추가 또는 허용 의도 spec 명시 (C2)
3. **(고우선)** DTO `@ApiProperty description`과 `web-chat.mdx` Callout의 빈 배열 의미를 "추가 origin 없음, CDN 항상 허용"으로 일치 수정 (W2, W17)
4. **(고우선)** 컨트롤러 `updateSettings` 응답에 `WorkspaceWithSettingsDto` 또는 기존 `WorkspaceDto`에 `settings` 추가, Swagger 선언과 실제 응답 shape 일치 (W5)
5. **(고우선)** `GET :id/settings` Swagger에 전용 응답 DTO 적용 (W6)
6. **(고우선)** `spec/5-system/3-error-handling.md §1.2`에 `ADMIN_REQUIRED` 공식 등재 (project-planner 위임) (W7)
7. **(고우선)** `spec/2-navigation/9-user-profile.md §6.1` API 표에 신규 엔드포인트 2개 등재 (project-planner 위임) (W9)
8. **(중우선)** `updateWorkspaceSettings`에 트랜잭션 적용 또는 PostgreSQL atomic JSONB 업데이트 도입 (W15)
9. **(중우선)** DTO 단위 테스트 신설, trailing slash 차단 여부 명시 확인, 서비스 dead-path 코드 정리 (W11, W17)
10. **(중우선)** 서비스 spec에 비멤버 `updateWorkspaceSettings` 에러 코드 검증, WORKSPACE_NOT_FOUND 케이스 추가 (W12, W13)
11. **(중우선)** 컨트롤러 단위 테스트 추가 (W14)
12. **(중우선)** `invalidateQueries` 대신 `setQueryData`로 직접 갱신하여 key remount 깜빡임 제거 (W4)
13. **(중우선)** `EmbedOriginsCard` JSDoc 실제 구현에 맞게 업데이트 (W8)
14. **(저우선)** Origin 정규식 와일드카드 명시 차단 및 포트 범위 검증 추가 (W1)
15. **(저우선)** E2E 테스트 단일 `it` 블록을 시나리오별로 분리 (W18)
16. **(저우선)** API 클라이언트 `updateSettings`·`getSettings` JSDoc 추가 (W16)
17. **(저우선)** `07-workspace-and-team/workspaces-and-members.*`에 Admin+ 편집 권한 안내 후속 보강 (I24)

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync (13명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)
- **제외**: dependency (1명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터에 의해 생략 (상세 이유 routing decision 파일 참조) |