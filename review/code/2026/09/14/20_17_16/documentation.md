# 문서화(Documentation) Review

## 검토 범위

`trigger.config` lost-update(창 넷 + 웹훅 hot path 두 자리) 수정 브랜치의 누적 diff를
검토했다. 이 브랜치는 이미 3라운드의 `/ai-review` documentation 검토
(`review/code/2026/09/14/18_17_44`, `19_07_43`, `19_44_08`)를 거쳤고, 그 세 라운드가
제기한 WARNING 2건·INFO 다수가 이번 최종 커밋(`369852b4f`)까지 어떻게 처리됐는지를
`git show`/`git log -- CHANGELOG.md`로 실측 대조한 뒤, 마지막 커밋이 새로 추가한 코드·
주석·CHANGELOG·plan 변경분을 별도로 확인했다.

핵심 구현 파일(`trigger-config-lock.ts`·`chat-channel-binder.service.ts`·
`triggers.service.ts`·`hooks.service.ts`와 대응 spec)과 `CHANGELOG.md`,
`plan/in-progress/trigger-config-lost-update.md`를 실제 워크트리에서 `Read`로 직접 열어
diff 서술과 대조했다. `review/code/**`·`review/consistency/**` 아래의 과거 라운드 산출물
(17~75번 파일)은 그 자체가 감사 이력이라 문서화 재검토 대상이 아니다.

## 이전 라운드 지적사항 처리 확인

- **CHANGELOG 누락 (18_17_44 WARNING)** → 해소, 이후 라운드에서도 확인 유지.
- **CHANGELOG가 `12ed21ff1` 시점 범위에 머물러 hooks hot path 수정을 안 담음 (19_44_08
  WARNING)** → **해소**. 현재 `CHANGELOG.md:17-21`에 "웹훅 인입 경로도 함께 고쳤다" 문단이
  추가돼 있고, `PATCH 끼리의 경합보다 훨씬 잦다` 서술이 실제 코드
  (`hooks.service.ts`의 두 `update` 컬럼-한정 갱신)와 일치한다.
- **`trigger-config-lock.ts` JSDoc의 "네 자리"가 실제 호출부(3곳)와 구분 없이 섞여
  있다 (3라운드 연속 INFO)** → **해소**. `trigger-config-lock.ts:52-56`에 "배선: 이 함수를
  쓰는 곳은 창 2·3·4다 … 창 1은 이 함수를 거치지 않는다"는 명시적 문장이 이번 최종
  커밋에서 추가됐다(`git show 369852b4f` 실측 확인).
- **`withTransactionMock` JSDoc이 "provider 6개 파일"만 말하고 실제 이관은 2개뿐이라는
  사실이 빠져 있음** → **해소**. `trigger-transaction-mock.ts:29-33`에 "6개 전부를 이관한
  것은 아니다 — 실제로 감싼 것은 2개…나머지 4개는 지금은 안전하지만 호출하게 되는 순간
  깨진다"는 문단이 추가됐다.
- **`trigger-config-lock.spec.ts`의 테스트 제목이 "config가 null이면"이라 `undefined`
  fixture와 어긋난다** → **해소**. 제목이 "config가 비어 있으면(null·undefined)"로,
  `??`라 두 값의 동작이 같다는 주석과 함께 정정됐다.
- **`spec/5-system/15-chat-channel.md` `code:`/§7 열거 누락 (18_17_44 WARNING)** →
  `spec/`은 developer 권한 밖이므로 코드로 해소 불가능한 항목이고, plan §D 표에 planner
  후속으로 정확히 등재돼 있다 — 처리 방식 적절, 재지적 대상 아님.
- **plan §D에 같은 제목("후속")의 절이 중복돼 있었다** → **해소**. 현재 plan 파일의
  `##`/`###` 헤더를 전수로 세어 중복 제목이 없음을 확인했다(`grep -n '^##' | uniq -c`).

## 발견사항

- **[INFO]** 삭제-레이스 처리 방식이 창 1과 창 2~4 사이에서 갈리는데, CHANGELOG·plan의
  요약 문장은 이를 구분 없이 "쓰지 않는다"로 통칭한다
  - 위치: `CHANGELOG.md:14`(`행이 그 사이 삭제됐으면 쓰지 않는다`) /
    `codebase/backend/src/modules/triggers/triggers.service.ts:592-596`
    (`if (!fresh) { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... }) }`)
  - 상세: 이번 최종 커밋이 닫은 삭제-레이스는 두 가지 다른 동작으로 구현돼 있다 — 창
    2·3·4(`rewriteTriggerConfigLocked`)는 행이 없으면 **조용히 `false`를 반환**하고 세
    호출부 모두 그 값을 무시한다(best-effort). 반면 창 1(`update()`)은 같은 상황에서
    **`NotFoundException`을 던져 PATCH 요청 자체를 404로 실패**시킨다(호출자에게 보이는
    동작). 둘 다 "행을 되살리지 않는다"는 점에서는 같지만, 클라이언트가 관측하는 결과는
    다르다 — 하나는 명시적 에러, 셋은 무응답(성공처럼 보이는 부분 성공)이다. `CHANGELOG.md`
    와 plan(`§D` 후속 표 "지금은 네 창 모두 «행이 없으면 쓰지 않는다»")는 이 차이를 같은
    문장으로 뭉뚱그려, 다음 사람이 "왜 PATCH만 404가 나고 rotate/setup은 조용히 넘어가지?"
    를 다시 조사하게 만들 수 있다. 다만 실제로는 이미 `findById`가 같은
    `RESOURCE_NOT_FOUND`/404 패턴을 이 서비스에서 쓰고 있어(`triggers.service.ts:347-359`)
    새 에러 코드를 도입한 것은 아니므로, API 계약 관점에서는 문제가 없다(회귀 아님).
  - 제안: CHANGELOG 또는 plan §D 후속 표 한 줄에 "창 1은 404로 실패, 창 2~4는 best-effort로
    조용히 skip — 호출자 성격이 다르기 때문"이라는 구분을 추가하면, 이 비대칭이 의도인지
    또 다른 갭인지 다음 사람이 재확인할 필요가 없어진다. 우선순위는 낮다.

