# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)
실질 변경: `spec/5-system/15-chat-channel.md` (CCH-NF-03 rate-limit 메커니즘 확정 + 구현 완료), `spec/data-flow/14-chat-channel.md` (rate-limit 진입 흐름 주석 추가)

---

### 발견사항

- **[INFO]** `spec/1-data-model.md` 의 `chat_channel_health` 설명이 새 degraded 트리거를 누락
  - target 위치: `spec/5-system/15-chat-channel.md` §3.4 CCH-SE-01, §3.6 CCH-NF-03, Rationale R-CC-19
  - 충돌 대상: `spec/1-data-model.md` §2.8 Trigger 표, `chat_channel_health` 행 (line 234)
  - 상세: `spec/1-data-model.md` 의 `chat_channel_health` 설명은 "Chat Channel 어댑터의 외부 채널 호출 건강도. [Spec Chat Channel §3.4 CCH-SE-01]" 만 cross-link하고 있다. 그러나 변경된 `15-chat-channel.md` §3.4 CCH-SE-01 본문과 §3.6 CCH-NF-03은 `degraded` 가 두 경로(① 외부 API 호출 실패 CCH-SE-01, ② per-chat rate-limit 초과 CCH-NF-03)에서 설정된다고 명시했다. 데이터 모델 설명이 한쪽 경로만 링크하므로 독자가 `chat_channel_health`의 full degraded 조건을 파악하기 어렵다.
  - 제안: `spec/1-data-model.md` §2.8 Trigger 표의 `chat_channel_health` 설명에 CCH-NF-03 cross-link 추가 — 예: "…[Spec Chat Channel §3.4 CCH-SE-01](./5-system/15-chat-channel.md#34-신뢰성--보안) + [CCH-NF-03 (rate-limit 초과)](./5-system/15-chat-channel.md#36-비기능-요구사항). …" 기능 동작에는 영향 없으므로 INFO 등급.

- **[INFO]** `spec/data-flow/14-chat-channel.md` §1.1 mermaid 다이어그램에 rate-limit 분기가 미반영
  - target 위치: `spec/data-flow/14-chat-channel.md` §1.1 sequenceDiagram (lines 41–75) + 하단 주석 (lines 88–94)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §3.6 CCH-NF-03 ("parseUpdate 직후 한도 초과 시 단락")
  - 상세: data-flow §1.1 의 sequenceDiagram 은 `parseUpdate` → `lookup` → `interact / execute` 흐름만 묘사하고, CCH-NF-03 의 rate-limit 분기(parseUpdate 직후, conversationKey 확정 후, execution 분기 이전)를 alt 블록으로 표현하지 않는다. 하단 주석(lines 88–94)에서 텍스트로 "inbound rate limit 구현 완료"를 기술하긴 했으나, 다이어그램 자체는 갱신되지 않아 시각 흐름과 텍스트 설명이 불일치한다.
  - 제안: `spec/data-flow/14-chat-channel.md` §1.1 다이어그램에 `alt rate-limit 초과 → Hk-->>Ext: 202 { executionId: 'ignored' }` alt 블록을 `parseUpdate` 직후(lookup 이전)에 삽입해 텍스트 주석과 정합. INFO 등급 — 동작 정의는 `15-chat-channel.md` 가 SoT 이므로 기능 모순 없음.

---

### 요약

이번 변경(`spec/5-system/15-chat-channel.md` CCH-NF-03 rate-limit 정책 확정 + 구현 완료, `spec/data-flow/14-chat-channel.md` 진입 흐름 주석 추가)은 기존 spec과 직접 모순되는 사항이 없다. CCH-NF-03의 per-chat Redis fixed-window 정책은 `spec/5-system/12-webhook.md`의 `PublicWebhookQuotaService` 동일 패턴과 일관되며, `chat_channel_health` degraded 정책은 `spec/1-data-model.md`의 컬럼 정의 범위 안에 있다. 발견된 두 항목은 모두 INFO 수준의 설명 동기화 미비로, 기능 동작·API 계약·RBAC·상태 전이·요구사항 ID 충돌은 없다.

### 위험도

NONE
