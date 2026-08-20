STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`git diff origin/main...HEAD --stat -- codebase/` (23파일)을 정본 changeset 으로 잡고, 프롬프트에서 생략된
diff(`executions.service.ts`, `executions.service.spec.ts`, `rerun-modal.tsx`, `masked-markers.ts` 등)는
`Read`/`Bash grep`으로 직접 열어 대조했다. 이 changeset 은 이미 code-review 3라운드
(`14_08_45`·`14_44_08`·`15_10_25`·`15_32_34`·`15_59_17`·`16_25_35`) + consistency 다회를 거쳐
동작·구조 결함이 대부분 수렴한 상태라, 새 부작용보다 **인터페이스 반전의 잔여 파급**에 집중했다.

## 발견사항

- **[INFO]** `Execution.inputData` 응답 값의 의미가 **동일한 타입 계약 아래서** 조용히 반전된다 — 이미 트래커에 등재돼 이번 PR을 막을 사안은 아니다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`toResponseExecution`·`toExecutionDto`·`getChain`·`stop` — 함수명으로 특정, 개별 줄은 diff 상 다수 지점), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:69`(`ExecutionDto.inputData`), `:191`(`NodeExecutionSummaryDto.inputData`)
  - 상세: `ExecutionDto.inputData`/`NodeExecutionSummaryDto.inputData` 의 OpenAPI/TS 타입 시그니처(`Record<string, unknown> | null`, `nullable: true`)는 이번 diff 로 바뀌지 않았다 — JSDoc 만 갱신됐다. 그런데 **런타임 값**은 이번 PR 로 "원문 그대로"에서 "자격증명 패턴이 `***`/`[REDACTED]` 로 치환된 값"으로 반전된다(`toResponseExecution`/`toExecutionDto`/`getChain`/`stop` 전부). 타입 계약이 그대로라 컴파일러도 API 스키마 diff 도 이 변화를 드러내지 않는다 — 프런트(Re-run 모달·에디터 히스토리 로드·폼 프리필)는 이번 PR 이 함께 마커 가드를 붙였으므로 안전하지만, **이 저장소 밖의 API 소비자**(webhook 포워더, 감사 로그 스크레이퍼, 외부 통합)가 `GET /executions/:id` 등에서 `inputData` 원문을 읽어 왔다면 이제 마스킹된 문자열을 받는다.
  - 참고: 이 항목은 `review/code/2026/08/20/15_32_34/RESOLUTION.md` 트래커 5번("응답 의미 반전의 외부 소비자 확인")으로 이미 등재돼 있고, 저장소 밖 소비자 존재 여부는 diff 범위 밖이라는 판정도 있다 — 새 발견이 아니라 side-effect 관점에서의 독립 확인이다.
  - 제안: 조치 불요(이미 트래커 관리 중). 다만 CHANGELOG/release note 에 "REST 응답의 `inputData` 값 자체가 바뀐다(타입은 동일)"는 한 줄을 명시적 breaking-behavior 항목으로 남겨 두면 외부 API 소비자 공지 시 누락 위험이 줄어든다.

- **[INFO]** `MASKED_MARKERS`/`isMaskedMarker` 가 컴포넌트 모듈(`dynamic-form-ui.tsx`)의 공개 export 에서 제거되고 `lib/utils/masked-markers.ts` 로 이동 — 잔존 참조 없음을 실측 확인
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` (제거), `codebase/frontend/src/lib/utils/masked-markers.ts` (신규), 소비처 `rerun-modal.tsx:27-29`, `dynamic-form-ui.tsx:6`, `editor-toolbar.tsx:37`
  - 상세: `export const MASKED_MARKERS`/`export function isMaskedMarker` 가 `dynamic-form-ui.tsx` 에서 삭제되고 동일 이름·동일 시그니처로 `@/lib/utils/masked-markers` 에 재정의됐다. `grep -rn "MASKED_MARKERS|isMaskedMarker|hasMaskedMarkerLeaf"`로 프런트 전체를 스캔한 결과 옛 경로(`"../dynamic-form-ui"`)를 가리키는 잔존 import 는 0건이었다(테스트 파일도 이미 새 경로로 갱신됨, 파일 9). 함수 시그니처(`isMaskedMarker(v: unknown): boolean`)와 동작도 그대로 이전됐다.
  - 제안: 조치 불요 — 순수 위치 이동이며 side-effect 관점에서 위험 없음을 확인하기 위한 기록용 항목이다.

