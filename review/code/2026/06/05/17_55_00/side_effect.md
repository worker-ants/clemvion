# Side Effect Review — memory tokenizer language-aware (A4 lite)

대상 diff: `cbfbfbb9..HEAD -- codebase/`
검토일: 2026-06-05

---

## 발견사항

### INFO: KB 청킹 `estimateTokens` 무변경 확인
- 위치: `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts`
- 상세: `text-chunker.estimateTokens` (char/3) 는 이번 diff 에서 전혀 수정되지 않았다. `agent-memory-injection.ts` 가 해당 함수를 import 하지 않도록 제거했을 뿐이며, KB 청킹(text-chunker, csv-chunker) 경로는 완전히 독립 유지된다. 테스트에서도 `kbEstimateTokens` 를 직접 import 해 char/3 공식이 불변임을 증명한다.
- 제안: 없음 (확인 완료).

### INFO: `estimateTextTokens` 빈 문자열 가드 차이
- 위치: `agent-memory-injection.ts` L100-103
- 상세: `estimateTextTokens` 는 `if (!text) return 0` (falsy 전체)로 가드하고, `estimateTokensLanguageAware` 는 `if (!text || typeof text !== 'string') return 0` 으로 추가 타입 체크를 한다. 두 함수 모두 정상 경로에서 동일한 동작을 하며, 이중 가드가 있어도 부작용 없이 `0` 을 반환한다.
- 제안: 없음.

### INFO: `isLatinCodePoint` 가 U+0000(NULL)~U+001F(제어 문자) 포함
- 위치: `agent-memory-injection.ts` L59-63, 범위 `0x0000..0x024f`
- 상세: NULL 바이트, 탭, 개행 등 ASCII 제어 문자(U+0000-U+001F)가 Latin으로 분류되어 ÷4 로 계산된다. 기존 char/3 대비 이 문자들의 토큰 가중치가 낮아진다. 실제 대화 텍스트에서 제어 문자는 극히 드물고, 개행·탭 정도가 포함될 수 있으나 전체 추정에 미치는 영향은 미미하다. 의도된 분류라고 볼 수 있으나 명시적 언급은 없다.
- 제안: 문서 주석에 "제어 문자 포함" 을 명시하거나, `cp > 0x001f` 조건을 추가해 제어 문자를 OTHER 로 처리하는 것을 고려할 수 있다. 현 동작에서 버그는 아님.

### INFO: CJK Unified Ideographs Extension B/C/D (U+20000 이상) 미포함
- 위치: `agent-memory-injection.ts` L44-55, `isCjkCodePoint`
- 상세: `isCjkCodePoint` 는 Extension A (0x3400-0x4DBF) 까지만 커버한다. Extension B (0x20000-0x2A6DF), C, D 등 고한자는 OTHER (÷3) 로 처리된다. 이들은 실제 대화에서 거의 출현하지 않는 희귀 한자이므로 실질적 영향은 없다. 과소평가 → 추정치가 더 낮게 나오는 방향이므로 최악의 경우 English-only 세션처럼 압축을 늦게 트리거할 수 있으나 무시 가능한 수준이다.
- 제안: 없음 (미미한 정확도 trade-off, 의도적 단순화 허용 범위).

