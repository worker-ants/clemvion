# 요구사항(Requirement) 충족 리뷰 — trigger-config-lost-update

## 검증 방법

- `trigger-config-lock.ts`(신규, 전체) · `trigger-config-lock.spec.ts`(신규, 전체) ·
  `trigger-transaction-mock.ts`(신규, 전체) · `chat-channel-binder.service.ts`(`setupChatChannel`
  전체) · `triggers.service.ts`(`update()`/`rotateBotToken()` 전체) · `triggers.service.spec.ts`
  (신규 describe 블록) · `trigger-config-lost-update.e2e-spec.ts`(전체)를 `Read`로 직접 열람
  (프롬프트가 여러 파일에 대해 "전체 컨텍스트 없음"/"diff 생략"을 명시했기 때문).
- `spec/2-navigation/4-integration.md`(Cafe24 advisory-lock 기각 선례) · `spec/5-system/15-chat-channel.md`
  (R-CC-21, `code:` frontmatter) · `plan/in-progress/trigger-config-lost-update.md` 전체를 대조.
- `plan/in-progress/spec-draft-nullable-notation-followups.md:2278` 원 트래커 항목 상태 확인.
- 이전 라운드 산출물(`review/code/2026/09/14/18_17_44/{security,testing,requirement}.md`,
  `review/consistency/2026/09/14/17_10_16/SUMMARY.md`)을 읽고, 거기서 지적된 CRITICAL이 현재
  HEAD 코드에서 실제로 해소됐는지 소스를 직접 재대조.
- 저장소에 아무것도 쓰거나 mutate하지 않았다 (`git status --short` — 이 세션 산출물 디렉터리
  1개 외 변경 없음, 확인 완료).

## 발견사항

- **[WARNING]** 신규 파일 `trigger-config-lock.ts`가 `spec/` 어떤 문서의 `code:` frontmatter
  glob에도 걸리지 않는다 — 이전 라운드(`18_17_44`)의 같은 지적이 이번 라운드까지 미해소로 남아 있다
  - 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` 블록(파일 최상단) /
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(파일 전체)
  - 상세: `grep -rn "trigger-config-lock" spec/` 0건을 재확인했다. `code:` 목록의
    `codebase/backend/src/modules/triggers/chat-channel-*.ts` 는 파일명이 `chat-channel-`로
    시작하지 않는 `trigger-config-lock.ts`를 매칭하지 않고, 다른 어떤 glob(`trigger-callback-url*.ts`,
    `triggers.service.ts` 명시 경로 등)에도 걸리지 않는다. 이 문서의 R-CC-22 자체가 "새
    `triggers/` 파일이 명시 경로/부분 glob에서 계속 누락된다"는 패턴(#1317·#1319·#1320)을 막으려던
    절인데, 이번 PR이 만든 파일이 그 절의 커버리지 밖에 남아 이 문서가 스스로 경계하던 문제의
    네 번째 재발이 이어지고 있다. `plan/in-progress/trigger-config-lost-update.md`의
    `--impl-prep` planner 인계 표에 "spec의 `code:` glob이 `trigger-config-lock.ts`를 안 문다"로
    이미 등재돼 있어 은폐된 지적은 아니다 — 다만 `spec/` 편집은 developer 권한 밖이라 이 PR
    자체에서 해소될 수 없는 구조적 갭이고, planner 턴이 실제로 처리하기 전까지는 이 파일 단독
    변경 시 review-guard의 spec-linked 강제(`--impl-done`)를 못 받는 상태가 계속된다.
  - 제안: 코드 수정 대상이 아니다(`spec/` 는 developer 권한 밖). planner 턴에서
    `spec/5-system/15-chat-channel.md` 또는 advisory-lock 선례가 있는
    `spec/5-system/4-execution-engine.md`의 `code:`에 이 파일을 명시 추가하거나 glob을 확장할
    것을 그대로 유지된 등재 항목으로 처리 요청.

- **[INFO]** 원 트래커 항목(`plan/in-progress/spec-draft-nullable-notation-followups.md:2278`)이
  아직 `[ ]`로 열려 있다 — plan 자체의 완료 체크리스트도 동기화 대기 중
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2278`
    (`- [ ] **동시 PATCH 가 trigger.config 를 잃을 수 있다 (lost update) ...**`)
  - 상세: `review/consistency/2026/09/14/17_10_16/SUMMARY.md` plan_coherence #6이 "본 plan
    종결 커밋에서 원 트래커 항목도 `[x]` + 실측 각주(창이 넷이었다는 정정)로 동시 갱신"을
    요구했고, `trigger-config-lost-update.md` 자신의 체크리스트도 그 항목과
    `run-test-all.sh`·`/ai-review + --impl-done`을 아직 `[ ]`로 남겨 뒀다. 코드 결함은 아니고,
    이 리뷰 라운드 자체가 그 `--impl-done` 절차의 일부이므로 절차상 자연스러운 중간 상태로
    보인다. 다만 이 PR을 병합 완료로 간주하기 전에 두 문서 동기화가 남아 있다는 사실은
    기록해 둔다(이 저장소 메모리 교훈 "plan 체크박스 = 실제 상태" 적용 대상).
  - 제안: 이 라운드가 Critical 0·Warning 0으로 수렴하면, 완료 커밋에서 두 plan 문서(원 트래커 +
    본 plan)를 함께 갱신할 것.

