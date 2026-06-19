# Code Review 통합 보고서 (item ③ LLM 타입통합)
## 전체 위험도
**LOW** — 순수 타입 리팩터링(런타임 무변). Critical 0. Warning 2(둘 다 deferrable·회귀 아님). 5/7 reviewer 작성(requirement·maintainability 격리 flakiness 로 미생성; 핵심 security·architecture·scope·side_effect·testing 보고).
## Critical
없음.
## 경고 (WARNING)
| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| 1 | Architecture | `ai-agent.handler.ts`(L1488,L2413) 가 LlmCallRecord 와 동일 shape 익명 inline 타입 유지 — 단일진실 ai-agent 미완 | **이연**: plan 범위는 EE+IE 명시(ai-agent 미명시). ai-agent inline 은 앞 3필드 required stricter — shared(all-optional) 전환 시 loosen 위험 → **별도 follow-up**. JSDoc 은 도메인 공유 의도 기술(ai-agent 마이그레이션 pending). |
| 2 | Security | requestPayload/responsePayload 가 turnDebug JSONB→WS 로 클라 노출 가능 | **이연(pre-existing)**: reviewer "이번 PR 신규 도입 아님". 통합 타입이 경로를 명시화할 뿐. WS emit 필터링은 별도 보안 grooming. |
## INFO 주요
shared/index.ts 부재(선택)·TurnDebugEntry optional 완화 소비처 폴백(생성처는 값 보장)·IE spec turnDebug 내부 shape 미검증(선택)·shared 단위테스트(interface 라 불요)·lastResponse 에러노출(pre-existing). 전부 선택/pre-existing.
## 에이전트별
security LOW(pre-existing) · architecture LOW(ai-agent 미전환) · scope NONE · side_effect NONE(타입전용) · testing LOW(기존 회귀보호) · requirement/maintainability(미생성).
> item ③: type-only 통일(런타임/DB 무변). W1 ai-agent→follow-up(범위밖), W2 pre-existing → 수렴. BLOCK 무관(LOW, RESOLUTION 동봉).
