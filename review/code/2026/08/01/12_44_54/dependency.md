# 의존성(Dependency) 리뷰 — audit-logging (model-config/schedules/triggers/workflows CRUD 감사 기록)

## 검증 방법

프롬프트에 실린 20개 파일 전체(및 프롬프트 크기 제한으로 생략된 `triggers.service.ts` /
`triggers.service.spec.ts` / `workflows.service.ts` / `workflows.service.spec.ts` 는 `Read`/`grep` 으로
직접 열람) 의 `import` 문을 전수 확인했고, `git diff origin/main...HEAD -- codebase/` 로 실제 변경분(20
파일, +1470/-325)과 `package.json`/`pnpm-lock.yaml` 변경 유무를 대조했다.

## 발견사항

- **[INFO]** 새 외부 의존성 없음 — 전부 기존 패키지(`@nestjs/*`, `typeorm`) 또는 내부(리포지토리 내)
  모듈 import
  - 위치: 파일 1~20 전체 (`codebase/backend/src/modules/{audit-logs,model-config,schedules,triggers,workflows}/**`)
  - 상세: 이번 diff 는 4개 도메인 서비스(`ModelConfigService`, `SchedulesService`, `TriggersService`,
    `WorkflowsService`)에 감사 로깅을 추가하는 변경이다. 각 서비스 파일에 새로 추가된 import 는
    `import { AUDIT_ACTIONS } from '../audit-logs/audit-action.const'` 와
    `import { AuditLogsService } from '../audit-logs/audit-logs.service'` 두 줄뿐이며, 둘 다 같은
    리포지토리 내 기존 `audit-logs` 모듈을 가리키는 **내부** import 다 (예:
    `codebase/backend/src/modules/model-config/model-config.service.ts:1-2`,
    `codebase/backend/src/modules/schedules/schedules.service.ts:1-2`,
    `codebase/backend/src/modules/triggers/triggers.service.ts:1-2`,
    `codebase/backend/src/modules/workflows/workflows.service.ts:1-2`). `git diff --stat
    origin/main...HEAD -- codebase/backend/package.json codebase/backend/pnpm-lock.yaml` 결과도 빈
    diff — package manifest/lockfile 변경이 전혀 없음을 확인했다. `schedules.service.ts` 가 쓰는
    `cron-parser`(`import { CronExpressionParser } from 'cron-parser'`, package.json 상
    `"cron-parser": "^5.5.0"`)는 이번 diff 이전부터 존재하던 기존 의존성이라 신규가 아니다.
  - 제안: 없음 (버전 고정/라이선스/취약점/번들 크기/호환성 점검 관점 모두 해당 사항 없음 — N/A).

- **[INFO]** 내부 모듈 의존 그래프 — `AuditLogsModule` 을 4개 모듈에 단방향으로 신규 import, 순환 없음
  - 위치: `codebase/backend/src/modules/model-config/model-config.module.ts:3,12`,
    `codebase/backend/src/modules/schedules/schedules.module.ts:1,24`,
    `codebase/backend/src/modules/triggers/triggers.module.ts:1,27`,
    `codebase/backend/src/modules/workflows/workflows.module.ts:1,23`
  - 상세: 네 모듈 모두 `AuditLogsModule` 을 `imports` 배열에 추가했다.
    `codebase/backend/src/modules/audit-logs/audit-logs.module.ts` 를 직접 열어 확인한 결과
    `AuditLogsModule` 자신은 `TypeOrmModule.forFeature([AuditLog])` 만 import 하는 **leaf 모듈**이고
    비즈니스 모듈(model-config/schedules/triggers/workflows) 로 역참조하는 import 가 전혀 없다. 즉
    신규 엣지는 전부 `{model-config,schedules,triggers,workflows} → audit-logs` 단방향이며, 이미
    존재하던 `forwardRef(() => ExecutionEngineModule)`(workflows.module.ts) 같은 순환 해소 패턴과
    충돌하거나 새 순환을 만들 여지가 없다. `forwardRef` 로 감싸지 않고 plain import 로 추가한 것도
    이 판단과 일치한다(순환이면 부팅 시 undefined 평가 문제가 생겨 `forwardRef` 가 필요했을 것).
  - 제안: 없음 — 설계상 문제 없음. 참고로 남김.

## 요약

이번 diff(20개 파일, `codebase/backend/src/modules/{audit-logs,model-config,schedules,triggers,workflows}/**`)
는 4개 도메인(ModelConfig/Schedule/Trigger/Workflow) CRUD 에 감사 로깅을 배선하는 변경으로, 의존성 관점에서
새 외부 패키지 도입·버전 변경·`package.json`/lockfile 수정이 전혀 없다(전수 diff 대조로 확인). 유일한 새
import 표면은 리포지토리 내부의 기존 `audit-logs` 모듈(`AUDIT_ACTIONS` 상수, `AuditLogsService`)을 4개
모듈에 단방향으로 연결한 것뿐이며, `AuditLogsModule` 자체가 leaf 모듈이라 순환 의존 위험도 없다. 버전
고정·라이선스·취약점·불필요 의존성·번들 크기·빌드 시간·호환성 항목은 모두 해당 사항 없음(N/A).

## 위험도

NONE
