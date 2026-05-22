# Rationale 연속성 검토 — chat-channel-secret-store-infra

검토 모드: spec draft 검토 (--spec)
Target: `plan/in-progress/chat-channel-secret-store-infra.md`
검토 기준 spec Rationale: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/conventions/secret-store.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`

---

## 발견사항

### [WARNING] `SecretResolverService.rotate` 시그니처에서 `workspaceId` 누락

- **target 위치**: Plan Phase 1 — `SecretResolverService` 설명 라인
  - `rotate(ref, newPlaintext) → void`
- **과거 결정 출처**: `spec/conventions/secret-store.md §2 SecretResolver 인터페이스`
  - `rotate(ref: string, workspaceId: string, newPlaintext: string): Promise<void>`
  - 동일 문서 §5.3 Rotation 코드 예시: `await this.secrets.rotate(refV2, workspaceId, newToken)`
- **상세**: 합의된 `SecretResolver` 인터페이스에서 `rotate` 의 두 번째 인자는 `workspaceId: string` — UPSERT 시 workspace 격리를 보장하는 인자다. plan 의 Phase 1 서술은 `rotate(ref, newPlaintext)` 두 인자만 기재해 `workspaceId` 를 누락했다. 이 오기가 구현 단계에서 그대로 반영되면 rotation 시 workspace 격리 invariant 가 깨질 위험이 있다. `spec/conventions/secret-store.md Rationale R4` 는 `workspace_id` 컬럼이 workspace 삭제 cascade 정리 및 격리 근거임을 명시한다.
- **제안**: Plan Phase 1 의 `SecretResolverService` 시그니처를 `rotate(ref, workspaceId, newPlaintext) → void` 로 수정하여 spec 정의와 일치시킨다.

---

### [WARNING] `SecretResolverService` 에서 `exists` 메서드 미기재

- **target 위치**: Plan Phase 1 — `SecretResolverService` 설명 라인 (4개 메서드만 열거)
- **과거 결정 출처**: `spec/conventions/secret-store.md §2 SecretResolver 인터페이스`
  - `exists(ref: string): Promise<boolean>` 포함 — validation 용 메서드로 명시
- **상세**: spec 에 합의된 `SecretResolver` 인터페이스는 5개 메서드 (`resolve`, `store`, `rotate`, `delete`, `exists`) 를 정의한다. plan 은 4개만 기재하고 `exists` 를 생략했다. plan 이 구현 명세를 기술할 때 `exists` 를 의도적으로 제외하는 Rationale 가 없으므로 누락으로 보인다. `exists` 는 신규 `store` 호출 전 중복 감지 등 validation 경로에 사용된다 (`store` 의 non-idempotent 계약과 짝).
- **제안**: Plan Phase 1 의 `SecretResolverService` 열거에 `exists(ref) → boolean` 을 추가하거나, 의도적 생략이면 plan 에 "exists 는 내부 guard 로만 사용" 등 명시 이유를 기재한다.

---

### [INFO] Phase 3 `chat_channel_token_v2` 컬럼 표현 모호

- **target 위치**: Plan Phase 3 — `chat-channel.controller.ts (rotate-bot-token)` 설명 라인
  - "기존 token 은 `chat_channel_token_v2` 컬럼 (이미 존재) 대신 secret store 의 별 ref (`secret://triggers/{id}/bot-token.v2`) 로 보관"
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md §4.2 Trigger 테이블 신규 컬럼`
  - `chat_channel_token_v2 TEXT NULL` — 이 컬럼의 주석: "rotation grace 기간 동안 사용되는 신규 bot token 의 secret store ref (`secret://triggers/{id}/bot-token.v2`). 컬럼은 ref 만 보관"
- **상세**: spec §4.2 는 `chat_channel_token_v2` 컬럼이 secret store ref 를 보관하는 컬럼으로 이미 정의되어 있다. plan 의 "컬럼 대신 secret store ref 로 보관"이라는 표현은 마치 컬럼을 사용하지 않고 ref 만 secret store 에 저장하는 것처럼 읽혀 혼동을 유발한다. 실제로는 컬럼에 ref 문자열을 보관 + secret store 에 암호화된 plaintext 를 저장하는 두 단계 구조가 spec 의 의도이다. 기능적 충돌은 아니지만 표현이 spec 과 어긋나 구현 시 오독 위험이 있다.
- **제안**: Phase 3 서술을 "신규 token 의 ref (`secret://triggers/{id}/bot-token.v2`) 를 `chat_channel_token_v2` 컬럼에 보관 + plaintext 는 secret_store 에 암호화 저장" 으로 명확화한다.

---

### [INFO] `Out of Scope` 의 "application-side AES-GCM 대안" 기재 방식 확인

- **target 위치**: Plan `Out of Scope` — "application-side AES-GCM 대안 — pgcrypto 단일 채택 (PostgreSQL 의존성 단순화)"
- **과거 결정 출처**: `spec/conventions/secret-store.md Rationale R1` — 옵션 4 기각: "Application-side AES-256-GCM (Node crypto) — ... pgcrypto 의 well-tested 구현 + PostgreSQL extension 차원의 audit·키 rotation 도구 활용 가능성 trade-off 로 후자 우위."
- **상세**: plan 이 application-side AES-GCM 을 Out of Scope 로 명시한 것은 spec Rationale R1 의 기각 결정과 정합한다. 재도입 의도가 없고 오히려 재확인 형태로 기재되어 있어 위반은 아니다. 다만 "PostgreSQL 의존성 단순화"라는 기각 근거가 spec Rationale R1 의 "pgcrypto well-tested + audit 활용성 trade-off"와 미묘하게 다른 프레이밍이다 — spec Rationale 가 SoT 이므로 plan 이 별도 근거를 쓰는 것은 불필요하다.
- **제안**: 필수 수정 사항은 아니다. plan 의 기각 근거 표현을 spec Rationale R1 을 인용하는 형태로 정리하면 일관성이 높아진다.

---

## 요약

Target plan 은 전반적으로 `spec/conventions/secret-store.md`, `spec/5-system/15-chat-channel.md`, `spec/5-system/14-external-interaction-api.md` 의 Rationale 와 정합한다 — pgcrypto 단일 채택, self-serving 우선, URI scheme, rotation grace `.v2` 접미사, Trigger FK 미설정, EIA facade 원칙 등 핵심 결정을 모두 충실히 따른다. 다만 두 가지 실질적 주의사항이 있다: (1) `SecretResolverService.rotate` 시그니처에서 `workspaceId` 가 누락되어 spec 합의 인터페이스와 어긋나며, 이는 구현 단계에서 workspace 격리 invariant 를 깰 수 있는 버그로 이어질 수 있다. (2) `exists` 메서드 누락은 spec 완전성 미달로 중복 ref store 시 예외 처리 경로를 놓칠 위험이 있다. Phase 3 의 `chat_channel_token_v2` 컬럼 서술은 기능적 충돌은 아니나 spec 표현과 달라 구현 오독을 유발할 수 있다.

## 위험도

MEDIUM
