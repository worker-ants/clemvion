# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 새 공개 함수 `isMaskedValue` export — 신규 공개 표면
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:357` (`export function isMaskedValue`)
  - 상세: 순수 함수(`typeof v === "string" && MASK_MARKERS.has(v)`)이고 부작용 없음. 다만 이 컴포넌트 파일에서 함수를 새로 `export` 함으로써 공개 API 표면이 늘었다. 현재 소비처는 같은 파일 내부(`initialValueFor`, JSX)와 테스트뿐이며(`grep` 확인), 다른 모듈에서 import 하는 곳은 없다. spec(`14-external-interaction-api.md` §R17)이 "Re-run 모달·에디터 히스토리 로드에 같은 가드를 확장"할 계획을 명시하므로 향후 다른 파일이 이 함수를 import 할 가능성이 높다 — 지금은 위험 없음.
  - 제안: 조치 불요(정보성). 향후 다른 컴포넌트가 이 함수를 재사용하게 되면 공유 유틸(예: `lib/`)로 승격 검토.

- **[LOW]** `initialValueFor` 동작 변경 — 마커와 **정확히 일치하는 정상 기본값**도 오탐으로 프리필이 사라짐
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:361-370` (`initialValueFor`)
  - 상세: 시그니처(`(field: FormField) => unknown`)는 그대로지만 내부 동작이 바뀌었다 — `field.defaultValue` 가 `"***"` / `"[REDACTED]"` / `"[REDACTED_DEPTH]"` 와 **문자열 완전 일치**하면 무조건 마스킹 산물로 간주해 프리필을 건너뛴다. 워크플로 작성자가 (드물지만) 폼 기본값으로 의도적으로 그 리터럴 문자열을 쓴 경우 — 마스킹과 무관하게 — 이번 변경으로 조용히 빈 값으로 바뀌고 안내 힌트가 노출된다. 이는 코드 주석(line 332-333)이 스스로 인지하고 감수한 트레이드오프(“마커 집합을 넓히기보다 backend 와 정확히 같은 집합으로 좁게 유지”)이고 테스트(`it("마커가 아닌 기본값은 그대로 프리필한다…")`)가 부분 일치(`a***b`)는 통과시킴을 확인해 과잉 오탐 범위는 좁다. 다만 정확 일치 오탐 자체는 여전히 남아 있는 부작용이다.
  - 제안: 현행 유지 가능(허용 범위로 판단됨). 필요 시 spec/Rationale에 "정확히 마커와 같은 리터럴 기본값은 지원하지 않는다"는 한 줄만 명문화하면 향후 혼동을 줄일 수 있다.

