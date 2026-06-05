# Rationale 연속성 검토 — memory-tokenizer-exact-7ff721

검토 기준 커밋: cbfbfbb9..HEAD
검토 일시: 2026-06-05
검토 범위: diff 내 파일만 — agent-memory-injection.ts / spec 3개(1-ai-agent §6.1·§12.10 / conversation-thread §7 / 17-agent-memory) / plan

---

## 발견사항

### INFO: v3 유보와 lite 휴리스틱의 관계 명시 — 충돌 없음, 표현 충분

- target 위치: `spec/conventions/conversation-thread.md §7` (diff 289행), `spec/4-nodes/3-ai/1-ai-agent.md §6.1 step 1.5` (diff 360행), `§12.10 Rationale` (diff 1273행)
- 과거 결정 출처: merge-base 시점 `conversation-thread.md §7` — "남은 로드맵: provider tokenizer-exact 방식 (모델별 정확한 토큰 카운트) 은 v3 로 잔존 — 현재는 근사 추정"
- 상세: 과거 §7은 "현재는 근사 추정 → v3 에서 정확 tokenizer 로 교체" 를 한 덩어리 로드맵으로 기술했다. 본 PR 은 그 사이에 "lite 휴리스틱 (language-aware 부분 개선)" 이라는 중간 단계를 삽입한다. v3 유보 자체는 건드리지 않고 ("lite 휴리스틱은 여전히 근사", "v3 로드맵 잔존" 을 §7·§6.1·§12.10 세 지점 모두에서 유지), lite 는 v3 정확화 대안이 아니라 v3 전의 독립 근사 개선임을 명시했다. 기각된 대안(tokenizer-exact 도입)을 재도입하는 것이 아니라, 그 기각을 유지하면서 무의존 범위에서의 부분 개선만 적용한 구조다.
- 제안: 현재 서술로 충분. 추가 조치 불필요.

---

## 요약

본 PR 의 변경 범위(diff cbfbfbb9..HEAD 내 6개 파일)에서 Rationale 연속성 관점의 충돌·번복·기각 대안 재도입은 발견되지 않았다. 핵심 검토 사항 두 가지 모두 정합하다.

(1) conversation-thread §7 의 "tokenizer-exact v3 유보" 와 본 PR 의 lite 휴리스틱은 직접 충돌하지 않는다. §7 원문은 "provider tokenizer-exact 는 v3" 라는 방향성을 제시한 것이고, lite 휴리스틱은 그 v3 항목을 앞당기거나 대체하지 않는다 — "v3 잔존" 표기가 §7·§6.1·§12.10 세 지점 모두에서 명시적으로 유지된다. lite 는 v3 정확화가 아닌 무의존·동기 경로의 부분 개선이며 이 관계가 Rationale 에 기술되어 있다.

(2) §12.10 의 "token-budget 근사 ≠ tokenizer-exact" 합의 원칙과도 모순이 없다. lite 휴리스틱은 "여전히 근사" 임을 §12.10 새 항목(추정기는 정확 tokenizer 가 아니라 language-aware lite 휴리스틱)에서 명시적으로 선언하고, 정확 tokenizer 를 도입하지 않은 근거 3가지(Claude 로컬 tokenizer 부재·동기 hot-path 부적합, 신규 의존성 0 원칙, v3 의도적 보류)를 새 Rationale 로 작성했다. 이는 과거 합의를 무근거로 번복하는 것이 아니라 번복 근거와 함께 해당 항목을 명시적으로 갱신한 정상적인 Rationale 확장이다.

---

## 위험도

NONE

---

BLOCK: NO
