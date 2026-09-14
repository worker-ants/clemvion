# 요구사항(Requirement) Review

## 검토 범위

`trigger.config` lost-update(동시 PATCH/setup/rotate/webhook 이 서로의 `config` 쓰기를
스냅샷으로 되돌려 `inboundSigningRef` 를 잃고 인입 서명 검증이 fail-open 되던 결함)를 닫는
4라운드째 수정. 이번 라운드까지 포함해 창 **넷**(`update()` · chat-channel setup 성공/실패 ·
`rotateBotToken`) + 웹훅 hot path 2자리(`hooks.service.ts`)를 advisory lock
(`pg_advisory_xact_lock(hashtext('trigger-config:<id>'))`) + 락 안 재읽기로 닫았고, 삭제
레이스(창 1 의 orphan 부활)까지 막았다. 정적 가드(`endpoint-path-conflict-wrap-guard.ts`)를
`manager.transaction` 형태로 확장하고, 공용 트랜잭션 mock 헬퍼(`trigger-transaction-mock.ts`)를
분리했다.

핵심 파일을 전부 Read 하고, 관련 unit 5개 스위트(`trigger-config-lock.spec.ts` ·
`triggers.service.spec.ts` · `triggers.web-chat.spec.ts` · `hooks.service.spec.ts` ·
`endpoint-path-conflict-wrap.spec.ts`)를 직접 재실행해 **209 passed / 1 skipped, 0 failed**
를 확인했다. `tsc -p tsconfig.json --noEmit` 도 돌려 이 PR 이 건드린 파일(`triggers/`·`hooks/`·
`repo-guards/`) 관련 신규 타입 오류가 **0건**임을 확인했다(리포지토리 전역에 무관한 기존
타입 오류는 다수 있으나 전부 이 diff 밖의 파일이다). 저장소에 뮤테이션은 남기지 않았다
(`git status --short` 로 확인 — 이 리뷰 산출물 디렉터리 외 변경 없음).

## 발견사항

- **[INFO]** CHANGELOG 의 "행이 그 사이 삭제됐으면 쓰지 않는다" 서술이 창 1 의 실제 동작을
  뭉뚱그린다 — 창 1 은 "쓰지 않는다" 가 아니라 **404 를 던진다**
  - 위치: `CHANGELOG.md:14`(서술) vs `codebase/backend/src/modules/triggers/triggers.service.ts`
    `update()` 내 `if (!fresh) { throw new NotFoundException(...) }` (함수 `update`, 락
    트랜잭션 콜백 안)
  - 상세: CHANGELOG 는 "네 자리 전부"(`update()`·binder 성공/실패·`rotateBotToken`)를 묶어
    "락을 잡은 뒤에 행을 다시 읽어 병합한다. 행이 그 사이 삭제됐으면 쓰지 않는다" 라고 한
    문장으로 서술한다. 그런데 실제로 binder 2곳과 `rotateBotToken`(`rewriteTriggerConfigLocked`
    경유)은 `false` 를 반환하며 **조용히** 쓰기를 건너뛰는 best-effort 경로인 반면, `update()`
    (창 1)는 재읽은 행이 없으면 `NotFoundException({ code: 'RESOURCE_NOT_FOUND' })` 를 던져
    PATCH 호출자에게 **눈에 보이는 404** 로 응답한다(트랜잭션 롤백 후 `rethrowEndpointPathConflict`
    를 거쳐 그대로 전파 — 재확인함). 결과적으로 "쓰기가 일어나지 않는다" 는 참이지만, 호출자
    관점에서 넷의 처신이 동일하다고 오해할 수 있다. 이 구분 자체는 코드 주석
    (`triggers.service.ts:583-591`)과 plan(`trigger-config-lost-update.md` §D C1 항목)에는
    정확히 적혀 있어 **구현 결함은 아니다** — CHANGELOG 요약문 한 곳만 그 뉘앙스를 놓쳤다.
  - 제안: CHANGELOG 문단에 "단, `update()` PATCH 는 그 경우 조용히 넘어가지 않고 404
    `RESOURCE_NOT_FOUND` 를 응답한다(다른 세 자리는 best-effort 로 무시)" 한 줄만 보태면
    독자가 재현 시나리오를 오해하지 않는다.

- **[INFO]** 이 작업 자신의 완료 기준(plan 체크리스트)이 아직 두 항목 미완 — 코드 결함은
  아니고 self-tracked 상태
  - 위치: `plan/in-progress/trigger-config-lost-update.md:423-425`
    (`- [ ] 트래커 항목 [x] + 실측 각주`, `- [ ] run-test-all.sh`, `- [ ] /ai-review + --impl-done`)
    · `plan/in-progress/spec-draft-nullable-notation-followups.md:2278`(원 트래커 항목,
    아직 `- [ ]`)
  - 상세: 원 트래커 항목(`spec-draft-nullable-notation-followups.md:2278`)은 "창이 셋"이라는
    옛 이해로 등재돼 있고, 이번 4라운드 수정으로 실제로는 넷(+웹훅 hot path 2자리)이었음이
    실측됐다. plan 자신의 완료 기준이 "트래커 항목 체크 + 실측 각주(창이 넷이었다는 정정
    포함)"를 명시하는데 아직 체크되지 않았다. 코드 수정 자체의 기능적 결함은 아니며, 이미
    plan 문서가 스스로 인지하고 있는 잔여 작업이다(숨겨진 TODO 가 아니라 명시된 체크리스트).
  - 제안: 이 라운드의 `/ai-review` 가 Critical 0·Warning 0 으로 수렴하면, 정지 규칙(§체크리스트
    말미)대로 트래커 항목에 `[x]` + 실측 각주(창 넷, 웹훅 hot path 2자리)를 반영하고
    `plan/complete/` 로 옮기는 마무리 커밋을 잊지 말 것.

