# 신규 식별자 충돌 검토 — chat-channel-secret-store-infra

검토 대상: `plan/in-progress/chat-channel-secret-store-infra.md`
검토 일시: 2026-05-22
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

### [INFO] `SS-SE-*` 요구사항 ID — spec convention 파일 내부에서만 사용, 외부 참조 없음

- target 신규 식별자: (plan 본문에서는 직접 ID를 부여하지 않으나, `spec/conventions/secret-store.md` §4 에서 `SS-SE-01` ~ `SS-SE-05` 를 신규 도입)
- 기존 사용처: 같은 파일(`spec/conventions/secret-store.md`) 내부에서만 정의·참조. 타 spec 파일에서는 이 ID를 참조하지 않음(검색 결과: `spec/conventions/secret-store.md:113~117` 에만 존재)
- 상세: `SS-SE-*` prefix 는 기존 `CCH-SE-*` / `EIA-NX-*` / `WH-MG-*` 등의 prefix 체계와 중복되지 않으며 `secret-store` 도메인 전용 ID로 명확히 구별된다. 단, 타 도메인 spec 에서 CCH-SE-03 → `SecretResolver` 로 참조할 때 `SS-SE-*` 를 cross-reference 하지 않고 있어, 두 체계가 독립적으로 분리되어 있다.
- 제안: 충돌 없음. 필요 시 `spec/5-system/15-chat-channel.md §3.4` CCH-SE-03 항목에 `SS-SE-01` / `SS-SE-02` 에 대한 cross-reference 를 추가해 보안 요구사항 연계를 명시할 수 있으나 의무사항은 아님.

---

### [INFO] `SecretStore` 엔티티명 — `spec/1-data-model.md §2.21.1` 에 이미 정의됨, plan 과 완전 일치

- target 신규 식별자: plan Phase 1 — `SecretStore` TypeORM entity, `secret_store` 테이블
- 기존 사용처: `spec/1-data-model.md:640` `### 2.21.1 SecretStore` — 동일 이름으로 이미 spec 에 정의됨. `spec/1-data-model.md:31` 에서 `Workspace → SecretStore (1:N)` 관계도 이미 반영됨.
- 상세: 충돌 없음. plan 의 의도(TypeORM entity 신규 생성)와 spec 의 엔티티 정의가 완전히 일치한다. plan 이 spec 을 그대로 구현하는 형태이므로 명명 충돌이 아니라 정상적인 spec → impl 흐름이다.
- 제안: 해당 없음.

---

### [INFO] `SecretResolverService` — 기존 `SecretResolver` interface 와 명명 구별 필요

- target 신규 식별자: plan Phase 1 — `SecretResolverService`
- 기존 사용처: `spec/conventions/secret-store.md §2` 에서 `SecretResolver` interface 가 정의됨. `spec/5-system/15-chat-channel.md:62`, `spec/conventions/chat-channel-adapter.md:234` 등에서 `SecretResolver` 로 참조됨.
- 상세: 충돌 없음. `SecretResolver` 는 interface 이름이고, `SecretResolverService` 는 NestJS DI 관행에 따른 concrete 구현체 이름이다. TypeScript/NestJS 에서 이 두 이름이 공존하는 것은 표준 패턴(`FooService implements Foo interface`). 단, `SecretResolverService` 가 `SecretResolver` interface 를 `implements` 하는 구조임을 코드 레벨에서 명시해야 한다 — spec convention 의 interface 시그니처(`resolve/store/delete/rotate/exists`)와 구현체가 정확히 대응하도록.
- 제안: `class SecretResolverService implements SecretResolver` 형태로 선언해 spec interface 와의 연결을 명시. 타 모듈에서 DI 토큰으로는 `SecretResolver` (interface token) 를 사용하고 provider 를 `SecretResolverService` 로 바인딩하는 것이 역할 분리상 바람직.

---

### [INFO] `notification-secret-rotator.service.ts` — 이미 존재하는 파일과 Phase 2 scope 충돌 가능성

- target 신규 식별자: plan Phase 2 — `notification-secret-rotator.service.ts` 수정 대상
- 기존 사용처: `codebase/backend/src/modules/triggers/notification-secret-rotator.service.ts` — 이미 존재하며 `NotificationSecretRotatorService` 로 `triggers.module.ts` 에 등록되어 있음 (`triggers.module.ts:import { NotificationSecretRotatorService }`, `providers: [..., NotificationSecretRotatorService]`)
- 상세: plan 이 신규 파일 생성이 아니라 기존 파일 수정을 명시하므로 충돌 아님. 다만 현재 파일이 `config.notification.signing.secret` (평문) 을 promotion 대상으로 처리하고 있으며(`notification-secret-rotator.service.ts:8` 주석 참조), Phase 2 에서 이를 `secretRef` 기반으로 변경하면 동일 서비스 클래스 이름을 유지하되 내부 로직이 달라진다. 명명 충돌은 없으나 서비스 클래스의 책임 기술이 달라질 수 있다.
- 제안: 충돌 없음. Phase 2 수정 시 클래스 이름 변경 불필요. 주석 / JSDoc 에 `v2 → secret store ref` 승격으로 변경된 동작을 갱신하면 충분.

---

### [INFO] `config.notification.signing.secretRef` — 기존 `config.notification.signing.secret` 와 config 키 공간 전환

