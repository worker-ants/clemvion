# 문서화(Documentation) Review

## 검토 범위

이번 라운드는 `trigger.config` lost-update 수정 브랜치의 **5번째이자 최신** diff를
검토했다. 직전 4라운드(`review/code/2026/09/14/18_17_44`·`19_07_43`·`19_44_08`·
`20_17_16`)가 문서화 관점에서 제기한 WARNING 2건 + INFO 다수가 이번 최종 커밋
(`889c93cd9` — "삭제도 같은 락을 잡는다")까지 어떻게 처리됐는지를 `git diff
369852b4f..HEAD` 로 실측 대조한 뒤, 이 커밋이 새로 추가한 코드·주석·CHANGELOG·plan
변경분을 독립적으로 확인했다. 핵심 파일(`trigger-config-lock.ts`,
`chat-channel-binder.service.ts`, `triggers.service.ts`(+spec),
`hooks.service.ts`(+spec), `chat-channel-input-rules.ts`(+spec),
`trigger-transaction-mock.ts`, e2e spec, `endpoint-path-conflict-wrap-guard.ts` 계열,
`CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md`)를 `Read`/`git show`로
직접 대조했다. `review/**` 아래 과거 라운드 산출물(파일 18~93번)은 그 자체가 감사
이력이라 문서화 재검토 대상이 아니다.

## 이전 라운드 지적사항이 이번 최종 커밋에서 처리됐는지 확인

- **CHANGELOG가 삭제-락 추가분을 안 담았을 위험** → **해소 확인**.
  `git diff 369852b4f..HEAD -- CHANGELOG.md` 로 대조한 결과, "삭제
  (`DELETE /api/triggers/:id`)도 같은 락을 잡는다 — 그러지 않으면 «읽었을 땐 있었는데
  저장 직전에 삭제되는» 경합이 남는다." 문장이 정확히 이 커밋에서 추가됐고, 동시에
  이전 버전에서 "컬럼 한정 갱신으로 바꿨다. 외부 provider 호출은 락 **밖**에 남는다…"
  가 한 문장으로 잘못 이어붙어 있던 **문단 오귀속**(4라운드 W5 지적)도 두 단락으로
  바로잡혔다. 코드(`triggers.service.ts` `remove()`)와 CHANGELOG 서술이 일치한다.
