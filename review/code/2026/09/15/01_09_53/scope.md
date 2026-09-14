# 변경 범위(Scope) 리뷰 — trigger-config-lost-update (라운드 01_09_53)

## 검토 방법

`git log --oneline origin/main..HEAD` 로 이 브랜치의 커밋 12개를 확인하고, `git diff --stat origin/main...HEAD -- codebase/ CHANGELOG.md plan/`로 review 산출물을 제외한 실제 코드/문서 변경 파일 19개를 전수 열거했다. 각 파일의 전체 diff(`git diff origin/main...HEAD -- <path>`)와 최신 커밋(`2a87eb2f0`)의 diff를 직접 읽고, 프롬프트에 실린 unified diff 조각과 대조했다(일치 확인). 저장소에 어떤 파일도 쓰거나 뮤테이션하지 않았다 — 전 과정 `git show`/`git diff`(read-only)만 사용했고, 종료 시점 `git status`는 조사 전과 동일(변경 없음)하다.

## 실제 코드/문서 변경 파일 (19개, review 산출물 제외)

```
CHANGELOG.md
codebase/backend/src/modules/hooks/hooks.service.spec.ts
codebase/backend/src/modules/hooks/hooks.service.ts
codebase/backend/src/modules/schedules/schedules.service.spec.ts
codebase/backend/src/modules/schedules/schedules.service.ts
codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts
codebase/backend/src/modules/triggers/chat-channel-binder.service.ts
codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts
codebase/backend/src/modules/triggers/chat-channel-input-rules.ts
codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts
codebase/backend/src/modules/triggers/trigger-config-lock.ts
codebase/backend/src/modules/triggers/triggers.service.spec.ts
codebase/backend/src/modules/triggers/triggers.service.ts
codebase/backend/src/modules/triggers/triggers.web-chat.spec.ts
codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts
codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts
codebase/backend/src/repo-guards/__tests__/fixtures/endpoint-path-save.fixture.ts
codebase/backend/test/trigger-config-lost-update.e2e-spec.ts
plan/in-progress/trigger-config-lost-update.md
```

나머지 200여 개 파일은 전부 `review/code/2026/09/14/*`·`review/code/2026/09/15/*`·`review/consistency/2026/09/14/17_10_16/*` — 이 저장소의 `developer` 워크플로 규약(`consistency-check --impl-prep` 의무, `/ai-review` 매 라운드 산출물 보존)이 요구하는 동반 아티팩트이며, 이미 앞선 12개 라운드 scope 리뷰가 반복 확인한 사항이라 이번 라운드에서 다시 이슈로 세지 않는다.

## 발견사항

- **[INFO]** `package.json`/lockfile/CI 설정/린트 설정 변경 0건
  - 위치: 해당 없음 (diff 자체가 없음)
  - 상세: 위 19개 파일 목록에 설정 파일이 없다. 신규 유틸(`trigger-config-lock.ts`)도 기존 `typeorm` API 만 사용한다.
  - 제안: 없음.

