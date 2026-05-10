### 발견사항

- **[WARNING]** `meta.durationMs` 측정 범위가 스펙 설명과 불일치
  - 위치: `handler.ts` — `const errorDurationMs = Date.now() - callStartedAt;` (callStartedAt은 LLM 호출 직전 선언)
  - 상세: 스펙 §5.3은 `meta.durationMs`를 "에러 발생 전까지 소요된 시간"으로 기술하지만, `callStartedAt`이 `execute()` 진입 시점이 아니라 `llmService.chat()` 호출 직전에 찍힌다. `resolveConfig`, 프롬프트 빌드 등의 사전 처리 시간이 누락된다.
  - 제안: `callStartedAt`을 `execute()` 메서드 시작 직후(또는 config echo 빌드 전)로 이동시키거나, 스펙의 설명을 "LLM 호출 소요 시간"으로 명확히 수정.

- **[WARNING]** 스펙 §5.3 필드 표에 `output.originalInput` 항목 누락
  - 위치: `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 diff
  - 상세: JSON 예시에 `"originalInput": "환불 요청드립니다"` 가 추가되었으나, 하단 필드 표에 `output.originalInput` 행이 없다. `output.error.details.originalInput`(truncated 500자)과 `output.originalInput`(full 원문)은 별개 필드이며, 후자는 문서화되지 않은 채 실제로 반환된다.
  - 제안: §5.3 표에 `output.originalInput | String | handler return | LLM에 투입된 resolved 입력 원문 (디버깅용; details.originalInput의 truncated 값과 구분)` 행 추가.

- **[INFO]** 멀티레이블 에러 테스트에서 `requestPayload` 검증 누락
  - 위치: `spec.ts` — `should include execution metrics in meta on LLM failure (multi-label, Principle 2)`
  - 상세: 싱글레이블 동일 테스트에는 `expect(llmCalls[0].requestPayload).toBeDefined()` 가 있으나, 멀티레이블 케이스에는 없다. 에러 경로에서 `requestPayload`가 `meta.llmCalls`에 정상 동봉되는지 멀티레이블에서도 검증이 필요하다.
  - 제안: 멀티레이블 에러 테스트에 `expect(llmCalls[0].requestPayload).toBeDefined();` 추가.

- **[INFO]** `meta.durationMs`와 `meta.llmCalls[0].durationMs` 동일값 재사용
  - 위치: `handler.ts` — `errorDurationMs` 변수
  - 상세: 두 필드 모두 `errorDurationMs`로 설정된다. 성공 경로에서는 `meta.durationMs`(엔진 주입, 전체 실행)와 `llmCalls[0].durationMs`(LLM 호출만)이 논리적으로 다른 값이지만, 에러 경로에서는 동일 값이다. 스펙이 이를 의도적으로 허용하는지 명시하지 않는다.
  - 제안: 스펙 §5.3 `meta.durationMs` 설명에 "에러 경로에서는 LLM 호출 시간과 일치할 수 있다"는 주석 추가.

---

### 요약

이번 변경은 P1 버그("에러 경로에서 `meta`가 빈 객체")를 정확히 수정하며, `_llmCalls`를 `output`에서 `meta.llmCalls`로 올바르게 이동하고, `durationMs`·`model`을 에러 경로에 추가했다. 구현·테스트·스펙이 전반적으로 정합하나, **`meta.durationMs` 측정 기준점**(`callStartedAt`이 전체 실행 시작이 아닌 LLM 호출 직전)이 스펙 문장("에러 발생 전까지 소요된 시간")과 미묘하게 어긋나고, **스펙 §5.3 필드 표에 `output.originalInput`이 누락**되어 문서-코드 간 불일치가 남는다.

### 위험도

**LOW**