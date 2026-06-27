# 신규 식별자 충돌 검토 결과

## 발견사항

### 요구사항 ID 충돌

충돌 없음. `NAV-WC-01..06` 는 `/Volumes/project/private/clemvion/spec/2-navigation/_product-overview.md` 에서 정의되고 `spec/7-channel-web-chat/5-admin-console.md` 에서 참조만 한다. 다른 영역에서 동일 ID 가 다른 의미로 사용된 사례 없음.

### 엔티티/타입명 충돌

#### INFO: 공통 `id: common` 다중 사용 (기존 패턴, 7-channel-web-chat 무관)

- target 신규 식별자: 해당 없음 (`spec/7-channel-web-chat/` 6개 문서의 frontmatter `id` 는 모두 `web-chat-` prefix)
- 기존 사용처: `spec/4-nodes/{1-logic,2-flow,3-ai,4-integration,5-data,7-trigger}/0-common.md` 에 `id: common` 이 6건 존재
- 상세: target 문서가 `id: common` 을 새로 도입하지 않으므로 충돌 아님. 기존 관찰 사항으로만 기록.
- 제안: 해당 없음 (target 미관여).

#### INFO: `isTextInputSurface` — 위젯 내부 전용 함수, 외부 충돌 없음

- target 신규 식별자: `isTextInputSurface(pending: PendingInteraction | null): boolean` (`spec/7-channel-web-chat/` 구현 diff)
- 기존 사용처: `codebase/channel-web-chat/src/lib/widget-state.ts:30` 에서 신규 export. 다른 패키지(`frontend`, `backend`, `packages/`)에서 동명 함수 없음.
- 상세: 스코프가 `channel-web-chat` 패키지 내부로 한정되어 충돌 없음.
- 제안: 현 상태 유지.

### API endpoint 충돌

#### INFO: `GET /api/hooks/:endpointPath/embed-config` — 기존 데이터플로우 문서와 정합

- target 신규 식별자: `GET /api/hooks/:endpointPath/embed-config` (4-security §3-① / 3-auth-session §3 step 0)
- 기존 사용처: `spec/data-flow/14-chat-channel.md:166` 및 `spec/data-flow/0-overview.md:64` 에서 동일 엔드포인트를 이미 참조
- 상세: 정의가 `spec/7-channel-web-chat/4-security.md` 에 집중되고 data-flow 문서가 그것을 참조한다. 충돌 아님.
- 제안: 현 상태 유지.

다른 신규 API endpoint(`POST /api/hooks/:path`, `GET /api/external/executions/:id/stream`, `POST .../interact`, `POST .../refresh-token` 등)는 모두 기존 EIA spec(`spec/5-system/14-external-interaction-api.md`)에 이미 정의된 것을 위젯이 *사용자*로 재사용하는 것이므로 충돌 아님.

### 이벤트/메시지명 충돌

#### INFO: `wc:` postMessage namespace — 타 이벤트와 충돌 없음

- target 신규 식별자: `wc:boot`, `wc:ready`, `wc:resize`, `wc:event`, `wc:command`
- 기존 사용처: `spec/` 전체 및 `codebase/` 내 타 패키지에서 `wc:` prefix 를 쓰는 postMessage 없음
- 상세: 2-sdk §3 가 명시적으로 "타 채널·OAuth popup 메시지와 혼용 방지"를 위해 `wc:` namespace 를 선택한 것이며, 충돌 사례 없음.
- 제안: 현 상태 유지.

#### INFO: SDK 이벤트명 `conversationStarted`/`conversationEnded` — 위젯 전용, 충돌 없음

- target 신규 식별자: `WidgetEvent` 타입 멤버 `'conversationStarted' | 'conversationEnded'` (2-sdk §5)
- 기존 사용처: spec 전체에서 동명 이벤트로 다른 의미로 사용된 사례 없음. SSE 이벤트명 `execution.waiting_for_input`·`execution.ai_message` 등과 네임스페이스가 다름.
- 상세: 충돌 없음.
- 제안: 현 상태 유지.

### 환경변수·설정키 충돌