- target 신규 식별자: plan Phase 2 — `config.notification.signing.secretRef` (JSONB 키)
- 기존 사용처: `codebase/backend/src/modules/external-interaction/notification-webhook.processor.ts:161` — `config.signing?.secret` 으로 평문을 직접 읽음. `codebase/backend/src/modules/triggers/triggers.service.ts:288,362` — `config.notification.signing.secret` 으로 평문 참조.
- 상세: `secretRef` 는 신규 키이고 `secret` 은 기존 키이므로 같은 JSONB path 의 직접 충돌은 아니다. 그러나 plan 이 "`signing.secret` 제거, `signing.secretRef` 추가"를 명시하고 있으므로, Phase 2 구현 중 기존 코드에서 `config.signing?.secret` 을 읽는 경로(`notification-webhook.processor.ts:161`) 를 `secretRef` 경유 resolve 로 교체해야 한다. 미교체 시 런타임에서 `config.signing.secret` 이 `undefined` 가 되어 HMAC 서명이 silent skip 될 위험이 있다.
- 제안: Phase 2 에서 `notification-webhook.processor.ts` 의 `config.signing?.secret` 읽기 경로를 반드시 동반 교체. 단위 테스트에서 `secret` 키 없이 `secretRef` 만 있는 config 로 HMAC 서명 경로를 검증.

---

### [INFO] `chat_channel_token_v2` 컬럼의 의미 전환 — 평문 token 에서 secret store ref 로

- target 신규 식별자: plan Phase 3 — `chat_channel_token_v2` 를 plain token 대신 secret store ref `secret://triggers/{id}/bot-token.v2` 로 사용
- 기존 사용처: `codebase/backend/src/modules/triggers/entities/trigger.entity.ts:142` — `chat_channel_token_v2` 컬럼이 이미 존재하고 `TEXT NULL` 으로 선언됨. `spec/1-data-model.md §2.8` — "신규 bot token reference" 설명에서 `secret store ref` 라고 이미 정의됨. `chat-channel.controller.ts:98` — 현재 주석에서 plain text token 을 보관한다고 명시됨.
- 상세: 컬럼 이름(`chat_channel_token_v2`)은 동일하나 저장값 의미가 "plain token → secret store ref" 로 전환된다. 스키마 변경 없이 값 semantic 만 바뀌는 경우다. 기존 코드(`chat-channel.controller.ts:98`)의 주석이 "plain token 보관"을 명시하고 있어 Phase 3 이후 주석 / 코드가 불일치 상태로 남을 수 있다.
- 제안: Phase 3 구현 시 `trigger.entity.ts` 의 `chatChannelTokenV2` 필드 JSDoc 과 `chat-channel.controller.ts` 의 주석을 `secret store ref` 로 교체. `spec/1-data-model.md §2.8` 에는 이미 ref 임이 명시되어 있으므로 spec 은 최신 상태.

---

### [INFO] Flyway `V063__secret_store.sql` — 기존 마이그레이션 파일과 버전 번호 확인

- target 신규 식별자: plan Phase 1 — `V063__secret_store.sql`
- 기존 사용처: 현재 최신 마이그레이션은 `V062__trigger_chat_channel_columns.sql` (확인됨). `V063` 은 아직 존재하지 않음.
- 상세: 충돌 없음. `V063` 은 다음 순번으로 유효하다.
- 제안: 해당 없음.

---

### [INFO] `spec/conventions/secret-store.md` — 신규 파일이지만 이미 존재

- target 신규 식별자: plan Phase 5 — `spec/conventions/secret-store.md` 신규 생성
- 기존 사용처: 파일이 이미 존재함 (`spec/conventions/secret-store.md`). `spec/1-data-model.md §2.21.1`, `spec/5-system/15-chat-channel.md §3.4`, `spec/conventions/chat-channel-adapter.md §2.3` 등에서 이미 참조됨.
- 상세: plan 이 "신규 `spec/conventions/secret-store.md`" 라고 기술하지만 실제로는 이미 생성된 상태다. 이는 plan 이 spec 작업 완료 전에 작성되었고, spec 작업이 먼저 진행된 것으로 판단된다. 식별자 충돌이 아니라 plan 기술의 시제 불일치다.
- 제안: plan Phase 5 의 "신규 `spec/conventions/secret-store.md`" 항목을 "기 생성됨 (✅)" 으로 표기하거나 체크박스 완료 처리.

---

## 요약

target plan 이 도입하는 신규 식별자(`SecretStore` 엔티티, `SecretResolverService`, `SS-SE-*` ID, `V063__secret_store.sql`, `secret://` URI scheme, `SECRET_STORE_MASTER_KEY` ENV, `secretRef`/`botTokenRef`/`secretTokenRef` JSONB 키)는 기존 코퍼스와 충돌하지 않는다. `SecretStore` 엔티티와 `spec/conventions/secret-store.md` 는 이미 spec 에 선행 정의되어 있어 plan 이 이를 구현하는 형태이며, plan 기술의 시제 불일치가 있을 뿐이다. 가장 주의할 위험은 Phase 2 에서 `config.notification.signing.secret` (평문) 경로를 읽는 기존 코드 2곳(`notification-webhook.processor.ts`, `notification-secret-rotator.service.ts`)이 `secretRef` 로 교체되지 않을 경우 HMAC 서명 silent-skip 이 발생할 수 있다는 점이지만, 이는 충돌이 아닌 구현 주의사항이다.

---

## 위험도

LOW
