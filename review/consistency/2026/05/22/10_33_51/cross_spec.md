# Cross-Spec 일관성 검토 결과

**대상**: `plan/in-progress/chat-channel-secret-store-infra.md`
**검토 일시**: 2026-05-22
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

### 1. INFO — Flyway V063 슬롯 점유 선언과 현재 마이그레이션 max(V) 일치 확인

- **target 위치**: `## 범위 Phase 1` — "Flyway `V063__secret_store.sql` — `secret_store` 테이블 신설"
- **충돌 대상**: `codebase/backend/migrations/` 파일 목록 (현재 최신: `V062__trigger_chat_channel_columns.sql`)
- **상세**: target 이 `V063` 을 신규 슬롯으로 지정하고 있다. 현재 main 의 max(V) 는 62이므로 V063 = max+1 규칙 (`spec/conventions/migrations.md §2`) 에 정합. 충돌 없음.
- **제안**: 정합 확인 완료. PR 착수 전 `spec/conventions/migrations.md §5` 절차대로 `ls migrations | tail -2` 로 재확인 권장 (병렬 PR 이 먼저 V062 이후 번호를 점유했을 가능성 대비).

---

### 2. INFO — `spec/1-data-model.md §2.21.1 SecretStore` 엔티티 정의와 target 범위 정합성

- **target 위치**: `Phase 1` — `TypeORM SecretStore entity`, `SecretResolverService` 정의
- **충돌 대상**: `spec/1-data-model.md §2.21.1` (`SecretStore` 테이블: `ref TEXT PK`, `workspace_id UUID`, `encrypted BYTEA`, `created_at`, `updated_at`)
- **상세**: `spec/1-data-model.md §2.21.1` 에 `SecretStore` 엔티티가 이미 정식 정의되어 있고, `spec/conventions/secret-store.md §3.1` 의 DDL 과도 필드 집합이 완전히 일치한다. target 의 Phase 1 이 구현 대상으로 삼는 스키마와 완전히 정합. 직접 모순 없음.
- **제안**: 정합 확인 완료. 구현 시 `spec/1-data-model.md §2.21.1` 을 SoT 로 참조.

---

### 3. INFO — `SecretResolverService` 인터페이스 시그니처와 `secret-store.md §2` 일치

- **target 위치**: `Phase 1` — `SecretResolverService — resolve(ref) → string`, `store(ref, workspaceId, plaintext) → void`, `delete(ref) → void`, `rotate(ref, newPlaintext) → void`
- **충돌 대상**: `spec/conventions/secret-store.md §2 SecretResolver 인터페이스` — `store(ref, workspaceId, plaintext)`, `rotate(ref, workspaceId, newPlaintext)`, `delete(ref)`, `resolve(ref)`, `exists(ref)`
- **상세**: target 의 `rotate(ref, newPlaintext)` 시그니처가 convention 의 `rotate(ref, workspaceId, newPlaintext)` 와 미세하게 다르다 — `workspaceId` 파라미터가 target 에서 누락되어 있다. 동일한 불일치가 `delete(ref)` 에도 없으나 delete 는 `workspaceId` 없이 ref 만으로 삭제하는 것이 convention 과 일치. `rotate` 의 `workspaceId` 누락은 타입 불일치를 야기할 수 있다. 또한 target 에는 `exists(ref)` 함수가 미기술되어 있다.
- **제안**: target 의 Phase 1 설명에서 `rotate(ref, workspaceId, newPlaintext)` 로 통일하고, `exists(ref)` 도 포함 여부를 명시할 것. convention 이 SoT 이므로 convention 변경 없이 target 설명 보완으로 해결.

---

### 4. WARNING — Phase 2: `config.notification.signing.secret` 제거 vs `config.notification.signing.secretRef` 추가 — 기존 `Trigger` 데이터 모델과의 정합

