# 문서화(Documentation) Review

## 검토 범위

이번 changeset 의 실제 코드/문서 변경은 `CHANGELOG.md` · `hooks.service.ts`(+spec) ·
`schedules.service.ts`(+spec) · `chat-channel-binder.service.ts` ·
`chat-channel-input-rules.ts`(+spec, `extractInboundSigningRef` 신설) ·
`trigger-config-lock.ts`(+spec) · `triggers.service.ts`(+spec, `.web-chat.spec.ts`) ·
`trigger-transaction-mock.ts` · `endpoint-path-conflict-wrap-guard.ts`(+spec, fixture) ·
`trigger-config-lost-update.e2e-spec.ts` · `plan/in-progress/trigger-config-lost-update.md`
다. 나머지 변경 파일(90여 개)은 과거 라운드의 `review/code/**`·`review/consistency/**` 산출물
자체라 이번 문서화 관점의 대상이 아니다. 이번 라운드가 실제로 새로 건드린 것은
`hooks.service.ts`/`schedules.service.ts` 의 컬럼 한정 갱신 전환, `chat-channel-input-rules.ts`
의 `extractInboundSigningRef` 추출, 그리고 그 배경을 서술한 `CHANGELOG.md` 갱신이다
(최신 커밋 `a92bce095` "남은 일곱 자리까지 닫아 «모든 자리» 를 참인 문장으로 만든다").

`git log --oneline -- CHANGELOG.md` 로 이 파일이 이번 라운드에 처음 실측 대상이 됨을
확인했고, `git show a92bce095 -- CHANGELOG.md` 로 정확히 어떤 문장이 새로 추가됐는지 대조했다.

## 발견사항

