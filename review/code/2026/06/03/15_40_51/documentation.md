# 문서화(Documentation) 리뷰

리뷰 일시: 2026-06-03
대상 변경: `interactionAllowedOrigins` 워크스페이스 설정 API/UI 신설

---

## 발견사항

### [INFO] 독스트링/JSDoc — 백엔드 서비스 메서드 문서 수준 양호

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspaces.service.ts` (`updateWorkspaceSettings`, `getWorkspaceSettings`)
- 상세: 두 신규 메서드 모두 JSDoc 블록 주석이 있으며, 접근 권한(Admin+/멤버), 정규화 규칙(trailing slash 제거), 부분 머지 정책을 명시하고 있다. 핵심 설계 결정이 주석에 포착되어 있어 코드만 봐도 의도를 파악할 수 있다.
- 제안: 현재 상태 적절. 단, `getWorkspaceSettings` 주석의 "멤버 read(viewer 포함)" 표현에 반환 타입 `{ interactionAllowedOrigins: string[] }` 과 빈 배열 fallback 정책도 한 줄 추가하면 더 완결성이 높아진다.

---

### [INFO] 독스트링/JSDoc — 프론트엔드 컴포넌트 문서 수준 양호

- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/workspace/settings/page.tsx` (`EmbedOriginsCard`, `EmbedOriginsEditor`)
- 상세: `EmbedOriginsCard`에 JSDoc이 있으며, GET 엔드포인트 부재 이유, key 기반 remount 패턴의 의도(effect 내 setState 회피), 추후 useQuery 시드 방향까지 설명하고 있다. 비자명한 설계 결정이 인라인으로 충분히 문서화되었다.
- 제안: `ORIGIN_PATTERN` 상수 위의 단일 줄 주석(`/** scheme://host[:port] — 경로/쿼리/프래그먼트 없음. */`)도 간결하고 명확하다. 현재 상태 적절.

---

### [WARNING] API 문서 — `workspacesApi.updateSettings` / `getSettings` JSDoc 누락

- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/api/workspaces.ts` (lines 906~917)
- 상세: 신규 추가된 `updateSettings`와 `getSettings` 두 함수에 JSDoc이 없다. 기존 `update`, `delete` 등 다른 메서드도 JSDoc이 없는 패턴을 따르고 있어 일관성 측면에서 허용 가능하나, `updateSettings`의 `patch` 파라미터 타입이 인라인 리터럴(`{ interactionAllowedOrigins: string[] }`)로 선언되어 반환 타입이 `Promise<void>`인 이유(응답 body 미사용)나 부분 교체 의미론을 주석 없이 추론해야 한다.
- 제안: 최소한 `updateSettings`에 `/** 워크스페이스 허용 origin 목록 전체 교체 (PATCH). 기존 목록을 덮어씀. */` 수준의 한 줄 주석 추가를 권장한다. `getSettings`도 반환 구조(`{ interactionAllowedOrigins }`)를 JSDoc `@returns`로 명시하면 타입 추론이 불충분한 환경에서 사용성이 개선된다.

---

### [WARNING] API 문서 — `@Get(':id/settings')` 응답 스키마 타입 불일치

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspaces.controller.ts` line 151
- 상세: `@ApiOkWrappedResponse(UpdateWorkspaceSettingsDto, ...)` 로 GET `/settings` 응답 스키마를 `UpdateWorkspaceSettingsDto`(요청 DTO)로 지정하고 있다. 실제 서비스 반환 타입은 `{ interactionAllowedOrigins: string[] }` 이지만, Swagger 문서에는 요청용 DTO가 응답 스키마로 표시된다. 필드 구조가 같아 런타임 불일치는 없으나, API 문서를 읽는 사람은 이 엔드포인트가 요청 DTO와 동일한 스키마를 반환한다는 점이 의도적인지 혼동할 수 있다. 별도 응답 DTO를 만들거나, 전용 `WorkspaceSettingsResponseDto`(혹은 인터페이스)를 정의해 Swagger에 사용하는 것이 명확하다.
- 제안: 단기적으로는 현 구조 허용 가능. 중기적으로 `WorkspaceSettingsDto`를 별도 정의하거나, `@ApiOkWrappedResponse`에 실제 응답 형태를 반영하는 별도 클래스 적용을 고려한다.

