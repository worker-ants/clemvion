# 유지보수성(Maintainability) Review

## 발견사항

- **[WARNING]** 동일한 서사("자매 넷 중 하나만")가 소스 3곳에 근거리 반복 — 한 곳을 갱신하면 나머지가 stale 해질 위험
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:802`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:301`, `codebase/backend/src/modules/executions/executions.service.spec.ts:853`
  - 상세: 세 지점 모두 "호출부마다 마스킹을 걸면 한 곳씩 빠진다 — 이 저장소가 *'자매 넷 중 하나만'* 으로 반복해 겪은 형태다" 취지의 문장을 각자 손으로 다시 서술한다. 서사 자체(왜 단일 관문이 필요한가)는 값 있는 아키텍처 근거이지만, 세 벌로 복제돼 있어 이 근거가 바뀌거나("자매"가 넷에서 다섯으로 늘거나) 표현이 정정될 때 세 곳을 동시에 못 찾으면 서로 다른 말을 하는 상태로 갈라진다. 이미 이 PR 안에서 "표면 전수" 주장이 세 번 틀렸다는 자기 기록(RESOLUTION.md #7)이 있는데, 그 근거 문장 자체가 단일 SoT 없이 흩어져 있다는 것은 같은 종류의 drift 위험을 문서 차원에서 재현한다.
  - 제안: 정본 서술은 `toResponseExecution`(executions.service.ts:966-975, "왜 둘을 한 함수에 묶나") 한 곳에만 두고, 나머지 두 곳(`background-runs.service.ts`, `.spec.ts`)은 `{@link ExecutionsService.toResponseExecution}` 류 참조 + 그 지점 고유의 차이점(예: `@Roles` 게이트 부재)만 남기는 편이 유지보수 시 단일 갱신 지점을 보장한다.

- **[INFO]** 일부 함수의 JSDoc/주석이 실제 코드 본문보다 4~5배 길고, "현재 계약 설명"과 "리뷰 라운드 서사"가 한 블록에 섞여 있음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `toResponseExecution`(966-985, 6줄 함수에 20줄 JSDoc) · `stop`(792-812, 3줄 함수에 21줄 JSDoc)
  - 상세: 두 블록 모두 (a) 현재 계약("무엇을 하는 함수인가", "반환 타입이 왜 이런가")과 (b) 과거 결함·라운드 참조("종전에는 `as Execution` 로...", "`17_35_49` documentation W2") 서사가 같은 문단에 뒤섞여 있다. `(ai-review 세션ID …)` 인용 자체는 이 저장소의 기존 관용이라 문제 삼지 않되, 그 인용을 뒷받침하는 장문의 "무엇이 왜 잘못됐었는가" 재서술이 함수 하나에 반복되면(같은 이야기가 `toResponseExecution` JSDoc 과 `stop` JSDoc 양쪽에 형태를 바꿔 다시 나온다) 다음에 이 함수를 읽는 사람은 "지금 계약이 뭔가"를 파악하기 위해 리뷰 이력을 함께 소비해야 한다.
  - 제안: "현재 계약"은 함수 JSDoc 에 남기고, "왜 이렇게 됐는가"의 세부 경위(라운드별 발견·수정 경과)는 `CHANGELOG.md`/`plan/complete/eia-terminal-error-sanitize.md` 류 문서로 요약 위임(이미 CHANGELOG 에 유사 내용이 있다 — `CHANGELOG.md` `## Unreleased — 같은 Execution.error...` 항목). 코드 주석은 "재현 가능한 이유"만 1~2문장으로 남기면 향후 diff 가 더 작아진다. 차단 사유는 아님 — 실측한 3라운드 반복 실패를 코드에 새겨 두는 것도 이 저장소가 반복해서 택한 방어책이라(다른 파일들에도 동일 패턴), 이 자체를 결함으로 확정하지는 않는다.

- **[INFO]** 신규 타입 `ResponseExecution`/`ResponseNodeExecution` 이 이 저장소의 기존 명명 관례(접미사 `Dto`)와 다른 접두사(`Response-`) 패턴을 도입
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:77-93`
  - 상세: 같은 파일·모듈에 이미 `ExecutionDto`(`dto/responses/execution-response.dto.ts`), `ExecutionDetailWithTrigger` 같은 "명사+수식" 또는 "명사+Dto" 패턴이 있는데, 이번에 추가된 두 타입만 `Response`+명사 순서를 쓴다. `grep -rn '^export type Response' codebase/backend/src` 로 확인한 결과 저장소 전체에서 이 접두사 패턴은 이 두 타입이 유일하다. 의도(엔티티와 구분되는 "egress 형태"임을 이름으로 드러냄)는 JSDoc 에 잘 설명돼 있어 실용적 문제는 없다.
  - 제안: 차단 사유 아님. 추후 유사 타입을 추가할 일이 있으면 `ExecutionDto` 계열과 이름 패턴을 맞출지(`ExecutionResponseShape` 등) 검토할 여지가 있다는 정도로 기록.

- **[INFO]** `redactStoredErrorForResponse` 의 TS 반환 타입이 실제 런타임에서 보장하는 형태보다 좁게(정직하지 않게) 선언됨 — 문서·테스트로는 고정돼 있으나 타입 시그니처만 보는 소비자는 오해 가능
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35`
  - 상세: 함수 시그니처는 `(...): Record<string, unknown> | null` 이지만, 같은 파일 JSDoc(24행)과 `.spec.ts` 의 "[레거시] 문자열/숫자 통과" 테스트가 명시하듯 실제로는 레거시 jsonb 데이터가 문자열·숫자여도 그 타입 그대로(`as Record<string, unknown>` 캐스트 뒤에서) 돌려준다. 즉 타입 시그니처만 신뢰하고 호출부에서 `.message` 같은 프로퍼티 접근을 컴파일러가 "안전"으로 판정하지만, 레거시 행에서는 런타임 에러(문자열에 `.message` 접근 등)가 날 수 있다. JSDoc 이 "단언을 이 한 자리에 모은다"고 명시적으로 그 트레이드오프를 인지하고 있어 설계 실수는 아니지만, 타입 자체가 그 사실을 코드로 표현하지 못한다.
  - 제안: 차단 사유 아님(호출부가 모두 사전에 이미 object 로 알려진 `Execution.error` 컬럼만 넘기므로 실질 위험은 낮음). 필요하면 반환 타입을 `unknown` 으로 넓혀 호출부에 명시적 좁히기를 강제하는 안을 백로그에 남길 만하다.

- **[INFO]** `executions.service.spec.ts` 의 `buildSingleQB` 헬퍼가 이번 diff 에서 지역 정의 → 최상위 공유 정의로 이동 — 긍정적 변화(중복 제거), 회귀 방지 목적의 기록
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:89-99` (신설 위치), 舊 위치는 `describe('findById → execution_node_log 기반 executionPath 채움')` 내부(삭제됨)
  - 상세: 직전 리뷰 라운드(`17_12_34`)의 RESOLUTION 은 "`buildSingleQB` 가 한 파일에 두 번 정의돼 있으나 이번 diff 의 신규 중복이 아니다" 라고 기록했는데, 이번 라운드에서 신규 `describe('Execution.error 응답 마스킹 — 표면 전수')` 가 같은 헬퍼를 필요로 하면서 자연스럽게 최상위로 승격돼 중복이 해소됐다. 별도 조치 불요 — 확인만.
  - 제안: 없음.

## 요약

이번 PR 의 실질 코드 변경(신규 `redactStoredErrorForResponse` leaf 유틸 + `ExecutionsService`/`BackgroundRunsService` 4개 응답 표면에 대한 egress 마스킹 적용 + `stop`/`stopInternal` 책임 분리)은 유지보수성 관점에서 전반적으로 양호하다. 마스킹 로직을 단일 leaf 함수로 모으고, 엔티티 반환을 명시적으로 `null` 가능성을 인정하는 타입(`ResponseExecution`)으로 좁혀 향후 자매 표면 누락을 컴파일러가 잡을 수 있게 한 설계가 눈에 띄고, `stop`/`stopInternal` 분리로 "TOCTOU 동시성 계약"과 "응답 마스킹 관문"이라는 두 책임이 함수 경계로 깔끔히 갈라졌다. 테스트도 표면별 독립 단언 + 참조 동일성(copy-on-change) 단언 + 캐시-내부 마스킹 단언까지 갖춰 vacuous 가능성을 스스로 차단하려 한 흔적이 뚜렷하다. 다만 여러 라운드에 걸친 리뷰 이력을 코드 주석에 그대로 새겨 넣는 이 저장소의 관용이 이번 파일들에서는 다소 과도하게 누적돼(같은 "자매 넷 중 하나만" 서사가 3곳에 근거리 반복, 일부 함수의 JSDoc 이 본문의 4~5배) 향후 이 파일을 처음 읽는 사람이 "지금의 계약"과 "과거의 경위"를 분리해서 읽어야 하는 부담이 있다 — 차단 사유는 아니지만 서술을 단일 SoT 로 모으는 정리가 다음 라운드에 도움이 될 것이다.

## 위험도

LOW
