# 요구사항(Requirement) 리뷰 결과

리뷰 대상: Follow-up 13건 일괄 처리 (2026-06-24) — 배포 wiring, 백엔드 서버 저장, 서버 필터, 테스트 커버리지, UX, 코드 품질, 선재/spec
기준 spec: `spec/7-channel-web-chat/5-admin-console.md`, `spec/7-channel-web-chat/2-sdk.md`

---

## 발견사항

### [INFO] `WebChatAppearanceDto` 에 `@IsObject()` 장식자가 `@ValidateNested()` 와 함께 사용됨 (중복·무해)
- 위치: `codebase/backend/src/modules/triggers/dto/interaction-config.dto.ts` (diff line +58~60)
- 상세: `class-validator` 에서 `@ValidateNested()` 단독으로도 객체를 재귀 검증하며 `@IsObject()` 가 없어도 동작한다. `@IsObject()` 를 함께 붙이면 `null` 입력 시 `isObject` 에러가 먼저 발생해 `@IsOptional()` 과 의미가 중복되지만 실질적 버그는 없다. 오히려 `@IsOptional()` + `@IsObject()` 조합은 값이 전달될 경우 객체 타입임을 추가로 강제해 다층 방어 의도로 볼 수 있다.
- 제안: 현 상태 유지 가능. 코드 정리를 원하면 `@IsObject()` 를 제거해도 `@ValidateNested()` + `@Type()` 이 올바르게 동작한다.

---

### [INFO] `interactionEnabled` Transform: `value === false` 케이스가 `false` 반환 — 기능 정확
- 위치: `codebase/backend/src/modules/triggers/dto/query-trigger.dto.ts` line 42
- 상세: `@Transform(({ value }) => value === true || value === 'true')` 는 `'false'` 문자열을 `false` 로 올바르게 처리한다. 코드 주석도 `@Type(() => Boolean)` 오역 이유를 명확히 설명한다. `interactionEnabled=false` 필터도 JSONB 비교에서 `false` 값과 정확히 매칭된다.
- 제안: 현 상태 유지.

---

### [WARNING] `widget-app.tsx` — `visible=false` 시 `{ width: 0, height: 0, state: "collapsed" }` 송신이 spec §3 과 불일치 가능성
- 위치: `codebase/channel-web-chat/src/widget/widget-app.tsx` line 27
- 상세: `2-sdk §3` wc:resize 스키마 정의는 `{ width?, height?, state?: 'collapsed' | 'expanded' }` 이며, 0px 전송에 대한 명시적 기술은 없다. spec §3 에서 "collapsed ↔ expanded 전환 시 iframe 박스가 따라 변하지 않으면 클릭 영역·스크롤이 깨진다"고 하며, `width: 0, height: 0` 이 "호스트 페이지 클릭 방해 제거"라는 비명시 동작을 수행한다. SDK `bridge.ts` `applyResize` 는 숫자형 width/height 를 `px` 로 변환해 `0px` 로 적용하므로 실제 기능은 동작한다. 그러나 spec §3 에는 이 "hidden → 0px" 동작이 명세되어 있지 않다. 코드 주석이 의도를 설명하므로 의도적 확장임은 명확하다.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + `spec/7-channel-web-chat/2-sdk.md §3` wc:resize 표에 "hidden/blocked 상태 시 `{ width: 0, height: 0, state: 'collapsed' }` 를 emit 해 iframe 박스 점유 제거" 항목 추가. spec §3 에 해당 시멘틱이 명세돼야 한다.

---

### [INFO] `use-appearance-draft.ts` — `seedDraft` 가 mount 시 두 번 호출됨 (성능 준최적화)
- 위치: `codebase/frontend/src/components/web-chat/use-appearance-draft.ts` lines 99 ~103
- 상세: `useState(() => seedDraft(...))` 와 `useState(() => JSON.stringify(seedDraft(...)))` 에서 `seedDraft` 가 각 초기화 시 한 번씩 독립적으로 호출된다. `seedDraft` 는 `localStorage.getItem` 을 포함하므로 마운트 시 두 번 읽게 된다. StrictMode 이중 실행까지 고려하면 최대 4회. 기능상 버그는 아니다.
- 제안: 현 상태 수용 가능. 성능이 문제가 될 경우 단일 `useMemo` 또는 초기값 변수 공유로 개선 가능.

---

### [INFO] `useUpdateWebChatAppearance` — `enabled: true` 하드코딩이 기존 `enabled=false` 인스턴스에 변경을 유발할 수 있음
- 위치: `codebase/frontend/src/components/web-chat/use-web-chat.ts` line 2027
- 상세: `mutationFn` 에서 `enabled: true` 를 항상 고정 전송한다. 그러나 콘솔 자체가 `interactionEnabled=true` 인 인스턴스만 목록에 표시하므로(`useWebChatInstances` 필터), 이 mutation 은 이미 `enabled=true` 인 인스턴스에만 적용된다. 따라서 실제 business logic 위반은 없다. spec `5-admin-console §4` 는 "PATCH 는 `enabled`·`tokenStrategy` 를 함께 보내 보존한다"고 명시하며 `enabled: true` 고정이 합리적이다.
- 제안: 현 상태 유지.

---

