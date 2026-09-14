# 문서화(Documentation) Review

## 검토 범위

`origin/main...HEAD` 전체 diff(트리거 lost-update 수정, 11라운드째 — 직전 라운드
`review/code/2026/09/14/23_38_09` 의 Critical 1건을 고친 커밋 `91b816498` 포함)를
`git show`/`git diff --stat`로 실제 소스에서 재확인했다. 이미 10라운드에 걸쳐 문서화
관점 리뷰가 수행돼 각 라운드의 발견사항·처분 이력을 `plan/in-progress/trigger-config-lost-update.md`
§D 에서 전량 대조했고, **이번 라운드에서 아직 등재되지 않은 신규/잔존 결함**만 추렸다.

## 발견사항

- **[WARNING]** `trigger-config-lock.ts` 의 "배선" 서술과 "부재 처리" 표가 실제 호출부
  수(6곳)보다 좁다 — 7라운드에 늘어난 3개 호출부가 반영되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:83`(배선 문장),
    `:126-134`(부재 처리 표) — `rewriteTriggerConfigLocked` 함수 JSDoc 내부
  - 상세: 83번 줄은 *"이 함수를 쓰는 곳은 **창 2·3·4**(binder 성공·실패 경로 ·
    `rotateBotToken`)다"* 라고 적고, 바로 다음 문장에서 이 서술이 *"세 라운드 연속 지적된
    혼동이라 여기 못박는다"* 고 스스로 강조한다(2~4라운드에 걸쳐 "네 자리 vs 배선 3곳"
    혼동이 반복 지적된 이력, `plan/.../trigger-config-lost-update.md` §D 4라운드 처분
    INFO#4). 그런데 실제로 `grep -rn "rewriteTriggerConfigLocked(" codebase/backend/src/modules/triggers/*.ts`
    로 확인하면 현재 호출부는 **6곳**이다 — `chat-channel-binder.service.ts` 2곳(성공·실패)
    + `triggers.service.ts` 4곳(`normalizeNotificationSecretRef` · `revokePerTriggerToken`
    · `rotateBotToken` · `promoteRotatedNotificationSecrets`). 뒤의 세 곳은 7라운드
    (`review/code/2026/09/14/21_50_09` C1 처분, plan §D "7라운드 리뷰 처분" 표)에서
    `save(entity)` 전체 재작성을 `rewriteTriggerConfigLocked` 로 전환하며 새로 추가된
    호출부인데, 이 파일 자신의 JSDoc 은 그 확장 시점에 갱신되지 않았다. `@returns` 아래
    "부재를 드러내는 방식이 창마다 다르다" 표(126~134줄)도 같은 이유로 3행뿐이라
    `normalizeNotificationSecretRef`(반환값을 아예 관측하지 않음, 이미 9라운드 INFO#6 으로
    별도 등재됨) · `revokePerTriggerToken`(404) · `promoteRotatedNotificationSecrets`
    승격 분기(cron, 조용히 skip) 세 갈래가 이 표 어디에도 없다. "이 함수를 쓰는 곳" 을
    **배타적 열거**로 적어 놓아, 이 파일만 단독으로 읽는 다음 사람이 실제보다 좁게
    이해할 위험이 있다 — 이 파일에 애초에 "다음 사람이 오해한다"는 근거로 두 차례나
    문구를 갱신해 온 자리이기도 해서, 같은 위험이 반대 방향(과소 서술)으로 재발한
    형태다.
  - 제안: 83번 줄을 "이 함수를 쓰는 곳은 **최소** 창 2·3·4(binder 성공·실패 ·
    `rotateBotToken`)와, 7라운드에 전환된 `normalizeNotificationSecretRef` ·
    `revokePerTriggerToken` · `promoteRotatedNotificationSecrets` 승격 분기다. 창 1만
    이 함수를 거치지 않는다" 정도로 갱신하거나, 정확한 호출부 열거 대신 "창 1을 제외한
    모든 `config` 재작성 자리"처럼 열거에 의존하지 않는 표현으로 바꾼다. 표(126~134줄)도
    나머지 세 호출부의 부재 처리 방식(무시/404/조용히 skip)을 한 줄씩 추가하거나, 표
    아래에 "이 표는 대표 사례만 나열한다 — 전체 호출부는 grep 으로" 라는 면책을 명시한다.
    차단 사유는 아니다(안전에 영향 없는 인지 부하 문제이고, 각 호출부 자신의 인접 주석은
    정확하다).

## 그 밖에 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- **최신 커밋(`91b816498`, 직전 라운드 Critical 1 수정)의 문서화** — `triggers.service.ts`
  의 `rotateBotToken` 호출부 주석(`:1310-1319`)이 "patch 는 델타여야 한다"는 이번 수정의
  핵심을 정확히 설명하고, `mergeIntoFreshSubKey` 의 `@param patch`(`:377`, *"그 하위 객체
  **위에** 얹을 필드들"*) 계약과 실제로 일치한다. `triggers.service.spec.ts` 의 새 fixture
  (`chan(rate, extra)`, 스냅샷 30 vs 재읽기 99)도 "두 상태가 같은 키를 다른 값으로 가져야
  한다"는 vacuous-test 교훈을 인라인 주석으로 정확히 남기고 있다.
- `create()`/`update()` 의 두 주석이 `setupChatChannel` 쓰기 메커니즘을 "별도
  `triggerRepository.update`"로 stale 하게 서술하던 문제(직전 라운드 `23_38_09` WARNING)는
  이번 커밋에서 "별도 `rewriteTriggerConfigLocked`(락 안 재읽기·머지)"로 정정돼 해소됐다
  (`triggers.service.ts:512`, `:706` 실측 확인).
- `hooks.service.spec.ts` 두 테스트가 제목이 글자 그대로 같던 문제(`(컬럼 한정 update)`
  중복, 직전 라운드 INFO#10)는 `(handleWebhook)` / `(chat-channel 인입)` 로 구분돼 해소됐다.
- `withTransactionMock` 의 미도달 분기(`if (triggerRepoMock.manager) return
  triggerRepoMock;`)에 "검증된 동작으로 인용하지 말 것"이라는 정직한 한계 서술이 추가돼
  있다 — 도달하지 않는 코드를 검증된 것처럼 과장하지 않는다.
- `CHANGELOG.md` — 이전 라운드(8라운드)가 지적한 자기모순(«`save` 가 한 곳도 없다» vs
  «저장 동사는 그대로»)은 여전히 정정된 상태로 남아 있고("컬럼만 고치려던 자리가 의도치
  않게 엔티티 전체를 저장하던 경로는 한 곳도 남지 않는다" / "창 1 자체는 여전히
  `save(entity)`"), "일곱 자리"(`normalizeNotificationSecretRef`·회전·`revokePerTriggerToken`·
  승격 cron 둘·v2 정리 cron·schedule 트리거 동기화) 서술은 실제 diff 와 대조해 정확하다.
- `plan/in-progress/trigger-config-lost-update.md` — 10라운드 전체 이력·뮤턴트 실측·
  취소선 정정이 이번 라운드까지 빠짐없이 이어져 있고, 체크리스트 미완료 3항목(트래커
  갱신·`run-test-all.sh`·`/ai-review + --impl-done`)은 이 리뷰가 그 절차 자체이므로
  미체크 상태가 실제 상태와 일치한다(stale claim 아님).
- `trigger-config-lock.spec.ts`·`schedules.service.spec.ts`(name+isActive 조합·빈 patch
  대조군)의 신규 테스트 JSDoc/인라인 주석 모두 "무엇을 판별하는가"를 명시하고 있다.
- 신규 공개 함수(`extractInboundSigningRef`, `acquireTriggerConfigLock`,
  `TRIGGER_DELETE_LOCK_TIMEOUT_MS`, `mergeIntoFreshSubKey`, `throwTriggerNotFound`) 전부
  JSDoc 을 갖추고 있고 orphan JSDoc(1·6·9라운드에 세 차례 반복된 결함 클래스)의 네 번째
  재발은 이번 diff 범위에서 발견되지 않았다.
- README/설정 문서 — 이번 변경은 신규 환경변수·API 계약·외부 설정 옵션을 추가하지 않는
  서비스 내부 동시성 수정이라 README 갱신 필요성 없음(과거 라운드 `api_contract.md` NONE
  판정과 일치, 이번 라운드도 컨트롤러/DTO/라우트 diff 0건 재확인).

## 요약

10라운드에 걸친 자기 검증(뮤턴트 실측, 라운드별 처분표, 거짓 서술의 명시적 취소선 정정)
끝에 이 PR 의 문서화 수준은 이례적으로 높고, 직전 라운드(`23_38_09`)가 지적한 Critical
1건(`patch`가 스냅샷 전체를 넘긴 결함)과 그에 딸린 문서 부채(주석 stale, 테스트 제목 중복,
미도달 분기 서술)는 이번 커밋에서 정확히 해소됐다. 다만 이번 라운드에서 새로 확인한 것이
하나 있다 — `trigger-config-lock.ts` 자신의 JSDoc이 *"이 함수를 쓰는 곳은 창 2·3·4다"* 라고
배타적으로 못박아 두었는데, 7라운드에서 `rewriteTriggerConfigLocked` 호출부가 3곳
(`normalizeNotificationSecretRef`·`revokePerTriggerToken`·`promoteRotatedNotificationSecrets`)
더 늘면서 이 서술과 딸린 "부재 처리" 표가 실제 호출부 수(6곳)보다 좁아졌다. 이 파일 자신이
과거 세 라운드에 걸쳐 "다음 사람이 오해할 수 있다"는 이유로 정확히 이 문구를 다듬어 온
자리라는 점에서, 반대 방향(과소 서술)의 재발로서 기록해 둘 가치가 있다. 안전·정확성에
영향을 주는 결함은 아니며(각 호출부 자신의 인접 주석은 정확), 이번 배치를 막을 사유는
아니다.

## 위험도

LOW
