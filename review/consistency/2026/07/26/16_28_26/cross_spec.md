# Cross-Spec 일관성 검토 — linear-cancel-mechanism

검토 대상: `spec/conventions/` (target), 특히 `node-cancellation.md` 과 diff 로 새로 생긴
`ExecutionEngineService.assertExecutionNotCancelled()` 노드 경계 가드(5곳) + `ExecutionCancelledError`
재throw(6곳)가 `spec/5-system/4-execution-engine.md` · `spec/5-system/6-websocket-protocol.md` ·
`spec/1-data-model.md` · `spec/data-flow/3-execution.md` 와 정합하는지.

> 참고: 프롬프트 페이로드(`_prompts/cross_spec.md`, 4397줄)는 컨텍스트 예산 때문에 `node-cancellation.md`
> 본문 자체를 포함해 `5-system/4-execution-engine.md`·`6-websocket-protocol.md`·`data-flow/3-execution.md` 등
> 116개 관련 파일 본문을 생략했다(§"컨텍스트 예산 초과로 생략된 파일" 목록). 아래 검토는 그 안내에 따라
> 해당 파일들을 워킹트리에서 직접 `Read`/`git diff`/`grep` 로 열어 확인한 결과다.

## 발견사항

### [WARNING] 알려진 잔여 (a) — `execution.node.cancelled` 이중 생산자 이슈에 `plan/` 위임 기록이 없다

- target 위치: `spec/conventions/node-cancellation.md` frontmatter `pending_plans:` (현재
  `node-cancellation-residual-signal-propagation.md` 1건만 등재)
