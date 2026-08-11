# 문서화(Documentation) Review — `12_56_06` (커밋 `f5d485a52` delta 재검토)

## 확인 범위 (호출자 지시)

1. `12_37_14` documentation/requirement 가 WARNING 으로 지목한 "앞의 둘" 위치 수식어 오류가
   이번 델타(`f5d485a52`)에서 정확히 정정됐는가 — **정정문이 다시 새 부정확을 들여왔는가**
   (2연속 그랬던 패턴이므로 3번째를 의심).
2. 신규 테스트(`triggers.service.spec.ts` — "저장이 실패하면 감사를 남기지 않는다 (회전 2종)")의
   docstring 이 실제 동작·"왜 기존 테스트로 부족한가"의 근거와 일치하는가.
3. `review/code/2026/08/11/12_22_23/{SUMMARY,RESOLUTION}.md` (사후 재구성 문서)가 리포트 7개의
   실제 내용과 대조해 과장·누락이 없는가.
4. `plan/in-progress/spec-sync-auth-gaps.md` 신규 등재 문구가 남은 갭을 정확히 서술하는가.

방법: `git show f5d485a52`/`9eb2c6088` 로 실제 diff 를 직접 확인하고, 정정된 두 위치
(`audit-action.const.ts:90-92`, `spec/5-system/1-auth.md:431`)를 `triggers.service.ts` 의
세 메서드 반환 타입과 line-level 대조했다. 신규 테스트(`triggers.service.spec.ts:2423-2454`)를
직접 읽어 인접 테스트(`:2410-2421`, before-state)와의 관계를 확인했다. `12_22_23`/`12_37_14`
세션의 리포트 원문(`documentation.md`, `testing.md`, `security.md`, `requirement.md`,
`side_effect.md`, `maintainability.md`, `scope.md` 전부)을 직접 열어 SUMMARY/RESOLUTION 의
문장 하나하나와 대조했다.

## 발견사항

### [INFO] 정정된 두 문장은 이제 정확하다 — 3연속 오류는 없다

- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:90-92`,
  `spec/5-system/1-auth.md:431`
- 상세: "앞의 둘" (위치 수식어, 나열 순서 1·2번째를 가리키는데 실제 지목 대상은 1·3번째라는
  `12_37_14` WARNING)을 두 곳 모두 "`notification_secret_rotated`·`interaction_token_revoked`
  만 응답에 새 자격증명을 1회 평문 반환한다"로 **이름 직접 명시**로 바꿨다. `triggers.service.ts`
  를 직접 대조:
  - `rotateNotificationSecret` → `return { secret: newSecret, rotatedAt: ... }` (`:932-935`) — 평문 반환 확인.
  - `revokePerTriggerToken` → `return { token: newToken }` (`:980`) — 평문 반환 확인.
  - `rotateBotToken` → `return { rotatedAt, triggerId, chatChannelHealth, botIdentity }` (토큰 필드 없음) — 반환 안 함 확인. `newBotToken` 은 호출자 입력(`body.newBotToken`)이지 서버 생성값이 아님.
  세 메서드 모두와 line-level 로 일치한다. 위치 의존 표현("앞의")을 완전히 제거해 향후
  나열 순서가 바뀌어도 깨지지 않는 형태로 바뀐 것도 확인.
- 부수 확인: `CHANGELOG.md:67` 의 별도의 "앞의 둘"(grace 유무 기준 — notification+chat_channel_bot,
  실제로 표의 1·2번째 행과 일치)은 이번 델타에서 건드리지 않았고 `12_37_14/documentation.md` 가
  이미 "이건 맞다"고 확인한 것과 동일 — 재확인 결과도 일치, 조치 불필요.
- 저장소 전수 재검색(`grep -rn "앞의 둘\|셋 다 반환\|모두 응답에 새" codebase/backend spec CHANGELOG.md plan`)
  결과, 남은 매치는 (a) `audit-action.const.ts:92` 의 "이 주석의 첫 판은 셋 다 반환한다고
  적었고" — 이력 서술이라 과거형으로 정확, (b) `CHANGELOG.md:67` — 위에서 확인한 대로 다른
  그룹을 가리켜 정확. 문제 있는 매치 0건.
- 판단: **새 CRITICAL 없음.** 3번째 시도에서 위치 수식어를 아예 없애는 형태(이름 직접 명시)로
  바꿔 같은 결함 클래스(순서 의존 표현의 재발)가 구조적으로 재발할 여지를 줄였다.

### [INFO] `audit-action.const.ts` 주석의 줄바꿈이 다소 어색해졌다 — 사실관계 문제 아님

- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:90-93`
- 상세: 정정 결과 문장이 길어지면서 "이 주석의 첫 판은 셋 다 반환한다고 적었고" 가 단독 줄로
  분리되고 "그건 사실이 아니었다 — ai-review `12_22_23` documentation.)*" 가 그 다음 줄에
  이어진다 — 4줄 주석 블록 안에서 자연스러운 문장 흐름이 살짝 끊긴다(라인 90 끝 "평문을",
  91 끝 "응답에", 92 "이 주석의 첫 판은 셋 다 반환한다고 적었고"로 줄바꿈 지점이 어절 중간이
  아니라 절 경계이긴 하나, 92번째 줄이 유독 짧다). 순수 line-wrap 부수효과이며 내용 오류는
  아니다.
