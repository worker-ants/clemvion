# 테스트(Testing) 리뷰 — 캐시 엔트리 안쪽 `responseJson` 손상 방어

## 검증 방법

정적 리뷰에 더해, 신규 테스트 중 "판정 순서 캐너리"(`안쪽이 깨졌어도 body 가 다르면 여전히
409`, spec L598)의 뮤테이션 유효성을 직접 실측했다 — `bodyHash` 판정과 `cachedPayload` 파싱
순서를 소스에서 실제로 뒤집어(cp 로 사전 백업 후 mutate) `npx jest idempotency.interceptor.spec.ts`
를 재실행했다. 결과: 해당 테스트 1건만 정확히 RED(`Received promise resolved instead of
rejected` — 409 대신 `{fresh:true}` 200 이 반환됨), 나머지 32건은 그대로 GREEN. 뮤턴트가
유효했고 캐너리가 실제로 그 자리를 지킨다는 것을 확인했다(원본은 `cp` 로 정확히 복원, 복원 후
33/33 GREEN 재확인, `git status`/`git diff` 로 작업 트리 clean 확인 완료).

## 발견사항

- **[INFO]** "에러 재현 분기" 캐너리가 현재 구현에서는 200 분기와 동일한 코드 라인을 탄다 —
  네이밍이 "별도 분기 커버" 를 암시하지만 실제로는 입력 데이터만 다른 회귀 가드다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:631` (`안쪽이 깨진 409 엔트리도 500 이 아니라 신규 처리 — 에러 재현 분기도 같은 방어를 받는다`)
  - 상세: 이 테스트의 주석은 "재현 분기가 **둘**이다(에러 채널 `HttpException` 재throw · 성공
    채널 `of()`)... 자매 자리를 함께 고정한다" 고 설명한다. 이는 **리팩터 이전**(두 분기에
    `JSON.parse` 가 각각 따로 있던 시절)의 실제 결함 모델을 정확히 서술한다. 그러나 이번 diff 로
    `cachedPayload` 파싱이 `isErrorStatusCacheable` 분기 **앞**으로 한 번만 끌어올려졌다
    (`idempotency.interceptor.ts:181-186`). 그 결과 `statusCode: 409` 로 설정한 이 테스트와
    바로 위 `statusCode: 200` 테스트(`561`)는 지금은 **완전히 동일한 소스 라인**(파싱 try/catch)
    을 실행한다 — `isErrorStatusCacheable` 분기 자체는 파싱이 성공한 뒤에나 도달하므로 이 뮤턴트
    입력으로는 그 분기에 아예 도달하지 못한다. 실측(mutation)으로 재확인: 파싱 try/catch 를
    완전히 제거해도(비현실적 뮤턴트지만) 두 테스트는 여전히 같은 지점에서 함께 죽거나 산다 —
    "형제 자리를 갈라 본다" 는 의도와 달리 지금은 사실상 중복 테스트다.
  - 제안: 결함은 아니고 향후 `discardCorruptEntry` 를 다시 분기별로 쪼개는 회귀를 잡아 주는
    보험으로서는 유효하다. 다만 주석이 "지금 이 순간 다른 코드 경로를 검증 중" 이라고 읽히지
    않도록 "재발 방지용 회귀 가드(현재는 200 케이스와 동일 코드 경로)" 정도로 한 줄 보강하면
    다음 사람이 커버리지를 실제보다 넓게 오판하지 않는다. 급하지 않음.

## 그 외 확인한 항목 (문제 없음)

- **격리**: 4개 신규 테스트 모두 `jest.spyOn(Logger.prototype, 'warn')` 을 `try/finally` 로
  감싸 `mockRestore()` 하는 기존 파일 관례를 그대로 따른다. `jest.config.ts` 에
  `clearMocks`/`restoreMocks` 설정이 없어 수동 복원이 유일한 방어선인데, 정상 작동한다(단언
  실패 시에도 `finally` 가 보장).
- **가독성**: 테스트명·인라인 주석이 "왜 이 테스트가 필요한가" 를 명시적으로 서술(예: "이
  세션에서 자매 누락이 반복됐다", "단언은 형제 테스트와 동형이어야 한다"). 특히
  `안쪽이 깨졌어도 body 가 다르면 여전히 409` 테스트는 파싱 순서가 계약이 된 이유를 주석에
  남겨 향후 리팩터 시 실수를 예방한다.
- **회귀 고정**: 손상 메시지 문자열(`cache 엔트리 손상` / `cache payload 손상`)이
  `discardCorruptEntry` 의 실제 템플릿 리터럴과 정확히 일치 — `stringContaining` 오탐 없음.
- **Mock 적절성**: `redis.get`/`redis.set` mock 과 `makeContext`/`makeCallHandler` 헬퍼가
  실제 인터셉터 호출 표면과 일치. `handleSpy` 로 downstream 실행 여부까지 단언해 "응답값만
  같으면 통과" 하는 취약한 단언을 피했다(789 라인 주석이 이 원칙을 명시).
- **커버리지**: `readKey`/`hashBody` 경계값 테스트 부재는 `plan/in-progress/backend-lint-gate-broken-on-main.md`
  에 이미 별도 항목(INFO 10, `12_55_52`)으로 기록된 선재 갭이며 이 PR 스코프 밖 — 신규 회귀
  아님.
- **e2e 위임**: Redis 실 코드 손상을 e2e 로 재현하는 테스트는 없으나, 이 결함은 순수 인터셉터
  내부 로직(파싱 실패 시 분기)이라 unit 레벨 커버리지로 충분하다 — 실 Redis 값을 직접 깨뜨려야
  하는 e2e 는 비용 대비 이득이 낮다.
- **plan 문서**: `plan/in-progress/backend-lint-gate-broken-on-main.md` 체크박스가 `[ ]` →
  `[x]` 로 갱신되고, "뮤턴트를 처음엔 무효로 만들었다" 는 실패 경험까지 정직하게 기록돼 있다
  (내가 재현한 것과 같은 결론 — 순서 뮤턴트는 진짜 유효했다).

## 요약

테스트 3개(엔트리 손상 warn 회귀 1건 포함 4건)가 새 방어 로직의 핵심 분기 — 손상 시 500 회피,
warn 가시성, `bodyHash` 판정이 payload 파싱보다 우선한다는 순서 계약 — 을 빠짐없이 덮는다.
직접 뮤테이션을 돌려 순서 캐너리가 실제로 유효함을 확인했다(정상 GREEN → 순서 뒤집자 정확히
그 1건만 RED). 유일한 지적은 "409 재현 분기" 캐너리가 리팩터로 코드가 단일화되면서 200 케이스와
동일 라인을 타게 됐다는 서술 정확도 문제로, 결함이 아니라 주석 표현 개선 제안(INFO)이다. Mock ·
격리 · 가독성 · 회귀 고정 모두 이 파일의 기존 고품질 관례를 그대로 유지한다.

## 위험도

NONE