---

### [WARNING] 사용자 가이드 문서 — 빈 배열 의미 서술이 CORS invariant와 불일치 (기존 주석과의 정확성 문제)

- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/web-chat.mdx` 및 `web-chat.en.mdx`
- 상세: `web-chat.mdx`의 Callout에 "목록이 비어 있으면 도메인 제한을 적용하지 않아요"라고 기술되어 있다. 이는 CORS `isExternalOriginAllowed()` 레이어(빈 배열 = 추가 origin 없음, 위젯 CDN만 허용)와 임베드 soft 검증 레이어(빈 배열 = enforce=false, allow-all)를 구분하지 않고 사용자에게 단순화하고 있다. 이 단순화가 기술적으로 정확하지 않아 사용자가 "빈 목록이면 어디서든 API가 허용된다"고 오해할 수 있다.
- 제안: Callout을 "목록이 비어 있으면 위젯 표시 제한을 적용하지 않아요(임베드 soft 검증). API 레벨 CORS 허용 여부는 별도 설정이며, 위젯 CDN origin은 항상 허용됩니다." 방식으로 두 레이어를 구분하여 서술한다. 이는 consistency 리뷰에서도 CRITICAL로 지적된 사항과 연동된다.

---

### [WARNING] 사용자 가이드 문서 — `ImplAnchor` 사용 적절성 및 사용자 대면 문서 내 구현 참조

- 위치: `web-chat.mdx` 및 `web-chat.en.mdx` — `<ImplAnchor kind="ui-entry" file="codebase/frontend/..." symbol="EmbedOriginsCard" />` 삽입 부분
- 상세: `ImplAnchor` 컴포넌트가 사용자 대면 가이드 문서(`web-chat.mdx`)에 삽입되어 있다. 이 컴포넌트는 구현 파일 경로(`codebase/frontend/src/...`)와 심볼명(`EmbedOriginsCard`)을 포함하는데, 렌더링 결과가 사용자에게 표시되지 않고 내부 추적용이라면 문제 없으나, 가이드 문서의 맥락에서 독자가 볼 때 어색할 수 있다. 이 컴포넌트의 용도(spec-impl evidence anchor)가 가이드 독자에게 노출되지 않는지 확인이 필요하다.
- 제안: `ImplAnchor`가 UI에서 렌더링되지 않음(hidden/dev-only)을 확인하거나, 적어도 렌더링 결과 스크린샷이나 preview로 검증한다. 사용자에게 노출되는 요소라면 제거하거나 주석 처리해야 한다.

---

### [INFO] 인라인 주석 — 프론트엔드 복잡 로직 설명 양호

- 위치: `page.tsx` `EmbedOriginsCard` 함수 내 `settingsQuery` 선언 직전 주석
- 상세: "GET 으로 현재 origin 목록을 로드한 뒤, key 기반 remount 로 editor 의 초기 state 를 시드한다 (effect 내 setState 회피 — react-hooks/set-state-in-effect)" 주석이 비자명한 패턴의 이유를 명확히 설명한다. 팀 내 다른 개발자가 이 패턴을 변경하려 할 때 충분한 컨텍스트를 제공한다.
- 제안: 현재 상태 적절.

---

### [INFO] 테스트 파일 — 문서화 수준 적절

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`, `/Volumes/project/private/clemvion/codebase/backend/test/workspace-rbac.e2e-spec.ts`
- 상세: unit spec의 describe/it 설명이 테스트 의도를 충분히 표현한다("merges interactionAllowedOrigins, preserves other keys, normalizes trailing slash"). e2e spec의 코멘트("// DB 에도 반영", "// viewer → 403 (Admin+)")도 각 단계의 목적을 명확히 한다. 테스트 코드가 living documentation 역할을 잘 수행하고 있다.
- 제안: 현재 상태 적절.

