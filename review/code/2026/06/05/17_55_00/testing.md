# Testing Review — memory-tokenizer-exact-7ff721

**대상**: `git diff cbfbfbb9..HEAD -- codebase/`
**파일**: `codebase/backend/src/nodes/ai/ai-agent/agent-memory-injection.ts` + `.spec.ts`
**변경 요약**: `estimateTokens` (char/3 uniform) 의존 제거 → 인라인 `estimateTokensLanguageAware` (A4 lite, language-aware) 도입.

---

## CRITICAL

없음.

---

## WARNING

### W-1 — 순수 CJK 테스트에 하한(lower bound) 단언 없음
- **위치**: `agent-memory-injection.spec.ts:901-908` (`pure Korean (CJK) → more tokens than uniform char/3`)
- **상세**: 테스트는 `aware > uniformChar3(korean)` (방향 단언)만 검사하고, CJK 분류가 실제로 ÷1.7 로 작동하는지 확인하는 하한을 검사하지 않는다. 예를 들어 Hangul Syllables 범위를 OTHER(÷3)로 잘못 분류해도 ÷3 > char/3(÷3) 는 동일하므로 이 테스트는 통과한다 — 방향은 맞지만 CJK 경로가 실제로 호출됐는지 보장하지 않는다.
- **제안**: `expect(aware).toBeGreaterThan(korean.length / 2)` 수준의 하한 추가. 순수 한글 음절만으로 구성된 짧은 문자열(공백 없음)에 대해 `aware` ≈ `ceil(len / 1.7)` 을 독립 oracle 로 단언하는 케이스 1개 추가.

### W-2 — CJK 7개 서브레인지 중 Hangul Syllables 1개만 간접 커버
- **위치**: `agent-memory-injection.ts:46-54` (`isCjkCodePoint`)
- **상세**: `isCjkCodePoint` 는 8개 유니코드 레인지를 포함하지만 테스트는 한글 음절(U+AC00–D7A3)만 간접 커버한다. Hangul Jamo(U+1100–11FF), Hangul Compatibility Jamo(U+3130–318F), CJK Unified Ideographs(U+4E00–9FFF), CJK Extension A(U+3400–4DBF), Hiragana/Katakana(U+3040–30FF), CJK Symbols(U+3000–303F), Halfwidth/Fullwidth Forms(U+FF00–FFEF) 각 레인지에 대한 단언이 없다. 레인지 오타(예: `0x11ff` → `0x11ef`) 가 있어도 기존 테스트는 통과한다.
- **제안**: 각 레인지에서 대표 문자(예: 中, あ, ア, ㄱ) 1개씩을 포함한 파라미터화 테스트 추가. `estimateTokensLanguageAware` 로 단일 문자를 넣어 `ceil(1/1.7) = 1` 임을 확인하면 충분하다.

---

## INFO

### I-1 — `toBeCloseTo(-1)` 주석 오류 ("±10% 오차 허용")
- **위치**: `agent-memory-injection.spec.ts:897`
- **상세**: Jest `toBeCloseTo(x, -1)` 의 실제 허용 오차는 `10^1 / 2 = ±5 토큰`(절대값)이다. 주석은 "±10% 오차 허용"이라고 적혀 있으나, 영문 텍스트(880자, 예상값 220)에서 10%는 ±22 토큰으로 전혀 다른 기준이다. 기능 결함은 없고, 단순 문서 오류다.
- **제안**: 주석을 `// ±5 토큰 (절대) 허용 — toBeCloseTo(-1) = 10^1/2` 로 정정.

### I-2 — 순수 CJK 테스트 주석의 공백 분류 오류
- **위치**: `agent-memory-injection.spec.ts:906` (주석: "한국어는 공백(÷3)을 빼면...")
- **상세**: 공백(U+0020)은 `isLatinCodePoint` 에서 Latin Basic(0x0000–024F) 에 해당하므로 ÷4로 처리된다. 주석은 공백을 ÷3(OTHER)으로 설명하나 실제로는 ÷4다. 단언 자체(`aware > char/3`)는 수치적으로 정확히 통과하므로 런타임 결함은 없다.
- **제안**: 주석을 "공백은 Latin(÷4), CJK 음절은 ÷1.7 → 전체 합이 char/3 보다 커진다"로 수정.

### I-3 — `estimateWorkingMemoryTokens` 통합 테스트가 순환 논리(tautological)
- **위치**: `agent-memory-injection.spec.ts:925-935`
- **상세**: `expected` 계산에 `estimateTextTokens` / `estimateTurnTokens` 를 그대로 사용하므로 합산 체인의 구조적 연결은 검증하지만, 숫자가 실제로 맞는지를 독립 oracle 로 확인하지 않는다. 독립 oracle 단언(`expect(total).toBe(11)` 형태) 1개를 추가하면 완전한 회귀 가드가 된다.

### I-4 — `estimateWorkingMemoryTokens` 기존 테스트(line 870)와 신규 테스트(line 925) 중복
- **위치**: `agent-memory-injection.spec.ts:870-876` vs `925-935`
- **상세**: line 870 describe는 `sums turn text + extra texts` 단언만 있고, line 925에서 더 구체적인 동일 케이스가 다시 검증된다. 중복 자체가 버그를 잡지는 않는다.

### I-5 — KB 분리 테스트가 영문 텍스트만 대조
- **위치**: `agent-memory-injection.spec.ts:948-952`
- **상세**: `estimateTextTokens` ≠ `kbEstimateTokens` 를 보장하는 "분리 증명" 단언이 영문 텍스트(`'The quick brown fox '.repeat(10)`)만 사용한다. CJK 텍스트에서도 두 경로가 다른지(÷1.7 vs ÷3) 확인하면 CJK 분기가 memory 경로에서 실제로 다르게 동작한다는 것을 더 명확히 증명한다.

### I-6 — 서로게이트 페어 / Emoji OTHER(÷3) 분류 미검증
- **위치**: `agent-memory-injection.ts:77-88`
- **상세**: `for...of` 는 서로게이트 페어를 코드포인트 단위로 올바르게 iterate하지만, Emoji(예: 😀, U+1F600)가 OTHER(÷3)로 분류되는지 검증하는 테스트가 없다. 나중에 범위 확장 시 회귀 가드가 없다.

---

## 요약

신규 `estimateTokensLanguageAware` 테스트들은 핵심 방향(영문↓ 토큰, CJK↑ 토큰, 혼합 중간, 빈/비정상 graceful, KB 분리)을 올바르게 단언하며, B3 oracle 회귀 테스트는 oracle이 동일한 `estimateTurnTokens`를 참조하므로 추정기 변경 후에도 bit-identical 불변식이 유지된다. KB 청킹 무변경 확인 테스트도 의도에 맞게 작성됐다. 다만 `isCjkCodePoint` 의 8개 서브레인지 중 Hangul Syllables(U+AC00–D7A3) 1개만 간접 커버되어 나머지 7개에 대한 경계 오류가 탐지되지 않고, 순수 CJK 테스트에 방향 단언만 있고 하한이 없어 CJK ÷1.7 분기가 실제로 호출되는지 보장하지 않는 점이 주요 갭이다. 코드 자체의 로직은 올바르며 기존 테스트 회귀는 없다.

---

## 위험도

**LOW**

---

BLOCK: NO
