STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD --stat -- codebase/` (23파일)을 SoT 로 삼아 실제 동작이 바뀌는
자리만 추려 직접 열어 확인했다. `review/**` 하위의 과거 라운드 산출물(파일 28~99+)은 이
PR 자체가 이미 6라운드(커밋 `29d00021d`~`6f1d4d41d`)에 걸쳐 review→fix 를 반복한 흔적이라
diff 에 포함돼 있을 뿐, 문서 산출물이므로 부작용 관점 재검토 대상에서 제외했다(문서 파일
side effect 없음).

핵심 동작 변경 파일을 전문 대조:
`codebase/backend/src/modules/executions/executions.service.ts`,
`codebase/backend/src/modules/executions/executions.service.spec.ts`,
`codebase/frontend/src/components/executions/rerun-modal.tsx`,
`codebase/frontend/src/lib/utils/masked-markers.ts`,
`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`,
`codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`.
그 외(`background-runs.service.ts`/`.spec.ts`, 두 DTO, `sanitize-error-message.ts`)는
diff 가 주석/JSDoc 텍스트뿐임을 라인 단위로 확인했다(로직 변경 없음).

`git diff origin/main...HEAD -- codebase/ | grep -E "process\.env|fs\.|writeFile|readFile|fetch\(|axios\.|http\.request"`
결과 0건 — 이번 diff 안에는 환경 변수 읽기/쓰기, 파일시스템 접근, 신규 네트워크 호출이
없다.

## 발견사항

- **[INFO]** `Execution.inputData` 가 응답 페이로드에서 **원문 → 마스킹**으로 반전되는, 이 PR
  전체에서 가장 넓은 반경의 공개 인터페이스 부작용
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1010`
    (`toExecutionDto` — `inputData: redactStoredDataForResponse(execution.inputData)`),
    `:1075`(`toResponseExecution` — `inputData: redactStoredDataForResponse(rest.inputData)`),
    타입 시그니처는 `:116-123`(`ResponseExecution` 의 `Omit` 목록에 `'inputData'` 편입 +
    `inputData: Record<string, unknown> | null;` 필드 추가)
  - 상세: `GET /executions/:id`(`findById`) · `GET /executions`(`findByWorkflow` 목록) ·
    `getChain` · `stop` · background-run 상세, 총 5개 REST 표면과 그 아래 WS emit 경로가
    공유하는 `toResponseExecution`/`toExecutionDto` 관문에서 `Execution.inputData` 를 이제
    자격증명 패턴 마스킹한다(`sanitize-error-message.ts` 의 `redactStoredDataForResponse`).
    이 필드는 그 전까지 egress 마스킹의 **유일한 예외**였고(`MASKED_INPUT_DATA_REASON`,
    이번 diff 에서 전수 삭제됨), 이제 다른 컬럼과 동일 규칙이 된다. 프런트 내부 소비처
    3곳(폼 프리필, Re-run 모달, 에디터 히스토리 로드)은 이번 PR 이 마커 가드로 함께
    닫았지만, **저장소 밖에서 이 REST/WS 응답을 직접 소비하는 자동화(예: 외부에서 이
    엔드포인트를 폴링해 `inputData` 원문을 읽어가는 통합)가 있다면 그 소비자 입장에서는
    말 없이 필드 값이 `'***'`/`'[REDACTED]'` 로 바뀌는 하위호환 깨짐이다.**
  - 참고: 이 갭은 리뷰어가 처음 발견한 것이 아니라, 저장소 자신이 이미 인지·기록했다 —
    `review/code/2026/08/20/14_44_08/RESOLUTION.md` 트래커 항목 5(`"응답 의미 반전의 외부
    소비자 확인 — 저장소 밖 소비자 존재 여부는 diff 범위 밖"`)로 등재돼 이번 PR 을 막을
    사안이 아니라고 명시적으로 처분됐다. 코드 자체에 결함은 없고(내부 소비처는 전수
    가드됐음을 아래에서 별도 확인) 반경만 다시 확인차 기재한다.
  - 제안: 조치 불요(이미 트래커 등재·의도된 설계 결정). 향후 외부 연동 존재가 확인되면
    그 트래커 항목에서 별도 처리.

## 확인했으나 문제 없음 (재검토 근거를 남긴다)

- **exported 심볼 이동**(`MASKED_MARKERS`/`isMaskedMarker` `dynamic-form-ui.tsx` →
  `lib/utils/masked-markers.ts`, `hasMaskedMarkerLeaf` 신설): `grep -rln
  "MASKED_MARKERS\|isMaskedMarker\|hasMaskedMarkerLeaf"` 로 전체 소비처를 나열해 대조한
  결과 7개 파일(`rerun-modal.tsx`/`.test.tsx`, `dynamic-form-ui.tsx`/`.test.tsx`,
  `editor-toolbar.tsx`, `masked-markers.ts`/`.test.ts`) 전부 새 경로에서 import 하도록
  일관되게 이동돼 있다. `dynamic-form-ui.tsx` 를 여전히 import 하는 다른 두 파일
  (`result-detail.tsx`, `assistant-presentations-block.tsx`)은 `DynamicFormUI` 컴포넌트만
  쓰고 이동된 상수는 참조하지 않아 영향 없음을 확인.
- **`ResponseExecution` 타입 시그니처 변경**(`Omit` 목록에 `'inputData'` 추가)의 파급:
  `grep -n "ResponseExecution\b"` 결과 이 타입은 `executions.service.ts` 내부에서만
  선언·소비되고 다른 모듈로 export 되지 않는다 — 모듈 경계를 넘는 시그니처 영향 없음.
- **`stop()` 반환값이 masking 관문을 새로 지나게 된 것**의 내부 소비 영향:
  `interaction.service.ts:226,248`·`hooks.service.ts:407` 세 호출부 모두
  `await this.executionsService.stop(...)` 를 반환값 미할당으로 fire-and-forget 호출한다 —
  masking 된 반환 객체를 내부 비즈니스 로직이 다시 읽어 판단에 쓰는 경로가 없음을 확인했다.
  즉 이번 마스킹 반전은 순수하게 응답 직렬화 경계 안에 갇혀 있고 실행 엔진 내부 상태·제어
  흐름에는 새지 않는다.
- **신규 테스트 스위트의 전역 상태 격리**(`rerun-modal.test.tsx` 신규 `describe` 블록):
  `beforeEach` 에서 `vi.clearAllMocks()` · `cleanup()` · `useLocaleStore.setState(...)` ·
  `useWorkspaceStore.getState().reset()` · 각 mock 의 `.mockReset()` 을 호출해 기존 스위트와
  동일한 격리 패턴을 따른다 — 새 스위트가 이전/이후 테스트에 상태를 흘리는 경로 없음.
- **재귀 함수(`scanForMarker`) 의 깊이 상한**: `depth >= MAX_MARKER_SCAN_DEPTH(10)` 에서
  즉시 반환해 재귀 깊이가 10 을 넘지 않는다 — 사용자 임의 JSON(비신뢰 입력)을 받는
  `editor-toolbar.tsx` 의 `useMemo` 렌더 경로에서 스택 오버플로로 렌더 트리 전체가 깨지는
  부작용은 없음.

## 요약

이번 diff 는 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서 backend 응답 관문
2곳(`toExecutionDto`/`toResponseExecution`, 실질적으로 5개 REST 표면 + WS emit)의 출력
값을 반전시키고, frontend 3개 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)에 마커
감지 가드를 신설했다. 함수 시그니처 변경은 모듈 내부에 갇혀 있고, 이동된 export 심볼은
전 소비처가 동반 갱신됐으며, 환경 변수·파일시스템·신규 네트워크 호출·의도치 않은 전역
상태 변경은 diff 안에 없다. 유일하게 넓은 반경을 가진 항목은 REST/WS 응답의
`Execution.inputData` 값 자체가 원문에서 마스킹으로 바뀌는 공개 API 동작 변경인데, 이는
이 PR 의 목적 그 자체이고 내부 소비처는 전수 가드됐으며, 저장소 밖 소비자 리스크는 이미
직전 라운드에서 트래커에 등재된 채 의도적으로 defer 된 상태다 — 신규로 발견된 결함은
없다.

## 위험도

LOW
