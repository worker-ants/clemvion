# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: `update-workspace-settings.dto.ts`

- **[INFO]** `ArrayMaxSize(100)` 매직 넘버 — 상수 미추출
  - 위치: 라인 10 (`@ArrayMaxSize(100)`)
  - 상세: 100이라는 상한 수치의 의미가 인라인에만 있고 이름 있는 상수로 추출되지 않았다. `@MaxLength(2048)` 도 동일.
  - 제안: `const MAX_ORIGINS = 100; const MAX_ORIGIN_LENGTH = 2048;` 등으로 파일 상단에 추출하거나, 이 DTO가 유일한 사용처인 경우라면 JSDoc 주석으로 제약 이유를 명시하는 것으로 충분하다.

- **[INFO]** Swagger `description` 언어 혼용 — 한국어 설명, 영어 `message`
  - 위치: `@ApiProperty description` (한국어) vs `@Matches message` (영어 `'origin must be scheme://host[:port] with no path/query'`)
  - 상세: 프로젝트 내 DTO가 일관되게 한 언어를 사용하는지 확인 필요. 내부 validator message는 영어여도 무방하나, ApiProperty description과 통일성 관점에서 점검할 필요가 있다.
  - 제안: 기존 DTO 파일들의 관례를 확인하여 맞출 것. 단일 파일이므로 현재 범위에서 BLOCKER는 아님.

---

### 파일 2: `workspaces.controller.ts` — `updateSettings` / `getSettings`

- **[WARNING]** `updateSettings` 응답 객체가 인라인 리터럴로 구성 — 중복 매핑 위험
  - 위치: 라인 133–141 (`return { data: { id: ws.id, name: ws.name, type: ws.type, slug: ws.slug, settings: ws.settings } }`)
  - 상세: 동일한 워크스페이스 필드를 수동으로 선택하는 매핑이 이미 다른 컨트롤러 메서드에도 존재할 가능성이 높다. 새 필드가 `Workspace` 엔티티에 추가될 때 이 인라인 매핑을 빠뜨리면 응답이 불완전해진다.
  - 제안: `WorkspaceDto`(또는 동등한 응답 DTO/toDto 헬퍼)로 변환하는 공통 함수를 도입하거나 기존 패턴을 재사용한다. `getSettings`은 `return { data: settings }` 로 단순해 문제없다.

- **[INFO]** `@ApiOkWrappedResponse(UpdateWorkspaceSettingsDto, ...)` — GET 응답 타입 재사용
  - 위치: `getSettings` 데코레이터
  - 상세: GET `/settings`의 Swagger 응답 타입으로 입력 DTO인 `UpdateWorkspaceSettingsDto`를 재사용하고 있다. 의미상 입력과 출력이 동일하므로 현재는 문제없지만, 나중에 응답 전용 필드(예: `updatedAt`)를 추가할 때 입출력 DTO 분리가 필요해질 수 있다.
  - 제안: 현 시점에서 수정할 필요는 없으나, 나중에 입출력 타입 불일치가 생기면 전용 `WorkspaceSettingsDto`(응답용)을 별도 정의한다.

---

### 파일 3: `workspaces.service.spec.ts`

- **[INFO]** 유사한 ADMIN_REQUIRED 테스트 케이스 2건이 거의 동일한 구조
  - 위치: `'throws ADMIN_REQUIRED when requester is editor'` / `'throws ADMIN_REQUIRED when requester is viewer'`
  - 상세: 두 케이스가 role 값만 다르고 나머지 구조가 동일하다. 현재 2건으로 소규모이므로 큰 문제는 아니다.
  - 제안: `it.each([['editor'], ['viewer']])('throws ADMIN_REQUIRED when requester is %s', ...)` 패턴으로 통합하면 향후 role 목록 확장 시 누락 방지.

- **[INFO]** 테스트 픽스처 UUID(`'ws-uuid-1'`, `'user-uuid-1'`)가 모든 케이스에서 반복
  - 위치: 전체 describe 블록
  - 상세: 프로젝트의 기존 spec 파일 패턴과 일치하는 경우라면 무방하나, 상수로 추출하면 변경 시 한 곳만 수정.
  - 제안: 파일 상단에 `const WS_ID = 'ws-uuid-1'; const USER_ID = 'user-uuid-1';` 정의 (기존 spec 파일 관례를 먼저 확인).

