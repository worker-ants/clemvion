### 발견사항

- **[INFO]** 노드 스키마 3종 간 `integrationServiceType` 주석 상세도 불일치
  - 위치: `send-email.schema.ts` vs `database-query.schema.ts`, `http-request.schema.ts`
  - 상세: `send-email.schema.ts`는 3줄 주석으로 "값이 비면 connected 전체가 후보로 노출된다"는 폴백 동작까지 설명하는 반면, `database-query`와 `http-request`는 단순 1줄에 그침. 동일 패턴의 세 파일이 설명 수준이 다르면 이후 유지보수 시 혼란 가능.
  - 제안: 세 파일의 주석 형식을 `send-email`의 3줄 패턴으로 통일.

- **[INFO]** `workflow-assistant-stream.service.spec.ts`의 mock 설명 문구가 구현과 미묘하게 불일치
  - 위치: `makeService()` 내 `candidateLookup` 선언 주석 — "기본값은 'pass-through' (candidates=[])"
  - 상세: 실제 mock은 pending 배열 전체를 그대로 반환(pass-through)하는 것이지, `candidates=[]`를 강제 주입하는 것이 아님. `detectPendingUserConfig`가 이미 `candidates: []`로 초기화하므로 결과는 동일하지만, 주석만 읽으면 "mock이 빈 배열을 주입한다"고 오해할 수 있음.
  - 제안: `// CandidateLookupService 기본 동작: 입력 pending 배열을 변형 없이 그대로 반환 (detectPendingUserConfig 가 이미 candidates:[] 로 초기화한 상태).`

- **[INFO]** `assistant-message.tsx`의 `CandidatePickers` 설명 중복
  - 위치: `CandidatePickers` 컴포넌트 JSDoc(~222행)과 JSX 주석(~`<CandidatePickers>` 바로 아래)이 거의 동일한 내용을 반복 기술
  - 상세: 함수 JSDoc에 상세 설명이 이미 있으므로 JSX 인라인 주석은 "spec ED-AI-39 §3.2 — 버블 내 picker 배치" 정도의 단 한 줄 참조 주석으로 줄이는 것이 간결함.
  - 제안: JSX 측 주석을 한 줄 spec 참조로 축약.

- **[INFO]** `workflow-assistant.module.ts` 모듈 주석에 spec 절 번호 미기재
  - 위치: `IntegrationsModule`, `KnowledgeBaseModule` import 주석
  - 상세: "ED-AI-39 candidate picker"라고만 되어 있고 `§4.3.1` 참조가 없어 다른 파일들의 스타일과 일치하지 않음.
  - 제안: `// ED-AI-39 (§4.3.1) candidate picker: …`로 통일.

- **[INFO]** `candidate-picker.tsx`와 `candidate-picker.test.tsx`의 spec 절 번호 표기 불일치
  - 위치: 컴포넌트 JSDoc — `§3.2 "Candidate picker"` / 테스트 블록 주석 — `§3.2 / §3.3`
  - 상세: 실질적 오류는 아니지만 테스트가 검증하는 spec 절이 컴포넌트 JSDoc과 다르게 표기되어 있어 추후 spec 개정 시 추적이 불편.
  - 제안: 두 파일 모두 `§3.2–§3.3`으로 통일.

---

### 요약

이번 변경셋(ED-AI-39)의 문서화 품질은 전반적으로 높다. 주요 인터페이스(`CandidateEntry`, `PendingUserConfigField`)에 필드 수준 JSDoc이 작성되어 있고, 2단계 설계(detect → async lookup 분리), 불변 반환, legacy 폴백 동작의 설계 의도가 소스 내 주석으로 명확히 기술되어 있다. spec 참조(`ED-AI-39 §N.N`)도 전 파일에 걸쳐 일관되게 사용된다. 지적된 항목은 모두 스타일 통일과 미세한 표현 정확도 수준의 INFO 등급으로, 기능 이해나 유지보수에 직접적인 영향은 없다.

### 위험도

**LOW**