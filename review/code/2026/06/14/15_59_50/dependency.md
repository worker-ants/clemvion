# 의존성(Dependency) 리뷰 결과

## 발견사항

- **[INFO]** 신규 외부 패키지 없음 — `package.json` 무변경
  - 위치: `codebase/backend/package.json` (diff 없음)
  - 상세: 이번 변경(파일 1~5)은 `@nestjs/bullmq`, `bullmq`, `typeorm`, `jsonwebtoken` 등 이미 프로젝트에 존재하는 의존성만 사용한다. `package.json`·`package-lock.json` 에 신규 항목이 추가되지 않았다.
  - 제안: 없음.

- **[INFO]** `@nestjs/bullmq` / `bullmq` — 기존 의존성 추가 활용 (새 큐 등록)
  - 위치: `external-interaction.module.ts` (파일 1), `terminal-revoke-reconciler.service.ts` (파일 5)
  - 상세: `BullModule.registerQueue({ name: TERMINAL_REVOKE_RECONCILE_QUEUE })` 신규 큐 1건 추가. `WorkerHost`, `Processor`, `InjectQueue`, `Queue`, `Job` 등 기존 패키지의 API를 추가로 사용한다. 기존 `NOTIFICATION_WEBHOOK_QUEUE` 와 동일 패턴이므로 버전 충돌·호환성 문제 없다.
  - 제안: 없음.

- **[INFO]** `ExecutionStatus` 내부 모듈 의존성 추가
  - 위치: `interaction-token.service.ts` (파일 3) — `import { ExecutionStatus } from '../executions/entities/execution.entity'`
  - 상세: `external-interaction` 모듈이 `executions` 모듈의 엔티티 enum(`ExecutionStatus`)에 직접 import 의존성을 맺었다. 기존 코드도 `Execution` 엔티티·`ExecutionsModule`·`ExecutionEngineModule`을 이미 사용하므로 이 모듈 간 의존 관계는 이미 확립된 방향과 일치한다. 역방향(executions → external-interaction) 순환 의존성은 없다.
  - 제안: 없음.

- **[INFO]** 테스트 파일 의존성 — `@nestjs/testing`, `@nestjs/bullmq` `getQueueToken` 정상 사용
  - 위치: `terminal-revoke-reconciler.service.spec.ts` (파일 4), `interaction-token.service.spec.ts` (파일 2)
  - 상세: 테스트에서 `getQueueToken(TERMINAL_REVOKE_RECONCILE_QUEUE)` 로 BullMQ 큐 DI 토큰을 mock 하는 패턴은 NestJS BullMQ 표준 테스트 패턴으로 별도 패키지 추가 불필요하다.
  - 제안: 없음.

## 요약

이번 변경은 신규 외부 패키지를 전혀 추가하지 않는다. `@nestjs/bullmq`·`bullmq`·`typeorm`·`jsonwebtoken` 등 기존에 이미 프로젝트에 포함된 의존성만을 활용해 `TerminalRevokeReconcilerService`(새 BullMQ 큐 + `WorkerHost`)와 `InteractionTokenService.reconcileTerminalRevocations()`를 구현했다. 내부 모듈 의존성(`ExecutionStatus` enum import) 방향도 기존 `external-interaction → executions` 의존 방향과 일치해 순환 의존성 위험이 없다. 라이선스·취약점·번들 크기·버전 충돌 관점에서 검토할 신규 항목이 없다.

## 위험도

NONE
