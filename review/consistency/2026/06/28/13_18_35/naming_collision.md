# 신규 식별자 충돌 검토 결과

검토 대상: `spec/7-channel-web-chat/` (전체 6문서 + `_product-overview.md`)
검토 모드: `--impl-done` (diff-base: `origin/main`)

---

## 발견사항

### [INFO] `4-security.md` 파일명 슬러그가 타 영역 잠재 슬러그와 동일 형태
- target 신규 식별자: `spec/7-channel-web-chat/4-security.md` (frontmatter `id: web-chat-security`)
- 기존 사용처: 동일 파일명 패턴 `4-security.md` 는 현재 타 영역에 없음. 단 `id: web-chat-security` 는 `4-security.md` 파일명과 의도적으로 분리됐음이 주석으로 명문화됨 (`# basename '4-security' 와 의도적으로 다름 — 타 영역의 '4-security' 슬러그와 충돌 방지 (영역 prefix 'web-chat-' 로 전역 유일)`).
- 상세: 타 영역에 `4-security.md` 파일은 현재 없으므로 실제 충돌은 없음. 그러나 향후 다른 영역이 `4-security.md` 를 추가할 경우 슬러그 충돌 위험을 명시적으로 인지·문서화한 상태이며, frontmatter `id` 는 `web-chat-security` 로 전역 유일하게 관리됨.
- 제안: 현재 상태 유지. 이미 충돌 방지 주석이 있어 추가 조치 불필요.

### [INFO] `WEB_CHAT_WIDGET_BASE` (SDK 예제 전용)가 spec 에 미등록
- target 신규 식별자: `WEB_CHAT_WIDGET_BASE` — `codebase/packages/web-chat-sdk/examples/npm-usage.ts:7` 에서 `ClemvionChat.setWidgetBase(process.env.WEB_CHAT_WIDGET_BASE ?? ...)` 형태로 등장
- 기존 사용처: spec 에는 `NEXT_PUBLIC_WIDGET_CDN_BASE`(admin 프론트) 와 `WEB_CHAT_WIDGET_ORIGINS`(백엔드) 두 키만 공식 명세됨. `WEB_CHAT_WIDGET_BASE` 는 spec 어디에도 명시되지 않음.
- 상세: `WEB_CHAT_WIDGET_BASE` 는 examples/ 디렉토리의 npm 사용법 예시 코드에서 사용자 임의 env 키로 쓰인 것으로, spec 의 공식 env 키 목록 외부에 존재한다. 이 키는 `setWidgetBase()` 를 호출하기 위해 개발자가 본인 환경에서 임의로 정하는 값이라 공식 spec 키가 아님. 단 spec 의 `2-sdk.md §1/§6.1` 에 `setWidgetBase()` 메서드 자체가 언급되지 않으며(`5-admin-console §6.1` 에만 "sdk `ClemvionChat.setWidgetBase(<widgetBase>)+boot()` 재사용 가능" 비규범 언급), SDK README 에는 `setWidgetBase` 가 구현된 것으로 기재됨. 충돌은 아니지만 spec 과의 경미한 drift 가 있음.
- 제안: `WEB_CHAT_WIDGET_BASE` 는 내부 임시 env 변수명이므로 spec 키 충돌 없음. spec `2-sdk.md` 에 `setWidgetBase()` API 를 명시적으로 언급하거나(현재 비규범 수준으로만 노출) 생략한 의도를 주석으로 남기면 drift 를 방지할 수 있음. 차단 불필요.

### [INFO] `["web-chat-instances"]` React Query 캐시 키가 spec 미등록
- target 신규 식별자: `WEB_CHAT_INSTANCES_KEY = ["web-chat-instances"]` — `codebase/frontend/src/components/web-chat/use-web-chat.ts:42`에 정의. `5-admin-console.md §2.1` 에서 "콘솔 전용 캐시(`["web-chat-instances"]`)"로 산문 언급됨.
- 기존 사용처: 타 영역의 React Query 키 체계에 `web-chat-instances` 와 겹치는 기존 키 없음.
- 상세: spec 산문에 캐시 키명이 기재되어 있어 SoT 로 볼 수 있으나, 공식 식별자 레지스트리가 없어 향후 동명 키가 타 피처에서 우발적으로 도입될 위험이 있음. 현재는 충돌 없음.
- 제안: 참고 사항. 차단 불필요.

---

## 요약

`spec/7-channel-web-chat/` 전체 6문서가 도입하는 신규 식별자(spec frontmatter ID, 엔티티·DTO 명, API endpoint, SSE 이벤트명, ENV 변수, 파일 경로)를 기존 spec 및 구현 코드와 대조한 결과, CRITICAL·WARNING 수준의 충돌은 발견되지 않았다. `4-security.md` 의 frontmatter ID 는 이미 `web-chat-` prefix 로 전역 유일하게 관리되고 있으며 파일명-ID 불일치는 의도적으로 문서화되어 있다. 신규 ENV 변수(`NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS`)와 기존 env 키 사이에 중복 없고, `GET /api/hooks/:endpointPath/embed-config` 엔드포인트도 기존 webhook spec(12-webhook.md)에서 명시적으로 스코프 밖으로 위임·허용되어 있어 충돌이 아니다. `execution.message` SSE 이벤트명은 EIA spec(14-external-interaction-api.md §5.2)에서 공동 정의한 이벤트이며 7-channel-web-chat 이 단독 신설한 것이 아니다. SDK examples 의 `WEB_CHAT_WIDGET_BASE` 와 `setWidgetBase()` 가 spec 에 완전히 등록되지 않은 경미한 drift 가 있으나 충돌 대상이 없어 INFO 수준이다.

---

## 위험도

NONE
