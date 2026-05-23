# Convention Compliance Review

**대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 시각**: 2026-05-23

---

## 발견사항

### [WARNING] 문서 구조 — Overview / 본문 / Rationale 3섹션 구성 편차
- **target 위치**: `spec/5-system/15-chat-channel.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: CLAUDE.md 는 spec 문서가 "Overview / 본문 / Rationale" 3섹션을 권장 구성으로 삼는다고 명시한다. 대상 문서는 `## Overview (제품 정의)` 이후 `## 3. 처리 흐름`, `## 4. 데이터 모델`, `## 5. Identity / 보안`, `## 5.5 Inbound HTTP Contract`, `## 6. EIA 와의 관계`, `## 7. 구현 파일 구조`, `## 8. 호환성` 등 다수의 최상위 헤딩이 분산되어 있어 "본문" 블록이 명시적으로 구분되지 않는다. "Overview" → "본문 (구체 명세)" → "Rationale" 3단계의 논리 구획이 헤딩 레벨에 반영되어 있지 않다.
- **제안**: 3~8 섹션을 `---` + 헤딩 레이블 없는 본문 구획으로 묶거나, `## 본문` 헤딩 아래에 하위 헤딩으로 재배치하면 3섹션 권장 구조와 정합한다. 현재 내용 자체는 충분하므로 구조 재배치가 주된 수정. 권장 수준이므로 채택 여부는 팀 판단.

---

### [WARNING] 섹션 번호 비연속 — `§5.4` 가 두 번 등장 (§5.3 다음이 §5.4, §5.4.1, §5.4.2 → §5.5)
- **target 위치**: `## 5. Identity / 보안` 하위 섹션 헤딩
- **위반 규약**: 정식 규약에 직접 명문화된 섹션 번호 규칙은 없으나, CLAUDE.md 가 "단일 진실 원칙"으로 cross-link 정확도를 요구하며, `chat-channel-adapter.md` 등 여러 문서가 `§5.4`를 앵커로 참조한다.
- **상세**: 섹션 `5.4 Bot Token Rotation API 응답 계약`과 `5.5 Inbound HTTP Contract` 사이에 `5.4.1 Bot Token 변경 single-path 정책` 및 `5.4.2 응답 DTO derived 필드 — hasBotToken`이 중첩된다. 이 구조는 올바른 중첩이지만, `5.5 Inbound HTTP Contract`가 상위 레벨(`## 5.5`)로 선언되어 있어 `## 5.4`의 하위인지 `## 5`의 직속 자식인지 헤딩 레벨(`###` vs `##`)이 모호하다. 실제로 `## 5.5`는 `### 5.5`이어야 `§5` 하위로 올바르게 중첩된다.
- **제안**: `## 5.5 Inbound HTTP Contract` → `### 5.5 Inbound HTTP Contract` 로 변경해 `## 5. Identity / 보안` 하위 헤딩으로 정렬. 또는 `## 6. Inbound HTTP Contract` 로 독립 최상위 섹션으로 올리고 이후 섹션 번호 조정.

---

### [INFO] `§3.3 노드 → 채널 UI 매핑` 요구사항 섹션 번호와 처리 흐름 섹션 번호 충돌
- **target 위치**: 요구사항 `§3.3` (라인 46, `#### 3.3 노드 → 채널 UI 매핑`) 과 처리 흐름 `## 3.3 SSE 어댑터와의 병존` (라인 140)
- **위반 규약**: 정식 규약에 직접 규칙 없음; CLAUDE.md 단일 진실 원칙 관련
- **상세**: `## 3. 처리 흐름` 의 하위 `### 3.3 SSE 어댑터와의 병존`과 `## Overview` 하위 `#### 3.3 노드 → 채널 UI 매핑`이 동일한 `§3.3` prefix 를 쓴다. cross-link에서 `§3.3`를 단독으로 쓰면 독자가 어느 3.3을 지칭하는지 혼동할 수 있다.
- **제안**: Overview 하위 요구사항 섹션을 `#### 3.x` 대신 `#### CCH-MP-*` 요구사항 그룹명 또는 다른 prefix 를 쓰거나, 처리 흐름 섹션을 독립 최상위 헤딩(`## 4.`)으로 올려 번호 충돌을 방지.

---

