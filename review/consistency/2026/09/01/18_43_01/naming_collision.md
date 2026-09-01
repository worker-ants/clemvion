# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done)

## 전제 확인

- scope(`spec/5-system`) 델타: **0개 파일**. 이 브랜치는 spec 을 바꾸지 않았다 — 요구사항 ID·
  엔티티/DTO 명·API endpoint·이벤트명·ENV var·spec 파일 경로 어느 것도 spec 문서 레벨에서
  신규 도입되지 않았다.
- 실제 구현 diff(`origin/main...HEAD -- codebase/`): 8개 파일, `execution-engine`/
  `executions` 모듈 한정 (`retry-turn.service.ts`, `ai-turn-orchestrator.service.ts`,
  `execution-engine.service.ts`, `executions.service.ts`, `execution.entity.ts` + 대응
  `*.spec.ts`). 위 워킹트리를 절대경로로 직접 읽어 diff 전문을 확인했다.
- 이 diff 는 새 API endpoint, 새 webhook/queue/SSE 이벤트, 새 ENV var·config key, 새 spec
  파일을 하나도 도입하지 않는다 — 전부 기존 재진입(retry) 종결 경로의 내부 버그 수정이다.
  따라서 위 1~6 관점 중 코드 레벨에서 실제로 검토 대상이 되는 것은 **신규 private 메서드명**
  뿐이다.

## 발견사항

- **[WARNING]** 신규 `markSpawnedRowFailed` 가 기존 `markSpawnedRowFailedOnPublishError` 와
  이름이 거의 겹친다
  - target 신규 식별자: `RetryTurnService.markSpawnedRowFailed(spawnedRow, logContext,
    errorMessage)` — `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:724`
    (신규 private 메서드, `applyRetryLastTurn` 의 parent-execution/node not-found 두 분기를
    DRY 로 묶은 것)
  - 기존 사용처: `ExecutionEngineService.markSpawnedRowFailedOnPublishError` —
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:5387`, 호출부
    `codebase/backend/src/modules/websocket/websocket.gateway.ts:861,891`. WS publish 실패 시
    spawn 된 row 를 닫는, **다른 클래스·다른 트리거 조건**의 기존 메서드.
  - 상세: 두 메서드 모두 "spawn 된 NodeExecution row 를 FAILED 로 마감한다" 는 같은 도메인
    동사구를 쓰지만 트리거·소유 서비스가 다르다(신규는 재조회 실패, 기존은 WS publish 실패).
    이 근접성은 이론적 우려가 아니라 **이번 작업 중 실제로 오판을 낳았다** —
    `plan/in-progress/retry-turn-terminal-guard.md:203-208` 이 부분일치 grep
    (`markSpawnedRowFailed`)이 `markSpawnedRowFailedOnPublishError` 5건과 뒤섞여 "이미 추출
    완료" 로 잘못 판정됐던 이력을 명시적으로 남기고 있다. 코드 자체(`retry-turn.service.ts`
    의 새 JSDoc)는 이 근접 명칭·과거 오판을 교차 참조하지 않는다 — 다음 사람이 같은 grep 함정
    을 다시 밟을 수 있다.
  - 제안: 필수는 아니나 권장 — (a) 신규 메서드 JSDoc 에 "cf. `markSpawnedRowFailedOnPublishError`
    (다른 클래스, WS publish 실패 전용)" 한 줄 교차 참조를 추가하거나, (b) 향후
    `markExecutionFailed` 공용 헬퍼 승격(두 plan 문서가 이미 언급한 후속 작업) 시 두 메서드를
    통합 검토 대상에 명시적으로 포함할 것. 지금 당장 rename 을 요구할 정도는 아니다(각각
    private, 클래스 스코프가 달라 컴파일/런타임 충돌은 없음).

- **[INFO]** 라운드 라벨 `C-4` 가 다른 plan 문서에서 다른 의미로 이미 쓰이고 있다
  - target 신규 식별자: `C-4` — `plan/in-progress/ie-resume-turn-boundary-cancel.md`,
    `plan/in-progress/retry-turn-terminal-guard.md` 양쪽에서 2026-09-01 리뷰 라운드(이번
    changeset)를 가리키는 공유 라벨로 신규 사용.
  - 기존 사용처: `plan/in-progress/spec-draft-avatar-storage-key.md:145` — `C-4. §2.3
    ConfigService 표` (전혀 다른 spec draft 의 gap 표 항목 번호).
  - 상세: 두 target 문서 사이의 `C-4` 는 서로 같은 작업 라운드를 가리키므로 의도적 공유이고
    문제없다. 다만 `spec-draft-avatar-storage-key.md` 의 `C-4` 는 완전히 다른 문서·완전히
    다른 의미(표 항목 번호)다. 이 라벨은 문서 스코프 로컬(각 plan 이 자체적으로 회차·항목을
    번호 매기는 관행)이라 실질적 충돌은 없다 — grep 으로 우연히 섞여도 파일 경로가 즉시
    구분해 준다.
  - 제안: 조치 불필요. 참고로만 기록.

## 요약

이번 changeset 은 `spec/5-system/` 을 전혀 건드리지 않는 코드 전용(execution-engine retry/
cancel 종결 경로) 수정이라, 요구사항 ID·엔티티/DTO 명·API endpoint·이벤트명·ENV var·spec 파일
경로 6개 관점 중 spec 레벨 신규 식별자는 전혀 도입되지 않았다. 코드 레벨에서 유일하게 주목할
점은 신규 private 메서드 `markSpawnedRowFailed` 가 기존 `markSpawnedRowFailedOnPublishError`
와 근접 명명되어, 이번 작업 중 실제로 한 차례 grep 오판(추출 완료로 오판)을 낳았다는 사실이다
— 컴파일/런타임 충돌은 없으나 향후 grep 기반 조사에서 같은 함정이 재발할 수 있어 WARNING 으로
남긴다. 그 외 라운드 라벨 `C-4` 의 문서 간 재사용은 스코프가 로컬이라 실질 위험이 없다(INFO).

## 위험도

LOW
