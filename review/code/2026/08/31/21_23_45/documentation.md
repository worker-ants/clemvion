# 문서화(Documentation) 리뷰 — 엔진 에러 코드 앵커링 (`EngineErrorCode`), 5라운드 누적 diff

## 배경

이번 diff 는 원 변경 커밋(`adc4a3ff6`) + 1R(`20_27_29`) + 2R(`20_43_35`) + 3R(`20_59_14`) +
4R(`21_12_31`) fix 의 누적이다. 앞선 네 라운드는 정확히 "문서 동기화(코드 fix 가 그 fix 를
설명하는 상위 산문에 역전파되지 않음)" 결함 클래스를 세 번 잡았다 — `error-codes.ts` JSDoc(2R→3R
fix) · `CHANGELOG.md`(2R→3R fix) · `plan/complete/exec-intake-followups.md`(2R→4R fix, 세 번째
미러 누락). 이번 라운드는 (a) 4R 의 W1 fix(plan 세 번째 미러)가 실제로 반영됐는지, (b) 4R 에서
같이 반영된 testing INFO 2/3(`error-codes.spec.ts` 의 `EngineErrorCode` 대칭성·무교집합 테스트
추가)가 상위 산문에 새로운 미러 갭을 만들지 않았는지를 직접 소스 대조로 검증했다.

## 검증 방법 (실제 실행/열람, 저장소 뮤테이션 없음)

- `codebase/backend/src/nodes/core/error-codes.ts` 전체(1~180행)를 `Read` — `EngineErrorCode`
  JSDoc 의 "여기 있는 것/없는 것" 목록이 "아래 **셋**"으로 `RESUME_CHECKPOINT_MISSING`/
  `RESUME_INCOMPATIBLE_STATE` 를 포함함을 재확인. `EngineErrorCode` 각 항목(4개)의 값이
  `EXECUTION_QUEUE_WAIT_TIMEOUT`/`WORKER_HEARTBEAT_TIMEOUT`/`SERVER_INTERRUPTED`/
  `WEBCHAT_IDLE_TIMEOUT` 로 원 리터럴과 byte-identical.
- `CHANGELOG.md` 1~48행을 `Read` — "옮기지 않은 것도 있다" 단락이 `RESUME_*` 를 포함해 세
  카테고리 모두 나열함을 재확인. "가드가 훑는 형태는 다섯이고, 여섯 번째에서 멈췄다" 경계
  결정 문단도 유지됨을 확인.
- `plan/complete/exec-intake-followups.md` 전체(1~128행)를 `Read` — 4R 이 잡은 "④ 옮기지
  않은 것과 그 이유" 단락이 이제 (a)(b)(c) 세 카테고리로 나열되고, `RESUME_FAILED` 가 왜
  목록에 없는지도 명시돼 있음을 확인(4R W1 fix 실제 반영 확인). "이 문단이 세 번째로
  고쳐졌다 (리뷰 4R)" 라는 자기 서술 인용 블록도 실재.
- `codebase/backend/src/nodes/core/error-codes.spec.ts` 전체를 `Read` — 4R 에서 추가된
  `EngineErrorCode enum` describe 블록(형식 대칭성 · 무교집합 · 비어있지-않음 3테스트)이
  실제로 존재하고 각 테스트에 근거 주석이 붙어 있음을 확인.
- `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts` 전체(262행)
  ·`engine-error-code-anchor.spec.ts` 전체(158행)·`engine-error-code-anchor-fixture.ts`
  전체(65행)를 `Read` — `ANCHORED_ELSEWHERE` 8개 항목(3 카테고리)·`collectBoundCodes`/
  `findUnanchored` JSDoc(5형태 스캔 범위, 6번째 형태에서 멈춘 경계, "값이 아니라 형태" 로
  판정을 옮긴 뮤테이션 경위)이 CHANGELOG·plan·error-codes.ts JSDoc 서술과 전부 일치함을
  재확인.
- `spec/conventions/error-codes.md` 를 `Read` — §3(59행, Historical-artifact 레지스트리)이
  `WORKER_HEARTBEAT_TIMEOUT` 을 등재하고 있고, `error-codes.ts` JSDoc 의 SoT 링크
  (`../../../../../spec/conventions/error-codes.md`, 5단계 상대경로)가 `codebase/backend/src/nodes/core/`
  기준으로 정확히 착지함을 경로 계산으로 재확인. §4.2(117행)가 trigger 파라미터 `details[].code`
  레이어 문서임도 확인. `spec/5-system/3-error-handling.md` 에서 `EXECUTION_QUEUE_WAIT_TIMEOUT`
  (140행)·`WEBCHAT_IDLE_TIMEOUT`(142행), `spec/5-system/4-execution-engine.md` 에서
  `SERVER_INTERRUPTED`(1362행)가 각각 값 그대로 문서화돼 있어 이번 순수 리다이렉트가 이
  spec 문서들의 갱신을 요구하지 않는다는 1R 판정을 재확인.
- ai-turn-orchestrator.service.ts / execution-engine.service.ts / shutdown-state.service.ts
  의 diff 주변 JSDoc·인라인 주석(`classifyLlmError` 위 spec §10 주석, `markWebChatIdleTimeout`/
  `markQueueWaitTimeout`/`finalizeStalledExhausted` 의 트랜잭션·경합 설명, `markRemainingAsInterrupted`
  의 SIGTERM 주석)을 직접 열람 — enum 참조로 바뀐 것 외 의미 변화가 없어 어느 주석도 stale
  해지지 않았음을 확인.

