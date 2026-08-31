# 부작용(Side Effect) 리뷰 (3라운드, `20_59_14`)

## 검토 범위

이번 라운드는 `origin/main` 대비 누적 diff(3개 커밋: `adc4a3ff6` 본 변경 · `4141c64e3` 1라운드
fix · `eb65d3e6d` 2라운드 fix) 전체를 대상으로 한다. 실질 프로덕션/테스트 코드 변경은 다음과
같고, 나머지(9~32번)는 앞 두 라운드의 리뷰 산출물(`.md`/`.json`, 실행 경로 없는 정적 문서)이다.

- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts` — `ErrorCode.LLM_RATE_LIMIT`/`LLM_CALL_FAILED` 리다이렉트(4지점)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `EngineErrorCode.{WEBCHAT_IDLE_TIMEOUT,EXECUTION_QUEUE_WAIT_TIMEOUT,WORKER_HEARTBEAT_TIMEOUT}` 리다이렉트
- `codebase/backend/src/modules/execution-engine/shutdown/shutdown-state.service.ts` — `EngineErrorCode.SERVER_INTERRUPTED` 리다이렉트 ×2
- `codebase/backend/src/nodes/core/error-codes.ts` — 신규 `EngineErrorCode`/`EngineErrorCodeValue` export
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-{guard.ts,fixture.ts,.spec.ts}` (신규, 2라운드에서 생성자 positional 인자 형태 추가로 스캔 확장)
- `plan/in-progress/exec-intake-followups.md` → `plan/complete/exec-intake-followups.md` (이동)
- `CHANGELOG.md` — 항목 추가

## 검증 방법 (저장소 뮤테이션 없음)

- `git diff origin/main --stat` 로 diff 범위가 payload 와 일치함을 확인(31개 파일, 프롬프트
  서술과 대조).
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` 전체를 `Read`
  로 직접 열어(프롬프트가 크기 제한으로 잘라낸 부분 포함) 2라운드에서 추가된 생성자 positional
  인자 스캔(`ts.isNewExpression` 분기)까지 확인.
- `git show --stat -M adc4a3ff6 4141c64e3 eb65d3e6d` 로 plan 이동이 실제로 rename 으로 잡히는지
  (delete+add 아님) 재확인.
- `grep -n "testRegex" codebase/backend/jest.config.ts` → `'.*\.spec\.ts$'` — `-guard.ts`/
  `-fixture.ts` 는 별도 테스트 스위트로 수집되지 않음을 직접 확인.
- `grep -rn "error-codes" codebase/backend/src/nodes/core/index.ts` → 매치 없음 — barrel
  재수출 없음을 직접 확인.
- `grep -n "eslint-disable" engine-error-code-anchor-fixture.ts` → 매치 없음(1라운드 fix 반영
  최종 확인).
- `git status --short` → `review/code/2026/08/31/20_59_14/` 외 변경 없음(리뷰 세션 산출물
  디렉터리뿐). 뮤테이션·잔존물 없음.

## 발견사항

- **[INFO]** 리다이렉트된 값 전부 원본 리터럴과 동일 — DB 영속값/FE·알림 분기 계약 무변경
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`(`EngineErrorCode` 블록), `execution-engine.service.ts`, `shutdown-state.service.ts`, `ai-turn-orchestrator.service.ts` 각 리다이렉트 지점
  - 상세: `Execution.error.code`/`NodeExecution.error.code` 는 DB 에 영속되고 FE·알림·chat-channel 분류기가 값으로 분기하는 계약이다. `EngineErrorCode`/`ErrorCode` 모두 `KEY: 'KEY'` 자기거울 패턴이라 치환 전후 문자열 값이 완전히 동일함을 직접 대조로 확인했다 — 앞 두 라운드의 동일 결론과 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 public export(`EngineErrorCode`, `EngineErrorCodeValue`) — barrel 재수출 없어 표면 국소적
  - 위치: `codebase/backend/src/nodes/core/error-codes.ts`
  - 상세: `nodes/core/index.ts` 에 재수출 없음을 직접 grep 으로 재확인. 기존 `ErrorCode`/`ErrorCodeValue` export 는 그대로이며 순수 추가(additive)다.
  - 제안: 조치 불필요.

