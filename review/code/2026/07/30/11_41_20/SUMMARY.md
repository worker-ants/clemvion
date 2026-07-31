# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 신규 CRITICAL 없음. 14개 reviewer 전원이 직전 라운드(`review/code/2026/07/28/20_32_57`) CRITICAL #1(claim 삽입 위치로 인한 살아있는 delivery 오판)·CRITICAL #2(claim 이 지운 `_retryState` 의 jsonb 부활)의 수정이 코드 대조로 정확히 적용됐음을 독립적으로 확인했다. 다만 documentation reviewer 가 유일하게 MEDIUM 을 매겼고, 그 근거 — (1) `claimSpawnedRetryRow` JSDoc 내부 자기모순(백스톱이 복구를 담당한다는 구 서술 vs 실측으로 반증한 신규 서술이 같은 블록에 공존), (2) 동일 사안이 SoT spec 문서에도 stale 하게 남아 `[SPEC-DRIFT]` 정정이 필요, (3) 이번 diff 가 신설한 "claim 성공 + in-memory 값 부재" 방어 분기가 "이론상 도달 불가능"이라 문서화됐음에도 테스트로 전혀 잠기지 않음(testing reviewer 가 실측 mutation 으로 직접 증명: 해당 블록을 통째로 삭제해도 477/477 전부 GREEN) — 이 세 가지가 겹친다. (3)은 이 파일이 정확히 같은 유형("확신에 찬 불가능 판단")의 결함으로 6라운드에 걸쳐 CRITICAL 을 반복 생산한 이력과 같은 패턴이라 가볍게 볼 수 없다. 셋 다 즉시 기능 차단 사유는 아니지만 후속 조치가 필요하다.

## Critical 발견사항

