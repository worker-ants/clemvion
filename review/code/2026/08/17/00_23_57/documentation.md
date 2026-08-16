# 문서화(Documentation) 코드 리뷰

## 검토 방법

프롬프트가 크기 제한으로 diff 를 생략한 파일들(`executions.service.ts`, `executions.service.spec.ts`, `websocket.service.ts`, `sanitize-error-message.ts`, plan 파일 다수, spec 파일 2개)은 `git diff origin/main -- <path>` 와 `Read` 로 직접 원본을 열어 확인했다. `review/code/**`·`review/consistency/**` 하위 파일들(21~68번)은 이 저장소가 상시 강제하는 review-fix-consistency 워크플로의 정규 산출물이라 문서화 관점의 신규 리뷰 대상이 아니라고 판단해 통과시켰고, 실제 기능 diff(1~20번, `spec/5-system/*.md` 3개 포함)에 집중했다.

## 발견사항

- **[WARNING]** 새로 추가된 테스트 JSDoc 이 자기 자신이 나열한 표면 개수와 다른 숫자를 주장한다 — 이 PR 이 "흩어진 표면 수치"를 정본화하려는 바로 그 결함 클래스가 새 코드에 재발했다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1361-1368` (`⑧ getChain·stop 도 inputData 를 원문으로 통과시킨다` 테스트 바로 위 JSDoc)
  - 상세: 주석은 "**`inputData` 비대상을 네 표면에서 각각 고정한다**" 라고 제목을 달고, 본문에서 "위 ①·② 가 두 표면을 덮고, ⑥-b 가 `nodeExecutions[]` 를 덮는다. 여기서는 나머지 두 반환 경로(`getChain`·`stop`)를 겨눠 **네 표면 전부**를 고정한다" 라고 서술한다. 그런데 그 문장이 직접 열거한 항목을 세면 ①(`findById`) + ②(`findByWorkflow`) = 2, ⑥-b(`nodeExecutions[]`) = 1, `getChain`·`stop` = 2, 합계 **5**다. "네 표면"(4)이라는 결론과 본문이 스스로 나열한 항목 수가 어긋난다. 같은 파일의 자매 표(`outputData`/`error` 는 six-surface 표로 `toResponseExecution`/CHANGELOG/spec 세 곳 모두 정확히 "여섯"으로 일치시켜 놓은 것과 대조된다.
  - 제안: "네 표면" → "다섯 표면"으로 정정하거나, 의도가 "nodeExecutions[] 는 별도 카운트"라면 그 전제를 명시해 나열 순서(①②·⑥-b·getChain·stop)와 결론 숫자가 셈이 맞게 고친다.

- **[INFO]** `plan/in-progress/eia-fanout-and-internal-data-masking.md` 체크리스트의 "B — 회귀 테스트 8개" 항목이 최종 diff 의 실제 테스트 수와 어긋나 보인다(낮은 확신 — 작업 로그 성격의 내부 문서라 여러 라운드에 걸쳐 갱신됐을 수 있음).
  - 위치: `plan/in-progress/eia-fanout-and-internal-data-masking.md` `## 작업 체크리스트` 의 `- [x] B — 회귀 테스트 8개` 항목
  - 상세: 실측하면 `executions.service.spec.ts` 의 `outputData 응답 마스킹` describe 블록에 `it(` 10개(①~⑧, ⑥-b·⑧-b 포함), `background-runs.service.spec.ts` 에 2개(leaky 마스킹 + 마커 보존 캐너리)로 합계 12개다. "8개"는 `inputData` 철회(§철회) 이전, 즉 ⑧·⑧-b·⑥ 마커 캐너리가 추가되기 전 스냅샷 수치로 보인다. 이 plan 문서 자체가 "표를 세 번 고쳤다"며 요약 수치가 가장 늦게 낡는다고 스스로 인정하고 있어(같은 파일 상단), 같은 패턴이 이 항목에도 남아 있을 가능성이 있다.
  - 제안: 필수는 아님(내부 작업 로그, PR 머지 후 archive 대상). 다음 정정 라운드에서 실제 `it(` 개수로 갱신 권장.

