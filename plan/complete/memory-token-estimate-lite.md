---
title: 메모리 토큰 추정 휴리스틱 개선 (A4 lite — 무의존 language/provider-aware)
status: complete
worktree: memory-tokenizer-exact-7ff721
branch: claude/memory-tokenizer-exact-7ff721
started: 2026-06-05
completed: 2026-06-05
owner: developer
spec:
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/conventions/conversation-thread.md
  - spec/5-system/17-agent-memory.md
spec_impact:
  - spec/4-nodes/3-ai/1-ai-agent.md
  - spec/conventions/conversation-thread.md
  - spec/5-system/17-agent-memory.md
code:
  - codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts
---

# 메모리 토큰 추정 휴리스틱 개선 (A4 lite)

followup-v2 A4 "provider tokenizer-exact". 설계 분석 결과: 정확 tokenizer 는 (1) 새 의존성(js-tiktoken),
(2) 주력 Claude 용 로컬 tokenizer 부재(동기 hot-path 부적합), (3) spec 상 v3 항목 — ROI/리스크 큼.
**사용자 결정: A4 lite — 무의존 휴리스틱 개선.** tokenizer-exact 는 v3 유지.

## 설계
- 현재 `estimateTokens = ceil(len/3)` (text-chunker, 전 스크립트 균일) → memory 경로에 **language-aware** 추정기 도입:
  CJK/Latin/기타 스크립트별 char-per-token 가중(예: Latin ~4, CJK ~1.7, 기타 ~3). provider 가용 시 소폭 튜닝.
- **memory 예산 경로만**(agent-memory-injection: estimateTextTokens/estimateTurnTokens/estimateWorkingMemoryTokens) 적용.
  **KB 청킹(text-chunker.estimateTokens)·thread cap 은 무변경**(회귀 0).
- 미지원/실패 시 기존 char/3 fallback.
- 동기·순수 함수(hot-path 적합), 새 의존성 0.

## 비고
완전 정확 아님 — 균일 char/3 대비 혼합 스크립트(한국어+영어) 정확도 개선이 목적. tokenizer-exact(v3) 와 구분.

## 완료 (2026-06-05)

- **구현** (`agent-memory-injection.ts`): `estimateTokensLanguageAware(text)` 신설 — 코드포인트를 스크립트군(CJK/Latin/기타)으로 분류해 chars-per-token 가중치 역수 누적 후 `ceil`. 상수 `CHARS_PER_TOKEN_LATIN=4`, `CHARS_PER_TOKEN_CJK=1.7`, `CHARS_PER_TOKEN_OTHER=3`. `estimateTextTokens` 가 KB 청킹 `estimateTokens` import 대신 이 함수를 사용하도록 배선 (estimateTurnTokens/estimateWorkingMemoryTokens/buildSummaryBufferUpdate 는 estimateTextTokens 경유라 자동 반영). 빈/비-string graceful 0, 무의존, 동기·순수.
- **provider 튜닝 생략** — 시그니처 churn 회피, language-aware 만 적용 (plan 의 optional 항목).
- **테스트**: `estimateTokensLanguageAware` describe 블록 추가 — 빈/비정상 0, 순수 영문 토큰↓(<char/3), 순수 한국어 토큰↑(>char/3), 혼합 텍스트 가산성, estimateWorkingMemoryTokens 정확 합산, **KB 청킹 estimateTokens 무변경**(text-chunker char/3 유지) 분리 증명. 기존 buildSummaryBufferUpdate / B3 O(n) 오라클 테스트는 estimateTurnTokens 를 통해 추정기를 symbolic 으로 참조하므로 expected 하드코딩 변경 불필요 (bit-identical 유지).
- **게이트**: backend lint PASS / unit 6221 PASS(1 skip 기존) / build PASS. ai-agent 446 + text-chunker 회귀 0. frontend/web-chat 무영향(backend-src + spec only). e2e 는 본 변경(순수 추정 휴리스틱) 무관.
- **spec**: 1-ai-agent §6.1(language-aware 명시 + 여전히 근사) / §12.10 Rationale(정확 tokenizer 대신 lite 휴리스틱 근거: Claude 로컬 tokenizer 부재·동기 hot-path·무의존·v3 보류) / conversation-thread §7(부분 개선 한 줄) / 17-agent-memory Overview(추정기 SoT 포인터) 갱신.
