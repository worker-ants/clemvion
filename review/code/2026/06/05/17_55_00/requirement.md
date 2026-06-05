# 요구사항 충족 코드 리뷰 — memory-tokenizer-exact-7ff721

- **범위**: `git diff cbfbfbb9..HEAD`
- **확정 설계 (plan A4 lite)**: 무의존 language-aware 휴리스틱, memory 경로만, char/3 fallback, 정확 tokenizer(v3) 미도입
- **일시**: 2026-06-05

---

## 발견사항

### INFO — 테스트 주석의 토큰 수 예상값이 새 추정기와 불일치 (stale comment)
- **위치**: `agent-memory-injection.spec.ts:480`
- **상세**: 해당 줄 주석 `// ~300 tokens budget; each turn ≈133 tokens` 는 이전 char/3 추정기(`400자 / 3 ≈ 134`) 기준이다. 새 language-aware 추정기에서 `'x'.repeat(400)` 은 전부 Latin(÷4) 이므로 **100 토큰**이다. 테스트 자체는 여전히 통과한다 — 6 × 100 = 600 >> 300 이므로 budget 초과 조건이 유지되고 압축이 트리거된다. 기능에는 영향 없으나 주석이 오독을 유발한다.
- **제안**: 주석을 `// ~300 tokens budget; each turn ≈100 tokens (400 Latin chars ÷ 4)` 로 갱신.

### INFO — 빈/비정상 입력 graceful 주석의 "char/3 수준" 표현이 오해 소지
- **위치**: `agent-memory-injection.ts:71` (JSDoc)
- **상세**: `estimateTokensLanguageAware` JSDoc 에 "빈/비정상 입력은 0 또는 char/3 수준으로 graceful" 이라 표현되어 있다. 실제 동작은 빈/non-string → 0, 정상 string → language-aware 계산이며, "char/3 수준" 은 OTHER 버킷(÷3)을 가리키는 것인지 오류 시 fallback인지 모호하다. 별도 try/catch 나 char/3 명시적 fallback 분기는 존재하지 않는다. plan 설계 항목 "미지원/실패 시 기존 char/3 fallback"도 별도 오류 경로가 아닌 OTHER=÷3 버킷을 의미하는 것으로 보인다.
- **제안**: 주석에서 "char/3 수준" 표현을 제거하거나 "분류 불능 스크립트는 OTHER=÷3 버킷" 으로 명확화. 기능 동작은 올바름.

### INFO — `isLatinCodePoint` 범위가 NUL/제어문자(U+0000~U+001F) 를 Latin 으로 분류
- **위치**: `agent-memory-injection.ts:60`
- **상세**: Basic Latin 범위(0x0000~0x024F)에 NUL, 탭, 개행 등 제어문자가 포함되어 ÷4 가중이 적용된다. 이전 char/3 대비 이 문자들의 토큰 기여가 줄어든다. 실제 메모리 텍스트에 제어문자가 드물고, space(U+0020)·tab·개행을 BPE 토큰 안에 포함하는 방식과 동일해 실용적 오차는 무시 가능하다. 기능 요구사항(혼합 한국어+영어 편향 감소) 에는 영향 없음.
- **제안**: 현행 유지. 명시적으로 우려되면 제어문자(0x0000~0x001F)를 OTHER 버킷으로 이동할 수 있으나 ROI 미비.

---

## 요구사항 충족 평가

확정 설계(A4 lite) 의 네 가지 핵심 요구사항을 모두 충족한다.

1. **스크립트별 가중 합리성**: `CHARS_PER_TOKEN_LATIN=4`, `CHARS_PER_TOKEN_CJK=1.7`, `CHARS_PER_TOKEN_OTHER=3` 상수와 코드포인트 분류(`isCjkCodePoint`/`isLatinCodePoint`) 가 plan 설계 및 spec §6.1 Rationale 의 수치와 정확히 일치한다. 한글(AC00~D7A3), 한자(4E00~9FFF), 가나(3040~30FF) 모두 CJK 버킷에 포함되어 혼합 텍스트 편향 감소 목적에 부합한다.

2. **memory 경로 한정 · KB 무변경**: `estimateTokens` import 가 `agent-memory-injection.ts` 에서 완전히 제거됐고, `text-chunker.estimateTokens`(char/3) 는 변경 없이 KB 청킹 경로에서만 사용된다. `estimateTurnTokens` / `estimateWorkingMemoryTokens` / `buildSummaryBufferUpdate` 모두 `estimateTextTokens` 를 경유하므로 memory 예산 경로 전체에 자동 반영된다. 분리 증명 테스트(`does NOT mutate KB chunking estimateTokens`)가 이를 회귀 감시한다.

3. **새 의존성 0**: `package.json` 변경 없음. `estimateTokensLanguageAware` 는 표준 JS 코드포인트 연산만 사용하는 순수 함수이며, 동기 hot-path 적합성을 유지한다.

4. **spec 기술 정확성**: `1-ai-agent.md §6.1` 본문이 language-aware 가중치(Latin ~4, CJK ~1.7, 기타 ~3)와 "여전히 근사", "KB 청킹 별개 경로", "v3 로드맵 잔존" 을 정확히 기술한다. `§12.10 Rationale` 에 Claude 로컬 tokenizer 부재·동기 hot-path·무의존 유지·v3 보류 근거가 명시됐다. `conversation-thread §7` 은 language-aware 개선을 한 줄로 추가하되 v3 tokenizer-exact 잔존을 유지했다. `17-agent-memory.md` Overview 에 SoT 포인터가 삽입됐다.

5. **graceful fallback**: 빈/non-string 입력 → 0 반환이 보장된다. 분류 불능 스크립트는 OTHER=÷3 로 fallback되어 이전 char/3 동작과 동일하게 처리된다. plan 의 "미지원/실패 시 기존 char/3 fallback" 은 이 OTHER 버킷 동작을 가리키며 구현과 일치한다.

발견된 세 건은 모두 주석/명명 수준의 INFO 이며, 기능 동작·테스트 통과·요구사항 충족에 영향을 주지 않는다.

---

## 위험도

NONE

---

BLOCK: NO
