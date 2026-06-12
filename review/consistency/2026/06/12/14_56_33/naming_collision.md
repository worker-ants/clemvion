# 신규 식별자 충돌 검토 결과

대상: `spec/5-system/15-chat-channel.md`

---

## 발견사항

### 1. **[CRITICAL]** `WORKSPACE_REQUIRED` — 기존 `WORKSPACE_ID_REQUIRED` 와 의미 중복 충돌

- **target 신규 식별자**: `WORKSPACE_REQUIRED` (HTTP 401, `X-Workspace-Id` 헤더 누락 사유)
- **기존 사용처**: `spec/5-system/3-error-handling.md` §1.3 라인 47 — `WORKSPACE_ID_REQUIRED` (HTTP 400, 동일 조건)
- **상세**: 두 코드가 "X-Workspace-Id 헤더 / JWT workspaceId 부재" 라는 동일한 오류 조건을 서로 다른 이름과 HTTP 상태 코드(400 vs 401)로 기술한다. `3-error-handling.md` 의 canonical 코드는 `WORKSPACE_ID_REQUIRED`(400)이고 `common/decorators/workspace.decorator.ts` 가 발행한다. target spec 은 `WORKSPACE_REQUIRED`(401)을 독자적으로 신설해 `chat-channel.controller.ts:58` 에서 발행하고 있다. 클라이언트가 같은 오류 조건에 대해 두 코드를 별도 분기해야 하는 상황이 발생하며, `error-codes.md` §2 "에러 코드 rename 은 breaking change" 원칙상 하나를 제거하면 기존 클라이언트 계약이 깨진다.
- **제안**: `WORKSPACE_REQUIRED` 를 canonical `WORKSPACE_ID_REQUIRED` 로 통일하고 HTTP 상태 코드를 400 으로 맞춘다. 또는 두 발행 지점의 의미가 실제로 다른 경우(헤더 단독 vs. 헤더+JWT 둘 다 부재) spec 에 의미 차이를 명시하고 `error-codes.md` §3 에 `WORKSPACE_REQUIRED` 를 historical-artifact 로 등록한다. 현재 spec 은 의미 분리 근거를 제공하지 않는다.

---

### 2. **[WARNING]** `INVALID_BOT_TOKEN` vs `BOT_TOKEN_INVALID` — 동일 도메인 내 역방향 명명

- **target 신규 식별자**: 두 코드가 §5.4 응답 표에 나란히 등장: `INVALID_BOT_TOKEN` (400, 입력 형식 오류) + `BOT_TOKEN_INVALID` (400, setupChannel 401/403)
- **기존 사용처**: `spec/5-system/15-chat-channel.md` 자체 내에서 동시 정의. codebase 에서는 `INVALID_BOT_TOKEN` 은 `chat-channel.controller.ts:52`, `BOT_TOKEN_INVALID` 는 `discord.adapter.ts:94` / `triggers.service.ts:975` / 프론트엔드 i18n 에서 발행
- **상세**: 두 코드 모두 "bot token 관련 오류" 라는 같은 범주에 속하지만 `INVALID_BOT_TOKEN` (adjective-noun) 과 `BOT_TOKEN_INVALID` (noun-adjective) 로 순서가 반전되어 있다. `error-codes.md` §1 "도메인 prefix 권장" 원칙(`<DOMAIN>_<CONDITION>`) 하에 둘 다 `BOT_TOKEN_*` 접두사 그룹이어야 의미 파악이 쉬운데, `INVALID_BOT_TOKEN` 은 역방향이다. 클라이언트가 두 코드를 구별하기 위해 이름을 직접 파싱하면 혼동이 발생한다. `3-error-handling.md` 의 공식 카탈로그에는 두 코드 모두 미등록 상태.
- **제안**: `INVALID_BOT_TOKEN` 을 `BOT_TOKEN_FORMAT_INVALID` 또는 `BOT_TOKEN_MISSING` 으로 명명해 `BOT_TOKEN_*` 그룹으로 통일하고, `3-error-handling.md` 또는 `error-codes.md` §3 에 두 코드를 명시적으로 등록한다.

---

### 3. **[WARNING]** `CHAT_CHANNEL_*` 에러 코드군 — 공식 카탈로그 미등록

- **target 신규 식별자**: `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`, `CHAT_CHANNEL_SETUP_FAILED` (§5.4 응답 표)
- **기존 사용처**: `spec/5-system/3-error-handling.md` 및 `spec/conventions/error-codes.md` 어디에도 미등록. 다른 도메인 코드 `CAFE24_*`, `OAUTH_*` 등은 `3-error-handling.md` 에 카탈로그 항목 또는 언급이 존재하나 `CHAT_CHANNEL_*` 는 target spec 내에서만 정의됨
- **상세**: `error-codes.md` §1 "적용 범위" 는 "프로젝트 전체의 에러 코드 문자열"이라 명시한다. `CHAT_CHANNEL_*` 코드군이 공식 카탈로그에 없으면 다른 개발자가 중복 코드를 신설하거나 클라이언트 분기 근거를 찾지 못할 수 있다. `CHAT_CHANNEL_SETUP_FAILED` (502) 는 게이트웨이 오류 범주라 기존 `SERVICE_UNAVAILABLE` 과의 관계도 명시되지 않는다.
- **제안**: `3-error-handling.md` §1 에 `CHAT_CHANNEL_*` 코드군 항목을 추가하거나, 최소한 §1 의 도메인별 섹션에 "Chat Channel 에러는 `spec/5-system/15-chat-channel.md §5.4` 참조" 라는 cross-link를 추가한다.

