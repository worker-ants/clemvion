# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[WARNING]** 이 수정 자체가 "이제까지 죽어 있던 이벤트/가드 분기를 되살리는" 배포다 — 운영 관점의 행동 변화가 크다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2944` (admission), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8541` (`updateExecutionStatus` guarded UPDATE)
  - 상세: 주석(2938~2943행, 8537~8540행)이 명시하듯 종전엔 `rows.length === 1`/`updated.length > 0` 이 튜플 shape 때문에 각각 "영원히 거짓"/"영원히 참"이었다. 즉:
    1) admission 게이트의 `if (admitted)` 블록(`recordRunningSegmentStart`, `EXECUTION_STARTED` emit)이 프로덕션에서 **한 번도 실행된 적 없었고**, 모든 admission 은 사실상 2초 지연 후 "stalled 재배달로 오인한 rehydration" 우회 경로로만 진행돼 왔다. 동시성 cap(`resolveConcurrencyCap`/`resolveMaxActiveRunningMs`) 도 이 우회 경로 때문에 사실상 강제되지 않았을 가능성이 있다.
    2) `updateExecutionStatus` 의 "동시 cancel 이 이미 terminal 로 선점했으면 종결 이벤트를 내지 마라" 가드가 한 번도 타지 않아, Stop 과 자연 실패가 경합하면 `execution.failed`/알림이 중복 발사됐을 수 있다.
    이번 수정으로 두 분기가 **처음으로 실제 라이브**가 된다 — 버그 수정 자체는 의도한 결과지만, 배포 직후 (a) 이전에 없던 2초 admission 지연이 사라지고 즉시 admitted 되는 케이스가 생기며, (b) cap 초과 시 실제로 `deferred`/`cancelled` 되는 케이스가 프로덕션에서 처음 관측되고, (c) `EXECUTION_STARTED` emit 타이밍·빈도가 바뀐다. 이는 이 PR 의 목적(버그 수정)과 일치하지만, 부작용 관점에서는 "장기간 죽어 있던 코드 경로가 되살아나 이벤트 발생 패턴이 바뀌는" 변경이므로 배포 후 관측(§8 active-running 타임아웃, 알림 중복 등)이 필요하다.
  - 제안: 이미 `plan/in-progress/update-returning-tuple-shape.md` 체크리스트에 "e2e 재실행으로 경로 정상화 확인"이 미체크로 남아 있다 — 배포 전 반드시 완료할 것. 특히 동시성 cap 이 실제로 걸리는 워크로드(설정된 cap 을 이미 초과해서 돌리고 있던 워크스페이스)가 있다면 배포 후 체감 가능한 지연/거부가 새로 발생할 수 있음을 운영팀에 공유 권장.

- **[INFO]** `assertRowArray` 호출 제거로 두 지점의 호출부-특화 진단 메시지가 소실된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2944` 인근(옛 `assertRowArray(rows, "admission UPDATE ... RETURNING, execution ${executionId}. 트랜잭션을 롤백한다(부분 적용 방지).")` 제거), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8541` 인근(옛 `assertRowArray(updated, "updateExecutionStatus guarded UPDATE ... RETURNING, execution ${execution.id} → ${newStatus}. false 로 넘기면 종결 이벤트가 조용히 유실된다.")` 제거)
  - 상세: 두 지점 모두 `result` 가 배열이 아닐 때 여전히 throw 하므로(`updateReturningRows` 내부의 `Array.isArray` 가드) **fail-loud 자체는 보존**된다 — 트랜잭션 롤백/재전파 흐름도 그대로다(`admitExecutionOrDefer` 호출자가 catch 해서 `releaseExecutionRouting` 후 rethrow 하는 것을 `execution-engine.service.ts:3694-3699` 에서 확인). 다만 에러 메시지가 지점마다 다른 상세 설명(어떤 UPDATE 인지, executionId, 어떤 결과를 초래하는지)에서 `update-returning-rows.ts` 의 범용 메시지(`UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=...)`)로 바뀌어, 장애 시 로그만으로 어느 호출부인지 구분하기 어려워진다. `assert-row-array.ts` 자체의 설계 원칙("메시지는 호출부가 준다")과도 배치되는 방향이라, 완전히 동등한 대체는 아니다.
  - 제안: 기능상 문제는 아니므로 차단 사유는 아니다. 필요하면 `updateReturningRows` 호출부에서 `try/catch` 로 감싸 컨텍스트를 덧붙이거나, 헬퍼에 선택적 `detail` 파라미터를 추가하는 것을 고려할 수 있다.