## 점검한 항목 중 문제 없음으로 판정

- **전역 상태/전역 변수**: `masked-markers.ts` 는 `MASKED_MARKERS`(`ReadonlySet`)·`MAX_MARKER_SCAN_DEPTH` 상수만 모듈 스코프에 두며 mutable 전역이 아니다. `rerun-modal.tsx` 의 `touchedKeys`/`paramValues`/`maskedKeys` 는 전부 컴포넌트 로컬 `useState`/`useMemo` 이고, 모달이 열릴 때마다 `useEffect`(`open` 의존)로 리셋되어 세션 간 누수가 없다.
- **시그니처 변경의 호출자 영향**: `ResponseExecution`(backend, `Omit<Execution, 'error'|'inputData'|'outputData'|...>`) 의 `inputData` 필드가 새로 편입되며 `Record<string,unknown> | null` 로 타입이 넓어졌다. 이 타입은 `executions.service.ts` 내부 전용이며(`grep` 결과 타입 자체를 import 하는 다른 모듈 없음), 외부 호출자에 영향 없다.
- **파일시스템 부작용**: 코드 변경분 중 파일 I/O 를 새로 도입한 곳 없음. `review/code/**` 하위 다수 신규 파일은 이 PR 자체의 리뷰 이력 산출물(과거 라운드가 생성)로, 이번 diff 의 런타임 부작용이 아니다.
- **환경 변수**: 읽기/쓰기 변경 없음.
- **네트워크 호출**: 새 외부 호출 없음. `rerun-modal.tsx`/`editor-toolbar.tsx` 는 기존 `executionsApi`/`workflowsApi` 호출 경로를 그대로 쓴다.
- **이벤트/콜백**: `ReRunModalProps.onSuccess`/`onClose` 시그니처 불변. `blockedByMaskedInput` 은 `<Button disabled>` 값에만 반영되고 새 콜백을 추가하지 않는다. `editor-toolbar.tsx` 의 `useMemo` 는 `[jsonInput, t]` 의존 그대로이며 `hasMaskedMarkerLeaf` 호출이 예외를 던지는 경로가 없음을 함수 구현(깊이 상한을 값 검사보다 나중에 적용)으로 확인했다.

## 요약

이 changeset 의 핵심 부작용 표면은 `Execution.inputData` egress 마스킹 카브아웃 폐지로 인한 **REST 응답 값의 의미 반전**인데, 타입 계약(`ExecutionDto.inputData: Record<string,unknown>|null`)은 그대로라 스키마 레벨에서는 드러나지 않는 조용한 런타임 변화다. 이 저장소 내부 소비자(Re-run 모달·에디터 히스토리 로드·폼 프리필)는 같은 PR 에서 마커 가드를 동반해 안전하지만, 저장소 밖 API 소비자에 대한 영향은 diff 로 확인 불가능하며 이미 팀 트래커에 별건으로 등재돼 있다. `MASKED_MARKERS`/`isMaskedMarker` 의 모듈 이동은 잔존 참조 0건을 실측했고, 신규 상태(`touchedKeys` 등)는 컴포넌트 로컬이며 리셋 경로가 명확하다. 전역 변수 도입, 파일시스템 부작용, 환경 변수 접근, 의도치 않은 네트워크 호출, 콜백 시그니처 변경은 발견되지 않았다.

## 위험도

LOW
