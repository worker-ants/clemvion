## 발견사항

---

### **[INFO]** 리뷰 문서 자체의 부작용 — 없음
- **위치**: 모든 파일 (`.md`, `.json`)
- **상세**: 48개 파일 전체가 실행 불가능한 마크다운 리뷰 문서 또는 메타데이터 JSON이다. 전역 상태 변경, 파일시스템 접근, 네트워크 호출, 이벤트 발생이 없다. 파일 4(2026-04-24_08-20-33)의 side_effect 리뷰가 이 점을 정확히 명시하고 있다.

---

### **[WARNING]** Google SDK 마이그레이션 — 스트림 usage metadata fallback 제거 (라운드 2 식별, 미해결 추적 없음)
- **위치**: 파일 17 (`2026-04-24_08-11-00/side_effect/review.md`) — `stream()` 분석
- **상세**: 구 SDK는 스트림 청크에 `usageMetadata`가 없을 때 `await result.response`로 최종 집계값을 보조 조회했다. 신 SDK(`@google/genai`)는 이 fallback 경로를 완전히 제거했으며, 일부 Gemini 모델은 청크별 usage를 스트리밍하지 않는다. 결과: **토큰 사용량 0 기록 → 과금·모니터링 데이터 오염**. 4개 라운드 리뷰 문서 어디에도 이 이슈가 해결되었다는 기록이 없다.
- **제안**: `stream()` 종료 후 `totalTokens === 0`이면 보완 조회하거나, 신 SDK의 `finalUsageMetadata` 지원 여부를 확인해야 한다. RESOLUTION.md에 해결 여부를 명시할 것.

---

### **[WARNING]** `listModels` 실시간 전환 — 항상 성공하던 코드 경로가 이제 실패 가능 (라운드 2 식별)
- **위치**: 파일 17 (`2026-04-24_08-11-00/side_effect/review.md`) — `anthropic.client.ts:132-143`
- **상세**: `Promise.resolve(ANTHROPIC_MODELS)` 즉시 반환에서 `client.models.list()` 실제 HTTP 요청으로 전환됨. 서비스 부팅 시 모델 목록 캐싱, `testConnection` 내부 호출 등 **실패 없이 항상 완료된다고 가정한 코드 경로**가 이제 네트워크 오류·401·429를 수신할 수 있다. 라운드 2에서 "`testConnection()`이 내부적으로 `listModels`를 직접 쓰는 경우가 없는지 점검 필요"라고 명시했으나, 이후 라운드에서 점검 결과가 확인되지 않았다.
- **제안**: `testConnection()` 구현이 `listModels` 호출 여부를 명시적으로 확인하고 결과를 RESOLUTION.md에 기록할 것.

---

### **[WARNING]** `listModels` 에러 타입 변경 — 기존 호출자 동작 변화 (라운드 2 식별)
- **위치**: 파일 17 (`2026-04-24_08-11-00/side_effect/review.md`) — `llm.service.ts:197-209`
- **상세**: 기존에는 프로바이더 원본 에러(`AxiosError`, `APIError`)를 그대로 전파했으나, 변경 후 `BadRequestException({ code: 'LLM_MODEL_LIST_FAILED' })`로 래핑된다. **에러 타입을 기준으로 분기하던 상위 호출자가 있다면 silent 동작 변경**이 발생한다. 라운드 2에서 "컨트롤러가 에러를 그대로 NestJS 파이프라인에 올리므로 큰 문제는 없다"고 평가했으나, 다른 호출자 경로는 미검증 상태다.
- **제안**: `listModels`의 모든 호출자에서 에러 타입 의존성이 없는지 코드베이스 검색 필요.

---

### **[WARNING]** Google `embed()` N+1 → 배치 전환 — silent failure 경로 (라운드 2 식별, 미해결)
- **위치**: 파일 17 (`2026-04-24_08-11-00/side_effect/review.md`) — `google.client.ts:490-494`
- **상세**: `response.embeddings`가 `undefined`이면 `[]` 반환, `values`가 없으면 `[]` 벡터 반환. 호출자가 빈 벡터를 에러로 감지하지 못하면 **임베딩 없이 저장되는 silent failure**가 발생한다. 4개 라운드 전체에서 이 이슈가 해결되었다는 기록이 없으며, 입력 `texts.length`와 출력 벡터 수가 일치하는지 검증하는 assertion도 추가되지 않았다.
- **제안**: `embed()` 내부에서 `result.embeddings?.length !== texts.length`를 명시적으로 체크하고 에러를 throw할 것.

---

