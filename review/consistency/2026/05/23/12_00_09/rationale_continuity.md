# Rationale Continuity — `ButtonDef.userMessage` 신설 + 하이브리드 합성

## 결론
**위험도: NONE** — 과거 기각 결정 (rationale) 재도입 없음. 본 결정은 기존 §12.4 (D) "버튼 클릭 → 다른 출력 포트 흉내" 기각 결정과 **직교** 하며, §10.5 `button.id` UUID v4 backfill (2026-05-23 결정) 의 "LLM 자율 보존 + frontend SSOT 가드" 라인을 그대로 계승.

## 점검 매트릭스

| 과거 결정 (Rationale) | 출처 | 본 결정과의 관계 |
|---|---|---|
| §12.4 (D) "render 결과의 워크플로 분기 흉내" 기각 (cond_* 와 책임 중복) | `1-ai-agent.md §12.4` | **충돌 없음**. 본 작업은 그래프 분기가 아니라 "다음 LLM turn user 메시지 합성" 의 **구체화** — §4.1 본문 "버튼 클릭은 다음 LLM turn 의 user 메시지로 흡수" 라는 기존 결정을 깨지 않고 합성 디테일만 채움. |
| §10.5 `button.id` backfill 도입 (2026-05-23) — frontend 가드 + backend SSOT 보장 | `0-common.md §Rationale "button.id backfill 도입"` | **같은 라인**. 본 작업도 (A) frontend-only fallback / (B) zod required 강제 / (C) **하이브리드 (LLM emit + frontend fallback)** 셋 중 (C) 채택 — backfill 의 "(C) defense-in-depth" 결정과 동일 패턴. LLM 의 자율 emit 을 보존하면서 frontend 가 SSOT 가드로 회귀 차단. |
| §12.4 Schema 위반 silent fallback 결정 | `1-ai-agent.md §12.4` "Schema 위반의 silent fallback 결정" | **충돌 없음**. `userMessage` 가 string 미설정 시 frontend 가 합성 — schema 위반이 아니라 옵션 필드 미설정 케이스. silent drop 흐름 (재시도 1회) 과 다른 layer. |
| Presentation 공통 §Rationale 버튼 cap (5개 + carousel item 5개) | `0-common.md §Rationale "버튼 cap 정책"` | **충돌 없음**. 본 작업은 필드 신설만, cap 변경 없음. |
| `conversationHistory` 제거 (§12.2) | `1-ai-agent.md §12.2` | **무관**. 본 작업은 schema 신설이지 deadweight 제거 아님. |

## 본 결정의 Rationale (plan 인용)

> 사용자 결정 (2026-05-23): "하이브리드로 진행. fallback 은 `"{item.title} → {button.label}"`."

| 결정 포인트 | 채택 안 | 근거 |
|---|---|---|
| 합성 책임 | (C) 하이브리드 — LLM emit (button.userMessage) 우선, frontend fallback | LLM 자율 보존 + 아이템 컨텍스트 누락 방지 (per-item 버튼 회귀의 근원 차단) |
| 구분자 | ` → ` (U+2192 화살표) | locale-agnostic, 시각적 방향 명시 ("item → button" 인과 흐름) |
| `type: "link"` 처리 | 무시 (warning 아님 — 동작 변화 없음) | `type: "link"` 는 외부 URL 이동 시맨틱이라 user-message 발화 자체가 없음 (§4.2 LinkButtonClick 흐름) |
| backfill 대상 여부 | 옵션 필드라 §10.5 backfill 대상 아님 | `id` 와 달리 `userMessage` 는 미설정이 정상 케이스 (frontend fallback 사용) |

## 폐기된 대안 (사용자 결정 단계에서 검토됨)

| 안 | 효과 | 채택 |
|---|---|---|
| (A) frontend-only fallback (`button.userMessage` schema 신설 없이 frontend 가 `"{item.title} → {label}"` 합성) | 즉시 해소되나 LLM 이 자연어 ergonomic 을 결정할 권한 없음 | 부분 채택 — fallback 경로 |
| (B) zod 의 `userMessage` 를 required 로 강제 (LLM 이 항상 emit 하도록) | LLM emit 비용 + schema 위반 시 silent drop 흐름이 자연스러운 응답을 막아 UX 회귀 | **기각** (§12.4 silent fallback 라인과 동일 기각 근거) |
| (C) **하이브리드 — LLM emit 우선 + frontend fallback** | LLM 자율 + 회귀 차단 (defense-in-depth) | **채택** |

## STATUS
ISSUES=0