- **[INFO]** 신규 구조 가드 테스트가 프로덕션 소스 파일을 문자열로 읽어 카운트를 단언한다 (파일시스템 부작용 아님, 참고용)
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.spec.ts:57`, `:82`, `:129` (`readFileSync` 호출부)
  - 상세: 전부 `readFileSync` 읽기 전용이며 대상 경로(`execution-engine.service.ts`, `knowledge-base.service.ts`, `stuck-document-recovery.service.ts`, `agent-memory-admin.service.ts`)는 실제 존재하는 프로덕션 소스라 쓰기/생성/삭제 부작용은 없다. `updateReturningRows` 호출부 개수(2/5)와 소비 지점 총수(3/10)를 정규식으로 세는 방식이라 코드 변경 시 자주 갱신이 필요한 결합도 높은 가드이지만, 이는 부작용이 아니라 유지보수 비용 문제이므로 본 관점 밖으로 정보성 기재만 남긴다.
  - 제안: 해당 없음(문제 아님).

- **[INFO]** 신규 export 함수 `updateReturningRows` 는 순수 함수이며 부작용 없음, 기존 시그니처 변경 없음
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:23`
  - 상세: 신규 파일·신규 export 이므로 기존 호출자에게 영향을 주는 시그니처 변경이 아니다. 전역 상태 접근·I/O·네트워크 호출이 없는 순수 변환 함수다. `assertRowArray` 와 달리 예외 시 항상 동일한 일반 메시지를 던지는 설계 차이만 있다(위 INFO 항목 참고).
  - 제안: 해당 없음.

- **[INFO]** 나머지 5개 `knowledge-base.service.ts` 소비 지점 변경은 내부 로직 치환뿐, 공개 메서드 시그니처·리턴 타입 불변
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`(`reExtractAll`), `:541,:572-573`(`retryFailedDocuments`), `:719,:740`(`reEmbedAll`)
  - 상세: `reExtractAll`/`reEmbedAll`/`retryFailedDocuments` 의 파라미터·반환 타입은 그대로다. CAS 락 거절 분기(`ConflictException`)가 이번에 처음으로 실제 작동하게 되므로, 동시에 재추출/재임베딩을 여러 번 호출하던 클라이언트가 배포 후 처음으로 409 를 받을 수 있다 — 위 admission 케이스와 동일한 성격("죽어 있던 분기가 되살아남")이라 별도 CRITICAL 로 분리하지 않고 참고로 기재한다.
  - 제안: 해당 없음(의도된 수정).

## 요약

이번 변경은 순수 함수 `updateReturningRows` 신설과 그 7개 호출부(execution-engine 2곳, knowledge-base 5곳) 치환, 그리고 회귀 방지용 구조적 grep 가드 테스트 추가로 구성된다. 전역 변수·환경 변수·네트워크 호출·공개 API 시그니처 변경은 없고, 파일시스템 접근은 신규 테스트의 읽기 전용 `readFileSync` 뿐이라 고전적 의미의 "의도치 않은 부작용"은 없다. 다만 이 PR 의 본질이 "튜플 shape 오독 때문에 4개월간 죽어 있던 분기(admission cap 강제, 동시-cancel 종결 이벤트 억제, KB CAS 락 거절, 빈 KB idle 복귀)를 되살리는" 것이므로, 배포 시점에는 이벤트 발생 패턴·타이밍·거부 응답이 프로덕션에서 처음으로 실측되는 형태의 행동 변화가 발생한다 — 버그 수정으로서는 옳지만 부작용 리뷰 관점에서는 "표면적으로 조용한 diff 뒤에 운영상 체감 가능한 변화가 숨어 있다"는 점을 눈여겨봐야 한다. 부수적으로 `assertRowArray` 의 호출부-특화 진단 메시지가 범용 메시지로 대체되어 장애 시 디버깅 컨텍스트가 다소 줄어드는 점은 경미한 트레이드오프다.

## 위험도

MEDIUM