- 제안: 없음 — 등재만. 다음에 이 주석을 만질 때 줄바꿈을 재정렬하면 좋다.

### [INFO] 신규 테스트 docstring — 서술이 코드·근거와 정확히 일치

- 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:2423-2454`
  (`it('저장이 실패하면 감사를 남기지 않는다 (회전 2종 — 검증이 아니라 save 가 던진다)', ...)`)
- 검증한 주장과 실측:
  1. **"위 테스트만으로는 부족하다 — 거기서 던지는 것은 `save()` 앞의 검증 예외"**: 바로 위
     테스트(`:2410-2421`, `rotateNotificationSecret 가 던지면 감사를 남기지 않는다`)는
     `config: {}` 로 `NOTIFICATION_NOT_CONFIGURED` 검증 예외를 유도한다 — 이 분기는
     `newSecret` 생성·`trigger.save()` **이전**에 있다(`triggers.service.ts:907-918` 검증
     블록 → `:919` 이후 `randomBytes`/`save`). 서술이 정확.
  2. **"자매 둘을 같은 자리에서 고정한다"**: 신규 테스트 본문이 실제로
     `rotateNotificationSecret`(`:2441-2444`)와 `revokePerTriggerToken`(`:2450-2453`) 둘
     다에 대해 `triggerRepo.save` mock 을 reject 시키고 각각 `not.toHaveBeenCalled()` 를
     단언한다 — 서술과 코드가 일치.
  3. **"`create`/`update` 가 이미 쓰는 패턴과 같은 형태"**: `:2546`(`저장이 실패하면 감사를
     남기지 않는다 (create/update)`)이 `triggerRepo.save.mockRejectedValue(...)` 로 동일
     패턴을 이미 쓰고 있음을 확인 — 서술이 새 관례를 만든 게 아니라 기존 관례 재사용이라는
     주장과 일치.
  4. **"`rotateBotToken` 은 6단계 mock 이 필요해 자기 describe 에 따로 있다"**: 실제로
     `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션', ...)` 안에
     `감사 — 성공 시 ... 남긴다`(`:1774`), `감사 — 오케스트레이션이 중간에 실패하면
     남기지 않는다`(`:1789`)가 별도로 존재한다 — 서술과 일치.
  5. **`revokePerTriggerToken` 은 이전에 실패 테스트가 아예 없었다는 커밋 메시지 전제**를
     `git show 9eb2c6088:.../triggers.service.spec.ts` 로 직접 확인 — 해당 시점에
     `revokePerTriggerToken` 관련 테스트(`:858-899`, `NOT_PER_TRIGGER_STRATEGY` 검증 2건 +
     정상 케이스)는 있었지만 `auditLogs.record` 미기록을 단언하는 테스트는 0건이었다 —
     전제 정확.
