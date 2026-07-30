# 정식 규약 준수 검토 — spec/5-system/ (impl-done, diff-base origin/main)

## 검토 방법 메모

`_prompts/convention_compliance.md` 페이로드는 컨텍스트 예산 초과로 이번 PR 의 실제 diff 대상인
`spec/5-system/4-execution-engine.md`(+78/-6) 본문을 포함하지 않았다(프롬프트 내 "⚠️ 컨텍스트
예산 초과로 생략된 파일 18개" 목록에 명시). 대신 무관계 파일(`1-auth.md`/`10-graph-rag.md`/
`11-mcp-client.md`)만 전문이 실려 있었다. `spec/conventions/**` 쪽도 마찬가지로 `error-codes.md`·
`node-output.md`·`node-cancellation.md`·`execution-context.md`·`swagger.md`·`migrations.md`·
`spec-impl-evidence.md` 등 알파벳 뒷순번 핵심 규약 파일이 전부 "생략 258개" 목록에 들어가 있었다.

지시대로 페이로드 부재를 근거로 삼지 않고, 워킹트리를 절대경로로 직접 Read 하고
`git diff origin/main -- spec/5-system/ spec/conventions/ codebase/backend/src/modules/execution-engine/`
로 실제 target 문서·코드·관련 정식 규약 7개 파일을 모두 열람해 검토했다.

**이번 PR 의 target 문서 변경 범위**: `spec/5-system/4-execution-engine.md`(+78/-6),
`spec/5-system/6-websocket-protocol.md`(+1/-1) — 그리고 scope 밖이지만 같은 커밋 계열인
`spec/4-nodes/3-ai/1-ai-agent.md`(+6). 핵심 내용: (1) Execution 상태 전이표에 신규 opt-in
전이 `failed → waiting_for_input`(`reparkAiResumeTurn`) 추가, (2) `retry_last_turn` spawn row
에 대한 2차 원자 claim(`claimSpawnedRetryRow`, `inputData._retryState` 조건부 UPDATE) Rationale
신설.

## 발견사항

