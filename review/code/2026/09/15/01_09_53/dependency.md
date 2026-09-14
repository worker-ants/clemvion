# 의존성(Dependency) 리뷰 — trigger-config-lost-update (최신 라운드)

## 검토 범위

`git diff origin/main...HEAD --name-status` 로 `codebase/**` 변경 파일 17개를 전수 확인했다.
`package.json`/`pnpm-lock.yaml` 등 매니페스트·락파일 변경은 **0건**이다 (본 저장소 하위
디렉터리 어디에도 매니페스트 diff 없음, 직접 재확인).

이 changeset 은 이전에 이미 12라운드에 걸쳐 의존성 리뷰(`review/code/2026/09/14/18_17_44` ~
`2026/09/15/00_38_16`)를 거쳤고, 그 결론(새 외부 패키지 0건)이 이번 라운드에도 그대로
유지되는지 재확인했다. 다만 **최신 커밋(`2a87eb2f0`, "스케줄 cascade 도 같은 config 락을
잡는다")은 직전 라운드(`00_38_16`, 00:38:01) 이후, 이번 라운드 시작(01:09:53) 직전(01:09:37)에
생성**되어 이전 어떤 dependency.md 에도 반영되지 않았다 — 이 부분은 신규로 검증했다.

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 신규/수정 파일 전량이 기존 선언 의존성만 사용
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (신규),
    `codebase/backend/src/modules/schedules/schedules.service.ts` (수정),
    `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` (신규)
  - 상세: 각 파일의 `import` 를 직접 열어 확인했다. `trigger-config-lock.ts` 는 `typeorm`
    (`EntityManager`, 서브패스 `QueryDeepPartialEntity`)과 내부 `Trigger` 엔티티만 참조한다.
    `schedules.service.ts` 는 이번 라운드에 `../triggers/trigger-config-lock` 에서
    `acquireTriggerConfigLock`·`TRIGGER_DELETE_LOCK_TIMEOUT_MS` 를 새로 import 했는데, 둘 다
    프로젝트 내부 심볼이다. e2e 스펙은 `pg`(`Client`)·`node:crypto`·`@jest/globals`·`supertest`
    를 쓰며, `codebase/backend/package.json` 에 각각 `^8.20.0`/`^30.0.0`/`^7.0.0` 로 이미
    고정 선언돼 있다(직접 grep 확인). 버전 고정·라이선스·취약점·번들 크기·빌드 시간 항목은
    모두 **해당 없음**(새 의존성이 없으므로).
  - 제안: 없음.

- **[INFO]** `typeorm` 비공개 서브패스 import 재사용 — 신규 노출 표면 아님(기존 선례와 동일 패턴)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:2`
    (`import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'`)
  - 상세: 이 경로는 `typeorm` 의 공개 배럴이 아닌 내부 경로다. 설치된 `typeorm@0.3.31`
    (pnpm store, `node_modules/.pnpm/typeorm@0.3.31_.../typeorm/query-builder/QueryPartialEntity.d.ts`)
    에 실제로 존재함을 확인했다. `package.json` 은 `typeorm` 을 `^0.3.31`(caret)로 고정해
    minor/patch 자동 갱신을 허용하므로 이론적으로 이 경로가 이동하면 빌드가 깨질 수 있지만,
    동일 패턴이 기존 `codebase/backend/src/modules/workflows/workflows.service.ts:15` 에
    이미 존재해(같은 import 문 확인) 이번 PR 이 새로 넓히는 위험은 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. `typeorm` 업그레이드 시 두 사용처(`workflows.service.ts`,
    `trigger-config-lock.ts`)를 함께 검증 대상에 넣는 백로그 성격.

- **[INFO]** 신규 내부 모듈 의존 엣지 — `schedules` → `triggers/trigger-config-lock` (신규, 단방향)
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts` (import 구문),
    `codebase/backend/src/modules/triggers/triggers.module.ts` (`imports: [..., SchedulesModule]`)
  - 상세: 최신 커밋에서 `schedules.service.ts` 의 스케줄 cascade 삭제 경로가
    `this.triggerRepository.manager.transaction(...)` 안에서 `acquireTriggerConfigLock` 을
    직접 호출하도록 바뀌면서, `SchedulesModule` 소속 파일이 `triggers/` 디렉터리의 파일을
    plain TS import 로 참조하는 첫 사례가 생겼다. `TriggersModule` 은 이미 NestJS 모듈
    레벨에서 `SchedulesModule` 을 `imports` 에 갖고 있어(기존, 이번 PR 무관) 두 모듈은
    이전부터 결합돼 있었다 — 이번 변경은 그 결합의 **반대 방향**에 파일 수준 import 한 줄을
    더한 것이다. `trigger-config-lock.ts` 자체는 `typeorm` + `Trigger` 엔티티 외 아무것도
    import 하지 않는 리프(leaf) 유틸리티라(직접 확인) 순환 의존은 생기지 않는다. 다만
    "트리거 config 락" 이라는 개념을 이제 두 별개 NestJS 모듈이 공유하게 됐다는 점에서,
    이 유틸리티가 `triggers/` 디렉터리 소유로 남는 것이 장기적으로 적절한지(예: 공용
    위치로 옮길지)는 검토 여지가 있다 — 지금 당장 문제를 일으키지는 않는다.
  - 제안: 조치 불요(차단 사유 아님). 세 번째 소비 모듈이 더 생기면 그때 공용 모듈로의
    이동을 고려.

- **[WARNING]** 공유 테스트 유틸리티의 "내부 의존 소비자" 목록이 같은 PR 의 마지막 커밋으로
  즉시 낡았다
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:43-47`
  - 상세: 이 파일의 JSDoc 은 "`Trigger` repo mock 을 가진 6개 파일 중 실제로
    `withTransactionMock` 으로 감싼 것은 2개(`triggers.service.spec.ts`,
    `triggers.web-chat.spec.ts`)뿐이고, 나머지 4개(`auth-configs`·`external-interaction`·
    `hooks`·`schedules`)는 트랜잭션 경로를 호출하지 않아 지금은 안전하다" 고 명시한다.
    그런데 바로 이 changeset 의 최신 커밋(`2a87eb2f0`)이 `schedules.service.ts` 의 cascade
    삭제를 `this.triggerRepository.manager.transaction(...)` 을 타도록 바꿨고,
    `schedules.service.spec.ts` 도 실제로 `withTransactionMock` 으로 올바르게 갱신됐다
    (grep 으로 3회 사용 확인). 즉 실제 상태는 "3개 wrapped / 3개 unwrapped
    (`auth-configs`·`external-interaction`·`hooks`)"인데, 이 파일의 산문은 여전히
    "2개 wrapped / 4개 unwrapped(schedules 포함)" 라고 말한다 — `schedules` 를 "트랜잭션
    경로를 호출하지 않아 안전하다" 는 항목에 남겨 둔 채다. 같은 changeset 의 다른 커밋
    (`3641ead21`, "목록은 낡고 규칙은 안 낡는다")이 정확히 이 종류의 드리프트를 경계하는
    교훈을 CHANGELOG 에 남겼는데, 그 직후 커밋이 같은 클래스의 드리프트를 이 파일에
    새로 만들었다. 기능적으로는 무해하다(코드·테스트 배선 자체는 올바름) — 위험은
    다음 사람이 이 산문만 보고 "`schedules` 는 아직 트랜잭션 경로를 안 타니 안전하다"
    고 오판해 후속 변경에서 `withTransactionMock` 배선을 빼먹거나 건너뛰는 것이다.
  - 제안: 해당 문단을 "3개 wrapped(`triggers.service.spec.ts`·`triggers.web-chat.spec.ts`·
    `schedules.service.spec.ts`) / 3개 unwrapped(`auth-configs`·`external-interaction`·
    `hooks`)" 로 갱신. 이미 있는 "이 수는 시점 의존이다 — 이 파일을 고칠 땐 다시 재라"
    문구(같은 파일 하단, `53개 케이스` 문단)를 이 목록에도 동일하게 적용할 필요가 있다.