## 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- `rethrowEndpointPathConflict`(`triggers.service.ts:1402-`)는 `isEndpointPathUniqueViolation`
  으로 좁혀 판별하므로, 새로 추가된 `NotFoundException`이 실수로 409 `RESOURCE_CONFLICT`로
  재매핑되지 않고 그대로 상위로 전파된다 — 확인.
- 새로 추가된 회귀 테스트(`triggers.service.spec.ts`의 `update() — 그 사이 삭제된 트리거를
  되살리지 않는다`)는 `rejects.toMatchObject({ response: { code: 'RESOURCE_NOT_FOUND' } })`
  + `expect(repo.save).not.toHaveBeenCalled()`로 부재 단언과 형태 단언을 함께 걸어, 커밋
  메시지가 주장하는 "저장이 한 번이라도 일어나면 부활한다"는 계약을 정확히 검증한다.
  `hooks.service.spec.ts`에 추가된 대칭 테스트도 동일 패턴(`save` 미호출 + `update` 호출 +
  patch 키 집합 한정)으로 실제 코드와 1:1 대응한다.
- `api_contract.md`(18_17_44 라운드)의 "새 에러 코드·상태 코드 없음" 결론은 이번 최종
  커밋 이후에도 여전히 유효하다 — `RESOURCE_NOT_FOUND`/404는 같은 서비스의 `findById`가
  이미 쓰던 기존 에러 코드/상태 코드이지 신규가 아니다(오탐 방지 확인).
  `git log --oneline -- CHANGELOG.md`로 대조한 결과 "행이 그 사이 삭제됐으면 쓰지
  않는다" 문장 자체도 정확히 이 삭제-레이스 수정과 같은 커밋(`369852b4f`)에서 함께
  추가돼, "코드는 고쳤는데 CHANGELOG는 안 따라갔다"는 이전 두 라운드의 결함 클래스는
  이번엔 재발하지 않았다.
- `trigger-config-lock.ts`의 새 "배선" 문단, `trigger-transaction-mock.ts`의 새 "6개 전부를
  이관한 것은 아니다" 문단 모두 실제 `grep -n rewriteTriggerConfigLocked`/호출부 대조 결과와
  일치한다.
- README·API 문서·설정 문서: 이번 최종 커밋도 컨트롤러·DTO·라우트·환경변수·설정 옵션을
  건드리지 않아 이전 세 라운드의 결론(갱신 대상 없음)이 그대로 유효하다.
- `plan/in-progress/trigger-config-lost-update.md`의 체크리스트 마지막 세 항목과
  `spec-draft-nullable-notation-followups.md:2278`이 여전히 `[ ]`인 것은 결함이 아니다 —
  이 plan 자신의 정지 규칙("완료 기준: 마지막 라운드가 `codebase/**` 수정 0으로 끝날 것")이
  아직 충족되지 않았고(이번 커밋도 `codebase/**`를 포함), 종결 커밋 시점에 함께 갱신하기로
  이미 명시돼 있다 — 3라운드 연속 같은 결론.

## 요약

이 브랜치의 문서화 이력은 4라운드에 걸쳐 스스로를 정확히 정정해 온 드문 사례다. 이전 세
라운드가 제기한 WARNING 2건(CHANGELOG 누락, CHANGELOG 범위 stale)과 INFO 다수(3라운드
연속 지적된 "네 자리 vs 배선 3곳" 혼동, mock 이관 범위 누락, 테스트 제목 불일치, plan 중복
절)가 최종 커밋(`369852b4f`)에서 전부 실측 확인 가능한 방식으로 해소됐다 — 커밋 메시지
자신이 "내가 재지 않고 쓴 «실측» 문장을 정정한다"며 이전 라운드의 지적을 그대로 인용해
고쳤다. 이번 라운드에서 새로 확인한 것은 삭제-레이스 처리가 창 1(가시적 404)과 창
2~4(조용한 skip)로 갈리는데 CHANGELOG·plan의 요약 문장이 이 차이를 구분하지 않는다는
저비용 INFO 하나뿐이며, API 계약이나 코드 동작 자체에는 문제가 없다(신규 에러 코드
아님·기존 회귀 테스트로 보호됨).

## 위험도

NONE
