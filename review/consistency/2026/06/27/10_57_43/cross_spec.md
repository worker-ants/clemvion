# Cross-Spec 일관성 검토 결과

대상: `spec/7-channel-web-chat/` (구현 완료 후 검토, diff-base=origin/main)
검토 일시: 2026-06-27

---

## 발견사항

### [INFO] `GlobalCall` 타입 신규 export — `spec/7-channel-web-chat/2-sdk.md §5` 공개 타입 계약 미등재

- **target 위치**: `codebase/packages/web-chat-sdk/src/loader.ts` — `export type GlobalCall = [method: string, ...args: unknown[]]`
- **충돌 대상**: `spec/7-channel-web-chat/2-sdk.md §5 공개 인스턴스 타입 계약` — `Unsubscribe`, `WidgetEvent`, `ChatInstance` 만 공개 타입 SoT 로 열거
- **상세**: diff 에서 `GlobalCall` 이 새로 export 됐으나, spec §5 의 "공개 계약 타입 SoT" 목록에 없다. 내부 큐 메커니즘 보조 타입이라 외부 API 계약 의미는 약하나, 테스트 픽스처(`loader.spec.ts`)가 이 타입을 import 하므로 공개 API 로 노출된 상태다.
- **제안**: `2-sdk.md §5` 에 `GlobalCall` 을 "내부 큐 보조 타입 (노출됨)" 으로 footnote 추가하거나, `@internal` JSDoc 태그로 의도를 명시하면 향후 타입 계약 관리 혼선을 막는다. 스펙 수정은 작은 범위.

---

## 확인된 일관성 (충돌 없음)

아래 항목은 다른 spec 영역과 대조하여 **일치** 를 확인했다.

1. **EIA interactionType 3값 일치** — `spec/7-channel-web-chat/0-architecture.md §3` 이 "EIA 외부 `interactionType` ∈ `form`/`buttons`/`ai_conversation` (EIA §6.2, 3값)"으로 명시하고, `spec/5-system/14-external-interaction-api.md §6.2` 라인 543 이 `"interactionType": "form" | "buttons" | "ai_conversation"` 을 정의 — 완전 일치. 내부 4값(`ai_form_render` 추가)과 외부 3값의 매핑은 `spec/conventions/interaction-type-registry.md §1.1` 이 `EIA 외부 3값` carve-out 으로 설명해 모순 없음.

2. **REST 봉투 언랩 (`{ data }`) 일관성** — `spec/7-channel-web-chat/3-auth-session.md §R5` 와 `spec/7-channel-web-chat/0-architecture.md §3 매핑 표` 가 공히 `TransformInterceptor { data }` 래핑 + 위젯 `res.data` 언랩을 기술하며, EIA §4.1 "전송 봉투" 절과 일치.

3. **SSE 5분 버퍼 일치** — `spec/7-channel-web-chat/1-widget-app.md §3.1` 의 "버퍼(5분) 만료" 판단 로직이 `spec/5-system/14-external-interaction-api.md EIA-NF-03` 의 5분 버퍼 규격과 일치.

4. **`retry_last_turn` 외부 미노출 일치** — `spec/7-channel-web-chat/0-architecture.md §3` 의 "retry_last_turn 미지원 — EIA 외부 표면 미노출 내부 UI 한정 명령(EIA-IN-02)" 기술이 `spec/5-system/14-external-interaction-api.md EIA-IN-02` 의 "retry_last_turn 미포함 — 내부 UI 한정" 정의와 일치.

5. **RBAC 모델 일치** — `spec/7-channel-web-chat/5-admin-console.md §7` 의 `viewer`+/`editor`+ 권한 매트릭스가 `spec/2-navigation/2-trigger-list.md` 의 트리거 생성/삭제 권한 규약과 일치한다고 admin-console 본문이 명시.

6. **SDK 큐 replay 로직과 `2-sdk.md §1 R5` 일치** — diff 의 핵심 변경(array-like `arguments` 객체를 `Array.isArray` 로 탈락시키던 버그 → `length` 기반 가드 + `Array.from` 정규화)은 `spec/7-channel-web-chat/2-sdk.md §1 R5` 가 명시한 "스텁은 `push(arguments)` 하므로 큐 항목이 array-like" 사실과 완전히 정합한다. 기존 `Array.isArray` 필터가 spec 의 의도에 반하는 구현 drift 였고, diff 가 이를 수정한다.

---

## 요약

`spec/7-channel-web-chat/` 전체 영역(아키텍처·위젯 SPA·SDK·인증/세션·보안·운영 콘솔)과 다른 spec 영역(`spec/5-system/14-external-interaction-api.md`, `spec/conventions/interaction-type-registry.md`, EIA-NF-03, EIA-IN-02, RBAC 규약) 간 직접 모순은 없다. 구현 diff 는 SDK 로더의 큐 replay 버그를 수정하는 단일 변경으로, spec `2-sdk.md §1 R5` 의 `push(arguments)` 패턴을 올바르게 구현한다. 유일한 INFO 항목은 `GlobalCall` 타입이 신규 export 됐으나 `2-sdk.md §5` 공개 타입 목록에 등재되지 않은 문서 동기화 갭이다.

---

## 위험도

LOW
