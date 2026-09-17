import type { EntityManager } from 'typeorm';

import type { SecretResolverService } from '../secret-store/secret-resolver.service';

/**
 * 트리거 자원 정리의 **순서와 실패 정책** — 한 곳에만 둔다.
 *
 * 계약 SoT: `spec/2-navigation/2-trigger-list.md` §3(«쓰지 못했으면 락 밖에서 만든 것을
 * 되돌린다»)·§4.3(표 다음 문단), `spec/conventions/secret-store.md` §2.1.
 *
 * | 자원 | 시점 | 실패하면 |
 * |---|---|---|
 * | 외부(schedule job · provider 등록 · listener registry) | 행 삭제 **전**, 트랜잭션 **밖** | 호출자 몫 (`TriggerResourceReleaserService`) |
 * | `secret_store` 의 `secret://triggers/<id>/` | 행 삭제가 **커밋된 뒤** | **던지지 않고** error 로그 |
 *
 * 비밀이 마지막인 이유는 둘이다. provider teardown 이 이 비밀(bot token)을 읽고, 행 삭제
 * **전에** 지우면 그 사이 커밋된 쓰기가 남긴 비밀을 아무도 지우지 않는다. 행 삭제 **뒤에**
 * 끼어든 쓰기는 락 안 재기록에서 행 부재(`false`)를 보고 {@link undoAbsentTriggerWrite} 로 스스로
 * 되돌린다 — 두 규칙이 짝을 이뤄야 삭제와 겹친 쓰기가 비밀을 고아로 남기지 않는다.
 *
 * **같은 트랜잭션에서 지우지 않는다.** `SecretResolver` 는 PostgreSQL 에 결합하지 않도록
 * 정의돼 있다(`secret-store.md §3.4`) — 트리거 행 트랜잭션에 묶으면 그 전제가 깨진다. 대가는
 * 커밋과 정리 사이의 프로세스 종료가 비밀을 남기는 것이다(사후 정리 대상).
 */

/** `SecretResolverService.deleteByPrefix` 에 넘기는 접두. 트리거 id 는 UUID 라 LIKE 메타문자가 없다. */
export function triggerSecretPrefix(triggerId: string): string {
  return `secret://triggers/${triggerId}/`;
}

type SecretDeleter = Pick<SecretResolverService, 'deleteByPrefix'>;

/** `Logger` 에서 쓰는 것만 — 순수 함수가 Nest 인스턴스에 묶이지 않게 한다. */
interface ErrorLogger {
  error(message: string): unknown;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 행 삭제가 **커밋된 뒤** 트리거들의 비밀을 지운다. **던지지 않는다.**
 *
 * 삭제는 이미 커밋됐다 — 여기서 던져 500 을 주면 클라이언트의 재시도가 404 가 되고, 사용자에게
 * 보이는 상태(트리거 없음)는 이미 참이다. 그래서 실패는 **소리내어 남기고** 나머지 트리거를
 * 계속 정리한다.
 *
 * **감사 행을 남기지 않는다** — 이 시점엔 `workspace_id` 가 가리키는 워크스페이스가 이미 지워졌을
 * 수 있어 FK 위반이 된다.
 */
export async function deleteTriggerSecretsAfterCommit(
  secrets: SecretDeleter,
  logger: ErrorLogger,
  triggerIds: readonly string[],
  caller: string,
): Promise<void> {
  for (const triggerId of triggerIds) {
    try {
      await secrets.deleteByPrefix(triggerSecretPrefix(triggerId));
    } catch (err) {
      logger.error(
        `${caller}: trigger=${triggerId} 의 행은 지워졌는데 secret_store 정리가 실패했다 — ` +
          `암호화된 비밀이 고아로 남는다. 수동 정리가 필요하다: ${describeError(err)}`,
      );
    }
  }
}

/**
 * 락 안 재기록이 **행 부재**로 쓰지 못한 쓰기(`rewriteTriggerConfigLocked` 의 `false`)가 락 밖에서
 * 만든 것을 되돌린다. **던지지 않는다.**
 *
 * 순서는 teardown → 비밀이다 — teardown 이 방금 쓴 bot token 을 읽는다. 행이 없으므로 그 트리거의
 * 접두 전체를 지워도 안전하다(UUID 는 재사용되지 않는다).
 *
 * `false` 에서만 부른다. 예외(행은 있는데 쓰기가 실패)는 트리거가 살아 있으므로 대상이 아니다.
 */
export async function undoAbsentTriggerWrite(
  deps: {
    /** provider 등록 해제. 이 요청이 등록한 것이 없으면 생략한다. */
    teardown?: () => Promise<void>;
    secrets: SecretDeleter;
    logger: ErrorLogger;
  },
  triggerId: string,
  caller: string,
): Promise<void> {
  if (deps.teardown) {
    try {
      await deps.teardown();
    } catch (err) {
      deps.logger.error(
        `${caller}: trigger=${triggerId} 가 그 사이 삭제돼 provider 등록을 되돌리려 했으나 ` +
          `실패했다 — 콜백 등록이 남을 수 있다: ${describeError(err)}`,
      );
    }
  }
  await deleteTriggerSecretsAfterCommit(
    deps.secrets,
    deps.logger,
    [triggerId],
    caller,
  );
}

/** 트리거를 FK CASCADE 로 지우는 부모. */
export type TriggerParent = { workflowId: string } | { workspaceId: string };

/**
 * 워크플로·워크스페이스 삭제가 쓰는 정리 포트. 구현은 `TriggerResourceReleaserService`.
 *
 * **토큰으로 지연 해석한다.** `WorkflowsModule`·`WorkspacesModule` 이 `TriggersModule` 을 import
 * 하면 `TriggersModule → SchedulesModule → ExecutionEngineModule → WebsocketModule →
 * WorkflowsModule` 순환이 닫힌다. `#676` 이 `forwardRef` 순환을 일부러 없앤 선례라 새
 * `forwardRef` 로 때우지 않고, 호출자가 `ModuleRef.get(TOKEN, { strict: false })` 로 찾는다.
 * 이 파일은 타입과 심볼만 내보내 호출자가 구현 클래스를 **파일 수준에서도** import 하지 않게 한다.
 *
 * 저장소의 다른 지연 해석(`NotificationsService.getWebsocket` 등)은 못 찾으면 no-op 이지만 **여기는
 * 던진다** — 조용히 넘어가면 이 정리가 빠진 결함이 그대로 재발한다.
 */
export const TRIGGER_RESOURCE_RELEASER = Symbol('TRIGGER_RESOURCE_RELEASER');

export interface TriggerResourceReleasePort {
  /** 부모 밑 트리거들의 외부 자원을 해제한다 — 행 삭제 **전**, 트랜잭션 **밖**. */
  releaseExternalForParent(parent: TriggerParent): Promise<void>;
  /**
   * 부모 행을 `pessimistic_write` 로 잠근 **뒤** 그 부모의 트리거 id 를 연다. 행 삭제와 **같은
   * 트랜잭션**에서 부른다 — 잠금 뒤엔 그 부모를 참조하는 트리거 INSERT 가 FK 검사
   * (`FOR KEY SHARE`)에서 막혀 열거에서 빠지는 트리거가 없다.
   */
  lockParentAndListTriggerIds(
    manager: EntityManager,
    parent: TriggerParent,
  ): Promise<string[]>;
  /** {@link deleteTriggerSecretsAfterCommit} — 커밋 뒤에 부른다. 던지지 않는다. */
  releaseSecretsAfterCommit(
    triggerIds: readonly string[],
    caller: string,
  ): Promise<void>;
}
