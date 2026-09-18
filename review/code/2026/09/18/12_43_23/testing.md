# 테스트(Testing) 리뷰 — trigger (workflow_id) 인덱스 + 외부 해제 select 좁히기

## 검토 방법

프롬프트가 3개 핵심 코드 파일(`trigger-resource-releaser.service.spec.ts`, `trigger-resource-releaser.service.ts`,
`trigger-deletion-releases-resources.e2e-spec.ts`)을 크기 제한으로 잘라냈으므로 `Read` 로 전문을 직접 열어 확인했다.
추가로 `chat-channel-binder.service.spec.ts`(관련 협력자의 소비 측 테스트), `trigger.entity.ts`(select 대상 필드
확인), 마이그레이션 디렉터리(V111 번호·이름 충돌)를 대조했고, 수정된 유닛 테스트(`trigger-resource-releaser.service.spec.ts`,
11개)를 직접 실행해 GREEN 을 확인했으며, 두 TS 파일이 `tsc --noEmit`(backend `tsconfig.json`, 전체 트리 대상)에서
파일별 오류 0건임을 확인했다(리포지토리 전체 baseline 오류 197건은 이 두 파일과 무관 — grep 매치 0).

## 발견사항

- **[INFO]** `config` 필드 select 축소의 e2e 행동 커버리지 부재 (비용 트레이드오프로 이미 문서화됨)
  - 위치: `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` 파일 상단 독스트링(“비밀 행은 SQL 로
    심는다” 절, 34~37번째 줄) 및 `releaseExternalForParent` (`trigger-resource-releaser.service.ts:72`)
  - 상세: 이번 diff 의 `select: { id, type, config }` 축소 중 `type` 축소는 e2e 가 실제 DB·BullMQ 로 행동
    검증한다(“워크플로 삭제 — 그 워크플로 스케줄의 BullMQ job scheduler 가 해제된다”, e2e-spec.ts:243). 반면 `config`
    축소(chat-channel teardown 이 `config.chatChannel` 을 읽는 경로)는 telegram provider mock 부재·비용(~18초/호출)
    때문에 e2e 에서 실제로 행사되지 않는다 — 파일 자체가 이 트레이드오프를 명시하고 있다. 방어는 두 갈래로 쪼개져 있다:
    (1) `trigger-resource-releaser.service.spec.ts:96-99` 의 `toHaveBeenCalledWith` 정확 일치 단언이 select 객체
    자체의 축소를 잡고, (2) `chat-channel-binder.service.spec.ts` 의 별도 유닛 테스트가 `teardownChatChannel` 의
    `config.chatChannel` 읽기 로직을 실제 함수로 검증한다. 두 테스트가 서로 다른 파일에서 mock 경계를 사이에 두고
    나뉘어 있어, 두 계약(“이 컬럼을 싣는다” / “이 컬럼을 이렇게 읽는다”) 중 하나가 조용히 바뀌면 각 파일은 독립적으로
    는 계속 GREEN 일 수 있다(교차 통합 테스트는 없음).
  - 참고: 리뷰 도중 관찰한 `plan/in-progress/spec-draft-trigger-workflow-index.md` 의 동시 갱신(아래 “관찰사항”
    참조)에 이미 “`select` 에서 `config` 제거 RED 1/1, `type` 제거 RED 1/1” 이라는 뮤턴트 실측이 기록돼 있어, 현재
    시점에는 (1)의 정확 일치 단언이 실제로 두 필드 제거를 모두 잡아낸다는 것이 실측으로 확인된 상태다. 이 INFO 는
    “지금 결함이 있다”가 아니라 “두 계약의 교차 검증이 e2e 대신 두 개의 분리된 유닛 테스트에 의존한다”는 구조적 지적이다.
  - 제안: 현재 상태로 병합해도 무방하나, 향후 다른 provider(telegram 외)로 e2e mock 이 생기면 워크플로/워크스페이스
    삭제 경로에 실제 chat-channel 트리거 하나를 끼워 `config` 축소가 실제로 teardown 을 깨지 않는지 e2e 로도
    닫는 것을 고려할 것.

- **[INFO]** `releaseExternalForParent`/`releaseExternalMany` 의 “부모 밑 트리거 0개” 엣지 케이스 미테스트
  - 위치: `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts:149-165` (`releaseExternalMany`)
    / 대응 테스트 `trigger-resource-releaser.service.spec.ts:128-136`(“schedule 타입이 없으면 스케줄을 조회하지
    않는다”)
  - 상세: 가장 가까운 테스트가 트리거 1개(webhook)로 “schedule 조회를 안 한다”만 확인하고, `triggers: []`(완전히
    빈 배열)로 `releaseExternalForParent`/`releaseExternalMany` 전체가 no-op 으로 안전하게 끝나는지를 직접 확인하는
    케이스는 없다. 로직상 단순 루프이므로 리스크는 낮지만, “부모 삭제 시 트리거가 하나도 없던 워크플로/워크스페이스”는
    실제로 발생 가능한 입력이다.
  - 제안: `trigger('none')` 없이 `triggers: []` 로 호출해 `scheduleRepository.find` 미호출·`teardownChatChannel`
    미호출·정상 완료(reject 없음)를 단언하는 케이스 하나 추가를 고려. 선택 사항(우선순위 낮음).