---

### 4. **[WARNING]** `UNKNOWN_PLACEHOLDER` — `error.details[].code` 자리 정의가 공식 에러 규약 밖

- **target 신규 식별자**: `UNKNOWN_PLACEHOLDER` (Rationale R-CC-15 (c), `VALIDATION_ERROR` 의 하위 세부 코드로 정의)
- **기존 사용처**: `spec/5-system/3-error-handling.md` §2 에서 `details[].code` 패턴을 정의하지만 `UNKNOWN_PLACEHOLDER` 자체는 미등록. `spec/conventions/error-codes.md` 에도 미등록
- **상세**: target spec 은 `UNKNOWN_PLACEHOLDER` 가 top-level `error.code` 가 아니라 `VALIDATION_ERROR` 의 `details[].code` 자리임을 주석으로 설명하지만, 이 패턴의 공식 카탈로그가 없어 다른 도메인의 `VALIDATION_ERROR` sub-code 명명과 일관성이 보장되지 않는다.
- **제안**: `3-error-handling.md §2` 의 `details[].code` 패턴 절에 `UNKNOWN_PLACEHOLDER` 를 예시로 등록하거나 Chat Channel §5.4 응답 계약 표에 각주를 추가한다.

---

### 5. **[INFO]** `id: chat-channel` frontmatter — `spec-impl-evidence.md` 예시와 충돌 없음, 단 convention adapter 와 유사

- **target 신규 식별자**: frontmatter `id: chat-channel`
- **기존 사용처**: `spec/conventions/chat-channel-adapter.md` 의 frontmatter `id: chat-channel-adapter`. `spec/conventions/spec-impl-evidence.md` 의 예시 중 `id: chat-channel` 은 본 파일을 예시로 가리키는 것으로 확인됨 (중복 정의 아님)
- **상세**: `id: chat-channel` 과 `id: chat-channel-adapter` 는 서로 다른 파일의 서로 다른 ID 이므로 실질 충돌은 없다. 다만 두 이름이 같은 도메인을 가리켜 자동화 도구가 prefix match 할 경우 혼동 가능성이 낮게 존재한다.
- **제안**: 현재 상태 유지 가능. 도구가 `chat-channel` prefix 로 문서를 그룹핑할 때 `chat-channel-adapter` 가 포함될 수 있음을 인지할 것.

---

### 6. **[INFO]** `R-CC-N` vs `R1~R9` Rationale ID 혼용 — 명명 컨벤션 불일치

- **target 신규 식별자**: `R-CC-10` ~ `R-CC-17` (신규 Chat Channel Rationale)
- **기존 사용처**: 동일 파일 내 `R1`~`R9`, `R-K` (기존 Rationale). `R-CC-N` prefix 채택 이유는 target 문서 자체의 "Rationale ID 컨벤션" 섹션에 설명됨
- **상세**: `R-CC-N` 과 `R1~R9` 혼용은 target spec 이 의도적으로 택한 전략이며 하위 호환 이유도 명시되어 있다. EIA spec 의 `R10`, `R11` 등 외부 참조 번호와 충돌하지 않기 위한 조치다. 설계 의도가 명문화되어 있어 충돌 위험은 낮다.
- **제안**: 향후 `R1~R9` 를 `R-CC-1~R-CC-9` 로 리넘버링하는 시점에 cross-link 업데이트가 필요함을 plan 에 메모.

---

## 요약

target 문서 `spec/5-system/15-chat-channel.md` 가 도입하는 신규 식별자 중 가장 심각한 충돌은 **`WORKSPACE_REQUIRED`(401) 와 canonical `WORKSPACE_ID_REQUIRED`(400) 의 이름·HTTP 상태 코드 이중 정의**다(CRITICAL). 같은 오류 조건에 두 코드가 공존하면 클라이언트가 어느 쪽을 처리할지 불명확해진다. `INVALID_BOT_TOKEN` / `BOT_TOKEN_INVALID` 역방향 명명 쌍도 동일 도메인 내 표기 불일치로 혼동을 유발한다(WARNING). `CHAT_CHANNEL_*` 에러코드군 전체가 공식 카탈로그에 미등록인 점도 장기적 일관성 유지 위험이다(WARNING). 나머지 항목은 INFO 수준으로 즉각 차단이 필요하지 않다.

## 위험도

**HIGH**
