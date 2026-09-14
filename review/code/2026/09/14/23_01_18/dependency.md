# 의존성(Dependency) 리뷰 — trigger-config-lost-update

## 검토 범위

`git diff origin/main...HEAD --stat`(전체) 와 `-- '*.json' '**/package.json' 'pnpm-lock.yaml'`(매니페스트 한정)
을 각각 실행해 대조했다. 매니페스트/락파일 diff 는 **0건**이며, 변경된 18개 파일은 전부
`review/**`(이전 라운드 산출물, 커밋된 아티팩트) 뿐이었다. 실제 코드 변경 대상인 파일
1~19(`CHANGELOG.md`, `hooks.service.ts`(+spec), `schedules.service.ts`(+spec),
`triggers/` 하위 8개 파일, `repo-guards/` 3개 파일, e2e 스펙, plan 파일)를 직접 열어
import 문·`package.json` 선언 버전을 대조했다.

## 발견사항

- **[INFO]** 새 외부 패키지 추가 없음 — 전량 기존 의존성 재사용
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:1-4`,
    `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:1-16`,
    `codebase/backend/src/modules/triggers/triggers.service.ts` import 블록,
    `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts:1-4`
  - 상세: 신규/수정 파일이 추가로 import 하는 외부 심볼은 `typeorm`(`EntityManager`,
    `QueryDeepPartialEntity`, `Repository`, `In`), `@nestjs/common`, `@nestjs/config`,
    `@nestjs/typeorm`, `node:crypto`, 그리고 e2e 전용 `pg`(`Client`)·`@jest/globals`·
    `supertest` 뿐이다. `codebase/backend/package.json` 대조 결과 전부 이미 고정 범위로
    선언돼 있다: `typeorm: ^0.3.31`, `pg: ^8.20.0`, `@jest/globals: ^30.0.0`,
    `supertest: ^7.0.0`, `@nestjs/common: ^11.0.1`, `@nestjs/config: ^4.0.3`,
    `@nestjs/typeorm: ^11.0.3`. `git diff origin/main...HEAD --stat -- '*.json'
    '**/package.json' 'pnpm-lock.yaml'` 결과 매니페스트/락파일 변경은 `review/**` 산출물
    (`meta.json`, `_retry_state.json`)뿐이고 애플리케이션 의존성 선언은 손대지 않았다.
  - 제안: 없음.

- **[INFO]** TypeORM 비공개 서브패스 import — 신규 위험 아님(선례 재사용, 이미 이전
  라운드에서 dispositioned)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:2`
    (`import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity'`)
  - 상세: 이 경로는 `typeorm` 의 공개 최상위 export(`.`)가 아니라 `exports` 맵의 와일드카드
    (`"./*"`)로 열린 내부 서브패스다(`node_modules/typeorm/package.json` 확인). `type`
    전용 import 라 런타임 영향은 없고, `typeorm`(`^0.3.31`, caret)이 이 파일을 옮기거나
    지우면 **컴파일 타임에 즉시** 실패해 조용히 깨지지 않는다. 같은 패턴이 이미
    `workflows.service.ts` 에도 존재하는 선례이고, 이 지적 자체가 `review/code/2026/09/14/
    18_17_44/dependency.md`·`19_44_08/dependency.md`·`21_50_09/dependency.md` 세 라운드에서
    반복 확인되며 INFO/조치 불요로 이미 처분됐다 — 이번 라운드에서 새로 넓어진 표면은 아니다.
  - 제안: 이번 PR 범위에서 조치 불요. `typeorm` 메이저 업그레이드 시 이 서브패스 사용처
    (`workflows.service.ts`, `trigger-config-lock.ts`)를 함께 검증 대상으로 추적.

- **[INFO]** 내부 의존성 — 신규 유틸 모듈의 소비 그래프는 단방향, 실측대로 정확
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts`(신규) ←
    `triggers.service.ts`(`acquireTriggerConfigLock`, `rewriteTriggerConfigLocked`,
    `TRIGGER_DELETE_LOCK_TIMEOUT_MS`), `chat-channel-binder.service.ts`
    (`rewriteTriggerConfigLocked`). `chat-channel-input-rules.ts` 의 신규 export
    `extractInboundSigningRef` ← `triggers.service.ts:585,635`, `chat-channel-binder.
    service.ts:211`.
  - 상세: 두 신규/확장 유틸 모두 leaf 모듈(다른 트리거 서비스로 역참조하지 않음)이라
    순환 의존이 없다. `withTransactionMock`(신규 테스트 헬퍼,
    `__test-utils__/trigger-transaction-mock.ts`) 의 JSDoc 은 "`getRepositoryToken(Trigger)`
    provider 를 갖는 6개 spec 파일 중 실제로 감싼 것은 2개뿐" 이라고 적어 뒀는데, 저장소를
    grep 해 실측한 결과와 정확히 일치한다(`triggers.service.spec.ts`,
    `triggers.web-chat.spec.ts` 만 `withTransactionMock` 호출, 나머지 `auth-configs`·
    `external-interaction`·`hooks`·`schedules` 4개 spec 은 호출 안 함). 이번 diff 에서
    `hooks.service.ts`(`touchLastTriggeredAt`)·`schedules.service.ts`(update 경로)가 쓰는
    쓰기는 `manager.transaction` 을 타지 않는 단순 `repository.update()` 라서 이 4개 파일이
    그 경로를 아직 호출하지 않는다는 전제와 모순되지 않는다 — 문서화된 갭이 이번 변경으로
    조용히 어긋나지는 않았다.
  - 제안: 없음. (이 4개 파일이 향후 `manager.transaction` 경로를 타는 코드를 추가하면
    `withTransactionMock` 로 갈아 끼워야 한다는 점은 JSDoc 에 이미 남아 있다.)

- **[INFO]** 버전 고정 방식은 프로젝트 기존 관례(caret) 그대로 — 이번 변경이 새로 도입한
  패턴 아님
  - 위치: `codebase/backend/package.json`
  - 상세: 위에서 대조한 모든 관련 의존성이 `^`(caret) 범위로 선언돼 있으나, 이는 이 PR
    이전부터 저장소 전역에 적용된 관례이고 이번 diff 가 어떤 의존성 선언도 추가·변경하지
    않았으므로 이 PR 범위의 새 리스크로 볼 수 없다.
  - 제안: 없음.

## 요약

이번 변경(트리거 `config` lost-update 방지를 위한 advisory lock 직렬화 + 컬럼 한정 update
전환 + repo-guard 확장 + 회귀 테스트)은 순수 내부 리팩터링이다. `git diff origin/main...HEAD`
전수 대조 결과 `package.json`/`pnpm-lock.yaml` 변경은 0건이고, 새로 추가된 모든 import 는
이미 프로젝트에 고정 버전으로 선언된 기존 의존성(`typeorm`, `@nestjs/common`,
`@nestjs/config`, `@nestjs/typeorm`, `pg`, `node:crypto`, `@jest/globals`, `supertest`)을
기존에 이미 쓰이던 API 형태(`manager.transaction`, `typeorm` 서브패스 타입 import)로
재사용한다. 새 외부 의존성·라이선스·알려진 취약점·번들 크기·빌드 시간·기존 의존성과의 버전
충돌 어느 축에서도 이번 PR 이 새로 만든 리스크는 없다. 내부 모듈 의존 그래프도 신규 유틸
2종(`trigger-config-lock.ts`, `chat-channel-input-rules.ts::extractInboundSigningRef`)이
단방향 leaf 로 소비되어 순환 참조가 없으며, 문서화된 미이관 테스트 헬퍼 갭(4개 spec 파일)도
이번 diff 의 실제 코드 경로와 모순되지 않는다.

## 위험도

NONE