- **[CRITICAL]** CHANGELOG 가 같은 항목 안에서 스스로를 반증한다 — "`save(entity)` 하는 자리는
  한 곳도 남지 않는다" vs 21줄 뒤 "저장 동사(`save`)는 그대로 두고"
  - 위치: `CHANGELOG.md:16` (`그 결과 기존 행에 `save(entity)` 하는 자리는 **한 곳도 남지
    않는다**(정적 래칫이 고정한다).`) vs `CHANGELOG.md:37-38` (`` `chatChannel` 을 **싣지 않은**
    PATCH(이름 변경 등)도 같은 경로로 ref 를 되돌렸다. 저장 동사 (`save`)는 그대로 두고 «어느
    `config` 위에 병합하는가» 와 «그 구간이 직렬화되는가» 만 바꿨다. ``)
  - 상세: 16번째 줄은 "config 를 다시 쓰는 자리를 락 안 재작성 또는 컬럼 한정 갱신으로
    바꿔서, 기존 행에 `save(entity)` 하는 자리가 한 곳도 남지 않는다"고 단정한다. 그런데 바로
    이 항목이 가리키는 `update()`(창 1, `chatChannel` 을 싣지 않은 PATCH 경로)는 37-38번째
    줄에서 스스로 "저장 동사(`save`)는 그대로 두고 … 만 바꿨다"고 명시한다. 실제 코드도
    이를 뒷받침한다 — `triggers.service.ts:636` 은 지금도 `return m.save(Trigger, target);`
    이고, `target` 은 락 안에서 재읽은 **기존** 행(`fresh`)에 `Object.assign` 한 것이다
    (`triggers.service.ts:634-636`). 즉 "기존 행에 `save(entity)` 하는 자리"가 정확히 하나
    (창 1) 남아 있는데, 16번째 줄은 그것을 "한 곳도 남지 않는다"고 반대로 말한다.

    괄호 안의 근거("정적 래칫이 고정한다")도 그 주장을 뒷받침하지 못한다. 인용되는 래칫은
    `endpoint-path-conflict-wrap.spec.ts`/`endpoint-path-conflict-wrap-guard.ts` 인데, 이
    가드는 **`endpointPath` UNIQUE 충돌 래핑 여부**만 스캔한다(`endpoint-path-conflict-wrap-guard.ts:1-2`
    주석 "`triggerRepository.save()` 호출이 `endpoint_path` UNIQUE 충돌 래핑을 갖췄는지 세는
    가드"). 이번 커밋으로 바뀐 것은 `EXPECTED_UNWRAPPED_TRIGGER_SAVES` 가 6개에서 **빈 배열**로
    준 것뿐이고, `EXPECTED_WRAPPED_TRIGGER_SAVES` 에는 여전히
    `triggers.service.ts#create`·`triggers.service.ts#update` 가 남아 `save()` 호출 자체는
    계속 존재를 전제한다(`endpoint-path-conflict-wrap.spec.ts:62-67`). 즉 이 래칫은 "`save()`
    가 아예 없다"가 아니라 "래핑 없는 `save()` 는 없다"만 고정하며, 16번째 줄의 문장을
    지지하지 않는다.

    이 커밋의 메시지 자체도 같은 구멍을 보인다 — "전수 재확인 … **기존 행을 통째로 저장하는
    자리는 하나도 남지 않았다**"고 결론짓기 바로 앞 문장에서 "창 1 의 저장은 락 안
    `m.save(Trigger, fresh)` 이다"라고 명시한다(즉 `fresh` 가 기존 행이다). 이 PR 이 고치려는
    바로 그 결함 클래스("내 서술이 구현보다 넓다")가, 이 커밋의 제목("«모든 자리» 를 참인
    문장으로 만든다")이 정확히 겨누는 그 자리에서 다시 재발했다 — 커밋 메시지가 스스로 "1·3·
    5라운드에도 같은 병이 있었다"고 인정하는 패턴의 (적어도) 네 번째 재발이다.

    plan 문서는 이 부분에서 더 정확하다 — `plan/in-progress/trigger-config-lost-update.md:327-331`
    은 "기존 행에 `save(entity)` 하는 자리는 8곳"이라 열거하며 창 1 을 "**닫았다** — 락 안 +
    재읽은 행을 저장 대상으로"라고 적어, `save()` 호출 자체가 아니라 lost-update 취약성이
    닫혔다는 것으로 정확히 좁혀 서술한다. CHANGELOG 만 그 정밀함을 잃었다.
  - 제안: `CHANGELOG.md:16` 을 실측과 일치하도록 좁힐 것. 예:
    "그 결과 **컬럼만 고치려던 자리가 의도치 않게 엔티티 전체를 저장하던 경로**는 한 곳도
    남지 않는다(정적 래칫이 그 일곱 자리의 unwrapped `save()` 를 0으로 고정한다). `update()`
    (창 1) 자체는 여전히 `save(entity)` 를 쓰지만, 락 안에서 재읽은 최신 행을 저장 대상으로
    삼아 lost-update 를 막는다." — 이렇게 바꾸면 37-38번째 줄과도, 코드와도, 인용한 래칫의
    실제 보장 범위와도 일치한다. 최소한 16번째 줄에 "(단, 창 1 은 `save` 자체를 유지 — 아래
    참조)" 한 줄만 덧붙여도 자기모순은 해소된다.

## 교차 검증한 그 외 문서화 항목 (문제 없음)

- `hooks.service.ts` 의 `touchLastTriggeredAt` 추출 — 두 호출부(`handleWebhook`·chat-channel
  인입)가 정확히 이 메서드로 통합됐고(`hooks.service.ts:227`, `:686`), JSDoc(`:957-972`)이
  주장하는 "두 호출부가 이 한 함수를 공유한다"·"in-memory `lastTriggeredAt` 도 갱신"을 실제
  구현(`:973-979`)과 대조해 일치를 확인했다. `markChatChannelRateLimited`(CCH-NF-03)의
  docblock 도 그 함수 바로 위(`:981-984`)에 정확히 붙어 있어, 이전 라운드가 지적한 orphan
  JSDoc 재발은 없다.
- `chat-channel-input-rules.ts` 의 `extractInboundSigningRef` JSDoc — "세 자리에 복제돼
  있었다"는 주장대로, 정의 자리를 뺀 인라인 캐스트(`{ chatChannel?: { inboundSigningRef?:
  string } }`)를 `chat-channel-binder.service.ts`·`triggers.service.ts` 전체에서 grep 했을 때
  0건이라 세 호출부가 실제로 이 함수 하나로 통합됐음을 확인했다.
- `schedules.service.ts` 의 trigger 동기화 인라인 주석(`:234-240`) — "이 경로가 바꾸는 것은
  `name`·`isActive` 둘뿐이므로 컬럼 한정 갱신으로 족하다"는 서술이 실제 `patch` 구성
  (`:241-243`, `name`/`isActive` 두 필드만)과 정확히 일치한다.
- `hooks.service.spec.ts`/`triggers.web-chat.spec.ts` 의 신규 테스트 JSDoc — "뮤테이션으로
  실측했다: 이 call site 만 종전 `save(trigger)` 로 되돌려도 전건 GREEN"이라는 서술은
  `plan/in-progress/trigger-config-lost-update.md:344-360` 의 실측 표(뮤턴트별 RED 결과)와
  대응되고, 두 서로 다른 파일(`hooks.service.spec.ts`·앞선 라운드 `testing.md`)에 걸친 근거가
  일관된다.
- `endpoint-path-conflict-wrap-guard.ts` 의 `TRIGGER_ENTITY`·콜백 경계 확장 주석 — 실제 조건식
  (`ts.isFunctionLike(cur) && !ts.isCallExpression(cur.parent)`, `first.getText(sf) ===
  TRIGGER_ENTITY`)과 정확히 대응하고, `endpoint-path-save.fixture.ts` 의 3종 신규 fixture
  (`managerSaveWrapped`/`managerSaveUnwrapped`/`managerSaveOtherEntity`)가 그 서술이 주장하는
  양성/음성 경계를 실제로 구분해 낸다.
- README·API 문서·설정 문서: 컨트롤러·DTO·라우트·환경변수 변경 없음(순수 서비스/영속성 계층
  동시성 수정) — 갱신 대상 없음.

## 참고 (블로킹 아님, 이미 planner 범위로 트래킹됨)

- `spec/5-system/15-chat-channel.md` 의 `code:` glob 추적성 갭은 여러 라운드째 지적돼 왔고
  plan §D "planner 범위" 표에 등재된 채로 유지되고 있다 — 새 발견 아님.

## 요약

이 PR 의 문서화 밀도는 이 저장소 평균을 크게 웃돌고, 이번 라운드에서 새로 작성된 JSDoc·인라인
주석·테스트 docstring(≈10건 표본 검증)은 전부 실제 코드와 정확히 일치했다. 다만 이번 라운드가
새로 쓴 CHANGELOG 문단 하나가 심각한 자기모순을 담고 있다 — "기존 행에 `save(entity)` 하는
자리는 한 곳도 남지 않는다"는 단정이, 같은 항목의 21줄 뒤에서 "저장 동사(`save`)는 그대로 두고"
라고 스스로 뒤집히고, 실제 코드(`triggers.service.ts:636` 의 `m.save(Trigger, target)`)와도
어긋나며, 근거로 인용한 정적 래칫(`endpoint-path-conflict-wrap`)의 실제 보장 범위(래핑 여부지
`save()` 존재 여부가 아님)와도 맞지 않는다. 이 커밋 자체가 "1·3·5라운드에도 «서술이 구현보다
넓다» 가 있었다"는 것을 알고 그 병을 고치려던 커밋이었다는 점에서, 같은 클래스의 결함이 그
수정 문장 자체에서 다시 재발한 사례다. lost-update/fail-open 보안 수정을 서술하는 CHANGELOG
항목이라 스코프 과장은 향후 감사·회귀 판단을 오도할 실질적 위험이 있어 차단 사유로 판단한다.
plan 문서(`plan/in-progress/trigger-config-lost-update.md:327-331`)는 같은 사실을 정확한
스코프("lost-update 를 닫았다"이지 "`save()` 를 없앴다"가 아님)로 서술하고 있어, CHANGELOG 만
그 정밀함을 잃었다 — 두 문서를 나란히 맞추는 것으로 해소 가능하다.

## 위험도

CRITICAL
