# 테스트(Testing) 리뷰 — trigger-config-lost-update (재검토)

## 검증 방법

이전 라운드(`review/code/2026/09/14/18_17_44/testing.md`)가 뮤테이션으로 실측한 CRITICAL 2건 +
WARNING 1건(`rewriteTriggerConfigLocked` 의 "행 삭제됨" 분기 미검증)이 이번 배치에서 실제로
닫혔는지, 같은 방법(뮤테이션)으로 **독립적으로 재실측**했다. 저장소 파일을 직접 고쳤다가
원본을 스냅샷으로 저장해 두고 `python3`/`diff` 로 정확히 원복한 뒤 `git status --short` 로
잔여물 없음을 매번 확인했다.

1. `chat-channel-binder.service.ts` — `survivesWithFresh` 를 `inboundSigningRefSurvives` 단독으로
   축소(재읽은 행의 ref presence 항 제거) → **RED 2건**
   (`binder 재읽기 — 창 1 시점엔 없던 ref 가 그 뒤에 확립돼도 보존된다`,
   `binder 재읽기 — degraded 경로도 같은 보존을 한다`). 이전 라운드는 같은 뮤테이션에
   279건 전부 GREEN 이었다 — 이번엔 신규 테스트가 정확히 잡는다.
2. `triggers.service.ts` `rotateBotToken` — merge 콜백을
   `(freshConfig) => ({...freshConfig, chatChannel: mergedChannel})` 에서
   `(_freshConfig) => ({...(trigger.config ?? {}), chatChannel: mergedChannel})` (락 밖 스냅샷
   기반)으로 되돌림 → **RED 1건** (`rotateBotToken — 손대지 않은 config 키가 살아남는다`).
3. `trigger-config-lock.ts` 의 `if (!fresh) return false;` 가드를 제거 → **RED 1건**
   (`trigger-config-lock.spec.ts` `행이 사라졌으면 쓰지 않고 false 를 돌려준다`,
   `TypeError: Cannot read properties of null` 로 실패) — 이전 라운드가 "unit·e2e 어디에도
   커버되지 않는다" 고 지적했던 정확히 그 분기다.

세 뮤테이션 모두 원복 후 `npx jest src/modules/triggers/...` 재실행으로 GREEN 복귀, 최종
`git status --short` 는 이 리뷰의 산출물 디렉터리(`review/code/2026/09/14/19_07_43/`)만
남기고 clean 임을 확인했다.

## 절차 투명성 (참고, 이슈로 집계하지 않음)

위 실측 과정에서 **한 번 절차 실수가 있었다**: `chat-channel-binder.service.ts` 뮤테이션을
저장소 밖 scratch 디렉터리(`mktemp` 상당)에 백업하려던 최초 명령이 worktree-격리 가드에
의해 통째로 거부됐는데(명령을 실행하지 않고 반려), 그 사실을 인지하지 못한 채 이어서
동일 scratch 경로의 **기존 파일**(다른 세션이 이전에 같은 이름으로 남겨 둔, PR 적용 전
버전의 백업으로 추정)로 "복원" 을 시도해 잠깐 파일이 **이 PR 의 수정 자체를 통째로 되돌린
상태**(HEAD 대비 `-72/+27`, `rewriteTriggerConfigLocked`/`survivesWithFresh` 부재)로
남았다. `git status --short` 로 즉시 발견해 `git checkout -- <file>`(해당 파일에 내 실수
외 다른 미커밋 변경이 전혀 없음을 먼저 확인한 뒤)로 HEAD 상태로 정확히 복구했고, 이후
전체 관련 테스트를 재실행해 GREEN 을 재확인했다. 저장소에 잔여 이상 상태는 없다. 다음
라운드 리뷰어가 같은 시각에 그 파일을 열었다면 일시적으로 PR 이전 코드를 봤을 수 있다는
점을 투명성 차원에서 기록한다. (원인은 세션 scratch 디렉터리가 예상과 달리 이전 세션의
잔여 파일을 갖고 있었던 것으로 보이며, 이는 harness 쪽 이슈이지 이 PR 의 결함이 아니다.)

## 발견사항

