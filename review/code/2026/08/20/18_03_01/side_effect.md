STATUS=success ISSUES=2

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 나열한 파일 중 실제 코드 변경분(1~27번, `review/**` 산출물 제외)을 대상으로
`git diff origin/main...HEAD` 로 diff 가 생략된 파일(`executions.service.ts`,
`rerun-modal.tsx`, `masked-markers.ts` 등)을 직접 열어 대조했다. 초점은 (1) `Execution.inputData`
REST 응답의 마스킹 반전이 기존 소비자에 미치는 영향, (2) `MASKED_MARKERS`/`isMaskedMarker` 모듈
이전이 남긴 참조, (3) `rerun-modal.tsx` 신규 state(`touchedKeys`)의 리셋·갱신 부작용 세 축이다.

## 발견사항

- **[WARNING]** `Execution.inputData` REST 응답의 의미가 "원문"에서 "마스킹된 값"으로 반전 — 타입 시그니처는 그대로라 정적으로 드러나지 않는 인터페이스 변경
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(1068행 부근, `inputData: redactStoredDataForResponse(rest.inputData)`), `toExecutionDto`(1006행 부근, `inputData: redactStoredDataForResponse(execution.inputData)`). 함수 시그니처(`(execution: Execution): ResponseExecution` 등)와 `ResponseExecution.inputData` 의 타입(`Record<string, unknown> | null`)은 변경 전후 동일하다.
  - 상세: `Execution.inputData` 를 읽는 REST 응답 필드가 이 PR 이전엔 항상 DB 원문이었는데, 이제 자격증명으로 판별된 leaf 를 `***`/`[REDACTED]` 로 치환해 내보낸다. 이 저장소 내부의 UI 소비자(폼 프리필·Re-run 모달·에디터 히스토리 로드) 세 곳은 이번 PR 이 함께 마커 가드를 갖춰 안전하지만, **이 필드를 직접 읽는 저장소 밖의 API 소비자**(공개 API 클라이언트, 자동화 스크립트, 다른 팀 통합 등)가 있다면 이제 리터럴 마스킹 문자열을 원본 데이터로 오인·재사용할 위험이 새로 생긴다. 반환 타입 스키마(`Record<string, unknown> | null`)는 마스킹 전후로 동일해 OpenAPI/타입 검사로는 이 의미 변화가 드러나지 않는다 — 순수한 런타임 시맨틱 변경이다.
  - 참고: 이 리스크는 새로 발견된 것이 아니라 이미 같은 브랜치 내 이전 리뷰 라운드에서 인지·트래커 등재된 채 의도적으로 이번 PR 범위 밖으로 defer 됐다 (`review/code/2026/08/20/15_32_34/RESOLUTION.md` "미반영 INFO" 항목 5: "응답 의미 반전의 외부 소비자 확인 — 스키마로 드러나지 않는 콘텐츠 계약 변경. 저장소 밖 소비자 존재 여부는 diff 범위 밖"). 부작용 관점 체크리스트(인터페이스 변경이 기존 사용자에 미치는 영향)에 정확히 해당해 재확인 차원에서 기재하되, 이미 승인된 트레이드오프이므로 이번 라운드에서 추가 차단 사유로 보지는 않는다.
  - 제안: 이미 트래커에 등재돼 있으므로 코드 조치는 불요. CHANGELOG(`CHANGELOG.md:3`)에 이미 "이 컬럼은 egress 마스킹의 유일한 예외였다"는 문맥이 있으나, 공개 API 변경 이력(OpenAPI changelog 등 저장소 밖 문서가 있다면)에도 breaking semantic change 로 별도 명시할 가치가 있다.