### [INFO] `live-preview.tsx` — `previewHeight` 상태 리셋이 `setSrcKey`/`setStatus` 와 동기 패턴으로 처리됨
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` line 64 (`setPreviewHeight(PREVIEW_HEIGHT)`)
- 상세: `srcKey !== iframeSrc` 조건 분기에서 `setPreviewHeight(PREVIEW_HEIGHT)` 를 동기 호출한다. 이 패턴은 렌더 중 setState 로 React 가 추가 렌더를 유발하지만, `setSrcKey`·`setStatus` 도 동일 패턴이므로 신규 도입이 아닌 기존 패턴 답습이다. 기능상 문제없다.
- 제안: 현 상태 유지.

---

### [INFO] [SPEC-DRIFT] `wc:resize` host 처리 명세가 `2-sdk §3` 에 추가됐으나 LivePreview 의 clamp 범위(320~640px) 는 spec 에 미기재
- 위치: `codebase/frontend/src/components/web-chat/live-preview.tsx` lines 726, 727 (`PREVIEW_HEIGHT=320`, `PREVIEW_MAX_HEIGHT=640`)
- 상세: spec `2-sdk §3` 는 "host 가 `wc:resize` payload 에 맞춰 iframe 크기를 적용한다"고만 명세하며 콘솔 전용 clamp 범위는 언급이 없다. 이 clamp 는 콘솔 UI 레이아웃 보호를 위한 합리적 구현 결정이며 코드를 되돌릴 이유가 없다.
- 제안: `[SPEC-DRIFT]` — 코드 유지 + `spec/7-channel-web-chat/5-admin-console.md §6` 라이브 미리보기 항목에 "콘솔 미리보기 iframe 높이: wc:resize 수신 시 `[320, 640]` px 범위로 clamp 적용" 한 줄 추가.

---

### [INFO] `create-web-chat-dialog.test.tsx` — `extractCreatedId` mock 이 실 구현과 동일 동작인지 미검증
- 위치: `codebase/frontend/src/components/web-chat/__tests__/create-web-chat-dialog.test.tsx` line 1459~1461
- 상세: mock 에서 `extractCreatedId = (c) => c?.data?.id ?? c?.id` 로 정의했는데 이는 실제 구현과 동일하다. 그러나 mock 이 잘못 정의되어도 테스트가 통과할 수 있어 실 구현 변경 시 drift 위험이 있다. 기능 리스크는 낮다.
- 제안: 현 상태 수용 가능.

---

### [INFO] `e2e/helpers/mock-auth.ts` — `PAGE_READY_TIMEOUT=15_000` 이 e2e 전체 기본 timeout 과 독립적으로 정의됨
- 위치: `codebase/frontend/e2e/helpers/mock-auth.ts` line 846
- 상세: Playwright 기본 `expect` timeout 이 설정 파일에 별도 있을 경우 이 상수와 충돌할 수 있지만, `timeout` 옵션으로 명시하는 용도이므로 기능상 문제없다.
- 제안: 현 상태 유지.

---

### [INFO] `widget-app.test.tsx` — boot 전 mounted collapsed 알림 assertion 이 `postSpy` 에서 origin `expect.anything()` 로 느슨하게 검증
- 위치: `codebase/channel-web-chat/src/widget/widget-app.test.tsx` line 694
- 상세: `expect.anything()` 으로 targetOrigin 을 느슨하게 검증하나, `host-bridge.test.ts` 에 이미 origin 핀 동작을 정밀 검증하는 별도 테스트가 존재(`sendResize 는 핀된 host origin 으로 wc:resize 송신`). 통합 레벨 테스트이므로 느슨한 검증이 허용 가능하다.
- 제안: 현 상태 유지.

---

### [INFO] `schedules-page.test.tsx` 의 전역 `afterEach(cleanup)` 추가 — 의도 명확, 기능 완전
- 위치: `codebase/frontend/src/app/(main)/schedules/__tests__/schedules-page.test.tsx` lines 1204~1206
- 상세: 파일 마지막 렌더가 정리되지 않아 다음 파일로 DOM 이 누수되는 문제를 해소한다. 기존 `beforeEach(cleanup)` 와 상보적으로 동작한다.
- 제안: 현 상태 유지.

---

## 요약

이번 변경은 웹채팅 운영 콘솔 follow-up 13건을 일괄 처리한다. 기능 완전성 측면에서 핵심 기능들—백엔드 `config.interaction.appearance` 서버 저장, `interactionEnabled` JSONB 서버 필터, `wc:resize` 동적 미리보기 높이, `mockAuth` 공용 헬퍼 추출, `CreateWebChatButton` 컴포넌트화, 공유 trigger 타입—이 모두 spec(`5-admin-console §2·§4`, `2-sdk §3`)과 line-level 로 정합한다. 엣지 케이스(null appearance, interactionEnabled undefined 비필터, blocked/hidden visible=false, height clamp)도 코드로 처리되며, 유효성 검증은 백엔드(DTO enum/hex/maxLength)와 프런트(`sanitizeDraft`) 양층에서 적용된다. 에러 시나리오(저장 실패 시 toast.error + 다이얼로그 유지, wc:resize 잘못된 origin 무시)도 정의되어 있다. 발견된 항목들은 모두 INFO 수준—의도적 구현 결정이거나 무해한 코드 패턴이며, spec 에 역반영이 필요한 SPEC-DRIFT 2건(hidden→0px 동작, clamp 범위)은 코드 버그가 아니라 spec 갱신 누락이다. CRITICAL 또는 코드 fix 가 필요한 WARNING 은 없다.

## 위험도

LOW

---

*STATUS: OK*
