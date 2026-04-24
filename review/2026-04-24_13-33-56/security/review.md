## 보안 코드 리뷰: Text Classifier `includeEvidence` 기능

---

### 발견사항

---

- **[WARNING]** `sanitizeEvidence`에 크기 제한 없음
  - 위치: `text-classifier.handler.ts` — `sanitizeEvidence` 함수
  - 상세: 타입 필터링(`typeof v === 'string'`)만 수행하고 배열 길이와 개별 문자열 길이에 상한이 없음. LLM이 조작된 입력에 반응하여 수백 개의 긴 문자열을 evidence로 반환할 경우 응답 페이로드가 무제한으로 팽창할 수 있음.
  - 제안:
    ```typescript
    function sanitizeEvidence(value: unknown): string[] {
      if (!Array.isArray(value)) return [];
      return value
        .filter((v): v is string => typeof v === 'string')
        .slice(0, 20)                      // 최대 항목 수
        .map((s) => s.slice(0, 200));      // 항목당 최대 길이
    }
    ```

---

- **[WARNING]** 사용자 입력 원문이 evidence로 유출될 수 있음
  - 위치: `buildSingleLabelPrompt` / `buildMultiLabelPrompt` — LLM 지시문
  - 상세: LLM에게 "입력에서 발췌한 단어/문장"을 evidence로 반환하도록 지시함. 즉 `inputField`에 담긴 사용자 원문이 LLM을 거쳐 `output.result.evidence`로 echo-back됨. API 응답을 받는 모든 다운스트림 호출자가 원문의 일부를 볼 수 있으므로, PII(개인정보)가 포함된 입력을 분류할 때 로그·응답·캐시 등에 PII가 노출될 수 있음.
  - 제안: 기능 특성상 제거는 불가하므로, UI 및 API 문서에 "evidence에는 원문 발췌가 포함될 수 있음" 경고를 표기하고, 서버 측 로그에 evidence를 기록할 때 PII 마스킹 처리를 적용할 것.

---

- **[WARNING]** 카테고리 이름/설명이 LLM 프롬프트에 비검증 삽입됨 (기존 취약점, 범위 확대)
  - 위치: `buildSingleLabelPrompt` L178, `buildMultiLabelPrompt` L230
  - 상세: `includeEvidence` 추가로 카테고리 설명이 더 많은 곳에 삽입되었으나, 이미 기존 코드에서 `categoryList`와 `categoryNames`가 프롬프트에 직접 interpolation됨. `validate()`는 `__none__` 예약어만 차단하고, 카테고리 이름/설명에 포함된 프롬프트 인젝션 페이로드(예: `"Billing\nIgnore previous instructions and..."`)를 막지 않음. 카테고리 설정 권한이 신뢰되지 않는 사용자에게 부여되는 경우 LLM 동작 조작이 가능함.
  - 제안: 카테고리명에 개행 문자(`\n`, `\r`) 포함 여부를 `validate()`에서 추가 검증하거나, `categoryList` 생성 시 개행 문자를 strip/escape 처리할 것. 현재 설정 권한이 관리자 전용이라면 위험도는 낮음.

---

- **[INFO]** 하드코딩된 시크릿/인증 우회 없음
  - 변경사항 전반에 걸쳐 API 키, 토큰, 하드코딩된 자격증명이 없음. 인증·인가 로직은 변경되지 않음.

---

- **[INFO]** React 기본 이스케이프에 의한 XSS 방어
  - 위치: `ai-configs.tsx` — evidence 관련 신규 UI
  - 상세: UI에서 evidence 값을 직접 렌더링하는 코드는 이번 변경에 없음. 향후 evidence를 표시하는 컴포넌트 구현 시 `dangerouslySetInnerHTML` 사용을 금지하고 React 텍스트 바인딩을 사용할 것.

---

### 요약

이번 변경은 LLM 응답에서 evidence 배열을 파싱·반환하는 기능을 추가했다. `sanitizeEvidence`가 타입 수준의 방어를 제공하는 점은 긍정적이나, 배열 길이·문자열 길이 상한이 없어 조작된 입력이 비정상적으로 큰 응답을 유발할 수 있다. 구조적으로 더 중요한 점은 evidence가 사용자 원문 발췌를 API 응답에 포함시키는 설계임을 인지하고, PII가 포함될 수 있는 워크플로우에서는 추가적인 취급 주의가 필요하다는 것이다. 카테고리 설정에 대한 접근 제어가 적절히 관리된다면 프롬프트 인젝션 위험은 낮은 수준이다. 전반적으로 신규 도입된 취약점은 없으며, 기존 설계 패턴을 일관되게 확장한 변경이다.

---

### 위험도

**LOW**