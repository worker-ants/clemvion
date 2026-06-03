# 아키텍처(Architecture) 리뷰

대상 변경: `interactionAllowedOrigins` 설정 편집 API/UI (`PATCH /api/workspaces/:id/settings`, `GET /api/workspaces/:id/settings`, `EmbedOriginsCard`)

---

## 발견사항

### [INFO] 단일 책임 원칙 — DTO vs Service 정규화 책임 혼재
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `updateWorkspaceSettings()` (trailing slash `.replace(/\/$/, '')`)
- 상세: 형식 검증(scheme·path 불가)은 DTO 레이어(`UpdateWorkspaceSettingsDto`)가 수행하고, 정규화(후행 슬래시 제거)는 Service 레이어가 수행한다. DTO 가 `@Matches(/^https?:\/\/[^/\s?#]+$/i)` 로 슬래시를 원천 차단하는 정규식을 갖고 있음에도 불구하고 Service 에서 후행 슬래시를 제거하는 코드가 별도로 존재한다. DTO 정규식이 `/^https?:\/\/[^/\s?#]+$/` 이면 `https://example.com/` 처럼 후행 슬래시가 있는 값은 이미 Matches 검증에서 탈락해야 하므로, Service 의 trailing-slash 정규화는 도달 불가 코드(dead path)이거나 DTO 정규식과 실제 동작이 다른 경우를 대비한 방어 코드다. 두 레이어가 같은 불변식을 중복 강제하는 것은 책임 경계의 모호함을 나타낸다.
- 제안: DTO `@Matches` 정규식이 실제로 trailing slash 를 차단하는지 단위 테스트로 명시적으로 검증하고, 검증이 확인되면 Service 의 `.replace(/\/$/, '')` 를 제거해 책임을 DTO 레이어로 일원화한다. 혹은 의도적으로 Service 에서 정규화를 담당한다면 DTO 는 형식만 검사하고 정규화는 Service 책임으로 문서화한다.

---

### [INFO] 레이어 책임 — Controller 응답 매핑이 Service 내부 엔티티를 직접 선택
- 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` `updateSettings()` 응답 객체 (lines 133-141)
- 상세: `updateSettings()` 컨트롤러 메서드가 `ws.id`, `ws.name`, `ws.type`, `ws.slug`, `ws.settings` 를 직접 선택해 인라인 객체로 반환한다. 프로젝트 내 다른 컨트롤러 메서드들이 `WorkspaceDto` 같은 전용 응답 DTO 를 거쳐 변환하는 패턴과 비교했을 때 일관성이 낮다. 이 패턴은 (a) 엔티티 필드가 추가될 때 컨트롤러도 수동으로 업데이트해야 하고, (b) 응답 shape 의 단일 진실이 없어져 Swagger 스키마와 실제 응답이 불일치할 위험이 생긴다. `@ApiOkWrappedResponse(WorkspaceDto, ...)` 선언은 있으나 실제 반환은 `WorkspaceDto` 를 거치지 않는다.
- 제안: 기존 `WorkspaceDto` 또는 전용 `WorkspaceSettingsResponseDto` 를 도입해 컨트롤러가 엔티티 필드를 직접 선택하지 않도록 한다. 이는 Swagger `@ApiOkWrappedResponse(WorkspaceDto)` 선언과 실제 반환 shape 의 정합성도 보장한다.

---

### [INFO] 결합도 — `getWorkspaceSettings` 의 중복 DB 조회
- 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` `getWorkspaceSettings()` (getMemberRole → workspaceRepository.findOne 두 번)
- 상세: `getWorkspaceSettings` 는 `getMemberRole(workspaceId, userId)` 를 호출해 멤버 여부를 확인한 뒤, 권한 확인 후 다시 `workspaceRepository.findOne(workspaceId)` 를 호출해 settings 를 읽는다. `getMemberRole` 내부에서도 `workspaceMemberRepository` 조회가 발생한다. 결과적으로 단일 API 요청에서 member 테이블 1회, workspace 테이블 1회 조회가 발생한다. `updateWorkspaceSettings` 역시 `assertAdmin` → 별도 `workspaceRepository.findOne` 패턴을 따른다. 이 이중 조회 패턴은 이미 서비스 전반에 걸쳐 사용 중이므로 이번 변경에서 도입된 새 문제는 아니지만, 새로 추가된 두 메서드가 기존의 비효율적인 패턴을 그대로 승계한다.
- 제안: 아키텍처 개선 관점에서 `assertAdmin` / `getMemberRole` 이 workspace 엔티티를 함께 반환하는 오버로드를 제공하거나, 단일 JOIN 쿼리로 멤버 역할과 workspace 정보를 한 번에 조회하는 helper 를 도입하는 것을 중장기 개선으로 검토한다. 현재 변경의 즉각적 위험은 낮다.

---

