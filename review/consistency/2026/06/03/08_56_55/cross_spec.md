# Cross-Spec 일관성 검토 — `spec/7-channel-web-chat`

검토 모드: `--impl-prep` (구현 착수 전)
검토 대상: `spec/7-channel-web-chat` (0-architecture · 1-widget-app · 2-sdk · 3-auth-session · 4-security · _product-overview)
참조 영역: `spec/0-overview.md` · `spec/1-data-model.md` · `spec/5-system/14-external-interaction-api.md` · `spec/5-system/12-webhook.md` · `spec/conventions/interaction-type-registry.md`

---

## 발견사항

### 1. [INFO] CORS 구현 — EIA §8.5 "Implementation Note"와 4-security §2.1 "현황·구현 제약"의 상태 표기 불일치

- **target 위치**: `spec/7-channel-web-chat/4-security.md §2.1` — "구현 제약" 표현("경로-스코프 CORS 를 분리 도입 … 이중 헤더 충돌 방지")
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.5` Implementation Note — "경로-스코프 CORS — **구현됨**"이라 명시하고 `main.ts` / `web-chat-cors.ts` / `modules/web-chat-cors` 코드를 인용
- **상세**: EIA §8.5은 이미 구현 완료로 기술하고 있고 코드 파일까지 참조한다. 반면 4-security §2.1은 동일 사항을 "구현 제약"(미래 과제) 어조로 기술하고 있어 현황 인식이 어긋난다.
- **제안**: `4-security.md §2.1` 의 구현 제약 절을 EIA §8.5와 동기화해 "구현됨"으로 상태를 갱신하거나, 아직 남아 있는 gap만 별도로 명시.

---

### 2. [INFO] `interactionAllowedOrigins` 설명 표기 — data-model §2.2 vs 4-security §2 간 미묘한 의미 차이

- **target 위치**: `spec/7-channel-web-chat/4-security.md §2` — "M1=위젯 CDN(빌트인 허용), M2=고객 도메인(워크스페이스 설정)"
- **충돌 대상**: `spec/1-data-model.md §2.2 Workspace.settings` — `interactionAllowedOrigins` 설명: "위젯 hosted CDN origin 은 빌트인 허용, 본 목록은 BYO-UI 고객 도메인 등 추가 origin 용"
- **상세**: 의미상 충돌은 없으나, data-model의 설명이 EIA §8.5와 4-security §2를 둘 다 교차 참조하는 구조임에도 어느 spec이 키의 단일 진실인지 명확하지 않다. 현재는 두 문서가 동일 내용을 중복 기술하는 수준이다.
- **제안**: `1-data-model.md §2.2` 를 SoT로 확정하고, `4-security.md §2`와 `14-external-interaction-api.md §8.5`는 `§2.2` 참조 표기만 유지. (현 구조로도 큰 위험은 없으므로 INFO)

---

### 3. [INFO] `@workflow/web-chat` npm scope 확정 — plan 파일 의존

- **target 위치**: `spec/7-channel-web-chat/2-sdk.md §서문·§R2` — npm 패키지명 `@workflow/web-chat`, 근거 "eia-sdk-publish.md §결정 #3"
- **충돌 대상**: `plan/in-progress/eia-sdk-publish.md` (plan 파일)
- **상세**: spec이 npm 패키지명 확정을 plan 파일에 위임한다. spec 은 plan 의 "결정 #3"을 참조하므로 plan이 변경되거나 완료 이동 시 spec 링크가 깨진다. spec/conventions 또는 2-sdk.md 본문에 결정을 직접 기입하고, plan 참조는 "배경"으로만 두는 것이 단일 진실 원칙에 부합한다.
- **제안**: `2-sdk.md` 본문에 `@workflow/web-chat` 을 단독 SoT로 기록하고 eia-sdk-publish.md plan 참조를 "근거 이력" 각주로 격하. 구현 착수 전 필수는 아니나 plan lifecycle 에서 plan 파일이 complete 이동 시 링크 깨짐 위험.

---

### 4. [WARNING] 위젯 conversation 상태기계 — SSE "닫힌 사이 in-flight 메시지 버퍼링"과 EIA §5.2 SSE 연결 유지 가정 간 장력

- **target 위치**: `spec/7-channel-web-chat/1-widget-app.md §3.1` — "닫기(collapse): **SSE 연결도 유지**. 닫힌 사이 도착한 in-flight 메시지는 버퍼링 → unread 배지, 재open 시 렌더"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §5.2` — SSE 연결 수 제한 "execution 당 동시 3" (EIA-IN-09). EIA §8.4 Rate Limit 표: "SSE 동시 연결 execution 당 3"
- **상세**: 위젯이 패널을 닫을 때 SSE 연결을 유지한다면 iframe이 백그라운드에 남아 있는 한 문제없다. 그러나 모바일 브라우저/탭 전환 등으로 iframe이 suspend되거나 메모리 절감으로 연결이 끊기는 경우, 위젯은 재연결 흐름(`Last-Event-Id`)으로 복원해야 한다. 1-widget-app.md §3.1은 "SSE 연결 유지"를 기정사실로 기술하지만, 연결이 끊긴 경우의 처리 경로(특히 패널이 닫혀있는 동안 끊김 → 재연결 → unread 배지 갱신)를 명시하지 않는다. EIA의 `Last-Event-Id` 5분 버퍼 복원(§5.2·§EIA-NF-03) 및 만료 시 `execution.replay_unavailable`(계획·미구현)과의 연계 처리가 누락되어 있다.
- **제안**: `1-widget-app.md §3.1`에 "(iframe suspend 등으로 SSE 연결이 끊긴 경우) `Last-Event-Id`로 재연결 후 누락분 수신 → unread 배지 업데이트; 5분 버퍼 만료 시 `GET /:id` snapshot 폴백으로 최신 상태 복원" 절차를 추가하고, EIA §5.2·§EIA-NF-03 교차 참조 명시. 구현 착수 전 처리 경로 불명확 — WARNING.

