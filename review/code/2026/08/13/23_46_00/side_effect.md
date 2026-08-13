# 부작용(Side Effect) 코드 리뷰 결과

## 검토 방법

`git diff origin/main...HEAD -- codebase plan` (12개 파일, 코드 9 + plan 3)을 1차 소스로 삼았다.
Working tree 직접 `Read` 로 대조하던 중, `knowledge-base.service.ts:345-347` 에서 한 차례
`updateReturningRows(...)` 가 `(acquired as { id: string }[]).length === 0` 로 보이는 스냅샷을
관측했다 — 그러나 `git hash-object`(`061c5614c...`)가 `HEAD` blob 해시와 정확히 일치하고 재-`Read`
에서도 정상 상태였으므로, 이는 코드 결함이 아니라 **공유 워크트리에서 동시에 도는 다른 프로세스(뮤테이션
테스트 등)가 만든 일시적 스냅샷**으로 판정했다(이 저장소가 `23_07_11` RESOLUTION W3 에서 이미 자인한
바로 그 패턴). 아래 발견사항은 모두 `git show HEAD:` 기준 커밋된 최종 상태에 대한 것이다.

## 발견사항

- **[WARNING]** 4개월 가까이 죽어 있던 이벤트·비즈니스 메트릭 발동 코드가 이번 수정으로 배포 즉시
  "처음으로" 실제 실행된다 — 부작용 관점의 "이벤트/콜백 발생 변경"에 정확히 해당한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2950-2958`
    (`if (admitted) { … this.recordRunningSegmentStart(executionId); … ExecutionEventType.EXECUTION_STARTED … }`),
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8545-8554`
    (`const persisted = updateReturningRows(...).length > 0; … this.recordRunningSegmentStart(execution.id); … this.emitTerminalExecutionMetrics(execution, newStatus, persisted);`)
  - 상세: `admitExecutionOrDefer` 의 `admitted` 는 튜플 버그 때문에 지금까지 **항상 `false`** 로만
    평가돼 왔다(주석이 diff 안에서 스스로 실측: "매 실행 2s 지연 + 아래 `if (admitted)` 블록…이
    통째로 사문화됐다"). 즉 `recordRunningSegmentStart`/`EXECUTION_STARTED` emit 은 이 지점에서
    프로덕션 코드로 존재는 했지만 **실질적으로 unreachable** 이었다. 이번 수정으로 정상 admission
    경로에서 매번 실제로 실행된다. 마찬가지로 `updateExecutionStatus` 의 `persisted` 도 튜플 길이가
    항상 2 였던 탓에 "동시 cancel 이 이미 terminal 로 옮겨서 종결 이벤트를 스킵" 하는 분기가 한 번도
    타지 않았고, `emitTerminalExecutionMetrics(..., persisted)` 를 경유하는
    `recordExecutionTerminal`/`recordExecutionError` 비즈니스 메트릭이 과소집계돼 왔다
    (`plan/in-progress/ie-resume-turn-boundary-cancel.md` 가 이미 "실패율 대시보드가 실제 증가 없이
    급변할 수 있다"고 자체 기록). 수정 자체는 의도된 버그 수정이고 plan 문서·이전 라운드
    security.md/RESOLUTION 에도 인지돼 있으나, **모든 execution 의 admission·종결 경로**에 걸리는
    광범위한 표면이라 side-effect 관점에서 별도로 강조할 값어치가 있다.
  - 제안: 배포 시 이 두 지점(EXECUTION_STARTED 최초 정상 발동, 종결 메트릭 급변)을 별도 관측
    항목으로 runbook 에 명시했는지 재확인. 이미 plan 후속 체크리스트에 등재돼 있다면 조치 불요.

- **[INFO]** KB CAS 락(`재추출`/`재임베딩`)이 배포 후 처음으로 실제 `409 Conflict` 를 던진다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345-352`
    (`updateReturningRows(acquired, …).length === 0` → `KB_REEXTRACT_IN_PROGRESS`),
    `:729-733` (`KB_REEMBED_IN_PROGRESS`)
  - 상세: 튜플 버그로 `acquired.length` 가 항상 2 였던 탓에 이 두 CAS 락은 동시 요청을 한 번도
    거절한 적이 없었다(주석이 스스로 인정: "CAS 락이 한 번도 거절하지 않았다"). 수정 후에는 동시
    재추출/재임베딩 요청 중 하나가 실제로 409 를 받는다 — 클라이언트가 이 코드를 "이론상 존재하나
    실무에서 못 보던 응답"으로 취급해 재시도/백오프 처리가 비어 있을 가능성이 있다. API 계약 자체는
    변경되지 않았고(원래도 `ConflictException` 을 던지도록 작성돼 있었음), 실제로 발동하는 빈도만
    0→양수로 바뀐 것이라 CRITICAL 은 아니다.
  - 제안: 없음 — 의도된 동시성 가드 복원. 프런트/연동 클라이언트의 409 처리 여부만 배포 후 확인 권장.

- **[INFO]** 신규 헬퍼 `updateReturningRows` 는 8개 호출부 전부에서 `detail`(필수 인자)을 채워
  호출한다 — 시그니처 위반 호출부 없음, 확인 완료.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:36-45`(시그니처 정의) 대비
    `auth-oauth.service.ts:146`, `execution-engine.service.ts:2943`, `:8546`,
    `knowledge-base.service.ts:346`, `:544`, `:578`, `:729`, `:751`
  - 상세: `detail: string` 은 선택 인자가 아니라 필수(주석: "선택으로 두었더니 8곳 중 한 곳이
    비워 뒀다"). `grep -n "updateReturningRows"` 로 8개 호출부를 전수 확인했고 전부 두 번째 인자를
    전달한다. 이 함수는 이번 diff 로 신규 도입된 것이라 외부 호출자에 대한 하위 호환 파손도 없다.
  - 제안: 없음.

- **[INFO]** 전역 변수·환경 변수·네트워크 호출 신규 도입 없음 — 확인.
  - 상세: 변경된 6개 코드 파일(`update-returning-rows.ts/.spec.ts`, `execution-engine.service.ts`,
    `knowledge-base.service.ts`, `auth-oauth.service.ts/.spec.ts`) 전체에서 `process.env`,
    모듈 스코프 `let`/`var` 전역 상태, `fetch`/`axios`/외부 HTTP 클라이언트 신규 호출이 없다.
    모든 변경은 기존 `DataSource.query`/`EntityManager.query` 호출의 반환값 해석 방식만 바꾼다
    (쿼리 문자열·파라미터·트랜잭션 경계는 그대로).

- **[INFO]** 신규 spec 파일의 파일시스템 접근은 읽기 전용이며 기존 컨벤션을 그대로 따른다.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts` (`SRC = join(__dirname, '..', '..')` +
    `readFileSync(join(SRC, rel), 'utf8')`)
  - 상세: `assert-row-array.spec.ts` 가 이미 쓰던 "정적 grep 구조 가드" 패턴을 그대로 복제한 것으로,
    파일 쓰기·삭제는 없다. 테스트 실행 중 실제 소스 파일을 읽어 정규식 카운트만 비교한다 — 부작용
    없음.

## 요약

이번 diff 는 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE … RETURNING` 에만 `[rows, rowCount]` 튜플을
돌려주는 실측 결함을 공용 헬퍼(`updateReturningRows`)로 봉합하고 8개 소비 지점(execution-engine 2,
knowledge-base 5, auth-oauth 1)을 교체한다. 전역 변수·환경 변수·신규 네트워크 호출·파일시스템 쓰기·
공개 API/DTO 시그니처 변경은 없다. 다만 이 수정의 본질상 지금까지 **사실상 도달 불가능했던**
이벤트 발동(`EXECUTION_STARTED`)·비즈니스 메트릭 집계(`recordExecutionTerminal`/`recordExecutionError`)·
동시성 가드 거절(KB CAS 락 409)이 배포 즉시 "정상적으로 처음" 실행되기 시작한다 — 의도된 버그
수정이자 plan 문서에 이미 인지·기록돼 있지만, 광범위한 표면(모든 execution admission/종결, 모든 KB
재추출/재임베딩)에 걸리는 만큼 배포 후 관측 계획이 실제로 이행되는지 별도 확인을 권장한다.
검토 중 `knowledge-base.service.ts` 에서 관측된 일시적 불일치는 공유 워크트리의 동시 프로세스가 남긴
스냅샷으로 확인했고(`git hash-object` 로 `HEAD` 와 일치 확인), 실제 코드 결함이 아니다.

## 위험도

LOW