## 상세 검증 결과 (긍정 확인 — 새 발견 아님, 이전 라운드 CRITICAL의 해소 여부 재확인)

- **window 1(`update()`의 `save(trigger)`) 보안 CRITICAL 해소 확인**: 이전 라운드
  (`18_17_44/security.md` CRITICAL#1)가 지적한 대로, `chatChannel`을 전혀 싣지 않은 PATCH도
  `mergeExternalConfig`가 요청 시작 시점 스냅샷을 기준으로 `config`를 통째로 덮어 동시 확립된
  `inboundSigningRef`를 되돌릴 수 있었다. 현재 HEAD(`triggers.service.ts:549-576`)는 이 병합·저장
  전체를 `manager.transaction` + `pg_advisory_xact_lock(triggerConfigLockKey(trigger.id))` 안에
  넣고, `baseConfig`를 락 안에서 재읽은 `fresh?.config`(요청이 `config`를 명시하지 않은 한)로
  계산하도록 고쳤다 — 재현 시나리오가 더 이상 성립하지 않는다. `save(trigger)` 저장 동사 자체는
  그대로 유지해 반환 엔티티/subscriber/`endpointPath` UNIQUE 충돌 경로(단위 6건 RED였다는 실측)를
  깨지 않았다.
- **테스트 CRITICAL#2·#3(뮤테이션 미보호) 해소 확인**: 이전 라운드가 실측(뮤턴트로 핵심 로직 제거
  → 279건 전부 GREEN)한 갭을, `triggers.service.spec.ts`의 신규 describe
  `'TriggersService — 락 안 재읽기가 동시 확립분을 본다 (lost update)'`가 `freshFindOne` 순서열로
  "최초 읽기 ≠ 락 안 재읽기"를 만들어 5개 케이스로 닫았다 — `buildChannel`의
  `survivesWithFresh` 항, 창 1 게이트, `chatChannel` 미포함 PATCH, `rotateBotToken` 머지 각각을
  개별적으로 죽이는 뮤턴트-대응 케이스가 존재함을 소스에서 직접 확인했다(`triggers.service.spec.ts`
  :3719-3777). `rewriteTriggerConfigLocked`의 "행 삭제됨" 미검증 WARNING도
  `trigger-config-lock.spec.ts`(신규, 전용 suite)의 `'행이 사라졌으면 쓰지 않고 false 를
  돌려준다'` 케이스로 닫혔다(`merge`/`update` 미호출까지 단언).
- **presence 게이트 알고리즘**: `survivesWithFresh(freshConfig) = inboundSigningRefSurvives ||
  Boolean(freshConfig?.chatChannel?.inboundSigningRef)`가 plan §B가 요구한 3항 OR과 정확히
  일치하고, 성공(`result` 있음)·실패(catch) 두 경로가 `buildChannel` 하나를 공유해 대칭이다.
- **`rotateBotToken`이 같은 presence 게이트를 갖지 않는 것은 결함이 아니라 정합**:
  `inboundSigningRef`는 그 함수 안에서 `chatChannelCfg.inboundSigningRef ?? buildSecretRef(...)`
  로 계산되는데, `buildSecretRef`는 `triggerId` 로만 결정되는 **결정적** 문자열이라 락 밖
  스냅샷에서 읽든 락 안 재읽기에서 읽든 같은 값이 나온다 — `botTokenRef`와 동일한 이유로
  presence 게이트가 애초에 불필요하다. plan §A 체크리스트의 "실측: 갖지 않는다" 결론과 코드가
  일치한다.