### WARNING: 영문 세션 압축 임계 임계값 대폭 이동 (÷3 → ÷4, +33% 지연)
- 위치: `agent-memory-injection.ts` L36-88, `buildSummaryBufferUpdate`
- 상세: 영문 전용 세션에서 `estimateWorkingMemoryTokens` 가 기존 대비 약 75% 로 줄어든다(÷4 vs ÷3). `DEFAULT_MEMORY_TOKEN_BUDGET = 8000` 기준으로 기존에는 ~24,000자에서 압축이 트리거되었지만, 이제 ~32,000자에서 트리거된다. 이는 **의도된 개선**이다(영문 BPE 과대평가 수정). 그러나 기존 운영 중인 세션(`runningSummary` + `summarizedUpToSeq` 이미 존재)은 업그레이드 후 첫 턴에서 새 추정기로 재평가되므로, 영문 heavy 세션은 즉시 "예산 여유 있음"으로 전환되어 압축을 건너뛸 수 있다. 반대로 한국어 heavy 세션은 ÷1.7 로 기존 대비 ~1.76배 높아져 **다음 턴에 즉시 압축 트리거**될 수 있다. 두 경우 모두 일회성 과도기적 동작이며, 이후 정상 상태로 수렴한다. 데이터 손상 위험은 없다.
- 제안: 의도된 동작이므로 차단 불필요. 다만 기존 한국어 heavy 세션에서 업그레이드 직후 불필요한 요약 LLM 콜이 한 번 발생할 수 있음을 인지하는 것이 좋다. 필요하다면 마이그레이션 노트에 기재.

### INFO: `manual` 전략 완전 무영향 확인
- 위치: `ai-agent.handler.ts` L1493, `agent-memory-injection.ts` 파일 상단 주석
- 상세: `memoryStrategy === 'manual'` 분기는 `injectMemoryContext` 자체를 호출하지 않으므로, `buildSummaryBufferUpdate` / `estimateWorkingMemoryTokens` / 새 추정 함수 일체를 거치지 않는다. `manual` 경로 완전 무변경 확인.
- 제안: 없음.

### INFO: `compactMessagesToTail` 와 `meta.memory` 는 새 추정기와 무관
- 위치: `ai-agent.handler.ts` L874, L2418
- 상세: `compactMessagesToTail` 는 토큰 추정값을 전혀 사용하지 않는다(user 메시지 카운트 기반). `meta.memory.tokenBudgetUsed` 는 `estimateWorkingMemoryTokens` 결과를 echo 할 뿐이므로 새 추정기로 인해 값이 변경되는 것은 정보성 변화이며 로직 분기에 영향 없다.
- 제안: 없음.

### INFO: 새 상수·함수가 모두 모듈-스코프 unexported (CHARS_PER_TOKEN_*, isCjkCodePoint, isLatinCodePoint)
- 위치: `agent-memory-injection.ts` L36-63
- 상세: `CHARS_PER_TOKEN_*` 상수들과 `isCjkCodePoint`, `isLatinCodePoint` 는 모두 `const`/`function` (비export)로 선언되어 모듈 외부에 노출되지 않는다. `estimateTokensLanguageAware` 는 `export` 이지만, 이는 테스트에서 직접 검증을 위한 의도적 export 이며 다른 프로덕션 파일에서는 import 하지 않는다.
- 제안: 없음.

---

## 요약

이번 변경은 `agent-memory-injection.ts` 내부의 `estimateTextTokens` 구현체를 KB 청킹의 `text-chunker.estimateTokens` (char/3) 의존 제거 후 모듈-내장 language-aware 휴리스틱(A4 lite)으로 교체한다. KB 청킹 경로(text-chunker, csv-chunker, thread cap)는 코드 변경 없이 char/3 그대로 유지되어 회귀 0이 확인된다. 새 함수는 순수(pure), 동기, 외부 의존성 없음 조건을 만족하며 전역 상태·파일시스템·네트워크·환경 변수를 전혀 건드리지 않는다. `manual` 전략 경로는 완전히 우회된다. 의미 있는 부작용은 단 하나 — `summary_buffer`/`persistent` 전략의 압축 임계치 이동이며, 이는 설계 의도이다. 영문 heavy 기존 세션은 업그레이드 후 압축 트리거가 지연되고, 한국어 heavy 기존 세션은 다음 턴에 일회성 즉시 압축이 발생할 수 있다. 두 경우 모두 데이터 손상 없이 수렴하는 일회성 과도기 동작이다.

---

## 위험도

LOW

---

BLOCK: NO