없음 — 14개 reviewer 전원 CRITICAL 0건.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec Rationale 이 "복구는 `recoverStuckExecutions`(stale RUNNING Execution 재claim) 백스톱이 담당한다"고 무조건 서술하나, 이번 PR 자신의 실측(코드 JSDoc + plan 등재)이 "discard 후 Execution 이 이미 terminal(`failed`) 이면 그 백스톱은 이 케이스에 닿지 않는다"를 반증했다 — 코드/plan 은 이미 정정됐는데 spec 문구만 낡았다 (requirement·documentation 독립 수렴) | `spec/5-system/4-execution-engine.md:1387-1389/1391` vs `retry-turn.service.ts:502-513` | 코드/plan 변경 불필요 — project-planner 턴으로 spec 문단을 "이 2차 claim 경로는 그 백스톱이 닿지 않아 discard 시 RUNNING orphan row 가 남을 수 있다(실측 확인, 후속: retry-turn-terminal-guard.md #15)"로 정정 |
| 2 | 문서화 | `claimSpawnedRetryRow` JSDoc 안에서 "백스톱이 복구를 담당한다"(구 문단, `b351731f0`에서 이관)와 "실측 결과 그 백스톱은 닿지 않는다"(신규 문단, 이번 커밋 추가)가 같은 JSDoc 블록 안에 상호 모순으로 공존 — 앞부분만 읽으면 오해 소지 | `retry-turn.service.ts:484-487` vs `:502-513` | 484-487 문단을 "형제 continuation 4종은 백스톱 커버되나 이 2차 claim 경로는 닿지 않음 — 상세는 아래 참조"로 정정해 두 문단이 같은 결론을 가리키게 함 |
| 3 | 아키텍처/문서화 | 재진입 절차 JSDoc 2곳이 이미 제거된 `runAiConversationLoop` 를 여전히 협력 컴포넌트로 서술 — 실제 구현은 `processAiResumeTurn`(AiTurnOrchestrator 경유, turn-park 단발 처리 + `PARK_RELEASED` re-park). 같은 파일 인접 줄(`:438-439`)과 자매 파일(`ai-turn-orchestrator.service.ts:186`)은 이미 정확히 서술 중이라 자기모순. 이번 diff 가 바로 그 리스트를 편집(번호 재부여)하고도 문구를 고치지 않음 (architecture·documentation 독립 수렴) | `retry-turn.service.ts:122-123`, `:272-273` | 두 곳 모두 `processAiResumeTurn`/`PARK_RELEASED` re-park 흐름으로 정정 — 이번에 편집한 줄 바로 옆이라 저비용 |
| 4 | 테스트/요구사항 | 이번 커밋이 신설한 "claim 성공(`affected:1`) + in-memory `_retryState` 부재" 방어 분기 — 스스로 "이론상 도달 불가능"이라 문서화 — 가 어떤 테스트로도 검증되지 않음. testing reviewer 가 실측 mutation(해당 블록 337-348행 전체 삭제 → `retry-turn.service.spec.ts`+`execution-engine.service.spec.ts` 477/477 여전히 GREEN → 원복 재확인)으로 커버리지 부재를 직접 증명. requirement reviewer 도 독립적으로 동일 갭 지적 | `retry-turn.service.ts:337-348` | `applyRetryLastTurn — early-exit guards` describe 에 `createQueryBuilder().execute()`→`{affected:1}` + `inputData:{}`(키 없음) 조합 케이스 추가 — discard, FAILED 미마킹, `save()` 미호출을 단언 |
| 5 | 아키텍처 | `claimSpawnedRetryRow`(DB `input_data` 원자 제거)와 `spawnedRow.inputData`(in-memory) 사이의 동기화 불변식이 타입/캡슐화가 아니라 "이 delete 줄을 지우거나 순서를 바꾸지 말 것"이라는 프로즈 관례에만 의존 — 정확히 이 결함 클래스(CRITICAL #2)의 재발 가능 경로가 구조적으로 열려 있음 | `retry-turn.service.ts:520-534`(정의), 호출부 `:324`,`:337-348`,`:356` | `claimSpawnedRetryRow` 가 `spawnedRow`(또는 `inputData`)를 인자로 받아 성공 시 직접 mutate 하거나, `{claimed: boolean; retryState?: RetryState}` 형태로 이미 동기화된 결과를 반환하도록 구조 변경 검토 |
| 6 | 부작용 | CRITICAL #2 방어용 `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 claim 직후로 앞당겨지면서, 같은 메서드 뒤쪽 `NODE_STARTED` WS 이벤트의 `input` 페이로드가 (이전엔 `_retryState` 를 포함 → 이제 사실상 `{}`) 조용히 바뀜 — 커밋 메시지·주석 어디에도 이 페이로드 변경이 언급되지 않고 잠그는 테스트도 없음. spec 의 "internal 필드 비노출" 원칙과는 방향이 부합해 유해 가능성은 낮으나, frontend 가 `payload.input` 을 `NodeExecution.inputData` 로 그대로 스토어에 반영하는 경로가 존재해 실행 상세 UI 에 노출될 수 있음 | `retry-turn.service.ts:356` vs `:432`(emitNode 호출); frontend 참고 `use-execution-events.ts:729,779,872,977` | (1) 의도된 변경이면 `emitNode` 호출 인자에서 `input` 이 `_retryState` 를 포함하지 않음을 단언하는 회귀 테스트 추가, (2) JSDoc 에 "이 delete 는 NODE_STARTED payload 에도 영향" 한 줄 명시, (3) 근본적으로는 `emitNode` 직전에 `_`-prefix internal 필드를 명시적으로 strip 하는 방어 고려 |
| 7 | 유지보수성 | `applyRetryLastTurn` 이 claim 블록 추출(`claimSpawnedRetryRow`)에도 불구하고 claim 성공 후 필수가 된 새 판정 2개가 추가되며 순 길이가 184→188줄로 오히려 늘고 순환 복잡도 ~10(early-return 가드 7개 + try/catch/finally) 유지 — `complexity`/`max-lines-per-function` eslint 룰 부재로 정적 게이트 없음 | `retry-turn.service.ts:281-468`(메서드 전체), 신규 가드 시퀀스 `:308-356` | `:308-356`(in-memory retryState 확보 → claim → 판정 → in-memory 동기화) 를 `claimAndSyncRetryState(spawnedRow): Promise<RetryState \| null>` 로 추출 — 본문이 "null 이면 discard, 아니면 계속" 한 줄로 축약되고 각 판정이 독립 단위테스트 가능 |
| 8 | 유지보수성 | execution/node not-found 처리 블록 2곳이 로그·에러 메시지 문구만 다르고 `logger.error→status=FAILED→error 세팅→finishedAt→save()→return` 5단계 구조가 완전히 동일하게 반복 | `retry-turn.service.ts:364-375`(execution not found), `:376-387`(node not found) | `markSpawnedRowFailed(spawnedRow, message): Promise<void>` 헬퍼로 공통 5줄 추출, 호출부는 메시지만 다르게 전달 |
| 9 | 의존성 | CRITICAL #2 수정 근거 주석이 특정 patch 버전(`typeorm@0.3.30`)의 비공개(undocumented) 내부 jsonb-diff 동작을 명시 인용하지만, `package.json` 은 이를 caret 범위(`^0.3.28`)로만 고정 — `pnpm update` 등 통상 작업만으로 상위 패치로 조용히 이동 시 그 근거 서술이 stale 해질 수 있음(실제 방어 코드 자체는 버전 불문 안전한 일반 원칙을 구현하므로 기능 회귀 위험은 아님) | `retry-turn.service.ts:392`(주석)/`:396`(실제 delete) vs `package.json:88` | 주석을 "0.3.30 기준 확인됨, 이후 버전에서도 이 delete 는 안전을 위해 유지"로 버전-불문 방어임을 명확히 하거나, typeorm 업그레이드 체크리스트에 "jsonb diff 관찰 재검증" 항목 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/DB | SQL 인젝션 벡터 없음 — raw SQL 에 보간되는 값은 컴파일타임 상수(`RETRY_STATE_KEY`) 뿐이고 가변 값(`id`,`status`)은 전부 바인드 파라미터 (security·database 독립 확인 수렴) | `retry-turn.service.ts:42,210,217,526,531` | 조치 불요 — 상수가 향후 동적 값으로 바뀌면 파라미터 바인딩 전환 필요함을 docstring 에 한 줄 명시 권장 |
| 2 | 보안 | 인증/인가는 이 파일 밖 WS gateway(`getCommandAuthContext`/`verifyExecutionOwnership`)에서 이미 강제 — 리뷰 대상 파일 자체의 인가 누락 아님, `applyRetryLastTurn` 은 서버 자체 발행 BullMQ job 으로만 트리거돼 외부 입력 재노출 없음 | `websocket.gateway.ts:806,826` | 조치 불요 |
| 3 | 보안 | `failRetryExecution` 의 원시 예외 메시지 노출(`execution.error`, WS `EXECUTION_FAILED`)은 이 저장소 전역에서 일관된 기존 설계(워크플로 소유자 자신에게만 실패 사유 노출) — 이번 diff 신규 아님 | `retry-turn.service.ts:908,915,934-943` | 조치 불요(범위 밖); 별도 감사가 필요하면 "downstream SDK 예외가 민감정보를 담아 전파하는 사례" 를 별도 항목으로 등재 고려 |
| 4 | 보안/동시성/DB | orphan RUNNING row 백스톱 갭(claim discard 후 spawn row 가 RUNNING 으로 영구 잔류 가능)은 이미 `plan/in-progress/retry-turn-terminal-guard.md` #15(P2)로 추적 중 — 공격자가 임의로 유발 가능한 표면 아님, "한 번도 seed 안 된 진짜 corruption" 은 구조적으로 발생하지 않음 (security·concurrency·database 3중 수렴) | `retry-turn.service.ts:502-513` | 별도 조치 불요(이미 추적) |
| 5 | 성능 | `applyRetryLastTurn` 의 3회 순차 DB 왕복(SELECT→UPDATE claim→병렬 SELECT×2)은 CAS 정합성상 불가피하며, claim 실패 시 조기 반환으로 낭비 없음 | `retry-turn.service.ts:285,324,360-363` | 조치 불요 — 저빈도 사용자 트리거 경로라 왕복 절감의 실익 낮음 |
| 6 | 성능 | 이번 재배치는 성능 중립~소폭 개선 — 구 방어 분기의 `save()` 호출 1회가 오히려 제거됨, 신규 `delete` 는 O(1) in-memory 연산 | `retry-turn.service.ts:337-348` | 조치 불요 |
| 7 | 아키텍처 | (이월, 이번 diff 범위 밖) 생성자 `forwardRef` 근거 주석이 C-1 후속④ 이후 실제 provider 배선과 불일치 — 직전 라운드(`20_32_57` #8)부터 low-severity 로 이월된 항목, 이번 diff 미포함 | `retry-turn.service.ts:88-90` | 후속 턴에서 주석을 현재 배선에 맞게 갱신(긴급성 낮음) |
| 8 | 아키텍처 | JSONB 원자 conditional-consume 패턴이 클래스 내 2곳(`retryLastTurn` 트랜잭션 consume vs `claimSpawnedRetryRow`)에 유사 형태로 존재 — 컬럼·트랜잭션 필요 여부가 달라 완전 통합은 간단치 않음 | `retry-turn.service.ts:204-224` vs `:520-534` | 3번째 유사 사례 추가 시 공통 헬퍼 추출 고려, 현재는 조치 불요 |
| 9 | 요구사항 | `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 두 줄 위 `seededInput = spawnedRow.inputData ?? {}` 와 달리 nullish 가드 없이 직접 역참조 — claim 성공 시 구조적으로 non-null 이 보장돼 실질 위험은 낮음 | `retry-turn.service.ts:356` (cf. `:312`) | (선택) `?? {}` 관례에 맞춰 방어 통일, 우선순위 낮음 |
| 10 | 유지보수성 | "자체 멱등 가드" 히스토리 서사가 서비스/spec/processor 3곳에 문구만 바꿔 반복 — 직전 라운드 지적 이후에도 미조치 | `retry-turn.service.ts:297-300`, `retry-turn.service.spec.ts:372-374` (+ 범위 밖 `continuation-execution.processor.ts:89-92`) | 정본 한 곳만 남기고 나머지는 "정본 참조" 로 축약 |
| 11 | 유지보수성 | 테스트 query-builder mock 보일러플레이트가 9곳으로 증가 — 직전 라운드 "테스트 전용, 우선순위 낮음" 판정 이후 미조치 | `retry-turn.service.spec.ts:389,414,448,494,1006,1057,1088,1164,1224` | 공통 팩토리 헬퍼(`mockQueryBuilder(overrides?)`) 도입 고려 |
| 12 | 유지보수성 | `claimSpawnedRetryRow` JSDoc 의 조건 설명 순서가 실제 `.andWhere()` 체이닝 순서와 어긋남(SQL `AND` 교환법칙상 동작 무영향) — 직전 라운드부터 미조치 | `retry-turn.service.ts:477-482` vs `:528-531` | 주석 순서를 코드 순서(status 먼저)에 맞춰 통일 |
| 13 | 유지보수성 | 매직 넘버 — 초→ms 변환 `1000` 하드코딩. `RETRY_STATE_KEY` 상수화 관례와 비대칭이나 보편적으로 이해되는 변환 계수라 실질 위험 낮음 | `retry-turn.service.ts:190` | (선택) `MS_PER_SECOND` 상수화 |
| 14 | 유지보수성 | 동일 개념(재진입 시작 시 로드된 Execution 엔티티)의 파라미터 이름이 메서드마다 `execution`/`savedExecution` 으로 갈림(자매 메서드 `resumeFromCheckpoint` 명명을 따른 것으로 보임) | `retry-turn.service.ts:556,684,744` | 우선순위 낮음 — 향후 신규 파라미터 도입 시 `execution` 계열로 통일 권장 |
| 15 | 문서화 | `CHANGELOG.md` 가 이번 라운드(`b351731f0`/`414550a1d`)를 반영하지 않음 — 개발자 스스로 W12 로 인지, "다음 문서-정리 턴" 으로 이월 | `CHANGELOG.md` (Unreleased 섹션) | 이미 추적 중, 급하지 않음 |
| 16 | 문서화 | 문서 부채 항목(W10 stale 참조/W11 processor 서술/W12 CHANGELOG)이 plan 의 번호 있는 우선순위 표가 아니라 날짜 있는 산문 블록에만 기록 — 이 프로젝트의 과거 "산문 유실" 패턴과 동일 | `plan/in-progress/retry-turn-terminal-guard.md` | W10~W12 를 P3 항목(#18~#20)으로 표에 번호 부여해 durable 하게 추적 |
| 17 | 문서화 | `claimSpawnedRetryRow` 는 호출 순서가 치명적인 단일-호출부 메서드인데도, 자매 private 종결 헬퍼(`completeRetryExecution`/`failRetryExecution`)가 쓰는 `@internal`+경고 태그 관례가 없음 | `retry-turn.service.ts:470-519` | 선택 사항 — `@internal` 태그 추가 고려 |
| 18 | 의존성 | `RETRY_STATE_KEY` 는 파일-scope private(프로젝트 전역 SSOT 아님, `_retryState` 리터럴이 다른 12개+ 파일에 여전히 존재) — JSDoc 이 스코프를 이 파일로 명시 한정하므로 갭이 아니라 PR 이 선언한 의도된 범위 | `retry-turn.service.ts:42` | 조치 불요 — 프로젝트 전역 통합이 필요하면 별도 plan 항목으로 |
| 19 | 데이터베이스 | not-found 방어 분기 2곳이 여전히 무가드 full-entity `save()` 사용 — 이번 diff 범위 밖 pre-existing 패턴, 트리거 조건(참조 Execution/Node 자체가 DB 에 없음) 자체가 사실상 발생하지 않는 edge case | `retry-turn.service.ts:364-374,376-386` | 후속 정리 시 `id+status='running'` 조건부 UPDATE(= `claimSpawnedRetryRow` 와 동일 패턴)로 통일 고려 |
| 20 | 범위 | 이번 커밋의 모든 변경이 직전 `RESOLUTION.md` 처분표와 1:1 대응 — 포맷팅-only 변경, 무관 리팩토링, 미사용 임포트, 설정 파일 변경 없음. 같은 커밋의 3개 부수 파일(통합 스펙, plan 후속 등재, RESOLUTION.md)도 동일 처분표의 필연적 산출물 | 전체 diff | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 인젝션·인증 이상 없음(WS gateway 단 확인); CRITICAL #1/#2 수정 코드대조 검증; orphan 백스톱 갭은 기추적 |
| performance | NONE | 신규 루프·DB 왕복 없음; claim 재배치는 성능 중립~소폭 개선(`save()` 1회 감소) |
| architecture | LOW | `runAiConversationLoop` stale JSDoc 2곳; claim↔in-memory 동기화 불변식이 프로즈 관례에만 의존(구조적 미강제) |
| requirement | LOW | [SPEC-DRIFT] 백스톱 서술 stale; 신규 방어 분기(337-348) 미검증; 41/41+436/436 재실행·eslint 재확인으로 코드 정합 검증 |
| scope | NONE | 전 변경이 RESOLUTION.md 처분표와 1:1 대응, 스코프 이탈·포맷팅-only 변경 없음 |
| side_effect | LOW | claim 직후 `delete` 이동으로 `NODE_STARTED` WS `input` 페이로드가 조용히 `{}` 로 변경, 미테스트 |
| maintainability | LOW | `applyRetryLastTurn` 길이(188줄)·복잡도(~10) 미개선; execution/node not-found 블록 중복 |
| testing | LOW | 실측 mutation 으로 "claim 성공+retryState 부재" 방어 분기 미검증을 직접 증명(블록 삭제해도 477/477 GREEN) |
| documentation | MEDIUM | `claimSpawnedRetryRow` JSDoc 자기모순(백스톱 서술); SoT spec stale; 문서부채(W10~W12) 산문-only 기록 |
| dependency | LOW | 신규 외부 의존성 0건; CRITICAL #2 근거가 typeorm 0.3.30 특정 패치 비공개 동작 인용, caret 범위(`^0.3.28`)라 향후 drift 여지 |
| database | LOW | claim SQL 은 건전한 CAS; not-found 분기 무가드 save() 잔존(범위밖, 극저확률); Postgres 실통합검증 부재(기추적) |
| concurrency | LOW | CRITICAL #1/#2 독립 재검증 결과 정확; async/await·finalizeGuarded 이상 없음; 잔여 갭은 기추적, 신규 없음 |
| api_contract | NONE | 시그니처·반환 스키마·에러코드·WS payload·URL·인증 전부 불변 — 계약 변경 없음 |
| user_guide_sync | NONE | doc-sync-matrix 18개 trigger 전수 대조, 매칭 0건; `run-results.mdx` 서술 사용자 시맨틱 불변 |

## 발견 없는 에이전트

- **performance** — 성능 관점 조치 필요 항목 없음(NONE)
- **scope** — 변경 범위 이탈 없음(NONE)
- **api_contract** — API 계약 변경 없음, 해당 없음(NONE)
- **user_guide_sync** — 매트릭스 trigger 매칭 0건, 해당 없음(NONE)

## 권장 조치사항

1. `claimSpawnedRetryRow` JSDoc 의 자기모순(백스톱 커버리지 구서술 vs 신규 반증 서술, `:484-487` vs `:502-513`)을 정정해 같은 결론을 가리키게 한다 — 향후 유지보수자 오독 방지 최우선 항목.
2. `applyRetryLastTurn — early-exit guards` 에 "claim 성공(`affected:1`) + in-memory `_retryState` 부재" 조합 테스트 케이스를 추가한다(`:337-348`) — 이 파일이 같은 유형의 "확신에 찬 불가능 판단"으로 CRITICAL 을 반복 생산해 온 이력을 고려할 때 문서화만으로는 불충분.
3. `project-planner` 턴으로 `spec/5-system/4-execution-engine.md:1387-1391` 의 백스톱 커버리지 서술을 실측 결과(이 2차 claim 경로는 그 백스톱이 닿지 않음)에 맞게 정정한다(SPEC-DRIFT, 코드/plan 변경 불필요).
4. `runAiConversationLoop` stale 참조 2곳(`:122-123`, `:272-273`)을 `processAiResumeTurn`/`PARK_RELEASED` re-park 흐름으로 정정한다 — 이번 diff 가 인접 줄을 이미 편집했던 저비용 기회.
5. `NODE_STARTED` WS 이벤트의 `input` 페이로드 변경(`:356` delete 로 인한 부수효과)이 의도된 것인지 확인 후, 의도라면 `emitNode` 인자 단언 테스트로 잠그고 JSDoc 에 한 줄 명시한다.
6. `applyRetryLastTurn` 의 신규 가드 시퀀스(`:308-356`)를 `claimAndSyncRetryState` 헬퍼로 추출해 메서드 길이·복잡도를 완화하고, execution/node not-found 중복 블록(`:364-387`)은 `markSpawnedRowFailed` 헬퍼로 통합한다.
7. 문서 부채 항목(W10~W12, CHANGELOG 미갱신 포함)을 `plan/in-progress/retry-turn-terminal-guard.md` 의 번호 있는 우선순위 표에 등재해(#18~#20) 산문-only 기록으로 인한 유실 위험을 제거한다.
8. (여유 있을 때) typeorm 버전 특정 주석 일반화, `delete` nullish 가드 통일, 매직넘버 `1000` 상수화 등 나머지 INFO 항목 정리.

## 라우터 결정

- `routing=skipped` — 라우터 미사용, 전체 14개 reviewer 실행(fallback 아님, 이번 라운드 자체가 전원 실행 대상).
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
  - **제외**: 없음
  - **강제 포함(router_safety) 화이트리스트**: maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨(누락 없음, forced 화이트리스트 미이행 사례 없음)