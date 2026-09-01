# 부작용(Side Effect) 리뷰 — retry-ie-residuals-c4a1b2

## 발견사항

- **[INFO]** `markNodeCancelled` 실패의 예외 재분류가 다운스트림 이벤트/재시도 경로를 바꾼다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-436` (`assertLinkedTransitionApplied`)
  - 상세: 종전에는 `markNodeCancelled` 가 reject 하면 그 원본 예외(임의 타입)가 그대로 상위로 전파됐다. 이번 변경으로 그 예외는 `catch` 에서 흡수·로그만 되고, 함수는 **항상** `throw new ExecutionCancelledError(...)` (436행, try/catch 블록 밖·if 블록 밖이라 무조건 실행됨— 직접 소스 확인)로 종결한다. 저장소 전역에서 `ExecutionCancelledError` 는 `instanceof` 분기로 취소/실패를 가르는 데 광범위하게 쓰인다(`execution-engine.service.ts` 8곳 이상 — `grep ExecutionCancelledError` 로 확인). 즉 이 catch 는 "예외를 관측 가능하게 만든다"는 문서화된 의도를 넘어 **예외의 런타임 타입 자체를 결정론적으로 재분류**한다 — 마킹 DB 쓰기가 실패해도 그 예외가 상위 BullMQ job-failure 경로로 올라가지 못하고 항상 "취소 성공" 경로로 흡수된다는 뜻이다. plan(`ie-resume-turn-boundary-cancel.md` C-4)과 SUMMARY(INFO 4)가 "BullMQ 재시도를 통한 자가 치유 경로가 닫힌다"고 이미 인지·수용했고, 취소 분류 유지가 이 항목의 요지이므로 **의도된 설계**로 판단한다. 다만 사후 관측(로그) 외에 잔류 non-terminal 짝 row 를 걷어내는 별도 백스톱이 있는지는 이 diff 범위 밖이라 확인하지 못했다.
  - 제안: 별도 조치 불요(문서화·테스트 완료 확인). 배포 후 "마킹 실패 로그" 발생 빈도와 잔류 non-terminal `NodeExecution` 발생 여부를 관측 대상으로만 유지할 것.

- **[INFO]** 같은 catch 블록이 DB 예외와 비-DB(프로그래밍 오류) 예외를 구분하지 않는다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:416` (`} catch (err) {`)
  - 상세: `catch (err)` 가 `Error` 타입 여부만 확인(`err instanceof Error ? err.message : String(err)`)하고 어떤 예외든 흡수한다. `markNodeCancelled` 내부의 로직 결함(예: null 역참조)도 이 경로를 타면 "마킹 실패"로만 로그되고 `ExecutionCancelledError` 로 삼켜져, 진짜 버그 신호가 취소 흐름과 구분 없이 사라질 수 있다. 이미 SUMMARY INFO 5 로 인지된 항목과 동일하다.
  - 제안: 조치 불요(낮은 우선순위, 이미 후속 후보로 등재됨). 신규 결함 아님.