- **[WARNING]** `node-output.md` §4.2.1 "영속 위치" 레지스트리가 `_retryState` 의 신규 2차
  용법(spawn row `inputData`)을 반영하지 못함
  - target 위치: `spec/5-system/4-execution-engine.md` 신설 Rationale
    `### retry 재진입의 원자 claim — spawn 단계 원자성만으로는 불충분하다 (§7.5 대칭, 2026-07-28)`
    (1357행), 특히 1378행 "`applyRetryLastTurn` 이 spawn row 의 `inputData._retryState` 키를
    조건부 UPDATE 로 원자 소비한다" + 1381~1384행 SQL 블록
    (`UPDATE node_execution SET input_data = input_data - '_retryState' WHERE id = :id AND
    status = 'running' AND jsonb_exists(input_data, '_retryState')`).
  - 위반 규약: `spec/conventions/node-output.md` Principle 4.2.1 "보존 예외 —
    `_resumeCheckpoint` / `_retryState`" 표 (200~212행). 208행이 `_retryState` 의 "영속 위치"를
    **`NodeExecution.outputData._retryState` (DB JSONB) 단 하나**로 못박는다. Principle 0(20행)도
    "5필드 외 top-level 위치를 갖는다"고만 서술해 outputData 한정을 전제한다.
  - 상세: target 은 이번 라운드에 `_retryState` 라는 동일 키 리터럴을 **원본(failed) row 의
    `outputData`**(기존, 컨벤션이 규정하는 용법)뿐 아니라 **spawn 된 새 row 의 `inputData`**
    (신규, 이번 diff 가 Rationale 절을 신설해 처음으로 명문화한 "2차 delivery-claim 마커" 용도)
    양쪽에서 재사용한다. 코드(`retry-turn.service.ts`) 는 `RETRY_STATE_KEY` 단일 상수 +
    상세 JSDoc으로 이 이원화를 의식적으로 관리하고 있어(리터럴 drift 위험은 이미 이전 ai-review
    라운드가 지적·고정함) 실무적 혼선 위험은 낮지만, node-output.md 를 "internal 필드가 어디에
    영속되는가"의 단일 진실로 참조하는 독자는 여전히 "`_retryState` 는 `outputData` 에만
    존재한다"고 오인할 수 있다 — 그 전제로 예컨대 `NodeExecution.inputData` 를 스캔·마스킹하는
    별도 코드(로그 redaction, export 등)를 작성하면 이 두 번째 위치를 놓칠 수 있다. 등급을
    WARNING 으로 매기는 이유는 CRITICAL 처럼 다른 시스템의 invariant 를 깨는 것은 아니지만,
    "규약과 실제 사이 거리"가 이번 diff 로 인해 처음으로 실체화됐고 의도된 변경이므로 규약
    갱신이 적절한 사안이기 때문이다(등급 기준의 WARNING 정의와 정확히 부합).
    (참고: 같은 세션의 `cross_spec` 체커가 동일 사실을 독립적으로 발견해 INFO 로 낮게 매겼다 —
    코드가 이미 관리 중이라는 같은 근거. 시각(spec-vs-spec 이 아니라 spec-vs-conventions)이 다른
    본 체커는 "규약 문서의 단일 진실성"에 더 무게를 둬 WARNING 으로 판정한다.)
  - 제안: `node-output.md` §4.2.1 표의 `_retryState` 행에 각주를 추가 — "단,
    `execution.retry_last_turn` spawn row 는 동일 키를 `inputData._retryState` 로 재사용해
    2차 delivery-claim 마커(원자 소비, [실행 엔진 §Rationale](../5-system/4-execution-engine.md#rationale)
    'retry 재진입의 원자 claim' 참조)로 쓴다 — 개념적으로 별개 계층(엔진 claim-tracking vs
    핸들러 output 보존)이며 영속 위치가 다르다." 규약 갱신이 부담스러우면 최소한 "영속 위치"
    열을 "`NodeExecution.outputData._retryState` (원본 row, DB JSONB) — spawn row 의
    `inputData._retryState` 2차 용법은 [실행 엔진 §Rationale] 참조"로 바꿔 단일 위치 단언을
    완화한다.

## 축별 준수 확인 (위반 없음)

- **명명 규약**: 이번 diff 가 다루는 식별자(`retry_last_turn`, `RESUME_FAILED`,
  `RETRY_STATE_NOT_FOUND`, `EXECUTION_FAILED` WS 이벤트명 등)는 모두 기존에 정착된 이름을
  그대로 재사용했고, `error-codes.md` §1(의미 기반 명명)·§2(rename 금지 정책)가 요구하는 신규
  코드 신설도 없다(신규 에러 코드 0건). `RETRY_STATE_KEY`/`claimSpawnedRetryRow`/
  `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 등은 구현 내부 식별자로 spec/conventions/** 의 명명
  규율 적용 대상 밖이다.
- **출력 포맷 규약**: `NODE_STARTED` WS 이벤트의 `input` 페이로드에서 `_retryState` 를 delete
  하도록 고친 변경(및 이를 잠그는 회귀 테스트)은 오히려 `node-output.md` Principle 0 의
  "internal 필드 비노출" 원칙에 **부합하는 강화**다. 새로운 에러 코드·응답 envelope 변경은 없어
  `error-codes.md`/`3-error-handling.md` 봉투 규약과 충돌 없음.
- **문서 구조 규약**: `4-execution-engine.md`/`6-websocket-protocol.md` 모두 frontmatter
  (`id`/`status: partial`/`code:`/`pending_plans:`) + `## Overview` + 번호 본문(§1~§11) +
  `## Rationale` 3섹션 구조를 그대로 유지한다. 신설 `pending_plans` 항목
  `plan/in-progress/retry-turn-terminal-guard.md` 는 실존하며(`spec-pending-plan-existence.test.ts`
  대상 통과), 그 plan 의 `spec_impact:` 도 YAML 리스트로 `spec/5-system/4-execution-engine.md`·
  `spec/conventions/node-cancellation.md` 를 정확히 가리킨다(Gate C 형식 준수). 신설 Rationale
  하위 heading(`### retry 재진입의 원자 claim — ...`)도 기존 Rationale 섹션의 "주제명 + 괄호
  근거/날짜" 명명 패턴과 일관적이다.
- **API 문서 규약**: 이번 diff 는 controller/DTO 파일을 전혀 건드리지 않는다
  (`git diff --stat origin/main -- codebase/backend/src/modules/execution-engine/` 확인 결과
  `*.controller.ts`/`*.dto.ts` 0건) — `swagger.md` 의 데코레이터·DTO 패턴 검토 대상 자체가
  없음(N/A).
- **금지 항목**: `node-output.md` §1.1.4(`output.view` 판별자 금지)·§5(port 오용 금지)·
  §7(spread-echo 금지)·§8.1(이중 래핑 금지) 등 명시적 금지 패턴에 해당하는 코드 변경은
  이번 diff 범위에 없음. `migrations.md` 대상 마이그레이션 파일도 신설되지 않았다(JSONB 키
  조작만으로 스키마 변경을 회피 — 오히려 migrations.md 가 권장하는 "회피 가능하면 회피" 방향과
  정합).

## 요약

이번 PR 이 변경한 두 target 문서(`4-execution-engine.md`, `6-websocket-protocol.md`)는
frontmatter·3섹션 구조·명명·에러코드·API 문서 규약 축에서는 `spec/conventions/**` 위반이
없다 — 신규 에러 코드·엔드포인트·DTO 변경이 없고, 금지 패턴을 답습하지도 않는다. 유일한
소견은 `node-output.md` §4.2.1 의 `_retryState` "영속 위치" 레지스트리가 이번 diff 로 처음
명문화된 두 번째 용법(spawn row `inputData` 상의 2차 delivery-claim 마커)을 아직 반영하지
못한다는 점이다 — CRITICAL 급 invariant 위반은 아니고 코드 차원에서는 이미 단일 상수 +
JSDoc 으로 관리되고 있으나, 규약 문서를 "internal 필드가 어디에 영속되는가"의 단일 진실로
참조하는 후속 작업(로그 redaction, export, 신규 케이스 판단 등)이 오도될 여지가 있어 규약
갱신을 권고한다.

## 위험도

LOW