---

### 파일 4: `workspaces.service.ts`

- **[INFO]** `updateWorkspaceSettings`에서 `assertAdmin`과 `workspaceRepository.findOne` 두 번 DB 접근
  - 위치: 라인 361–370
  - 상세: `assertAdmin` 내부에서 멤버 조회가 발생하고, 이후 다시 workspace를 별도로 조회한다. 현재 로직상 두 쿼리가 필요하므로 큰 문제는 아니나, workspace 미존재 시 `assertAdmin` 통과 후에야 404가 발생한다. 권한 체크 순서가 직관적이다.

- **[INFO]** 후행 슬래시 정규화 정규식 `/\/$/` — 의미 명확
  - 위치: 라인 371 (`o.replace(/\/$/, '')`)
  - 상세: 간단하고 의도가 명확. 추가 설명 불필요.

- **[WARNING]** `getWorkspaceSettings` 내 `workspace.settings?.interactionAllowedOrigins` 타입 캐스팅 `as string[]`
  - 위치: 라인 409 (`(origins as string[])`)
  - 상세: `workspace.settings`가 `Record<string, unknown>` 또는 유사 타입일 경우, `interactionAllowedOrigins`가 실제 `string[]`임이 런타임에 보장되지 않는다. `Array.isArray` 검사는 하지만 내부 요소가 `string`인지는 미검증이다. 이 필드는 DTO 검증을 거쳐 저장되므로 실무적으로 안전하나, 타입 안전성 측면에서 주의가 필요하다.
  - 제안: `origins.filter((o): o is string => typeof o === 'string')` 또는 Workspace 엔티티의 `settings` 타입을 구체화(`WorkspaceSettings` 인터페이스 도입)하여 캐스팅 제거.

---

### 파일 5: `workspace-rbac.e2e-spec.ts`

- **[WARNING]** 단일 `it` 블록에 7개 이상의 HTTP 요청과 독립적 시나리오 혼합
  - 위치: `it('G. PATCH/GET /workspaces/:id/settings ...')`  전체
  - 상세: owner PATCH 성공, DB 직접 조회 검증, viewer 403, outsider PATCH 403, viewer GET 200, outsider GET 403 — 6개의 독립적 assertion이 단일 `it` 블록에 있다. 이 중 하나가 실패하면 이후 케이스가 실행되지 않아 디버깅이 어렵다.
  - 제안: 시나리오별로 `it` 블록을 분리하거나, `describe('G')` 내부에 `beforeAll`로 공통 픽스처(owner, ws, viewer, outsider) 설정 후 세부 동작마다 별도 `it`으로 구성.

- **[INFO]** DB 직접 쿼리(`db.query`)가 E2E 테스트 중간에 삽입
  - 위치: 라인 475–481
  - 상세: 기존 E2E spec 파일에서 이 패턴이 이미 사용 중인지 확인 필요. 일관된 패턴이면 OK, 그렇지 않다면 API 응답 검증만으로 충분한지 검토.

---

### 파일 6: `workspace/settings/page.tsx`

- **[WARNING]** `EmbedOriginsCard`와 `EmbedOriginsEditor`의 분리 의도가 주석으로만 설명됨
  - 위치: 라인 581–596 (`EmbedOriginsCard`), 라인 604–742 (`EmbedOriginsEditor`)
  - 상세: key 기반 remount 패턴(effect 내 setState 회피)이 비표준적이라 주석 없이는 이해하기 어렵다. 현재 JSDoc 주석이 있어 이해 가능하나, `key={...:loaded/:pending}` 패턴이 React 쿼리 상태를 UI에 연결하는 유일한 방법이 아니므로, 향후 유지보수자가 이를 "버그"로 오인하고 제거할 위험이 있다.
  - 제안: 현재 주석은 적절하다. `EmbedOriginsEditor`의 `initialOrigins` prop이 실제로 초기값으로만 사용되고 이후 변경이 반영되지 않음을 주석 또는 prop 이름(`seedOrigins`?)으로 더 명확히 할 것.

