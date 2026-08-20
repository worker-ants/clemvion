STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트에 제공된 diff(파일 1~24, 25~27 plan)와 `git diff origin/main...HEAD` 로 직접 대조한
핵심 소스 5개(`executions.service.ts`, `executions.service.spec.ts`, `rerun-modal.tsx`,
`masked-markers.ts` 신규 파일, `editor-toolbar-run-input.test.tsx`)를 전문 확인했다.
`review/**`·`plan/**` 는 이번 작업의 산출물(메타 문서)이라 부작용 관점에서는 대상 외로 보고,
실제 런타임 코드(backend/frontend)만 8개 관점으로 점검했다.

## 발견사항

- **[INFO]** `Execution.inputData` 응답 시맨틱 반전은 이번 diff 범위 밖의 외부 API 소비자에게
  영향을 줄 수 있는 인터페이스 변경이다 (이미 트래커 등재됨, 재확인 목적으로만 기재)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(구 `+// 표가 정본이다. **inputData 도 마스킹한다**` 주석 부근, `redactStoredDataForResponse(execution.inputData)` 호출부)와 `toExecutionDto`(`inputData: redactStoredDataForResponse(rest.inputData)` 호출부)
  - 상세: `GET /executions/:id`·`GET /executions`(목록)·`GET /executions/:id/chain`·`POST /executions/:id/stop` 네 표면이 반환하는 `inputData` 필드가 이번 PR 로 raw 값 → 마스킹된 값으로 바뀐다. `ResponseExecution`/`ExecutionDto` 타입은 이 changeset 안(`executions.service.ts`, `background-runs.service.ts`, `execution-response.dto.ts`)에서만 소비되는 것을 grep 으로 확인했으므로 **저장소 내부 호출자**는 영향이 없다. 다만 이 REST 엔드포인트를 직접 호출하는 저장소 밖 소비자(워크스페이스 외부 자동화 스크립트, 문서화되지 않은 통합 등)가 raw `inputData` 를 기대하고 있었다면 그 값이 조용히 `'***'`/`[REDACTED]` 로 바뀌는 콘텐츠 계약 변경이다. 이 항목은 이미 `review/code/2026/08/20/14_08_45/RESOLUTION.md` 트래커 #5("응답 의미 반전의 외부 소비자 확인")로 등재되어 diff 범위 밖으로 명시적으로 defer 된 상태이며, spec §R17 이 이 반전을 요구조건으로 명시하고 있어 새로 발견된 결함이 아니라 side-effect 체크리스트 항목 5(인터페이스 변경)의 재확인 차원 기록이다.
  - 제안: 조치 불요(이미 트래커 등재·defer 확정). 후속 트래커 항목 처리 시 실제 외부 소비자 존재 여부를 확인하면 된다.

## 부작용 관점에서 확인해 클린한 항목들

- **의도치 않은 상태 변경 / 전역 변수**: `codebase/frontend/src/lib/utils/masked-markers.ts` 는 `MASKED_MARKERS`(`ReadonlySet`)·`MAX_MARKER_SCAN_DEPTH`(상수) 두 모듈 스코프 값만 도입하며 둘 다 불변이다. `rerun-modal.tsx` 의 신규 `touchedMaskedKeys` 는 컴포넌트 로컬 `useState`(불변 `Set` 재생성 패턴)로 스코프가 닫혀 있고, 모달이 열릴 때 `useEffect` 로 정확히 리셋된다.
- **파일시스템 부작용**: 이번 diff 는 소스·테스트·문서·plan 파일 수정뿐이며 런타임 파일 I/O 를 새로 도입한 곳이 없다.
- **시그니처 변경**: `coerceInput`/`displayValue` 는 내부 로직만 `isStructuredType` 헬퍼로 리팩터됐고 시그니처는 그대로다. 삭제된 `dynamic-form-ui.tsx` 의 `export const MASKED_MARKERS`/`export function isMaskedMarker` 는 `grep -rln` 으로 저장소 전체를 확인한 결과 유일한 소비자(테스트 파일)가 이미 새 경로(`@/lib/utils/masked-markers`)로 함께 갱신됐고, `DynamicFormUI` 컴포넌트 자체를 import 하는 `assistant-presentations-block.tsx` 는 그 두 심볼을 쓰지 않아 영향이 없다.
- **인터페이스 변경 — `ResponseExecution` 타입**: `'error' | 'outputData' | ...'` Omit 목록에서 `'inputData'` 를 추가로 제외하고 명시 필드로 편입했다. 이 타입은 backend 내부에서만 소비되며(위 발견사항 참조) 외부로 export 되어 다른 모듈이 구조적으로 의존하는 자리가 없다.
- **환경 변수**: 변경된 파일 전체에서 `process.env` 읽기/쓰기 신규 도입 없음.
- **네트워크 호출**: 신규 외부 서비스 호출 없음. `rerun-modal.tsx`/`editor-toolbar.tsx` 는 기존 제출 흐름(`executionsApi`)을 그대로 쓰고, 새 가드는 그 앞단에서 로컬 판정으로 제출 자체를 막을 뿐이다.
- **이벤트/콜백 변경**: `redactStoredDataForResponse` (기존 shared util, 이번 diff 로 수정되지 않음)는 `deepRedactSecrets` 의 copy-on-change 의미론(변경 없으면 같은 참조 반환, 즉 입력 비-변이)을 그대로 유지한 채 호출 대상만 `inputData` 로 넓어졌다 — 캐시된 row 객체를 in-place 로 변이해 `SNAPSHOT_CACHE_MAX_ENTRIES` 캐시를 오염시킬 위험은 없음을 구현체 확인으로 배제했다. WS emit 은 이미 마스킹돼 있었고(이번 diff 대상 아님) REST 만 따라잡는 변경이라, 오히려 기존에 존재하던 "같은 store 슬롯에서 WS↔REST flip-flop" 부작용을 없애는 방향이다.
- **useMemo 예외 전파**: `editor-toolbar.tsx` 에서 `JSON.parse` 와 `hasMaskedMarkerLeaf` 를 같은 `try` 블록에 둔 변경은 렌더 경로에서 예외가 React 트리로 전파되는 것을 의도적으로 방지하는 기존 패턴을 유지한다 — `hasMaskedMarkerLeaf` 는 깊이 상한(10)이 있어 통제되지 않은 재귀로 스택 오버플로를 일으키지 않는다.

## 요약

핵심 런타임 변경(backend `executions.service.ts`/`background-runs.service.ts`의 `inputData` 마스킹 편입, frontend `rerun-modal.tsx`의 `touchedMaskedKeys` 상태·`blockedByMaskedInput` 제출 차단, `masked-markers.ts` 신규 유틸 모듈 승격)을 8개 부작용 관점으로 점검한 결과 새로 도입된 전역 변수·의도치 않은 상태 공유·파일시스템 부작용·환경 변수 접근·네트워크 호출·콜백 오발화는 발견되지 않았다. 유일하게 기록할 만한 항목은 `Execution.inputData` REST 응답이 raw → 마스킹으로 바뀌는 콘텐츠 계약 변경인데, 이는 spec §R17 이 요구하는 이번 PR 의 목적 그 자체이고 저장소 내부 소비자는 영향이 없음을 확인했으며, 저장소 밖 소비자 확인은 이미 이전 라운드가 트래커 항목으로 등재·defer 한 상태라 CRITICAL/WARNING 이 아닌 INFO 로 재확인 차원에서만 남긴다.

## 위험도

LOW
