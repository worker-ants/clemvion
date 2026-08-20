STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — `Execution.inputData` egress 마스킹 카브아웃 폐지 + 프런트 마커 가드 3-소비처

## 검토 방법

실제 side-effect 표면이 있는 코드 파일(1~17번, backend 5 + frontend 8 + 테스트 4)을 중심으로 보고,
문서/plan/consistency-review 산출물(18~59번)은 이 관점 밖(문서 텍스트만 변경)이라 제외했다.
핵심 변경은 (a) `Execution.inputData` REST 응답 마스킹 카브아웃 폐지, (b) `MASKED_INPUT_DATA_REASON`
앵커 삭제, (c) 프런트 마커 유틸(`MASKED_MARKERS`/`isMaskedMarker`)을 컴포넌트 로컬에서
`lib/utils/masked-markers.ts` 로 승격 + `hasMaskedMarkerLeaf` 신규, (d) 이를 소비하는 3곳(폼 프리필,
Re-run 모달, 에디터 히스토리 로드)에 제출 차단 로직 추가. 실측으로 확인한 것:

- `grep -rn "MASKED_INPUT_DATA_REASON" codebase/ spec/` → **0건**. 삭제된 앵커에 대한 댕글링 참조 없음
  (naming_collision 리뷰가 지적했던 "6개 참조처 동시 갱신 누락" 리스크는 실측상 발생하지 않았다 —
  전부 함께 갱신됐다).
- `grep -rn "MASKED_MARKERS|isMaskedMarker|hasMaskedMarkerLeaf" codebase/frontend/src` → 옛 위치
  (`dynamic-form-ui.tsx`)에서 re-export 하던 이전 import(`../dynamic-form-ui`)는 전부
  `@/lib/utils/masked-markers` 로 갱신됐고, 별도 barrel 파일의 재수출도 없음. stale import 없음.
- `grep -rn "ResponseExecution\b" codebase/backend/src` → `ExecutionsService` 내부에서만 쓰이는
  private 타입. `Omit<... | 'inputData' ...>` 로 넓히고 `inputData: Record<string, unknown> | null`
  을 추가한 시그니처 변경은 외부 호출자에 영향 없음(확인).
- backend/frontend 각각 `tsc --noEmit` 실행 — 변경된 파일들(`executions.service.ts`,
  `execution-response.dto.ts`, `background-runs.*`, `dynamic-form-ui.tsx`, `rerun-modal.tsx`,
  `editor-toolbar.tsx`, `masked-markers.ts`)에 대해서는 **에러 0건**. (backend 전체는 이 diff 와
  무관한 기존 스펙 파일 오류가 다수 있으나 grep 으로 대상 파일 교집합이 0임을 확인함 — 이 PR 이
  새로 깬 타입 오류 없음.)
- `grep -rn "execution\.inputData" codebase/backend/src` → REST DTO 조립(`toResponseExecution`,
  `toExecutionDto`) 두 곳 외에 `Execution.inputData` 를 WS emit 페이로드로 내보내는 경로는 없음
  (WS 는 NodeExecution 레벨만 다룬다, 기존 정책 그대로) — 이번 변경이 놓친 emit 표면은 없다.

## 발견사항

- **[INFO]** REST 응답 값 변경(공개 API 응답 바디의 breaking change) — 의도된 것이나 감사 범위 밖 소비자 존재 가능성
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`toResponseExecution`
    — 1009행 `inputData: redactStoredDataForResponse(execution.inputData)`, `toExecutionDto` —
    1074행 근방 동일 패턴)
  - 상세: `GET /api/executions/:id` 및 `GET /executions/workflow/:id` 의 `inputData` 필드가 이제
    자격증명 값-패턴을 `***`/`[REDACTED]` 등으로 치환해 내보낸다(종전엔 원문). 이번 PR 이 감사·보강한
    소비처는 정확히 3곳(`dynamic-form-ui.tsx` 폼 프리필, `rerun-modal.tsx`, `editor-toolbar.tsx`
    히스토리 로드)이고 grep 상 프런트의 다른 소비처는 전부 표시 전용(`page.tsx` 결과 상세,
    `execution-store.ts`, `use-execution-events.ts` — 모두 NodeExecution 레벨이거나 표시 전용)으로
    확인돼 회귀 위험은 낮다. 다만 이 REST 필드를 읽는 **감사 범위 밖의 제3자 소비자**(예: 외부
    API 클라이언트, 사내 스크립트, 아직 코드베이스에 없는 신규 기능)가 있다면 이 PR 로 인해 그
    응답 값이 조용히 마스킹된 문자열로 바뀐다 — API 계약 변경이다. Swagger 설명문(`execution-response.dto.ts`,
    `background-run-response.dto.ts`)은 이 변경을 문서화했으므로 발견 가능성은 확보돼 있다.
  - 제안: 조치 불요(스펙 §R17 이 이 방향을 명시적으로 승인했고 발견된 유일한 3개 실 소비처가 전부
    가드됨을 확인함). 참고용 INFO — 향후 이 REST 응답을 읽는 신규 기능을 추가할 때 마커 가드
    적용 여부를 체크리스트에 넣을 것을 권장.

