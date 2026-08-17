# Requirement Review — 마스킹된 폼 defaultValue 왕복 오염 가드 (`8d853b56a`)

## 발견사항

- **[INFO]** 부분-매치(partial-match) 마스킹 결과는 가드가 감지하지 못한다 — 설계상 의도된 스코프 한계로 보임
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:357` (`isMaskedValue`)
  - 상세: `isMaskedValue` 는 값이 마커 3종(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 **정확히 일치**할 때만 true 를 반환한다(`MASK_MARKERS.has(v)`). 백엔드 `redactSecrets` 는 `SECRET_LEAK_PATTERNS` 매치 부분만 `***` 로 치환하므로, `defaultValue` 가 자격증명 키워드를 포함한 문장형 문자열(예: `"please use api_key: sk-live-XYZ here"`)이면 마스킹 후 `"please use *** here"` 처럼 마커를 **포함하되 마커와 정확히 일치하지 않는** 문자열이 된다. 이 경우 `initialValueFor` 가 이를 마스킹 산물로 인식하지 못해 그대로 프리필하고, 사용자가 편집하지 않으면 오염된 문자열이 그대로 제출된다. 다만 이는 비밀 노출은 아니다(이미 `***` 로 치환된 뒤이므로) — 데이터 무결성 문제로, PR 이 막으려는 "리터럴 마커 그 자체가 실제 값이 되는" 사례보다 발생 빈도가 낮은 잔여 형태다. 테스트(`"마커가 아닌 기본값은 그대로 프리필한다"`)가 `"a***b"` 를 정상 통과시키는 것으로 봐서 "정확 일치만 건다"는 것이 **의도된 설계**임이 명확하다(과탐 방지를 우선). 코드/spec 어디에도 이 잔여를 명시적으로 기록하지는 않았다.
  - 제안: 버그는 아니지만, `token=` 패턴 확장을 다음 PR 로 미룬 것과 같은 방식으로 이 잔여도 plan/spec 각주에 한 줄 남겨두면 다음 라운드에서 재발견 비용을 줄일 수 있다. 필수 조치는 아님.

- **[INFO]** spec §R17 "프리필 왕복" 신설 불릿이 여전히 Rationale 전용 — 이번 PR 이전부터 있던 구조적 갭(WARNING #3, 이미 이번 consistency-check 라운드가 non-blocking 으로 기록)
  - 위치: `spec/5-system/14-external-interaction-api.md` §R17 (line 1558 부근, "프리필 왕복" 불릿)
  - 상세: 새로 추가된 이 계약(폼 프리필 마커 가드)도 §5/§6/§8 본문에 요약 pointer 없이 Rationale 에만 존재한다. `review/consistency/2026/08/17/11_38_00/SUMMARY.md` WARNING #3 이 이미 이 구조적 이슈를 별도로 지적했고 이번 PR 범위 밖으로 명시적으로 defer 됐다(consistency BLOCK: NO). 새로 추가된 불릿도 같은 패턴을 반복해 그 갭을 아주 조금 넓혔을 뿐 새로운 위반은 아니다.
  - 제안: 조치 불요 — 기존 WARNING #3 해소 시 함께 반영.

## 점검 결과 요약 (발견사항 없음 항목)

- **기능 완전성**: `initialValueFor`(마커면 타입별 빈 초기값) + `isMaskedValue` 가드 + 안내 힌트(`formMaskedDefaultHint`, ko/en 둘 다 추가) + 회귀 테스트 4건이 plan 체크리스트·spec §R17 "닫는 조건"/"프리필 왕복" 서술과 1:1 대응한다. `DynamicFormUI` 는 그래프 `Form` 노드 대기 UI(`result-detail.tsx`)와 AI `render_form` 인라인(`assistant-presentations-block.tsx`) 양쪽에서 재사용되며, 두 진입점 모두 `formConfig` 를 가공 없이 그대로 넘기므로 가드가 공통 적용된다(코드로 실측 확인).
- **엣지 케이스**: 마커 3종 전부 개별 테스트, 마커를 부분포함(`a***b`)하는 비-마스킹 값은 보존, `defaultValue === undefined` 시 힌트 미표시, checkbox/file 타입은 `typeof v === "string"` 가드로 자연스럽게 영향 없음 — 모두 확인됨.
- **TODO/FIXME**: diff 전체에 TODO/FIXME/HACK/XXX 없음(`git show HEAD` grep 확인).
- **의도와 구현 간 괴리**: 함수명(`isMaskedValue`)·JSDoc·실제 동작 일치. `initialValueFor` 주석("마스킹된 기본값은 프리필하지 않는다")과 구현 일치.
- **에러 시나리오**: 해당 없음(순수 UI 프리필 로직, 예외 발생 경로 없음).
- **데이터 유효성**: `typeof v === "string"` 가드로 non-string(object/array/boolean/undefined) `defaultValue` 에 안전.
- **비즈니스 로직**: spec §R17 "판단 기준"(외부로도 나가면 마커 가드, 안 나가면 carve-out)과 `Execution.inputData` carve-out 대비 `formConfig` 마커 가드 선택이 문서화된 근거(SSE·notification webhook 외부 노출)와 정확히 일치.
- **반환값**: `initialValueFor` 모든 타입 분기(checkbox/file/default)에서 값 반환, 누락 경로 없음.
- **spec fidelity**: `spec/5-system/14-external-interaction-api.md` §R17 잔여②의 "닫는 조건"/신설 "프리필 왕복" 불릿이 마커 SoT(backend `sanitize-error-message.ts`)·판단 기준·구현(`DynamicFormUI`)을 정확히 서술하며 코드와 line-level 로 일치. `sanitize-error-message.ts` 변경은 JSDoc 재배치(고아 주석→`MASKED_MARKERS` 직전)뿐으로 런타임 동작 무변화(선언 순서 보존 확인). `spec/4-nodes/1-logic/12-background.md` §8.2 는 이 PR 범위(`outputData`/`inputData` 마스킹 서술)가 아니라 별개 PR(#1180)의 소급 문서화이며 정확함. `15-chat-channel.md` §R-CC-15 의 `nodeName`→`nodeLabel` 정정도 코드(§1176/§1180 전사 정정)와 부합. 마커 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`) backend↔frontend 정확히 일치(문자열 단위 대조 완료).
- **plan/consistency 아티팩트 정합성**: `plan/in-progress/eia-masked-prefill-roundtrip-guard.md` 체크리스트의 [x] 항목 전부가 실제 diff 와 대응(테스트 4건, 힌트 i18n 2건, JSDoc 재배치, spec 갱신, 트래커 갱신). `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 세 항목 상태 전환([ ]→[x])도 diff 내용과 부합. `review/consistency/2026/08/17/11_38_00/SUMMARY.md` — BLOCK: NO, Critical 0, WARNING 5건(모두 non-blocking, 이 PR 범위 밖으로 defer)이라는 서술이 그 산출 파일들의 실제 내용과 일치.

## 요약

이번 diff 는 `#1180` 이 넓힌 egress 값-마스킹이 `execution.waiting_for_input` 의 `formConfig.defaultValue` 로 되돌아와 실제 폼 제출값으로 오염되는 결함을 정확히 겨눈다. 프런트 마커 감지 유틸(`isMaskedValue`)이 backend `sanitize-error-message.ts` 의 세 마커 상수를 정확히 미러하고, `initialValueFor` 프리필 차단 + 안내 힌트(ko/en) + 회귀 테스트 4건(마커 3종·비-마커 보존·안내 노출·제출 payload 무마커)이 spec §R17 신설 "프리필 왕복" 불릿·plan 체크리스트와 line-level 로 일치한다. `DynamicFormUI` 재사용 지점(그래프 Form 노드 + AI `render_form` 인라인) 양쪽에 코드 변경 없이 자동 적용되는 것도 실측으로 확인했다. 유일한 잔여는 "마커를 부분 포함하되 정확히 일치하지 않는" 마스킹 결과가 가드를 통과하는 좁은 엣지 케이스인데, 이는 저장소가 이미 명시한 "정확 일치만 건다"(과탐 방지) 설계 의도와 부합하고 비밀 노출이 아닌 데이터 무결성 잔여이므로 INFO 로만 남긴다. Critical/Warning 급 결함 없음.

## 위험도
NONE
