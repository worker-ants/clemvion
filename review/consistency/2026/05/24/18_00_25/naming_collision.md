# 신규 식별자 충돌 검토 — ai-agent-formdata-size-limit

검토 대상: `plan/in-progress/ai-agent-formdata-size-limit.md`
검토 모드: plan draft (--plan)
검토 일시: 2026-05-24

---

## 발견사항

### 1. [WARNING] `truncation` 필드명 — 기존 `PresentationPayload.truncation` 과 의미 충돌 가능성

- **target 신규 식별자**: tool_result content 에 추가될 최상위 `truncation` 필드 (`{originalBytes, cappedBytes, truncatedFields: string[]}`)
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` 37-55 행 — `PresentationPayloadTruncation` 인터페이스 (`itemsTruncated?`, `rowsTruncated?`, `itemsTotalCount?`, `rowsTotalCount?`) + `PresentationPayload.truncation?: PresentationPayloadTruncation`
  - `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 302 행 — `truncation?: PresentationPayload['truncation']`
  - `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 — `PresentationPayload.truncation?: { itemsTruncated?, rowsTruncated?, itemsTotalCount?, rowsTotalCount? }` 의 단일 진실 정의
- **상세**: 기존 `truncation` 키는 Carousel/Table 의 tail-truncate 메타 (element 단위 배열 잘림) 를 뜻한다. target 이 도입하는 `truncation` 키는 form 데이터 string 필드의 byte 잘림 메타이며, shape 가 완전히 다르다 (`originalBytes / cappedBytes / truncatedFields[]` vs `itemsTruncated / rowsTruncated / *TotalCount`). LLM 이 두 `truncation` 키를 같은 의미로 오독하거나, 프론트엔드 / 다운스트림 코드가 타입 가드 없이 이 키를 처리할 경우 혼선이 생긴다. 또한 spec §7.10 의 `PresentationPayload.truncation` 정의와 키 이름이 같아 spec 독자가 서로 다른 context 에서 동일 키를 마주치면 단일 진실 위치가 모호해진다.
- **제안**: tool_result content 의 truncation 메타 키를 `formDataTruncation` 또는 `dataTruncation` 으로 변경해 `PresentationPayload.truncation` 과 명확히 구분한다. 예: `{originalBytes, cappedBytes, truncatedFields: string[]}` 를 `formDataTruncation: {...}` 키로 운반.

---

### 2. [WARNING] `cappedBytes` — 기존 로컬 변수명과 충돌

- **target 신규 식별자**: `capFormDataBytes` 헬퍼가 반환할 객체의 `cappedBytes` 필드
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts` 647, 702, 756 행 — `const cappedBytes = approxByteSize(capped.payload)` 로 이미 `cappedBytes` 가 로컬 변수명으로 사용 중
- **상세**: `cappedBytes` 는 이미 `render-tool-provider.ts` 내부에서 "1MB cap 이후 페이로드 byte 수" 의미로 사용된다. target 이 `capFormDataBytes` 헬퍼의 반환 타입 프로퍼티에 동일 이름을 사용하면, 두 파일을 함께 보는 개발자가 "어느 쪽 cappedBytes 인가" 를 컨텍스트로 구분해야 한다. 타입 선언에 같은 이름이 두 군데 등장하면 IDE 자동완성과 코드 추적에서 혼선이 생길 수 있다.
- **제안**: 헬퍼 반환 타입 프로퍼티를 `bytesAfterCap` 또는 `resultBytes` 로 명명해 `render-tool-provider.ts` 의 로컬 변수와 구분한다.

---

### 3. [INFO] `FORM_SUBMITTED_MAX_BYTES` — 기존 `PRESENTATION_MAX_BYTES` 패턴과 일관