- **[INFO]** 삭제 경로 두 곳이 락 프리미티브를 중복 구현 없이 공유
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:23-26, 1027-1028`
    (`remove()`), `codebase/backend/src/modules/schedules/schedules.service.ts`
    (cascade 삭제, 신규 import)
  - 상세: `TriggersService.remove()` 와 `SchedulesService` 의 cascade 삭제 둘 다
    `acquireTriggerConfigLock` 함수와 `TRIGGER_DELETE_LOCK_TIMEOUT_MS` 상수를 그대로
    재사용한다(각자 SQL 을 다시 적지 않음) — 긍정적인 내부 의존 관리 사례로 기록해 둔다.
  - 제안: 없음.

## 요약

이번 라운드까지 포함해 이 changeset 전체는 새 외부 패키지·버전 변경·라이선스 이슈·알려진
취약점·번들/빌드 시간 영향이 없다(`package.json`/lockfile diff 0건, 모든 신규 import 는
이미 고정 버전으로 선언된 기존 의존성). 최신 커밋이 추가한 유일한 신규 내부 의존 관계는
`schedules.service.ts` → `triggers/trigger-config-lock.ts` 단방향 import 로, 순환 없이
안전하게 배선됐다. 다만 그 커밋이 `schedules.service.spec.ts` 의 mock 배선은 올바르게
갱신하면서도 이 유틸리티의 "누가 이 경로를 아직 안 타는가"를 서술하는 JSDoc 목록은
갱신하지 않아, 같은 PR 안에서 "목록은 낡는다"는 자기 교훈을 한 번 더 재현했다 — 기능적
결함은 아니지만 다음 유지보수자를 오도할 수 있어 WARNING 으로 기록한다. 그 외에는 조치가
필요한 항목이 없다.

## 위험도

LOW