- **target 위치**: `Phase 2` — "`config.notification.signing.secretRef` 추가, 기존 `signing.secret` 제거"
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` — `config JSONB` 의 `notification` 서브 필드 설명 "서브 필드는 [Spec External Interaction API §7.1](./5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) 참조"
- **상세**: `spec/5-system/14-external-interaction-api.md §7.1` 에서 `notification.signing.secret` 이 평문 ref 로 교체되는 부분은 target plan 의 Phase 5 에서 spec 갱신 예정으로 기술되어 있다. 그러나 EIA §3.3 `EIA-AU-01` 은 "Notification secret (`wsk_*`) 는 trigger 생성 시 1회만 평문 노출, 이후 마스킹" 으로 여전히 `signing.secret` 의 존재를 전제한다. secret store 마이그레이션 후 `wsk_*` 토큰이 아닌 `secret://...` ref 를 통해 secret 을 관리하게 되면 이 요구사항 서술의 "1회 평문 노출" 정책과 secret store ref 흐름의 관계가 불명확해진다.
- **제안**: Phase 5 에서 `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-01` 도 갱신 대상에 포함할 것 — "notification signing secret 은 secret store ref 로 저장하며 생성 응답에서 plaintext 1회 노출 후 ref 로 대체" 로 명확화. 현재 Phase 5 의 갱신 대상 목록 (`§7.1`) 에는 `EIA-AU-01` 이 빠져 있다.

---

### 5. WARNING — Phase 3: `ChatChannelConfig.botToken` 제거와 `spec/conventions/chat-channel-adapter.md §2.3` 정합 확인

- **target 위치**: `Phase 3` — "`types.ts` — `ChatChannelConfig.botToken: string` 제거, `botTokenRef: string` 만 유지 (drift 해소)"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` — 현재 `botTokenRef: string` 만 존재 (Changelog: 2026-05-22에 `botToken`/`secretToken` 평문 stub 제거, `botTokenRef`/`secretTokenRef` 단일 형태로 정리 완료)
- **상세**: `spec/conventions/chat-channel-adapter.md §2.3` 의 Changelog(2026-05-22) 에 이미 `botToken`/`secretToken` 평문 제거 + `botTokenRef`/`secretTokenRef` 단일 형태로 정리됐다고 기록되어 있다. 즉, spec 은 이미 ref 전용이고 codebase 의 `types.ts` 와 drift 가 발생한 상태다. target Phase 3 이 이 drift 를 해소한다. spec-codebase 간 기술적 모순은 없으나, plan 의 "drift 해소" 표현이 현재 spec 상태를 정확히 기술하고 있음을 확인.
- **제안**: 정합 확인 완료. 단, Phase 3 에 있는 `chat-channel.dispatcher.ts` 의 "config validation: `botTokenRef` 검증" 은 `spec/conventions/chat-channel-adapter.md §1.1` 의 `setupChannel` 멱등성 계약 (`yes — 같은 config 재호출 OK`) 과 함께 구현 시 주의 필요.

---

### 6. WARNING — Phase 3: `chat_channel_token_v2` 컬럼의 의미 변경 — 평문에서 ref 로

- **target 위치**: `Phase 3` — "기존 token 은 `chat_channel_token_v2` 컬럼 (이미 존재) 대신 secret store 의 별 ref (`secret://triggers/{id}/bot-token.v2`) 로 보관"
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` — `chat_channel_token_v2 Text?` 설명: "Bot token rotation grace 기간 (24h) 동안 사용되는 신규 bot token reference. **Semantic 비대칭 주의**: ... `chat_channel_token_v2` 는 외부 provider bot token reference (예: 텔레그램 Bot API token)"
  - `spec/5-system/15-chat-channel.md §4.2` — `ADD COLUMN chat_channel_token_v2 TEXT NULL` 주석: "컬럼은 ref 만 보관 — plaintext 는 secret_store 테이블의 암호화 컬럼"
- **상세**: `spec/1-data-model.md §2.8` 의 `chat_channel_token_v2` 설명은 "신규 bot token reference" 라고 표기하면서도 내부적으로 이를 secret store ref 임을 명시하고 있다(`spec/5-system/15-chat-channel.md §4.2` 의 DDL 주석에 ref 임이 명시). 따라서 target 의 방향과 spec 이 이미 정합되어 있다. 그러나 `spec/1-data-model.md §2.8` 의 `chat_channel_token_v2` 컬럼 설명 원문이 "신규 bot token **reference**" 와 "ref 를 [Spec Chat Channel §4.2](./5-system/15-chat-channel.md#42-trigger-테이블-신규-컬럼)" 참조로 미뤄두고 있어 data-model 자체에서 이 컬럼이 plaintext 인지 ref 인지 독립적으로 파악하기 어렵다.
- **제안**: Phase 5 갱신 시 `spec/1-data-model.md §2.8` 의 `chat_channel_token_v2` 컬럼 설명을 "secret store ref (`secret://triggers/{id}/bot-token.v2`) — plaintext 미보관" 으로 명확화. 현재 15-chat-channel.md §4.2 의 DDL 주석에는 명시되어 있으나 data-model 의 canonical 설명에서는 불명확.