- **[INFO]** `Execution.error` 엔티티 타입 확장(`| null`)은 인터페이스 변경이지만 검증상 안전하다
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`
  - 상세: `Record<string, unknown>` → `Record<string, unknown> | null` 로 넓어져 이 엔티티를 소비하는 모든 코드가 컴파일 타임에 `null` 케이스를 처리해야 하는 공개 인터페이스 변경이다. `codebase/backend/src/modules/execution-engine/{execution-engine,retry-turn}.service.ts` 내 `execution.error` 참조 전수를 직접 grep 확인한 결과 전부 `== null` / `?.` / `?? null` 등으로 이미 null-safe 하게 작성돼 있어 런타임 회귀는 없다. DB 컬럼은 애초에 `nullable: true` 였으므로 스키마/마이그레이션 영향도 없다(순수 타입 정정).
  - 제안: 조치 불요. `executions.service.ts` 의 JSDoc 이 이 타입 변경에 맞춰 정정된 것도 소스에서 직접 확인했다(`error` 만 분리 서술).

- **[INFO]** 신규 헬퍼 추출(`markSpawnedRowFailed`, `prepareSuccessTermination`)은 시그니처·동작 동치성을 유지한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:386,394,722-733,749-754,781,957`
  - 상세: 소스를 직접 열어 대조한 결과, 두 not-found 분기가 호출하는 `markSpawnedRowFailed` 는 원래 각 분기가 갖던 로그 문구(`${logContext} — marking spawned row FAILED to avoid zombie`)·필드 대입 순서(status→error→finishedAt→save)를 그대로 보존한다. `prepareSuccessTermination` 은 두 호출부(781행 `completeRetryExecution`, 957행 자연 종결)에서 기존 `finishedAt`/`durationMs` 세팅에 `error = null` 대입만 추가됐다 — private 메서드라 외부 시그니처 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** 자연 종결 경로에서 `error=null` 인메모리 대입이 guarded UPDATE 실패(동시 cancel 선점) 시에도 무조건 먼저 실행된다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:957-967`
  - 상세: `prepareSuccessTermination(savedExecution)` 이 `driver.updateExecutionStatus(...)` 호출보다 먼저 in-place 로 `error`/`finishedAt`/`durationMs` 를 세팅한다. `completed === false` (guarded UPDATE 0행 매칭)면 이벤트 emit 은 skip 되지만, in-memory 객체는 이미 변이된 채로 남는다 — DB 는 실제로 갱신되지 않았으므로 그 시점의 in-memory 값과 DB 값이 갈린다. 다만 이는 이번 diff 가 새로 만든 패턴이 아니라 `finishedAt`/`durationMs` 에 대해 이미 존재하던 선행 세팅-후-guarded-write 패턴을 `error` 로 확장한 것이며, `savedExecution` 은 함수 종료 후 더 참조되지 않아 실질 영향은 없다.
  - 제안: 조치 불요(기존 패턴과 동일 리스크 등급).

- **[INFO]** `review/code/2026/09/01/17_55_50/**` 14개 신규 파일은 이전 리뷰 라운드 산출물을 저장소에 커밋하는 것으로, 저장소 관례(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)와 일치하는 예상된 파일시스템 부작용이다.
  - 위치: `review/code/2026/09/01/17_55_50/` 하위 전체(신규 파일 14개)
  - 상세: 코드에 의한 런타임 파일시스템 부작용이 아니라 리뷰 프로세스 산출물의 버전관리 커밋이며, 소스 코드/전역 상태에는 영향이 없다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/{ie-resume-turn-boundary-cancel,retry-turn-terminal-guard}.md` 의 `worktree:` frontmatter 값 변경은 `plan_guard` 훅 매칭에만 영향을 주는 메타데이터 변경으로, 코드 실행 부작용은 없다.
  - 위치: `plan/in-progress/ie-resume-turn-boundary-cancel.md:3`, `plan/in-progress/retry-turn-terminal-guard.md:3`
  - 상세: 두 파일 모두 주석으로 변경 사유(머지된 이전 worktree 값 유지 시 가드 무장 해제)를 명시했다. 저장소 관례에 부합하며 신규 부작용 아님.
  - 제안: 조치 불요.

전역 변수 도입/수정, 환경 변수 읽기·쓰기, 신규 네트워크 호출은 diff 전체에서 발견되지 않았다. `logger.warn`/`logger.error` 호출 3건(신규 2건 + 조건부 1건)은 모두 로깅 부작용으로 기능에 영향을 주지 않으며, 대응 테스트(`execution-engine.service.spec.ts:3791-3832`, `ai-turn-orchestrator.service.spec.ts:267-312`)로 뮤테이션 검증까지 확인했다. 뮤테이션 없이 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 확인 불필요 — 읽기 전용 조사만 수행).

## 요약
이번 diff 는 취소/retry 종결 경로의 잔여 관측성·정합성 결함을 닫는 방어적 리팩터로, 부작용 관점에서 새로운 CRITICAL/WARNING 급 결함은 발견하지 못했다. `markNodeCancelled` 실패 시 예외 타입을 결정론적으로 `ExecutionCancelledError` 로 재분류하는 것은 저장소 전역에서 취소/실패 분기의 근거로 널리 쓰이는 예외 타입을 바꾸는 실질적인 "이벤트 라우팅" 변화이지만, 이는 이 changeset 의 핵심 의도이며 plan/SUMMARY 에 트레이드오프(BullMQ 자가치유 경로 상실)로 이미 인지·수용되어 있다. `Execution.error` 엔티티 타입 확장은 공개 인터페이스 변경이지만 모든 소비 지점이 이미 null-safe 함을 직접 확인했다. 헬퍼 추출(`markSpawnedRowFailed`, `prepareSuccessTermination`)은 기존 동작을 문자 그대로 보존하며, 신규 로깅 부작용은 전부 테스트로 뮤테이션 검증돼 있다. 새로 추가된 review 산출물·plan frontmatter 변경은 저장소 관례상 예상된 파일시스템 부작용이다.

## 위험도
LOW
