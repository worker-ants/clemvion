# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/7-trigger/providers/slack.md`
**검토 일자**: 2026-06-29
**검토자**: convention-compliance sub-agent

---

## 발견사항

### [INFO] Rationale 섹션 위치 — 인라인 앵커 접근 가능성
- **target 위치**: `## Rationale` 섹션 전체 (문서 최하단)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` §Rationale 및 CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: 문서 3섹션 구성(Overview/본문/Rationale)은 정상 준수. Rationale ID 체계(`R-S-N` prefix)도 일관하게 사용. 다만 `## 5.5 Typing` 헤딩 내부에 `(CCH-MP-04 - typing 등가)` 라는 괄호 주석이 있어 CCH-MP-04 의 실제 섹션(`## 5.4 Carousel / Chart / Table`)과 혼동을 유발할 수 있다.
- **제안**: `## 5.5 Typing` 헤딩에서 `(CCH-MP-04 - typing 등가)` 표기를 제거하거나, CCH-MP-05 처럼 별도 CCH 번호를 부여하는 방향 검토.

---

### [INFO] `Section 4.2` 내 `idempotencyKey` 항목 위치 — 논리 그룹화
- **target 위치**: `## 4.3 Slash Commands` 하단 `idempotencyKey` 설명 단락
- **위반 규약**: 해당 단락은 세 envelope 모두에 적용되는 공통 규칙이나, 4.3 섹션 말미에 배치되어 있어 §4.1/§4.2 envelope 에도 동일하게 적용됨이 시각적으로 불분명하다.
- **상세**: 이는 형식 불일치이지 규약 직접 위반이 아니며 내용 자체는 정확하다.
- **제안**: `idempotencyKey` 설명을 §4 도입부 또는 별도 `### 4.4` 서브섹션으로 이동해 세 envelope 공통 규칙임을 명확히 하면 혼동이 줄어든다. 규약 갱신 불필요.

---

### [INFO] `user_guide` frontmatter 필드 경로 — 로케일 분리 형식
- **target 위치**: frontmatter `user_guide:` 항목
  ```yaml
  user_guide:
    - codebase/frontend/src/content/docs/06-integrations-and-config/slack.mdx
    - codebase/frontend/src/content/docs/06-integrations-and-config/slack.en.mdx
  ```
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `user_guide` 필드 설명은 "가이드 페이지 cross-link" 이며 path 형식 외 추가 제약을 두지 않는다. `user-guide-evidence.md` 도 `slack.en.mdx` 와 같은 로케일 접미사 패턴을 명시적으로 금지하거나 요구하지 않는다.
- **상세**: Telegram 어댑터 spec 과 동일 패턴이므로 일관성은 있다. 단 `user-guide-evidence.md` 의 `triggers-coverage.test.ts` 가 이 다중 경로를 어떻게 처리하는지는 별도 확인이 필요할 수 있다.
- **제안**: 현행 유지. 로케일 접미사 파일을 `user_guide` 배열에 포함하는 패턴을 `spec/conventions/spec-impl-evidence.md` 에 예시로 명시하면 다른 spec 작성자에게도 명확해진다. (규약 갱신 필요성 낮음)

---

## 규약 준수 항목 (이상 없음)

아래 항목들은 관련 규약과 정합함을 확인하였다.

1. **Frontmatter 구조** — `id: slack`, `status: partial`, `pending_plans:`, `code:`, `user_guide:` 모두 `spec/conventions/spec-impl-evidence.md §2` 스키마를 정확히 따른다. `status: partial` 에 `pending_plans` 가 필수인 규약도 충족한다.

2. **파일명 및 경로** — `spec/4-nodes/7-trigger/providers/slack.md` 경로는 CLAUDE.md 및 `spec/conventions/chat-channel-adapter.md §5` 의 `spec/4-nodes/7-trigger/providers/<name>.md` 신규 어댑터 경로 규칙과 정확히 일치한다.

3. **문서 3섹션 구성** — `## Overview (제품 정의)`, 본문(§3–§8), `## Rationale` 3섹션 구성이 CLAUDE.md 권장 패턴을 따른다.

4. **`provider` 식별자 lower-case** — 본문 전체에서 `provider: "slack"` (lower-case) 표기. `spec/conventions/chat-channel-adapter.md §5` 의 `lower-case, kebab-case` 요건 충족.