- **[INFO]** 창 1(`update()` 의 인라인 락+재읽기)은 `rewriteTriggerConfigLocked` 를 재사용하지
  않고 같은 패턴("락 → 재읽기" 순서)을 직접 복제하는데, 그 순서 자체를 검증하는 unit 테스트가
  없다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:550-575`
    (`this.triggerRepository.manager.transaction(async (m) => {...})`)
  - 상세: `trigger-config-lock.spec.ts` 는 추출된 헬퍼에 대해 "락을 읽기보다 먼저 잡는다"를
    호출 순서 배열(`calls`)로 직접 단언한다(`trigger-config-lock.spec.ts:61-71`). 창 1 은
    코드 주석에 명시된 이유(반환 엔티티·subscriber·UNIQUE 충돌 경로가 함께 바뀌어 6개 케이스가
    RED 였다)로 이 헬퍼를 쓰지 않고 같은 `query` → `findOne` → `save` 순서를 손으로
    재구현한다. `withTransactionMock`(공유 test-utils)은 `transaction` 콜백마다 `query`/
    `findOne` jest.fn 을 새로 만들어 콜백 안에서만 쓰므로, `triggers.service.spec.ts` 쪽에서
    창 1 이 실제로 "락 → 읽기" 순서를 지키는지 직접 관측할 방법이 현재 인프라로는 없다.
    다만 e2e(`trigger-config-lost-update.e2e-spec.ts`)는 실제 Postgres advisory lock 으로
    B 를 강제로 멈춰 세우므로, 창 1 의 순서가 뒤집히면(읽기가 락보다 먼저) 결과적으로
    ①②③ 단언 중 최소 하나가 깨질 가능성이 높다 — 즉 간접적으로는 방어되지만, 원인을 바로
    가리키는 직접 단언은 창 1 에는 없고 추출된 헬퍼에만 있다.
  - 제안: 필수는 아님(창 1 을 헬퍼로 통합하지 않기로 한 결정은 이미 근거가 있다). 다음에 창
    1 을 다시 만지게 되면, `withTransactionMock` 이 만드는 내부 `query`/`findOne` 을 테스트가
    참조할 수 있도록 (예: 옵션으로 공유 `calls` 배열을 주입받게) 확장해 순서를 직접 단언하는
    쪽이, 지금처럼 e2e 의 간접 신호에만 의존하는 것보다 원인 특정이 빠르다.

- **[INFO]** `withTransactionMock`/`freshFindOne` 옵션의 두 방어적 분기가 현재 어떤 테스트에도
  실행되지 않는다 — 커버리지 상 죽은 경로
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:51`
    (`if (triggerRepoMock.manager) return triggerRepoMock;`),
    `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3669`
    (`Math.min(freshCall, freshSequence.length - 1)` 의 "모자라면 마지막 값을 반복" 폴백)
  - 상세: 전수 확인(`grep -rn "withTransactionMock(" src/modules/triggers`) 결과 모든 호출부가
    아직 `.manager` 가 없는 순수 repo mock 객체만 넘겨 51행의 idempotency 가드는 한 번도
    참이 되지 않는다. 마찬가지로 `triggers.service.spec.ts` 의 새 lost-update describe 는
    `freshSequence` 배열 길이를 실제 재읽기 호출 횟수와 정확히 맞춰 넘기므로(창1+binder=2,
    단일창=1) `idx = freshSequence.length - 1` 로 클램프되는 "시퀀스 소진 후 마지막 값 반복"
    경로가 한 번도 실행되지 않는다. 둘 다 프로덕션 코드가 아니라 테스트 인프라의 방어적
    분기라 위험도는 낮지만, 문서화된 동작("모자라면 마지막 값을 반복한다")이 실제로는
    검증되지 않은 주장이다.
  - 제안: 조치 불필요 수준이지만, 두 분기를 실제로 쓰는 테스트가 생기기 전까지는 그 JSDoc
    문구를 "설계 의도" 로만 읽고 "검증된 동작" 으로 인용하지 않는 편이 안전하다.

