# Plan 정합성 검토

## 발견사항

- **[WARNING]** `audit-logs.service.ts` 를 손댔는데 같은 파일에 "다음 touch 시 함께" 로 명시된 주석 오기 정정이 누락됨
  - target 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:128` (HEAD 기준, 주석 `"...예외가 12개+ 특권 CRUD producer 로..."`) — 이번 diff 가 바로 위 `findAll()` 을 `leftJoinAndSelect` → `leftJoin`+`addSelect` 로 고치며 이 파일을 실제로 편집했다(`audit-logs.service.ts` 31줄 변경, `audit-logs.spec.ts` 27줄 변경 — `git diff origin/main...HEAD` 로 확인).
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md:169-171` — "**`clampLabel` 대칭 테스트 + `record()` JSDoc**" 항목 하위에 "부수: `audit-logs.service.ts:105` 주석의 **"12개+"** 를 "12개" 로 통일(7R INFO 6). `codebase/` 편집이라 리뷰 게이트를 리셋하므로 **다음에 이 파일을 손댈 때 함께**." 라고 명시돼 있다. 이 plan 은 target spec `spec/5-system/1-auth.md` frontmatter `pending_plans:` 에 직접 등재된 문서다.
  - 상세: plan 이 건 트리거 조건("이 파일을 다음에 손댈 때")이 이번 PR 에서 실제로 충족됐다(같은 파일의 다른 메서드 `findAll()` 을 감사 로그 유출 수정으로 편집). 그런데 정작 조건이 지목한 주석 오기(`"12개+"` → `"12개"`)는 그대로 남아 있고, plan 문서도 이번 PR 에서 여러 차례 갱신됐음에도(같은 세션에 `spec-draft-nullable-notation-followups.md` 는 3회 갱신) 이 항목만 반영되지 않았다. `record()` JSDoc·`clampLabel` 대칭 테스트 항목도 같은 묶음이라 함께 미이행 상태다.
  - 제안: 사소한 문서 정정이라 이번 PR 에 바로 반영(1줄 diff)하거나, 그럴 수 없다면 `spec-sync-auth-gaps.md` 의 해당 항목에 "이번 touch 에서도 미반영 — 사유" 를 추가해 트리거 조건이 다시 미뤄졌음을 명시해야 한다. 현재 상태로는 다음 사람이 plan 을 읽고 "이미 다음 touch 를 놓쳤다" 는 사실을 알 수 없다.

- **[WARNING]** `ExecutionDto` 스키마-레벨 회귀 가드가 plan 이 지목한 시점에도 여전히 미생성
  - target 위치: `codebase/backend/test/workflow-execution.e2e-spec.ts` (diff +12줄, `assertMatchesContract(mine, executionContract)` 신설) — `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` 에는 대응하는 `*.spec.ts` 가 존재하지 않음(확인: `find .../executions/dto/responses` 결과 `.dto.ts` 1개뿐).
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` "§5.4 drift 배치 — 2단계" 항목 중 "`ExecutionDto` 에는 스키마-레벨 테스트가 아예 없다 (리뷰 2R W4) — ... **2단계 착수 시 `execution-status-response.dto.spec.ts` 패턴으로 신설한다.**"
  - 상세: 이번 diff 가 바로 "§5.4 drift 배치 2단계" 의 실행분(4개 DTO 배선 중 `ExecutionDto`)이며, 같은 plan 항목이 "2단계 착수 시" 만들라고 명시한 `createDocument()` 기반 스키마-레벨 가드(데코레이터+TS 타입이 **동시에** optional 로 되돌아가는 회귀를 잡는 캐너리)는 만들어지지 않았다. 이번에 추가된 `assertMatchesContract` 는 **런타임 응답 vs 현재 스키마** 를 대조하므로, 데코레이터와 TS 타입이 함께 되돌아가면 스키마 자체가 같이 느슨해져 이 e2e 로는 회귀를 못 잡는다 — plan 문서 자신이 그 한계를 이미 서술해 뒀다(`ExecutionStatusDto` 와 다른 점으로 명시).
  - 제안: 이번 PR 범위에서 `execution-response.dto.spec.ts` 를 (기존 `execution-status-response.dto.spec.ts` 패턴으로) 신설하거나, 못 한다면 plan 의 "진행 상태 (2026-09-05)" 표에 "ExecutionDto 배선은 됐으나 스키마-레벨 캐너리는 아직" 을 명시해 남은 갭을 정확히 좁혀야 한다.

## 요약

target 코드 diff(§5.4 응답 DTO 계약 검증자 도입 + 감사 로그 컬럼 유출 수정)는 같은 세션에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 매 커밋마다 동기화하며 진행돼 대부분의 결정·전제·후속 항목이 이미 plan 에 정확히 반영돼 있다(User 엔티티 컬럼 방어 유예, Flyway mixed=true 미결정, ExecutionDto 노출 경로 통합 선행 등은 모두 건드리지 않고 등재만 유지해 정합적이다). 다만 `plan/in-progress/spec-sync-auth-gaps.md`(target spec 의 `pending_plans` 등재 문서)가 "이 파일을 다음에 손댈 때 함께" 로 조건부 지정한 주석 오기 정정이 이번 실제 touch 에서 누락됐고, `spec-draft-nullable-notation-followups.md` 자신이 "2단계 착수 시 신설" 하라고 못 박은 `ExecutionDto` 스키마-레벨 캐너리도 2단계 착수(ExecutionDto 배선)와 함께 오지 않았다 — 둘 다 미해결 결정을 우회한 것은 아니지만, plan 이 스스로 건 트리거 조건이 충족된 시점에 반영되지 않은 "후속 항목 누락" 이다.

## 위험도
MEDIUM