5. **Secret Store URI** — `secret://triggers/{id}/bot-token`, `secret://triggers/{id}/inbound-signing` 슬롯 사용이 `spec/conventions/secret-store.md §1` 의 URI scheme 과 일치한다.

6. **`inboundSigningRef` 단일 슬롯 사용** — `spec/conventions/chat-channel-adapter.md §2.3 ChatChannelConfig` 의 단일 슬롯 정책과 정합. 발급 주체(사용자 manual 입력)·검증 알고리즘(HMAC-SHA256) 분기는 backend 책임으로 명시되어 있다(§6 / R-S-1).

7. **`supportsNativeForm = true` 선언 위치** — 본 spec 이 `supportsNativeForm = true` 를 §5.3 에서 명시하고, `providers/<name>.md §5.3` 에서 modal 수용 field type 표를 제공하는 구조가 `chat-channel-adapter.md §5 (step 5)` 요건을 충족한다.

8. **Form 입력 시퀀스** — §4.1 native modal (≤5 fields, file 미포함), §4.2 다단계 fallback(6+ fields, file 포함, multi_step opt-out) 분기가 `spec/conventions/chat-channel-adapter.md §4` 의 `formMode` 분기 계약과 일치한다.

9. **`classifyExecutionFailure` 참조** — §5.6 이 `spec/conventions/chat-channel-adapter.md §3.1` 의 `classifyExecutionFailure(event)` helper 를 지칭하고, key/placeholder 치환 결과를 `chat.postMessage` 로 발송하는 패턴을 따른다.

10. **`parseUpdate` pure 계약** — `file_shared` event 시 `mimeType: "application/octet-stream"` placeholder 로 동기 반환, 후속 보강(`files.info`)은 `HooksService` 책임으로 위임해 `spec/conventions/chat-channel-adapter.md §1.1` 의 `parseUpdate` side-effect free 계약을 유지한다.

11. **HTTP 응답 예외 정책** — `200 OK + { challenge }` (URL Verification), `200 OK` (Interactivity ack) 두 Slack 예외를 각각 Rationale R-S-8 에서 근거를 명시하고, Spec Chat Channel §5.5.1 에 반영 완료라고 기재되어 있어 단일 진실 참조 원칙을 따른다.

12. **`botIdentity.botId` 타입 처리** — Slack string ID (`U…`/`B…`) → `hashStringToInt` 변환 명시가 `spec/conventions/chat-channel-adapter.md §2.3 botIdentity.botId: number` 계약과 정합하며, 실제 식별에는 `username + teamId` 를 사용한다는 사실도 기록되어 있다.

13. **Rationale ID 컨벤션** — `R-S-N` prefix 를 일관 사용하며, `spec/conventions/chat-channel-adapter.md §Rationale` 의 "Convention 파일은 별 prefix R-CCA-N 으로 충돌 방지" 정신과 동일하게 provider spec 은 `R-S-N` 으로 분리한다.

14. **금지 항목 미발견** — conventions 에서 명시적으로 금지한 패턴(외부 LLM 직접 호출, secret plaintext config 저장, 사용자 제어 URL 사용, cross-spec SoT 복제 등)을 이 spec 문서가 "답습"하거나 "허용"하는 서술은 발견되지 않는다.

---

## 요약

`spec/4-nodes/7-trigger/providers/slack.md` 는 정식 규약(`spec/conventions/**`) 에 대해 전반적으로 높은 준수도를 보인다. frontmatter 스키마(`spec-impl-evidence.md`)·파일 명명·문서 3섹션 구성·Secret Store URI scheme·어댑터 인터페이스 계약(`chat-channel-adapter.md`)·Form 입력 시퀀스 분기·실행 실패 분류 helper 참조 등 모든 핵심 규약 항목에서 이상이 없다. 발견된 3건은 모두 INFO 등급으로, 헤딩 표기 명확화 및 `user_guide` 로케일 파일 패턴의 규약 예시 보충에 관한 사소한 제안이며 규약 직접 위반에 해당하지 않는다. 채택 시 다른 시스템의 invariant 를 깨뜨리는 CRITICAL/WARNING 위반은 없다.

---

## 위험도

NONE
