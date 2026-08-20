STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

`origin/main...HEAD` 전체 diff(78파일) 중 실제 애플리케이션 코드 24개 파일을 대상으로 점검했다.
나머지는 `review/**`·`plan/**` 산출물로 런타임 부작용 범주 밖이다. 이 changeset 은 이미 4라운드의
code review(`14_08_45`→`14_44_08`→`15_10_25`→`15_32_34`)와 3라운드의 consistency review 를
거쳤고, 각 RESOLUTION.md 를 실측 대조해 지적된 CRITICAL/WARNING(object/array 마커 누락,
`touchedMaskedKeys` 영구 해제 우회, `coerceInput` 실패 시 차단 우회 등)이 실제로 반영돼 있음을
`rerun-modal.tsx`/`executions.service.ts` 직접 Read 로 확인했다. 아래는 그 위에서 독자적으로
검증한 부작용 관점 발견사항이다.

## 발견사항

- **[WARNING]** 공개 REST 응답 계약이 침묵 변경된다 — `Execution.inputData` 가 원문에서 마스킹값으로 바뀐다 (인터페이스 변경)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `ResponseExecution` 타입 정의(`inputData: Record<string, unknown> | null;` 필드 추가), `toResponseExecution`(`inputData: redactStoredDataForResponse(execution.inputData)`), `toExecutionDto`(`inputData: redactStoredDataForResponse(rest.inputData)`)
  - 상세: 이전에는 `GET /executions/:id`·`GET /executions?workflowId=...`·`getChain`·`stop` 네 표면이 `Execution.inputData` 를 DB 원문 그대로 응답했다(`①②⑧⑧-b` 캐너리가 "원문 통과"를 고정하고 있었다). 이번 diff 로 같은 필드가 동일 스키마·동일 HTTP 상태 코드로 **값만 마스킹돼(`***`/`[REDACTED]`)** 나간다 — OpenAPI 타입은 `object` 그대로라 스키마 diff 로는 드러나지 않는 콘텐츠 계약 변경이다. 이 저장소 안의 세 프런트 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)는 이번 PR 이 함께 가드했지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(운영 자동화 스크립트·감사 export·서드파티 통합)는 이 변경을 스키마로 알 방법이 없다. `reRun` 자체는 `original.inputData` 를 `createQueryBuilder` 로 DB 에서 직접 읽으므로(`executions.service.ts:429-433`) 이 마스킹의 영향을 받지 않음을 확인했다 — 재실행 파이프라인 자체는 오염되지 않는다.
  - 참고: 이 항목은 이미 인지·트래킹돼 있다 — `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 `[ ] Execution.inputData 응답 의미 반전의 외부 소비자 확인 (2026-08-20 등재, 14_44_08 W5)`, 그리고 CHANGELOG.md 의 "잔여 갭" 서술. 새로 발견한 결함이 아니라, 부작용(Side Effect) 관점 체크리스트 5번("인터페이스 변경")이 명시적으로 요구하는 항목이라 이 리뷰에서도 동일 위치를 재확인 차 기록한다 — 트래커 항목 종결 전까지는 계속 열려 있어야 할 항목이다.
  - 제안: 추가 조치 불요(이미 트래커에 있음). 릴리스 노트/체인지로그에 "breaking: Execution.inputData 응답이 이제 자격증명 패턴을 마스킹한다" 를 명시적으로 공지하는 것을 트래커 항목의 완료 조건으로 유지할 것.

## 확인했으나 문제 없음 (부작용 없음을 실측 검증)

- **마스킹 함수의 순수성**: `redactStoredDataForResponse`/`redactStoredErrorForResponse`(`codebase/backend/src/shared/utils/redact-stored-error.ts`)는 `deepRedactSecrets` 의 copy-on-change 위에 구현돼 있어 입력 객체를 변이하지 않는다 — `SNAPSHOT_CACHE_MAX_ENTRIES` 캐시에 보관된 엔티티가 이번 변경으로 그 자리에서 마스킹되어 이후 `useOriginalInput=true` 재실행 경로가 오염된 값을 읽게 될 위험을 확인했으나, 해당 없음(입력 불변 보장 + `reRun` 이 별도 쿼리로 DB 원문을 재조회).
- **제거된 exports 의 잔존 참조**: `dynamic-form-ui.tsx` 에서 삭제된 `export const MASKED_MARKERS`/`export function isMaskedMarker` 를 그 파일에서 import 하던 다른 소비처가 있는지 전수 grep — `result-detail.tsx`·`assistant-presentations-block.tsx` 둘 다 `DynamicFormUI` 컴포넌트만 import 하고 있어 breaking import 없음.
- **삭제된 식별자의 잔존 참조**: `MASKED_INPUT_DATA_REASON`(및 그 앵커용 `void` 문) 삭제 후 코드베이스 전수 grep 결과 코드 참조 0건(문서·plan 의 역사적 언급만 남음) — 빌드를 깨뜨릴 dangling reference 없음.
- **WS emit 과의 신규 flip-flop 여부**: 이번 변경이 REST 레벨(`Execution.inputData`)만 마스킹 대상으로 바꾸므로, WS emit 이 같은 최상위 필드를 원문으로 내보내고 있었다면 새로운 REST↔WS 불일치가 생길 수 있었다. `emitExecution` 호출부(`execution-engine.service.ts`, `*-interaction.service.ts` 등) 전수 확인 결과 최상위 `Execution.inputData` 전체를 WS payload 에 그대로 싣는 경로는 없었다(전부 `nodeExecution.inputData` 또는 이미 별도 처리된 필드) — 새 flip-flop 없음.
- **`rerun-modal.tsx` 신규 로컬 상태(`touchedMaskedKeys`)**: 컴포넌트 로컬 `useState` 로 전역/공유 상태가 아니고, 모달이 열릴 때 리셋 `useEffect` 에 `setTouchedMaskedKeys(new Set())` 가 함께 추가돼 있어 이전 세션의 상태가 다음 오픈에 새는 경로 없음. `setParam` 콜백이 `paramValues` 갱신과 함께 `touchedMaskedKeys` 도 갱신하는 것은 의도된 이중 상태 업데이트이고, `new Set(prev).add(key)` 는 `prev` 를 직접 변이하지 않고 새 Set 을 만들어 채우므로 참조 공유 버그 없음.
- **환경 변수·네트워크·파일시스템**: 이번 diff 는 런타임 코드에서 환경 변수 읽기/쓰기, 신규 외부 네트워크 호출, 예상 밖 파일 I/O 를 추가하지 않는다.

## 요약

이 changeset 의 핵심 런타임 부작용은 `Execution.inputData` 의 REST 응답 값-마스킹 전환 하나다 — 이는 의도된 설계 변경이고, 저장소 내부 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)는 마커 감지 가드로 왕복 오염을 정확히 차단하도록 구현·검증돼 있음을 코드 레벨에서 재확인했다(`useOriginalInput` 경로는 DB 직접 조회로 영향 밖). 다만 이 값-마스킹은 스키마상 드러나지 않는 콘텐츠 계약 변경이라 저장소 밖 API 소비자에게는 여전히 breaking 일 수 있고, 이는 이미 plan 트래커(W5)에 등재돼 있어 이번 PR 을 막을 사안은 아니다. 그 외 상태 변이·전역 변수·파일시스템·시그니처·환경 변수·네트워크·이벤트 콜백 축에서는 독자적으로 재검증한 결과 새로운 부작용을 찾지 못했다 — 마스킹 함수의 불변성, 삭제된 식별자/export 의 잔존 참조 0건, WS/REST 신규 flip-flop 부재, 로컬 컴포넌트 상태의 격리를 모두 실측 확인했다.

## 위험도

LOW