- **[INFO]** `hooks.service.ts`/`schedules.service.ts` 변경은 core 수정(`trigger-config-lock.ts`)이 열어 둔 구멍을 닫는 필연적 확장이지 별도 관심사가 아니다
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` `touchLastTriggeredAt`(신규 private 메서드), `codebase/backend/src/modules/schedules/schedules.service.ts` `update()`/`remove()`
  - 상세: `hooks.service.ts`의 두 호출부는 `trigger.lastTriggeredAt = new Date(); await this.triggerRepository.save(trigger);` → `await this.touchLastTriggeredAt(trigger)`로 바뀌었고, 새 private 메서드는 `save(entity)` 대신 `update({id}, {lastTriggeredAt})`만 쓴다. `schedules.service.ts`의 `update()`도 `save(trigger)` → 컬럼 한정 `update()`로, `remove()`의 cascade delete도 `triggerRepository.delete()` → `acquireTriggerConfigLock` 안에서 `m.delete()`로 바뀌었다. 두 파일 모두 "엔티티 전체를 저장/삭제하면서 `config` 스냅샷을 되쓰거나 config 락 밖에서 삭제되는" 같은 결함 클래스의 자리이며, CHANGELOG(Unreleased 항목)가 "일곱 자리 + 삭제 경로 둘"로 명시한 목록에 정확히 대응한다. 임의 리팩토링이 아니라 결함 클래스의 전수 폐쇄다.
  - 제안: 조치 불요.

- **[INFO]** `repo-guards/__tests__/*` 3개 파일 변경은 정적 래칫이 새 코드 형태(`manager.transaction` 안의 `save`/콜백 경계)를 잘못 fail-safe 오탐하는 것을 막기 위한 필수 동반 수정
  - 위치: `endpoint-path-conflict-wrap-guard.ts`(`TRIGGER_ENTITY` 상수·콜백 경계 판별), `endpoint-path-conflict-wrap.spec.ts`(`EXPECTED_UNWRAPPED_TRIGGER_SAVES` 목록이 6개→0개로 축소, `update`/`managerSaveWrapped` 케이스 추가), `endpoint-path-save.fixture.ts`(`FakeManager`/`Trigger` 클래스 fixture 추가)
  - 상세: 저장 동사가 `save(entity)`→락 안 `update`/`manager.save(Trigger, …)`로 바뀌면서, 기존 가드가 수신자 이름(`triggerRepository`)만 보던 판이 `manager.transaction` 콜백 인자(`m`)로의 이동을 놓치거나(수신자 매칭 실패) `ts.isStatement`에서 멈춰 콜백 안의 래핑을 못 보는(fail-safe 오탐) 두 결함을 낼 수 있었다는 것이 커밋 메시지(`91b816498`)에 실측으로 기록돼 있다. 세 파일 모두 이 가드가 코드 리팩토링을 정확히 계속 추적하도록 하는 목적에 국한되고, `EXPECTED_UNWRAPPED_TRIGGER_SAVES`를 빈 배열로 만든 것도 "새 `save()`가 생기면 그 자리에서 즉시 단언이 깨지는" 더 엄격한 상태로의 전환이라 범위 완화가 아니라 강화다.
  - 제안: 조치 불요.

- **[INFO]** `chat-channel-input-rules.ts`의 `extractInboundSigningRef` 함수 추출은 3중 복제된 인라인 캐스트를 하나로 합친 것 — 새 기능 추가가 아니다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:239-250`
  - 상세: `{ chatChannel?: { inboundSigningRef?: string } }` 인라인 캐스트가 `update()` 안 둘 + binder 하나, 총 세 자리에 복제돼 있던 것을 이번 수정이 새 게이트 항(재읽은 행의 ref presence)을 추가하며 네 번째 사용처가 생기자 함수로 뽑은 것이다(`/ai-review` `19_07_43` maintainability WARNING#7 대응). 순수 추출 리팩터이며 동작 변경이 없고, 이 PR 자체가 그 자리를 새로 건드리는 김에 정리한 것이라 범위 안이다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/trigger-config-lost-update.md`(약 670줄, +14줄 최신 커밋)는 이 저장소 규약이 요구하는 작업 추적 문서
  - 위치: `plan/in-progress/trigger-config-lost-update.md`
  - 상세: `CLAUDE.md`의 "진행 중 작업" 규약에 따른 산출물이며, 각 라운드에서 발견된 "같은 클래스의 자리가 몇 개 더 있었는가"를 실측으로 갱신하는 내용이라 코드 변경 범위와 1:1 대응한다.
  - 제안: 조치 불요.

이 외에 요청 범위를 벗어난 리팩토링, 임포트 전용 정리, 포맷팅 전용 변경, 불필요한 주석 추가/삭제, 무관한 파일·설정 수정은 발견되지 않았다. 새로 도입된 `trigger-config-lock.ts`(락 키 생성 + `rewriteTriggerConfigLocked` + delete lock 헬퍼)도 이 PR 이 겨냥한 "config lost-update" 문제 해결에 필요한 최소 표면이며, over-engineering으로 볼 만한 여분 기능(설정 플래그, 범용 추상화 계층 등)은 없다.

## 요약

12개 커밋에 걸친 반복 수정 전체를 `origin/main` 대비 확인한 결과, review/consistency 산출물(약 210개 파일, 워크플로 규약이 요구하는 동반 아티팩트)을 제외하면 실제 코드·plan 변경은 19개 파일로 좁게 유지되고 있다. 각 파일의 변경은 전부 "동시 PATCH/삭제가 `trigger.config`를 스냅샷 통째 덮어써 `inboundSigningRef`를 잃는 lost-update"라는 단일 결함 클래스의 폐쇄에 직접 대응한다 — `hooks.service.ts`/`schedules.service.ts`의 확장은 같은 결함 클래스의 추가 발견 자리를 닫는 것이고, `repo-guards` 3개 파일 수정은 정적 래칫이 새 코드 형태를 정확히 계속 추적하게 하는 필수 동반 수정이며, `extractInboundSigningRef` 추출은 이 수정이 새로 만든 네 번째 사용처를 계기로 한 순수 중복 제거다. 요청 이상의 기능 확장, 무관한 리팩토링, 포맷팅 전용 변경, 설정 파일 변경은 발견되지 않았다.

## 위험도

NONE
