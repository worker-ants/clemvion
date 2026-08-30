# Cross-Spec 일관성 검토 — `spec-draft-else-branch-transaction.md`

검토 모드: spec draft 검토 (`--spec`)
대상: `plan/in-progress/spec-draft-else-branch-transaction.md` (spec_impact: `spec/5-system/4-execution-engine.md`)

## 방법

target 이 서술하는 코드 변경(`updateExecutionStatus` else 분기 `dataSource.transaction` 래핑)을
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8573-8741` 에서 직접
확인해 target 서술의 정확성을 먼저 검증한 뒤, 같은 사건(tuple-shape 버그·8332d9a20·11곳/3파일)을
다루는 자매 spec 5건(`spec/5-system/4-execution-engine.md` §1.1, `spec/5-system/8-embedding-pipeline.md`
§7.3, `spec/5-system/10-graph-rag.md`, `spec/data-flow/2-auth.md`, `spec/conventions/node-cancellation.md`
§2.4 — 전부 `plan/in-progress/update-returning-tuple-shape.md` 의 "소급 각주" 항목이 이미 완료 처리한
목록)와 target 의 겹침·누락을 대조했다. 코드 확인 결과 target 의 두 서술(§1.1 문장 추가·후속 각주)은
현재 코드(else 분기 트랜잭션 래핑, `updateReturningRows` throw 가 롤백을 유발하는 구조)와 정확히
일치했다 — code-spec 불일치는 없음.

## 발견사항

- **[WARNING]** `spec/data-flow/3-execution.md` §2.1 스키마 매핑 표의 트랜잭션 표기 비대칭
  - target 위치: target 문서 "(1) §1.1 「원자성 보장」 블록 — 문장 추가" (spec_impact 는
    `spec/5-system/4-execution-engine.md` 단일 파일)
  - 충돌 대상: `spec/data-flow/3-execution.md` §2.1 Postgres 매핑 표, `execution | 상태 전이` 행
    (라인 197) — 바로 아래 `execution | park 진입 (durable resume)` 행 (라인 198) 과 대비
  - 상세: 라인 197 행은 else 분기가 쓰는 컬럼(`status, finished_at, duration_ms, output_data,
    error, active_running_ms`)을 정확히 열거하지만 트랜잭션 여부는 언급하지 않는다. 반면 바로
    다음 행(park 진입, `linkedNodeExec` 분기)은 같은 표 안에서 "waiting_for_input 전이와 같은
    트랜잭션 commit (V084/V085/V087)" 이라고 트랜잭션 소속을 명시적으로 밝힌다. 이번 PR 로
    else 분기가 `dataSource.transaction` 안으로 옮겨졌으므로(코드 확인:
    `execution-engine.service.ts:8698-8734`) 두 행의 서술 형식이 이제 비대칭이다 — "park 진입"
    행만 트랜잭션 소속을 밝히고 "상태 전이" 행은 침묵해, data-flow 문서만 읽는 사람은 여전히
    else 분기를 비-트랜잭션 단발 UPDATE 로 오독할 수 있다. `spec/data-flow/3-execution.md` 는
    frontmatter(`pending_plans` 등) 자체가 없어 `update-returning-tuple-shape.md` 의 5-문서
    소급 각주 리뷰 대상에도 애초에 포함되지 않았다 — 이번 target 도 이 문서를 spec_impact 에
    포함하지 않는다.
  - 제안: target 의 spec_impact 에 `spec/data-flow/3-execution.md` §2.1 을 추가하거나, 최소한
    해당 행에 "(2026-08-30 이후 트랜잭션 경유)" 같은 짧은 갱신을 planner 에게 함께 요청할 것.
    CRITICAL 은 아니다 — 두 문서가 서로 모순되는 값을 주장하는 것이 아니라, 한쪽의 최신화가
    다른 쪽에 반영되지 않은 상태이며 실제 동작에는 영향이 없다.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` §9.3 (EIA-RL-04) 크로스레퍼런스 미확인
  - target 위치: target 문서 "(2) 2026-08-30 소급 각주 — 후속 각주 추가"
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` §9.3 "트랜잭션과 발송 순서
    (EIA-RL-04)"
  - 상세: EIA-RL-04 는 "[Spec 실행 엔진 §1.1] 의 원자성을 유지: Execution + NodeExecution 상태
    변경의 단일 트랜잭션 commit 후에만 외부로 이벤트를 emit/dispatch 한다" 며 §1.1 을 직접 인용해
    자신의 계약 근거로 삼는다. target 이 이번에 그 §1.1 서술을 보강하는데, EIA 문서의
    frontmatter `pending_plans` 에는 `update-returning-tuple-shape.md` 도 이번 target plan 도
    등재돼 있지 않다 — EIA 단독 독자는 else 분기가 한때(`8332d9a20` 2026-08-13 ~ 이 PR, 약
    17일) 트랜잭션 밖에 있어 "커밋됐지만 종결 이벤트 미발행" 상태가 이론상 가능했다는 사실을
    알 길이 없다. (target 스스로도 "실제 발동 여부는 확인되지 않았다" 고 적어 두었으므로
    CRITICAL 로 올리지는 않는다.) 덧붙여 같은 §9.3 의 EIA-RL-06 재조정 sweep 은 이 케이스에서
    **토큰만 회수**하고 놓친 종결 이벤트 자체를 재전송하지는 않아, 완전한 백스톱이 아니다.
  - 제안: 필수는 아니나 §1.1 후속 각주에 "EIA §9.3(EIA-RL-04) 이 이 원자성 서술에 의존한다"는
    상호 참조 한 줄을 추가하거나, planner 백로그에 "EIA 재조정 sweep 은 종결 이벤트 자체를
    재전송하지 않는다" 는 알려진 갭으로 남기는 것을 검토.

## 확인했으나 충돌 없음으로 판정한 항목 (참고)

- `spec/conventions/node-cancellation.md` §2.4 의 동일 날짜(2026-08-30) 소급 각주는
  park↔resume 짝 전이(`linkedNodeExec` 분기)와 retry 재진입 종결 경로만 다룬다. 이 두 경로는
  M-3 후속(2026-07-26)부터 이미 `dataSource.transaction` 안에 있었으므로 이번 else-분기 전용
  문제(트랜잭션 밖 단발 UPDATE)의 대상이 아니다 — target 이 이 문서를 spec_impact 에서
  제외한 것은 타당하다.
- `spec/5-system/4-execution-engine.md` §8 "동시 실행 제한" 의 "반대 부호" 소급 각주(admission
  gate)는 별도 advisory-lock 트랜잭션 경로라 else 분기와 무관 — 충돌 없음.
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (코드 변경의 원본 트래커, `spec_impact:
  none`)는 그 자체로 spec 을 못 고치는 `developer` 산출물이라 target(project-planner 산출물)과
  깨끗이 인계된다 — 중복 각주 위험 없음.

## 요약

target 이 서술하는 두 spec 변경(§1.1 원자성 보장 문장 추가, 후속 소급 각주)은 실제 코드
(`execution-engine.service.ts` else 분기의 `dataSource.transaction` 래핑)와 정확히 일치하고,
같은 사건을 다루는 자매 spec(`node-cancellation.md` §2.4, 실행 엔진 §8)과도 모순되지 않는다 —
스코프를 else 분기로 좁게 잡은 target 의 판단은 타당하다. 다만 이 사건의 서술 반경이 이번 target
의 spec_impact(실행 엔진 §1.1 단독) 보다 넓다: (a) `spec/data-flow/3-execution.md` §2.1 의 같은
UPDATE 행이 트랜잭션 표기 없이 남아 인접 행과 비대칭을 이루고, (b) 그 원자성을 직접 인용하는
`spec/5-system/14-external-interaction-api.md` §9.3(EIA-RL-04) 은 이번 갱신 사이클 어디에도
등재되지 않았다. 둘 다 기능을 깨뜨리는 직접 모순은 아니며 문서 동기화 수준의 이슈다.

## 위험도

LOW
