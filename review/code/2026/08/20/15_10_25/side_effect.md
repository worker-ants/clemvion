STATUS=success ISSUES=1

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 코드 리뷰 — eia-inputdata-marker-guard

## 검토 방법

프롬프트가 크기 제한으로 다수 파일 diff 를 생략했으므로(`executions.service.ts`,
`executions.service.spec.ts`, `rerun-modal.tsx` 등), `git diff origin/main...HEAD --
codebase/` 로 실제 코드 변경 23개 파일 전체를 직접 열어 대조했다. `review/**`·`plan/**`
경로는 이 저장소가 정식 워크플로로 규정한 리뷰·plan 산출물 커밋이라 side-effect 관점의
검토 대상(런타임 코드)이 아니므로 제외했다.

## 발견사항

- **[INFO]** 공개 REST 응답 계약 변경 — `Execution.inputData` 가 원문에서 마스킹된 값으로 바뀐다 (인터페이스 변경, 저장소 밖 소비자 영향 가능)
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 의 `toResponseExecution`(1067행 부근, `inputData: redactStoredDataForResponse(rest.inputData)`)· `toExecutionDto`(1009행 부근, `inputData: redactStoredDataForResponse(execution.inputData)`)· `stop()` 이 호출하는 동일 관문. 자매 표면 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`(305행, `inputData: redactStoredDataForResponse(row.inputData)`)도 동일.
  - 상세: `GET /executions/:id`, `GET /executions`(목록), `GET /executions/:id/chain`, `POST /executions/:id/stop`, `GET /executions/:id/background-runs` 등 기존에 이미 공개돼 있던 엔드포인트들이, 자격증명으로 판별된 값에 한해 응답 바디의 `inputData` 필드를 `'***'` 등으로 마스킹해서 내보내기 시작한다. OpenAPI 스키마 타입(`type: 'object', additionalProperties: true`)은 그대로라 스키마 diff 로는 드러나지 않는 **콘텐츠 계약 변경**이다. 저장소 안의 세 소비처(폼 프리필·Re-run 모달·에디터 히스토리 로드)는 이번 PR 이 함께 가드했지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(QA/운영 자동화, 감사 export, 외부 통합 등)는 스키마상으로는 변경을 감지할 수 없다.
  - 참고: 이 side-effect 는 이미 인지·추적되고 있다 — 같은 changeset 의 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 "`Execution.inputData` 응답 의미 반전의 외부 소비자 확인" 항목(2026-08-20 등재, `14_44_08` W5)으로 등재돼 있고, 직전 라운드 security reviewer 도 같은 축을 INFO 로 판정했다. 새로 발견한 결함이 아니라, side-effect 리뷰 관점에서 "인터페이스 변경의 기존 사용자 영향"이라는 점검 항목에 정확히 해당하므로 교차 확인 차원에서 다시 명시한다. 이번 PR 자체를 막을 사안은 아니다.
  - 제안: 별도 조치 불요(이미 트래커에 등재됨). 트래커 항목이 실제로 후속 처리되는지만 확인.

## 그 외 점검한 축 (결함 없음)

- **의도치 않은 상태 변경 / 전역 변수**: backend 에서 module-scope 상수 `MASKED_INPUT_DATA_REASON`(JSDoc 앵커 전용, `void` 로 런타임 미참조)을 전량 삭제했다 — `grep -rn "MASKED_INPUT_DATA_REASON" codebase/ spec/` 결과 0건으로 실측, 참조 잔존 없음. frontend `rerun-modal.tsx` 의 신규 `useState<Set<string>>(touchedMaskedKeys)` 는 컴포넌트 로컬 상태이고, `open` 변경 시 `useEffect` 가 `originalParameters`·`touchedMaskedKeys` 를 함께 리셋해 두 자리가 어긋나지 않는다. `setParam` 이 매 keystroke 마다 새 `Set` 을 할당하는 것은 의도된 React 불변성 패턴이며 전역 상태 오염이 아니다.
- **파일시스템 부작용**: 코드 diff 안에 파일 I/O 관련 변경 없음.
- **시그니처 변경**: backend `ResponseExecution`(internal type, `Omit<Execution, ... | 'inputData' | ...> & { inputData: Record<string,unknown> | null; ... }`)이 필드 타입을 바꿨지만 `grep -rln "ResponseExecution"` 결과 참조처는 JSDoc 인용뿐이라 실제 호출자 영향 없음. `splitMaskedParameters`(신규, `rerun-modal.tsx`)는 이번 PR 이 도입한 내부 helper 라 기존 호출자가 없다. `dynamic-form-ui.tsx` 에서 제거된 export `MASKED_MARKERS`/`isMaskedMarker` 는 `grep -rln "from ['\"].*dynamic-form-ui['\"]"` 로 남은 두 소비처(`result-detail.tsx`, `assistant-presentations-block.tsx`)를 확인했고 둘 다 `DynamicFormUI` 컴포넌트만 import — 제거된 named export 를 참조하는 곳 없음. 테스트 파일(`dynamic-form-ui.test.tsx`)도 새 경로(`@/lib/utils/masked-markers`)로 올바르게 갱신됨.
- **인터페이스 변경**: 위 INFO 항목 외에는 새 공개 API 추가·제거 없음. i18n 키 `editor.runWithInputMasked`/`history.rerun.maskedInputBlocked` 는 ko/en 동일 커밋으로 parity 위반 없음(`grep` 으로 양쪽 사전 파일 확인).
- **환경 변수**: 변경 없음.
- **네트워크 호출**: 신규/변경된 외부 서비스 호출 없음. `blockedByMaskedInput` 은 순수 클라이언트측 판정으로 `handleSubmit` 진입 자체를 막을 뿐, 별도 네트워크 side-effect 를 추가하지 않는다.
- **이벤트/콜백**: WS emit(`execution.waiting_for_input` 등)이나 알림 webhook 경로는 이번 diff 에 포함되지 않았다 — 마스킹 관문 확장은 REST 응답 직렬화 지점(`toResponseExecution`/`toExecutionDto`/`background-runs.service.ts`)에 한정되고, `original.inputData`(Re-run 서버측 재실행 입력, `executions.service.ts:483,523`)는 raw 엔티티에서 직접 읽어 이번 마스킹 변경의 영향을 받지 않음을 확인했다 — `useOriginalInput=true` 경로가 여전히 원문으로 재실행되는 설계 의도와 일치한다.

## 요약

이번 changeset 은 `Execution.inputData` egress 마스킹 카브아웃을 닫으면서(재제출 소비처 3곳에 마커 가드 신설) backend 세 응답 표면에 기존 `redactStoredDataForResponse` 관문을 추가로 배선하고, frontend 마커 판별 유틸을 컴포넌트 로컬에서 `lib/utils/masked-markers.ts` 로 승격했다. 코드 레벨에서 의도치 않은 전역 상태 변경·시그니처 파손·죽은 import·환경변수/네트워크 부작용은 발견되지 않았고, 제거된 앵커 상수·이동된 export 모두 참조처를 실측 확인해 dangling 없음을 검증했다. 유일하게 side-effect 관점에서 의미 있는 항목은 `Execution.inputData` REST 응답의 콘텐츠 계약이 원문→마스킹으로 바뀌는 것인데, 이는 이 PR 이 의도한 핵심 변경이자 이미 plan 트래커(`14_44_08` W5)와 직전 security 리뷰에 INFO 로 등재·추적되고 있어 이번 PR 을 막을 사안은 아니다.

## 위험도

LOW
