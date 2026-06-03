# 요구사항(Requirement) 코드 리뷰

대상: `interactionAllowedOrigins` 워크스페이스 설정 편집 API/UI (백엔드 DTO·컨트롤러·서비스·테스트 + 프론트엔드 API 클라이언트·UI·i18n·문서)
검토 일시: 2026-06-03

---

## 발견사항

### [CRITICAL] DTO `interactionAllowedOrigins` 필드 미필수 선언 누락 — 요청 body 없을 때 런타임 오류 유발 가능

- **위치**: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` 전체
- **상세**: `interactionAllowedOrigins: string[]` 에 `@IsOptional()` 이 없고 TypeScript 타입도 `string[]`(required)이다. 따라서 클라이언트가 `{}` (body 없이) PATCH 를 보내면 class-validator 는 `IsArray` 검증 실패(400)를 올바르게 반환한다. 이 자체는 의도된 동작이다. 그러나 서비스 `updateWorkspaceSettings` 에서 `dto.interactionAllowedOrigins.map(...)` 을 직접 호출하므로, ValidationPipe 가 활성화되지 않은 테스트 환경이나 미래 누락 상황에서 `undefined.map` → `TypeError`가 발생한다. 더 명확히는, DTO 클래스에서 TypeScript strict 타입 `string[]` 이 런타임에 보장되지 않을 경우 방어 코드가 없다.
- **제안**: 서비스에서 `const origins = dto.interactionAllowedOrigins ?? [];` 로 방어하거나, DTO 에 `@Transform` 으로 null-safe 처리를 추가한다. 또는 서비스 진입 전 assert 를 명시한다.

---

### [CRITICAL] `updateWorkspaceSettings` — 개인(personal) 워크스페이스에 대한 type 가드 부재

- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings` 메서드(diff 내 `+async updateWorkspaceSettings` 블록)
- **상세**: 기존 `deleteWorkspace`, `leaveWorkspace`, `transferOwnership` 등은 모두 `workspace.type === 'personal'` 을 체크하고 적절한 ForbiddenException 을 던진다. 그러나 `updateWorkspaceSettings` 는 workspace 를 조회한 뒤 type 검사를 하지 않는다. 개인 워크스페이스의 owner 가 `interactionAllowedOrigins` 를 설정하면 그대로 DB 에 저장된다. 개인 워크스페이스는 외부 임베드 대상이 아니므로 이 설정이 의미 없거나 혼동을 야기할 수 있다. spec(`spec/7-channel-web-chat/4-security.md §2·§3`)은 "워크스페이스 단위"로 설정이 동작한다고만 하며 개인 워크스페이스 제한을 명시하지 않는다. 그러나 기존 서비스 패턴과의 일관성 관점에서 누락이다.
- **제안**: `workspace` 조회 후 `if (workspace.type === 'personal')` 체크를 추가하고 적절한 에러(`CANNOT_MODIFY_PERSONAL_SETTINGS` 또는 `PERSONAL_WORKSPACE_NOT_SUPPORTED`)를 반환하거나, 이를 허용하는 의도임을 주석으로 명시한다. spec 에 personal 워크스페이스 허용 여부가 명시되어 있지 않으므로 project-planner 확인이 필요하다.

---

### [WARNING] `updateWorkspaceSettings` — 비권한자(비-멤버) 요청 시 에러 코드가 `ADMIN_REQUIRED` 로 단일화

- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `assertAdmin` 메서드(기존 코드 line 518~529)
- **상세**: `assertAdmin` 은 멤버십이 없는 경우와 권한이 부족한 경우를 모두 `ADMIN_REQUIRED`(403) 로 반환한다. e2e 테스트(`workspace-rbac.e2e-spec.ts`)의 "비-멤버(outsider) → 403, error.code === 'ADMIN_REQUIRED'" 기대값이 이를 확인한다. 이는 기존 패턴(다른 Admin+ 엔드포인트도 동일)과 일관되지만, `spec/5-system/3-error-handling.md §1.2` 의 공식 에러 카탈로그에 `ADMIN_REQUIRED` 가 등재되어 있지 않다. 카탈로그에 있는 것은 `FORBIDDEN`(권한 없음, 403) 뿐이다. 이는 consistency review 에서 이미 경고로 기록된 사항이나, 코드 구현 레벨에서도 spec 불일치에 해당한다.
- **제안**: `spec/5-system/3-error-handling.md §1.2` 에 `ADMIN_REQUIRED` 를 정식 등재하거나, 기존 코드를 `FORBIDDEN` 으로 통일하는 방향 중 하나로 결정 후 반영. 본 reviewer 는 spec 직접 수정 불가 — project-planner 위임 사항.

---

### [WARNING] trailing slash 정규화 로직 — 다중 슬래시(`//`) 입력 시 한 번만 제거

- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings` 내 `o.replace(/\/$/, '')`
- **상세**: 정규화 로직이 정규식 `/\/$/`로 마지막 하나의 trailing slash 만 제거한다. `https://example.com//` 처럼 다중 후행 슬래시가 있으면 `https://example.com/` 이 저장된다. 이 값은 DTO `@Matches(/^https?:\/\/[^/\s?#]+$/i)` 검증을 통과하지 못하므로(검증이 먼저 실행됨) 사실상 이런 입력은 400 으로 차단된다. 따라서 실제 런타임 버그는 아니다. 그러나 정규화 코드의 의도("trailing slash 제거")와 구현("마지막 한 글자만 제거")의 미묘한 불일치가 존재한다. DTO 검증이 먼저 path 를 차단하므로 `//` 입력은 서비스까지 도달하지 않는다.
- **제안**: 현재 동작은 사실상 안전하나, 명확성을 위해 주석에 "DTO 검증 통과 후이므로 trailing slash 는 최대 1개" 를 명시하거나, 정규화를 `/\/*$/`로 변경해 의도를 더 명확히 한다.

---

### [WARNING] `getWorkspaceSettings` — GET 엔드포인트 스펙 미정의 상황에서 `updateSettings` 반환값 타입 불일치

- **위치**: `codebase/frontend/src/lib/api/workspaces.ts` — `updateSettings` 함수 반환 타입 `Promise<void>`
- **상세**: `updateSettings` 는 `Promise<void>` 로 선언되어 PATCH 응답을 무시한다. 그러나 백엔드는 200 응답으로 `{ data: { id, name, type, slug, settings } }` 전체 workspace 객체를 반환한다. 저장 완료 후 queryClient 를 invalidate 해 `getSettings` 로 새 값을 재로드하는 설계이므로 동작상 문제는 없다. 그러나 반환값을 활용하지 않음으로써 round-trip(GET 재조회)이 추가 발생한다. 또한 `onSuccess` 콜백에서 반환값을 활용하지 않아 성공 후 즉시 로컬 상태를 업데이트하지 못한다.
- **제안**: `updateSettings` 가 workspace 응답을 반환하도록 타입을 수정하고, `onSuccess` 에서 반환값으로 로컬 쿼리 캐시를 직접 업데이트(`queryClient.setQueryData`)하면 GET 재조회를 생략할 수 있다. 현재 설계도 기능적으로는 동작하지만 UX 응답성이 한 RTT 떨어진다.

---

### [WARNING] `EmbedOriginsCard` JSDoc 의도와 구현 간 괴리 — "아직 없으므로 빈 목록에서 시작" 주석이 현재 구현과 불일치