### [INFO] API 응답 `error.code` 값이 `UPPER_SNAKE_CASE` 규약을 준수하는지 확인 필요
- **target 위치**: `§5.4 Bot Token Rotation API 응답 계약` 에러 코드 표 (라인 259–265)
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2 — "`code` 는 `UPPER_SNAKE_CASE`"; `spec/5-system/2-api-convention.md §5.3`
- **상세**: 에러 코드로 `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED` 5종이 나열되어 있다. 모두 `UPPER_SNAKE_CASE` 형식을 따르고 있어 규약과 정합한다. 또한 `2-api-convention.md §5.3`의 `{ error: { code, message, details? } }` 에러 envelope 을 명시적으로 준수한다. 확인 결과 위반 없음 — 기록 목적으로 INFO 등재.
- **제안**: 없음. 현행 유지.

---

### [INFO] `POST /api/triggers/:id/chat-channel/rotate-bot-token` URL 패턴 — API Convention RPC-style 예외 준수 확인
- **target 위치**: `§3.4 CCH-SE-04`, `§5.4`, `§R7`
- **위반 규약**: `spec/5-system/2-api-convention.md §2.2` 명명 규칙 (RPC-style sub-channel action 예외)
- **상세**: `2-api-convention.md §2.2` 는 `/api/{resource}/{id}/{channel}/{action}` 형태의 RPC-style sub-channel action 을 명시적으로 허용하며 예시로 `/api/triggers/:id/chat-channel/rotate-bot-token` 을 직접 열거하고 있다. 규약 위반이 아닌 것이 이미 규약에 명문화됨. 확인 결과 정합.
- **제안**: 없음.

---

### [INFO] `4.2 Trigger 테이블 신규 컬럼` — `VARCHAR(16)` 타입 사용
- **target 위치**: `§4.2` SQL DDL 블록 (라인 185)
- **위반 규약**: 특정 컬럼 타입을 강제하는 규약은 없으나, `migrations.md §1` 명명 규약과 spec 의 DB 기술 선택 일관성 관점
- **상세**: `chat_channel_health VARCHAR(16)` 은 동일 섹션에서 `notification_health` 와 동일 enum 임을 명시하고 있다. 기존 컬럼이 `VARCHAR(16)` 을 쓰는지 확인이 필요하나 spec 차원에서는 일관성 언급이 있어 적절히 문서화됨. 위반 없음.
- **제안**: 없음.

---

### [INFO] `conventions/chat-channel-adapter.md` Changelog 포맷 — 대상 spec 과 다름
- **target 위치**: `spec/5-system/15-chat-channel.md` — Rationale 섹션 전체; `spec/conventions/chat-channel-adapter.md` — `## Changelog`
- **위반 규약**: 정식 규약에 Changelog 포맷 강제 조항 없음
- **상세**: 컨벤션 파일(`chat-channel-adapter.md`)은 `## Changelog` 섹션을 가지고 있으나, 대상 spec(`15-chat-channel.md`)은 Changelog 섹션이 없고 Rationale 내 인라인 날짜 주석으로 결정 이력을 관리한다. 두 파일의 변경 이력 관리 방식이 다르다. 이 불일치는 현재 어느 규약도 단일 방식을 강제하지 않아 위반은 아니다.
- **제안**: 필요시 `CLAUDE.md` 또는 스킬 문서에 spec 파일의 이력 기록 방식을 명문화.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 `spec/conventions/chat-channel-adapter.md`, `spec/5-system/2-api-convention.md`, `spec/conventions/node-output.md`, `spec/conventions/secret-store.md`, `spec/conventions/migrations.md` 등 관련 정식 규약과 전반적으로 정합한다. API endpoint URL 패턴, 에러 코드 형식(`UPPER_SNAKE_CASE`), 응답 envelope(`{ data }` / `{ error: { code, message, details? } }`), secret store ref 형식, RPC-style URL 예외 등 핵심 규약을 모두 명시적으로 준수하고 있다. 주요 편차는 두 가지다. 첫째, `## 5.5 Inbound HTTP Contract` 헤딩 레벨이 `## 5` 직속 자식이어야 할 내용을 최상위 레벨로 노출해 계층 구조에 혼란을 주며(WARNING), 이는 cross-link 정확도를 요구하는 단일 진실 원칙과 거리가 있다. 둘째, CLAUDE.md 가 권장하는 Overview / 본문 / Rationale 3섹션 구성이 헤딩 레벨에 명시적으로 반영되어 있지 않다(WARNING). 두 사항 모두 내용 자체의 오류가 아니라 구조·레이블 정비 사항이며, 구현 착수를 차단하는 CRITICAL 위반은 발견되지 않았다.

## 위험도

LOW
