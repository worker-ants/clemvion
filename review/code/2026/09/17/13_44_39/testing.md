# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** 뮤턴트 커버리지 표(M1)가 실측과 다르다 — 실제로는 테스트 1건만 잡는데 2건이 잡는다고 적혀 있다
  - 위치: `plan/in-progress/trigger-save-partial-patch.md:144` (체크리스트의 뮤턴트 표)
  - 상세: 표는 "M1 통째 엔티티 `save` 로 되돌림" 뮤턴트가 `저장 대상은 이 요청이 바꾸는 필드뿐이다`
    **와** `save 반환값의 null 이 재읽은 값을 덮지 않는다` 두 테스트 모두를 RED 로 만든다고 적었다.
    `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `m.save(Trigger, {...})` 호출을
    실제로 M1 이 서술하는 형태(`Object.assign(target, defined, {config: mergedConfig}); const written = await m.save(Trigger, target);`)로
    되돌려 두 테스트를 함께 돌려 보니(`npx jest triggers.service.spec.ts -t "저장 대상은 이 요청이 바꾸는 필드뿐이다|save 반환값의 null 이 재읽은 값을 덮지 않는다"`),
    `triggers.service.spec.ts:3862` (`저장 대상은…`)만 RED 였고 `triggers.service.spec.ts:3886`
    (`save 반환값의 null…`)은 **그대로 GREEN** 이었다. 이유는 두 번째 테스트가 검증하는 것은
    "응답이 `written`(save 반환값)의 `null` 로 덮이는가" 뿐이고, `written.updatedAt` 만 취하는
    응답 조립 로직(코드 712~713행)은 M1 로 바뀌지 않기 때문이다 — `m.save` 에 넘기는 인자가
    통째 엔티티든 부분 객체든 응답 조립부는 그대로라 이 테스트는 M1 을 구분하지 못한다.
    (참고로 M2 "반환값을 통째로 덮음" 뮤턴트는 재현해 실측대로 두 번째 테스트만 RED 였다 — 그
    항목은 정확했다.) 뮤턴트 재현·원복 후 `git status --short` 로 트리 클린 확인 완료(리뷰 산출물
    디렉터리 외 변경 없음).
  - 제안: 표의 M1 행에서 `save 반환값의 null 이 재읽은 값을 덮지 않는다` 를 빼고 `저장 대상은
    이 요청이 바꾸는 필드뿐이다` 단독으로 정정한다. 이 표는 "다음에 이 테스트를 지워도 되는가"
    판단의 근거가 되므로, 틀린 채로 남으면 두 번째 테스트만 있어도 M1 을 잡는다고 오판해 첫
    번째 테스트를 정리 대상으로 잘못 고를 위험이 있다.

- **[INFO]** e2e 가 실제로 검증한 컬럼은 CHANGELOG/plan 이 나열한 4개 중 2개뿐이다
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` describe `②` (`notification_secret_v2`·`last_triggered_at`만 사용)
  - 상세: `plan/in-progress/trigger-save-partial-patch.md` 의 "되돌아가는 대상" 표와
    `CHANGELOG.md` 는 `notification_secret_v2`·`chat_channel_token_v2`·`last_triggered_at`·
    `name`/`is_active`(schedule 동기화) 네 가지를 되돌림 대상으로 명시한다. 그런데 e2e ② 는
    `notification_secret_v2`·`last_triggered_at` 두 컬럼만 SQL 로 직접 갱신해 검증하고,
    `chat_channel_token_v2` null-write 나 schedule 역동기화 `name`/`is_active` 케이스는 e2e 로
    재현하지 않는다. 수정 자체가 컬럼-불특정(부분 객체는 넘기지 않은 컬럼 전부를 보호)이고 단위
    테스트의 키 집합 단언(`triggers.service.spec.ts:3881`)이 일반화된 보호를 검증하므로 기능적
    공백은 아니지만, 발표된 근거(CHANGELOG 표)가 e2e 로 실제 확인한 범위보다 넓게 읽힌다.
  - 제안: 필수는 아니지만, CHANGELOG/plan 표에 "e2e 로 직접 확인한 것은 2/4" 를 각주로 남기거나,
    시간이 되면 `chat_channel_token_v2` 케이스를 e2e ②에 한 줄 추가해 표와 증거 범위를 맞춘다.

