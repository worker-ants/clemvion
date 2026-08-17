# 부작용(Side Effect) 리뷰

대상: EIA §R17 마스킹 왕복-오염 가드(`DynamicFormUI` `defaultValue` 프리필 차단) + 관련 문서/plan/review 산출물 (round 2, `12_33_36`).

이 diff 는 이전 리뷰 라운드(`review/code/2026/08/17/12_06_12`)가 지적한 WARNING(명명 불일치·CSS 클래스 오사용·CHANGELOG stale)이 이미 `RESOLUTION.md` 로 반영된 **최종 상태**를 담고 있다. 실제 런타임 코드가 바뀌는 파일은 `dynamic-form-ui.tsx` 와 `sanitize-error-message.ts` 뿐이고, 나머지(테스트·i18n·spec·plan·review 산출물)는 모두 문서/데이터 성격이라 부작용 표면이 거의 없다. 소스를 직접 열어(`Read`) 현재 상태를 재확인했다.

## 발견사항

- **[INFO]** 신규 공개 함수/상수 `isMaskedMarker` · `MASKED_MARKERS` export — 새 공개 표면, 부작용 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339` (`export const MASKED_MARKERS`), `:371-373` (`export function isMaskedMarker`)
  - 상세: `isMaskedMarker`는 `typeof v === "string" && MASKED_MARKERS.has(v)` 뿐인 순수 함수이고 `MASKED_MARKERS`는 불변 `ReadonlySet` 리터럴이다. 소스를 직접 grep 한 결과(`grep -rn "MASKED_MARKERS\|isMaskedMarker" codebase/frontend/src`) 현재 소비처는 같은 파일 내부(`initialValueFor`, JSX 힌트 조건)뿐이고 다른 모듈에서 import 하는 곳은 없다 — 기존 식별자와의 이름 충돌도 없다. 다만 `export` 로 승격된 이상 다음 사람이 이 심볼을 다른 컴포넌트(Re-run 모달 등, spec §R17 이 "확장" 대상으로 명시)에서 import 하면 이 파일의 내부 구현이 사실상 공유 유틸이 된다 — 지금은 위험 없음.
  - 제안: 조치 불요(정보성).

- **[INFO]** `initialValueFor` 내부 동작 변경 — 함수 시그니처는 그대로, 프리필 판단 로직만 변경
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:375-382` (`initialValueFor`)
  - 상세: `grep -rn "initialValueFor" codebase/frontend/src` 로 확인 — 이 함수는 export 되지 않고 같은 파일의 `useState` initializer(줄 407)에서만 호출된다. 외부 호출자가 없어 시그니처/동작 변경이 이 컴포넌트 밖으로 전파되지 않는다. 동작 변경 자체(마커 정확 일치 시 프리필 스킵)는 이 PR 의 목적이고 신규 테스트 5건 + 뮤테이션 검증(`RESOLUTION.md` 기록)으로 고정돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `onSubmit(values)` 콜백이 필드별로 이전과 다른 값을 전달 — 의도된 변경, 회귀 테스트로 고정
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:421-424` (`handleSubmit`), `initialValueFor` 호출부(`:405-409`)
  - 상세: `DynamicFormUI` 의 `onSubmit` prop 시그니처(`(data: Record<string, unknown>) => void`)는 변경되지 않았지만, 마스킹 마커와 정확히 일치하는 `defaultValue` 필드는 이제 빈 문자열/빈 배열/`false` 로 제출된다. 두 소비처(`result-detail.tsx:1149-1151`, `assistant-presentations-block.tsx:245-247`) 모두 `formConfig` 를 가공 없이 그대로 넘기고 `onSubmit` 콜백 쪽도 이 diff 에서 손대지 않았음을 확인했다(`grep -n "DynamicFormUI\|formConfig"` 양쪽 파일) — 즉 이 값 변경은 오직 사용자가 편집하지 않고 제출한 경우에만 발생하고, 두 호출자 모두 이를 그대로 받아들이는 구조라 하위 호환을 깨지 않는다.
  - 제안: 조치 불요 — 이 PR 의 목적 그 자체.

- **[INFO]** `sanitize-error-message.ts` 변경은 선언 재배치뿐, 런타임 동작·export 값 무변화 (재확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-101` (마커 3개 `export const` 재배치), `:124-127` (JSDoc 에 프런트 미러 상호참조 추가), `:128-136` (`MASKED_MARKERS`/`isMaskedMarker` — 이 파일 안에서는 `export` 없이 내부 전용으로 유지)
  - 상세: 소스를 직접 열어 확인 — `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 세 상수는 값·이름·`export` 여부 전부 그대로이고, `MASKED_MARKERS`(내부 `const`, 미export)가 참조하는 시점보다 앞에 선언되어 TDZ 문제도 없다. 이 파일의 다른 실제 마스킹 로직(`redactSecrets`, `deepRedactCore`, `CREDENTIAL_KEY_PATTERN`)은 diff 범위 밖이라 손대지 않았다. 전역 상태·시그니처·네트워크·환경변수·이벤트 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** backend↔frontend 마커 상수 수동 미러 — drift 위험은 이미 인지·문서화됨 (신규 사항 아님)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-343` (`MASKED_MARKERS`) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:96-100`
  - 상세: 두 집합(`"***"`, `"[REDACTED]"`, `"[REDACTED_DEPTH]"`)이 현재 정확히 일치함을 재확인했다. frontend 가 backend NestJS 모듈을 직접 import 할 수 없는 빌드 구조 제약(같은 파일의 `DEFAULT_FILE_*` 선례와 동일 관용구)에 기인하며, 양쪽 JSDoc 이 "어긋나면 가드가 조용히 뚫린다"를 상호 참조로 명시해 두었다. 자동 동기화 검증(계약 테스트)은 없어 향후 한쪽만 바뀌면 이 가드가 그 신규 마커에 대해서만 조용히 무력화될 수 있으나, 이는 이전 라운드부터 INFO 로 추적 중인 기존 패턴이고 이번 diff 가 새로 만든 리스크는 아니다.
  - 제안: 조치 불요(이미 트래커에 등재됨).

- **[INFO]** 테스트 신규 `describe` 블록은 기존 파일 전역 `beforeEach`(로케일 스토어 초기화)를 재사용할 뿐, 새 전역 상태 조작을 추가하지 않음
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:8-10`(기존 `beforeEach`, 이번 diff 로 손대지 않음), `:597-724`(신규 describe 블록)
  - 상세: 신규 블록의 각 `it`/`it.each` 는 `render` 로 격리된 트리를 마운트하고 `vi.fn()` mock 으로 `onSubmit` 을 격리한다. 파일 상단에서 이미 확립된 `useLocaleStore.setState({ locale: "ko" })` 관용구 외에 새 module-level mutable state 나 mock 을 도입하지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 나머지 변경분(spec `.md` 3건, plan `.md` 2건, i18n 딕셔너리 2건, `review/**` 신규 산출물)은 문서·프로세스 파일이며 런타임 코드 경로·전역 상태·네트워크·환경변수에 영향 없음
  - 위치: `CHANGELOG.md`, `codebase/frontend/src/content/docs/05-run-and-debug/{run-results.mdx,run-results.en.mdx}`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/editor.ts`, `plan/in-progress/{eia-masked-prefill-roundtrip-guard.md,spec-sync-external-interaction-api-gaps.md}`, `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{14-external-interaction-api.md,15-chat-channel.md}`, `review/code/2026/08/17/12_06_12/**`, `review/consistency/2026/08/17/{11_38_00,12_06_15}/**`
  - 상세: i18n 키 추가(`formMaskedDefaultHint`)는 ko/en 양쪽 동시 추가로 순수 additive — 기존 키·`Dict["editor"]` 타입 구조 변경 없음. `review/**` 신규 파일들은 이 저장소 워크플로 관례(`/ai-review`, `/consistency-check` 산출물 커밋)에 따른 정상적인 부수 산출물이다.
  - 제안: 조치 불요.

## 요약

이번 diff 의 실질 런타임 코드 변경은 `dynamic-form-ui.tsx` 한 파일(신규 export `MASKED_MARKERS`/`isMaskedMarker`, `initialValueFor` 내부 로직 변경, JSX 안내문 추가)로 국한되며 전부 순수 함수·로컬 state 범위 안에서 동작한다. 새 함수는 부작용 없는 순수 함수이고, 시그니처가 바뀐 기존 공개 함수(props, exported API)는 없다. `onSubmit` 콜백이 받는 payload 내용이 마커-일치 필드에 한해 달라지는 것이 유일한 관찰 가능한 동작 변화인데, 이는 이 PR 의 명시적 목적이고 두 소비처(그래프 Form 노드 대기 UI, AI `render_form` 인라인) 모두 코드 변경 없이 그대로 반영되며 회귀 테스트로 고정돼 있다. `sanitize-error-message.ts` 는 선언 재배치뿐 로직·export 무변화를 직접 소스로 재확인했다. backend↔frontend 마커 상수의 수동 미러 구조는 drift 위험을 안고 있으나 기존에 문서화·트래킹된 패턴이며 이번 PR 이 새로 만든 표면이 아니다. 문서/spec/plan/review 산출물 변경은 런타임에 영향이 없다. 신규 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도

LOW
