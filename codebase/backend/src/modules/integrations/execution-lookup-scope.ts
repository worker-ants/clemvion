import { HttpException } from '@nestjs/common';
import type { Integration } from './entities/integration.entity';
import type {
  IntegrationUse,
  PersonalIntegrationUseRejection,
} from './personal-integration-use';
import type { ExecutionUseFacts } from './personal-integration-use-facts';

/*
 * 실행 시점 통합 조회를 한 노드 실행 · 한 AI 에이전트 턴 안에서 묶는다(NERV Task `CLE-T-92RQWB`).
 *
 * AI 에이전트는 도구 목록을 만들 때 도구 프로바이더 셋(Cafe24 · MakeShop 내부 브리지, 범용 MCP)이 같은 서버 항목을 각자 조회한다.
 * 프로바이더는 조회한 통합의 서비스 유형을 보고 나서야 자기 서버인지 안다. 범위 없이 조회하면 개인 통합 하나가 턴마다 통합 행 ·
 * 판정 사실을 세 번씩 읽고 거절 로그도 세 번 남긴다.
 *
 * 부르는 쪽(도구 목록을 만드는 쪽)이 범위를 하나 만들어 조회마다 넘기고 끝나면 버린다. 범위를 다음 턴이나 다음 노드 실행으로 넘기지
 * 않는다. 그래서 통합 · 멤버십 변경은 다음 턴 · 다음 노드 실행에 바로 반영된다. 판정 규칙과 거절 응답은 범위가 있든 없든 같다.
 *
 * - 조회 결과: 워크스페이스 · 통합 · `use`(노드와 표현식 여부)가 같은 조회는 결과(통합 또는 예외)를 한 번만 만든다.
 * - 판정 사실: 워크스페이스 · 노드 · 통합 소유자가 같으면 한 번만 읽는다. 같은 소유자의 개인 통합이 여럿이어도 한 번이다.
 * - 거절 로그: 같은 워크스페이스 · 노드 · 통합 · 이유는 한 번만 남긴다. `use` 가 달라 조회 결과를 같이 쓰지 못해도 그렇다.
 *
 * 일시 오류(DB 연결 끊김 등 HTTP 예외가 아닌 것)로 실패한 조회는 기억하지 않는다. 범위가 없을 때처럼 다음 조회가 다시 시도한다.
 * 없는 통합 · 판정 거절 · 자격 증명 읽기 실패는 HTTP 예외이고 범위 안에서 바뀌지 않으므로 기억한다.
 */

/** 실행 시점 조회의 선택 인자. 범위가 없으면 조회마다 새로 읽는다. */
export interface ExecutionLookupOptions {
  /** 이번 노드 실행 · 턴의 조회가 같이 쓰는 범위. */
  scope?: ExecutionLookupScope;
  /**
   * 기억한 조회 결과를 쓰지 않고 통합 행을 다시 읽는다. 토큰 갱신 뒤 재조회가 쓴다. 판정 사실과 거절 로그는 범위의 기억을 그대로
   * 쓰고, 다시 읽은 결과가 이후 같은 조회의 결과가 된다. 범위가 없으면 뜻이 없다(늘 새로 읽는다).
   */
  reread?: boolean;
}

export class ExecutionLookupScope {
  private readonly lookups = new Map<string, Promise<Integration>>();
  private readonly facts = new Map<string, Promise<ExecutionUseFacts>>();
  private readonly loggedRejections = new Set<string>();

  /** 조회 결과를 기억한다. `IntegrationsService` 의 실행 시점 조회만 부른다. */
  lookup(
    args: { workspaceId: string; integrationId: string; use: IntegrationUse },
    load: () => Promise<Integration>,
    reread: boolean,
  ): Promise<Integration> {
    const key = JSON.stringify([
      args.workspaceId,
      args.integrationId,
      args.use.nodeId,
      args.use.fromExpression,
    ]);
    const hit = reread ? undefined : this.lookups.get(key);
    return hit ?? remember(this.lookups, key, load());
  }

  /** 판정 사실을 기억한다. 키는 사실 조회의 입력 그대로다. */
  useFacts(
    args: {
      workspaceId: string;
      nodeId: string | null;
      integrationOwnerId: string;
    },
    load: () => Promise<ExecutionUseFacts>,
  ): Promise<ExecutionUseFacts> {
    const key = JSON.stringify([
      args.workspaceId,
      args.nodeId,
      args.integrationOwnerId,
    ]);
    return this.facts.get(key) ?? remember(this.facts, key, load());
  }

  /** 이 범위에서 처음 보는 거절이면 `true` 를 돌려주고 기억한다. 부르는 쪽은 `true` 일 때만 거절 로그를 남긴다. */
  claimRejectionLog(entry: {
    workspaceId: string;
    nodeId: string | null;
    integrationId: string;
    reason: PersonalIntegrationUseRejection;
  }): boolean {
    const key = JSON.stringify([
      entry.workspaceId,
      entry.nodeId,
      entry.integrationId,
      entry.reason,
    ]);
    if (this.loggedRejections.has(key)) return false;
    this.loggedRejections.add(key);
    return true;
  }
}

/** 진행 중인 조회를 기억한다. HTTP 예외가 아닌 실패는 잊어서 다음 조회가 다시 시도하게 한다. */
function remember<T>(
  map: Map<string, Promise<T>>,
  key: string,
  pending: Promise<T>,
): Promise<T> {
  map.set(key, pending);
  pending.catch((err: unknown) => {
    if (!(err instanceof HttpException) && map.get(key) === pending) {
      map.delete(key);
    }
  });
  return pending;
}
