# Testing Review

## 발견사항

### [INFO] review/consistency 메타 파일들 — 테스트 관점 해당 없음
- 위치: `review/consistency/2026/06/23/10_27_50/meta.json`, `_retry_state.json` 등
- 상세: 이들 파일은 리뷰 산출물 메타데이터로 테스트 대상이 아님. 테스트 관점 점검 필요 없음.

---

### [INFO] `useUpdateWebChatAppearance` mutation — `per_trigger` 경로 테스트가 spec 의도와 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/__tests__/use-web-chat.test.ts` line 59–81
- 상세: `tokenStrategy=per_trigger` 를 그대로 전달하는 케이스를 테스트하지만, `spec/7-channel-web-chat/3-auth-session.md §2·§R3` 은 `per_trigger` 를 **미지원·배제** 로 명시한다. 이 테스트는 "per_trigger 도 전달 가능하다"는 사실을 검증하는데, 실제로는 콘솔이 per_trigger 를 절대 보내지 않아야 하는 경로다. 현재 구현의 타입 유니언(`"per_execution" | "per_trigger"`)에 per_trigger 가 남아 있어 이 테스트가 의도치 않게 허용 동작을 문서화한다.
- 제안: per_trigger 테스트 케이스를 "콘솔에서는 per_trigger 를 보내면 안 된다"는 방어 테스트로 대체하거나, 최소한 주석으로 "이 경로는 콘솔에서 사용하지 않아야 함(spec §R3)" 을 명시하면 향후 오용을 방지할 수 있다.

---

### [WARNING] `useAppearanceDraft` — `localStorage` 오염 값 적용 후 persist 경로 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/__tests__/use-appearance-draft.test.ts`
- 상세: 현재 테스트는 서버 seed·localStorage seed·sanitize·isDirty/markSaved 를 커버한다. 그러나 `setDraft` 호출 후 localStorage 에 실제로 저장되는지(persist 경로), 그리고 저장된 값이 다음 마운트 시 올바르게 읽히는지(round-trip 경로)는 검증하지 않는다. 이 경로가 누락되면 localStorage 직렬화/역직렬화 로직의 결함이 실수로 넘어갈 수 있다.
- 제안: `setDraft` 호출 후 `window.localStorage.getItem(key)` 가 갱신된 JSON 을 포함하는지 단언을 추가하고, 이어서 동일 key 로 훅을 재마운트했을 때 해당 값으로 시드되는지 round-trip 테스트를 작성한다.

---

### [WARNING] `LivePreview` — `endpointPath` / `locale` 변경 시 iframe 재마운트(key 교체) 동작 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx`
- 상세: spec `5-admin-console §6.1 step 5` 는 "`endpointPath`/`locale` 변경 시만 iframe key 를 바꿔 재마운트" 규칙을 명시한다. 현재 테스트는 외형만 바뀔 때 재마운트 없이 `wc:boot` 재전송하는 경로는 검증하지만, `endpointPath` 또는 `locale` 이 변경될 때 iframe 이 실제로 재마운트(다른 `contentWindow`)되는지 검증하는 테스트가 없다. 재마운트 로직 결함 시 boot 상태가 올바르게 초기화되지 않을 수 있다.
- 제안: `endpointPath` 변경 후 `contentWindow` 가 이전과 달라졌는지(또는 이전 `contentWindow` 에 postMessage 호출이 없고 새 `contentWindow` 에만 `wc:boot` 가 전달됐는지) 검증하는 테스트를 추가한다.

---

### [WARNING] `EmbedConfigService` — workspace findOne 가 `null` 을 반환하는 케이스(trigger 는 있으나 workspace 미존재) 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/modules/hooks/embed-config.service.spec.ts`
- 상세: 현재 테스트는 (a) workspace 존재·allowlist 있음, (b) workspace 존재·allowlist 없음, (c) trigger null, (d) DB 오류 를 커버한다. 그러나 trigger 는 존재하지만 workspace 가 null 을 반환하는 경우(예: 삭제된 워크스페이스)가 커버되지 않는다. `EmbedConfigService.resolve` 의 해당 경로가 어떻게 동작하는지(NPE 또는 안전한 fallback) 명시되지 않아 프로덕션 오류 위험이 있다.
- 제안: `trigger: { workspaceId: 'ws-deleted' }` + `workspace: null` 조합으로 서비스가 `{ allowlist: [], enforce: false }` 를 안전하게 반환하는지 테스트를 추가한다.

---

### [WARNING] `TriggersService` 저장 테스트 — `mergeExternalConfig` 가 appearance 를 silent-delete 하는 엣지 케이스 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts` line 155–184
- 상세: spec `5-admin-console §4` 와 EIA spec 주의사항은 `PATCH` 시 `interaction` 전체가 교체되므로 `appearance` 를 생략하면 기존 저장된 외형이 조용히 소실(silent deletion)된다고 명시한다. 현재 테스트는 appearance 를 포함해 PATCH 하는 경로만 검증한다. appearance 없이 PATCH 할 때(예: `enabled` 토글만) 기존 appearance 가 null 이 되는지, 그리고 이 동작이 의도된 것임이 테스트로 문서화돼 있는지 확인되지 않는다.
- 제안: `interaction: { enabled: false, tokenStrategy: 'per_execution' }` (appearance 없음)으로 update 했을 때 `result.config.interaction?.appearance` 가 undefined/null 이 되는지 검증하는 테스트를 추가하고, 코멘트로 "이것이 의도된 silent-delete 동작(spec §4 경고 참조)"을 명시한다.

---

