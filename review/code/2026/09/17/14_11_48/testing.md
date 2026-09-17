# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 재측정치("60개 RED")를 재현할 수 없다 — 독립된 두 뮤턴트 모두 다른 숫자가 나온다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:63` (JSDoc "**60개 케이스가 RED** 다(2026-09-17 재측정, 321건 중)"), 같은 주장이 `plan/in-progress/trigger-save-partial-patch.md:116`("53 → **60**")·`:164`("**60 RED** (321건 중)")에도 전파됨
  - 상세: 이 JSDoc 은 1라운드 리뷰(W4)가 "재측정 기록 없음"을 지적해 이번 라운드에 **새로 추가된 실측**이다 — 즉 "재현 가능해야 한다"는 이 파일 자신의 규약(`:69` "이 파일을 고칠 땐 다시 재라")을 이번에 막 만족시켰다고 주장하는 자리다. 그런데 그 규약대로 두 가지 방식으로 "`transaction` 이 콜백을 실행하지 않는다" 뮤턴트를 재현해 `npx jest src/modules/triggers`(321건, mutation 전 baseline 320 passed/1 skipped — 클린)를 돌려 보니:
    - `transaction: jest.fn((cb) => Promise.resolve(undefined))`(콜백을 아예 호출하지 않고 `undefined` 로 resolve) → **68 RED**
    - `transaction: jest.fn((cb) => Promise.resolve(false && cb({...})))`(콜백 호출부만 단락, 나머지 구조는 원본 그대로) → **64 RED**

    문서가 주장하는 **60** 과 둘 다 다르고, 두 재현 결과끼리도 다르다 — "콜백을 실행하지 않는다"는 서술이 `transaction` 의 반환값(`undefined` vs `false` 등)까지 고정하지 않아 뮤턴트 자체가 잘 정의돼 있지 않다. 즉 이 숫자는 (a) 실제로 60이 아니거나 (b) 애초에 재현 가능한 단일 값이 아니다 — 어느 쪽이든 "60" 이라는 특정 수치를 감사 근거로 남긴 것은 근거가 약하다. (뮤턴트 두 번 모두 `cp` 로 원본을 스크래치에 백업 후 재현·`cp` 로 원복, `git status --short` 로 트리 클린 확인 완료 — 리포지토리에 잔여물 없음.)

    이 파일이 반복해서 자기 재측정치를 틀리는 것 자체가 패턴이다: 처음 13 → `#1334` 시점 53(1라운드 W2 가 그 표의 파생 항목 하나를 반증) → 이번 60(재현 불가). "GREEN 만으로는 증거가 되지 않아 빼 보고 셌다"는 이 파일의 원칙은 옳지만, 그 원칙을 실행한 결과 자체가 매번 다르게 보고되고 있어 "이 위임이 몇 건을 살려 두는가"라는 감사 정보의 신뢰도가 낮다.
  - 제안: 정확한 숫자보다 **재현 스크립트를 코드로 고정**하는 편이 낫다 — 예: 이 mutation 을 `.claude/tests` 나 별도 canary 스크립트로 남겨 "이 정확한 변형을 이렇게 적용하면 N건"처럼 재현 절차 자체를 명시하면 사람마다 다른 뮤턴트를 만들어 다른 수를 재는 문제가 사라진다. 최소한 "숫자는 시점 의존" 각주 옆에 "뮤턴트의 정확한 형태(반환값 등)"까지 명시해 다음 사람이 같은 조작을 재현할 수 있게 할 것.

## 확인한 것 (반증되지 않음)

