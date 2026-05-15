### 발견사항

- **[WARNING]** `output._llmCalls` → `meta.llmCalls` 필드 이동 (명칭 변경 포함)
  - 위치: `text-classifier.handler.ts` diff, 에러 return 블록
  - 상세: 에러 케이스에서 `output._llmCalls` 배열이 제거되고 `meta.llmCalls`로 이동했다. 언더스코어 prefix(`_llmCalls`)는 내부 필드임을 암시하지만, 엔진 코드나 다운스트림 노드 런타임이 `result.output._llmCalls`를 참조하고 있다면 `undefined`로 조용히 깨진다.
  - 제안: 엔진(`execution-engine.service.ts`)과 노드 출력 소비 경로에서 `_llmCalls` 참조 유무를 grep 확인 후 제거 또는 호환 별칭 처리

- **[WARNING]** 에러 케이스 `meta.durationMs`를 핸들러가 직접 설정, 성공 케이스는 엔진이 inject
  - 위치: `text-classifier.handler.ts` 에러 return / 스펙 §5.1 vs §5.3 출처 컬럼 비교
  - 상세: 성공/fallback 경로의 `meta.durationMs`는 `engine inject`이고 핸들러 return에는 없다. 에러 경로는 핸들러가 직접 `errorDurationMs`를 설정한다. 엔진이 모든 출력에 대해 `meta.durationMs`를 무조건 덮어쓴다면 핸들러 설정값이 유실되고, 반대로 에러 경로에만 값이 없어 `undefined`가 되는 버그도 막는다 — 어느 쪽 동작인지 엔진 코드를 확인해야 한다.
  - 제안: 엔진의 `meta` 병합 정책(overwrite vs merge-if-missing) 문서화 또는 확인; 에러 경로에서 핸들러 설정 후 엔진이 덮어쓰더라도 의미상 동일하므로 기능 영향은 없지만, `model`/`llmCalls`까지 덮어쓴다면 문제가 됨

- **[INFO]** `meta.llmCalls[0].durationMs`와 `meta.durationMs`가 동일한 `errorDurationMs` 값 공유
  - 위치: 에러 return, `errorDurationMs` 선언 및 두 곳 사용
  - 상세: 단일 LLM 호출 후 throw되는 에러이므로 두 값이 같은 것은 의미상 맞다. 의도하지 않은 side effect 없음.

- **[INFO]** `output.originalInput`은 이번 diff 이전부터 존재하던 필드
  - 위치: 에러 return `output.originalInput: inputField`
  - 상세: diff 맥락상 기존 코드에도 있던 필드이며, 새로 도입된 것이 아님. spec §5.3 JSON 예시에 추가된 것은 문서 누락 정정. 실제 핸들러 동작 변경 없음.

- **[INFO]** `requestPayload` (시스템 프롬프트 + 사용자 입력 전문 포함)가 `meta.llmCalls[0].requestPayload`로 노출
  - 위치: 에러 return `llmCalls[0].requestPayload`
  - 상세: 성공 경로에서도 동일하게 포함되어 있으므로 에러 경로만의 신규 노출이 아님. 다만 에러 시에도 PII가 담긴 프롬프트가 meta에 실리므로, 로그 수집 파이프라인이 `meta.*`를 그대로 저장한다면 PII 노출 범위가 확장됨.

---

### 요약

이번 변경의 핵심 side effect는 에러 케이스 출력 구조 변경이다. `output._llmCalls` (언더스코어 prefix, 내부 필드 의도)가 `meta.llmCalls`로 이동·정식화되었으며, 기존에 빈 객체였던 `meta: {}`가 `durationMs / model / llmCalls`를 포함하는 구조체로 변경되었다. 성공 경로의 `meta` 형태와 대칭을 맞추는 올바른 방향이지만, 엔진이 `meta`를 병합하는 방식과 혹시 남아있을 `output._llmCalls` 참조 코드가 검증 필요한 잠재적 부작용이다. 테스트 파일과 spec 문서 변경은 구현 변경과 일관성 있게 정렬되어 있으며 독립적인 side effect는 없다.

### 위험도

**LOW** — `_llmCalls`는 내부 필드(언더스코어 prefix)로 외부 계약에 포함되지 않았을 가능성이 높고, 신규 `meta` 형태는 기존 성공 경로와 대칭적이며, 테스트로 검증됨. 엔진 병합 정책 미확인이 유일한 잔여 위험.