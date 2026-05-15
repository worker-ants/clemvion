## 발견사항

- **[INFO]** `mockLlmService`에 `clearClientCache` 포함 (미검증)
  - 위치: `llm-config.controller.spec.ts`, `beforeEach` 블록 `mockLlmService` 설정
  - 상세: `clearClientCache: jest.fn()`이 mock에 포함되어 있으나, 이 spec의 어떤 테스트도 이 메서드를 호출하거나 검증하지 않는다. `LlmConfigController`의 `previewModels` 핸들러는 `clearClientCache`를 사용하지 않으므로 mock 범위가 실제 테스트 대상보다 넓다.
  - 제안: `clearClientCache` 항목을 mock에서 제거하거나, 향후 관련 테스트가 추가될 때 함께 포함한다.

- **[INFO]** `model-combobox.test.tsx` 에러 케이스에서 synchronous throw 사용
  - 위치: `model-combobox.test.tsx`, `shows a sanitized error message` 케이스
  - 상세: `mockImplementation(() => { throw Object.assign(...) })` 로 동기 throw를 사용한다. `mutationFn`이 `async`이므로 현재는 동작하지만, `mockRejectedValue` 방식이 의미상 더 정확하고 실제 axios 에러 흐름과 일치한다. 테스트 표현 일관성 문제이며 범위 이탈은 아니다.
  - 제안: `vi.mocked(llmConfigsApi.previewModels).mockRejectedValue(...)` 로 변경한다.

---

## 요약

4개 파일(백엔드 컨트롤러 spec, 프론트엔드 컴포넌트 + 테스트, API 클라이언트 테스트) 모두 `preview-models` 기능 및 RESOLUTION.md에 기술된 조치 항목(W-6 trim, W-8 configId+apiKey, I-1 baseUrl 가드, I-2 상수 추출, I-6 JSDoc, I-7 testid, W-12 언래핑 테스트)에 직결된 변경만 포함하고 있다. 무관한 리팩토링, 포맷팅 변경, 불필요한 기능 확장은 발견되지 않았다. 유일한 지적 사항은 컨트롤러 spec의 `clearClientCache` 미검증 mock 항목과 에러 mock 패턴 불일치로, 둘 다 경미한 코드 품질 이슈에 해당한다.

## 위험도

**NONE**