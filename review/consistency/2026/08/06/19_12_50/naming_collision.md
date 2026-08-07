# 신규 식별자 충돌 검토 — spec/7-channel-web-chat (impl-done)

## 검토 범위 관찰

`git diff origin/main...HEAD -- code_areas` 로 제공된 실제 diff 는 `codebase/packages/{ai-end-reason,chat-channel-validation,
expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` 의 `scripts.prepare` 셸 로직 변경
(`tsc` 미가용 시 `dist/` 존재 여부로 폴백하던 것을 "typescript resolve 가능 여부"로 바꾸는 빌드 툴링 리팩터)뿐이다. 이
diff 는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV 변수·spec 파일 경로 중 **어느 것도 신규로 도입하지 않는다**
(기존 `scripts` 키 값만 문자열 치환, 신규 키·신규 스크립트명·신규 패키지 없음). 즉 이번 diff 자체에서 발생하는 신규
식별자 충돌은 없다.

target 으로 번들된 `spec/7-channel-web-chat/*.md` 전 문서는 frontmatter `status: implemented` 이며 이번 diff 에도 코드
diff 에도 등장하지 않는다 — 해당 영역은 이번 커밋셋과 무관하게 이미 구현·정착된 기존 상태다. 그럼에도 회귀 방지 차원에서
target 번들이 도입/유지하는 주요 식별자(요구사항 ID·타입명·endpoint·이벤트명·ENV 키)를 코드베이스 전체(`spec/`,
`codebase/`)와 대조해 실제 충돌 여부를 검증했다(아래 발견사항 참고).

## 발견사항