- **[INFO]** `setParam` 이 이제 두 개의 state(`paramValues`, `touchedKeys`)를 함께 갱신하는 부작용을 갖게 됨 — 로컬 클로저라 외부 영향은 없음
  - 위치: `codebase/frontend/src/components/executions/rerun-modal.tsx` `setParam` 함수 정의부 (`const setParam = (key: string, value: unknown) => { setParamValues(...); setTouchedKeys(...); }`)
  - 상세: 시그니처(`(key: string, value: unknown) => void`)는 그대로지만, 종전엔 `paramValues` 만 갱신하던 함수가 이제 호출될 때마다 `touchedKeys` 에도 그 키를 추가한다. `ReRunModal` 컴포넌트 내부 클로저이고 컴포넌트 밖에서 재사용되지 않으므로 side effect 범위는 이 컴포넌트로 완전히 격리돼 있다 — `blockedByMaskedInput` 판정이 의도적으로 이 부작용에 의존하는 설계(WARNING 아님). 모달이 열릴 때 `touchedKeys` 도 `paramValues` 와 함께 리셋되는지(`useEffect([open, originalParameters])` 안에 `setTouchedKeys(new Set())` 포함)를 확인했고, 두 state 가 같은 effect 에서 동기화되어 리셋 시점 불일치로 인한 오탐/누락은 없다.
  - 제안: 조치 불요 — 참고용 기록.

## 확인했으나 문제 없음 (참고)

- **모듈 이전 dangling import**: `MASKED_MARKERS`/`isMaskedMarker` 가 `dynamic-form-ui.tsx`(구 위치, export 제거)에서 `lib/utils/masked-markers.ts`(신 위치)로 이전됐다. 저장소 전체(`grep -rn "MASKED_MARKERS\|isMaskedMarker" codebase`)를 대조한 결과 남은 소비처 5곳(`rerun-modal.tsx`, `rerun-modal.test.tsx`, `dynamic-form-ui.tsx`, `dynamic-form-ui.test.tsx`, `editor-toolbar.tsx`) 전부 신 경로로 갱신돼 있고, 구 경로를 참조하는 잔여 import 는 없다. `dynamic-form-ui.tsx` 를 import 하는 두 소비처(`result-detail.tsx`, `assistant-presentations-block.tsx`)도 `DynamicFormUI` 만 가져오므로 이 export 제거의 영향 밖이다.
- **`ResponseExecution` 타입 확장 범위**: `Omit<Execution, 'error' | 'inputData' | ...>` 로 `inputData` 가 새로 추가됐지만, `export type ResponseExecution` 은 `executions.service.ts` 모듈 내부에서만 소비된다(`ExecutionDetailWithTrigger`, 메서드 반환 타입) — 다른 모듈에서 이 타입을 import 하는 곳은 없어 컴파일 타임 파급은 이 파일 안에 갇혀 있다.
- **backend `MASKED_MARKERS`(`sanitize-error-message.ts`) 값 자체**: 이번 diff 는 JSDoc 주석만 바꿨고(프런트 미러 경로 갱신 안내), 마스킹 판정 로직·값 목록·export 여부는 무변화.
- **서버측 `useOriginalInput=true` 재실행 경로**: `executeRerun` 의 `original.inputData`(482행 부근)는 TypeORM 엔티티에서 직접 읽는 raw 값이라 이번 마스킹 관문(`toResponseExecution`)을 거치지 않는다 — DTO 마스킹 반전이 이 서버측 원본-재실행 경로를 오염시키지 않음을 확인했다.
- **환경 변수·네트워크 호출**: 이번 diff 에 신규/변경된 `process.env` 참조나 외부 HTTP 호출은 없다.
- **파일시스템 부작용**: 코드 변경 자체는 순수 로직/타입/주석 변경이며 런타임 파일 I/O 를 새로 만들지 않는다(`review/**` 디렉토리 다수는 이 changeset 의 리뷰 파이프라인이 남긴 세션 산출물이며 코드 실행 시점의 부작용이 아니다).

## 요약

핵심 부작용은 `Execution.inputData` REST 응답의 "원문 → 마스킹" 의미 반전 하나다. 함수 시그니처와 타입 스키마는 변경되지 않아 정적으로는 드러나지 않는 진짜 인터페이스 변경이지만, 이미 이전 리뷰 라운드에서 인지되고 저장소 밖 소비자 확인이 트래커에 등재된 채 의도적으로 defer 된 사항이라 이번 라운드의 새로운 결함은 아니다. 프런트 쪽 `setParam` 부작용 확장은 컴포넌트 로컬로 완전히 격리돼 있고, `MASKED_MARKERS`/`isMaskedMarker` 모듈 승격도 소비처 전수가 신 경로로 정확히 갱신돼 dangling import 가 없다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 발생 방식에 새로운 의도치 않은 변경은 발견하지 못했다.

## 위험도

LOW