---

### 7. INFO — Phase 4: `setupChannel` 결과의 `configUpdates.secretToken` → ref 반환 계약

- **target 위치**: `Phase 4` — "`setupChannel` 결과의 `configUpdates.secretToken` 도 ref 로 반환"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.4 SetupResult` — `SetupResult` 에 `configUpdates` 필드 없음. `SetupResult` 는 `{ registeredAt, externalHookUrl?, identity? }` 만 정의.
- **상세**: `spec/conventions/chat-channel-adapter.md` 의 `SetupResult` 인터페이스에는 `configUpdates` 필드가 없다. target 의 Phase 4 가 `setupChannel` 에서 `configUpdates.secretToken` 을 ref 로 반환한다고 기술하는 것은 현재 convention 의 `SetupResult` 타입 정의와 불일치한다. `spec/5-system/15-chat-channel.md §4.1` 의 `secretTokenRef` 는 "setupChannel 이 randomBytes 로 발급해 secret store 에 저장 후 ref 를 configUpdates 로 반환" 이라고 서술하나, convention 의 `SetupResult` 타입에는 이 반환 경로가 미정의 상태다.
- **제안**: `spec/conventions/chat-channel-adapter.md §2.4 SetupResult` 에 `configUpdates?: { secretTokenRef?: string; botIdentity?: { ... } }` 필드를 추가하거나, Phase 5 갱신 시 해당 convention 타입 보완을 포함할 것. target plan 의 Phase 5 범위에는 이 convention 변경이 명시적으로 포함되어 있지 않다.

---

### 8. INFO — `notification_secret_v2` 컬럼의 ref 전환 — data-model 동기화 필요

- **target 위치**: `Phase 2` — "`notification-secret-rotator.service.ts` — `notification_secret_v2` 컬럼도 ref 로 전환"
- **충돌 대상**: `spec/1-data-model.md §2.8 Trigger` — `notification_secret_v2 Text?` 설명: "Secret rotation 기간 (24h grace) 동안 사용되는 신규 secret (NOT NULL 이면 `config.notification.signing.secret` 와 둘 다 검증)"
- **상세**: data-model 의 `notification_secret_v2` 설명은 현재 plaintext 방식으로 서술 (`config.notification.signing.secret` 와 병행 검증). target 이 이를 ref 전환한다면 data-model 설명도 "secret store ref — `secret://triggers/{id}/notification-signing.v2`" 로 갱신되어야 한다. target Phase 5 의 갱신 대상에 `spec/5-system/14-external-interaction-api.md §7.1` 이 포함되어 있으나, `spec/1-data-model.md §2.8` 의 `notification_secret_v2` 컬럼 설명 갱신은 명시적 포함 여부가 불명확하다.
- **제안**: Phase 5 갱신 범위에 `spec/1-data-model.md §2.8` 의 `notification_secret_v2` 컬럼 설명 갱신을 명시적으로 추가. `notification_secret_v2 Text?` 설명을 "secret store ref (`secret://triggers/{id}/notification-signing.v2`). NOT NULL 이면 primary ref 와 둘 다 resolve 후 HMAC 검증" 으로 변경.