- **[WARNING]** `ChatInstance`(SDK) vs `WebChatInstance`(운영 콘솔) — 같은 "web-chat" 영역 안에서 "Instance" 접미사가
  서로 다른 두 개념에 쓰인다
  - target 신규 식별자: `ChatInstance`(`spec/7-channel-web-chat/2-sdk.md` §5 — `boot()` 가 반환하는 공개 제어 핸들,
    `open/close/show/hide/sendMessage/updateProfile/on/off/shutdown` 메서드를 가진 런타임 객체)
  - 기존 사용처: `WebChatInstance`(`codebase/frontend/src/components/web-chat/use-web-chat.ts:17` `export interface
    WebChatInstance`, `codebase/frontend/src/app/(main)/w/[slug]/web-chat/page.tsx` 에서 소비) — 운영 콘솔의 "웹채팅
    인스턴스"(= `type=webhook` + `config.interaction.enabled` trigger 를 감싼 목록 아이템 엔티티, `spec/7-channel-
    web-chat/5-admin-console.md` §2 "웹채팅 인스턴스 모델")를 나타내는 데이터 타입
  - 상세: 두 식별자는 문자열이 동일하지 않아 컴파일/런타임 충돌은 없지만, 같은 제품 영역 문서군(SDK vs 운영 콘솔) 안에서
    "인스턴스"라는 동일 어휘가 (a) SDK 가 반환하는 **런타임 제어 핸들**과 (b) 콘솔이 관리하는 **저장된 webhook trigger
    엔티티**라는 서로 다른 개념을 가리킨다. 두 spec 문서(§5 `2-sdk.md`, §2 `5-admin-console.md`) 모두 "인스턴스"라는
    한국어 용어를 그대로 쓰고 있어, 문서만 보고 코드를 찾는 개발자가 어느 타입을 가리키는지 혼동할 여지가 있다(특히
    `5-admin-console.md` §4 가 `[BootConfig](./2-sdk.md#4-boot-config-스키마)` 를 직접 링크하며 두 문서를 넘나든다).
  - 제안: 최소한 spec 산문에서 SDK 의 "인스턴스"(`ChatInstance`, 제어 핸들)와 콘솔의 "인스턴스"(웹채팅 배포 단위,
    `WebChatInstance`)를 최초 언급 시 괄호로 구분 표기(예: "웹채팅 인스턴스(콘솔 엔티티, `WebChatInstance` 와 혼동 금지 —
    SDK 의 `ChatInstance` 런타임 핸들과 다름)")하거나, 코드 타입명을 `WebChatDeployment`/`WebChatTriggerListItem` 처럼
    "Instance" 어휘를 피해 재명명하는 걸 고려. 현재는 이미 구현 완료(`implemented`) 상태라 강제 리네임보다는 문서상
    용어 명확화가 비용 대비 적절.

- **[INFO]** frontmatter `id: web-chat-security` 의 방어적 주석은 현재 실제 충돌 없음(검증 완료)
  - target 신규 식별자: `spec/7-channel-web-chat/4-security.md` frontmatter `id: web-chat-security  # basename
    4-security 와 의도적으로 다름 — 타 영역의 4-security 슬러그와 충돌 방지`
  - 기존 사용처: `find spec -iname "4-security.md"` 결과 이 파일이 유일 — 현재 다른 영역에 동명 `4-security.md` 가
    존재하지 않아 실제 충돌은 없다. `id:` 전수 스캔(`grep -rhn "^id: " spec/`)에서도 `web-chat-*` 6개 ID 는 모두
    유일하다.
  - 상세: 주석이 예방적으로 남긴 우려이며, 검증 결과 현재 시점 기준 실질 충돌은 없다. 다만 향후 다른 영역이
    `4-security.md` 를 신설할 경우를 대비한 주석 자체는 유효하므로 문제 삼을 사항 아님(정보성으로만 기록).

## 기타 검증 완료(충돌 없음)

다음 target 신규/핵심 식별자들을 코드베이스·spec 전체와 대조했으며 모두 유일·일관되게 사용됨을 확인했다:
- 환경변수: `WEB_CHAT_WIDGET_ORIGINS`(backend, CORS allowlist), `NEXT_PUBLIC_WIDGET_CDN_BASE`(frontend, admin) —
  각각 `.env.example`·소스·spec 3자 간 일관. 다른 영역의 동명 키 없음.
  `UNIDENTIFIED_IP_BUCKET`(`public-webhook-quota.service.ts`) — sentinel 상수, 다른 모듈과 충돌 없음.
- 요구사항 ID: `NAV-WC-01`~`06`(`spec/2-navigation/_product-overview.md`) — 다른 NAV-* 접두사와 겹치지 않고
  `spec/0-overview.md`·`5-admin-console.md` 참조와 일치.
- 타입명: `BootConfig`(`codebase/packages/web-chat-sdk/src/types.ts`) — 다른 패키지에 동명 인터페이스 없음.
  `WidgetEvent` — web-chat 영역 외 사용 없음.
- endpoint: `GET /api/hooks/:path/embed-config`, `POST /api/hooks/:path`, `GET/POST /api/external/executions/:id/*`
  — `spec/data-flow/*.md`·webhook/EIA spec 과 명명이 일치하며 타 영역 endpoint 와 경로 중복 없음.
- 이벤트명: `wc:*`(`wc:boot`/`wc:command`/`wc:ready`/`wc:resize`/`wc:event`) — `wc:` 네임스페이스 프리픽스로
  스코프되어 있고 spec 자신도 "타 채널·OAuth popup 메시지와 혼용 방지" 목적을 명시. 실제 충돌 흔적 없음.

## 요약
이번 diff(`origin/main...HEAD -- code_areas`)는 여러 패키지의 `package.json` `prepare` 스크립트 로직만 바꾸는 빌드
툴링 변경으로, 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV 변수·spec 파일 경로 등 신규 식별자 충돌 관점에서
검토할 대상이 diff 자체에는 없다. target 으로 번들된 `spec/7-channel-web-chat` 전 문서는 이미 `implemented` 상태의
기존 스펙이라 이번 커밋셋이 도입한 신규 식별자가 아니지만, 회귀 검증 차원에서 핵심 식별자(ID·ENV·타입·endpoint·이벤트명)를
스팟체크한 결과 실질 충돌은 발견되지 않았다. 유일한 주목할 사항은 SDK 의 `ChatInstance`(런타임 제어 핸들)와 프런트엔드의
`WebChatInstance`(콘솔 엔티티 타입) 간 "Instance" 어휘 중복으로 인한 잠재적 혼동으로, 문자열 자체는 다르므로 CRITICAL
은 아니고 명명 명확화를 권하는 WARNING 수준이다.

## 위험도
LOW