- **`trigger-config-lock.ts` JSDoc의 "네 자리"가 실제 배선(3곳)과 창마다 다른 부재
  처리 방식을 구분 없이 서술 (3라운드 연속 INFO, 4라운드는 "창별 처리 방식이 다른데
  뭉뚱그려 서술" 로 재지적)** → **해소 확인**. `rewriteTriggerConfigLocked` 의
  `@returns` 절이 이번 커밋에서 "부재를 드러내는 방식이 창마다 다르다 — 의도된
  비대칭이다" 표(창 1=404 / rotateBotToken=404+감사 미기록 / binder=`false` 로 감춤)로
  교체됐다(`git diff 369852b4f..HEAD` 로 확인). 판단 기준("이번 요청의 결과인가,
  뒤따르는 부수 작업인가")도 명시됐다 — 4라운드가 요청한 문구와 정확히 일치.
- **`rotateBotToken`이 `false`(쓰기 skip)를 무시하고 200+감사를 남기던 비대칭
  (4라운드 api_contract WARNING#3)** → **해소 확인**. `rotateBotToken` 에
  `if (!wrote) throw new NotFoundException(...)` 가 추가됐고, 인접 주석이 정확히 이
  근거(`review/code/2026/09/14/20_17_16` api_contract WARNING#3)를 인용하며 실제
  코드 동작과 일치한다.
- **PATCH 마다 `relations:['workflow']` JOIN이 중복 실행 (4라운드 performance
  WARNING#1)** → **해소 확인**. `findByIdForUpdate` 사설 메서드가 추가되고 JSDoc이
  "저장·응답에 쓰이는 엔티티는 락 안에서 다시 읽으므로" 라고 그 이유를 명시한다 —
  `review/code/2026/09/14/20_17_16/performance.md` WARNING#1 이 지적한 위치·이유와
  1:1 대응한다.
- **삭제-레이스가 창 1과 창 2~4에서 처리 방식이 갈리는데 요약 문장은 통칭 (4라운드
  INFO)** → 위 두 항목(JSDoc 표, CHANGELOG 문장 분리)로 사실상 해소.

## 발견사항

이번 diff 자체에서 새로 발견한 문서화 결함은 없다. `Read`/`git diff` 로 대조한 범위
안에서 코드-주석 불일치, 인용 오류(리뷰 경로·라인 번호), 실측 수치 오류를 찾지
못했다.

- **[INFO]** plan 체크리스트 마지막 세 항목과 원 트래커 항목이 여전히 `[ ]` 다 —
  이번에도 반복 확인이지만 결함은 아니다
  - 위치: `plan/in-progress/trigger-config-lost-update.md` `## 체크리스트` 마지막
    세 줄(`트래커 항목 [x] + 실측 각주` · `run-test-all.sh` · `/ai-review` +
    `--impl-done`), `plan/in-progress/spec-draft-nullable-notation-followups.md:2278`
  - 상세: 이 plan 자신이 명시한 정지 규칙(§체크리스트 하단, "완료 기준: 마지막
    라운드가 `codebase/**` 수정 0 으로 끝날 것")이 아직 충족되지 않았다 — 이번
    라운드가 검토하는 커밋(`889c93cd9`)도 `codebase/**` 를 수정했으므로, 이 라운드가
    Critical 0·WARNING 0 으로 끝나면 **다음 라운드**가 그 종결 조건을 만족하는
    첫 라운드가 된다. 이전 세 documentation 라운드가 동일하게 "결함 아님"으로
    판단해 왔고, 그 판단 근거(정지 규칙 미충족)가 이번에도 그대로 유효하다. 다만
    이번 라운드가 실제로 Critical 0·WARNING 0 으로 수렴한다면, 종결 커밋에서
    (a) `spec-draft-nullable-notation-followups.md:2278` 을 `[x]` + "창이 넷이었다"
    각주로, (b) 이 plan의 마지막 체크박스 세 개를 `[x]` 로 갱신해야
    `feedback_plan_checkbox_actual_state`(체크와 완료 이동은 한 동작) 관례를 지킨다.
  - 제안: 이번 라운드가 clean 하게 끝나면, `plan/complete/` 이동 전에 위 두 문서의
    잔여 체크박스를 갱신할 것.

## 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- `triggers.service.ts` `remove()` 에 추가된 주석("삭제도 config 락을 잡는다 …")은
  실제 구현(`this.triggerRepository.manager.transaction(async (m) => { await
  acquireTriggerConfigLock(m, id); await m.remove(trigger); })`)과 정확히 일치하며,
  `teardownChatChannel`(외부 호출)이 이 트랜잭션 **이전**에 이미 완료됨을 코드
  순서로 재확인했다 — "외부 호출을 락 안에 두지 않는다" 제약이 삭제 경로에도
  일관되게 지켜진다는 주석의 주장이 사실과 맞다.
- `triggers.service.spec.ts` 에 추가된 `remove() 도 같은 config 락을 잡는다` 테스트는
  `lockKeys` 배열에 `trigger-config:trig-l` 이 포함됨을 직접 단언해, "락은 SQL 한
  줄이라 바깥에서 관측할 방법이 없었다" 는 `trigger-transaction-mock.ts` JSDoc의
  설계 의도(`onLock` 콜백)와 정확히 맞물린다.
- CHANGELOG의 "행이 그 사이 삭제됐으면 쓰지 않는다" / "삭제도 같은 락을 잡는다"
  두 문장 모두, 대응하는 코드 변경과 **같은 커밋**(`889c93cd9`)에 함께 들어가
  "코드는 고쳤는데 CHANGELOG가 안 따라갔다" 는 이전 세 라운드의 반복 결함 클래스가
  네 번째로는 재발하지 않았다.
- `spec/2-navigation/4-integration.md:1444` 의 Cafe24 advisory lock 기각 사유 인용
  (plan §B, `trigger-config-lock.ts` JSDoc)을 원문과 대조 — 줄 번호·인용문 모두
  정확히 일치.
- README·API 문서·설정 문서: 이번 최종 커밋도 컨트롤러·DTO·라우트·환경변수를
  건드리지 않는다. `triggers.controller.ts` 의 `@ApiNotFoundResponse({ description:
  '해당 트리거를 찾을 수 없음' })`(PATCH)과 `RESOURCE_NOT_FOUND — trigger 미존재
  또는 워크스페이스 권한 없음`(rotateBotToken)은 이미 "트리거 없음"을 포괄적으로
  문서화하고 있어, 이번에 새로 노출되는 "쓰기 시점 삭제 경합" 하위 케이스도 그
  기존 문서 범위 안에 든다 — API 문서 갱신 대상 아님(이전 4라운드 api_contract 결론과
  일치).
- `trigger-config-lock.ts` 상단의 `// 상위 plan: plan/in-progress/trigger-config-lost-update.md`
  포인터는 1라운드 INFO 제안대로 남아 있고, `rewriteTriggerConfigLocked` JSDoc의
  "배선: … 창 1은 이 함수를 쓰지 않는다" 문장(3라운드 연속 지적 후 4라운드에서 반영)도
  이번 커밋에서 그대로 유지돼 재퇴행하지 않았다.

## 요약

이 브랜치는 5라운드에 걸쳐 문서화 지적사항을 스스로 정확히 추적·해소해 온 사례이며,
이번 최종 커밋(`889c93cd9`)도 그 패턴을 이어간다 — 4라운드가 제기한 WARNING 3건
(CHANGELOG 문단 오귀속, `rotateBotToken` 응답 비대칭, PATCH JOIN 중복)과 INFO 다수가
전부 실측 대조 가능한 방식으로 해소됐고, 새 코드(삭제 경로 락, `findByIdForUpdate`,
갱신된 `@returns` 표)의 JSDoc·인라인 주석·CHANGELOG·테스트 docstring은 실제 구현과
어긋나는 곳을 찾지 못했다. 남은 것은 plan 체크리스트·원 트래커의 잔여 `[ ]` 뿐인데,
이는 plan 자신이 선언한 정지 규칙("마지막 라운드가 `codebase/**` 수정 0 으로 끝날
것")이 이번 라운드에서도 아직 충족되지 않았기 때문으로, 결함이 아니라 종결 시점에
함께 닫아야 할 사무적 항목이다. README·API·설정 문서 갱신 대상은 이번에도 없다.

## 위험도

NONE
