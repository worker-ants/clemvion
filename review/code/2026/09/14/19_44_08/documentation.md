# 문서화(Documentation) Review

## 검토 범위

3개 커밋(`30301008c`·`fdf576a2f`·`567c82edb`·`12ed21ff1`·`c7a9c107e`, 이번 diff 는
그중 최근 세 개가 누적된 `trigger.config` lost-update 수정)의 문서화 표면을 검토했다.
핵심 구현 파일(`trigger-config-lock.ts`·`trigger-config-lock.spec.ts`·
`chat-channel-binder.service.ts`·`triggers.service.ts`·`triggers.service.spec.ts`·
`hooks.service.ts`·`hooks.service.spec.ts`·`chat-channel-input-rules.ts`·
`trigger-transaction-mock.ts`·e2e spec·`endpoint-path-conflict-wrap-guard.ts` 계열),
`CHANGELOG.md`, `plan/in-progress/trigger-config-lost-update.md` 를 실제 워크트리에서
직접 `Read` 로 열어 diff 서술과 대조했다. 이전 두 라운드
(`review/code/2026/09/14/18_17_44/documentation.md`, `review/code/2026/09/14/19_07_43/documentation.md`)
의 지적사항이 이번 커밋(`c7a9c107e`)에서 어떻게 처리됐는지도 함께 확인했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 의 Behavior change 항목이 마지막 커밋(`c7a9c107e`)의 범위를
  따라잡지 못해, "닫힌 자리"의 서술이 실제보다 좁다
  - 위치: `CHANGELOG.md:3` (`## Unreleased — **Behavior change**: 동시 PATCH 가 인입 서명
    ref 를 지워 fail-open 이 되던 경로를 닫는다` 절 전체, 3~26줄)
  - 상세: 이 항목은 `12ed21ff1` 시점에 작성됐고 "`config` 를 다시 쓰는 **네 자리 전부**를
    트리거 단위 advisory lock … 안으로 넣고"라고만 서술한다. 그런데 이후 커밋 `c7a9c107e`
    (커밋 메시지: *"1라운드 수정이 만든 새 lost update + 웹훅 hot path 의 같은
    fail-open"*)는 `git show --stat c7a9c107e`로 확인한 바 `CHANGELOG.md`를 전혀 건드리지
    않은 채로 두 가지를 추가로 고쳤다 — (1) `TriggersService.update()`(창 1) 자체의 저장이
    "재읽은 config"와 "pre-lock 엔티티" 불일치로 **같은 클래스의 lost update를 새로
    만들었던 것**(형제 창의 컬럼 되돌리기), (2) `hooks.service.ts` 의 두 인입 hot path가
    `save(trigger)`로 `lastTriggeredAt`만 바꾸다 **인입 메시지마다** 같은
    `inboundSigningRef` fail-open을 재현하던 것(코드 주석 자신이 *"PATCH 끼리의 경합보다
    훨씬 잦다"*고 명시). 후자는 PATCH 동시성보다 실무 영향이 크다고 코드가 스스로 밝히는
    변경인데도 사용자 대상 변경 로그에는 등장하지 않는다. `review/code/2026/09/14/19_44_08/scope.md`
    (같은 라운드, 병렬 리뷰어)도 독립적으로 같은 사실을 관측해 INFO로 등재했다 — 관측은
    일치하고, 이 관점(문서화)에서는 "사용자가 체감하는 동작 변경 이력"의 정확성 문제이므로
    WARNING으로 판단한다.
  - 제안: 종결 커밋 전에 기존 항목을 갱신해 (a) hooks 인입 hot path의 `lastTriggeredAt`
    컬럼-한정 update 전환도 같은 fail-open 클래스의 수정임을 한 문단 추가하고, (b) "네
    자리"라는 수치 표현이 이번 PR 전체 범위(창 1~4 + hooks 두 자리)를 가리키지 않는다는
    점을 분명히 한다. `plan/in-progress/trigger-config-lost-update.md` §D는 이미 이 내용을
    정확히 담고 있으므로 그 문단을 참고해 옮기면 된다.

- **[INFO]** `trigger-config-lock.ts` JSDoc의 "네 자리" 배경 설명이, 이 함수 자신의 실제
  호출부 수(3곳)와 여전히 구분 없이 섞여 있다 — 같은 지적이 이미 두 라운드 연속(INFO) 제기됐고
  이번 커밋에서도 반영되지 않았다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:53`
    (`rewriteTriggerConfigLocked` JSDoc "## 왜 필요한가" 절, "네 자리가 «읽기 →
    (외부 호출) → 쓰기» 를 락 없이 이어 붙이고…")
  - 상세: `grep -n rewriteTriggerConfigLocked codebase/backend/src/modules/triggers/*.ts`로
    확인하면 이 함수를 실제로 호출하는 곳은 `chat-channel-binder.service.ts`의 성공/실패
    경로 2곳과 `triggers.service.ts`의 `rotateBotToken` 1곳, 총 **3곳뿐**이다. 창 1
    (`update()`의 `save`)은 `save()` 시맨틱을 지키기 위해 같은 lock key로 자체
    `manager.transaction`+`query`를 인라인해서 쓰고 이 함수를 쓰지 않는다(그 사실 자체는
    `triggers.service.ts:533` 인접 주석에 잘 설명돼 있다). `trigger-config-lock.ts`의
    JSDoc은 "문제의 범위(네 자리)"와 "이 함수가 배선된 자리(3곳)"를 구분 없이 이어 써서,
    이 파일만 단독으로 읽고 호출부를 grep한 다음 사람이 "3곳뿐인데 왜 넷이라 했지?"를 다시
    확인하게 만든다. `review/code/2026/09/14/18_17_44/documentation.md`가 이 정확한
    문구("배선: 창 2·3·4. 창 1은 이 함수를 쓰지 않는다 — 이유는 `update()` 주석")를 이미
    제안했고, `review/code/2026/09/14/19_07_43/documentation.md`도 부분 해소(플랜 포인터는
    추가됨) 상태로 재확인했는데, 이번 커밋(`c7a9c107e`)의 diff에도 이 한 줄은 반영되지
    않았다.
  - 제안: 우선순위는 낮지만(세 번째 지적이라 반영 비용 대비 정체 기간이 길다) 종결 전에
    JSDoc에 한 줄만 추가하면 된다 — 이미 두 라운드가 정확한 문구를 제안해 뒀다.

## 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- **`hooks.service.ts`의 두 신규 주석**(`handleWebhook` 성공 경로, chat-channel 인입 경로)은
  거의 동일한 문구를 두 자리에 복제했지만, 두 자리 모두 같은 "왜 `save`가 아니라
  `update`인가" 설명이 필요하고 짧아 drift 위험이 낮다 — 유지보수성 관점의 지적일 수는
  있어도 문서화 관점(정확성)에서는 두 자리 모두 실제 코드(`triggerRepository.update({ id },
  { lastTriggeredAt })`)와 정확히 일치한다.
- `hooks.service.spec.ts`에 추가된 회귀 테스트 docstring("부재 단언과 형태 단언을 함께
  건다")은 실제 단언(`save` 미호출 + `update` 호출 + patch 키 집합 `['lastTriggeredAt']`
  한정)과 1:1로 대응한다.
- `trigger-transaction-mock.ts`의 "provider가 6개 파일에 흩어져 있다" 서술과 "뮤턴트로
  13개 케이스 RED" 수치는 이전 라운드가 이미 실측 검증했고, 이번 diff에서 값이 바뀌지
  않았다.
- `endpoint-path-conflict-wrap-guard.ts`의 `TRIGGER_ENTITY`/콜백 경계 JSDoc은 실제 구현
  조건(`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`, `first.getText(sf)
  === TRIGGER_ENTITY`)과 일치하며, 새 fixture(`managerSaveWrapped`/`managerSaveUnwrapped`/
  `managerSaveOtherEntity`) 주석도 실제 배치·의도와 맞다.
- `chat-channel-input-rules.ts`의 `extractInboundSigningRef` JSDoc이 "세 자리에 복제돼
  있었다 — `update()` 안에 둘, binder에 하나"라고 서술한 것을 `grep`으로 실측(현재는 세
  자리 모두 `extractInboundSigningRef` 호출로 교체돼 있고, 이 함수의 정의 자리를 빼면 정확히
  3곳)해 정확함을 확인했다. 직전 라운드(`maintainability.md` 18_17_44)가 지적했던 인라인
  캐스트 중복도 이 리팩터로 해소된 상태다.
- `triggers.service.spec.ts`에 추가된 대규모 suite(`TriggersService — 락 안 재읽기가 동시
  확립분을 본다`)의 서두 docstring(재읽기가 두 번 일어난다는 설명, 대응표, 대조군이 달라야
  하는 이유)을 실제 테스트 본문·mock 시퀀스와 대조했고 어긋남을 찾지 못했다.
- `plan/in-progress/trigger-config-lost-update.md` §D "유예했다가 되돌렸다" 절은 원문을
  취소선(`~~…~~`)으로 남기고 반증 근거(리뷰 CRITICAL#1, 실측 수치)를 옆에 적는 이 저장소의
  자기-반증형 정정 관례를 정확히 따르며, 이번 커밋이 추가한 §D 하단 절("2라운드 리뷰 처분",
  "후속(developer 범위)" 표, "같은 클래스의 자리가 넷보다 많다" 절)도 실제 diff 범위와
  일치한다(전수 열거 결과·처분 표가 실제 변경된 파일과 대조해 어긋나지 않는다).
- `plan/in-progress/trigger-config-lost-update.md`의 체크리스트 마지막 세 항목(트래커
  `[x]`+각주, `run-test-all.sh`, `/ai-review`+`--impl-done`)이 여전히 `[ ]`인 것과
  `plan/in-progress/spec-draft-nullable-notation-followups.md:2278`가 아직 `[ ]`인 것은
  결함이 아니다 — 이 plan의 정지 규칙(§체크리스트 하단, "완료 기준: 마지막 라운드가
  `codebase/**` 수정 0으로 끝날 것")이 아직 충족되지 않았고(이번 라운드도 `codebase/**`를
  포함), 종결 커밋 시점에 함께 갱신하기로 이미 명시돼 있다.
- 새 함수·클래스(`triggerConfigLockKey`·`acquireTriggerConfigLock`·
  `rewriteTriggerConfigLocked`·`extractInboundSigningRef`·`withTransactionMock`) 모두
  공개 시그니처에 JSDoc이 있고, `@param`/`@returns`가 계약(특히 "머지 콜백은 락 안에서
  presence 게이트를 재계산해야 한다"는 비자명한 요구사항)을 명시한다 — 공개 API 문서
  누락 없음.
- README 갱신 필요성: 이 저장소는 `codebase/backend/src/modules/**` 하위에 모듈별
  README 컨벤션이 없다(`find codebase/backend/src/modules -iname README* `가 0건) — 신규
  파일 2건(`trigger-config-lock.ts`, `trigger-config-lock.spec.ts`)에 README가 없는 것은
  기존 관행과 일치하며 결함이 아니다.
- API 문서: 컨트롤러·DTO·라우트·`swagger.md` 대상 스키마 변경이 없어(서비스/영속성 계층
  전용 수정) API 문서 갱신 대상 자체가 없다 — `review/code/2026/09/14/18_17_44/api_contract.md`,
  `19_07_43/api_contract.md`의 결론과 일치.
- 설정 문서: 새 환경변수·설정 옵션 추가 없음(advisory lock key는 설정값이 아니라 코드
  상수) — 갱신 대상 없음.

## 요약

이번 diff의 문서화 밀도는 이례적으로 높다 — 핵심 구현(`trigger-config-lock.ts`,
`chat-channel-binder.service.ts`, `triggers.service.ts`, `hooks.service.ts`)의 JSDoc·인라인
주석은 설계 근거·기각된 대안·실측 수치·뮤턴트 결과를 동반하며, 실제 코드 동작과 대조한
범위에서 새로운 불일치를 찾지 못했다. 이전 두 라운드가 지적한 CHANGELOG 누락은 이미
해소됐지만, 그 CHANGELOG 항목이 이번 라운드의 새 커밋(`c7a9c107e` — 웹훅 인입 hot path의
같은 fail-open 수정 및 1라운드 자기 수정의 새 lost-update 정정)을 따라잡지 못해 "네 자리
전부"라는 서술이 실제 수정 범위보다 좁다는 것이 유일한 WARNING이다(병렬 scope 리뷰어도
독립적으로 같은 사실을 관측). 그 외에는 `trigger-config-lock.ts` JSDoc의 "네 자리" 배경
설명과 "3곳만 배선"이라는 사실의 경계를 한 줄 더 명확히 하라는, 세 번째로 반복되는 저비용
INFO 하나뿐이다. README·API 문서·설정 문서는 이번 변경의 성격(서비스/영속성 계층 내부
동시성 버그 수정, 신규 설정·엔드포인트 없음)상 갱신 대상 자체가 없다.

## 위험도

LOW
