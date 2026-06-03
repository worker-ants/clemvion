# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [INFO] 워크스페이스 설정 관련 07-workspace-and-team 문서 부분적 미갱신 가능성

- 변경 파일: `codebase/backend/src/modules/workspaces/workspaces.controller.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`
- 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신 후보: `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.mdx`, `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/07-workspace-and-team/workspaces-and-members.en.mdx`
- 상세: 새로운 `PATCH/GET /api/workspaces/:id/settings` 엔드포인트는 Owner/Admin 권한 게이트 기반의 임베드 허용 도메인 설정을 제공한다. 이 기능은 워크스페이스 멤버 역할(Admin+ 편집, 멤버 조회) 에 직접 연관되어 있으므로 `07-workspace-and-team/workspaces-and-members.*` 에 "임베드 허용 도메인 섹션은 Owner/Admin 만 편집" 안내를 추가하는 것이 사용자에게 도움이 될 수 있다. 그러나 매트릭스의 `backend-api-change` trigger 는 "가장 직접 관련된 user-guide 페이지" 기준이며, 이 변경의 기능 안내는 이미 `06-integrations-and-config/web-chat.{mdx,en.mdx}` 에서 충분히 다루어졌다. 따라서 엄격한 매트릭스 위배는 아니지만 role-permission 관점 보강을 고려할 수 있다.
- 제안: `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 의 "역할별 권한" 또는 "워크스페이스 설정" 섹션에 "임베드 허용 도메인: Admin+ 편집 가능, 전체 멤버 조회 가능" 1줄 언급을 후속 PR 에서 보강하는 것을 권장한다(차단 아님).

---

## 매칭된 Trigger 및 충족 여부

| 매트릭스 항목 | 충족 여부 | 근거 |
|---|---|---|
| `new-ui-string` — TSX 신규 i18n 키 KO/EN parity | **충족** | `dict/ko/workspace.ts` + `dict/en/workspace.ts` 양쪽에 동일 13 키(`embedOriginsTitle`, `embedOriginsDesc`, `embedOriginsLabel`, `embedOriginsPlaceholder`, `addOrigin`, `removeOrigin`, `originInvalid`, `originDuplicate`, `saveSettings`, `settingsSaved`, `settingsSaveFailed`, `embedOriginsCacheNote`, `embedOriginsEmpty`) 동시 추가 |
| `backend-api-change` — controller·DTO Swagger + user-guide | **충족** | 신규 엔드포인트 전체에 `@ApiOperation`, `@ApiParam`, `@ApiOkWrappedResponse`, `@ApiBadRequestResponse`, `@ApiUnauthorizedResponse`, `@ApiForbiddenResponse`, `@ApiNotFoundResponse` 완비. `06-integrations-and-config/web-chat.{mdx,en.mdx}` GUI 흐름 절 동반 갱신 |
| `integration-provider-change` — web-chat provider 문서 갱신 | **충족** | `web-chat.mdx`(KO) + `web-chat.en.mdx`(EN) 양쪽에 "GUI 설정 흐름" 절 신설 및 `<ImplAnchor>` 동반 |
| `userguide-gui-flow-section` — `<ImplAnchor kind="ui-entry">` 동반 | **충족** | `web-chat.en.mdx` + `web-chat.mdx` 에 `<ImplAnchor kind="ui-entry" file="codebase/frontend/src/app/(main)/workspace/settings/page.tsx" symbol="EmbedOriginsCard">` 작성. 파일·심볼 실존 확인됨 |
| `new-warning-code` / `new-error-code` | **해당 없음** | 신규 warningRules 또는 `ErrorCode` enum 항목 추가 없음. `ADMIN_REQUIRED` 는 기존 `assertAdmin()` 에서 이미 발행 중 (신규 발행 아님) |
| `auth-session-flow-change` | **해당 없음** | 변경 파일이 `codebase/backend/src/modules/auth/**` 아님. workspaces 모듈 내 RBAC 가드 추가이므로 trigger 비매칭 |
| `new-userguide-section-dir` | **해당 없음** | 신규 docs 섹션 디렉토리 생성 없음 |

---

## 요약

매트릭스 총 18개 trigger 중 이번 변경에 직접 매칭되는 trigger 는 `new-ui-string`, `backend-api-change`, `integration-provider-change`, `userguide-gui-flow-section` 4개이며, 4개 모두 동반 갱신이 같은 변경 set 안에 포함되어 있다. i18n KO/EN parity(13 키 양쪽 등록), Swagger 데코레이터 완비, docs MDX 양쪽(KO/EN) 갱신, `<ImplAnchor>` 동반 작성이 모두 충족되었다. 유일한 소견은 `07-workspace-and-team/workspaces-and-members.*` 에 Admin+ 편집 권한 안내 1줄을 후속 보강하는 것을 권장한다는 INFO 1건이며, 이는 차단 사유가 아니다.

## 위험도

LOW