- **[WARNING]** `text-[hsl(var(--muted-foreground))]` / `border-[hsl(var(--border))]` 인라인 반복
  - 위치: 라인 661, 695, 699 등
  - 상세: 동일한 CSS 변수 기반 클래스 문자열이 JSX 내에 3회 이상 반복된다. Tailwind의 `@apply` 또는 컴포넌트 분리, 또는 `cn()` 헬퍼와 함께 상수 추출이 가능하다.
  - 제안: `const mutedText = "text-[hsl(var(--muted-foreground))]"` 와 같이 컴포넌트 상단에서 상수화하거나, 이미 프로젝트에서 `text-muted-foreground` 유틸리티 클래스를 쓰고 있다면 그것을 사용.

- **[INFO]** `EmbedOriginsEditor`가 78줄 규모의 함수형 컴포넌트 — 단일 책임 경계에서 적절
  - 위치: 전체 컴포넌트
  - 상세: 상태 관리(origins, draft), 폼 로직(addOrigin, removeOrigin), 저장 뮤테이션, 렌더링이 한 컴포넌트에 모두 있다. 현재 규모에서는 허용 가능하나, 로직이 더 복잡해지면 커스텀 훅(`useEmbedOrigins`)으로 상태/뮤테이션을 분리하는 것이 권장된다.

- **[INFO]** `addOrigin` 함수 — `draft.trim()` 결과를 로컬 변수 `value`로 한 번만 계산
  - 위치: 라인 632–645
  - 상세: 현재 구현은 깔끔하다. 문제없음.

---

### 파일 9: `workspaces.ts` (API 클라이언트)

- **[INFO]** `updateSettings` 반환 타입이 `Promise<void>`
  - 위치: 라인 909
  - 상세: 서버가 `{ data: workspace }` 형태로 응답하는데 응답을 무시한다. 현재 UI에서 invalidateQueries로 재조회하므로 실용적으로 문제없으나, 응답 타입을 `WorkspaceSummary` 등으로 정의해 두면 향후 옵티미스틱 업데이트 도입 시 활용 가능하다.
  - 제안: 현재 용법에서는 `void`로 충분하다. 추후 필요 시 타입 추가.

---

### 파일 10, 11: i18n 딕셔너리 (EN/KO)

- **[INFO]** `saveSettings` / `settingsSaved` / `settingsSaveFailed` 키가 워크스페이스 설정 전반에 공용으로 쓰일 수 있음
  - 위치: `workspace.saveSettings` 등
  - 상세: 현재는 `EmbedOriginsEditor`에서만 사용하지만, 향후 다른 설정 섹션이 추가될 때 이 키를 재사용하면 의미가 충돌할 수 있다(어떤 설정이 저장됐는지 불명확).
  - 제안: 더 구체적인 키(예: `embedOriginsSaved`, `embedOriginsSaveFailed`)로 명명하거나, 범용 키로 유지하되 사용 범위를 명확히 주석으로 기록.

---

### 파일 12: `plan/in-progress/spec-draft-workspace-settings-api.md`

- **[INFO]** Mermaid 시퀀스 다이어그램 내 응답 표기 불일치 (`{ workspace }` vs `{ data: workspace }`)
  - 위치: sequenceDiagram 내 `Svc-->>C: 200 { workspace }`
  - 상세: 유지보수성 관점에서, spec 문서의 다이어그램이 실제 API 응답 구조와 다르면 구현자가 혼동하기 쉽다. (별도의 consistency 리뷰에서도 CRITICAL로 분류됨)
  - 제안: `200 { data: workspace }` 로 수정.

---

## 요약

전반적으로 코드 구조와 네이밍은 프로젝트 관례를 잘 따르고 있으며, 함수 길이와 중첩 깊이도 적절한 수준이다. 주요 유지보수성 위험은 두 가지다: 첫째, 컨트롤러의 `updateSettings`가 워크스페이스 필드를 인라인 리터럴로 매핑하여 엔티티 필드 변경 시 누락 가능성이 있으며, 둘째, E2E 테스트의 단일 `it` 블록에 다수의 독립 시나리오가 혼합되어 실패 원인 진단이 어렵다. 프론트엔드의 key 기반 remount 패턴은 비표준적이나 주석이 충분히 설명하고 있다. `getWorkspaceSettings`의 `as string[]` 타입 캐스팅과 `hsl(var(...))` 인라인 클래스 반복도 경미한 개선 여지가 있다. 전체적으로 복잡도가 낮고 단일 책임이 잘 지켜지는 변경이다.

## 위험도

LOW

STATUS: SUCCESS
