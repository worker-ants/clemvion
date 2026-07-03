### 발견사항

- **[INFO]** 에러 메시지가 그대로 DB(`Execution.error.message`)에 저장되고 WS 이벤트로 브로드캐스트됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `failFirstSegmentSetup` (라인 2005-2039), 특히 `errMessage = error instanceof Error ? error.message : String(error)` → `row.error = { message: errMessage }` → `this.eventEmitter.emitExecution(... EXECUTION_FAILED, { status, error: errMessage })`
  - 상세: `runExecution` setup 단계(sub-workflow 실행)에서 발생한 예외 메시지를 가공/길이 제한 없이 그대로 영속화하고 `EXECUTION_FAILED` 이벤트로 클라이언트까지 전파한다. 이 패턴은 기존 큐 경로(`runExecutionFromQueue` catch)와 동일한 기존 관례를 재사용한 것으로 보이며, 이번 diff가 새로 도입한 문제라기보다 기존 계약을 sub-workflow 경로로 확장한 것이다. 다만 setup 단계 예외(예: DB 연결 문자열, 내부 스택 정보, 다른 workspace의 workflow 메타데이터 일부)가 노출 가능성이 있다면 클라이언트에게 민감정보가 유출될 수 있다. 참고로 같은 파일의 `continueAiConversation`(라인 1338-1348 부근)은 이미 "client-safe 고정 message" 원칙을 따르고 있어(§7.5.2), setup 단계 에러 처리와 정책 일관성 괴리가 있다.
  - 제안: 신규 코드가 아니라 기존 계약 재사용이므로 이번 PR 범위에서 필수 수정 사항은 아니다. 다만 sub-workflow setup 단계에서 던져질 수 있는 에러의 소스(예: 하위 workflow 조회 실패, workspace 검증 실패 `WorkflowForbiddenWorkspaceError` 등)가 내부 구현 세부사항을 노출하지 않는지 별도로 감사할 가치가 있다. 큐 경로와 병행 리팩터링 시 공통 sanitize 헬퍼 적용을 고려.

- **[INFO]** 2차 실패(`failFirstSegmentSetup` 자체의 예외) 로그에 원본 에러 메시지 포함
  - 위치: `execution-engine.service.ts` 라인 1490-1500 (`executeAsync` catch), `failFirstSegmentSetup` catch (라인 2032-2038)
  - 상세: `secondaryErr.message` 및 `markErr.message` 를 서버 로그(`this.logger.error`)에 출력한다. 서버 로그는 일반적으로 사용자에게 직접 노출되지 않으므로 위험도는 낮음. 다만 로그가 외부로 유출되거나 로그 수집 시스템 접근 권한이 넓을 경우 잠재적 정보 노출 경로가 될 수 있다.
  - 제안: 기존 로깅 관례(`runExecutionFromQueue`와 동일 패턴)를 그대로 따른 것으로 보이므로 별도 조치 불필요. 로그 접근 통제는 인프라 레벨 정책으로 다룰 사안.

- **[INFO]** 테스트 코드에서 `service as unknown as M4AsyncFailSubject` 캐스팅으로 private 메서드 spy
  - 위치: `execution-engine.service.spec.ts` 라인 40-105
  - 상세: 테스트 목적의 타입 단언이며 프로덕션 코드 보안과 무관. 기존 테스트 파일의 관례(`service as unknown as {...}`)와 일치한다.
  - 제안: 조치 불필요.

인젝션·인증/인가·하드코딩 시크릿·암호화·의존성 관점에서는 이번 diff에 해당 사항이 없다. 변경분은 fire-and-forget 비동기 catch 체인에 best-effort terminal 상태 마킹을 추가하는 신뢰성/동시성 개선이며, 신규 사용자 입력 처리 경로나 신규 외부 인터페이스를 도입하지 않는다. `failFirstSegmentSetup`은 DB 상태 조회 후 이미 terminal 상태면 no-op으로 반환하는 방어적 로직을 갖추고 있고, TypeORM Repository API(파라미터 바인딩)를 사용해 SQL 인젝션 노출이 없다. 2차 실패를 로그로만 흡수하고 재throw하지 않는 설계는 unhandled promise rejection으로 인한 프로세스 크래시(가용성 저하)를 예방하는 견고한 패턴이다.

### 요약
이번 변경(M-4)은 `executeAsync`의 fire-and-forget 실행 경로에서 `runExecution` setup 단계 예외를 `failFirstSegmentSetup`으로 best-effort 마감하는 신뢰성 개선이며, 신규 인젝션·인증/인가·시크릿·암호화 이슈는 발견되지 않았다. 유일한 관찰 사항은 에러 메시지가 가공 없이 DB/WS 이벤트로 노출되는 기존 계약(큐 경로와 동일)을 sub-workflow 경로까지 확장한다는 점인데, 이는 이번 PR이 새로 도입한 패턴이 아니라 기존 관례의 재사용이므로 차단 사유는 아니다.

### 위험도
NONE