- **[INFO]** `hasMaskedMarkerLeaf` 재귀 함수에 깊이 상한 없음 — 사용자 입력(textarea JSON) 기반
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts` 의 `hasMaskedMarkerLeaf` 함수
  - 상세: 배열/객체를 무제한 재귀로 순회한다(순환 참조는 `JSON.parse` 산물엔 없으므로 안전하다는
    주석은 맞다). 다만 극단적으로 깊게 중첩된 JSON 을 붙여넣으면 스택 오버플로 가능성이 이론상
    있다 — 그러나 같은 입력에 대해 선행 단계인 `JSON.parse` 자체도 동일한 재귀/스택 제약을 갖고
    브라우저 텍스트에어리어 입력 규모에서 실질 위험은 없다. 기존 `isMaskedMarker` 단일 값 검사보다
    표면이 넓어진 것(이제 중첩 구조 전체를 순회)은 사실이나 클라이언트 로컬 계산이라 서버/공유 상태에
    영향 없음.
  - 제안: 조치 불요. 실사용 입력 규모에서 문제 재현 안 됨.

## 관점별 확인 결과 (모두 이상 없음)

1. **의도치 않은 상태 변경**: 없음. `hasMaskedMarkerLeaf`/`isMaskedMarker`/`splitMaskedParameters`
   모두 순수 함수(입력 불변, 새 객체 반환). `redactStoredDataForResponse` 는 기존 copy-on-change
   구현 그대로(변경 없음).
2. **전역 변수**: 신규 전역 도입 없음. `MASKED_MARKERS`(`ReadonlySet`)는 위치만 이동, 내용 동일.
3. **파일시스템 부작용**: 코드 변경 파일들 자체엔 없음. (18~52번 review/plan 산출물은 이 PR 의
   대상이 아니라 이전 세션들의 정상적인 리뷰 절차 산출물 — 이번 diff 리뷰 대상 코드가 아님.)
4. **시그니처 변경**: `ResponseExecution`(private type) 필드 확장 — 호출자 전수 confirmed 내부
   전용, 영향 없음(위 실측). `redactStoredDataForResponse`/`redactStoredErrorForResponse` 자체
   시그니처는 이번 PR 에서 변경되지 않음(재사용만).
5. **인터페이스 변경**: REST 응답 바디 값 변경 — 위 INFO 항목에 기술. 의도된 것, 감사 완료.
6. **환경 변수**: 읽기/쓰기 없음.
7. **네트워크 호출**: 신규 없음. 기존 `apiGetMock`/`executionsApi` 등 테스트 mock 재사용뿐.
8. **이벤트/콜백**: `rerun-modal.tsx` 의 Re-run 버튼은 `<form>` 요소로 감싸여 있지 않아
   `disabled={submitting || blockedByMaskedInput}` 가 유일한 제출 경로를 게이팅한다(Enter 키
   우회 경로 없음, 확인). `editor-toolbar.tsx` 의 Run 버튼도 `disabled={isRunning || jsonError != null}`
   로 동일 패턴. 두 표면 다 단일 chokepoint 로 확인됨 — WS/이벤트 발행 변경 없음.

## 요약

핵심 변경(백엔드 REST 마스킹 확장 + 프런트 3-소비처 마커 가드)은 spec(EIA §R17)이 명시한 "닫는
조건"을 정확히 구현한 것으로, 실측 결과 댕글링 참조·타입 불일치·이벤트 우회 경로·전역 상태 오염
등 통상적인 부작용 클래스는 발견되지 않았다. 유일하게 언급할 만한 것은 REST 응답 바디 값이
바뀌는 것 자체가 (의도된) 인터페이스 변경이라는 점인데, grep 으로 확인한 감사 범위 밖 소비자는
없었고 Swagger 문서도 갱신돼 있어 위험도는 낮다. `MASKED_INPUT_DATA_REASON` 삭제·`masked-markers.ts`
모듈 승격 둘 다 참조처 전수가 동시에 갱신되어 빌드/런타임 영향이 없음을 `tsc --noEmit` 과
grep 으로 직접 확인했다.

## 위험도

NONE