- **락 배치와 spec 대조**: `rewriteTriggerConfigLocked`의 세 호출부 모두 `adapter.setupChannel`
  (외부 HTTP)을 advisory lock **이전**에 이미 완료한 뒤 호출한다 — `spec/2-navigation/4-integration.md
  :1444`가 Cafe24 토큰 갱신에서 "lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션
  점유 시간이 늘고"를 이유로 advisory lock을 명시적으로 기각한 선례를 그대로 인용한 JSDoc이
  실제 배선과 line-level로 일치한다(spec 본문 인용이 정확함을 직접 확인).
- **엣지 케이스**: `fresh.config ?? {}`로 null 방어, `config`가 `columns` 스프레드보다 뒤에 와
  실수로 컬럼이 `config`를 덮지 않음(`trigger-config-lock.spec.ts`의 스프레드 순서 테스트로
  고정), 재읽기 시점 트리거 삭제 시 `false` 반환 + 쓰기 skip(문서화·의도적, 3 호출부 모두
  best-effort로 무시 — 이전 라운드 INFO로 이미 등재, 신규 아님).
- **e2e 판별력**: `trigger-config-lost-update.e2e-spec.ts`가 advisory lock을 테스트가 직접 쥐어
  겹침을 강제하고, telegram provider를 택한 이유(slack/discord는 PATCH DTO가
  `inboundSigningPlaintext`를 `OmitType`으로 갖지 않아 결함의 전제인 "ref 최초 확립"을 재현할 수
  없음)를 실측으로 뒷받침한다. `mergeExternalConfig`(`triggers.service.ts:843-854`)가 `{...base}`
  로 top-level 키를 보존하고 명시된 `notification`/`interaction`/`chatChannel`만 교체함을 직접
  확인해, e2e의 "손대지 않은 키(`untouchedByPatchB`) 생존" 단언(③)이 실제 구현과 논리적으로
  정합함을 코드 추적으로 검증했다.
- **이 PR이 확장하지 않은 범위는 문서화·근거와 함께 정직하게 defer됨**: `plan §D`의 전수 열거
  (같은 whole-key-replace/무가드 full-entity save 패턴을 가진 자리 19곳, 그중 10곳이
  `save(entity)`)와 `normalizeNotificationSecretRef`(`triggers.service.ts:735-766`, 이 PR이
  건드리지 않음 — window 1 커밋 이후 별도 unlocked `save`라 이론상 같은 클래스의 lost-update
  창이지만 `notification.signing`에 한정되고 보안-critical한 `inboundSigningRef`와는 무관)를
  포함해 "이 PR로 넓히지 않는다"고 명시하고 후속 항목으로 등재했다 — 은폐된 회귀가 아니라
  추적된 백로그.

## 요약

이 PR은 동시 PATCH가 `trigger.config`(특히 `chatChannel.inboundSigningRef`)를 잃어 인입 웹훅
서명 검증이 fail-open으로 되돌아가는 결함을, 트리거 단위 advisory lock + 락 안 재읽기
(`rewriteTriggerConfigLocked`)로 닫는다. 핵심 알고리즘(presence 게이트를 컨테이너가 아니라
서브키 수준에서 락 안에 재계산)은 `--impl-prep` WARNING을 정확히 반영했고, 네 쓰기 지점(창
1~4) 전부가 같은 원칙으로 배선됐다. 특히 이전 라운드(`18_17_44`)가 낸 두 CRITICAL — (1) window
1을 통한 fail-open 재현 가능성, (2) 뮤테이션으로 실측된 unit 테스트 미보호 — 를 후속 커밋
(`12ed21ff1`, `30301008c`)이 각각 소스 수준에서 정확히 해소했음을 직접 코드 대조로 확인했다.
남은 갭은 기능 결함이 아니라 (1) 신규 파일이 spec의 `code:` glob 어디에도 안 걸려 향후 단독
변경 시 spec-linked 리뷰 게이트를 못 받는 커버리지 문제(WARNING, 이미 planner 인계로 등재돼
있으나 아직 미해소)와 (2) 원 트래커 항목·본 plan 체크리스트의 완료 동기화가 아직 남아 있다는
절차적 사실(INFO)뿐이다. `rotateBotToken`이 presence 게이트를 갖지 않는 것, window 1의
`save(trigger)` 저장 동사를 유지한 것, `normalizeNotificationSecretRef` 등 나머지 9곳을 이번
배치에서 확장하지 않은 것은 모두 실측 근거와 함께 의도적으로 범위 밖에 남겨졌고 plan에 투명하게
기록돼 있어 은폐된 회귀가 아니다. TODO/FIXME/HACK/XXX 마커는 변경된 파일 어디에도 없다.

## 위험도

LOW
