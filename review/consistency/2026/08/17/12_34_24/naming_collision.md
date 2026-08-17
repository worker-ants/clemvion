# 신규 식별자 충돌 검토 — EIA masking round2 (impl-done, scope=spec/5-system/)

## 검토 범위 확인

`git diff origin/main...HEAD -- code_areas` 를 근거로 확인한 결과, 이번 변경분(diff)에는 **spec/ 파일 변경이 없다** — 순수 코드 diff 7개 파일:

- `codebase/backend/src/shared/utils/sanitize-error-message.ts` (주석 위치 이동만, 상수 신설 아님)
- `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (신규 export 2개)
- `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx` (신규 테스트)
- `codebase/frontend/src/lib/i18n/dict/{en,ko}/editor.ts` (신규 i18n 키 1개)
- `codebase/frontend/src/content/docs/05-run-and-debug/run-results.{en,mdx}` (문서 문구 변경, 신규 식별자 없음)

따라서 이번 round 가 실제로 도입하는 "신규 식별자"는 다음 3개로 좁혀진다.

1. `export const MASKED_MARKERS` — `dynamic-form-ui.tsx` (frontend)
2. `export function isMaskedMarker(v: unknown): boolean` — `dynamic-form-ui.tsx` (frontend)
3. `editor.runResults.formMaskedDefaultHint` — i18n 키 (`en/editor.ts`, `ko/editor.ts`)

각 식별자를 워킹트리 전체(`codebase/`, `spec/`)에서 재확인했다.

```
git grep -n "MASKED_MARKERS" -- codebase/
git grep -n "isMaskedMarker" -- codebase/
git grep -n "formMaskedDefaultHint" -- codebase/ spec/
```

## 발견사항

- **[INFO]** `MASKED_MARKERS` / `isMaskedMarker` — backend·frontend 동일 이름 중복 정의 (의도된 미러, 충돌 아님)
  - target 신규 식별자: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339` `export const MASKED_MARKERS`, `:371` `export function isMaskedMarker`
  - 기존 사용처: `codebase/backend/src/shared/utils/sanitize-error-message.ts:128` `const MASKED_MARKERS`(module-private), `:134` `function isMaskedMarker`(module-private)
  - 상세: 동일 이름·동일 의미(마스킹 마커 집합 판별)가 backend/frontend 두 번들에 각각 존재한다. 두 모듈은 서로 import 할 수 없는 별도 빌드 타깃(NestJS 서버 ↔ Next.js CSR 번들)이라 **실제 심볼 충돌(같은 스코프에서 다른 의미로 재정의)은 발생하지 않는다.** 코드 주석(`dynamic-form-ui.tsx:326-337`)이 "SoT 는 backend 상수, 이름을 backend 와 똑같이 둔다 — grep 동기화 목적"이라고 명시적으로 밝히고 있고, 같은 파일의 기존 `DEFAULT_FILE_*` 미러 관용구를 그대로 따른 것이라 우발적 충돌이 아니라 **설계된 중복**이다. backend 쪽은 `export` 가 없어 외부 노출도 없다.
  - 제안: 조치 불필요. 다만 향후 두 상수 집합이 어긋나면(backend 값 변경 시 frontend 미변경) 그 자체가 "마스킹 왕복 오염" 버그가 되므로, 이미 있는 backend 쪽 JSDoc 경고(`sanitize-error-message.ts:118-122` "프런트 미러가 있다")를 유지·grep 가능하게 두는 것으로 충분.

- **[INFO]** `formMaskedDefaultHint` i18n 키 — 명명 컨벤션 정합, 충돌 없음
  - target 신규 식별자: `editor.runResults.formMaskedDefaultHint` (`codebase/frontend/src/lib/i18n/dict/en/editor.ts:306`, `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:302`)
  - 기존 사용처: 없음 — 동일 네임스페이스(`editor.runResults.*`)의 기존 키는 `formFileMimeRejected` / `formFileSizeExceeded` / `formFileTotalExceeded` / `formFileCountExceeded` 등 `form` prefix 컨벤션을 따르고 있으며 신규 키도 동일 prefix 를 유지해 컨벤션과 일치한다.
  - 상세: en/ko 두 dict 파일 모두 동일 위치·동일 키로 추가되어 있어 SoT 쌍 누락(한쪽만 추가되는 흔한 결함)도 없다.
  - 제안: 없음.

요구사항 ID(EIA-*, CCH-* 등)·API endpoint·webhook/SSE 이벤트명·ENV var·spec 파일 경로 — 이번 diff 는 이 카테고리에 해당하는 신규 항목을 하나도 도입하지 않는다(spec 파일 변경 자체가 없음). 번들에 포함된 `spec/5-system/14-external-interaction-api.md` §R17(마스킹 카탈로그)·§6.4 도 이전 라운드(#1177~#1179)에서 이미 등재된 문서이며 이번 diff 로 신규 ID 가 추가되지 않았으므로 해당 카테고리는 검토 대상이 없다.

## 요약

이번 round(EIA masking round2)의 실질 변경분은 spec 문서가 아니라 순수 코드 diff 7개 파일이며, 그 안에서 새로 도입되는 식별자는 frontend `MASKED_MARKERS`/`isMaskedMarker`(backend 동명 상수의 의도된 미러)와 i18n 키 `formMaskedDefaultHint` 세 개뿐이다. 셋 다 전체 저장소(`codebase/`, `spec/`) grep 으로 재확인한 결과 기존에 다른 의미로 쓰이는 동일 이름이 없고, backend/frontend 이름 중복은 module boundary 때문에 실제 충돌 가능성이 없는 데다 코드 주석에 의도가 명시돼 있다. 요구사항 ID·엔드포인트·이벤트명·ENV var·spec 파일 경로 카테고리는 이번 diff 에 신규 항목이 없어 해당 사항 없음. 신규 식별자 충돌 관점에서 이번 변경은 문제 없음으로 판정한다.

## 위험도

NONE
