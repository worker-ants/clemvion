# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update (12라운드)

## 검토 범위

`origin/main` 대비 전체 diff(19개 파일, `codebase/`·`plan/`·`CHANGELOG.md`)를 확인했다. 이전
라운드(`review/code/2026/09/15/00_07_52`)가 이미 코드로 대조한 시점(`91b816498`) 이후 실제로
바뀐 것은 3파일뿐이다(`git diff 91b816498..3641ead21 --stat`로 확인):
`trigger-config-lock.ts`(JSDoc 15줄) · `triggers.service.spec.ts`(테스트 1건, +29줄) ·
`plan/in-progress/trigger-config-lost-update.md`(트래커 갱신). `chat-channel-binder.service.ts` ·
`triggers.service.ts` · `trigger-transaction-mock.ts` · `schedules.service.ts` 등 나머지 프로덕션
코드는 11라운드 리뷰가 본 상태와 바이트 단위로 동일하다. 그래서 이번 라운드는 (a) 그 3파일의
변경 자체와 (b) 11라운드가 남긴 INFO 잔여 항목이 여전히 유효한지를 중심으로 봤다.

## 이번 증분(diff) 자체에 대한 평가 — 긍정적

- **`trigger-config-lock.ts` JSDoc 정정은 유지보수성을 직접 개선하는 변경이다.**
  종전엔 *"이 함수를 쓰는 곳은 창 2·3·4 다"* 라고 호출부를 **열거**했는데, 그 뒤 세 자리가
  더 이 함수를 타면서 문장이 과소 서술이 됐다. 이번 커밋은 열거를 버리고 *"`config` 를 다시
  쓰는 자리는 창 1 하나를 빼고 전부 이 함수를 지난다"* 는 **불변식**으로 바꿨다 — 호출부가
  늘어도 문장이 깨지지 않는 형태다. 부재 처리 표(락 재읽기 시점에 트리거가 이미 삭제된 경우
  각 호출부가 어떻게 반응하는지)에 빠져 있던 `revokePerTriggerToken`·`normalizeNotificationSecretRef`·
  cron 두 곳도 채워 표가 실제 호출부 집합과 다시 일치한다. "목록은 낡고 규칙은 안 낡는다" 는
  교훈이 문서 형태 자체에 반영된 사례다.
- **신규 테스트(`revokePerTriggerToken` — fallback 분기)** 는 `mergeIntoFreshSubKey` 의 네
  번째 인자(`fallback`)가 실제로 행사되는 유일한 케이스를 추가한다. 재읽은 `config` 에 대상
  하위 키가 아예 없는 상태를 fixture 로 만들고, 스냅샷(`fallback`)이 기준이 됐는지를
  `patch?.config?.interaction?.appearance` 로 직접 단언한다 — 판별 fixture 로서 적절하다.

## 잔여 항목 (11라운드에서 이미 지적·트래커 등재, 이번 diff 로 재발·확대되지 않음)

- **[INFO]** `TriggersService.update()` 가 여전히 약 180줄 — 검증·락-재읽기-병합-저장 트랜잭션·
  커밋 후 후속 처리(감사·schedule 동기화·secret 정규화·chatChannel setup 재조회)가 한 메서드
  안에 이어져 있다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:540`-`721` (`update()`), 트랜잭션 클로저는 `:621`-`670`
  - 상세: 이번 라운드의 diff(3파일)는 이 메서드를 건드리지 않았으므로 새로 발생한 문제가 아니다. `plan/in-progress/trigger-config-lost-update.md` 가 "트랜잭션 클로저를 `mergeAndSaveLocked(...)` 로 분리 — 다음 편집 때"로 이미 후속 등재했다.
  - 제안: 조치 불요(추적됨). 다음에 이 메서드를 편집할 기회에 락 획득→재읽기→`mergeExternalConfig`→`Object.assign`→`save` 블록을 사설 헬퍼로 뽑을 것.

- **[INFO]** `ChatChannelBinderService.setupChatChannel()` 이 여전히 약 237줄(`:87`-`:323`), 로컬 클로저 2개(`survivesWithFresh`, `buildChannel`)를 포함
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:87`-`323`
  - 상세: 11라운드 대비 클로저가 3개→2개로 줄었고(이전 라운드가 지적한 `buildFallbackChannel`/`buildMergedChannel` 중복이 `buildChannel` 단일 함수로 수렴), 이번 diff 는 이 파일을 아예 건드리지 않았다. 함수 길이 자체는 여전히 길지만 개선 방향으로만 움직였다.
  - 제안: 조치 불요. 여유가 있으면 presence-gate 재계산+config 조립 로직을 메서드 밖 모듈 레벨 함수로 뽑는 안을 여전히 고려할 수 있다.

- **[INFO]** `schedules.service.spec.ts` 회귀 케이스 4벌이 거의 동일한 fixture 리터럴을 복제
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.spec.ts`
  - 상세: 이번 diff 가 손대지 않은 파일이라 신규는 아니다. `it.each` 테이블화로 다음 필드 추가 시 한 곳만 고치게 할 여지가 남아 있다.
  - 제안: 급하지 않음.

- **[INFO]** `withTransactionMock` 내부 4개 위임 클로저(`findOne`/`remove`/`save`/`update`)가 "옵셔널 캐스트 후 위임" 패턴을 반복
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:103`-`126`
  - 상세: 이번 diff 가 손대지 않은 파일. 이 헬퍼 자체는 6개 스펙 파일에 흩어진 배선을 한 곳으로 모은 순중복 감소이므로 이 지적은 그 안의 사소한 잔여 반복일 뿐이다.
  - 제안: 급하지 않음.

## 확인했지만 지적하지 않은 것

- `trigger-config-lock.ts` 의 JSDoc 은 코드 대비 분량이 크지만(함수 4개에 문서 블록이 훨씬 길다), 이 저장소 전반(`sanitizeForResponse`, `CHANGELOG.md` 등)에서 이미 확립된 근거·기각된 대안·계약 명시 컨벤션이라 이탈이 아니다.
- 신규 테스트의 네이밍(`revokePerTriggerToken — 재읽은 행에 그 키가 아예 없으면 fallback 으로 쓴다`)과 fixture 헬퍼(`row`, `withInteraction`) 재사용은 기존 스펙 파일의 관례와 일관된다.
- 매직 넘버 없음 — 신규/변경 코드 전부 이름 있는 상수(`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 등, 이번 diff 범위 밖) 또는 리터럴 문자열 자체가 도메인 키(`'interaction'` 등)라 매직 넘버로 볼 수 없다.

## 요약

이번 라운드에서 실제로 바뀐 프로덕션/테스트 코드는 3파일뿐이며, 그 변경은 전부 유지보수성을
개선하는 방향이다 — 특히 `trigger-config-lock.ts` JSDoc 을 "호출부 열거"에서 "호출부 개수와
무관한 규칙"으로 바꾼 것은 이 PR 이 이전 라운드들에서 반복 지적당했던 "목록이 다음 커밋에
낡는다"는 문제 자체를 문서 형태 차원에서 해소한 것이고, 추가된 테스트는 그동안 미행사였던
분기(`fallback`)를 판별 가능한 fixture 로 처음 커버한다. 남은 INFO 4건(`update()` 길이,
`setupChatChannel` 길이, 스펙 fixture 중복, mock 위임 클로저 중복)은 전부 이번 diff 범위 밖의
기존 코드에 대한 것이고, `plan/in-progress/trigger-config-lost-update.md` 트래커에 이미 등재돼
있어 이번 배치를 막을 사유가 아니다.

## 위험도

LOW
