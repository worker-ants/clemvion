# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**검토 일시**: 2026-05-25

---

## 발견사항

### [WARNING] EIA §6.4 `execution.failed` error.code 예시 네이밍이 `3-error-handling.md §1.4` enum 과 불일치

- **target 위치**: `spec/5-system/15-chat-channel.md §3.5 CCH-ERR-01~04` (분류 입력으로 `error.code` 사용) + `spec/conventions/chat-channel-adapter.md §3.1` 분류 표 (SoT 로 `3-error-handling.md §1.4` 참조)
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §6.4` (payload 예시 `"code": "NODE_FAILED" | "TIMEOUT" | "MAX_ITERATIONS" | "INTERNAL_ERROR" | ...`) vs `spec/5-system/3-error-handling.md §1.4` (실제 enum: `EXECUTION_TIMEOUT`, `MAX_ITERATIONS_EXCEEDED`, `HTTP_4XX` 등)
- **상세**: EIA §6.4 의 `execution.failed` payload 주석이 illustrative 코드 예시 형태로 `NODE_FAILED`, `TIMEOUT`, `MAX_ITERATIONS`, `INTERNAL_ERROR` 를 열거하고 있으나, `3-error-handling.md §1.4` 가 정의하는 실제 ErrorCode enum 에는 이 이름들이 존재하지 않는다 (`EXECUTION_TIMEOUT` / `MAX_ITERATIONS_EXCEEDED` 등의 다른 이름 사용). `15-chat-channel.md §3.5 CCH-ERR-01` 은 분류 알고리즘의 입력으로 `error.code` enum 을 사용하고 Convention §3.1 이 `3-error-handling.md §1.4` 를 단일 진실로 명시하므로, EIA §6.4 의 예시 값이 실제 enum 과 다르다면 구현자가 혼동할 수 있다. 본 불일치는 `15-chat-channel.md` 가 도입한 것이 아니라 기존 EIA spec 에서 비롯된 것이지만, Chat Channel 이 `error.code` 를 분류 결정의 핵심 입력으로 사용하는 첫 consumer 이므로 이 시점에 명확화가 필요하다.
- **제안**: `spec/5-system/14-external-interaction-api.md §6.4` 의 예시 코드를 `"code": "HTTP_4XX" | "LLM_RATE_LIMIT" | "EXECUTION_TIMEOUT" | ...` (실제 enum 일부) 로 교정하거나 "enum SoT 는 `3-error-handling.md §1.4`" 주석으로 명시. 본 spec 자체 수정은 불필요(target 이 올바르게 SoT 를 가리키고 있음).

---

### [WARNING] `SS-SE-01` ID 가 spec 내에서만 참조되고 공식 요구사항 테이블에 미정의

- **target 위치**: `spec/5-system/15-chat-channel.md §4.1` (`botToken` 주석 `SS-SE-01`) + `§5.4.1.1` (`SS-SE-01` 재참조)
- **충돌 대상**: `spec/conventions/secret-store.md §4` (`SS-SE-01` 이 정의된 요구사항 ID 테이블)
- **상세**: `SS-SE-01` 은 `spec/conventions/secret-store.md` 에서 정의된 정식 ID 이며 (grep 확인: `secret-store.md:162` — "plaintext/마스터키는 application 메모리 안에서만 존재. DB query/SQL parameter/log/metric 에 일절 노출 금지"), 두 spec 간의 cross-ref 자체는 올바르다. 그러나 `spec/conventions/chat-channel-adapter.md §2.4` SetupResult 주석도 `SS-SE-01` 을 언급하여 3개 문서가 동일 ID 를 참조하고 있다. ID 정의 위치가 `secret-store.md` 한 곳이므로 충돌은 아니지만, 향후 ID 변경 시 3개 파일을 함께 수정해야 함을 명시적으로 추적하는 체계가 없다.
- **제안**: INFO 수준 위험. 본 검토 기간 중 수정 불필요. 단, `secret-store.md` 변경 시 3개 파일(`15-chat-channel.md`, `chat-channel-adapter.md`, `secret-store.md`) 동시 갱신 의무를 `secret-store.md §7 변경 관리` 항에 명시 권장.

---

### [INFO] `spec/2-navigation/2-trigger-list.md §3` 에 cross-link 추가 약속이 spec 본문에 미반영

- **target 위치**: `spec/5-system/15-chat-channel.md §5.4.1` 마지막 문단 — "`spec/2-navigation/2-trigger-list.md §3` 의 PATCH 설명에 '`config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가 — rotate API 사용' cross-link 가 추가된다."
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §3 API 표` 및 그 하단 PATCH 노트
- **상세**: `2-trigger-list.md §3` 의 PATCH 노트 (line 138) 는 이미 "`config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가" 를 명시하고 있으므로, `15-chat-channel.md §5.4.1` 의 "추가된다" 미래형 약속은 이미 이행된 상태다. 즉 target 에 기술된 약속 문장이 stale — 동작은 정합하지만 약속 문장이 현재 시제로 수정되지 않았다. 충돌이 아닌 표현 불일치.
- **제안**: `15-chat-channel.md §5.4.1` 의 "추가된다" 를 "추가되어 있다" 또는 "이미 반영됨 (`2-trigger-list.md §3` PATCH 노트)" 로 수정. 작업 범위 매우 작음.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 에 `languageLocale` 필드 누락