### [INFO] 프론트엔드 — `EmbedOriginsCard`/`EmbedOriginsEditor` 분리의 의도는 적절하나 컴포넌트 파일 위치 주의
- 위치: `codebase/frontend/src/app/(main)/workspace/settings/page.tsx` (EmbedOriginsCard, EmbedOriginsEditor 인라인 정의)
- 상세: `EmbedOriginsCard` (데이터 로딩 담당)와 `EmbedOriginsEditor` (상태 관리·UI 담당)로 역할을 분리한 점은 올바른 관심사 분리다. `key` 기반 remount 로 `useEffect`-setState 를 회피한 패턴도 React 관례에 부합한다. 다만 두 컴포넌트가 같은 page.tsx 파일 안에 인라인으로 정의되어 있어, 페이지 파일이 점점 커지는 구조다. `EmbedOriginsEditor` 는 순수 UI 로직만 포함하므로 별도 컴포넌트 파일로 분리하면 테스트 가능성과 재사용성이 높아진다.
- 제안: `components/workspace/EmbedOriginsEditor.tsx` 같은 별도 파일로 추출하는 것을 고려한다. 현재 규모에서는 INFO 수준이며 기능 정확성에는 영향 없다.

---

### [INFO] 프론트엔드 API 클라이언트 — `updateSettings` 반환 타입이 `void`
- 위치: `codebase/frontend/src/lib/api/workspaces.ts` `updateSettings()`
- 상세: `updateSettings` 는 `Promise<void>` 를 반환하도록 선언되어 있으나, 백엔드는 실제로 `{ data: { id, name, type, slug, settings } }` 를 응답한다. 클라이언트가 저장 후 즉시 workspace 데이터를 사용해야 하는 요구가 생길 경우 API 클라이언트를 수정해야 하고, 현재는 `queryClient.invalidateQueries` 로 별도 GET 을 트리거해 간접적으로 갱신한다. 이 자체는 유효한 패턴이지만, 응답 페이로드를 버리는 설계 결정이 명시적으로 표현되어 있지 않다.
- 제안: 현재 패턴(invalidate 후 재조회)을 유지하거나, `updateSettings` 가 서버 응답을 파싱해 `WorkspaceSummary` 를 반환하도록 변경해 한 번의 왕복으로 갱신하는 방안을 검토한다. 아키텍처 결정에 큰 영향은 없으나 일관성을 위해 주석으로 의도를 기록하는 것이 좋다.

---

### [INFO] 확장성 — `UpdateWorkspaceSettingsDto` 의 단일 필드 구조
- 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- 상세: DTO 가 `interactionAllowedOrigins` 단일 필드만 갖는다. 향후 `timezone`, 기타 settings 키가 이 엔드포인트를 통해 관리될 경우 새 필드를 추가하면 되므로 구조 자체는 확장에 열려 있다. 그러나 Service 의 `updateWorkspaceSettings` 메서드 시그니처가 `UpdateWorkspaceSettingsDto` 를 직접 받기 때문에, 지금은 `dto.interactionAllowedOrigins` 에만 직접 접근한다. 새 필드가 추가될 때마다 Service 로직을 수정해야 한다는 점에서 개방-폐쇄 원칙 관점에서 약한 구조다.
- 제안: 현재 범위(origins 한정)에서는 문제없다. 향후 settings 키가 늘어날 경우 Service 가 DTO 의 알려진 키들을 순회해 병합하는 일반화 로직으로 리팩터링하는 것을 검토한다.

---

## 요약

이번 변경은 `WorkspacesController`/`WorkspacesService`/`UpdateWorkspaceSettingsDto` 레이어 분리를 프로젝트 기존 패턴에 맞게 잘 따르고 있으며, 권한 검사가 Service 레이어에 집중되어 있고 DTO 가 입력 검증을 담당하는 구조도 적절하다. 프론트엔드에서 `EmbedOriginsCard`(데이터 로딩)와 `EmbedOriginsEditor`(UI 상태)를 분리한 점도 관심사 분리 측면에서 올바른 설계다. 주요 아키텍처적 주의사항은 (1) DTO 와 Service 가 trailing-slash 정규화를 중복으로 처리하는 책임 경계 모호성, (2) 컨트롤러가 `WorkspaceDto` 를 거치지 않고 엔티티 필드를 직접 선택해 반환함으로써 Swagger 선언과 실제 응답 shape 의 단일 진실이 어긋나는 점이다. 두 이슈 모두 기능 정확성에 즉각적인 영향을 주지는 않으나, 향후 필드 추가나 응답 형식 변경 시 유지보수 부채가 될 수 있다. 전체 구조는 검증 가능하고, 단위 테스트 및 e2e 테스트 커버리지가 주요 경로를 충분히 다루고 있어 위험도는 낮다.

---

## 위험도

LOW

STATUS: SUCCESS