- **위치**: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` — `EmbedOriginsCard` JSDoc(diff line +578~+581)
- **상세**: JSDoc 에 "별도의 GET 엔드포인트도 (아직) 없으므로 편집기는 빈 목록에서 시작하며" 라고 되어 있으나, 실제 구현은 `useQuery` 로 `workspacesApi.getSettings(workspaceId)` 를 호출하고 결과로 초기값을 시드한다. GET 엔드포인트가 구현되어 있고 실제로 사용 중이다. 주석이 초기 설계 의도를 그대로 남긴 채 구현이 발전한 것으로 보인다.
- **제안**: JSDoc 을 실제 구현(GET 엔드포인트로 초기값을 로드)에 맞게 업데이트하여 의도와 구현의 일치를 유지한다.

---

### [WARNING] 빈 배열의 의미 불일치 — DTO ApiProperty 설명과 spec 간 차이

- **위치**: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts` — `@ApiProperty` description 문자열
- **상세**: `@ApiProperty` 의 description 에 "빈 배열은 모든 origin 차단을 의미합니다" 라고 명시되어 있다. 그러나 `spec/7-channel-web-chat/4-security.md §2`에 따르면 **빌트인 위젯 CDN origin 은 항상 허용**이고 `interactionAllowedOrigins` 는 추가 origin 병합이다. 빈 배열은 "추가 origin 없음"(built-in CDN 만 허용)을 의미하며, "모든 origin 차단"이 아니다. 또한 `spec/5-system/14-external-interaction-api.md §8.5`는 "미설정 시 차단"이라고 하는데, 이는 built-in CDN 을 제외한 외부 추가 origin 에 대해 차단이다. plan 문서(`spec-draft-workspace-settings-api.md`)의 "★ 빈 배열 의미" 정정이 DTO ApiProperty 설명에 반영되지 않았다. Swagger 문서를 통해 외부 통합 개발자가 잘못된 이해를 갖게 될 수 있다.
- **제안**: DTO `@ApiProperty` description 을 "빈 배열 = 추가 origin 없음(built-in 위젯 CDN origin 만 허용). CORS 레이어에서 built-in CDN 은 항상 허용된다." 로 수정한다.

---

### [WARNING] e2e 테스트 — 비-멤버 GET 요청의 에러 코드 미검증

- **위치**: `codebase/backend/test/workspace-rbac.e2e-spec.ts` — `outsiderGet` 검증 블록(diff line +509~+514)
- **상세**: 비-멤버 GET 요청에 대해 `expect(outsiderGet.status).toBe(403)` 만 검증하고 `outsiderGet.body.error.code` 는 검증하지 않는다. viewer(멤버) PATCH 403 에서는 `error.code === 'ADMIN_REQUIRED'` 를 추가로 검증한다. 에러 코드 검증의 일관성이 없다.
- **제안**: `expect(outsiderGet.body.error.code).toBe('ADMIN_REQUIRED')` 또는 `toBe('FORBIDDEN')` 를 추가해 에러 코드까지 검증한다.

---

### [WARNING] 스펙 fidelity — `spec/2-navigation/9-user-profile.md §6.1` API 표에 신규 엔드포인트 미등재

- **위치**: `spec/2-navigation/9-user-profile.md §6.1`
- **상세**: `spec/2-navigation/9-user-profile.md §6.1` 의 API 표에 `PATCH /api/workspaces/:id/settings` 및 `GET /api/workspaces/:id/settings` 가 존재하지 않는다. 코드는 구현되어 있으나 spec 의 공식 API 표가 업데이트되지 않았다. SDD 원칙상 spec 이 코드의 SoT 이므로, 구현된 엔드포인트는 spec 에 먼저 등재되어야 한다. 이 점은 plan 문서의 "Spec 갱신 Phase" 체크박스에 미완료로 남아 있다.
- **제안**: `spec/2-navigation/9-user-profile.md §6.1` 에 다음 두 행을 추가한다: `PATCH /api/workspaces/:id/settings — 워크스페이스 settings 변경(Admin+), body: { interactionAllowedOrigins: string[] }` 및 `GET /api/workspaces/:id/settings — 워크스페이스 settings 조회(멤버)`. 이는 project-planner 위임 사항.

---

### [INFO] `useHasRole("admin")` 의미 — owner 포함 여부가 코드로 확인됨

