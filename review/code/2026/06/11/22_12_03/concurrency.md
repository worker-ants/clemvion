# 동시성(Concurrency) 리뷰 결과

## 발견사항

변경된 파일 3개(`audit-action.const.ts`, `auth-configs.controller.ts`, `auth-configs.service.spec.ts`) 및 관련 서비스 파일(`auth-configs.service.ts`)을 동시성 관점에서 분석했다.

### 발견된 동시성 이슈

- **[INFO]** `update()` 의 Read-Modify-Write 비원자성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L159-161
  - 상세: `findById()` → `Object.assign(config, data)` → `save()` 패턴은 두 동시 요청이 동일 레코드를 수정할 때 마지막 write 가 앞선 write 를 덮어쓰는 last-write-wins 경쟁 조건이 존재한다. NestJS + TypeORM 단일 Node.js 이벤트 루프 특성상 실제 CPU-레벨 race 는 없으나, 두 요청의 await 가 교차(interleave)되면 논리적 race 가 발생한다 (Request A read → Request B read → A write → B write: A 의 변경이 유실).
  - 제안: 변경 대상 필드만 직접 UPDATE 하는 `update({ id }, { ...data })` TypeORM partial update 를 사용하거나, 낙관적 락(optimistic locking, `@VersionColumn`)을 적용한다. 단, 본 변경 diff 자체가 이 패턴을 도입한 것이 아니라 기존 코드이므로 이번 PR 의 신규 위험은 아니다.

- **[INFO]** `regenerate()` 의 Read-Modify-Write 비원자성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L180-193
  - 상세: `findById()` → configData 수정 → `save()` 패턴에서 동시 regenerate 두 요청이 interleave 되면 두 번 새 키가 생성되지만 하나만 DB에 반영된다. 키 교체 목적상 마지막 write 가 이긴다는 점에서 실용적 피해는 제한적이나 구조적으로는 비원자적이다. 기존 코드 패턴이며 이번 diff 의 신규 도입이 아니다.

- **[INFO]** `verifyWebhookRequest()` 의 fire-and-forget `lastUsedAt` 갱신
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-coverage-naming/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L309-311
  - 상세: `void this.authConfigRepository.update(...).catch(() => undefined)` 는 의도된 fire-and-forget으로 주석에도 명시되어 있다. 에러는 silently swallow 되며 동시성 측면에서 여러 요청이 동시에 `lastUsedAt` 을 갱신해도 last-write-wins 로 동작하며 이는 허용 가능한 동작이다. 이번 diff 와 무관한 기존 코드.

### 이번 diff 의 동시성 관련 신규 변경 평가

1. **`audit-action.const.ts`**: 상수 객체에 4개 키 추가 (`AUTH_CONFIG_CREATE/UPDATE/DELETE/REGENERATE`). `as const` 로 freeze 된 읽기 전용 객체이므로 동시성 위험 없음.

2. **`auth-configs.controller.ts`**: `@CurrentUser('sub')` 와 `@Req()` 파라미터 추가. NestJS DI + 요청 스코프 데코레이터이며 요청별 독립 인스턴스로 공유 상태 없음. 동시성 위험 없음.

3. **`auth-configs.service.spec.ts`**: 테스트 코드 변경. `beforeEach` 로 매 테스트마다 새 mock 인스턴스를 생성하며 테스트 간 상태 공유 없음. `audit.record.mockClear()` 패턴도 올바르게 사용. 동시성 위험 없음.

4. **`auth-configs.service.ts` (audit 추가)**: `create/update/regenerate/remove` 각각 DB 저장 성공 후 순차적 `await this.auditLogsService.record(...)`. 감사 기록이 best-effort(내부 swallow)임은 주석에 명시. await 누락 없음. 비동기 패턴 올바름.

## 요약

이번 변경(감사 로그 상수 추가 + 컨트롤러 userId/ip 파라미터 전파 + 서비스 audit 호출)은 동시성 관점에서 새로운 위험을 도입하지 않는다. 모든 async 호출에 await 가 적절히 붙어 있고, 요청별 독립 스코프 내에서만 데이터를 조작한다. 기존 `update/regenerate` 의 Read-Modify-Write 비원자성은 이번 PR 이전부터 존재하는 구조적 한계이며 INFO 수준으로 참고만 한다.

## 위험도

NONE