### [INFO] `buildBootConfig` — `appearance.zIndex` 는 콘솔 저장 대상 외라는 경계값 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/web-chat/__tests__/snippet.test.ts`
- 상세: spec `5-admin-console §4` 는 `appearance.zIndex` 를 콘솔 저장 대상에서 제외(스니펫 직접 편집 전용)한다. 현재 스니펫 테스트는 `zIndex` 를 포함한 appearance 가 `buildBootConfig` 를 통해 올바르게 보존되는지만 확인한다. 반대로, `useAppearanceDraft` 나 `draftToBootInput` 에서 `zIndex` 가 콘솔 저장 경로에 포함되지 않아야 한다는 경계를 명시적으로 테스트하는 케이스가 없다.
- 제안: `draftToBootInput` 에서 `zIndex` 가 `appearance` 출력에 포함되지 않는지(콘솔 draft 는 zIndex 를 관리하지 않음) 단언을 추가한다.

---

### [INFO] `CreateWebChatDialog` — `mutateAsync` 반환값에서 `id` 추출 실패 시(undefined) `onCreated` 호출 동작 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/components/web-chat/__tests__/create-web-chat-dialog.test.tsx`
- 상세: 현재 테스트는 성공·실패 두 경로를 커버하지만, `mutateAsync` 가 resolve 됐지만 반환값에 id 가 없는 경우(`extractCreatedId` 가 `undefined` 를 반환)에 `onCreated` 가 어떻게 동작하는지(undefined 로 호출, 또는 조건부 호출) 검증이 없다. 서버 응답 shape 이 예상과 다를 때의 복원력이 검증되지 않는다.
- 제안: `h.mutateAsync.mockResolvedValue({})` (id 없는 응답)로 모킹해 `onCreated` 호출 여부와 다이얼로그 닫힘 동작을 검증하는 케이스를 추가한다.

---

### [INFO] `widget-base` — `getWidgetCdnBase` 함수가 테스트에서 직접 검증되지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/src/lib/web-chat/__tests__/widget-base.test.ts`
- 상세: `widget-base.ts` 에서 export 된 `getWidgetCdnBase()` 함수가 테스트 import 목록에 없다. `getWidgetBase` 와 동일한 로직을 공유하더라도, 이 함수가 외부에 노출되는 public API 라면 독립적인 검증이 필요하다. 현재는 `getWidgetBase` 를 통한 간접 검증만 이루어진다.
- 제안: `getWidgetCdnBase` 의 공개 API 계약이 `getWidgetBase` 와 어떻게 다른지 명확히 하고, 다르다면 별도 테스트를 추가한다.

---

### [INFO] e2e 테스트 — 외형 저장(PATCH) 플로우가 e2e mock 범위에서 제외됨
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/frontend/e2e/web-chat/console.spec.ts`
- 상세: 현재 e2e 는 인스턴스 목록 표시·생성·viewer RBAC 을 커버하지만, 외형 빌더 폼 조작 → 저장 버튼 클릭 → PATCH mock 응답 → isDirty 해제 흐름은 검증되지 않는다. 외형 저장은 이번 PR 의 핵심 신규 기능(per-instance 서버 저장, spec §4, 결정 2026-06-24)이므로 e2e 수준 검증이 없으면 회귀 감지 사각지대가 생긴다.
- 제안: PATCH `/api/triggers/:id` 를 mock 하고 외형 색상 변경 → 저장 → 성공 토스트 노출 + 스니펫 갱신을 검증하는 e2e 테스트 케이스를 추가한다. (unit 테스트 `use-web-chat.test.ts` 의 SUMMARY#7 에 해당하는 e2e 보완)

---

### [INFO] `QueryTriggerDto.interactionEnabled` — `'0'`, `'yes'`, `'no'` 등 비표준 입력의 경계값 미포함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webchat-console-95fe1e/codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` line 616–665
- 상세: 현재 SUMMARY#5 테스트는 `'true'`, `'false'`, `true`, `undefined`, `'1'` 을 커버한다. HTTP 쿼리스트링에서 `'0'`(`'false'` 와 동일한지?), `'yes'`, `'no'`, `''`(빈 문자열) 등이 어떻게 처리되는지 명시되지 않아 API 클라이언트가 다양한 형태로 쿼리를 보낼 때 예측 가능한 동작이 보장되지 않는다.
- 제안: `'0'` → `false`, `''` → `undefined` 또는 `false` 중 어느 동작이 의도인지 결정하고 해당 케이스를 테스트에 추가한다.

---

## 요약

이번 변경에 대한 테스트 커버리지는 전반적으로 양호하다. 핵심 신규 기능 — `WebChatAppearanceDto` DTO 검증, `QueryTriggerDto.interactionEnabled` Transform, `useUpdateWebChatAppearance` mutation, `useAppearanceDraft` 생명주기, `LivePreview` postMessage 프로토콜, `buildWebChatSnippet` XSS 이스케이프, `EmbedConfigService` fail-open 정책, `TriggersService` interaction.appearance 저장, e2e 인스턴스 생성·목록·RBAC — 모두 단위 테스트 혹은 e2e 로 커버되어 있다. 주요 미비 사항은 (1) `useAppearanceDraft` localStorage persist round-trip 검증 부재(WARNING), (2) `LivePreview` endpointPath/locale 변경 시 iframe 재마운트 검증 부재(WARNING), (3) `EmbedConfigService` trigger 있음·workspace null 엣지 케이스 부재(WARNING), (4) `TriggersService` 에서 appearance silent-delete(PATCH 시 appearance 생략) 동작이 테스트로 문서화되지 않은 점(WARNING)이다. 외형 저장 e2e 보완과 per_trigger 테스트 케이스의 spec 의도 불일치도 정리가 필요하다.

## 위험도

MEDIUM

STATUS: OK