- `triggers.service.spec.ts:3863` "update() — 저장 대상은 이 요청이 바꾸는 필드뿐이다" — `triggers.service.ts` 의 부분 객체 `save` 를 통째 엔티티 `save`(`Object.assign(target, defined, {config: mergedConfig}); m.save(Trigger, target)`)로 되돌리는 뮤턴트를 직접 적용해 재현: 이 테스트 **1건만 RED**, `triggers.service.spec.ts:3887`(save 반환값 테스트)는 여전히 GREEN — plan 체크리스트("M1 통째 엔티티 save 로 되돌림 → 1건")·1라운드 testing.md 의 반증(W2)과 정확히 일치한다. `Object.keys(savedEntity).sort()` 키-집합 단언은 값이 아니라 "무엇을 실었는가"를 보는 설계라 통째-엔티티 클래스 전체를 일반적으로 잡는다 — 실측 완료. (뮤턴트 적용 전 `cp` 백업, 재현 후 `cp` 원복, `git status --short`/`git diff --stat` 로 클린 확인.)
- `trigger-transaction-mock.ts:125-133` 의 `save` mock 을 동기 → 비동기로 바꾼 변경이 `triggers.web-chat.spec.ts`·`schedules.service.spec.ts` 를 깨지 않는지 확인 — 두 파일 모두 `repo.save.mock.calls`(인자)만 참조하고 `.mock.results`(반환값)를 동기 값으로 가정하는 코드는 없다(`grep` 전수 확인). 세 파일을 함께 실행(`triggers.service.spec.ts`+`triggers.web-chat.spec.ts`+`schedules.service.spec.ts`) — 181건 전부 GREEN.
- 신규 e2e `trigger-update-save-window.e2e-spec.ts` — 각 `it` 이 `createWorkflowAndTrigger(tag)` 로 자기 전용 workflow/trigger 를 매번 새로 만들고(`uniqueName`/`crypto.randomUUID()` 로 충돌 회피), `beforeAll`/`afterAll` 로 `DataSource`·`pg.Client` 를 정확히 열고 닫아(`jest.config.ts:50-53` 주석과 부합) 테스트 간 격리가 확보돼 있다. HTTP 로 열 수 없는 "락 안 재읽기~저장 사이" 창을 대기 훅 대신 TypeORM 직결 트랜잭션으로 결정적으로 재현하는 설계라 타이밍 의존 flakiness 위험이 낮다.
- 두 번째 신규 단위 테스트(`triggers.service.spec.ts:3887`, save 반환값의 `null` 회귀)는 응답에 실제로 남는 컬럼(`endpointPath`·`lastTriggeredAt`·`authConfigId`)만 골라 단언해 `TRIGGER_RESPONSE_STRIP_COLUMNS` 로 지워지는 컬럼을 피했고, "한 필드만 골라 덮기" 뮤턴트(M4)까지 같은 테스트가 잡는다는 plan 의 주장도 세 컬럼을 모두 개별 단언하는 구조상 타당하다.

## 커버리지 갭 (신규 아님, 기존에 이미 인지·트래킹됨 — 참고용)

- CASCADE 삭제 경합(① 시나리오)은 e2e 에서만 검증되고 단위 테스트에는 대응 케이스가 없다 — FK 위반은 mock 으로 재현 불가능한 영역이라 이 자체는 정상적인 계층 분리다.
- CHANGELOG/plan 이 나열한 락 밖 되돌림 대상 4개 컬럼(`notification_secret_v2`·`chat_channel_token_v2`·`last_triggered_at`·schedule `name`/`is_active`) 중 e2e 가 SQL 로 직접 검증하는 것은 2개뿐이다 — 1라운드 testing INFO 로 이미 지적됐고 RESOLUTION 에서 "조치 불요"로 처분됨(단위 키-집합 단언이 컬럼-불특정 보호를 이미 일반화해서 검증). 재지적하지 않음.

## 요약

핵심 프로덕션 수정(창 1 `update()` 의 통째 엔티티 `save` → 부분 객체 `save`)은 실제 Postgres+TypeORM 을 직접 구동하는 신규 e2e 특성 테스트와, 통째-엔티티 회귀 클래스 전체를 일반적으로 잡는 키-집합 단위 단언으로 뒷받침되며, 두 항목 모두 뮤턴트를 직접 적용해 재현·검증했다(둘 다 문서의 주장과 일치). 1라운드가 지적한 M1 표 오류(W2)도 이번 라운드에 정확히 반영됐다. 다만 같은 파일이 그 W4 처분으로 새로 적어 넣은 "60개 RED" 재측정치는 두 가지 합리적인 방식으로 재현해도 재현되지 않는다(64·68) — 이 파일이 자신의 재측정치를 정확히 보고하지 못한 것이 이번이 처음이 아니라는 점(13→53→60, 그중 53 기반 파생 서술 하나는 1라운드가 이미 반증)에서, 특정 숫자를 감사 근거로 반복 기재하는 방식 자체의 신뢰도를 낮춘다. 코드 자체의 신규 결함이나 커버리지 공백은 발견되지 않았다.

## 위험도

MEDIUM — 프로덕션 코드·핵심 회귀 테스트는 재현 검증을 통과했으나(코드 결함 없음), 같은 파일이 두 라운드 연속으로 자기 재측정치를 부정확하게 보고한 패턴은 "숫자를 근거로 향후 테스트 정리·삭제 판단"을 오도할 수 있어 문서-신뢰성 측면에서 경고가 필요하다.