- **target 신규 식별자**: `export const FORM_SUBMITTED_MAX_BYTES = 10 * 1024` (ai-agent.handler.ts)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/truncate-output.util.ts` 13 행 — `export const PRESENTATION_MAX_BYTES = 1024 * 1024`
- **상세**: 명명 패턴 (`<CONTEXT>_MAX_BYTES`) 이 기존과 일치해 직접 충돌은 없다. 다만 `PRESENTATION_MAX_BYTES` 는 `truncate-output.util.ts` 에 정의되어 있고 여러 파일에서 import 해 쓴다. `FORM_SUBMITTED_MAX_BYTES` 를 `ai-agent.handler.ts` 에 정의하면 cap 상수의 위치가 두 파일로 분산된다. 장기적으로 `truncate-output.util.ts` 에 모아두는 패턴을 고려할 수 있다.
- **제안**: 즉시 변경 필요 없음. 다만 향후 cap 정책을 한 곳에서 관리하려면 `truncate-output.util.ts` 로 이전하는 것을 고려.

---

### 4. [INFO] `capFormDataBytes` 함수명 — 기존 `truncate*` / `cap*` 패턴과 혼용

- **target 신규 식별자**: `capFormDataBytes(formData, capBytes)` 헬퍼 함수 (ai-agent.handler.ts)
- **기존 사용처**: `/Volumes/project/private/clemvion/codebase/backend/src/nodes/core/truncate-output.util.ts` — `truncateBodyForOutput`, `truncateArrayForOutput` (동사 `truncate*` 패턴). `render-tool-provider.ts` 내부 `applyOneMbCap` (`cap` 동사 포함).
- **상세**: 기존 유틸리티는 `truncate*` prefix 와 `apply*Cap` 혼용. target 은 `cap*` 을 새 prefix 로 제안한다. 의미 충돌은 아니나 프로젝트 명명 컨벤션이 세 가지로 분산된다.
- **제안**: `truncateFormDataForLlm` 또는 `truncateFormData` 와 같이 기존 `truncate*ForOutput` 패턴을 따르는 이름으로 통일하는 것을 고려. 차단 필요는 없다.

---

### 5. [INFO] Spec 섹션 번호 — §12.7 신설 시 기존 §12.6 과의 순서 명확화 필요

- **target 신규 식별자**: `spec/4-nodes/3-ai/1-ai-agent.md` 에 추가될 §12.6 단락 또는 §12.7 신설
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md` 1181 행 — `### 12.6 render_form submit 후 LLM 의 동일 form 재호출 회귀 차단 (2026-05-24)` 가 이미 존재
- **상세**: 현재 §12.6 은 "form 재호출 회귀 차단" 으로 확정 기재되어 있다. plan 이 "§12.6 본문에 한 단락 추가 또는 §12.7 신설" 을 제안하는데, §12.6 에 직접 추가하면 기존 12.6 의 제목과 내용이 확장되어 "formData 크기 cap" 이라는 별도 결정이 같은 섹션에 혼재된다. §12.7 신설 시에는 충돌이 없다.
- **제안**: §12.7 신설로 진행할 것을 권장한다. §12.6 에 한 단락만 추가할 경우, 단락에 명시적인 소제목(`#### formData 크기 cap (2026-05-24)`)을 달아 두 결정이 섞이지 않도록 한다.

---

## 요약

target plan 이 도입하는 신규 식별자는 기존 식별자와 직접적으로 동일 의미로 재정의되는 CRITICAL 충돌은 없다. 그러나 tool_result content 의 `truncation` 필드명이 `PresentationPayload.truncation` (Carousel/Table 배열 잘림 메타) 과 키 이름을 공유하면서 shape 가 다른 WARNING 수준의 혼동 위험이 있다. `cappedBytes` 는 `render-tool-provider.ts` 내 로컬 변수와 동일 이름으로 사용되어 코드 추적 시 혼선을 줄 수 있다. 두 WARNING 은 구현 전 키 이름을 `formDataTruncation` / `resultBytes` 등으로 변경함으로써 간단히 해소 가능하다. spec 섹션 번호는 §12.6 이 이미 사용 중이므로 §12.7 신설이 안전하다.

---

## 위험도

MEDIUM
