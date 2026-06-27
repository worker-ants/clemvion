# 신규 식별자 충돌 검토 결과

검토 범위: `spec/7-channel-web-chat/` (impl-done, diff-base=origin/main)

---

## 발견사항

### [INFO] `EmbedConfigSource` vs `EmbedConfigDto`/`EmbedConfigService` — "embed" 의미 혼용 (기존 코드, 이번 target 非도입)

- target 신규 식별자: 해당 없음 — `EmbedConfigDto`·`EmbedConfigService` 는 target spec 이 참조하는 기존 구현체
- 기존 사용처:
  - `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` line 48: `EmbedConfigSource` — AI 벡터 임베딩 모델 설정 소스 (embedding model config)
  - `codebase/backend/src/modules/hooks/embed-config.service.ts`: `EmbedConfigService` — 웹채팅 iframe 임베드 허용 allowlist 설정 (iframe embed allowlist)
  - `codebase/backend/src/modules/hooks/dto/responses/embed-config.dto.ts`: `EmbedConfigDto`
- 상세: 두 영역 모두 `EmbedConfig` prefix 를 공유하지만 "embed"의 의미가 다르다. agent-memory 의 `EmbedConfigSource` 는 AI 벡터 임베딩(embedding model), hooks 의 `EmbedConfigService`/`EmbedConfigDto` 는 위젯 iframe 임베드(iframe embedding). 이름 자체는 `EmbedConfigSource` vs `EmbedConfigService`/`EmbedConfigDto` 로 겹치지 않아 TypeScript 식별자 충돌은 없다. 단 동일 모듈 내에서 두 의미의 "embed" 가 혼용될 때 검색·탐색 혼선이 발생할 수 있다.
- 제안: 이번 target 이 도입한 식별자가 아니라 기존 코드의 명명 관행이므로 즉각 변경 의무 없음. 향후 agent-memory 의 `EmbedConfigSource` 를 `EmbeddingModelSource` 등으로 리네임하면 혼선 제거 가능 — 별도 grooming 후보.

---

### [INFO] `GlobalCall` — 신규 export, 충돌 없음

- target 신규 식별자: `export type GlobalCall = [method: string, ...args: unknown[]]` (`codebase/packages/web-chat-sdk/src/loader.ts` line 7)
- 기존 사용처: `web-chat-sdk` 패키지 내부(`loader.ts`, `loader.spec.ts`)에만 존재. 해당 패키지 외부 전체 코드베이스에서 동명 타입 없음.
- 상세: diff 에서 처음 `export` 로 공개된 타입이다. `loader.spec.ts` 가 이를 import 해 큐 항목의 array-like 회귀 검증에 사용한다. 동일 이름의 타입·인터페이스·클래스가 다른 패키지에 없어 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] `ChatInstance` vs `WebChatInstance` — 동일 도메인 내 유사명 (충돌 아님)

- target 신규 식별자: `ChatInstance` — `codebase/packages/web-chat-sdk/src/types.ts` line 60 — SDK `boot()` 반환 타입 (end-user 제어 인스턴스)
- 기존 사용처: `codebase/frontend/src/components/web-chat/use-web-chat.ts` line 17: `WebChatInstance` — admin 콘솔용 webhook trigger 래퍼 타입 (서버 모델)
- 상세: 이름이 다르고(`ChatInstance` vs `WebChatInstance`), 위치도 다르다(SDK 패키지 vs admin frontend). `ChatInstance` 는 외부 위젯 소비자 API, `WebChatInstance` 는 admin 패널이 트리거 목록을 표현하는 내부 모델이다. TypeScript 충돌 없음.
- 제안: 변경 불필요. 두 타입의 역할이 다르므로 현행 명명이 명확하다.

---

### [INFO] spec ID 6종 — 충돌 없음

- target 신규 식별자: `web-chat-architecture`, `web-chat-widget-app`, `web-chat-sdk`, `web-chat-auth-session`, `web-chat-security`, `web-chat-admin-console`
- 기존 사용처: `spec/` 전체에서 `web-chat-` prefix 를 가진 spec id 는 이 6개가 전부.
- 상세: 다른 영역 spec 에 동일 ID 없음. 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] 환경변수 `NEXT_PUBLIC_WIDGET_CDN_BASE`, `WEB_CHAT_WIDGET_ORIGINS` — 기존 키, 충돌 없음

- target 신규 식별자: `NEXT_PUBLIC_WIDGET_CDN_BASE`(frontend 선택), `WEB_CHAT_WIDGET_ORIGINS`(backend)
- 기존 사용처: 두 키 모두 이미 `codebase/frontend/.env.example`, `codebase/frontend/src/lib/web-chat/widget-base.ts`, `codebase/backend/.env.example`, `codebase/backend/src/main.ts`, `codebase/backend/src/common/cors/web-chat-cors.ts` 에 존재.
- 상세: 이번 diff 에서 신규 도입된 env 키 없음. spec 이 기존 키를 정리·참조하는 것이다. 충돌 없음.
- 제안: 변경 불필요.

---

### [INFO] postMessage 이벤트 `wc:*` — 네임스페이스 충돌 없음

- target 신규 식별자: `wc:boot`, `wc:command`, `wc:ready`, `wc:resize`, `wc:event`
- 기존 사용처: 이미 `codebase/packages/web-chat-sdk/` 내부에서만 사용. 다른 채널(OAuth popup 등) postMessage 와 `wc:` prefix 로 구분됨.
- 상세: 코드베이스 전체에서 `wc:` prefix 가 다른 의미로 사용되는 사례 없음. 충돌 없음.
- 제안: 변경 불필요.

---

## 요약

이번 target(`spec/7-channel-web-chat/` + diff)이 도입하는 신규 식별자 중 기존 코드베이스와 충돌하는 항목은 없다. 구현 diff 의 유일한 신규 공개 식별자인 `GlobalCall` 타입은 `web-chat-sdk` 패키지 내부에 완전히 한정되어 있고, 외부에 동명 타입이 없다. 기존부터 존재하던 `EmbedConfigSource`(AI 임베딩 도메인)와 `EmbedConfig*`(iframe 임베드 도메인) 사이의 "embed" 의미 혼용은 주의 대상이나, 이번 target 이 새로 도입한 것이 아니며 TypeScript 식별자 충돌도 아니다.

## 위험도

NONE
