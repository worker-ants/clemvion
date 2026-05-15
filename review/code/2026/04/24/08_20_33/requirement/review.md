두 리뷰 파일의 내용을 바탕으로 실제 코드 변경사항을 요구사항 관점에서 분석합니다.

## Requirement Code Review

### 발견사항

---

**[WARNING]** `provider` 변경 시 모델 목록 자동 초기화 요구사항 누락
- **위치**: `model-combobox.tsx` — provider prop 변경 처리 전반
- **상세**: side-effect 리뷰에서 provider가 `openai → anthropic`으로 바뀔 때 stale 모델 목록이 silently 적용되는 문제를 지적했으나, 더 근본적인 요구사항이 명시되지 않았다. "provider가 바뀌면 기존에 로드한 모델 목록을 즉시 초기화해야 한다"는 요구사항이 구현에 반영되어 있는지 불명확하다. 현재 구현은 해당 요구사항이 없는 것처럼 동작한다.
- **제안**: `useEffect(() => { setModels([]); setErrorMessage(null); }, [provider])` 로 provider 변경 시 상태 초기화. 요구사항 문서에 명시 필요.

---

**[WARNING]** `apiKey` 변경 시 이전 로드된 모델 목록 처리 요구사항 미정의
- **위치**: `model-combobox.tsx` — apiKey prop 처리
- **상세**: 사용자가 API 키를 변경한 뒤 기존 모델 목록이 그대로 표시되는지, 초기화되어야 하는지에 대한 요구사항이 두 리뷰 모두에서 언급되지 않았다. provider 변경과 동일하게 apiKey 변경 시 stale 모델 목록이 남아있으면 잘못된 키로 로드된 모델이 계속 선택 가능 상태가 된다.
- **제안**: apiKey 변경 시에도 모델 목록 초기화 여부를 요구사항으로 명시하고 구현.

---

**[WARNING]** `useSavedConfig` 비즈니스 규칙의 우선순위 정의 불명확
- **위치**: `model-combobox.tsx:44–47` — `useSavedConfig = Boolean(configId) && !trimmedKey`
- **상세**: "configId가 있고 apiKey 입력이 없으면 저장된 설정을 사용한다"는 규칙이 구현되어 있으나, 요구사항 관점에서 "apiKey를 입력했다가 지우면 saved config로 자동 전환된다"는 동작이 의도된 것인지 불명확하다. 반대로 configId는 있지만 apiKey를 직접 입력하는 경우(설정 수정 플로우)에 정확히 어떤 엔드포인트를 호출해야 하는지 명시되지 않았다.
- **제안**: create/edit 플로우에서 saved config 사용 vs. 직접 키 사용의 의사결정 트리를 요구사항으로 문서화.

---

**[WARNING]** "chat-only" 모델 필터링 기준 요구사항 미명시
- **위치**: `model-combobox.tsx` — chatModels 필터링 로직
- **상세**: testing 리뷰에서 "chat 전용 모델 필터링" 케이스가 검증된다고 언급하지만, 어떤 기준으로 모델이 "chat-only"인지 요구사항이 명시되지 않았다. API 응답의 어떤 필드를 기준으로 필터링하는지, 필터링 기준이 provider마다 다른지 불분명하다. 기준이 바뀌면 모든 provider에서 silent regression이 발생한다.
- **제안**: 필터링 기준(예: `type === 'chat'`, 특정 모델 ID prefix 등)을 요구사항 문서에 명시하고 테스트 케이스에 반영.

---

**[INFO]** 에러 메시지 sanitize 범위 요구사항 미정의
- **위치**: `model-combobox.tsx` — 에러 처리 로직
- **상세**: testing 리뷰에서 "sanitized error message"가 표시되는지 검증하지만, 어떤 에러가 sanitize되어야 하는지(API key 노출 방지, 내부 서버 오류 메시지 은닉 등) 요구사항이 명시되지 않았다. 현재는 `response.data.message`를 그대로 표시하는 것으로 보이며, 이것이 항상 사용자에게 노출해도 안전한 메시지인지 보장이 없다.
- **제안**: 에러 메시지 sanitize 규칙(예: "axios 에러는 response.data.message만 표시, 나머지는 generic 메시지") 요구사항 명시.

---

**[INFO]** `PROVIDERS_REQUIRING_BASE_URL` 목록의 완전성 검증 부재
- **위치**: `model-combobox.tsx` — baseUrl 필수 여부 판별 로직
- **상세**: 어떤 provider가 baseUrl을 요구하는지 상수로 관리되는 것으로 보이나, 두 리뷰 모두 이 목록이 현재 지원 provider 전체를 올바르게 포함하는지 검증하지 않았다. 새 로컬 provider 추가 시 목록 미업데이트로 버튼이 잘못 활성화될 수 있다.
- **제안**: 지원 provider 목록 변경 시 `PROVIDERS_REQUIRING_BASE_URL` 동기화를 요구사항 체크리스트에 포함.

---

**[INFO]** 로드 성공 후 선택값(`value`) 유효성 재검증 요구사항 미정의
- **위치**: `model-combobox.tsx` — `onSuccess` 핸들러
- **상세**: 모델 목록이 새로 로드되었을 때 기존에 선택된 `value`가 새 목록에 없을 경우(예: provider 변경 후 재로드) 어떻게 처리해야 하는지 요구사항이 없다. 현재 `value`는 부모가 관리하므로 invalid 선택이 유지될 수 있다.
- **제안**: 로드 완료 후 현재 value가 목록에 없으면 `onChange('')`를 호출할지 여부를 요구사항으로 정의.

---

### 요약

두 리뷰(side-effect, testing)는 구현 수준의 버그와 테스트 커버리지 갭을 잘 포착했으나, 요구사항 관점에서는 중요한 비즈니스 규칙들이 암묵적으로 처리되고 있다. provider/apiKey 변경 시 모델 목록 초기화 정책, saved config와 직접 API key 사용의 우선순위 규칙, chat-only 모델 필터링 기준, 에러 메시지 sanitize 범위가 명시적 요구사항 없이 구현된 것으로 보인다. 현재 동작이 의도와 일치하더라도 이 규칙들이 문서화되지 않으면 향후 수정 시 기준이 없어 silent regression이 발생할 위험이 있다. 즉각적인 기능 결함보다는 요구사항-구현 간 추적성(traceability) 부재가 가장 큰 위험이다.

### 위험도
**LOW**