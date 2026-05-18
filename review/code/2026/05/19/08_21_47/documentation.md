# 문서화(Documentation) 리뷰 결과

## 발견사항

### 1. 독스트링/JSDoc 갱신 — 적절히 처리됨
- **[INFO]** `send-email.schema.ts` 의 `sendEmailNodeOutputSchema` JSDoc 과 `validateSendEmailConfig` JSDoc 이 "sum type / comma-separated string" 문구를 제거하고 "array-only since the 2026-05-19 정준화 (spec §8 Rationale)" 으로 명확하게 갱신되어 있다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` diff, lines 873-924
  - 상세: JSDoc 이 변경된 동작과 정확하게 일치한다. spec 참조 경로(`spec/4-nodes/4-integration/3-send-email.md §8 Rationale`)까지 명시하여 추적성이 우수하다.
  - 제안: 없음.

### 2. `send-email.handler.ts` 함수 레벨 주석 — 적절히 처리됨
- **[INFO]** `normalizeRecipients` 함수 위에 10줄 블록 주석이 신설되어, (a) array-only 전환 이유, (b) `return []` defensive safety net 의 존재 이유, (c) legacy 데이터 경로를 명확히 기술하고 있다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` diff, lines 229-237
  - 상세: 주석이 실제 코드 동작과 정확히 일치한다. legacy safety net 의 동작("produces an empty recipient list → `EMAIL_NO_RECIPIENTS`")까지 설명하고 있어 미래 유지보수자에게 충분한 컨텍스트를 제공한다.
  - 제안: 없음.

### 3. `send-email.handler.ts` 기존 주석 — 부분 불일치
- **[WARNING]** `validate()` 함수 내 인라인 주석(`// Schema SSOT … cc/bcc sum-type guards`)이 "sum-type guards" 라는 구 표현을 여전히 포함하고 있다. 이 변경은 diff 에 포함되지 않았다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.handler.ts` 전체 파일 컨텍스트 line 319–322
  - 상세: `validate()` 주석은 `"integrationId / to / subject / body required + cc/bcc sum-type guards"` 라고 기술하지만, 이번 정준화 이후 cc/bcc 는 sum-type 을 지원하지 않고 array-only 로 강제된다. 구 표현이 잔존하면 이후 독자가 sum-type 이 여전히 지원된다고 오해할 수 있다.
  - 제안: 해당 주석의 `cc/bcc sum-type guards` 를 `cc/bcc array-only guards (2026-05-19 정준화)` 또는 유사 표현으로 수정한다.

### 4. `sendEmailNodeMetadata` warningRules SSOT 주석 — 구 표현 잔존
- **[WARNING]** `sendEmailNodeMetadata` 의 `warningRules` 배열 위 주석(`// Recipient sum-type validation (string | string[]) lives in validateConfig …`)이 여전히 "sum-type validation (string | string[])" 이라는 구 표현을 담고 있다.
  - 위치: `codebase/backend/src/nodes/integration/send-email/send-email.schema.ts` 전체 파일 컨텍스트 lines 1249–1251
  - 상세: 이번 PR 에서 `validateSendEmailConfig` 는 string raw 를 완전히 reject 하도록 변경되었으므로, 해당 주석의 "string | string[]" 표현은 오래된 정보다. 문서 독자가 "sum-type" 이 여전히 validator 에서 허용된다고 잘못 읽을 수 있다.
  - 제안: `// Recipient sum-type validation (string | string[]) lives in validateConfig` → `// Recipient array-only validation lives in validateConfig (array-only as of 2026-05-19, spec §8.1).` 로 갱신한다.

### 5. `plan/in-progress/node-output-redesign/send-email.md` 예제 JSON — 구 형식 잔존
- **[WARNING]** `## 현재 output (spec 인용)` 섹션의 JSON 예시(`§5.1 정상 발송`)에서 `"to": "{{ $input.email }}"` 이 단일 문자열 형태로 남아 있다.
  - 위치: `plan/in-progress/node-output-redesign/send-email.md` 전체 파일 컨텍스트, lines 1490–1494의 인라인 JSON 블록
  - 상세: diff 에서 본문 분석 텍스트(lines 1452, 1461, 1469–1470)는 "array-only" 로 갱신되었지만, 파일 상단의 spec 인용 JSON 코드 블록은 구 단일 string 형식을 그대로 유지하고 있다. 이 예제는 `spec/4-nodes/4-integration/3-send-email.md` 의 내용을 인용한 것으로, spec 자체도 갱신되었다면 이 인용도 함께 반영되어야 한다.
  - 제안: `"to": "{{ $input.email }}"` → `"to": ["{{ $input.email }}"]` 로 갱신하고, `"cc": []`, `"bcc": []` 항목도 spec 최신 형식과 일치하는지 확인한다.

