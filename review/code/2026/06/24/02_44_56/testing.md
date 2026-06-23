# Testing 리뷰

## 발견사항

### [WARNING] `WebChatAppearanceDto` 필드 유효성 검증 테스트 부재
- 위치: `/codebase/backend/src/modules/triggers/dto/web-chat-appearance.dto.ts` (신규 파일)
- 상세: `primaryColor` 의 `@Matches(/^#[0-9a-fA-F]{6}$/)`, `headerTitle` 의 `@MaxLength(80)`, `welcomeText` 의 `@MaxLength(500)`, `suggestions` 의 `@MaxLength(1000)`, `disclaimer` 의 `@MaxLength(500)`, `locale` / `position` 의 `@IsIn` 각각에 대해 유효값·경계값·실패값 케이스가 `trigger-dto-validation.spec.ts` 에 전혀 없다. 기존 `CreateTriggerDto — interaction sub-DTO` 테스트는 `interaction: { enabled: true, tokenStrategy: 'per_execution' }` 까지만 커버하며 `appearance` 서브객체를 포함한 케이스가 없다. `WebChatAppearanceDto` 는 공개 설치 스니펫에 흘러가는 필드(주석에 명시)여서 서버단 validation 실패는 보안 다층 방어의 훼손으로 이어진다.
- 제안: `trigger-dto-validation.spec.ts` 또는 별도 `web-chat-appearance-dto.spec.ts` 에서 (1) 유효한 전체 `appearance` 포함 시 에러 없음, (2) `primaryColor` 패턴 위반(`"not-a-color"`) 에러, (3) `headerTitle` 81자 초과 에러, (4) `locale: "fr"` `IsIn` 실패, (5) `position: "top"` `IsIn` 실패를 최소한 커버한다.

### [WARNING] `QueryTriggerDto.interactionEnabled` Transform 경계값 테스트 부재
- 위치: `/codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts`
- 상세: `@Transform(({ value }) => value === true || value === 'true')` 로직이 `'false'` 를 `false` 로 변환하는지, `undefined` 를 그대로 통과시키는지, 비어있는 문자열 `''` 을 `false` 로 처리하는지, `1` / `0` 같은 숫자가 `false` 가 되는지 등 경계 케이스가 DTO 검증 테스트에 없다. 주석에서 "`@Type(() => Boolean)` 은 `'false'` 를 오역"이라 밝혔지만 그 정확성 자체가 테스트로 뒷받침되지 않는다.
- 제안: `trigger-dto-validation.spec.ts` 에 `QueryTriggerDto` 섹션을 추가해 `'true'` → `true`, `'false'` → `false`, `undefined` → undefined(필터 없음), `'1'` → `false`, `1` → `false` 를 `plainToInstance` + `validate` 로 검증한다.

### [WARNING] `useUpdateWebChatAppearance` 뮤테이션 단위 테스트 부재
- 위치: `/codebase/frontend/src/components/web-chat/use-web-chat.ts`
- 상세: 신규 `useUpdateWebChatAppearance` 훅이 (1) `interaction.enabled=true`, `tokenStrategy` 보존, `appearance` 을 PATCH body 에 정확히 포함하는지, (2) 성공 시 `WEB_CHAT_INSTANCES_KEY` + `TRIGGERS_KEY` 를 함께 invalidate 하는지에 대한 단위 테스트가 없다. `web-chat-page.test.tsx` 는 `apiClient.patch` 를 `vi.fn()` 으로만 두고 실제 호출을 검증하지 않는다.
- 제안: `use-web-chat.test.ts` 를 추가(또는 기존 파일에 섹션 추가)해 msw 또는 `apiClient` mock 으로 PATCH 요청 body 와 query invalidation 을 검증한다.

### [WARNING] `WebChatDetail` 저장 버튼 흐름 단위 테스트 부재
- 위치: `/codebase/frontend/src/app/(main)/web-chat/page.tsx` `WebChatDetail` 컴포넌트
- 상세: 저장 버튼 클릭 → `updateAppearance.mutateAsync` 호출 → `markSaved()` → `toast.success`, 그리고 실패 시 `toast.error` 경로가 `web-chat-page.test.tsx` 에서 전혀 검증되지 않는다. `apiClient.patch` 가 `vi.fn()` 으로 선언만 돼 있고 반환값·사이드이펙트 검증 케이스가 없다. `isDirty=false` 인 경우 버튼이 disabled 인지도 미검증이다.
- 제안: `web-chat-page.test.tsx` 에 (1) isDirty=false 시 저장 버튼 disabled, (2) 저장 성공 시 patch 호출 + toast.success, (3) 저장 실패 시 toast.error 케이스를 추가한다.

