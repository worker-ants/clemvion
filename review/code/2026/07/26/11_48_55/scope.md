# 변경 범위(Scope) 리뷰

대상 커밋: `dad70c7b2` — `fix(engine): 외부 cancel 후에도 하류 노드가 계속 dispatch 되던 결함 (§2.3)`
대상 파일 5개 (커밋 diff `--name-only` 와 프롬프트 대상 파일 5개가 정확히 일치 — 프롬프트 밖에 숨은 변경 없음을 `git show --stat dad70c7b2` 로 교차 검증함):

1. `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
2. `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
3. `codebase/backend/src/modules/execution-engine/workflow-errors.ts`
4. `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts`
5. `plan/in-progress/node-cancellation-residual-signal-propagation.md`

## 발견사항

없음. 5개 파일 전부가 "외부 cancel(stop) 후 하류 노드 dispatch 가 멈추지 않던 결함" 이라는 단일 논리적 변경에 직접 묶여 있고, 커밋 메시지가 서술하는 범위와 실제 diff 가 1:1로 일치한다.

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7796` (`assertExecutionNotCancelled`) + 호출부 3곳 — `execution-engine.service.ts:1638`(`runNodeDispatchLoop`, resume 경로 공유 루프) · `:3729`(`executeInline`) · `:4261`(`runExecution`)
  - 상세: 커밋 메시지가 "순회 루프가 3곳에 복제돼 있어 전부에 배치했다: `runExecution` · `runNodeDispatchLoop` · `executeInline`" 이라 명시한 바와 실제 grep 결과가 정확히 일치함(직접 `Read`/`grep` 으로 세 함수 경계를 확인). 중복·과잉 삽입 없음.
  - 판정: 스코프 내. INFO 조차 아님(참고용으로 기재).

- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:7772`-`7795` (`assertExecutionNotCancelled` JSDoc, 약 24줄)
  - 상세: 새 private 메서드에 "왜 DB 를 다시 읽나 / 비용 / abortSignal 로 대체 불가한 이유" 를 설명하는 긴 JSDoc 이 붙었다. 언뜻 코드 대비 주석 비중이 커 보이지만, 같은 파일의 기존 필드·메서드(`maxActiveRunningMs`, `CHECKPOINT_SCHEMA_VERSION`, `failFirstSegmentSetup` 등)도 동일한 밀도의 근거-서술형 JSDoc 을 쓰는 확립된 컨벤션이며, 이 버그 자체가 이전에 리뷰어 3명이 두 차례 오판(§2.1 misdiagnosis)한 이력이 있어 "왜 이 방법이 정답이고 다른 후보가 반증됐는지" 를 남기는 것이 재발 방지 차원에서 타당하다. 불필요한 주석으로 보지 않음.
  - 판정: 스코프 내.

- **위치**: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:314`-`323` (`ExecutionCancelledError`)
  - 상세: 생성자 인자를 필수 없는 `message = 'Execution cancelled while waiting for input'` 기본값으로 바꾼 최소 변경. 새 dispatch 사전 체크가 park 문구를 그대로 쓰면 원인을 오도하므로, 그 필요에 정확히 대응하는 범위 축소형 수정이며 기존 호출부 호환도 깨지 않는다. 다른 필드·메서드 추가 없음.
  - 판정: 스코프 내.

- **위치**: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts` (기존 `it('진행 중 노드가 있는 실행을 stop 하면...')` 케이스 중간)
  - 상세: 기존 단언이 "stop 직후 즉시 반환 → 아직 안 만들어진 하류 행을 안 만들어질 행으로 오독" 하던 관측 시점 결함을 고치기 위해 대기 로직 13줄을 추가. 이번 커밋이 고치는 결함(엔진 dispatch 루프)의 회귀 가드가 실은 vacuous 하게 통과하고 있었다는 사실과 직접 연결된 수정이며, 새 시나리오·새 API 호출을 추가하지 않았다.
  - 판정: 스코프 내.

- **위치**: `plan/in-progress/node-cancellation-residual-signal-propagation.md` (체크리스트 항목 1건)
  - 상세: `- [ ]` → `- [x]` 전환 + 완료 근거 서술. 프로젝트 컨벤션(`plan/in-progress/` 체크박스 = 실제 상태, `.claude/docs/plan-lifecycle.md`)에 정확히 부합하는 진행 기록이며 다른 체크리스트 항목·메타데이터는 건드리지 않았다.
  - 판정: 스코프 내.

## 점검 관점별 결과

1. **의도 이상의 변경**: 없음 — 5개 파일 전부 "cancel 후 하류 dispatch 정지" 단일 결함과 직결.
2. **불필요한 리팩토링**: 없음 — 기존 함수 구조·이름·호출 시그니처 변경 없이 신규 메서드 1개 + 호출 3곳 삽입.
3. **기능 확장(over-engineering)**: 없음 — DB read-back 1건, 새 sentinel 재사용(`ExecutionCancelledError` 인자화)만 있고 새 API·새 옵션·새 설정 플래그 없음.
4. **무관한 수정**: 없음 — `git show --stat` 로 커밋 파일 목록과 프롬프트 대상 파일이 정확히 일치함을 확인.
5. **포맷팅 변경**: diff 상 공백/줄바꿈 전용 변경 없음.
6. **주석 변경**: 새로 추가된 주석은 전부 이번 결함과 그 근거를 설명하는 것으로, 기존 무관 주석 삭제/수정 없음. 밀도는 파일 기존 컨벤션과 일치.
7. **임포트 변경**: 5개 diff 어디에도 import 추가/삭제 없음(직접 `grep`/`Read` 로 확인).
8. **설정 변경**: 없음.

## 요약

이번 diff 는 "Stop 이후에도 하류 노드가 계속 dispatch 되던" 단일 결함을 고치는 fix 로, 원인 코드(엔진 dispatch 루프 3곳) · 그 에러 타입(sentinel message 파라미터화) · 회귀 가드(unit + e2e) · 진행 기록(plan 체크리스트) 이 서로 필연적으로 묶인 최소 변경 집합이다. 커밋 메시지 서술과 실제 코드 변경이 정확히 일치하고, 커밋에 포함된 파일 목록도 프롬프트가 제시한 5개 파일과 완전히 일치해(숨은 변경 없음) 범위 이탈·불필요한 리팩토링·무관 수정·포맷팅 오염·불필요한 주석/임포트/설정 변경 어느 항목에서도 문제를 발견하지 못했다.

## 위험도

NONE