### 6. `backend-labels.ts` i18n 주석 위치 — 알파벳 정렬 고려
- **[INFO]** `WARNING_KO` 에 추가된 3개 항목(`bcc/cc/to` 오류 메시지)이 알파벳 순에서 `"b"` 항목들 사이가 아니라 `"X-axis"` / `"Y-axis"` 사이에 삽입되었다. 일관성 관점에서 다소 의외의 위치다.
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` diff, lines 1295–1300
  - 상세: `WARNING_KO` 객체가 알파벳 순 정렬을 기반으로 구성되어 있는 경우, 새 항목이 `"b..."` 키를 포함하므로 `"branchCount"` 항목 근처에 삽입되는 것이 더 일관성 있다. 단, 파일 전체 정렬 정책이 불명확하면 기능적 문제는 없다.
  - 제안: `WARNING_KO` 의 정렬 정책을 한 번 확인하고, 알파벳 순이라면 `bcc/cc` 항목을 `"branchCount"` 키 근방으로 이동한다. `to` 항목은 `"t"` 블록 근방에 위치한다. 정렬 정책이 없다면 현행 유지.

### 7. CHANGELOG 업데이트 필요성
- **[INFO]** 이번 변경은 breaking change (raw string `to`/`cc`/`bcc` reject)다. 프로젝트에 공식 CHANGELOG 파일이 존재하는지 확인하지 못했지만, spec §8 Rationale 신설 및 plan 에 breaking 명시는 이루어졌으므로 spec 레벨의 변경 이력은 충분하다.
  - 위치: 프로젝트 루트 또는 `spec/` 하위 CHANGELOG
  - 상세: 다른 노드 또는 외부 워크플로 작성자에게 영향을 주는 breaking change 이므로, 공식 CHANGELOG 관리 정책이 있다면 항목 추가가 권장된다. 이미 spec §8.1 과 plan 에 "breaking, 스테이징" 이 명기되어 추적성은 확보되어 있다.
  - 제안: 프로젝트 CHANGELOG 정책 확인 후 항목 추가 여부를 결정한다. 현재 스테이징 단계이므로 즉각적 필요성은 낮다.

### 8. 테스트 파일 내 인라인 주석 — 우수
- **[INFO]** `send-email.handler.spec.ts` 와 `send-email.schema.spec.ts` 의 각 변경된 테스트 케이스에 한국어 인라인 주석으로 변경 이유 및 spec 참조가 명시되어 있어, 테스트 의도 파악이 용이하다.
  - 위치: `send-email.handler.spec.ts` diff lines 45, 61, 98, 106, 126, 133; `send-email.schema.spec.ts` diff lines 489, 502–508
  - 상세: `// array-only 정준화 (spec §8.1)`, `// 종전 sum-type 에서는 통과` 등 충분한 설명이 있다. 신규 기여자가 "왜 string 이 reject 되는가"를 테스트만 읽어도 이해할 수 있다.
  - 제안: 없음. 이 수준의 테스트 문서화를 다른 노드의 테스트 파일에도 적용하면 좋다.

---

## 요약

이번 PR 은 `to/cc/bcc` 필드를 array-only 로 정준화하는 breaking change 를 다루며, 전반적인 문서화 품질은 상당히 높다. JSDoc, 함수 레벨 블록 주석, 테스트 인라인 주석, plan 문서, i18n 매핑까지 다층적으로 변경 이력과 의도를 추적할 수 있도록 갱신되었다. 그러나 두 곳에서 구 표현 잔존이 확인되었다. (1) `send-email.handler.ts` 의 `validate()` 주석의 "sum-type guards" 표현, (2) `sendEmailNodeMetadata.warningRules` 위 주석의 "sum-type validation (string | string[])" 표현이 array-only 전환 이후에도 남아 있어 향후 독자에게 혼동을 줄 수 있다. 추가로, `plan/in-progress/node-output-redesign/send-email.md` 의 spec 인용 JSON 예시가 단일 string 형식으로 잔존하여 갱신된 분석 텍스트와 불일치한다. i18n 신규 항목의 삽입 위치 일관성도 경미하게 확인이 필요하다.

---

## 위험도

LOW