- **[INFO]** 마이그레이션(V111) 자체는 DDL 이라 유닛 테스트 대상이 될 수 없고, 검증은 전적으로 신규 e2e
  스키마 단언에 의존한다 — 강점으로 기록
  - 위치: `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts:191-212`(“schema: trigger
    (workflow_id) 인덱스가 유효하게 있다 (V111)”)
  - 상세: 인덱스 **존재**만이 아니라 `indisvalid`(CONCURRENTLY 빌드 실패 시 이름만 점유한 invalid 인덱스를 초록으로
    통과시키지 않기 위함)와 `pg_get_indexdef` 정규식(선두 컬럼·정확한 컬럼 목록)까지 3중으로 확인한다. 이는 이
    프로젝트가 이미 겪은 “존재만 보는 단언이 위양성을 만든다”는 교훈(BullMQ `getJobScheduler` 의 `:` id 껍데기 사례)과
    같은 클래스의 방어를 DB 인덱스 도메인에 올바르게 적용한 것이다. 결함이 아니라 확인 사항으로 기록한다.

## 회귀 테스트

- 변경된 유닛 테스트 파일을 직접 실행해 11/11 GREEN 확인 (`npx jest trigger-resource-releaser.service.spec.ts`).
- `select` 축소 이전부터 있던 시나리오(schedule job 실패·복구, undoAbsentWrite 등)는 diff 로 건드리지 않았고
  실행 결과도 그대로 통과 — 회귀 없음.
- 두 수정 대상 TS 파일(`trigger-resource-releaser.service.ts`, `trigger-resource-releaser.service.spec.ts`)과
  새 e2e 파일은 `tsc --noEmit` 기준 해당 파일명으로 매치되는 오류 0건.

## 테스트 가독성·격리·Mock 적절성

- `trigger-resource-releaser.service.spec.ts:94-95` 의 주석이 “이 mock 으로는 `config`/`type` 누락이 드러나지
  않는다”는 한계를 스스로 명시하고, 그 한계를 `toHaveBeenCalledWith` 정확 일치(부분 매칭이 아님)로 보완한 것은
  모범적인 뮤테이션 인식 테스트 작성이다.
- 각 테스트가 `make()` 헬퍼로 매 케이스 독립된 mock 세트를 생성해 테스트 간 상태 공유가 없다 — 격리 양호.
- e2e 신규 테스트는 기존 `db` 커넥션(공유 `beforeAll`)을 읽기 전용으로만 사용하고 상태를 변경하지 않아 다른 e2e
  케이스와 순서 의존성이 없다.

## 관찰사항 (뮤테이션 규약에 따른 보고 — 내가 만든 변경 아님)

리뷰 도중 `git status --short` 로 확인한 결과 `plan/in-progress/spec-draft-trigger-workflow-index.md` 가
읽기 시점 이후 다른 프로세스에 의해 갱신되어 있었다(체크리스트 두 항목이 `[ ]` → `[x]`로 바뀌고, `select` 에서
`config`/`type` 제거 시 각각 RED 1/1이라는 뮤턴트 실측과 e2e 개수(322) 기록이 추가됨). 이 리뷰 세션은 이 파일에
Write/Edit 를 수행하지 않았고, 저장소 내 어떤 파일도 수정·복원하지 않았다(`git status --short` 상 위 항목과
`review/code/2026/09/18/12_43_23/` 신규 디렉터리 외 변경 없음). 병행 세션(오케스트레이터 또는 developer)의 정상
갱신으로 보이며, 그 내용이 본 리뷰의 INFO 1 을 실측으로 뒷받침한다.

## 요약

핵심 변경은 (1) 신규 V111 마이그레이션(트리거 `workflow_id` 인덱스)과 (2) `releaseExternalForParent` 의 TypeORM
`select` 좁히기, (3) 이 둘을 검증하는 유닛·e2e 테스트 추가다. 테스트 설계 수준이 높다 — select 축소는 정확 일치
mock 단언으로 뮤테이션까지 방어했고(제거 시 RED 를 개발자가 실측 기록), 인덱스는 존재가 아니라 유효성(`indisvalid`)과
정의(`indexdef`)까지 확인해 CONCURRENTLY 실패의 대표적 함정을 미리 막았다. 남은 갭은 모두 INFO 수준이다 — `config`
필드 축소의 e2e 행동 커버리지가 비용 문제로 두 개의 분리된 유닛 테스트(select 축소 자체 vs 소비 로직)에 의존하는
구조적 지점, 그리고 “트리거 0개” 엣지 케이스의 명시적 부재. 회귀 위험은 실행·타입체크로 직접 확인한 결과 없음.

## 위험도

LOW