#### INFO: `NEXT_PUBLIC_WIDGET_CDN_BASE` — 선택적 신규 키, 충돌 없음

- target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE` (0-architecture §4 / 5-admin-console §R4)
- 기존 사용처: `codebase/frontend/.env.example:53` 에 이미 선언(`# NEXT_PUBLIC_WIDGET_CDN_BASE="https://cdn.example.com"`) + `codebase/frontend/src/lib/web-chat/widget-base.ts` 에서 참조. spec 내 타 영역에서 동명 키 없음.
- 상세: 구현이 spec 과 일치. 신규 도입이 맞으며 기존 env 키(`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WEBHOOK_BASE_URL`, `CORS_ORIGINS` 등)와 겹치지 않음.
- 제안: 현 상태 유지.

#### INFO: `WEB_CHAT_WIDGET_ORIGINS` — 기존 백엔드 키, spec 에서 올바르게 참조

- target 신규 식별자: 0-architecture §4 에서 "기존" 키로 명시
- 기존 사용처: `codebase/backend/src/main.ts` 및 `codebase/backend/src/common/cors/web-chat-cors.ts` 에서 이미 구현. `spec/5-system/14-external-interaction-api.md:738` 에서도 참조.
- 상세: target 이 새로 도입한 식별자가 아니므로 충돌 없음.
- 제안: 현 상태 유지.

### 파일 경로 충돌

#### INFO: `spec/7-channel-web-chat/4-security.md` — 타 영역 `4-security` 파일과 basename 동일, frontmatter ID 로 의도적으로 구분

- target 신규 식별자: `spec/7-channel-web-chat/4-security.md` (frontmatter `id: web-chat-security`)
- 기존 사용처: `spec/5-system/` 하위에 유사 명칭 파일 없음. 다만 basename `4-security` 는 각 영역 `N-name.md` 컨벤션상 동일 번호가 다른 영역에 나타날 수 있음.
- 상세: 해당 파일 frontmatter 에 `# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지 (영역 prefix 'web-chat-' 로 전역 유일)` 주석이 명시되어 있다. 현재 `find` 결과 `spec/*/4-security.md` 는 `spec/7-channel-web-chat/4-security.md` 1건뿐이므로 파일 경로 충돌 없음.
- 제안: 현 상태 유지. 향후 다른 영역에 `4-security.md` 추가 시 동일 주의가 필요.

#### INFO: `spec/7-channel-web-chat/` 영역 번호 `7-` — 기존 번호와 중복 없음

- target 신규 식별자: 영역 폴더 `spec/7-channel-web-chat/` (0-architecture §R3 "번호 7 은 기존 2~5 다음 자리")
- 기존 사용처: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/6-brand.md`, `spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`
- 상세: `spec/6-brand.md` 가 이미 존재하고 `spec/7-channel-web-chat/` 는 그 다음 번호로 신설. 충돌 없음.
- 제안: 현 상태 유지.

---

## 요약

`spec/7-channel-web-chat/` 의 6개 신규 spec 문서(아키텍처·위젯 SPA·SDK·인증세션·보안·운영 콘솔)가 도입하는 식별자들을 전체 spec·codebase·plan 과 대조한 결과, 동일 식별자가 다른 의미로 이미 사용되거나 의미 충돌이 발생하는 사례는 발견되지 않았다. frontmatter `id` 는 모두 `web-chat-` prefix 로 영역 유일성을 확보했고, 환경 변수(`NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS`)·postMessage 네임스페이스(`wc:`)·React Query 캐시 키(`web-chat-instances`)·i18n 키(`sidebar.webChat`, `webChat.*`)·신규 API 엔드포인트(`/embed-config`) 모두 기존 사용처와 겹치지 않는다. 구현 diff 에서 추가된 `isTextInputSurface` 함수도 `channel-web-chat` 패키지 내부로 스코프가 한정된다. 다른 영역의 `4-security` 파일 basename 동일 가능성은 현시점 1건뿐이고 의도적으로 frontmatter ID 로 구분되어 있다.

## 위험도

NONE
