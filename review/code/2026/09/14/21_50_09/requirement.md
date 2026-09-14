# 요구사항(Requirement) Review

## 검토 범위

`trigger.config` lost-update(동시 PATCH/rotate/삭제가 서로의 쓰기를 되돌려
`chatChannel.inboundSigningRef` 를 지우고 인입 서명 검증을 fail-open 시키는 결함) 수정
배치의 **7라운드째** `/ai-review`. 실제 코드 변경 대상을 직접 열어 최신 HEAD(`bf2becd0c`)
상태로 확인했다:

- `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — advisory lock + 락 안
  재읽기 유틸, 삭제 전용 5초 상한(`TRIGGER_DELETE_LOCK_TIMEOUT_MS`)
- `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` — 성공/실패 두
  경로가 공유하는 `buildChannel` 클로저 + `survivesWithFresh` presence 게이트
- `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()`(창 1, 병합+저장을
  같은 락 안으로), `remove()`(삭제도 같은 락 + 상한 + 실패 재던짐), `rotateBotToken()`
  (락 안 재읽기 + 404), `throwTriggerNotFound()` 분리
- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` —
  `extractInboundSigningRef` 로 인라인 캐스트 3자리 통합
- `codebase/backend/src/modules/hooks/hooks.service.ts` — `touchLastTriggeredAt`(컬럼 한정
  `update`, 두 hot-path 호출부 공유)
- `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` — 정적
  가드가 `manager.transaction(async (m) => m.save(Trigger, …))` 형태를 따라가도록 확장
- 다수 `*.spec.ts` + 신규 e2e(`trigger-config-lost-update.e2e-spec.ts`) + `CHANGELOG.md`

나머지 파일(`review/code/**`, `review/consistency/**`)은 이전 라운드 산출물이 커밋에 포함된
것으로 리뷰 대상에서 제외했다. `plan/in-progress/trigger-config-lost-update.md` 는 근거
대조·이력 확인용으로 열었다.

이 PR 은 이미 6라운드의 `/ai-review`(직전 라운드 `21_18_21` 은 14인 전수 Critical 0·
WARNING 1)를 거쳤고, 그 라운드의 유일한 WARNING(CHANGELOG "대기 상한은 없다" 가 삭제 5초
예외를 반영 못함)과 INFO(plan 후속 표에 이미 해결된 행 잔존)는 이번 최종 커밋
`bf2becd0c`(및 그 직전 `e5319a409`)에서 실제로 수정됐음을 소스 대조로 확인했다:

- `CHANGELOG.md:34-41` 이 이제 "대기 상한은 없다 — 단 삭제는 예외다" + 5초 상한 사유
  문단을 함께 담고 있고, `trigger-config-lock.ts:76`(`TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`)
  · `triggers.service.ts:979-981`(`acquireTriggerConfigLock(m, id, { timeoutMs: … })`)와
  정확히 일치한다.
- `plan/in-progress/trigger-config-lost-update.md` 의 "후속(developer 범위)" 표에서 이미
  해결된 `remove()` 락 행이 제거됐다(현재 표에 해당 행 없음, §"후속" 섹션 확인).

이번 라운드(`bf2becd0c`)가 새로 추가한 항목도 직접 검증했다:

- **W1 (삭제 실패 전파 미검증)**: `triggers.service.spec.ts:3929`
  (`'remove() 실패는 삼키지 않고 던진다'`)가 `removeRejects: true` 로 `m.remove` 를
  reject 시키고, `service.remove(...)` 가 던지는 것 **과** `TRIGGER_DELETED` 감사가
  기록되지 않는 것 둘 다 단언한다. `triggers.service.ts:984-991` 의 `.catch` 가
  `logger.error` 뒤 `throw err` 하고, `recordAudit` 호출(`:992`)은 그 `await` 뒤에 있어
  실패 시 도달하지 않는다 — 서술·테스트·구현이 일치한다.
- **W3 (orphan JSDoc)**: `hooks.service.ts:957-979` 의 `touchLastTriggeredAt` JSDoc 과
  `:981-985` 의 `CCH-NF-03` JSDoc 이 각각 자기 함수 바로 위에 정확히 붙어 있다(되돌림 확인).
- **INFO#6·#7**: `throwTriggerNotFound(): never`(`triggers.service.ts:368`)로 분리되어
  `assertTriggerFound(null)` 우회 패턴이 사라졌고, `trigger-config-lock.spec.ts` 의
  null·undefined 케이스가 `it.each`(`['undefined', undefined], ['null', null]`)로 둘 다
  검증된다.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 은 없다.

- **[INFO]** e2e(`trigger-config-lost-update.e2e-spec.ts`)가 삭제 경합(창 1의 `remove()`
  advisory lock·5초 상한) 경로는 커버하지 않는다 — unit 만 커버
  - 위치: `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (파일 전체 — PATCH
    동시성 시나리오 하나만 존재, `remove()` 관련 e2e 없음)
  - 상세: 이 파일의 유일한 `it` 는 PATCH-PATCH 겹침만 재현한다. 삭제-쓰기 경합(§ `remove()`
    도 같은 config 락을 잡는다`)과 5초 lock_timeout 은
    `triggers.service.spec.ts:3853-3874`·`:3929-3941` 의 unit 뮤턴트 회귀로만 고정돼 있다.
    실제 Postgres `SET LOCAL lock_timeout` 동작(파라미터 바인딩 불가 자리라 문자열 보간을
    쓰는 `trigger-config-lock.ts:56-58`)은 unit mock 이 문자열 매칭으로만 관측하므로, 실제
    PG 세션에서 `Math.trunc` 결과가 유효한 interval 리터럴로 파싱되는지는 e2e 로 한 번도
    행사되지 않는다.
  - 제안: 차단 사유는 아니다(이미 plan 이 이 비대칭을 인지하고 있고, 값이 상수라 인젝션
    위험은 없다). 여유가 있으면 삭제 경합 e2e 하나를 추가해 `SET LOCAL lock_timeout` 구문이
    실제 PG 드라이버에서 파싱 오류 없이 동작함을 한 번은 실측하는 편이 좋다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 `boolean` 반환값을 세 호출부 모두 관측하지
  않는 점, `Trigger` 엔티티 하드코딩 등은 이미 plan `후속(developer 범위)` 표에 등재된
  기존 항목이며 이번 라운드의 신규 지적이 아니다(재확인만, 등급 변경 없음).