### **[WARNING]** `models` state가 props 변경에 반응하지 않음 (라운드 3 식별, 라운드 4 미수정 확인)
- **위치**: 파일 32 (`2026-04-24_08-16-06/side_effect/review.md`) — `model-combobox.tsx:27`
- **상세**: `provider`, `apiKey`, `baseUrl`, `configId` props가 변경되어도 `models` state를 초기화하는 `useEffect`가 없다. 사용자가 프로바이더를 `openai → anthropic`으로 바꾼 뒤 "모델 불러오기"를 클릭하지 않으면, datalist에 이전 프로바이더의 모델 목록이 잔존해 오토컴플리트 제안을 오염시킨다. 라운드 4의 testing 리뷰(파일 48)에서 이 컴포넌트 버그가 "미수정" 상태임을 재확인했다.
- **제안**: `useEffect(() => { setModels([]); }, [provider, configId]);` 추가.

---

### **[WARNING]** `onMutate`/`onError` 비대칭 상태 관리 — 서로 다른 요청 결과 혼재 (라운드 3 식별)
- **위치**: 파일 32 (`2026-04-24_08-16-06/side_effect/review.md`) — `model-combobox.tsx:64-68`
- **상세**: 성공 로드 → 재시도 중 → 실패 시나리오에서 `models`는 첫 번째 요청의 성공 결과이고 `errorMessage`는 두 번째 요청의 오류인 혼재 상태가 발생한다. datalist가 이전 성공의 모델을 보여주면서 동시에 새 오류를 표시하는 UI 상태다. 라운드 3 문서에서는 "의도적 설계"로 주석을 달 것을 제안했으나, 라운드 4(파일 41)에서는 "숨은 결합(hidden coupling)"으로 위험도를 재평가했다.
- **제안**: `onMutate`에서 모든 비관적 초기화(`setModels`, `setErrorMessage`)를 일괄 수행하도록 집중하거나, 의도된 동작임을 코드 주석으로 명확히 기록.

---

### **[INFO]** 라운드 간 side_effect 리뷰 중복 — 동일 이슈 반복 계수 (리뷰 워크플로 부작용)
- **위치**: 파일 3, 17, 32, 47
- **상세**: 파일 3(라운드 1)의 `onError setModels([])` WARNING이 파일 32(라운드 3)에서 동일한 내용으로 재출현한다. `mutationFn` stale closure 문제도 라운드 1, 2, 3에 각각 등장한다. 파일 45(scope 리뷰)에서 이 중복이 "SUMMARY.md 합산 시 위험도 집계를 왜곡할 수 있다"고 지적했으나, 이후 라운드에서 중복 제거가 이루어지지 않았다. **리뷰 문서 자체의 부작용으로, 미해결 이슈의 중요도가 중복 카운트로 과대평가될 수 있다.**
- **제안**: RESOLUTION.md에서 각 이슈의 "해결/보류/의도된 동작" 상태를 명확히 추적하고, 이후 라운드 리뷰에서는 이미 해결된 이슈를 재계상하지 않도록 할 것.

---

### **[INFO]** 라운드 4 testing 리뷰 — 이미 해결된 WARNING 6건이 미해결로 기록됨 (파일 48 자체 지적)
- **위치**: 파일 48 (`2026-04-24_08-20-33/testing/review.md`) — 첫 두 항목
- **상세**: 파일 48이 스스로 지적했듯, `model-combobox.test.tsx`의 WARNING 4건(`mockRejectedValue`, `isPending`, 빈 배열 메시지, `disabled` prop)과 `llm-configs.test.ts`의 WARNING 2건(fallback 케이스, 에러 전파)이 실제 코드에는 이미 구현되어 있다. 리뷰 문서가 구 버전 코드를 기준으로 작성된 것으로, **존재하지 않는 갭을 보고하는 문서가 SUMMARY에 포함될 경우 개발팀이 불필요한 작업을 수행할 수 있다.**
- **제안**: 해당 항목들을 "이미 해결됨"으로 표시하거나 RESOLUTION.md에서 명확히 구분.

---

## 요약

48개 파일 전체가 마크다운 리뷰 문서이므로 직접적인 런타임 부작용은 없다. 그러나 문서들이 기술하는 코드 변경 중 **4개의 실질적 부작용이 4개 라운드를 거쳐도 미해결 상태로 남아 있다**: ① Google 스트림의 토큰 usage 집계 누락(과금·모니터링 오염), ② `listModels` 실시간 전환으로 인해 기존 항상-성공 코드 경로가 실패 가능해진 점, ③ Google `embed()` 배치 전환의 빈 벡터 silent failure 위험, ④ `model-combobox.tsx`의 `models` state가 props 변경에 무반응인 stale datalist 문제. 리뷰 워크플로 자체의 부작용으로는 동일 이슈가 라운드간 중복 계상되어 SUMMARY 위험도 집계가 왜곡될 수 있고, 라운드 4 testing 리뷰가 이미 해결된 6건을 미해결로 오기록한 문제가 있다.

## 위험도

**MEDIUM** — 문서 자체는 무해하나, 문서가 추적하는 코드 변경 중 Google 스트림 usage fallback 제거와 embed() silent failure가 과금/데이터 품질에 직접 영향을 주는 미해결 부작용으로 남아 있음.