- **[INFO]** `onSubmit` 콜백에 전달되는 payload 값이 필드별로 달라짐 (의도된 변경, 테스트로 고정됨)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:416-419` (`handleSubmit` → `onSubmit(values)`), `initialValueFor` 가 값을 채우는 지점(line 390-396)
  - 상세: 이전엔 `defaultValue` 가 있으면 그 값이 그대로 `values` 초기 상태에 들어가 사용자가 손대지 않으면 원본 문자열(마스킹된 `"***"` 포함)이 그대로 `onSubmit` 콜백으로 전달됐다. 이제는 마스킹 마커인 필드는 빈 문자열(또는 타입별 빈 값)이 전달된다 — `onSubmit` 함수 시그니처는 그대로이나 실질적으로 콜백이 받는 데이터 내용이 바뀐다. 새 테스트(`제출 payload 에 마커가 실리지 않는다`)가 이 변경을 명시적으로 고정하므로 의도된 변경이며 회귀 방지도 되어 있다.
  - 제안: 조치 불요 — 의도된 수정이자 이번 PR 의 목적 그 자체.

- **[INFO]** backend SoT ↔ frontend 미러 간 drift 위험 (기존에 문서화된 패턴의 확장)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:335-339` (`MASK_MARKERS`) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts:96-100` (`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`)
  - 상세: frontend 는 backend 상수를 직접 import 할 수 없어 문자열 리터럴로 복제한다(같은 파일의 기존 `DEFAULT_FILE_*` 관용구와 동일). 두 값 집합은 현재 정확히 일치함을 확인했다(`***`, `[REDACTED]`, `[REDACTED_DEPTH]`). 그러나 이 구조 자체가 "한쪽만 바뀌면 다른 쪽은 조용히 낡는다"는 부작용 표면을 만든다 — 이는 코드 주석과 plan(`plan/in-progress/eia-masked-prefill-roundtrip-guard.md`)이 이미 명시적으로 인지하고 "양쪽 미러를 함께 갱신" 의무로 남겨 둔 사항이라 이번 PR 자체의 결함은 아니다. side-effect 관점에서 재확인: 향후 backend 가 새 마스킹 마커를 추가하고 frontend 이 갱신을 놓치면, 이 가드(프리필 차단)가 그 새 마커에 대해서만 조용히 무력화되어 "왕복 오염"이 재발한다.
  - 제안: 조치 불요(이미 인지·문서화됨). 정적 검사(예: 두 파일의 마커 집합을 비교하는 단위 테스트/lint 룰)를 추가하면 재발을 원천 차단할 수 있음 — 우선순위는 낮음.

- **[INFO]** `sanitize-error-message.ts` 변경은 순수 코드 이동(문서 위치 정정)이며 로직/동작 변경 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:93-101`
  - 상세: `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 세 `const` export 선언이 `MAX_REDACT_DEPTH` 바로 다음(JSDoc 이 `MASKED_MARKERS` 에 정확히 귀속되도록)으로 이동했을 뿐, 값·이름·export 여부는 동일하다. `MASKED_MARKERS`(line 128-132)가 참조하는 시점보다 앞서 선언되므로 TDZ/hoisting 문제 없음. 시그니처·인터페이스 변경 없음, 전역 상태 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** i18n 딕셔너리 신규 키 추가는 순수 추가(additive) — 기존 키 영향 없음
  - 위치: `codebase/frontend/src/lib/i18n/dict/ko/editor.ts:302-303`, `codebase/frontend/src/lib/i18n/dict/en/editor.ts:306-307` (`formMaskedDefaultHint`)
  - 상세: `runResults` 섹션에 새 키 하나씩 ko/en 양쪽에 동시 추가. 기존 키·타입(`Dict["editor"]`) 구조 변경 없음. 두 로케일 동시 추가라 언어별 fallback 결여 위험도 없음.
  - 제안: 조치 불요.

- **[INFO]** 테스트 파일의 전역 상태 조작은 기존 관용구를 재사용 — 새 부작용 아님
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:8-10` (`beforeEach(() => useLocaleStore.setState({ locale: "ko" }))`)
  - 상세: 이 라인은 이번 diff 이전부터 있던 상단 `beforeEach` 이고, 신규 `describe` 블록(마스킹 defaultValue 왕복 차단)은 이 기존 fixture 를 그대로 물려받을 뿐 별도의 전역 상태 조작을 추가하지 않는다. 각 `it.each`/`it` 는 `render` 로 격리된 컴포넌트 트리를 마운트하고 `vi.fn()` mock 으로 `onSubmit` 을 격리하므로 테스트 간 오염 경로 없음.
  - 제안: 조치 불요.

- **[INFO]** 나머지 변경분(스펙 `.md` 3건, plan `.md` 2건, `review/consistency/**` 신규 9건)은 문서·프로세스 산출물이며 런타임 코드 경로에 영향 없음
  - 위치: `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/15-chat-channel.md`, `plan/in-progress/eia-masked-prefill-roundtrip-guard.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/consistency/2026/08/17/11_38_00/*`
  - 상세: 전부 마크다운/JSON 문서 편집 또는 신규 파일 생성이며, 애플리케이션 코드의 전역 상태·시그니처·네트워크·환경변수·이벤트에 영향을 주지 않는다. `review/consistency/**` 산출물은 프로젝트 컨벤션(`CLAUDE.md` "일관성 검토 산출물" 저장 위치)에 따라 정상적으로 커밋되는 프로세스 파일이다.
  - 제안: 조치 불요.

## 요약

이번 변경의 핵심은 `dynamic-form-ui.tsx` 에서 egress 마스킹 마커를 감지해 폼 `defaultValue` 프리필을 건너뛰는 가드를 추가한 것과, `sanitize-error-message.ts` 의 JSDoc 위치 정정이다. 신규 공개 함수(`isMaskedValue`)는 순수 함수로 전역 상태·파일시스템·네트워크·환경변수에 영향을 주지 않으며, 기존 함수 시그니처(`initialValueFor`, `DynamicFormUI` props)도 변경되지 않았다. 유일하게 주목할 부작용은 (1) `onSubmit` 콜백이 마스킹 마커 필드에 대해 이전과 다른 값(빈 문자열)을 전달하게 된 것 — 이는 이 PR 의 의도된 목적이며 회귀 테스트로 고정돼 있다 — 과 (2) 마커 문자열과 우연히 정확히 일치하는 정상 기본값이 오탐으로 블랭크 처리되는 낮은 확률의 엣지 케이스다. backend↔frontend 마커 집합 미러링에 따른 향후 drift 위험은 이미 코드 주석과 plan 문서에 명시적으로 인지·기록되어 있다. 그 외 파일(spec/plan/review 문서, i18n 키 추가)은 순수 추가/문서 변경으로 부작용 표면이 없다.

## 위험도

LOW