- **[INFO]** `sanitize-error-message.ts` 에서 마커 관련 대형 rationale JSDoc 블록이 실제 심볼(`VALUE_MASK_MARKER`) 바로 위가 아니라 그 앞의 별도 한 줄 JSDoc 앞에 놓여 있다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` — `MASKED_MARKERS`/"왜 필요한가" 대형 JSDoc 블록과 `export const VALUE_MASK_MARKER = '***';` 사이에 `/** 값-패턴 마스커가 남기는 마커. */` 한 줄 JSDoc 이 끼어 있다(연속된 두 개의 `/** */` 블록).
  - 상세: 사람이 파일을 위→아래로 읽을 때는 문제 없이 다 보이지만, TSDoc/TypeDoc 류 툴은 통상 "가장 가까운 선행 주석 블록"만 해당 심볼의 공식 문서로 채택한다 — 이 경우 대형 rationale 블록이 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 중 어느 것에도 공식적으로 귀속되지 않고 "떠 있는" 상태가 된다. 현재 저장소에 typedoc 설정이 없어(grep 결과 없음) 즉각적 영향은 없으나, 향후 API 문서 자동 생성을 도입하면 이 블록의 핵심 설명("왜 필요한가")이 생성 문서에서 누락될 수 있다.
  - 제안: 조치 불요(저위험, 사람이 읽는 데는 지장 없음). 참고용 기록.

- **[INFO]** (기존 결함, 이번 diff 밖) `run-results.mdx`/`.en.mdx` 의 **Error** 탭 설명이 마스킹 사실을 언급하지 않는다 — 이번 changeset 은 **Output** 행에만 캐비엇을 추가했다.
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:75` (`{ name: "Error", type: "실패 시", description: "에러 상세 정보를 JSON으로 표시해요." }`), 대응 EN 파일 동일 행
  - 상세: `Execution.error`/`NodeExecution.error` 값-패턴 마스킹은 이번 PR 이전(#1177/#1179)에 이미 적용됐고, `execution-response.dto.ts` 의 `error` Swagger 설명은 이미 마스킹을 명시하고 있다. 반면 유저 가이드의 Error 탭 설명은 여전히 마스킹 사실이 없다. 이번 PR 의 `RESOLUTION.md`(round 2)가 "원 지적보다 좁게, Output 행만" 반영했다고 명시적으로 스코프를 좁힌 결정이라 이번 diff 의 결함은 아니지만, 사용자가 Error 탭에서도 동일하게 `***` 를 보게 되므로 완전성 관점에서 남겨둔다.
  - 제안: 필수 아님 — 별도 후속 항목으로 유저가이드 Error 행에도 같은 캐비엇을 추가하는 것을 고려할 수 있다(이번 PR 범위는 아님).

## 확인했으나 문제 없음 (양호한 지점)

- `CHANGELOG.md` 신규 항목이 코드/spec/테스트와 수치까지 정확히 일치한다 — "여섯 표면", "0.0181→0.0323ms(1.78배)", `inputData` 철회 이유 등 모두 소스로 대조 확인됨.
- `redact-stored-error.ts` 의 신설 `redactStoredDataForResponse` JSDoc, `sanitize-error-message.ts` 의 `deepRedactSecretsPreserving`/`MASKED_MARKERS` JSDoc, `websocket.service.ts` 의 `maskWireEnvelope`/`toFanoutEnvelope` JSDoc 모두 "왜"(rationale)·"언제 결정됐는지"·"무엇과 다른지"를 명시하는 매우 높은 수준의 문서화 — 신규 공개 함수/메서드에 독스트링 누락 없음.
- `execution-response.dto.ts`/`background-run-response.dto.ts` 의 `@ApiPropertyOptional` description 이 마스킹 사실·SoT 링크·마커 보존을 모두 반영해 Swagger 로 그대로 노출됨 — API 문서 갱신 누락 없음.
- 유저 가이드(`run-results.mdx`/`.en.mdx`) Output 행에 한국어/영어 양쪽 모두 마스킹 캐비엇이 대칭적으로 반영됨.
- `spec/5-system/14-external-interaction-api.md`·`6-websocket-protocol.md`·`12-webhook.md` 세 spec 문서 모두 결정 배경(§Rationale), 잔여 갭, 상호 참조 앵커(`#53-민감-헤더-마스킹-ingestion` 등)가 기존 문서의 앵커 규칙과 일치하며 깨진 링크 없음.
- `MASKED_INPUT_DATA_REASON` 상수·`maskIfPresent` 헬퍼의 JSDoc 은 "왜 제네릭을 안 쓰는지", "왜 `| null` 을 타입에 안 적는지" 같은 비직관적 설계 결정까지 근거를 남겨 오독 위험이 낮음.
- CHANGELOG·plan·spec·코드 JSDoc 간 "여섯 표면·세 컬럼" 수치가 4개 이상의 독립 위치에서 일관되게 유지되고 있음(§D 가 목표한 정본화가 실제로 달성됨) — 위에서 지적한 WARNING 은 그 정본화 노력이 새로 추가된 테스트 파일 한 곳에서 아직 스며들지 못한 예외.

## 요약

이번 diff 는 문서화 관점에서 전반적으로 매우 높은 수준이다 — 신규 공개 함수·타입·DTO 필드 전부에 "무엇"뿐 아니라 "왜"·"언제 결정됐는지"·"어떤 대안이 기각됐는지"까지 남기는 JSDoc/spec/CHANGELOG/유저가이드 4중 동기화가 실제로 소스와 대조해 정확함을 확인했다. 유일한 실질적 결함은 새로 추가된 테스트 파일의 JSDoc 주석 하나(`executions.service.spec.ts:1361-1368`)가 스스로 나열한 표면 수(5)와 결론 숫자("네 표면"=4)가 어긋나는 것으로, 이 PR 이 없애려는 "표면 수치 분산" 결함 클래스가 아이러니하게 새 코드에 재발한 사례다. WARNING 은 코드 정확성에 영향은 없고(테스트 자체는 통과) 미래 독자의 오독 위험만 있는 문서 정확성 문제다. 그 밖의 발견(plan 체크리스트 수치, JSDoc 블록 순서, 사전 존재하던 Error 탭 문서 갭)은 전부 INFO 수준의 저위험 참고 사항이다.

## 위험도

LOW
