STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard (15_32_34)

## 검토 방법

프롬프트가 크기 제한으로 다수 파일의 diff/컨텍스트를 생략했으므로(특히
`executions.service.ts`, `executions.service.spec.ts`, `rerun-modal.tsx`,
`rerun-modal.test.tsx`, `editor-toolbar-run-input.test.tsx`), `git diff
origin/main...HEAD -- codebase/`로 실제 코드 변경분을 직접 열어 대조했다.
`review/**`·`plan/**`·`spec/**` 경로는 이 저장소의 정식 리뷰/plan 산출물이며
런타임 코드가 아니므로 side-effect 관점의 검토 대상에서 제외했다.

이 changeset 은 이미 같은 브랜치에서 3라운드(`14_08_45`→`14_44_08`→`15_10_25`)의
side_effect 리뷰를 거쳤다. `git log --oneline 29d00021d..HEAD -- codebase/` 로
직전 라운드(`15_10_25`) 이후 실제 코드 변경분을 확인한 결과, 이번 라운드까지
추가된 코드 diff 는 딱 두 곳(JSDoc 주제문 문구 수정 1곳, 테스트 파일 공백 줄
제거 1곳)뿐이고 둘 다 문서/포맷팅 수정이라 side-effect 표면에 변화가 없다. 그래서
이번 리뷰는 (a) 그 두 변경분이 새 부작용을 내지 않는지 확인하고, (b) 전체
changeset 을 처음부터 재검토해 이전 라운드들의 결론이 여전히 유효한지 실측으로
재확인하는 두 갈래로 진행했다.

## 발견사항