- **[INFO]** 신규 repo-guard 3파일은 파일시스템 read-only이며 테스트 실행 범위에만 한정
  - 위치: `engine-error-code-anchor-guard.ts` 의 `readDeclaredCodes`/`walkTsFiles`/`collectBoundCodes`(`fs.readFileSync`/`fs.readdirSync`)
  - 상세: `fs` 호출은 전부 읽기 전용, 쓰기/삭제 API 미사용. `jest.config.ts` `testRegex: '.*\.spec\.ts$'` 를 직접 확인해 `-guard.ts`/`-fixture.ts` 가 별도 스위트로 수집되지 않음을 검증했다. 2라운드에서 스캔 형태가 확장됐지만(`ts.isNewExpression` 분기 추가) 여전히 같은 소스 파일들을 읽기만 할 뿐 어떤 파일도 쓰지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** plan 문서 이동은 git rename 으로 정상 인식됨(delete+add 아님)
  - 위치: `plan/in-progress/exec-intake-followups.md` → `plan/complete/exec-intake-followups.md`
  - 상세: `git show --stat -M adc4a3ff6` 결과 단일 파일 `71 +++++++++++++++++++++-` 로 rename 탐지됨을 재확인. 프로젝트 메모리의 "git mv + multi-pathspec add → 침묵 stale 커밋" 함정과 다른 케이스다.
  - 제안: 조치 불필요.

- **[INFO]** `ANCHORED_ELSEWHERE` 예외 목록에서 값이 제거된 것(`RESUME_FAILED`)이 목록 크기에
  의존하는 하한 단언(`collectBoundCodes(...).length >= Object.keys(ANCHORED_ELSEWHERE).length`)에
  영향을 주지 않는지 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts`(전제 테스트), `engine-error-code-anchor-guard.ts`(`ANCHORED_ELSEWHERE`)
  - 상세: 2라운드 커밋(`eb65d3e6d`)에서 `RESUME_FAILED` 를 등재했다가 "죽은 항목" 테스트가 이를 거부해 뺐다(커밋 메시지로 확인). 예외 목록 크기가 줄면 하한 단언도 함께 낮아지는 상대적 결속(`Object.keys(...).length` 참조, 고정 숫자 아님)이라 vacuous 하지 않다 — 실제 테스트 결과는 `RESOLUTION.md` 서술상 14/14 GREEN.
  - 제안: 조치 불필요 — 확인 목적의 기록.

CRITICAL/WARNING 급 부작용은 발견되지 않았다. 전역 변수 신규 도입·기존 함수/메서드 시그니처
변경·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백 발행 변경은 이번 diff 어디에도 없다.

## 요약

이번 3라운드 diff 는 앞선 두 라운드가 이미 검토한 순수 리팩터(엔진 에러 코드 9지점을 맨
문자열에서 `EngineErrorCode`/`ErrorCode` 상수 참조로 리다이렉트) 위에, 2라운드 WARNING(가드
스캔 범위가 문서화된 보장보다 좁았음)을 해소하기 위해 `new XxxError('CODE', …)` 생성자
positional 인자 형태를 가드 스캔에 추가한 것이 전부다. 독립적으로 재검증한 결과 (1) 리다이렉트
값이 원본과 완전히 동일해 DB 영속값·FE/알림 분기 계약에 드리프트가 없고, (2) 신규 export 는
barrel 재수출이 없어 표면이 국소적이며, (3) 신규 repo-guard 는 프로덕션 경로와 분리된 읽기
전용 테스트 인프라(jest `testRegex` 로 별도 스위트 수집 안 됨을 직접 확인)이고, (4) plan 문서
이동은 git rename 으로 정상 인식돼 침묵 stale 커밋 위험이 없다. 전역 상태·환경 변수·네트워크
호출·이벤트/콜백 어느 것도 건드리지 않는다. 부작용 관점에서 실질적 위험은 발견되지 않았다.

## 위험도

NONE
