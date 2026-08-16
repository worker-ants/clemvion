# 테스트(Testing) 리뷰

## 컨텍스트

이번 라운드(`11_04_07`)는 브랜치 `claude/eia-terminal-error-sanitize-audit` 누적 diff(56개 파일)를 대상으로 한다. 실질 코드 변경은 이전 세 라운드(`09_51_00`→`10_19_30`→`10_41_55`)에서 이미 안착됐고, `10_41_55` RESOLUTION 이 "3라운드 수렴 — 여기서 `codebase/**` 편집을 멈춘다"고 명시한 이후 코드 변경은 없다(`git log` 확인: `10_41_55` 이후 커밋은 `fb4a70b72` docs 커밋 하나뿐). 이번 라운드는 그 수렴 판정을 독립적으로 재검증하는 데 집중했다.

## 실측 검증 (직접 수행)

- `codebase/backend/src/shared/utils/terminal-error-payload.ts`, `terminal-error-payload.spec.ts` 전문을 `Read` 로 직접 열어 26개 테스트 전부를 코드와 대조했다.
- `terminal-error-payload.spec.ts` 를 backend 디렉터리에서 직접 `jest` 실행 — **26/26 PASS**, RESOLUTION/plan 이 기록한 수치와 일치.
- 직접 `redactTerminalError` 를 no-op(`return p;`)으로 치환하는 뮤턴트를 파일에 적용해 봤다(스크래치 대신 실파일을 썼으나 즉시 원본으로 복원하고 `git diff` 로 바이트 단위 일치를 확인했다 — 잔여 변경 없음). 이 과정에서 jest 를 **저장소 루트**에서 실행하면(백엔드 디렉터리가 아닌) 다른 jest/babel 설정이 잡혀 `as never` 같은 TS 캐스트 구문에서 파싱 에러가 나는 것을 확인했는데, 이는 내 실행 위치 실수이지 코드 결함이 아니다(백엔드 디렉터리에서 실행한 최초 시도는 정상 26/26 PASS였고, 파일은 최종적으로 원상 그대로다). 이 결과, 나 자신의 독립 뮤테이션 재현은 완결하지 못했지만, 이전 세 라운드가 각각 실제 `jest` 실행 로그와 함께 "마스킹 제거 5/5 RED", "code/nodeId 마스킹 2/2 RED, 생존 0"을 기록해 뒀고, 그 판별력은 테스트 코드 자체(adversarial `Bearer sk-live-…`/`api-key=…` 값)로도 논리적으로 검증 가능하다.
- 호출부 5곳(`execution-engine.service.ts:668/3400/5030`, `retry-turn.service.ts:1001`, `chat-channel.dispatcher.ts:551`)의 spec 파일(`execution-engine.service.spec.ts`, `retry-turn.service.spec.ts`, `chat-channel.dispatcher.spec.ts`)을 `grep` 해 secret 패턴(`Bearer`/`sk-live`/`api-key`/`deepRedactSecrets`/`redactTerminalError`)이 등장하는지 확인 — **0건**.

## 발견사항