---

### 9. INFO — `spec/conventions/secret-store.md` 신설 여부

- **target 위치**: `Phase 5` — "신규 `spec/conventions/secret-store.md` — secret store 추상화 convention 정식 도입"
- **충돌 대상**: `spec/conventions/secret-store.md` — 파일이 이미 존재하며 완전히 작성되어 있음 (Changelog: 2026-05-22 v1 신설)
- **상세**: target Phase 5 에 "신규 `spec/conventions/secret-store.md` 정식 도입" 이라고 기술되어 있으나, 검토 시점에 `spec/conventions/secret-store.md` 는 이미 존재하고 완전한 내용을 담고 있다. target plan 이 본 spec 도입을 추적하는 것이라면, Phase 5 의 해당 항목은 "신규 도입" 이 아닌 "구현 완료 확인" 또는 제거가 필요하다. plan 의 in-progress 특성상 spec 선행 작성 후 plan 을 작성한 순서라면 이슈가 없으나, plan 을 읽는 사람에게 혼동 유발 가능.
- **제안**: Phase 5 의 해당 항목을 "✅ `spec/conventions/secret-store.md` 도입 완료" 로 업데이트하거나, 해당 spec 이 구현과 함께 도입됐다는 사실을 명확화.

---

### 10. INFO — `spec/conventions/chat-channel-adapter.md §2.3` CCH-SE-03 v1 plaintext stub 제거 이미 완료

- **target 위치**: `Phase 5` — "`spec/conventions/chat-channel-adapter.md §2.3` — `ChatChannelConfig.secretToken?` 의 v1 plaintext 주석 제거"
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 Changelog` (2026-05-22) — "`botToken`/`secretToken` 평문 stub 제거, `botTokenRef`/`secretTokenRef` 단일 형태로 정리 완료" 이미 기재됨
- **상세**: 발견사항 5와 동일. Phase 5 의 해당 갱신 항목도 이미 완료된 상태임.
- **제안**: Phase 5 갱신 항목 중 이미 완료된 spec 변경 사항을 명시적으로 체크/삭제하여 plan 의 remaining scope 를 정확히 기술.

---

## 요약

Cross-Spec 일관성 관점에서 target plan 은 `spec/1-data-model.md §2.21.1`, `spec/conventions/secret-store.md`, `spec/conventions/chat-channel-adapter.md §2.3` 등 관련 spec 과 전반적으로 정합되어 있다. CRITICAL 등급의 직접 모순은 발견되지 않았다. 주요 유의사항은 세 가지다. (1) Phase 5 의 갱신 범위가 `spec/5-system/14-external-interaction-api.md §3.3 EIA-AU-01` 과 `spec/1-data-model.md §2.8` 의 `notification_secret_v2` 컬럼 설명을 누락하고 있어 구현 완료 후 data-model 과 EIA spec 에 plaintext 전제 서술이 잔류할 가능성이 있다. (2) `spec/conventions/chat-channel-adapter.md §2.4 SetupResult` 타입에 `configUpdates` 반환 경로가 미정의 상태여서 Phase 4 구현 시 convention 과의 타입 불일치가 발생할 수 있다. (3) Phase 1 의 `SecretResolverService.rotate` 시그니처에서 `workspaceId` 파라미터가 누락된 점도 구현 단계에서 convention 위반이 될 수 있다. 세 가지 모두 WARNING 등급이며 spec 보완으로 해결 가능하다. Flyway V063 슬롯 번호는 현재 max(V062) 기준으로 정합된다.

---

## 위험도

LOW