- RESOLUTION.md 의 뮤테이션 표(`:2444` RED, `:2453` RED — 자매를 따로 세운 이유는 "한 테스트에
  둘을 담으면 앞이 뒤를 가린다")도 실제 라인 번호와 일치함을 직접 대조 확인
  (`awk 'NR==2444...'` → 두 줄 다 `expect(auditLogs.record).not.toHaveBeenCalled();`).
- 판단: **docstring 이 서술하는 "왜 기존 테스트로 부족한가"의 근거가 실제 코드와 정확히
  일치한다.** 과장·누락 없음.

### [INFO] `12_22_23/{SUMMARY,RESOLUTION}.md` — 사후 재구성 문서, 리포트 7개와 대조해 과장·누락 없음

- 대조표(집계):

  | reviewer | SUMMARY 집계 | 리포트 원문 `## 위험도` | 일치 |
  |---|---|---|---|
  | testing | CRITICAL | `CRITICAL` (`testing.md:51`) | 일치 |
  | documentation | MEDIUM | `MEDIUM` (`documentation.md:49`) | 일치 |
  | security | LOW | `LOW` (`security.md:53`) | 일치 |
  | requirement | LOW | `LOW` (`requirement.md` 말미) | 일치 |
  | side_effect | LOW | `LOW` (`side_effect.md:41`) | 일치 |
  | maintainability | LOW | `LOW` (`maintainability.md:33`) | 일치 |
  | scope | NONE | `NONE` (`scope.md:114`) | 일치 |

- Warning 표의 W1(documentation "근거 문장 오류")·W2(documentation "CHANGELOG 누락")가
  `documentation.md` 의 두 WARNING(1: CHANGELOG 누락, 2: "응답에 새 자격증명 1회 평문 반환"
  오류)과 정확히 대응 — 순서는 SUMMARY 가 뒤바꿔 적었지만(문서 원문은 CHANGELOG 누락이 먼저,
  SUMMARY 는 근거 오류를 W1 로 먼저 나열) 내용 자체의 왜곡·누락은 없다(사소한 나열 순서 차이,
  라벨 W1/W2 는 SUMMARY 자체 채번이라 원문과 1:1 대응할 의무가 없음).
- W3(side_effect "record() 오류 삼킴") — `side_effect.md` 의 WARNING 항목과 문구까지 거의
  동일(그대로 재인용 수준) — 과장·누락 없음.
- CRITICAL 서술("셋 중 하나에만 회귀를 걸었다 ... `requirement` WARNING · `security` INFO 도
  같은 자리를 독립 지적해 3명 수렴")을 `requirement.md`/`security.md` 원문과 대조 —
  `requirement.md` 의 WARNING("`rotateBotToken` 의 신규 감사 기록에 대한 단위 테스트가
  전무")과 `security.md` 의 INFO("감사 기록의 성공/실패 양쪽 모두에 대한 회귀 테스트가 없다")가
  실제로 같은 지점(`rotateBotToken` 감사 미검증)을 가리킨다 — "3명 수렴" 서술 정확.
- RESOLUTION.md 의 "처분 커밋: `9eb2c6088`" + 4행 표(CRITICAL/W1/W2/W3 처분)를
  `git show 9eb2c6088 --stat`/diff 로 직접 재확인 — 파일 목록(`CHANGELOG.md`,
  `audit-action.const.ts`, `triggers.service.spec.ts`, `plan/...`, `spec/5-system/1-auth.md`)과
  커밋 메시지 내용이 표의 4개 처분 항목과 정확히 일치.
- "이 라운드가 남긴 교훈" 문단("셋 중 둘에 걸어 놓고 전수라고 적었다 ... 다음 라운드(`12_37_14`)
  에서 또 같은 축이 나왔다")은 `12_37_14/testing.md` 의 WARNING(자매 두 메서드의 실패 테스트가
  검증 예외만 흉내)과 정확히 대응 — 시점상 이 교훈 문단은 `f5d485a52`(이번 델타) 시점에
  뒤늦게 적힌 것이므로 그 시점까지의 사실을 정확히 반영한다(사후 재구성이지만 미래를 앞서
  주장하지 않음).
- 판단: **과장·누락 발견 없음.** "뒤늦게 기록한다"는 자기 고지가 있고, 실측 근거(뮤턴트 RED,
  파일 diff)가 각 처분 항목에 구체적으로 달려 있어 신뢰성이 검증 가능한 형태로 남아 있다.

### [INFO] plan 신규 등재 문구("회전 감사 mutation 잔여 갭 1건")가 남은 갭을 정확히 서술

- 위치: `plan/in-progress/spec-sync-auth-gaps.md` (신규 항목, "회전 감사 mutation 잔여 갭 1건")
- 검증:
  - "`rotateBotToken` 의 실패경로 회귀는 실패를 **4단계(`setupChannel`)** 에 주입한다" —
    `triggers.service.ts` 의 `rotateBotToken` JSDoc(`:983-991`, "1. 기존 botToken resolve
    ... 4. 새 token 으로 adapter.setupChannel 재호출 ...")과 테스트 코드
    (`triggers.service.spec.ts:1792` `mockAdapter.setupChannel.mockRejectedValueOnce(...)`)
    로 대조 — 정확히 4단계.
  - "감사를 5→6 구간으로 옮기는 뮤턴트는 아직 GREEN" — `12_37_14/testing.md` 의 INFO
    항목("`rotateBotToken` 자체도 6단계 중 5→6단계 구간 ... 으로 감사를 옮기는 뮤턴트는
    여전히 생존한다")과 직접 대응 — 정확히 재인용.
  - "그 테스트의 docstring 이 스스로를 4단계로 한정하고 있어 거짓 서술은 아니고" — 실제
    테스트(`:1789-1791`)의 인라인 주석("setupChannel(4단계) 실패 → 컬럼 갱신(6단계)에
    도달하지 못한다")이 스스로 4단계로 범위를 한정하고 있음을 직접 확인 — 정확.
  - "자매 두 메서드의 같은 축(검증 예외만 흉내 내던 실패 테스트)은 `save()` 실패 주입으로
    닫았다 — 남은 것은 이 한 구간뿐이다" — 이번 델타가 정확히 그 축(`rotateNotificationSecret`/
    `revokePerTriggerToken` 의 검증-예외-only 실패 테스트)을 닫았음을 위 신규 테스트 검증에서
    확인 — "닫았다" 주장 정확. "남은 것은 이 한 구간뿐"이라는 잔여 범위 주장도 이번 세션에서
    확인한 커버리지 갭(rotateBotToken 5→6 구간)과 정확히 일치, 다른 미검증 축을 과소 서술하는
    징후는 발견되지 않았다.
- 판단: **plan 등재 문구는 남은 갭을 정확히 서술한다.** 새로운 부정확 없음.

## 통과 확인 (문제 없음)

- CHANGELOG.md 는 이번 델타(`f5d485a52`)에서 손대지 않았고(이전 라운드 `9eb2c6088` 에서 이미
  추가·확정됨), 재검토 결과 "앞의 둘" 표현(grace 유무 기준)은 여전히 정확하다.
- `spec/5-system/1-auth.md §4.1` 표 셀 정정은 다른 5곳(`conventions/audit-actions.md §3`,
  `data-flow/1-audit.md §1.1`, `15-chat-channel.md §5.4.1`, `2-trigger-list.md`,
  `14-external-interaction-api.md`)과 여전히 모순되지 않는다(신규 델타가 그 5곳을
  건드리지 않았고, 정정 대상이던 "평문 반환" 서술이 애초에 그 5곳엔 없었음을 재확인).
- `plan/in-progress/spec-sync-auth-gaps.md` 에는 "## 체크리스트" 같은 별도 하단 동기화
  섹션이 없어(파일 전체 `grep '^##'` 확인) 본문-체크리스트 이중 동기화 이슈 해당 없음.

## 요약

호출자가 지적한 대로 이 PR 은 두 라운드 연속 정정문 자체의 사실 오류를 냈지만, 이번 델타
(`f5d485a52`)의 세 번째 시도는 위치 의존 표현("앞의 둘")을 완전히 제거하고 액션명을 직접
명시하는 형태로 바꿔 `triggers.service.ts` 의 실제 반환 타입과 line-level 로 정확히 일치한다
— 재발 없음. 신규 테스트("저장이 실패하면 감사를 남기지 않는다 (회전 2종)")의 docstring 은
"왜 기존 테스트로 부족한가"의 근거(사전 validation 예외가 `save()` 앞에서 발생해 뮤턴트를
못 잡는다)를 정확히 서술하고, 실제 검증 대상(자매 두 메서드 모두)·재사용 관례
(`create`/`update` 의 기존 패턴)·별도 위치(`rotateBotToken` 은 별도 describe) 주장 모두
코드와 대조해 일치한다. `12_22_23/{SUMMARY,RESOLUTION}.md`(사후 재구성 문서)는 리포트 7개
원문과 위험도·발견사항 내용이 정확히 대응하며 과장·누락은 발견되지 않았다. plan 신규 등재
문구도 잔여 갭(`rotateBotToken` 5→6 구간 mutation coverage 빈틈)의 범위와 이유를 실측과
정확히 일치하게 서술한다. 새 CRITICAL 은 없다 — `audit-action.const.ts` 주석의 줄바꿈이
약간 어색해진 점(내용 오류 아님)만 사소한 INFO 로 남긴다.

## 위험도

NONE

STATUS: OK