- **[INFO]** 공개 REST 응답 콘텐츠 계약 변경 — `Execution.inputData` 가 원문에서 마스킹된 값으로 바뀐다 (인터페이스 변경, 저장소 밖 소비자 영향 가능)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(`inputData: redactStoredDataForResponse(rest.inputData)`, 1075행), `toExecutionDto`(`inputData: redactStoredDataForResponse(execution.inputData)`, 1010행). 자매 표면 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:305`(`inputData: redactStoredDataForResponse(row.inputData)`, 이번 diff 는 주석만 수정 — 로직 자체는 기존 그대로 마스킹 중)도 동일 계약을 공유한다.
  - 상세: `GET /executions/:id`, `GET /executions`(목록), `GET /executions/:id/chain`, `POST /executions/:id/stop`, `GET .../background-runs` 등 기존에 이미 공개돼 있던 엔드포인트들의 `inputData` 필드가, 자격증명으로 판별된 값에 한해 이제 `'***'`/`[REDACTED]` 로 마스킹돼 나간다(종전엔 이 컬럼만 egress 마스킹의 유일한 예외였다). OpenAPI 스키마 타입(`type: 'object', additionalProperties: true, nullable: true`)은 바뀌지 않으므로 스키마 diff 로는 드러나지 않는 **콘텐츠 계약 변경**이다. 이 저장소 안의 재제출 소비처 3곳(폼 프리필 `dynamic-form-ui.tsx`, Re-run 모달 `rerun-modal.tsx`, 에디터 히스토리 로드 `editor-toolbar.tsx`)은 이번 PR 이 마커 감지 가드로 함께 닫았지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(QA/운영 자동화, 감사 export, 외부 통합 등)는 스키마상으로 이 변화를 감지할 수 없다.
  - 참고: 새로 발견한 결함이 아니다 — 직전 세 라운드(`14_08_45`·`14_44_08`·`15_10_25`) 의 side_effect 리뷰가 매번 같은 항목을 INFO/WARNING 으로 이미 등재했고, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "`Execution.inputData` 응답 의미 반전의 외부 소비자 확인" (2026-08-20 등재, `14_44_08` W5) 으로 트래커 등재까지 완료돼 있다. security 리뷰어도 같은 축을 INFO 로 판정한 바 있다. side-effect 체크리스트 5번("인터페이스 변경")에 정확히 해당하므로 교차 확인 차원에서 재확인만 하고 다시 명시한다.
  - 제안: 조치 불요(이미 트래커 등재·릴리스 노트 공지 여부는 planner 재량으로 위임됨). 이번 PR 자체를 막을 사안이 아니다.

## 그 외 점검한 축 (결함 없음, 실측 재확인)

1. **의도치 않은 상태 변경**: `codebase/frontend/src/components/executions/rerun-modal.tsx` 의 신규 `useState<Set<string>>` `touchedMaskedKeys`(229행)는 컴포넌트 로컬 상태이고, 모달이 열릴 때(`open`) 마다 `originalParameters`·`touchedMaskedKeys` 를 함께 리셋(234~242행)해 두 상태가 어긋나지 않는다. `setParam`(299~304행)이 매 keystroke 마다 `Set`을 갱신하는 것은 React 불변성 패턴이며 렌더 바깥으로 새는 전역 상태 변경이 아니다. `blockedByMaskedInput`(345~349행)은 두 조건("건드렸는가" OR "값에 마커가 남아있는가")의 합으로 순수하게 파생되는 값이며 부수효과가 없다 — `useOriginalInput` 토글 시에는 이 판정이 스킵돼 서버가 원본 엔티티를 직접 읽는 정상 경로가 막히지 않음을 실측 확인했다(`executions.service.ts:483` `original.inputData` — `findById`/`toResponseExecution` 을 거치지 않는 raw 조회라 이번 마스킹 확장의 영향을 받지 않는다). `hasMaskedMarkerLeaf`/`isMaskedMarker`/`splitMaskedParameters`(`masked-markers.ts`, `rerun-modal.tsx:116`) 는 모두 입력을 변경하지 않는 순수 함수다. `redactStoredDataForResponse`/`redactStoredErrorForResponse`(`redact-stored-error.ts`)는 이번 diff 에서 로직이 바뀌지 않았고(주석만 수정) 여전히 copy-on-change라 입력을 mutate 하지 않는다.
2. **전역 변수**: backend module-scope 상수 `MASKED_INPUT_DATA_REASON`(JSDoc 앵커 전용)을 전량 삭제했다 — `grep -rn "MASKED_INPUT_DATA_REASON" codebase/ spec/` 결과 0건, 잔존 참조 없음(실측). `masked-markers.ts` 승격은 `ReadonlySet` 상수의 **위치 이동**일 뿐 신규 가변 전역 도입이 아니다.
3. **파일시스템 부작용**: 코드 diff 안에 파일 I/O 관련 변경 없음.
4. **시그니처 변경**: backend `ResponseExecution`(private/internal 타입, `executions.service.ts` 103~124행)이 `Omit<Execution, 'error' | 'inputData' | 'outputData' | 'trigger' | 'executor'>` 로 넓어지고 `inputData: Record<string, unknown> | null` 필드가 추가됐다. `grep -rn "ResponseExecution\b" codebase/backend/src` 로 재확인한 결과 실제 타입 참조는 정의부 자신(`ExecutionDetailWithTrigger` 확장, `getChain`/`stop`의 반환 타입)뿐이고, `execution-response.dto.ts`·`background-runs.service.ts` 의 언급은 JSDoc 텍스트 인용일 뿐 타입 import 가 아니다 — 필드가 늘어나는 방향이라 기존 소비자를 깨뜨리지 않는다. frontend 에서 `dynamic-form-ui.tsx` 밖으로 제거된 named export(`MASKED_MARKERS`/`isMaskedMarker`)를 재확인한 결과(`grep -rn "from ['\"].*dynamic-form-ui['\"]"`) 남은 소비처(`result-detail.tsx`, `assistant-presentations-block.tsx`)는 모두 `DynamicFormUI` 컴포넌트만 import 하고 있어 dangling import 없음.
5. **인터페이스 변경**: 위 INFO 항목 외 새 공개 API 추가/제거 없음. i18n 키 `editor.runWithInputMasked`(`dict/{ko,en}/editor.ts`)·`history.rerun.maskedInputBlocked`(`dict/{ko,en}/history.ts`) 는 ko/en 동일 커밋으로 parity 확인됨.
6. **환경 변수**: 읽기/쓰기 없음.
7. **네트워크 호출**: 신규/변경된 외부 서비스 호출 없음. `blockedByMaskedInput`/`jsonError` 판정은 순수 클라이언트측 계산으로 `handleSubmit`/`onRun` 진입 자체를 막을 뿐, 별도 네트워크 부작용을 추가하지 않는다.
8. **이벤트/콜백**: WS emit(`execution.snapshot` 등)이나 알림 webhook 경로는 이번 diff 가 직접 손대지 않았다 — 다만 `websocket.gateway.ts:399` `emitExecutionSnapshot` 이 내부적으로 `executionsService.findById`(`toResponseExecution` 경유)를 호출하므로, WS snapshot emit 도 REST 와 동일하게 마스킹된 `inputData` 를 내보내게 된다. 이는 "WS emit 과 REST 가 같은 store 슬롯에서 flip-flop 하면 안 된다"는 이 PR 의 설계 의도와 정확히 일치하는 결과이지 새로 발견된 결함이 아니다. `rerun-modal.tsx` Re-run 버튼은 `disabled={submitting || blockedByMaskedInput}` 가 유일한 제출 chokepoint(폼 `<form onSubmit>` 없음, Enter 키 우회 경로 없음), `editor-toolbar.tsx` Run 버튼도 `disabled={isRunning || jsonError != null}` 로 동일 패턴임을 확인했다.

## 요약

이번 라운드(`15_32_34`)의 changeset 코드 diff 는 직전 라운드(`15_10_25`) 이후 실제로는 문서 문구 수정 1곳(`executions.service.ts` JSDoc 주제문)과 테스트 공백 줄 제거 1곳뿐이며, 둘 다 side-effect 표면과 무관하다. 전체 changeset 을 처음부터 재검토한 결과도 3차례 선행 라운드의 결론과 동일하게 수렴한다 — 의도치 않은 전역/공유 상태 변경, dangling import, 시그니처 파손, 환경변수·네트워크 부작용, 이벤트 우회 경로는 발견되지 않았다. 유일하게 의미 있는 항목은 `Execution.inputData` REST/WS 응답이 원문에서 마스킹 값으로 바뀌는 콘텐츠 계약 변경인데, 이는 이 PR 의 핵심 의도이자 이미 plan 트래커와 이전 라운드들이 반복 확인·등재해 둔 사안이라 INFO 로 재확인만 한다.

## 위험도

LOW