- 충돌 대상: `spec/5-system/6-websocket-protocol.md:186` (`execution.node.cancelled` payload 서술)
- 상세: 이번 PR 이 추가한 `executeNode` 의 `ExecutionCancelledError` 분기(`markNodeCancelled`,
  `errorEnvelope` 없음)가 기존 `isAbortError` 분기와 나란히 `NODE_CANCELLED` 를 emit 하는 **두 번째
  생산자**가 됐고, 이 경로는 `error` 필드를 payload 에 싣지 않는다. `6-websocket-protocol.md:186` 은
  "생산자: Parallel `cancel-others-on-fail` / 사용자 cancel" 만 나열하고 `error` 를 항상 존재하는
  것으로 서술해 이제 어긋난다. 이 이슈 자체는 이번 검토 지시에서 "이미 알려진 잔여" 로 명시됐고,
  실측(런타임 영향 없음 — 소비자 전부 `error` optional 처리)도 코드 리뷰 5R(`review/code/2026/07/26/15_30_00/side_effect.md` §(c))에서
  이미 확인됐다. 문제는 **그 확인이 어디에도 지속 추적 형태로 남지 않았다는 것**이다 — `review/code/2026/07/26/15_30_00`
  INFO → `15_56_53/RESOLUTION.md` "이월 백로그" → `16_20_52/scope.md` "이월 백로그" 로 3라운드 연속
  review 산출물 안에서만 구두 전달됐을 뿐, `plan/in-progress/*.md` 파일이나 `node-cancellation.md` 의
  `pending_plans:` 목록에는 한 번도 등재되지 않았다. 자매 항목 (b)(아래)는 정확히 같은 라운드에서 나와
  `spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임 (2026-07-26 #6)" 섹션으로
  persist 됐는데, (a)만 review 산출물에 머물러 있다. `review/**` 는 시점 스냅샷이라 이 저장소 관례상
  지속 추적 SoT 가 아니다(`plan/in-progress/`가 SoT) — 다음 세션이 review 산출물을 다시 훑지 않으면
  이 항목은 조용히 유실될 수 있다.
- 제안: `spec-update-node-cancellation-shutdown-classification.md` 에 "추가 위임 (2026-07-26 #6)" 과
  형제로 §7 절을 하나 더 추가하거나(제안 문구는 `review/code/2026/07/26/15_30_00/side_effect.md` §(c)
  말미에 이미 초안 수준으로 있다 — `error` optional화 + 생산자 목록에 "§2.3 노드-경계 cancel 가드"
  추가), 최소한 `node-cancellation-residual-signal-propagation.md` 의 백로그 절에 항목으로 옮겨 적어
  `plan/` SoT 안에 persist 할 것. developer 권한 밖이라 이번 PR 범위는 아니다.

### [WARNING] 신규 — `cancelled` NodeExecution 상태의 "생산자" 서술이 4곳에서 중복·모두 동일하게 낡았다

- target 위치: 없음(코드 diff 만 있고 spec 은 미수정 — 이번 PR 이 spec 을 건드리지 않았으므로 target
  문서 자체와의 직접 충돌은 아니나, 새 코드가 관련 spec 4곳의 기존 서술을 동시에 stale 하게 만들었다)
- 충돌 대상 (동일 문구가 각기 다른 파일에 복제돼 있고 전부 새 생산자를 빠뜨림):
  - `spec/conventions/node-cancellation.md §2.3/§5.1/§6` — planner 위임 (b) 대상 (아래 참조, 이미 알려짐)
  - `spec/5-system/4-execution-engine.md:114` (§1.2 NodeExecution 상태 표, `cancelled` 행) — "생산자:
    Parallel `cancel-others-on-fail` / 사용자 cancel / (향후) Workflow timeout" 로 node-cancellation
    §5 를 "SoT" 로 인용하며 그대로 미러링
  - `spec/1-data-model.md:546` (NodeExecution.status enum 설명) — "`cancelled` = 외부 `abortSignal`
    로 노드 외부 I/O 가 중단되어 핸들러가 throw 한 `AbortError` 를 엔진이 분류한 상태" — 역시 handler-throw
    단일 경로만 서술
  - `spec/data-flow/3-execution.md:282` (§3.2 `node_execution.status` mermaid 상태 다이어그램) —
    `running --> cancelled: abortSignal (AbortError) — cancel-others-on-fail / 사용자 cancel` 엣지
    레이블. 바로 다음 줄(:289)이 "위 다이어그램은 **엔진 코드 경로의 관찰 요약**이다" 라고 명시적으로
    코드-정확성을 자임하는데, 이제 `running → cancelled` 를 만드는 세 번째 경로(§2.3 노드 경계
    Execution-cancel 재확인 가드, `ExecutionCancelledError`)가 diagram 에 빠져 있다.
- 상세: 이번 diff 로 `NodeExecution.status = cancelled` 를 만드는 경로가 하나 늘었다 —
  `assertExecutionNotCancelled()` → `ExecutionCancelledError` → `executeNode` catch → `markNodeCancelled`.
  이 사실 자체는 planner 위임 (b)(`spec-update-node-cancellation-shutdown-classification.md` "추가
  위임 (2026-07-26 #6)")가 이미 포착해 `node-cancellation.md` §2.3/§5.1/§6 갱신 제안까지 구체적으로
  남겼다. 그러나 그 제안의 "제안 변경" 목록(1~5번)은 **`node-cancellation.md` 자기 자신만** 갱신
  대상으로 삼고, 정확히 같은 문구를 인용·미러링하는 위 세 파일(`execution-engine.md:114` ·
  `1-data-model.md:546` · `data-flow/3-execution.md:282`)은 spec_impact/제안 범위에 없다. `node-cancellation.md`
  가 "SoT" 라고 자임하는 것과 별개로, 이 세 파일은 그 정의를 **문자 그대로 복제**해 두고 있어서
  SoT 만 고치면 나머지 셋은 자동으로 정합해지는 구조가 아니다 — planner 가 (b) 를 이행할 때 이
  3곳을 함께 갱신하지 않으면, 문서 간 새로운 불일치(SoT 는 최신, 미러 3곳은 구식)가 그 즉시 생긴다.
- 제안: `spec-update-node-cancellation-shutdown-classification.md` "추가 위임 (2026-07-26 #6)" 의
  spec_impact 에 `spec/5-system/4-execution-engine.md` · `spec/1-data-model.md` ·
  `spec/data-flow/3-execution.md` 세 파일을 추가하고, "제안 변경" 목록에 각 파일의 해당 라인(위 3곳)
  갱신을 명시적 스텝으로 넣을 것. 특히 `data-flow/3-execution.md` 는 mermaid 다이어그램이라 새 엣지를
  아예 빠뜨리면(라벨만 갱신) 다이어그램 자체는 여전히 `running --> cancelled` 화살표 1개만 그려서
  "무엇이 이 전이를 유발하는가" 를 여전히 불완전하게 서술하게 된다 — 라벨에 세 번째 원인을 추가하는
  것으로 충분(엣지 추가 불요, 같은 전이의 세 번째 사유일 뿐).

### [INFO] 알려진 잔여 (b) — 위임 기록 확인됨, 조치 불요

- target 위치: `spec/conventions/node-cancellation.md` §2.3 / §5.1 / §6 (미수정 — 예상대로)
- 충돌 대상: 없음(확인용 항목)
- 상세: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 "추가 위임
  (2026-07-26 #6)" 섹션에 §2.3 새 bullet · §5.1 새 단락 · §6 새 표 행 · `frontmatter.code:` 추가까지
  구체적 문구로 이미 제안돼 있고, `node-cancellation-residual-signal-propagation.md` 의 "선형 경로
  cancel 전파" 항목에서도 동일 위임을 교차 참조한다. `spec/` 쓰기 권한 밖이라는 것도 Rationale 에
  명시돼 있다 — 이번 검토 지시가 요구한 "위임 기록 존재 확인" 조건을 충족한다. 추가 조치 불요.

### [INFO] `node-cancellation.md` frontmatter `pending_plans:` 이 이번 PR 이 만든 신규 위임을 아직 반영하지 않음

- target 위치: `spec/conventions/node-cancellation.md:12-13`
- 충돌 대상: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
- 상세: `pending_plans:` 는 현재 `node-cancellation-residual-signal-propagation.md` 하나만 가리킨다.
  `spec-update-node-cancellation-shutdown-classification.md` 도 같은 문서(§2.3/§5.1/§6)를 갱신
  대기 중이므로 이 목록에 함께 있는 편이 `spec-status-lifecycle` 가드(§(b)/(c), 다른 검토 파일이
  이미 다루는 영역)의 완결성과 맞다. developer 범위 밖이라 이번 PR 이 놓친 것이 아니라 애초에
  planner 소관 — 낮은 우선순위 참고용으로만 남긴다(다른 관점(convention/frontmatter lifecycle)의
  체커가 이미 다루고 있다면 중복 조치 불요).

## 다른 점검 관점 — 이상 없음

- **데이터 모델 충돌**: 이번 diff 는 신규 엔티티·필드를 추가하지 않는다 (`NodeExecutionStatus.CANCELLED`
  enum 은 기존 V069 마이그레이션에서 이미 존재). `ExecutionCancelledError` 는 `extends Error`(sentinel,
  `code` 미부여)로 `error-codes.md` 등록 대상이 아니다 — `ExecutionTimeLimitError` 가 같은 이유로
  `ExecutionError` 계층 밖에 의도적으로 남은 선례와 동형.
- **API 계약 충돌**: `POST /executions/:id/stop` 등 REST 표면 변경 없음. WS 이벤트 타입(`execution.node.cancelled`)
  도 신설이 아니라 기존 타입의 두 번째 발행 지점만 늘었다 (payload shape 자체는 위 WARNING 항목 참조).
- **요구사항 ID 충돌**: 신규 요구사항 ID 부여 없음.
- **상태 전이 충돌**: `NodeExecution: running → cancelled` 전이 자체(허용 여부)는 기존과 동일 —
  다만 그 전이의 **원인 서술**이 4곳에서 낡았다(위 WARNING). `Execution` 레벨 상태 다이어그램
  (`data-flow/3-execution.md:245-257`)은 영향 없음 — Stop 버튼이 Execution 을 `cancelled` 로 만드는
  경로 자체는 이번 PR 이전과 동일하고, 이번 PR 은 그 취소가 "하류 노드 dispatch 를 실제로 멈추는가"
  라는 **효과의 전파**만 고쳤다.
- **권한·RBAC 모델 충돌**: 해당 없음(RBAC 미변경).
- **계층 책임 충돌**: `ExecutionEngineService` 가 노드 경계마다 Execution 행을 재조회하는 책임이
  새로 생겼는데, 이를 금지하거나 다른 컴포넌트(예: 별도 supervisor)의 책임으로 명문화한 기존 spec
  Rationale 은 찾지 못했다 — 오히려 `node-cancellation.md §2.3` 워크플로 타임아웃 항목이 이미 "다음
  노드 경계에서 판정" 패턴을 전제하고 있어 구조적으로 이질적이지 않다. "Stop 버튼은 DB row 만
  바꾸고 진행 중 루프는 건드리지 않는다" 는 식의 **명시적 반대 결정**을 서술한 Rationale 도 없었다 —
  이번 결함은 미문서화된 gap 이었지 문서화된 결정의 번복이 아니다(`node-cancellation-residual-signal-propagation.md`
  의 자체 서술과 일치).
- **컨테이너/Parallel spec 정합**: `spec/4-nodes/1-logic/10-parallel.md` · `0-common.md` 는 취소
  메커니즘을 `node-cancellation.md` 참조로만 서술("메커니즘: node-cancellation.md")하고 값을 복제하지
  않으므로, SoT 갱신만으로 정합이 유지된다 — 위 WARNING 대상 3파일과 달리 이 두 파일은 안전하다.

## 요약

이번 diff 자체는 `spec/` 를 건드리지 않아 target 문서(`spec/conventions/`)와의 직접 충돌은 없다.
다만 코드가 assert 하는 새 사실("`NodeExecution.status=cancelled` 를 만드는 세 번째 원인이 생겼다")이
`node-cancellation.md` 뿐 아니라 `execution-engine.md §1.2` · `1-data-model.md §NodeExecution` ·
`data-flow/3-execution.md §3.2 다이어그램` 세 곳에 문자 그대로 복제돼 있어, 이미 확인된 두 잔여
((a) websocket-protocol.md 이중 생산자, (b) node-cancellation.md §2.3/§5.1/§6 갱신) 중 (b) 를 planner 가
이행해도 나머지 미러 3곳은 자동으로 정합해지지 않는다는 점이 새로 드러났다. (a) 는 review 산출물에만
남아 있고 `plan/` SoT 에는 없어 유실 위험이 있다. 두 건 모두 CRITICAL 은 아니다 — 런타임 영향이 없고
(소비자 전부 방어적), planner 턴에서 spec_impact 목록만 넓히면 해소되는 문서 동기화 이슈다.

## 위험도

LOW