## 발견사항

- **[INFO]** `CHANGELOG.md` 의 뮤테이션 서사가 4R 에서 새로 추가된 "설계 전제(무교집합) 검증
  테스트"를 언급하지 않는다
  - 위치: `CHANGELOG.md` (해당 `## Unreleased` 항목 — 이번 라운드 diff 밖. 게이트 인용 불가,
    `Read` 로 직접 확인) vs `codebase/backend/src/nodes/core/error-codes.spec.ts` 의
    `describe('EngineErrorCode enum', …)` 블록(`shares no code with ErrorCode` 테스트)
  - 상세: CHANGELOG 는 "파일은 하나, const 는 둘" 설계를 그 자체로 서술하지만, 그 설계의
    **전제**("두 const 가 겹치지 않는다") 를 검증하는 테스트가 4R 에서 새로 생겼다는 사실은
    CHANGELOG 어디에도 없다. 이 세션은 정확히 같은 성격("코드 fix/추가가 상위 산문에
    역전파되지 않음")의 갭을 이미 세 번(2R→3R, 2R→4R 두 번) 잡았던 이력이 있어, 같은 축의
    네 번째 인스턴스일 수 있다. 다만 앞의 세 번과 달리 이번엔 기존 서술이 **틀리거나
    자기모순**은 아니다 — 그냥 언급이 없을 뿐이라 독자를 오도하지 않는다(설계 근거 자체는
    이미 정확히 쓰여 있다). `plan/complete/exec-intake-followups.md` 의 "테스트 14건" 카운트도
    `engine-error-code-anchor.spec.ts`(가드 소비 spec) 한정 서술이라 이 새 테스트(별도 파일
    `error-codes.spec.ts`)와 무관하며 그 자체로는 부정확하지 않다.
  - 제안: 우선순위 낮음 — CHANGELOG 에 한 문장("`EngineErrorCode`/`ErrorCode` 무교집합을
    테스트로 고정했다") 추가하면 이 세션 특유의 "설계 전제는 전부 뮤테이션/테스트로
    검증했다" 는 서사가 완결되지만, 없어도 오해를 유발하지는 않는다.

## 확인된 사항 (참고용 — 결함 아님)

- **4R 의 W1(plan 세 번째 미러 누락)은 정확히 해소됐다.** `plan/complete/exec-intake-followups.md`
  ④ 단락이 이제 (a)(b)(c) 세 카테고리를 전부 나열하고, `RESUME_FAILED` 제외 사유까지 명시.
  이로써 같은 사실을 담는 세 문서(`error-codes.ts` JSDoc·`CHANGELOG.md`·plan)가 처음으로
  전부 정합적이다.
- 1R~4R RESOLUTION 이 "반영했다" 고 기록한 항목(CHANGELOG 신설, JSDoc 생성자-인자 형태 보강,
  가드 spec 근거 수치 정정 "45자→64자", plan 테스트 개수 "11건→14건", 형제 대칭 테스트,
  무교집합 테스트) 을 전부 `Read`/직접 카운트로 재대조 — 서술과 실제 소스가 일치.
- `EngineErrorCode` 4개 값 전부에 개별 JSDoc(용도·귀결 상태·관련 파일)이 붙어 있고,
  `WORKER_HEARTBEAT_TIMEOUT` 은 이름과 실제 의미가 어긋나는 유일한 값이라 SoT 링크까지
  추가로 갖춰(다른 셋은 인라인 spec 참조 또는 자기설명적 문구로 충분) 일관성이 있다.
- `ANCHORED_ELSEWHERE` 의 8개 항목·`collectBoundCodes`/`findUnanchored` 의 5형태-스캔·
  6번째 형태에서 멈춘 경계 논리·"값이 아니라 형태로 판정을 옮긴" 뮤테이션 경위 — 이 넷
  모두가 `error-codes.ts` JSDoc·`CHANGELOG.md`·plan·가드 소스 자신의 docstring 네 곳에서
  현재 시점 기준 서로 어긋나지 않는다.
- README/API 문서/환경변수 문서: 여전히 해당 없음 — 순수 내부 리팩터(문자열 값 불변),
  신규 API·env var·설정 없음.

## 요약

5라운드에 걸쳐 반복된 "코드 fix 가 그 fix 를 설명하는 상위 산문에 역전파되지 않는다" 는
문서 동기화 결함 클래스는, 4R 에서 잡힌 마지막 위치(plan 문서의 세 번째 미러)까지 포함해
세 미러 문서(`error-codes.ts` JSDoc · `CHANGELOG.md` · `plan/complete/exec-intake-followups.md`)
가 이제 전부 정합적임을 직접 소스 대조로 확인했다. 새로 발견한 것은 4R 에서 추가된 설계
전제 검증 테스트(`EngineErrorCode`/`ErrorCode` 무교집합)가 CHANGELOG 서사에 언급되지 않는다는
INFO 1건뿐이며, 기존 서술이 틀리거나 자기모순인 것은 아니라 앞선 라운드들의 WARNING 급
갭과는 성격이 다르다. spec 문서(`spec/conventions/error-codes.md`·`3-error-handling.md`·
`4-execution-engine.md`) 는 값이 그대로라 갱신이 필요 없다는 판정도 재확인했고, diff 에
포함된 실제 소스 변경(3개 서비스 파일의 리다이렉트, 신규 가드 3파일)의 인라인 주석·JSDoc은
모두 정확·최신이다.

## 위험도

NONE
