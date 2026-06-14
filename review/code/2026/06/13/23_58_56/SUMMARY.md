# Code Review 통합 보고서

**대상**: spec-sync-s-batch-b85f17 — spec doc-sync 3건 + JSDoc 교정 1건 + plan 완료 이동 4건 + consistency review 산출물
**일시**: 2026-06-13

---

## 전체 위험도

**LOW** — 런타임 로직 변경 없음. 전체 변경은 JSDoc 주석 교정 1줄 + spec 문서 동기화 + plan 라이프사이클 이동. WARNING 3건 모두 문서 가독성/단일진실 이슈이며 동작 오류 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / 가독성 | `interaction-type-registry.md §1.2` 추가 note 에서 재개 경로를 "ai_conversation" 단독으로 표기. `ai_form_render` 도 AI 재개 경로(`isAiConversation`)를 타지만 note 에 누락되어 독자가 해당 값의 경로를 오인할 수 있음 | `spec/conventions/interaction-type-registry.md` §1.2 추가 note | note 내 `ai_conversation` 표기를 `ai_conversation / ai_form_render (isAiConversation)` 또는 "AI 재개(`ai_conversation`·`ai_form_render`)" 형태로 명확화 |
| 2 | Documentation / 단일진실 | SSE single-instance Rationale 신설 블록이 동일 근거를 이미 다루는 `spec/5-system/14-external-interaction-api.md §R10` 에 대한 cross-reference 없이 독립 서술됨. 향후 한 곳만 갱신될 경우 불일치 발생 위험 | `spec/data-flow/15-external-interaction.md` Rationale 신설 블록 | 블록 말미에 `상세 근거: [EIA §R10]` 추가 또는 내용 축약 |
| 3 | Maintainability | `plan/complete/spec-update-pr2-embedding.md` 에 이미 supersede 된 "Before/After 제안 변경" 예시(3-step 폴백 체인 등)가 그대로 남아 있어 후속 독자가 현행 spec 지침으로 오인할 수 있음 | `plan/complete/spec-update-pr2-embedding.md` 하단 제안 변경 섹션 | 제안 변경 섹션에 `> 미적용 (superseded by PR4b)` callout 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / 개인정보 | `review/consistency/` 산출물 JSON 에 로컬 개발 환경 절대 경로(`/Users/gehrig/`, job ID) 가 기록됨. 운영 보안 위협 아님 | `review/consistency/.../meta.json`, `_retry_state.json` | 장기적으로 orchestrator 템플릿에서 상대 경로 기록 권장. 커밋 차단 사유 아님 |
| 2 | Performance / Architecture | `SseAdapter.buffers` in-memory single-instance 제약 명문화 — 기존 아키텍처 결정의 가시화 | `spec/data-flow/15-external-interaction.md` Rationale | 이번 범위 외. Redis Pub/Sub 이관 시 benchmark 권장 |
| 3 | Architecture | SSE Rationale 블록 EIA §R10 cross-ref (WARNING-2 와 동일, architecture 관점 중복) | `spec/data-flow/15-external-interaction.md` | cross-ref 포함 권장 |
| 4 | Maintainability | `spec-update-gap-callout-plan-links.md` heads-up 블록이 파일 말미에 헤딩 없이 붙어 구조 파악 어려움 | `plan/in-progress/spec-update-gap-callout-plan-links.md` 하단 | heads-up 앞 `## 후속 주의사항` 헤딩 추가 |
| 5 | Maintainability | `_retry_state.json` 이 초기 스냅샷(agents_pending) 상태로 커밋됨 | `review/consistency/.../_retry_state.json` | orchestrator 패턴 정비 권장 |
| 6 | Maintainability | `meta.json`, `_retry_state.json` 파일 끝 개행 없음 | `review/consistency/.../*.json` | 마지막 줄 개행 추가 |
| 7 | Requirement | `spec-update-gap-callout-plan-links.md` §1.3 plan 링크 작업은 note 압축에 맞춰 착수 전 문안 조정 필요 (heads-up·consistency W4 추적) | `plan/in-progress/spec-update-gap-callout-plan-links.md` | 착수 시 재작성 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임 로직 변경 없음. review 산출물 JSON 에 로컬 경로 포함(INFO) |
| performance | NONE | 실행 경로 변경 없음. SSE single-instance 제약 가시화(INFO) |
| architecture | NONE | Strategy+Registry 패턴 정석, ISP 준수. SSE cross-ref 권장(INFO) |
| requirement | LOW | ai_form_render 재개 경로 명시 누락(WARNING 1건), 나머지 spec 정합 |
| scope | NONE | 전체 14개 파일 의도 범위 내 |
| side_effect | NONE | 부작용 없음 |
| maintainability | LOW | pr2-embedding supersede 예시 잔존(WARNING), JSON trailing newline(INFO) |
| testing | NONE | 런타임 변경 없어 신규 테스트 불필요 |
| documentation | LOW | SSE Rationale EIA §R10 cross-ref(WARNING) |
| dependency | NONE | 신규 의존성 없음 |
| database | NONE | DB 변경 없음 |
| concurrency | NONE | 비동기/공유 상태 변경 없음 |
| api_contract | NONE | API 계약 변경 없음 |
| user_guide_sync | NONE | 동반 갱신 누락 0건 |

---

## 권장 조치사항

1. **(WARNING-1)** interaction-type-registry §1.2 note 의 `ai_conversation` 을 `ai_conversation`·`ai_form_render` 함께 표기.
2. **(WARNING-2)** SSE Rationale 블록에 EIA §R10 cross-ref 추가.
3. **(WARNING-3)** pr2-embedding 의 supersede Before/After 예시에 callout 추가.
4. (INFO-4) gap-callout heads-up 블록 앞 `## 후속 주의사항` 헤딩 추가.

---

## 라우터 결정

라우터 미사용 — `routing=fallback-all`. 전체 14 reviewer 실행됨. 제외 없음.