- **[INFO]** spec 본문은 이 변경의 락/동시성 메커니즘에 대해 침묵 — spec fidelity 위반 아님
  - 위치: `spec/5-system/15-chat-channel.md`(R-CC-21, §5.4.1.1 등) 전수 확인
  - 상세: `chatChannel.inboundSigningRef` 의 provider 별 발급·PATCH 정책(R-CC-21, §5.4.1.1)은
    이 PR 이 건드리지 않았고 코드도 그 규칙을 그대로 지킨다. advisory lock·재읽기·컬럼 한정
    update 는 전부 구현 세부(동시성 정합성)이고 spec 어디에도 이 락 설계를 요구하거나 금지하는
    문장이 없다. `plan` 의 `spec_impact: none` 선언과 정합한다. plan 이 스스로 등재한 후속
    planner 항목(§D 표 — `spec/5-system/15-chat-channel.md` 의 `code:` glob 미포함,
    `redis-keys.md §4` lock-key 계열 미등재)은 이미 이 브랜치 권한 밖으로 정확히 분류돼 있다.
  - 제안: 없음 — 회색지대이며 이미 올바르게 planner 범위로 분리돼 있다.

## 관점별 확인

- **기능 완전성**: 4개 쓰기 창 + 웹훅 hot path 2자리 전부 advisory lock/컬럼 한정 update 로
  닫혔음을 코드 읽기 + 테스트 재실행으로 확인. `create()` 는 동시성 문제가 성립하지 않는
  신규 INSERT 라 손대지 않은 것이 맞다.
- **엣지 케이스**: `config` null/undefined(`fresh.config ?? {}`), 재읽기 시점 삭제(창
  2·3·4 는 `false` 반환 + 부재 단언 테스트, 창 1 은 404 + `save` 미호출 단언 테스트) 모두
  전용 unit 으로 커버됨(`trigger-config-lock.spec.ts`, `triggers.service.spec.ts:3799-3814`).
- **TODO/FIXME**: 변경 파일 14개 전수 grep — `TODO`/`FIXME`/`HACK`/`XXX` **0건**.
- **의도와 구현 간 괴리**: 함수 JSDoc(`rewriteTriggerConfigLocked`, `extractInboundSigningRef`,
  `acquireTriggerConfigLock`)과 실제 구현이 인자·반환값·부작용 모두 정확히 일치. 주석이 예고한
  "락 안에서 재읽는다"·"config 를 뒤에 둔다"·"머지 실패 시 콜백 미호출" 전부 테스트로 고정됨.
- **에러 시나리오**: `manager.transaction()` 내부 예외(`NotFoundException`,
  `ConflictException` via `rethrowEndpointPathConflict`)가 트랜잭션 롤백 후 그대로 위로
  전파됨을 코드 경로 추적으로 확인. `setupChannel` 실패 시 catch 경로도 같은 락/재읽기
  프리미티브를 거쳐 대칭적으로 처리.
- **데이터 유효성**: 재읽기 쿼리는 `id`(+창 1 은 `workspaceId`)로 필터링. `columns`/`config`
  스프레드 순서가 테스트로 고정돼 호출부 실수로 `config` 가 컬럼에 덮이지 않음을 보장.
- **비즈니스 로직**: `inboundSigningRefSurvives` 게이트가 "요청 시작 시점 값 OR 이번 호출
  발급 OR 락 안 재읽은 행의 값"의 3항 OR 로 정확히 구현돼 fail-open 재발 시나리오(동시 요청이
  ref 를 막 확립하는 경우)를 닫음 — plan §B 의 시나리오 표와 코드가 일치.
- **반환값**: `rewriteTriggerConfigLocked`(`Promise<boolean>`)이 문서화된 계약대로 반환.
  세 호출부가 그 값을 무시하는 것은 plan/JSDoc 이 이미 알고 있는 후속 항목(§후속 표)이라
  숨은 결함이 아님.
- **spec fidelity**: 위 발견사항 참조 — 관련 spec(`15-chat-channel.md`)과 충돌 없음, 침묵
  영역(회색지대)으로 올바르게 분류됨.

## 요약

이 PR 은 트리거 `config` lost-update 를 4개 쓰기 창 + 웹훅 인입 hot path 2자리에서 advisory
lock + 락 안 재읽기로 닫는 4라운드째 수정이며, 이전 세 라운드의 리뷰가 발견한 Critical(창 1
자신이 새 lost-update 를 만든 것, 삭제된 트리거 부활, chat-channel 인입 회귀 테스트 부재,
정적 가드의 형태 추적 실패)이 이번 라운드 코드에 전부 반영·해소돼 있음을 직접 코드 읽기와
테스트 재실행(209 passed / 1 skipped, 관련 파일 신규 타입 오류 0건)으로 독립 확인했다. 새로
발견한 것은 CHANGELOG 서술 정밀도(창 1 은 조용히 skip 이 아니라 404 를 던진다)와 이 작업
자신의 plan 체크리스트 잔여 두 항목뿐이며, 둘 다 코드 결함이 아니라 문서/마무리 절차 수준의
INFO 다. spec 은 이 변경의 락 메커니즘에 침묵하고 있고 그것이 정상이다(`spec_impact: none`
과 정합). 요구사항 충족 관점에서 이 변경을 막을 사유는 없다.

## 위험도

LOW