---

### [INFO] i18n 키 — 문서화 완결성 양호

- 위치: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/en/workspace.ts`, `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/ko/workspace.ts`
- 상세: KO/EN 양 언어에 14개의 i18n 키가 대칭적으로 추가되었다. 키 이름이 용도를 명확히 드러내며(`embedOriginsTitle`, `originInvalid`, `embedOriginsCacheNote` 등), 플레이스홀더 문자열도 형식을 예시하고 있다(`"https://example.com"`).
- 제안: 현재 상태 적절.

---

### [INFO] DTO 문서 — `UpdateWorkspaceSettingsDto` Swagger 설명 양호

- 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- 상세: `@ApiProperty`의 `description`이 빈 배열의 의미("빈 배열은 모든 origin 차단을 의미합니다")를 명시하고 있다. 그런데 이 표현은 consistency 리뷰에서 CRITICAL로 지적된 빈 배열 의미론 불일치("빈 배열 = 추가 origin 없음" vs "모든 origin 차단")를 그대로 반영하고 있다. DTO Swagger 설명이 실제 CORS 동작과 다른 설명을 제공하므로 API 문서 정확성 문제가 있다.
- 제안: `description`을 "빈 배열은 추가로 허용할 origin이 없음을 의미합니다(위젯 CDN origin은 항상 허용됩니다)." 로 수정하여 CORS invariant와 일치시킨다. 이 수정은 consistency 리뷰의 CRITICAL 해소와 동시에 진행해야 한다.

---

### [INFO] plan 문서 — spec 갱신 Phase 체크박스 존재하나 구체성 보완 필요

- 위치: `/Volumes/project/private/clemvion/plan/in-progress/spec-draft-workspace-settings-api.md` `## Phase: Spec 갱신` 섹션
- 상세: 해당 plan 문서에 이미 `## Phase: Spec 갱신` 섹션이 신설되어 있고 체크박스 형식으로 4개 spec 파일의 갱신 내용이 기술되어 있다. consistency 리뷰에서 "영향 spec 목록에만 있고 정식 phase 없음"으로 WARNING 지적되었으나, 실제 파일에는 Phase 섹션이 존재한다. 다만 before/after 구체 문구가 없어 수행자가 실제 변경할 내용을 추론해야 하는 부분이 있다.
- 제안: 각 체크박스 항목에 "추가할 문구 예시" 또는 "변경 전/후 snippet"을 한 줄씩 추가하면 실행 가능성이 높아진다. 특히 `spec/5-system/3-error-handling.md §1.2`의 `ADMIN_REQUIRED` 등재 항목은 구체 행 포맷 예시가 있으면 유용하다.

---

## 요약

전반적으로 이번 변경의 문서화 수준은 양호하다. 백엔드 서비스 메서드에 JSDoc이 있고, 프론트엔드 컴포넌트의 비자명한 설계 결정(key remount 패턴, effect-setState 회피)이 인라인 주석으로 충분히 설명되어 있으며, 사용자 가이드 문서(web-chat.mdx/en.mdx)도 GUI 설정 경로와 접근 권한을 명확히 업데이트했다. 다만 두 가지 문서 정확성 문제가 주목된다. 첫째, `UpdateWorkspaceSettingsDto`의 `@ApiProperty description`("빈 배열은 모든 origin 차단을 의미합니다")과 `web-chat.mdx` Callout("목록이 비어 있으면 도메인 제한을 적용하지 않아요")이 서로 반대 의미를 전달하며 모두 CORS invariant(빈 배열 = 추가 origin 없음, CDN은 항상 허용)와 정확히 일치하지 않는다. 이는 consistency 리뷰 CRITICAL 사항과 직결되므로 동시 수정이 필요하다. 둘째, `workspacesApi.updateSettings`의 반환 타입이 `Promise<void>`인 이유(응답 body 미사용)와 부분 교체 의미론에 대한 주석이 없어 API 클라이언트 사용자가 동작을 추론해야 한다.

---

## 위험도

MEDIUM
