# 변경 범위(Scope) Review

## 검토 방법

`git diff origin/main...HEAD` 전수(146 files, 코드/plan/CHANGELOG 19개 + review 산출물 127개)를
확인했다. 프롬프트가 크기 제한으로 생략한 파일(6·7·10·11·12·13·18·19번)은 `git diff
origin/main...HEAD -- <path>` 로 직접 열어 전문을 확인했다. `review/code/2026/09/14/*` ·
`review/consistency/2026/09/14/*` 아래 127개 파일은 이 저장소 컨벤션상 developer 가 매 라운드
`/ai-review`·`/consistency-check` 산출물을 커밋해 축적하는 정상 절차물이며(`review/**` write 권한은
developer 에게 있음), 이번 PR 이 스스로 반복 인용하는 "지난 라운드 WARNING/CRITICAL 을 다음
커밋이 고친다"는 패턴의 증거이지 그 자체로 범위 이탈이 아니다. 스코프 판단은 실제 코드
변경분(19개 파일, +2350/-159)에 집중했다.

## 발견사항

- **[INFO]** 정적 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture)가 이번 PR 에서
  같이 넓어졌다 — 트리거 도메인 로직과 직접 관련 없는 별도 서브시스템(`endpointPath` 충돌
  래핑 래칫) 파일이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:26-35`
    (`TRIGGER_ENTITY` 상수 신설), `:108-121`(`ts.isFunctionLike` 콜백 경계 traversal 추가),
    `:156-171`(`isManagerTriggerSave` 판별 추가)
  - 상세: `TriggersService.update()` 의 저장이 `this.triggerRepository.save(trigger)` 에서
    `manager.transaction(async (m) => m.save(Trigger, target))` 형태로 바뀌면서(락 안 재작성),
    수신자 이름(`triggerRepository`)으로만 스캔하던 기존 가드가 이 저장 자리를 더 이상 찾지
    못하고 "래핑이 몰래 사라졌다"는 오탐 RED 를 냈다 — 이 점은 `endpoint-path-conflict-wrap.spec.ts`
    의 새 docblock(`EXPECTED_UNWRAPPED_TRIGGER_SAVES` 를 빈 배열로 바꾼 주석)에도 명시돼 있다.
    즉 이 변경은 본 PR 이 만든 저장 형태 변화의 **직접 파생 결과**이며, 별도 기능 추가나
    무관한 리팩터링이 아니다. 다만 대상 파일이 트리거 모듈 밖(공용 repo-guard)이라 리뷰
    changeset 상 "관련 없는 파일 수정"으로 오인되기 쉬운 자리라 별도로 짚어 둔다.
  - 제안: 조치 불요 — 이미 커밋 메시지·docblock 에 인과관계가 명시돼 있다. 다음 리뷰어를 위해
    "왜 이 파일이 diff 에 있는가"를 PR 설명/커밋 요약에도 한 줄 남기면 스코프 심사가 더
    빨라진다.

- **[INFO]** `TriggersService` 에 "not found" 처리를 통합하는 소규모 리팩터가 본 수정에 편승했다
  — 버그 자체(lost update)와는 별개의 중복 제거다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:356-357`
    (`assertTriggerFound`), `:368-371`(`throwTriggerNotFound`), `:498-505`
    (`findByIdForUpdate`)
  - 상세: `RESOURCE_NOT_FOUND` 리터럴이 이번 수정으로 새로 생긴 두 삭제-경합 분기
    (`update()`·`rotateBotToken`)에서도 필요해지자, 기존 `findById` 의 인라인 처리와 합쳐
    헬퍼 두 개로 추출했다. 또 `findByIdForUpdate` 는 `update()` 전용으로 `relations` 를
    빼 성능 회귀(락 안 재읽기가 이미 관계를 다시 로드하므로 이중 JOIN)를 막는다. 둘 다
    "락 안 재작성" 수정이 새로 만들어낸 필요(중복 자리 증가·이중 쿼리)에 대응하는 것이라
    완전히 무관한 개조는 아니지만, "config 를 컬럼 한정으로 고친다"는 이 PR 의 핵심 범위
    바깥에 있는 코드 정리를 함께 들여왔다는 점은 사실이다. 커밋 메시지·JSDoc 모두 이전
    리뷰 라운드(WARNING#5, INFO#6, WARNING#1)를 인용하며 근거를 남겨 뒀다.
  - 제안: 조치 불요 — 이 정도 규모(3개 private 헬퍼, 각각 2~10줄)의 편승 리팩터는 근거가
    명시돼 있고 별도 PR 로 분리할 만큼 무겁지 않다.

- **[INFO]** `chat-channel-input-rules.ts` 에 신규 순수 함수(`extractInboundSigningRef`)를
  추출해 3곳의 중복 인라인 캐스트를 대체했다 — 스코프 안 개선.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:239-250`
  - 상세: 이 함수가 반환하는 값이 이번 수정이 닫으려는 presence 게이트(인입 서명 보존
    여부)의 항이므로, 추출 자체가 버그 수정의 일부다. over-engineering 이 아니라 이 PR 이
    새로 만든 락-재읽기 경로(`chat-channel-binder.service.ts`, `triggers.service.ts`)가
    같은 캐스트를 반복해서 필요로 했기 때문에 자연스럽게 파생된 헬퍼다.
  - 제안: 없음.

- 검토했으나 문제 없음: CHANGELOG.md 추가분(46줄, `CHANGELOG.md:3-48`)은 이번 변경의 설계·근거를
  기술하는 문서로, 코드 범위와 정확히 일치한다. `package.json`/lockfile/`tsconfig`/`.eslintrc`
  등 설정 파일 변경은 0건이다(`git diff origin/main...HEAD --stat` 확인). import 변경은 모두
  신규 함수(`rewriteTriggerConfigLocked`, `extractInboundSigningRef`, `touchLastTriggeredAt`,
  `withTransactionMock`) 사용에 직접 대응하며 미사용 임포트 추가는 없다. 포맷팅-only 변경(순수
  공백/줄바꿈)은 관찰되지 않았다 — 모든 hunk 가 실질 코드/주석 변경을 동반한다.

## 요약

전체 diff(19개 코드/plan/CHANGELOG 파일, +2350/-159)는 "동시 쓰기가 `trigger.config` 를
스냅샷으로 덮어써 `inboundSigningRef` 를 잃는 lost-update"라는 단일 결함 클래스를, 그 결함이
실제로 존재하는 모든 쓰기 지점(triggers 모듈 자체·hooks 모듈의 웹훅 hot-path·schedules 모듈의
trigger 동기화)에서 닫는 데 집중돼 있다. 각 커밋 메시지와 코드 내 JSDoc/주석이 "왜 이 자리도
고쳐야 했는가"를 이전 리뷰 라운드의 구체적 지적(WARNING/CRITICAL 번호)과 함께 인용하고 있어,
추가된 코드 대부분이 요청된 수정의 직접 파생물임을 추적할 수 있다. 정적 가드(`endpoint-path-
conflict-wrap-guard`) 갱신과 `TriggersService` 의 소규모 "not found" 헬퍼 추출은 트리거
도메인 로직 자체는 아니지만, 둘 다 이번 저장 형태 변경(수신자가 `triggerRepository`에서
`manager`로, `save`에서 `update`/락-재작성으로)이 만들어낸 부작용을 되메우는 성격이라
기능 확장·무관한 리팩터링으로 보기 어렵다. 설정 파일 변경·미사용 임포트·포맷팅 노이즈는
발견되지 않았다. `review/code/**`·`review/consistency/**` 하위 다수 파일은 이 저장소의 리뷰
산출물 커밋 컨벤션에 따른 것으로 스코프 이탈이 아니다.

## 위험도

NONE
