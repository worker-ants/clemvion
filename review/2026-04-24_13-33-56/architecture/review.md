### 발견사항

- **[WARNING]** 파라미터 목록 증식 (Parameter List Proliferation)
  - 위치: `handler.ts` — `processSingleLabelResult`, `processMultiLabelResult`, `buildSingleLabelPrompt`, `buildMultiLabelPrompt`
  - 상세: `includeConfidence`에 이어 `includeEvidence`가 동일한 방식으로 각 private 메서드 시그니처에 추가됨. `execute()` → `build*Prompt()` → `process*Result()` 전체 호출 체인에 불리언 플래그가 하나씩 누적되는 구조. 이 패턴대로라면 `includeRawResponse`, `includeSimilarityScore` 등이 추가될 때마다 모든 메서드 시그니처를 수정해야 하며, Open/Closed 원칙에 위배됨.
  - 제안: 출력 옵션을 하나의 값 객체로 묶기.
    ```typescript
    interface OutputOptions {
      includeConfidence: boolean;
      includeEvidence: boolean;
    }
    // processSingleLabelResult(result, categories, inputField, opts: OutputOptions, llmCalls)
    ```
    새 플래그 추가 시 메서드 시그니처가 변하지 않아 OCP를 유지할 수 있음.

- **[WARNING]** 프롬프트 필드 조립 방식의 취약성
  - 위치: `handler.ts:175-186`, `handler.ts:226-237` (`responseFields` / `itemFields`)
  - 상세: 조건부 필드를 빈 문자열(`''`)로 채운 뒤 `.filter(Boolean)`으로 걸러내는 패턴. 현재 2개이지만 옵션이 늘어날수록 가독성이 급격히 하락하고, 실수로 빈 줄이 프롬프트에 포함될 위험이 있음.
  - 제안: 명시적인 조건 push 방식으로 전환.
    ```typescript
    const responseFields: string[] = [
      `- "category": ...`,
    ];
    if (includeConfidence) responseFields.push('- "confidence": ...');
    if (includeEvidence)   responseFields.push('- "evidence": ...');
    ```

- **[INFO]** `sanitizeEvidence`의 모듈 경계
  - 위치: `handler.ts` 말미 모듈 레벨 함수
  - 상세: 현재 이 파일에서만 쓰이므로 위치가 적절함. 그러나 `includeConfidence`의 숫자 정규화 같은 유사 로직이 분산 구현될 경우 공통 유틸 모듈 부재가 문제가 됨. 지금 당장은 이슈 없음.
  - 제안: 향후 다른 핸들러에서 동일 필요가 생기면 `nodes/ai/shared/sanitize.ts` 같은 공유 유틸로 이동.

- **[INFO]** `textClassifierNodeOutputSchema`의 `passthrough` 허용
  - 위치: `schema.ts:94`
  - 상세: 스키마가 `passthrough()`이므로 `evidence` 추가가 런타임 검증에 영향 없음. 현재 스키마가 "자동완성 힌트" 목적임을 주석으로 명시하고 있어 의도적인 설계임. 아키텍처적으로 허용 가능한 선택.

---

### 요약

이번 변경은 기존 `includeConfidence` 구현 패턴을 그대로 답습하여 `includeEvidence`를 추가한 것으로, **레이어 분리(프론트엔드 UI / 백엔드 핸들러 / 스키마 / 스펙)가 올바르게 유지**되고 순환 의존성도 없다. `sanitizeEvidence` 분리, 테스트 구조화(`describe` 중첩), 스펙 문서 동기화 등 세부 사항도 양호하다. 다만 `include*` 불리언 플래그를 모든 private 메서드 파라미터에 개별 추가하는 패턴이 이번에 두 번 반복되었으며, 세 번째 플래그가 추가될 시점에는 값 객체(Output Options DTO)로 리팩토링하지 않으면 유지보수 부채가 누적된다. 현시점의 기능 동작과 테스트 품질에는 문제가 없다.

### 위험도

**LOW**