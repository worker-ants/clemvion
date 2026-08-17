# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[INFO]** `MASKED_MARKERS`/`isMaskedMarker` 를 설명하는 대형 JSDoc 블록이 여전히 그 상수에 귀속되지 않는 고아(orphan) 주석이다 (기지 항목, 재플래그 아님)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95`-`116`(대형 설명 블록) 사이에 `:117`(`/** 값-패턴 마스커가 남기는 마커. */`) 한 줄 주석이 끼어들고 `:118`(`export const VALUE_MASK_MARKER = '***';`)로 이어진다. 대형 블록이 실제로 설명하는 대상인 `MASKED_MARKERS`(`:124`) 는 바로 위에 아무 JSDoc도 없다.
  - 상세: 이 항목은 `review/code/2026/08/17/00_47_01/documentation.md` WARNING 1로 이미 발견됐고, 같은 라운드 RESOLUTION이 "이 저장소의 수렴 규율"에 따라 **의도적으로 이연**하기로 결정했다(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:293`-`299`에 등재). 다음 라운드(`10_50_14`)는 이 항목을 다시 검토하되 **"등급 상향 금지"로 재확인**했다. 직접 소스를 열어 확인한 결과 배치는 그때와 동일하며, 내용·동작에는 영향이 없는 순수 주석-귀속 문제다.
  - 제안: 새 조치 불요 — 이미 트래커에 등재되어 있고 반복 재지적이 오히려 5라운드 이상 리뷰를 여는 stale 루프를 유발한다는 것이 이 저장소의 명시적 결정이다. 다음에 이 파일을 편집할 기회에 대형 블록을 `MASKED_MARKERS` 선언 직전으로 옮기는 것을 권장(트래커 서술 그대로).

## 확인했으나 문제 없음 (참고)

diff 전체(현재 HEAD 기준 `codebase/backend/src/modules/executions/executions.service.ts`, `background-runs/background-runs.service.ts`, `dto/responses/execution-response.dto.ts`, `background-run-response.dto.ts`, `shared/utils/redact-stored-error.ts`(+`.spec.ts`), `CHANGELOG.md`, `run-results.mdx`/`.en.mdx`, `spec/conventions/swagger.md`)를 직접 열어 재확인했다.

- `toResponseExecution` JSDoc 의 "읽기 표면 목록" 표(6곳)가 유일한 정본으로 자리 잡았고, `background-runs.service.ts`·`redact-stored-error.ts`·CHANGELOG·DTO description 이 전부 개수를 하드코딩하지 않고 그 표를 `{@link}`/텍스트 참조로만 가리킨다 — 과거 "자매 넷 중 하나만" 드리프트 패턴이 구조적으로 제거됨을 확인.
- `executions.service.spec.ts` 의 `describe('outputData + 노드 레벨 inputData 마스킹 — 표면 전수 (Execution.inputData 는 카브아웃)', …)` 제목이 최신 커밋(`3611ed3b2`)에서 레벨 구분을 정확히 반영하고 있고, 세 spec 파일 전수에 "비대상 고정" 이라는 옛 문구의 살아있는 인스턴스가 남아있지 않음을 grep 으로 재확인.
- `ExecutionDto.inputData`/`outputData`, `NodeExecutionSummaryDto.inputData`/`outputData`/`error`, `BackgroundRunNodeExecutionDto.inputData`/`outputData` 의 JSDoc/Swagger description 이 "어느 레벨이 마스킹 대상인지"를 서로 모순 없이 서술하고(`Execution.inputData` 만 카브아웃, 나머지는 마스킹), 근거 정본(`MASKED_INPUT_DATA_REASON`, EIA §R17)을 일관되게 가리킨다.
- `spec/conventions/swagger.md` 에 DTO description 길이 규약 예외("보안·정책 캐비엇", 2026-08-17)가 실측 근거(9곳 이상 기존 사례)와 함께 신설되어, 위 DTO들의 장문 description 이 규약 위반이 아니라 규약이 현실을 반영하도록 갱신된 결과임을 확인.
- 유저 가이드 `run-results.mdx`/`.en.mdx` 의 Input/Output 두 행 모두 KO/EN 대칭으로 마스킹 캐비엇이 추가되어 있고, CHANGELOG 의 "Input/Output 탭" 서술과 일치한다. Error 탭 캐비엇은 아직 없으나 이는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301`-`303`에 이미 등재된 의도적 범위 좁힘(이번 PR 변경 대상은 `outputData`)이라 신규 발견이 아니다.
- CHANGELOG 의 신규 최상단 항목이 서술하는 표면 수("여섯")·예외(`llmCalls`)·wire 변화 캐비엇·성능 수치가 실제 코드(`websocket.service.ts`의 `maskWireEnvelope`/`toFanoutEnvelope`, `executions.service.ts`의 `toResponseExecution` 표)와 대조해 정합했다.
- `plan/` 라이프사이클 이동(`eia-internal-rest-error-masking.md` in-progress→complete, `spec-draft-eia-fanout-masking.md`)과 `spec-sync-external-interaction-api-gaps.md`의 상대링크 정정은 순수 이동/링크 수정이며 내용 왜곡이 없다.

## 요약

이번 changeset은 6라운드에 걸친 반복 리뷰를 거치며 문서화 결함이 동작 층 → 구조 층 → 순수 문서 층으로 이미 수렴한 상태다. 이번(7라운드) 독립 재검토에서 CHANGELOG·JSDoc·Swagger description·유저 가이드(KO/EN)·spec·plan 트래커를 코드와 직접 대조했으나 새로운 CRITICAL/WARNING 급 문서화 결함은 발견하지 못했다. 유일하게 남아있는 항목(`MASKED_MARKERS` JSDoc 귀속 문제)은 이미 두 라운드 전부터 알려져 트래커에 등재됐고, 저장소가 명시적으로 "등급 상향 금지"를 선언한 상태라 INFO로만 재확인했다 — 반복 재지적이 이 저장소가 정의한 리뷰 stale 루프를 유발할 뿐 실질 가치가 없다는 이전 라운드들의 판단에 동의한다.

## 위험도
NONE
