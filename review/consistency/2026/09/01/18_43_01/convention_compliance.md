# 정식 규약 준수 검토

## 검토 범위 확인

`spec/5-system/` 자체는 이번 diff 로 0 파일 변경(정상 — 코드 전용 PR). 실제 diff 는
`codebase/backend/src/modules/execution-engine/{retry-turn,execution-engine,ai-turn-orchestrator}.service.ts`
· `codebase/backend/src/modules/executions/{entities/execution.entity,executions.service}.ts`
+ 대응 `.spec.ts` + `plan/in-progress/{retry-turn-terminal-guard,ie-resume-turn-boundary-cancel}.md`
+ `CHANGELOG.md` (8 파일 / 612줄, `git diff origin/main...HEAD` 로 워킹트리에서 직접 확인).
이 중 정식 규약(`spec/conventions/**`)이 실체적으로 적용되는 유일한 문서는
[`node-cancellation.md`](../../../../../spec/conventions/node-cancellation.md)(프롬프트에 전문 포함) —
diff 가 §2.3/§2.4/§5.1 이 규정하는 cancellation 분류·terminal 가드 메커니즘을 직접 건드린다.
그 외 조립본에 절단된 conventions(swagger·error-codes·node-output·raw-query-results 등)는
필요한 대목만 워킹트리에서 직접 `Read` 로 확인했다.

## 발견사항

- **[INFO]** `node-cancellation.md` `pending_plans:` 가 관련 활성 plan 2건을 누락 (사전 존재, 본 diff 미기인)
  - target 위치: 해당 없음 (target=`spec/5-system/`, 이 발견은 `spec/conventions/node-cancellation.md` frontmatter)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` R-5 (`status: partial` 의 `pending_plans:` 는 spec→plan 역방향 링크 의무 — "spec 가 자기를 책임지는 plan 을 가리킴")
  - 상세: `node-cancellation.md` frontmatter `pending_plans:` 는
    `node-cancellation-residual-signal-propagation.md` · `update-returning-tuple-shape.md` 두
    개만 등재한다. 그러나 이번 diff 가 수정한 `plan/in-progress/retry-turn-terminal-guard.md`
    와 `plan/in-progress/ie-resume-turn-boundary-cancel.md` 는 둘 다 자신의 frontmatter
    `spec_impact:` 에 `spec/conventions/node-cancellation.md` 를 명시하고, 본문에도 §2.4 terminal
    가드·§5.1 cancelled 분류에 대한 미해결 항목(`markExecutionFailed` 공용 헬퍼 승격,
    "두 흐름이 한 실행을 동시에 COMPLETED 로 몰 수 있는가" 등)이 아직 열려 있다. 또한
    `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 도 동일하게
    `spec_impact: spec/conventions/node-cancellation.md` 를 선언하지만 `pending_plans:` 에
    없다. R-5 가 명시하는 실패 모드("spec 가 plan 을 가리키지 않아 빈 약속으로 영구 누락")와
    같은 모양의 비대칭이다. 다만 이 드리프트는 이번 PR 이전부터 있었고(diff 는 두 plan 파일의
    `worktree:` 필드·처분 로그만 갱신, `spec_impact`/node-cancellation.md 자체는 미변경) 강제
    가드(`spec-pending-plan-existence.test.ts`)는 "등재된 경로의 실존" 만 검사하고
    "spec_impact 를 선언한 모든 plan 의 역등재" 는 검사하지 않아 build 를 깨지 않는다.
  - 제안: 차단 사유는 아니다. 다음에 `node-cancellation.md` 를 만지는 planner 턴에서
    `pending_plans:` 를 실제 활성 plan 3~4건과 동기화할 것을 권고(`project-planner` 소관,
    본 changeset 의 developer 권한 밖).

## 세부 확인 (규약 준수 — 위반 아님, 근거로 남김)

- **명명 규약**: 신설 private 메서드 `markSpawnedRowFailed`(retry-turn.service.ts) ·
  `prepareSuccessTermination`(동일 파일)은 기존 캐멀케이스 private 메서드 관례를 따른다.
  새 API endpoint·DTO·enum 값 도입 없음.
- **출력 포맷 규약**: `spawnedRow.error = { message: errorMessage }` 형태는 이번 diff 가 **새로
  도입한 것이 아니라 기존 두 분기(진입부 not-found 처리)를 문자 그대로 헬퍼로 추출**한 것 —
  `git diff` 상 제거된 두 블록과 신설 헬퍼 본문이 동일 리터럴이다. `Execution.error` 를
  성공 종결 시 `null` 로 명시 비우는 처방(`prepareSuccessTermination`)은 DB 컬럼이 이미
  `nullable: true` 였던 것을 TS 엔티티 타입이 못 따라가고 있던 것을 바로잡은 것으로,
  `spec/conventions/raw-query-results.md`·`migrations.md` 어느 쪽도 요구하는 마이그레이션을
  유발하지 않는다(스키마 불변, 타입 어노테이션만 정정 — diff 에 신규 `.query()` raw 호출
  없음, `codebase/backend/src` 전수 grep 으로 확인).
- **§5.1 cancelled 분류 불변식**: `ai-turn-orchestrator.service.ts` 의 신규 try/catch(마킹
  실패를 흡수하고 `ExecutionCancelledError` 는 항상 던짐)는 `node-cancellation.md` §5.1
  "두 sentinel 이 같은 상태로 귀결된다" / §2.4 "취소가 지연되는 게 아니라 소실된다" 는 이미
  문서화된 불변식을 **강화**하는 방향이며 역행하지 않는다.
- **API 문서 규약**: 이번 diff 는 controller/DTO/Swagger 데코레이터를 건드리지 않는다
  (`executions.controller.ts` 는 diff 밖). `spec/conventions/swagger.md` 대상 표면 변경 없음.
- **plan frontmatter (`spec_impact` 리스트 형식)**: 두 plan 파일 모두 `spec_impact:` 가 YAML
  리스트(`- spec/...`)로 정상 유지되고, `worktree:` 필드는 현재 워크트리 basename
  (`retry-ie-residuals-c4a1b2`)과 일치하도록 이번 diff 에서 정확히 갱신됐다(직전 값이 이미
  머지된 worktree 였다는 사유를 주석으로 남김) — `plan-lifecycle`/Gate C 요구를 준수.
- **금지 항목**: 저장소 전체 raw `.query()` 신규 호출·신규 마이그레이션·신규 에러 코드 문자열
  도입 없음 — `spec/conventions/error-codes.md` §1(의미 기반 명명)·§2(rename 금지) 대상 표면
  변경 없음.

## 요약

이번 PR 은 `spec/5-system/` 문서를 전혀 건드리지 않는 코드 전용 changeset 이며, 실질적으로
적용되는 유일한 정식 규약(`node-cancellation.md`)의 §2.3/§2.4/§5.1 문서화된 cancellation 분류·
terminal 가드 불변식을 위반하지 않고 오히려 그 불변식(취소가 FAILED 로 오분류되지 않아야 한다)
을 강화하는 방향으로 수정됐다. 신규 API·DTO·에러 코드·마이그레이션·명명 패턴 도입이 없어 명명/
출력 포맷/API 문서 규약 표면과 무관하다. 유일하게 짚을 점은 `node-cancellation.md`
`pending_plans:` 가 `spec_impact` 를 선언한 활성 plan 3건 중 일부를 역등재하지 않은
사전 존재 드리프트(R-5 취지 위반 소지)이며, 이는 이번 diff 가 만든 것이 아니고 build 가드도
잡지 않으므로 INFO 로만 남긴다.

## 위험도

NONE
