# 변경 범위(Scope) Review

## 발견사항

- **[INFO]** workspace 는 write API 제공, workflow 는 read-only(직접 DB 조작만 e2e 검증)로 비대칭
  - 위치: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`, `codebase/backend/src/modules/workspaces/workspaces.service.ts`, `codebase/backend/test/execution-concurrency-cap.e2e-spec.ts` (`createCapWorkflow` 의 `db.query(UPDATE workflow SET settings = ...)`)
  - 상세: `resolveConcurrencyCap` 은 workspace/workflow 양쪽 settings 를 동일하게 소비하도록 설계돼 있으나, 이번 PR 은 workspace 쪽에만 `maxConcurrentExecutions` DTO 필드 + service 병합 로직(write API)을 추가했다. workflow 쪽은 e2e 테스트에서 "per-workflow cap=1 (DB 직접 — settings write API 는 별도 테스트 범위)" 주석으로 명시적으로 스코프 아웃되어 있어, 기능 자체가 절반만 사용자 노출된 상태다.
  - 제안: 의도된 단계적 스코프(우선 workspace 만 노출, workflow 설정 API 는 후속)라면 이대로 병합해도 괜찰음 — 다만 spec/PR 설명에 "workflow 레벨 cap 설정 API 는 후속" 이 명시돼 있는지 확인 권장. 코드 변경 자체를 되돌릴 필요는 없음(범위 축소이지 확장이 아니므로 CRITICAL 아님).

- **[INFO]** `runExecution` 시그니처에 `alreadyRunning` 파라미터 추가 — 기존 호출부 영향 범위 확인 필요
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (`private async runExecution(savedExecution, input, alreadyRunning = false)`)
  - 상세: 기존 메서드 시그니처 변경이지만 기본값(`false`)으로 하위 호환을 유지했고, admission gate 를 경유하지 않는 기존 진입점(executeSync/executeInline 등)은 동작이 그대로 보존된다. 의도된 최소 변경이며 범위 이탈 아님 — 참고용 기록.
  - 제안: 별도 조치 불요. (범위 검증 목적상 기록만 남김)

이 외 리뷰 대상 12개 파일(`.env.example`, `V104` 마이그레이션, `execution-engine.service{.ts,.spec.ts}`, `execution-limits{.ts,.spec.ts}`, `execution.entity.ts`, workspace DTO/service, 신규 e2e spec, `docker-compose.e2e.yml`, `spec/5-system/4-execution-engine.md`)는 전부 "PR2b — §8 admission gate enforcement(동시성 cap + 큐 대기 5분 cancel)" 라는 단일 목적에 직접 연결되어 있다. `git diff origin/main...HEAD --stat` 결과(12 files, 673 insertions, 10 deletions)가 리뷰 payload 파일 목록과 정확히 일치하며, 관련 없는 파일·포맷팅 전용 변경·불필요한 리팩토링·미사용 임포트는 발견되지 않았다. `spec/5-system/4-execution-engine.md` 수정도 직전 커밋(`5eabbfc0d` — spec 정책 정의)에서 이미 "PR2b(정책 정의 완료, enforcement 구현 후속)"로 예고된 후속 구현이 커밋 완료됐음을 반영하는 최소 갱신(불릿 1개 보강)에 그친다. `.env.example` 추가는 선례(`EXECUTION_MAX_ACTIVE_RUNNING_MS`)와 동일한 패턴을 따르는 필수 동기화이며, DTO 의 `IsInt`/`Min` 임포트도 실제 사용된다.

## 요약

이번 변경은 사전에 spec 에 정의돼 있던 "§8 동시성 cap admission gate(PR2b)" 정책의 enforcement 구현 하나로 수렴하며, 12개 파일 모두 이 목적과 직접 연결된다. workspace 전용 write API 추가로 workflow 레벨 설정 노출과 비대칭이 생기지만 이는 축소된 스코프(후속 위임)로 보이고 문서화도 돼 있어 범위 이탈이라기보다 단계적 구현으로 판단된다. 포맷팅·주석·임포트 등 실질 변경과 무관한 잡음은 발견되지 않았다.

## 위험도

LOW