- **target 위치**: `spec/5-system/15-chat-channel.md §4.1` — `config.chatChannel.languageLocale` 필드 정의 (default='ko', 어댑터 lookup 순서에 사용)
- **충돌 대상**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` TypeScript interface — `languageHints?: Record<string, string>` 는 있으나 `languageLocale?: string` 필드가 없음
- **상세**: `15-chat-channel.md §4.1` 은 `languageLocale` 필드를 `config.chatChannel` 의 정식 구성원으로 정의하고 lookup 순서 `(2)` 에서 명시적으로 참조한다. `Convention §2.3` 의 in-memory `ChatChannelConfig` interface 는 이 필드를 포함하지 않아, 어댑터 구현자가 Convention 의 type signature 만 보면 `languageLocale` 을 접근할 수 없는 것처럼 보인다. 실제 동작은 target spec 에 기술되어 있으므로 충돌은 아니지만, Convention 파일이 단일 진실 인터페이스를 선언한다면 누락된 필드다.
- **제안**: `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` interface 에 `languageLocale?: "ko" | "en"` 추가. 구현 착수 전에 반영하면 type-safe 어댑터 작성이 가능해짐.

---

### [INFO] `3-error-handling.md §1.4` 에 Chat Channel 분류 표 동기화 의무 주석 추가 불필요 여부 확인

- **target 위치**: `spec/5-system/15-chat-channel.md §3.5 CCH-ERR-* Rationale R-CC-15 (e)` — "MCP 노드가 별 코드 enum 을 추가하면 Convention §3.1 의 분류 표에 행 추가 + 신규 i18n 키 검토"
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` 마지막 note — "Chat Channel 어댑터의 사용자 안내 메시지 분류는 본 enum 을 입력으로 사용한다 — 분류 표 SoT 는 `spec/conventions/chat-channel-adapter.md §3.1`. 본 enum 확장 (예: MCP 도구 카테고리) 시 분류 표 행 추가 검토 의무."
- **상세**: `3-error-handling.md §1.4` 가 이미 Chat Channel 분류 표와의 동기화 의무를 명시하고 있으므로, `15-chat-channel.md R-CC-15 (e)` 와 쌍방 cross-ref 가 성립한다. 충돌 없음. 다만 양쪽 모두 같은 의무를 독립적으로 기술해 drift 위험이 있다.
- **제안**: 현재 상태 그대로 유지 가능. 추후 enum 확장 시 두 문서를 함께 갱신해야 함을 기억할 것.

---

## 요약

`spec/5-system/15-chat-channel.md` 의 Cross-Spec 일관성은 전반적으로 양호하다. 데이터 모델(`spec/1-data-model.md §2.8 Trigger`)과의 5개 컬럼 동기화, `spec/2-navigation/2-trigger-list.md §3` API 표와의 single-path 정책 정합, `spec/conventions/secret-store.md` 의 SecretStore ref 패턴 정합, `spec/5-system/14-external-interaction-api.md` 와의 facade 계층 정의 등 주요 연결 지점은 모두 일치한다. 유일하게 구현자에게 혼동을 줄 수 있는 부분은 EIA §6.4 의 `execution.failed` error.code 예시 값이 `3-error-handling.md §1.4` 의 실제 enum 과 네이밍이 다른 점(WARNING)이지만, 이는 target 이 도입한 충돌이 아니라 기존 EIA spec 의 예시 불완전성이다. `Convention §2.3 ChatChannelConfig` 에 `languageLocale` 필드 누락(INFO)은 구현 착수 전 단순 필드 추가로 해소 가능하며 동작 영향은 없다. Critical 수준의 충돌은 없어 구현 착수 BLOCK 조건 미충족.

## 위험도

LOW

---

STATUS: SUCCESS