- **[INFO]** `if (written.updatedAt)` 는 truthy 체크라 `null`/`undefined` 외의 falsy 값과 구분하지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:713`
  - 상세: `written.updatedAt` 은 실제로는 항상 `Date` 인스턴스이거나 `null`/`undefined` 이므로
    (mock 도 `undefined` 또는 `Date` 만 준다) 현재로선 문제가 되는 falsy 값(`0`, `''` 등)이 나올
    여지가 없다 — 실질적 결함은 아니다. 다만 의도가 "값이 있으면" 이 아니라 "재조회 실패로
    `null`/`undefined` 가 아니면" 이므로, `written.updatedAt != null` 로 쓰면 다음 사람이 truthy
    체크의 대상을 오해할 여지가 줄어든다.
  - 제안: 선택 사항. 현재 테스트(M3 대응 단언, `triggers.service.spec.ts:3886`)로 이미 "누락하면
    RED" 는 잡혀 있어 커버리지 문제는 없다.

## 좋았던 점 (참고용)

- `저장 대상은 이 요청이 바꾸는 필드뿐이다` 테스트가 **값이 아니라 키 집합**을 단언해
  (`Object.keys(savedEntity).sort()).toEqual(['config', 'id', 'name'])`, 통째 엔티티로 되돌리는
  어떤 뮤턴트도 일반적으로 잡는다 — 컬럼별로 개별 단언을 늘리는 대신 클래스 전체를 닫는 설계.
- e2e 특성 테스트(`trigger-update-save-window.e2e-spec.ts`)가 "락 안 재읽기~저장 사이" 창을
  HTTP 로 열 수 없다는 제약을 대기 훅 대신 TypeORM 직결 + 순차 `await` 로 결정적으로 재현—
  타이밍 의존 없이 재현 가능해 flaky 위험이 낮다.
- `withTransactionMock` 의 `save` 를 실제 TypeORM 처럼 "항상 객체를 반환" 하도록 충실화한 점
  (`result ?? target`)이 `update` 의 기존 관례(`{ affected: 1 }` 기본값)와 일관적이고, 두 대역이
  실제 동작과 괴리될 때 `TypeError` 로 드러나도록 설계돼 있다.
- PR 안에서 스스로 낸 회귀(반환값 `null` 덮어쓰기)를 e2e 가 잡았고, 그 반환 모양을 그대로 흉내낸
  단위 회귀 테스트(`save 반환값의 null 이 재읽은 값을 덮지 않는다`)를 남겨 mock-현실 괴리를 좁혔다.

## 요약

핵심 수정(부분 객체 `save`)은 단위 테스트의 일반화된 키 집합 단언과 e2e 특성 테스트(실제
Postgres+TypeORM 재현)로 견고하게 뒷받침되며, PR 스스로 낸 회귀도 e2e 가 잡아 회귀 테스트로
고정했다. 다만 plan 체크리스트의 뮤턴트 커버리지 표는 실측과 어긋나는 항목(M1)이 하나 있다 —
실제로 재현해 보니 두 테스트 중 하나만 그 뮤턴트를 잡는다. 코드 자체의 커버리지 공백은 아니지만
"어느 테스트가 무엇을 보장하는가" 에 대한 감사 기록이 틀려 있어, 향후 테스트 정리 시 잘못된
근거로 방어선이 뚫릴 위험이 있다. CHANGELOG/plan 이 나열한 4개 되돌림 컬럼 중 e2e 로 직접 확인한
것은 2개뿐이라는 점도 근거 서술과 실제 검증 범위 사이의 작은 괴리다.

## 위험도

LOW