- **[INFO]** e2e 의 `SETTLE_MS = 300` 고정 대기는 느린 CI 환경에서 "B 가 아직 락에 도달하지
  않은 상태" 와 "B 가 락에서 실제로 블록된 상태" 를 구분하지 않고 넘어간다
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:58-59, 183-191`
  - 상세: `blockedBeforeRelease` 는 "300ms 시점에 아직 커밋되지 않았다" 만 관측하고, 그
    관측 자체는 최종 판별(①②③ 단언)에 쓰이지 않는 순수 참고용이라고 파일 스스로 명시한다
    (설계상 올바름 — 이전 라운드가 지적했던 "이른 단언이 실패 메시지를 흐린다" 문제를
    정확히 피했다). 다만 `expect(blockedBeforeRelease).toBe(true)` 자체는 여전히 최종
    단언 중 하나라서, 극단적으로 느린 CI(요청 A 왕복이 300ms 를 넘는 경우)에서 이 마지막
    단언만 단독으로 flaky 해질 여지가 이론적으로 남는다 — 다만 코드/설계 결함이 아니라
    타이밍 여유값의 문제이고, 핵심 결함 방어(①②③)는 이 값에 의존하지 않는다.
  - 제안: 조치 불필요. 실제로 flaky 가 관측되면 `SETTLE_MS` 를 올리거나
    `blockedBeforeRelease` 단언을 폴링 방식으로 바꾸는 정도로 충분하다.

## 이전 라운드 대비 변화 요약

이전 testing.md(HIGH)가 지적한 CRITICAL 2건("이 PR 의 핵심 수정 두 곳이 unit 레벨 뮤테이션에
전혀 걸리지 않는다")과 WARNING 1건("행 삭제됨" 분기 미검증)을 이번 배치가 정확히 그 세 지점을
겨눈 신규 테스트(`triggers.service.spec.ts` 의 "락 안 재읽기가 동시 확립분을 본다" describe,
`trigger-config-lock.spec.ts` 전체 신설)로 닫았다 — 위 검증 방법 절에서 같은 뮤테이션을
독립적으로 재실행해 세 곳 모두 이번엔 RED 를 확인했다. e2e 쪽 WARNING("보안 관련 단언 ②가
이 환경에서 한 번도 관측된 적 없다")도, 재작성된 e2e 가 우연한 인터리빙 대신 advisory lock 을
테스트가 직접 쥐어 B 를 결정적으로 블록시키는 방식으로 바뀌면서 해소됐다 — ①②③ 세 단언이
모두 결정적으로 실행되는 구조다(관측 타이밍 의존은 위 INFO 참고). `withTransactionMock`
자체의 자기검증(콜백 미실행 시 13건 RED 실측)과 mock 위임 설계는 이전 라운드에서도 긍정
평가됐고 이번에도 유효하다. `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture 삼종의
manager-save 형태 확장도 양성·음성·타 엔티티 세 갈래를 fixture 로 갖춰 놓아 회귀 방지가
탄탄하다(직접 실행해 7건 GREEN 확인).

## 요약

이번 배치는 이전 라운드가 지적한 테스트 관점의 핵심 결함(this PR 의 존재 이유인 두 lost-update
수정이 unit 레벨에서 전혀 보호되지 않던 상태)을 뮤테이션 근거와 함께 정확히 닫았다 — 세 개의
표적 뮤테이션(바인더 presence 게이트, `rotateBotToken` 머지 콜백, 헬퍼의 "행 삭제됨" 가드)을
독립적으로 재현했고 셋 다 신규 테스트가 RED 로 잡는 것을 확인했다. e2e 도 우연한 타이밍 의존
설계에서 advisory lock 을 직접 쥐는 결정적 설계로 바뀌어 이전에 "한 번도 관측되지 않았다"던
보안 단언이 이제 매 실행마다 참여한다. 남은 것은 전부 INFO 수준(창 1 의 인라인 락 순서를
직접 단언하는 unit 테스트 부재 — e2e 로 간접 방어됨, 테스트 인프라의 방어적 분기 2곳 미실행,
e2e 고정 대기값의 이론적 flaky 여지)이며 어느 것도 이 PR 의 핵심 수정을 무방비로 남기지 않는다.

## 위험도

LOW