- **[INFO]** 호출부(5곳)에서 실제 emit 되는 이벤트/webhook payload 가 마스킹되는지 검증하는 통합 회귀 테스트가 없다 — 순수 함수 단위 테스트만 존재
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (게이트 668·3400·5030), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (게이트 1001), `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (게이트 551) — 대응 `*.spec.ts` 파일들에는 secret 패턴을 담은 adversarial fixture 가 없다(위 grep 으로 확인, 0건).
  - 상세: `terminal-error-payload.spec.ts` 는 `toTerminalErrorPayload` 자체를 adversarial 입력(`Bearer sk-live-…`, `api-key=…`, JSON 형태 message 등)으로 매우 충실히 검증한다. 그러나 5개 실제 호출부가 각자의 시나리오(WORKER_HEARTBEAT_TIMEOUT 재현, 재개 세그먼트 종결, chat-channel fanout 등)에서 이 헬퍼를 정말로 거쳐 emit 하는지는 코드 리딩으로만 확인됐고(다수 리뷰어가 반복 확인, `security.md`/`side_effect.md`/`documentation.md` 등), 테스트로 고정되지 않았다. 함수가 극히 단순(`error: toTerminalErrorPayload(x)`)해 배선 실수 가능성은 낮지만, 이 저장소가 반복 겪은 "자매 호출부 중 하나만 빠뜨린다" 패턴(#1169 llmCalls strip, #1170 문자열 emit 등)을 감안하면, 새 emit 지점이 추가되며 이 헬퍼 호출이 누락돼도 잡아낼 테스트가 없다는 점은 회귀 방지 관점의 잔여 갭이다.
  - 제안: 강한 조치는 불필요(순수 함수 커버리지가 이미 두텁고, 배선은 5곳 모두 코드 리딩으로 반복 확인됨). 저비용으로 한 곳(예: `execution-engine.service.spec.ts` 의 기존 EXECUTION_FAILED emit 테스트)에 `Bearer sk-…` 를 포함한 에러로 실행을 실패시키고 실제 emit 된 WS payload 의 `error.message` 가 마스킹됐는지 확인하는 단언 1개를 추가하면 배선-레벨 회귀를 자동으로 잠글 수 있다(우선순위 낮음).

- **[INFO]** `chat-channel.dispatcher.ts:551` 의 이중 `toTerminalErrorPayload` 재적용(이미 마스킹된 payload 를 재정규화 경로에서 다시 통과)이 fixed-point(고정점)임을 고정하는 캐너리 테스트가 없다
  - 위치: 함수 `redactTerminalError`(`codebase/backend/src/shared/utils/terminal-error-payload.ts:107-115`), 소비처 `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:551`
  - 상세: 이전 라운드(`10_19_30` requirement/side_effect)가 이 이중 호출을 분석적으로 검토해 "현재는 idempotent(이미 마스킹된 문자열에 다시 걸어도 값이 안 바뀐다)이므로 조치 불요"라고 결론냈고, 그 근거는 타당하다. 다만 그 결론이 테스트로 잠겨 있지 않다 — `SECRET_LEAK_PATTERNS` 가 향후 확장되며 우연히 `***` 자체나 이미 마스킹된 형태를 다시 매칭하는 비-idempotent 패턴이 추가되면, 이 경로가 조용히 깨져도 감지할 테스트가 없다.
  - 제안: `toTerminalErrorPayload(toTerminalErrorPayload(secretPayload))` 를 한 번 적용한 결과와 비교해 안정(fixed point)임을 고정하는 테스트 1개(우선순위 낮음, 강제 아님) — `SECRET_LEAK_PATTERNS` 확장 시 회귀를 자동으로 감지하게 한다.

## 회귀·격리·가독성 확인 (문제 없음)

- **회귀**: 기존 `describe('toTerminalErrorPayload', …)` 블록(§6.4 wire 형태 계약, 12개 테스트)의 fixture(`'boom'`, `'crash'`, 스칼라 `42`/`true`/`BigInt(9)` 등)는 어느 것도 `SECRET_LEAK_PATTERNS` 에 매칭되지 않아 마스킹 도입 후에도 값이 그대로 유지된다 — 값 대조로 회귀 없음을 재확인.
- **커버리지**: null/undefined, 레거시 문자열, 스칼라 3종(number/boolean/bigint, `it.each`), symbol, 타입가드 3필드(code/nodeId/message 비-문자열 낙하), `details` optional/`undefined`/명시적 `null` 3분기, secret 마스킹(문자열·레거시·details 중첩·JSON 재직렬화), 마스킹 비대상(code/nodeId adversarial), 참조 보존(copy-on-change), 잔여 갭 캐너리(자격증명 없는 연결 문자열/호스트명) 전부 다뤄져 있다. 스칼라/non-object 두 반환 분기의 `redactTerminalError` 래핑은 값 공간에 secret 이 존재할 수 없어 구조적으로 어떤 테스트로도 판별 불가능한데, 이 사실이 JSDoc 에 정직하게 명시돼 "전부 검증됐다"로 오독될 소지를 차단한다 — 좋은 패턴.
- **Mock 적절성**: 신규 `describe` 블록은 mock/stub 을 전혀 쓰지 않고 실제 `deepRedactSecrets`/`redactSecrets`(shared SoT)를 그대로 태우는 순수 함수 유닛테스트다. mock 과 실동작의 괴리 위험이 구조적으로 없다.
- **테스트 격리**: 각 `it` 이 리터럴을 새로 생성해 쓰므로 테스트 간 상태 공유가 없다. `deepRedactSecrets` 의 depth-0 `WeakMap` 캐시(`sanitize-error-message.ts:107`, object identity 키)는 테스트마다 새 객체 참조를 쓰므로 캐시 오염발 flaky 위험이 없다. `message` 필드는 항상 문자열이라 이 캐시 경로(object 전용) 자체를 타지 않는다.
- **가독성**: 각 `it`/`describe` 의 JSDoc/인라인 주석이 "왜 이 fixture 를 골랐는지"(판별력 있는 adversarial 값 선택 근거, 이전 라운드 W7 실패 사례 인용 등)를 근거와 함께 명시해 의도 파악이 쉽다.
- **테스트 용이성**: `toTerminalErrorPayload`/`redactTerminalError` 는 의존성 주입 없이도 순수 함수(입력→출력, 부작용 없음)라 테스트하기 쉬운 구조다. `deepRedactSecrets` 재사용도 shared SoT 를 import 하는 것뿐이라 추가 결합 없음.
- **`sanitize-error-message.ts`(execution-engine) 변경**: docstring 정정뿐이며 로직·정규식 diff 가 0줄임을 직접 대조로 확인했다 — 대응 테스트 변경이 불요하다는 판단이 타당하다.

## 요약

이 PR 은 이미 세 차례의 코드 리뷰 라운드를 거치며 테스트 관점의 실질 결함(판별력 없는 vacuous 단언, 검증 범위 과장 주장, 미고정 잔여 갭)을 전부 adversarial 입력·명시적 JSON 파싱 단언·정직하게 좁힌 JSDoc 서술로 교정했다. 이번 라운드에서 소스·스펙 파일을 직접 재대조하고 `jest` 를 독립 재실행해 **26/26 PASS** 를 재확인했으며(직접 no-op 뮤턴트 재현은 내 jest 실행 위치 실수로 완결하지 못했으나 파일은 바이트 단위로 원상 복구됨을 `git diff` 로 확인), 이전 라운드들의 실제 mutation 실행 로그(마스킹 제거 5/5 RED, code/nodeId 마스킹 2/2 RED)를 신뢰할 근거는 충분하다. 새로 찾은 것은 두 건의 저우선순위 INFO뿐이다 — (1) 5개 실제 호출부에서 마스킹이 emit 페이로드까지 실제로 반영되는지 검증하는 통합 테스트가 없고(코드 리딩으로만 확인됨), (2) `chat-channel.dispatcher` 의 이중 재정규화가 idempotent 함을 고정하는 캐너리 테스트가 없다. 둘 다 현재 동작을 깨는 결함이 아니라 미래 회귀에 대한 방어력의 미세한 여백이며, 강제 조치 사유는 아니다. 신규 Critical/Warning 은 발견되지 않았다 — 3라운드 수렴 판정에 동의한다.

## 위험도

NONE
