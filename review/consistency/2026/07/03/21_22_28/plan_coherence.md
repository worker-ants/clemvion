### 발견사항

- **[WARNING]** 초대 수락 자동화(V-09) 미해결 갭이 §1.5.3 에 캐벗 없이 서술됨
  - target 위치: `spec/5-system/1-auth.md` §1.5.3 "흐름 (이미 가입한 사용자가 다른 워크스페이스에 초대된 경우)" (토큰 메타 조회 → `[수락]` 버튼 노출 → 이메일 불일치 시 계정전환 안내+로그아웃 UI)
  - 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` "결정 옵션 (2026-06-13)" §V-09 (미해결 — 코드 구현 vs spec 하향 둘 중 미확정, 체크박스 미완료)
  - 상세: 해당 plan 은 실제 `accept-invitation-content.tsx` 가 마운트 즉시 `acceptInvitation` 을 자동 호출하며 `[수락]` 버튼도 이메일 불일치 UI 도 없다고 명시한다. 즉 코드가 §1.5.3 의 서술과 다르게 동작 중이며, "코드 구현으로 spec 정합" vs "spec 을 자동수락으로 하향" 둘 중 어느 쪽도 아직 결정되지 않았다. 그런데 target §1.5.3 은 이 불일치를 전혀 언급하지 않고 `[수락]` 버튼 흐름을 기정사실처럼 서술하며, `1-auth.md` frontmatter `pending_plans` 도 `spec-sync-auth-gaps.md` 만 가리키고 이 cross-audit plan 을 가리키지 않는다 — 독자가 이 UI 흐름이 이미 구현된 것으로 오인할 위험.
  - 제안: (a) `1-auth.md` frontmatter `pending_plans` 에 `spec-code-cross-audit-2026-06-10.md` 를 추가하거나 §1.5.3 에 "현재 프론트엔드는 자동수락 — 결정 대기(V-09)" 캐벗을 달아 갭을 명시하거나, (b) V-09 결정을 먼저 내려(코드 구현 or spec 하향) 양쪽을 일치시킨다. 구현 착수(--impl-prep) 전에 이 미해결 UX 계약부터 확정하는 편이 안전.

- **[INFO]** `rag-rerank-followup.md` 의 완료 체크가 model_config 통합으로 무의미해진 상태(추적 갱신 권장)
  - target 위치: `spec/5-system/1-auth.md` §3.2 RBAC 매트릭스 (Rerank Config 행 없음) · §4.1 감사 액션 카탈로그 (`rerank_config.*` 독립 엔트리 없음, `model_config.*` 로 통합)
  - 관련 plan: `plan/in-progress/rag-rerank-followup.md` "RerankConfig 리소스 spec 완결성" 항목 — `spec/5-system/1-auth.md §3.2 RBAC 행`·`§4.1 rerank_config.create/update/delete` 를 `[x]` 완료로 표시
  - 상세: 두 체크박스가 체크된 시점(2026-06 초) 이후 PR #541/#545 (통합 모델 관리 — LLM/Embedding/Rerank 단일화)가 `RerankConfig` 를 `ModelConfig` 로 흡수하면서 독립 리소스 개념 자체가 사라졌다. 현재 `1-auth.md` 에는 `Rerank Config` 단독 RBAC 행도 `rerank_config.*` 단독 카탈로그 엔트리도 없다(§4.1 은 `model_config.*` 로 통합 서술하며 과거 `rerank_config.*` row 를 legacy OR-query 대상으로만 언급). spec 자체는 통합 설계로 일관되어 있어 CRITICAL 한 충돌은 아니지만, `rag-rerank-followup.md` 의 완료 체크가 "지금은 존재하지 않는 리소스"를 완료로 기록해 추적 문서로서 오도 소지가 있다.
  - 제안: `rag-rerank-followup.md` 해당 두 항목에 "model_config 통합(PR #541/#545)으로 obsolete — 통합 후 §3.2/§4.1 은 ModelConfig 카탈로그로 흡수됨" 각주를 추가해 추적 정합성을 남긴다. target 문서 자체는 변경 불필요.

### 요약
`spec/5-system/1-auth.md` 는 `plan/in-progress/spec-sync-auth-gaps.md` (LDAP/SAML 미구현) 와는 정합하게 연결되어 있고, RBAC/감사/세션/WebAuthn 등 나머지 섹션도 관련 in-progress plan(`rag-dynamic-cut.md`, `rag-rerank-followup.md` 등)의 히스토리와 대체로 일치한다. `spec/5-system/10-graph-rag.md` 는 in-progress plan 과 충돌·미해소 선행조건 없이 안정적이다(`rag-quality-improvement.md` P2 의 entity-extraction 재활용 제안은 미확정·미체크 상태의 미래 검토 항목일 뿐 현재 spec 서술과 충돌하지 않는다). 다만 `spec-code-cross-audit-2026-06-10.md` 의 V-09(초대 수락 자동화 vs `[수락]` 버튼 흐름)가 아직 "코드 구현 vs spec 하향" 미결정 상태인데 target §1.5.3 이 이를 캐벗 없이 서술하고 있어, 구현 착수 전에 이 지점을 먼저 짚어야 한다.

### 위험도
LOW