---

### 5. [WARNING] `per_execution` 토큰 iframe-origin storage 저장 — EIA 스펙 미언급 보안 고려

- **target 위치**: `spec/7-channel-web-chat/3-auth-session.md §3` 세션 시퀀스 — "`executionId`+단명 토큰을 iframe-origin storage 저장 → 재로드 시 `GET /:id`+SSE 재연결"
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.3` Token 일반 규약 — "HTTPS 강제", "iext_* jti 는 Redis blacklist 가능 — execution 종료 시 즉시 blacklist 등록"
- **상세**: EIA §8.3은 `iext_*` 토큰이 execution 종료 시 blacklist 에 등록된다고 기술한다. 위젯은 `executionId`+토큰을 iframe-origin storage에 저장했다가 재로드 시 재사용한다. `expiresAt` 이내라면 EIA-AU-05의 refresh로 갱신 가능하지만, blacklist 등록 여부·storage에서 토큰 삭제 시점(execution 종료 시)·storage 정리 책임이 어느 컴포넌트에 있는지 3-auth-session.md에 명시되지 않았다. 구현 시 storage에 stale 토큰이 남아있고 재로드 시 `401 TOKEN_INVALID`로 실패 후 `[ended]` 처리하는 경로만 3-auth-session.md §3.1의 "만료/410 이면 [ended]" 처리에 위탁하고 있으나, blacklist로 인한 `401`과 만료로 인한 `401`을 구별하는 위젯 처리 경로가 명시되지 않았다.
- **제안**: `3-auth-session.md §3`에 "재로드 시 복원 시퀀스: (1) storage에서 `executionId`+토큰 조회 → (2) `GET /:id` 상태 확인 → `410` 또는 `401(TOKEN_INVALID/TOKEN_EXPIRED)` → [ended] 처리; (3) 정상이면 SSE 재연결"을 명시. execution 종료 시 위젯이 storage를 정리하는 책임도 언급. 구현 착수 전 시나리오 명확화 필요 — WARNING.

---

### 6. [INFO] `ai_form_render` — 위젯 처리 분기 누락 (interaction-type-registry §1.2 미반영)

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md §3 EIA 매핑` — "AI 폼 렌더(render_form blocking): `ai_conversation` 과 동일 경로 처리(별도 분기 아님). 내부 `WaitingInteractionType=ai_form_render` 와의 매핑은 interaction-type-registry §1.2"
- **충돌 대상**: `spec/conventions/interaction-type-registry.md §1.2` — `ai_form_render` 처리 분기 매트릭스, `conversationConfig.pendingFormToolCall` 동봉·`resumeFromAiRenderForm` 등 다수 분기 위치 열거
- **상세**: EIA 외부 표면은 `ai_form_render` → `ai_conversation`으로 통합(3값 노출)이 맞다. 위젯이 `ai_conversation` 페이로드에서 `conversationConfig.pendingFormToolCall` 유무로 `ai_form_render` 상태를 판별하고 Form UI를 렌더해야 한다는 처리 계약이 `1-widget-app.md`에 기재되어 있지 않고 `0-architecture.md §3`의 단 한 줄로만 처리된다. 위젯 SPA 구현 시 interaction-type-registry §1.2의 `ai_form_render` 분기 위치 목록에 위젯 관련 항목을 추가해야 하지만 현 spec은 이를 명시하지 않는다.
- **제안**: `1-widget-app.md §2 화면 구조` 또는 별도 절에 "ai_conversation 수신 시 `conversationConfig.pendingFormToolCall` 유무로 렌더 분기: form 있으면 DynamicFormUI 렌더 + submit_form 제출" 계약 명시. interaction-type-registry §1.2 처리 분기 매트릭스에 위젯 SPA 관련 분기 위치 항목 추가 검토.