### [INFO] `widget-app.tsx` blocked/hidden 상태의 `wc:resize({width:0,height:0})` 케이스 미검증
- 위치: `/codebase/channel-web-chat/src/widget/widget-app.tsx` useEffect, `/codebase/channel-web-chat/src/widget/widget-app.test.tsx`
- 상세: `widget-app.tsx` 의 useEffect 에는 `!visible` 분기에서 `sendResize({ width: 0, height: 0, state: "collapsed" })` 를 호출한다. 기존 테스트는 초기 collapsed(런처 박스)와 open 후 expanded 만 검증한다. `blocked` 상태나 `hidden` 상태로 전환 시 `width:0, height:0` 이 실제로 송신되는지가 미검증이다.
- 제안: `widget-app.test.tsx` 에 임베드 불허 시 (`blocked`) `sendResize({ width: 0, height: 0, state: "collapsed" })` 이 송신되는지, hide 커맨드 수신 후 동일한지를 테스트로 추가한다.

### [INFO] `live-preview.tsx` `wc:resize` 최솟값(height < PREVIEW_HEIGHT) clamp 케이스 미검증
- 위치: `/codebase/frontend/src/components/web-chat/__tests__/live-preview.test.tsx`
- 상세: 추가된 `wc:resize` 테스트는 (1) expanded 정상 높이(572) clamp, (2) 과도한 높이(9999 → 640) clamp, (3) 다른 origin 무시를 검증한다. 그러나 `height < PREVIEW_HEIGHT`(예: 100) 인 경우 min 으로 clamp 되는지(`300px` → `320px` 유지)와 `payload.height` 가 없는 경우(`wc:resize` + state만) 높이가 변경되지 않는 케이스가 없다.
- 제안: 두 케이스(`height: 100` → `320px`, `payload` 에 `height` 없음 → `320px` 유지)를 추가해 clamp 로직 완전 커버한다.

### [INFO] `sendResize` 가 `use-widget` actions 에 포함되는지 use-widget-commands 테스트에서 미검증
- 위치: `/codebase/channel-web-chat/src/widget/use-widget.ts`, `/codebase/channel-web-chat/src/widget/use-widget-commands.test.ts`
- 상세: `sendResize` 는 `use-widget.ts` 의 `actions` 반환 객체에 추가됐지만, `use-widget-commands.test.ts` 또는 `use-widget.test.ts` 에서 actions 객체에 `sendResize` 키가 포함되는지 기본 확인도 없다.
- 제안: `use-widget-commands.test.ts` 에 "sendResize 는 actions 에 포함된다" 스모크 테스트를 추가한다(비용 낮고 회귀 방지 효과 있음).

### [INFO] `schedules-page.test.tsx` afterEach cleanup 수정 — 기존 테스트 격리 개선 확인
- 위치: `/codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx`
- 상세: top-level `afterEach(cleanup)` 추가는 "마지막 렌더 DOM 누수 → 다음 파일 간헐 실패" 를 올바르게 해소한다. 이 변경은 positive다. 단, 파일 내 `beforeEach` 에도 `cleanup()` 이 이미 있어 이중 cleanup 이 발생하지만 cleanup() 은 멱등 함수이므로 문제 없다.
- 제안: 이중 cleanup 은 문제없으나 의도 명확화를 위해 beforeEach 의 cleanup() 을 제거하고 afterEach 만 유지하는 것을 고려한다(선택 사항).

### [INFO] `mockConsole` 의 stateful POST mock — 테스트 간 상태 격리 확인 필요
- 위치: `/codebase/frontend/e2e/web-chat/console.spec.ts`
- 상세: `mockConsole` 이 `const triggers = [...initial]` 로 mutable 배열을 공유한다. Playwright 는 각 `test` 를 독립 컨텍스트로 실행하므로 브라우저 레벨 격리는 보장된다. 그러나 같은 describe 내 여러 테스트가 `beforeEach` 없이 `mockConsole` 을 각자 직접 호출하므로 배열 오염 없이 격리돼야 한다 — 현재 구조상 각 테스트가 새 배열 인스턴스를 사용하므로 문제없다.
- 제안: 현 구조 유지. 단 향후 `beforeEach` 에 mockConsole 을 두는 리팩토링 시 공유 배열 참조 오염을 주의한다.

---

## 요약

이번 변경은 테스트 커버리지를 적극적으로 신설했다 — `triggers.web-chat.spec.ts`(백엔드 JSONB 필터·appearance 저장), `use-appearance-draft.test.ts`(시드 우선순위·sanitize·isDirty 전체), `create-web-chat-dialog.test.tsx`(생성 흐름 4케이스), `host-bridge.test.ts`(sendResize), `widget-app.test.tsx`(wc:resize 송신), `live-preview.test.tsx`(resize clamp·origin 검증), e2e console.spec.ts 확장(stateful POST mock·viewer 분기) 등 추가된 테스트의 품질과 격리도는 양호하다. 주요 갭은 `WebChatAppearanceDto` 유효성 검증 단위 테스트 부재(공개 설치 스니펫에 흘러가는 필드라 보안 다층 방어 일부가 미검증), `QueryTriggerDto.interactionEnabled` Transform 경계값 미검증, `useUpdateWebChatAppearance` 뮤테이션 및 저장 버튼 흐름의 단위 테스트 부재이며 이 세 항목은 WARNING 수준이다. 나머지는 INFO — clamp 최솟값·blocked 상태 resize·sendResize actions 포함 확인 등 보완 권장 사항이나 차단은 아니다.

## 위험도

MEDIUM

---

STATUS: SUCCESS
