# 신규 식별자 충돌 검토 — naming_collision

## 검토 대상 요약

이번 라운드(`eia-masking-round2-53afc8`)의 `origin/main...HEAD` diff(`code_areas` 한정)는 **spec 신규 파일·신규 요구사항 ID 없이 코드만** 변경한다:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` — 기존 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` export 위치 재배치 + JSDoc 확장(값 자체는 불변)
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — 신규 export `MASKED_MARKERS`(Set), `isMaskedMarker()`
- `codebase/frontend/src/lib/i18n/dict/{en,ko}/editor.ts` — 신규 키 `formMaskedDefaultHint`
- `.../dynamic-form-ui.test.tsx`, `run-results.mdx`/`run-results.en.mdx` — 테스트·문서만

spec 쪽은 이번 diff 에 포함되지 않았고(§R17 "프리필 왕복" 불릿은 번들에 이미 존재 — 이전 라운드에서 등재된 것으로 보이며 이번 코드가 그 서술을 구현), 새 요구사항 ID·엔티티·endpoint·이벤트·ENV var·spec 파일 경로는 이번 diff 에 하나도 없다. 따라서 아래 점검은 실제로 신규 도입된 4개 식별자(`MASKED_MARKERS`, `isMaskedMarker`, `formMaskedDefaultHint`, 및 재노출된 3개 마커 상수)로 좁혀 수행했다.

## 발견사항

### 신규 식별자 충돌 없음 — `MASKED_MARKERS` / `isMaskedMarker` (frontend)

- target 신규 식별자: `MASKED_MARKERS`(`ReadonlySet<string>`), `isMaskedMarker(v: unknown): boolean` — `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339,371`
- 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:128,134` 에 **동명의 module-private**(비-export) `MASKED_MARKERS`/`isMaskedMarker` 존재
- 상세: 동일 이름·동일 의미지만 이는 우연한 충돌이 아니라 **의도적 미러**다. backend 상수는 `export` 되지 않은 파일-스코프 값이고, frontend(별도 패키지, 별도 빌드 타깃 — Next.js CSR 은 backend NestJS 모듈을 import 불가)가 같은 이름·같은 리터럴 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)으로 복제한다. 양쪽 파일 모두 JSDoc 에 "SoT 는 backend, 이름을 backend 와 똑같이 둔다(grep 동기화 목적)" 를 명시적으로 밝히고 있어 설계 의도가 문서화돼 있다. TypeScript 모듈 스코프상 실제 이름 충돌(컴파일 오류·런타임 shadowing)도 발생하지 않는다 — 서로 다른 패키지의 독립 모듈.
- barrel/re-export 확인: `run-results/` 디렉토리에 index 배럴 파일 없음, `MASKED_MARKERS`/`isMaskedMarker` 를 재-export 하는 곳도 없음 → 두 정의가 같은 import 스코프에서 만날 경로가 없다.
- 타 위치 재사용 확인: `git grep`으로 `channel-web-chat`, `packages/*`, frontend 전역을 확인 — 두 곳(backend 원본 · frontend 미러) 외 추가 정의·재사용 없음. 인접 개념인 `secretsMasked`(integrations 자격증명 폼 prop), `keyMasked`(authentication i18n)는 이름·도메인이 다르고 겹치지 않음.
- 제안: 조치 불필요. 다만 이런 "이름-동일 의도적 미러" 패턴은 향후 신규 checker 가 오탐(false positive)으로 재지적하기 쉬우므로, 이미 양쪽 파일 JSDoc 에 있는 상호 참조 문구("프런트 미러가 있다" / "SoT 는 backend 상수")를 유지하는 정도로 충분.

### 신규 식별자 충돌 없음 — i18n 키 `formMaskedDefaultHint`

- target 신규 식별자: `editor.runResults.formMaskedDefaultHint` — `codebase/frontend/src/lib/i18n/dict/{en,ko}/editor.ts`
- 기존 사용처: 없음. `git grep -n "form[A-Za-z]*Hint"` 결과 이 키가 유일하며, 인접 키(`formFileSizeExceeded`/`formFileTotalExceeded`/`formFileCountExceeded`)와 명명 컨벤션(`form` + 의미 + `Hint`/`Exceeded`)도 일치한다.
- 상세: en/ko 양쪽 dict 에 동일 키로 쌍을 이루어 추가됨. 충돌 없음.
- 제안: 조치 불필요.

### 신규 식별자 충돌 없음 — 재배치된 backend 마커 상수

- target: `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` — diff 상 `-`/`+` 로 표시되지만 **값은 불변**이며 파일 내 선언 위치만 JSDoc 앞으로 이동했다. `codebase/backend/src/modules/websocket/websocket.service.ts` 등 기존 소비처(`KEY_MASK_MARKER`, `DEPTH_MASK_MARKER` import)와 값·이름 모두 그대로 정합.
- 상세: 신규 식별자가 아니므로 충돌 검토 대상 아님(참고로 명시).

### API endpoint / 이벤트 / ENV var / spec 파일 경로

- 이번 diff 에 신규 endpoint, webhook/queue/SSE 이벤트명, 환경변수, config 키, spec 파일 경로 도입 없음 — 해당 관점 점검 결과 스킵(N/A).

## 요약

이번 라운드는 `spec/5-system/` 에 신규 파일·요구사항 ID·엔티티·endpoint·이벤트·ENV var 를 전혀 추가하지 않았고, 코드 레벨에서 도입된 4개 식별자(`MASKED_MARKERS`, `isMaskedMarker`, `formMaskedDefaultHint`, 그리고 값 불변인 재배치 상수 3개) 중 실질적 신규 충돌은 없다. 유일하게 이름이 겹치는 `MASKED_MARKERS`/`isMaskedMarker` 는 backend(module-private) ↔ frontend(export) 간 **의도적이고 문서화된 미러**이며, 서로 다른 패키지·빌드 타깃에 위치해 실제 import 충돌 경로가 없다. i18n 키는 기존 명명 컨벤션과 일치하고 중복이 없다.

## 위험도
NONE