---

### 7. [INFO] 요구사항 ID — `spec/7-channel-web-chat` 영역 자체 요구사항 ID 미부여

- **target 위치**: `spec/7-channel-web-chat/_product-overview.md §2 목표/비목표`
- **충돌 대상**: `spec/0-overview.md §4` — "요구사항 식별자(예: NAV-WF-*, ED-AI-*, ND-IF~ND-BG)는 각 영역의 `_product-overview.md` 안에서 사용"
- **상세**: 다른 영역(NAV-WF-*, EIA-NX-*, EIA-IN-*, WH-SC-* 등)과 달리 `spec/7-channel-web-chat`의 `_product-overview.md`는 요구사항 ID를 부여하지 않았다. 구현 추적·coverage audit 시 `spec/conventions/spec-impl-evidence.md` 기반 gap 분석이 어려워진다.
- **제안**: `_product-overview.md`에 `WC-AR-*`(아키텍처), `WC-UI-*`(위젯 UI), `WC-SDK-*`(SDK), `WC-AU-*`(인증/세션), `WC-SC-*`(보안) 등 접두어로 주요 목표 항목을 요구사항 ID화. 구현 착수 후 spec-coverage audit 전에 완료하면 충분(현 시점은 INFO).

---

## 요약

`spec/7-channel-web-chat`은 EIA·Webhook·data-model 등 기존 spec과 **직접 모순되는 항목이 없다**. 아키텍처 레이어 책임 분리(위젯 = pure HTTP client, EIA facade 미추가)·CORS 정책(`interactionAllowedOrigins` 빌트인 + 동적 병합)·per_execution 토큰 전략은 기존 EIA·data-model과 일관되게 기술되어 있다. 다만 두 가지 WARNING이 있다: (1) 패널 collapse 시 SSE 연결 유지 전제 아래 iframe suspend·재연결 시나리오와 EIA `Last-Event-Id` 복원 흐름이 위젯 spec에 명시되지 않아 구현 시 edge-case가 발생할 수 있으며, (2) 재로드 복원 시 storage의 stale 토큰과 EIA blacklist 간 처리 경로가 불명확해 `401` 핸들링 로직에 결함이 생길 수 있다. INFO 항목들은 CORS 구현 상태 표기 불일치·npm scope SoT 위치·interaction-type-registry 매트릭스 미반영·요구사항 ID 미부여로, 구현 직전 해소하면 충분하다.

---

## 위험도

**MEDIUM**

(직접 충돌은 없으나 WARNING 2건이 구현 시 처리 경로 미정의로 실제 결함으로 이어질 수 있음)
