# 요구사항(Requirement) Review

## 검토 범위

`trigger.config` lost-update(동시 PATCH 가 서로의 쓰기를 되돌려 `chatChannel.inboundSigningRef`
를 지우고 인입 서명 검증을 fail-open 시키는 결함) 수정 배치. 실제 코드 변경은:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규 — advisory lock + 락 안
  재읽기 유틸)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` (성공/실패 경로를
  `rewriteTriggerConfigLocked` 로 전환, presence 게이트 재계산)
- `codebase/backend/src/modules/triggers/triggers.service.ts` (`update()` 창 1 — 병합+저장을
  같은 락 안으로, `remove()` — 삭제도 같은 락 + 5s 상한, `rotateBotToken()` — 락 안 재읽기)
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`extractInboundSigningRef`
  추출)
- `codebase/backend/src/modules/hooks/hooks.service.ts` (`touchLastTriggeredAt` — 웹훅 hot path
  의 같은 fail-open 클래스 수정)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (정적 가드가
  `manager.transaction(async (m) => m.save(Trigger, …))` 형태를 따라가도록 확장)
- 그 외 다수 테스트 파일(`*.spec.ts`) 및 신규 e2e(`trigger-config-lost-update.e2e-spec.ts`)

나머지 파일(`review/code/**`, `review/consistency/**`)은 이전 라운드 산출물이 커밋에 포함된
것으로, 실행 코드가 아니라 리뷰 대상에서 제외했다. `plan/in-progress/trigger-config-lost-update.md`
는 근거 대조용으로 확인했다.

이 PR 은 이미 5라운드의 `/ai-review`·`--impl-prep` 피드백을 거쳐 매 라운드 CRITICAL/WARNING 을
실측(뮤턴트 RED/GREEN)과 함께 닫아 온 이력이 plan 에 낱낱이 기록돼 있고, 실제 소스(`trigger-config-lock.ts`
JSDoc, `chat-channel-binder.service.ts`의 presence 게이트, `triggers.service.ts`의 창 1/삭제/
rotateBotToken 세 창, `trigger-config-lock.spec.ts`·`triggers.service.spec.ts`의 관측 고리
`onLock`/`onLockTimeout`/`freshFindOne`)을 직접 열어 그 서술과 대조했다. 설계(외부 호출을 락
밖에 두고 락 안에서 재읽기)·Cafe24 advisory lock 기각 선례 인용(`spec/2-navigation/4-integration.md:1444`
의 문구와 정확히 일치)·삭제 경합 처리·웹훅 hot path 전환·정적 가드 확장 전부 소스 대조 결과
서술대로 구현돼 있고, 뮤턴트 기반 회귀 테스트(락 순서·상한·게이트 미행사·presence 게이트 3항)가
실제로 그 지점을 무는 것을 코드에서 확인했다.

## 발견사항

- **[WARNING]** CHANGELOG 의 "대기 상한은 없다" 서술이 이후 커밋이 추가한 삭제 경로 예외를
  반영하지 못해, 구현과 어긋난 채로 남아 있다
  - 위치: `CHANGELOG.md:34-36` (`**대기 상한은 없다** — 같은 트리거의 동시 요청은 앞선 요청이
    커밋할 때까지 기다린다. … 그 제약이 깨지는 변경을 하면 `lock_timeout` 을 함께 넣어야 한다.`)
  - 상세: 이 문단은 커밋 `12ed21ff1`(§D "창 1 도 닫는다")에서 작성됐다. 그런데 이후 커밋
    `e5319a409`(git 로그 기준 가장 최근 트리거 관련 커밋, "관측 고리가 없으면 보증도 없다")가
    `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 에
    `TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`(`SET LOCAL lock_timeout`)을 도입해 **삭제
    경로만 5초 대기 상한을 두도록** 만들었다 (`triggers.service.ts` `remove()` 의
    `acquireTriggerConfigLock(m, id, { timeoutMs: TRIGGER_DELETE_LOCK_TIMEOUT_MS })`). 이
    비대칭은 테스트로도 명시적으로 고정돼 있다 — `triggers.service.spec.ts` 의
    `remove() 도 같은 config 락을 잡는다` 테스트는 `events` 배열에
    `"timeout:SET LOCAL lock_timeout = '5000ms'"` 가 **삭제 경로에만** 찍히는 것을 단언하고,
    바로 다음 테스트 `update() 는 락 대기에 상한을 두지 않는다 (삭제만 예외다)` 가 그 대칭을
    명시적으로 검증한다. 즉 **코드와 테스트는 "삭제만 상한이 있다"로 정확히 일치**하지만,
    `CHANGELOG.md` 는 이 예외를 언급하지 않고 "대기 상한은 없다"를 무조건 문장으로 남겨,
    이 배치 하나(단일 `## Unreleased` 항목, 다른 위치에 분리 기재된 바 없음)를 읽는 다음
    개발자/운영자가 삭제 경로에서 발생 가능한 `lock_timeout` 오류(경합 시 요청 실패로 관측됨)를
    예상하지 못하게 한다. 이 CHANGELOG 항목이 이미 삭제 락(`삭제(DELETE /api/triggers/:id)도
    같은 락을 잡는다`, `:16-17`) 자체는 언급하고 있어서, 그 문단이 상한 예외까지 함께 갱신되지
    않은 것은 편집 누락으로 보인다(이 PR 이 스스로 여러 차례 지적해 온 "CHANGELOG 가 이전 커밋
    시점의 범위에 머무른다" 패턴의 재발 — plan §D 3라운드 처분 W2 참조).
  - 제안: `CHANGELOG.md:34-36` 문단에 "단, 삭제(`DELETE /api/triggers/:id`)만 되돌릴 수 없는
    정리(teardown·secret 삭제) 이후에 락을 잡으므로 무한 대기가 위험해 `SET LOCAL lock_timeout
    = 5s` 를 둔다" 는 취지의 한 문장을 추가해 실제 구현(및 테스트가 고정한 계약)과 일치시킨다.

- **[INFO]** plan 의 "후속(developer 범위)" 표에 이미 이 PR 이 해결한 항목이 미해결 항목과
  같은 자리에 남아 혼동을 준다
  - 위치: `plan/in-progress/trigger-config-lost-update.md` — "후속(developer 범위) — 이 PR 로
    넓히지 않는다" 표의 `remove() 가 같은 락을 안 잡는다` 행
  - 상세: 표 제목("이 PR 로 넓히지 않는다")과 달리 해당 행의 본문은 "**지금은 네 창 모두 «행이
    없으면 쓰지 않는다»**"라고 이미 해결됐음을 서술한다. 실제로 `triggers.service.ts`
    `remove()`(`:968-974`)는 `acquireTriggerConfigLock` 을 잡은 뒤에만 `m.remove(trigger)` 를
    호출해 코드는 이미 이 항목을 닫았다. 표 제목만 보고 훑는 다음 독자는 "remove() 는 아직
    락이 없다"로 오해할 수 있다. 기능적 결함은 아니고(코드는 맞다) 계획 문서의 배치 문제다.
  - 제안: 이 행을 "후속" 표에서 제거하거나 "해결됨 — 참고용으로만 남김" 으로 표시.

## 관점별 확인 (요약)

- **기능 완전성**: `config` 를 스냅샷으로 통째 덮어쓰던 4창(창1 update / binder 성공·실패 /
  rotateBotToken) 전부 "락 안 재읽기 + presence 게이트 재계산" 으로 배선됐고, 웹훅 hot path
  2자리(`hooks.service.ts`)도 컬럼 한정 `update` 로 전환돼 같은 클래스의 더 잦은 재발 경로가
  닫혔다. 소스 대조 결과 plan 이 서술한 배선과 정확히 일치한다.
- **엣지 케이스**: 재읽기 시점 행 삭제(`!fresh` → `false`/404), `config` null/undefined(`?? {}`),
  `chatChannel` 미포함 PATCH, telegram/slack/discord 세 provider 의 ref 확립 축 분기 모두
  `trigger-config-lock.spec.ts`·`triggers.service.spec.ts`·e2e 로 개별 커버됨을 확인했다.
- **TODO/FIXME**: 변경된 소스 파일에 TODO/FIXME/HACK/XXX 없음(grep 확인).
- **의도와 구현 간 괴리**: `touchLastTriggeredAt` 이름과 동작(컬럼 한정 update, in-memory 필드도
  갱신) 일치. `rewriteTriggerConfigLocked` JSDoc 의 창별 표(동기 요청=404, best-effort=false)와
  실제 호출부(`rotateBotToken` 의 `if (!wrote) this.assertTriggerFound(null)`, binder 의 `if
  (wrote) register(...)`)가 정확히 대응한다. 위 CHANGELOG 건 외에는 괴리를 찾지 못했다.
- **에러 시나리오**: `rethrowEndpointPathConflict` 가 unique violation 만 409 로 변환하고 그 외
  (예: 창 1 내부의 `NotFoundException`)는 `throw err` 로 그대로 전파해 404 가 409 로 뒤바뀌지
  않음을 확인했다. `remove()` 의 락 실패는 `logger.error` 로 "반쯤 삭제된 상태"를 명시적으로
  남기고 재던짐.
- **데이터 유효성**: 이 배치는 검증 로직을 바꾸지 않았고(`assertChatChannelInputSafe` 등 기존
  그대로), `extractInboundSigningRef` 의 7갈래 입력(정상/필드 없음/null/키 없음/빈 객체/config
  null/undefined)이 전부 `chat-channel-input-rules.spec.ts` 로 커버된다.
- **비즈니스 로직**: R-CC-21(PATCH 는 비밀을 쓰지 않는다)·CCH-AD-02/03·CCH-SE-01(degraded, 자동
  비활성화 금지) 등 관련 spec 규칙은 이번 diff 가 건드리지 않았고 동작도 그대로 유지됨을
  확인했다(변경은 "어느 config 위에 병합하는가"와 "직렬화 여부"뿐).
  Cafe24 advisory lock 기각 선례 인용 문구(`spec/2-navigation/4-integration.md:1444` 부근)도
  원문과 정확히 일치한다.
- **반환값**: `rewriteTriggerConfigLocked`(`Promise<boolean>`), `touchLastTriggeredAt`
  (`Promise<void>`), `extractInboundSigningRef`(`string | undefined`) 모든 코드 경로에서 값을
  반환한다. 세 호출부가 `boolean` 반환값을 관측하지 않는 점은 이미 4라운드 리뷰가 지적해
  JSDoc 에 "관측 가능하게 하려는 것"이라 명시하고 후속 항목으로 등재돼 있다(신규 지적 아님).
- **관련 spec 본문 일치 여부**: 이 결함 수정은 `spec_impact: none` 으로 선언돼 있고, 실제로
  `spec/5-system/15-chat-channel.md`(R-CC-21/CCH-AD-02/CCH-SE-01 등)와 `spec/2-navigation/4-integration.md`
  (Cafe24 advisory lock 기각) 어디에도 이 동시성 계약(락 유무·대기 상한)을 규정하는 본문이
  없다 — spec 이 침묵하는 영역이라 SPEC-DRIFT 대상이 아니며 위 CHANGELOG 건은 spec 이 아니라
  CHANGELOG 자체의 내부 일관성 문제다.

## 요약

동시 PATCH 가 `trigger.config` 를 스냅샷으로 통째 덮어써 인입 서명 검증을 fail-open 시키던
lost-update 결함을, advisory lock(트리거 단위) + "락 안에서 재읽고 presence 게이트를 재계산해
병합" 패턴으로 4개 쓰기 창(창1 update·binder 성공/실패·rotateBotToken) 전부와 웹훅 인입 hot
path 2자리에 일관되게 배선했다. 외부 provider 호출을 락 밖에 둔 설계는 저장소의 기각된 선례
(Cafe24)를 정확히 학습해 반영했고, 삭제 경합·행 부활 방지·정적 가드(엔티티 인자 기반 스캔)까지
전수 대응했다. 소스·테스트를 직접 열어 plan 의 서술과 대조한 결과 기능적 결함이나 spec 위반은
발견하지 못했다. 유일하게 실재하는 문제는 `CHANGELOG.md` 의 "대기 상한은 없다" 서술이 이후
커밋이 추가한 삭제 경로 5초 상한 예외를 반영하지 못해 구현·테스트와 어긋나 있다는 점(WARNING)
이며, plan 문서의 "후속" 표 배치 혼동은 INFO 수준이다. 둘 다 코드 자체의 정확성에는 영향이
없는 문서 갱신 항목이다.

## 위험도

LOW