- **위치**: `codebase/frontend/src/components/auth/role-gate.tsx` — `useHasRole`
- **상세**: `useHasRole` 은 `ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]` (≥ 비교)로 구현되어 있으며, `viewer(1) < editor(2) < admin(3) < owner(4)` 계층이다. 따라서 `useHasRole("admin")` 은 admin(3) 이상 — admin + owner 모두 통과한다. consistency review 에서 제기된 "owner 가 배제될 수 있다"는 우려는 실제 코드에서는 문제 없음이 확인된다. 다만 이 semantics 가 spec 에 명시되어 있지 않아 혼동이 가능하다.
- **제안**: 이 자체는 정상 동작이나, spec/conventions 에 `useHasRole(minRole)` 이 "minRole 이상(≥)" 의미임을 명시하면 향후 혼동을 방지할 수 있다.

---

### [INFO] 단위 테스트 — `getWorkspaceSettings` 비-멤버 케이스 에러 코드가 `FORBIDDEN` 이나 spec 카탈로그와 불일치

- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` — `getWorkspaceSettings 'throws FORBIDDEN'` 케이스
- **상세**: 비-멤버가 GET 을 요청할 때 `FORBIDDEN` 코드로 테스트하며, 서비스에서도 `ForbiddenException({ code: 'FORBIDDEN' })` 를 발행한다. 이는 spec 에러 카탈로그(`3-error-handling.md §1.2`)의 `FORBIDDEN` 과 일치한다. 반면 PATCH 비권한자는 `ADMIN_REQUIRED` 로 구분된다. 두 에러 코드가 동일한 403 에서 다른 코드를 사용하는 의도적 설계로 보이나, 이 구분이 spec 에 명시되어 있지 않다.
- **제안**: spec 에러 카탈로그에 `ADMIN_REQUIRED` 를 정식 등재하고, GET/PATCH 각각의 403 코드 구분 의도를 명시.

---

### [INFO] 문서(web-chat.mdx) 변경 — 빈 목록 의미 표현 불일치 잔존

- **위치**: `codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` 및 `.en.mdx`
- **상세**: 한국어 문서에 "목록이 비어 있으면 도메인 제한을 적용하지 않아요. 위젯 CDN origin 은 항상 허용돼요." 라고 명시하여 spec 의도에 부합한다. 영문 문서도 동일하게 업데이트되었다. 그러나 DTO `@ApiProperty` description 은 여전히 "빈 배열은 모든 origin 차단"으로 남아 있어(위 WARNING 참조) 두 표면 간 불일치가 있다.
- **제안**: DTO description 수정(위 WARNING) 후 일관성 확보.

---

## 요약

핵심 기능(PATCH/GET `/api/workspaces/:id/settings`, `EmbedOriginsCard`, RBAC 가드)은 의도한 요구사항을 전반적으로 충족한다. `assertAdmin` 이 admin/owner 를 올바르게 통과시키고 editor/viewer/비-멤버를 403 으로 차단하며, `getWorkspaceSettings` 는 멤버 전체에 조회를 허용하고 비-멤버를 403 으로 차단한다. settings 부분 머지(기존 키 보존)도 서비스와 테스트 양쪽에서 확인된다.

그러나 두 가지 CRITICAL 수준 위험이 있다: 첫째, DTO 필드에 방어 코드 부재로 인해 ValidationPipe 우회 환경에서 `undefined.map` TypeError 가 발생할 수 있다. 둘째, personal 워크스페이스에 대한 type 가드가 없어 기존 서비스 패턴과 일관성이 깨진다. 추가로 DTO `@ApiProperty` description 의 "빈 배열 = 모든 origin 차단" 표현이 spec(built-in CDN 항상 허용) 과 다르고, `ADMIN_REQUIRED` 에러 코드가 spec 카탈로그에 미등재된 채 사용되고 있다. spec fidelity 관점에서 `spec/2-navigation/9-user-profile.md §6.1` API 표에 두 신규 엔드포인트가 등재되지 않은 점은 SDD 원칙 위반이며 project-planner 위임 사항이다.

---

## 위험도

HIGH