## 관점별 확인 (요약)

- **기능 완전성**: `config` 를 스냅샷으로 통째 덮어쓰던 4창(창1 update / binder 성공·실패 /
  rotateBotToken) + 웹훅 hot path 2자리(hooks.service.ts) + 삭제 경로(remove) 전부 "락 안
  재읽기 + presence 게이트 재계산" 또는 "컬럼 한정 update" 로 배선됐다. 소스 대조 결과 plan·
  CHANGELOG 서술과 정확히 일치한다.
- **엣지 케이스**: 재읽기 시점 행 삭제(`!fresh` → `false`/404), 쓰기 시점 삭제 경합
  (`remove()` 도 같은 락), `config` null/undefined(`extractInboundSigningRef` 의 7갈래
  입력 + `?? {}`), `chatChannel` 미포함 PATCH, telegram/slack/discord 세 provider 분기
  모두 unit/e2e 로 개별 커버됨을 확인했다.
- **TODO/FIXME**: 변경된 소스 파일에 TODO/FIXME/HACK/XXX 없음(grep 확인).
- **의도와 구현 간 괴리**: `touchLastTriggeredAt`·`throwTriggerNotFound`·
  `extractInboundSigningRef` 이름과 동작이 정확히 대응한다. `rewriteTriggerConfigLocked`
  JSDoc 의 창별 표(동기 요청=404, best-effort=false)와 실제 호출부가 일치한다. 이번
  라운드에 지적됐던 orphan JSDoc(CCH-NF-03)은 원위치로 복구됐다.
- **에러 시나리오**: `remove()` 실패가 삼켜지지 않고 재전파되며 그 경우 감사 로그도 남지
  않음이 뮤턴트 회귀로 고정됐다. `rethrowEndpointPathConflict` 는 unique violation 만
  409 로 변환하고 나머지는 그대로 전파한다.
- **데이터 유효성**: 이 배치는 기존 검증 로직(`assertChatChannelInputSafe` 등)을 바꾸지
  않았다. `SET LOCAL lock_timeout` 값은 `Math.trunc(options.timeoutMs)` 로 정수화되고
  호출부가 모듈 상수만 넘겨 사용자 입력 경로가 없다(SQL 인젝션 무관).
- **비즈니스 로직**: R-CC-21·CCH-AD-02/03·CCH-SE-01 등 관련 spec 규칙은 이번 diff 가
  건드리지 않았고 동작도 그대로 유지된다. Cafe24 advisory lock 기각 선례 인용 문구
  (`trigger-config-lock.ts:96-97`)를 `spec/2-navigation/4-integration.md:1444` 원문과
  직접 대조 — 정확히 일치한다.
- **반환값**: `rewriteTriggerConfigLocked`(`Promise<boolean>`)·`touchLastTriggeredAt`
  (`Promise<void>`)·`extractInboundSigningRef`(`string | undefined`)·
  `throwTriggerNotFound`(`never`) 모든 경로에서 타입과 일치하는 값을 반환/던진다.
- **관련 spec 본문 일치 여부**: `spec_impact: none` 으로 선언돼 있고, 실제로
  `spec/5-system/15-chat-channel.md`·`spec/2-navigation/4-integration.md` 어디에도 이
  동시성 계약(advisory lock 유무·대기 상한)을 규정하는 본문이 없다 — spec 이 침묵하는
  영역이라 SPEC-DRIFT 대상이 아니다. 인용된 선례 문구는 원문과 line-level 로 일치한다.

## 참고 (절차 투명성)

병렬 fan-out 리뷰 규약에 따라 저장소에 뮤테이션을 가하지 않았다(`git status --short` 로
확인, 이 세션이 생성한 리뷰 출력 디렉터리 외 변경 없음).

## 요약

동시 PATCH/rotate/삭제가 `trigger.config` 를 스냅샷으로 통째 덮어써 인입 서명 검증을
fail-open 시키던 lost-update 결함을 advisory lock + "락 안 재읽기·재계산" 패턴으로 4개
쓰기 창과 삭제 경로·웹훅 hot path 2자리까지 일관되게 닫은 배치다. 직전 라운드(14인 전수,
Critical 0)의 유일한 WARNING(CHANGELOG 서술 누락)과 이번 라운드 자체가 스스로 지적한
설계 목표 미검증(`remove()` 실패 전파)·orphan JSDoc 재발을 모두 실제 코드/테스트로 수정한
것을 소스 직접 대조로 확인했다. 이번 라운드에서 새로 발견되는 CRITICAL/WARNING 은 없으며,
남은 항목(삭제 경합 e2e 부재, 반환값 미관측 등)은 이미 plan 후속 표에 등재된 낮은 위험도의
기존 관찰이다. spec 본문은 이 동시성 계약에 침묵하며 인용된 선례 문구는 원문과 정확히
일치한다.

## 위험도

LOW
