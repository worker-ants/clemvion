import { Injectable } from '@nestjs/common';
import { ExploreToolsService } from './explore-tools.service';
import { ShadowWorkflow } from './shadow-workflow';
import { toWorkflowView } from './workflow-view';
import { TOOL_KIND_BY_NAME, AssistantToolKind } from './tool-definitions';
import { asString } from './coerce';

// 같은 타입의 `get_node_schema` 가 한 턴에 `hits` 가 이 값 이상이 되면 LLM
// 이 진전 없이 낭비 루프에 빠진 것으로 간주해 hard-stop 응답으로 바꾼다.
// 카운트 규칙 (`cached.hits`): 첫 호출 직후 1, 두 번째 호출 2, 세 번째 3...
// 3 이면 첫 호출 + cache hit 1회 (hits=2) 까지 warning, **세 번째 호출**
// (hits===3) 부터 `ok:false, error: 'REDUNDANT_SCHEMA_LOOKUP'` 로 차단.
const SCHEMA_LOOKUP_HARD_STOP = 3;

/**
 * Turn-scoped cache for `get_node_schema` results. LLM 이 같은 노드 타입의
 * 스키마를 여러 번 조회하는 낭비 패턴을 잡기 위해 첫 호출 결과를 캐시한다.
 * 캐시 자체는 한 턴 동안만 유효하므로 `streamMessage` 가 소유하고 dispatch
 * 시점에 참조로 넘겨준다 (router 는 무상태 singleton).
 */
export interface SchemaCacheEntry {
  result: unknown;
  hits: number;
}

/** {@link AssistantToolRouter.dispatchExplore} 가 explore 도구 실행에 필요로
 *  하는 turn-scoped 컨텍스트. */
export interface ExploreDispatchContext {
  shadow: ShadowWorkflow;
  workspaceId: string;
  currentWorkflowId: string;
  schemaCache: Map<string, SchemaCacheEntry>;
}

/** explore 도구 실행 결과. */
export interface ExploreDispatchResult {
  result: unknown;
  /**
   * `verify_workflow` 가 ok:true 로 외부화 검증을 마친 경우에만 true —
   * 호출부가 `guardState.reviewCompleted` 를 set 해 다음 finish 가 verify
   * 가드로 다시 막히지 않게 한다. 그 외 explore 도구는 항상 false.
   */
  reviewCompleted: boolean;
}

/**
 * Workflow AI Assistant 의 도구 라우팅 책임을 `streamMessage` 루프에서
 * 분리한 무상태 collaborator. 두 가지를 담당한다:
 *
 *  1. **kind 분류** ({@link classifyKind}) — 도구명 → `explore`/`plan`/`edit`/
 *     `finish` 메타. 단일 SoT 인 `TOOL_KIND_BY_NAME` 을 여기서만 소비한다.
 *  2. **explore(read-only) 도구 dispatch** ({@link dispatchExplore}) — DB·registry
 *     조회가 필요한 도구는 {@link ExploreToolsService} 로 위임, shadow 접근이
 *     필요한 `get_current_workflow`/`verify_workflow` 만 선처리, `get_node_schema`
 *     의 turn-scoped 캐시/하드스톱을 관리한다. 신규 explore 도구 = 아래
 *     `handleExploreCall` switch 에 한 줄(OCP).
 *
 * plan/edit/finish dispatch 와 §10 finish/review 가드는 SSE 조립·shadow
 * 변경·turn-scoped 가드 상태와 얽혀 있어 현재는 `streamMessage` 에 잔류한다
 * (M-3 후속 단계에서 가드 객체·persistence 로 분리 예정).
 */
@Injectable()
export class AssistantToolRouter {
  constructor(private readonly exploreTools: ExploreToolsService) {}

  /**
   * 도구명을 `explore`/`plan`/`edit`/`finish` kind 로 분류한다. 미등록 도구는
   * 보수적으로 `edit` 으로 간주 (shadow.apply 가 UNKNOWN_TOOL 로 거른다).
   */
  classifyKind(toolName: string): AssistantToolKind {
    return TOOL_KIND_BY_NAME[toolName] ?? 'edit';
  }

  /**
   * explore(read-only) 도구 하나를 실행하고 tool_result 와 `reviewCompleted`
   * 신호를 돌려준다. 호출부(`streamMessage`)는 `kind === 'explore'` 일 때만
   * 진입하며, 공통 후처리(pendingToolCalls push, tool_call SSE emit)는 그대로
   * 루프에 남는다.
   */
  async dispatchExplore(
    toolName: string,
    args: Record<string, unknown>,
    ctx: ExploreDispatchContext,
  ): Promise<ExploreDispatchResult> {
    // `get_current_workflow` 는 세션 외부 DB를 조회하지 않고 현재
    // turn 의 shadow 스냅샷을 그대로 돌려준다. 같은 turn 안에서
    // edit 도구를 먼저 호출한 뒤 최신 상태를 확인하기 위한 용도.
    if (toolName === 'get_current_workflow') {
      return {
        result: this.buildCurrentWorkflowResult(ctx.shadow),
        reviewCompleted: false,
      };
    }
    if (toolName === 'verify_workflow') {
      // Phase 3: LLM 의 self-review 외부화. snapshot 의 모든 node/edge
      // id 가 verifiedNodeIds / verifiedEdgeIds 에 포함되어야 ok:true.
      // 성공 호출은 review/verify 가드를 충족해 다음 finish 가 verify
      // 라운드로 다시 막히지 않는다 — Phase 2 의 "finish 두 번" 경로와
      // 동등한 효과지만, LLM 이 "무엇을 봤는지" 를 명시화하는 더 엄격한
      // 검증.
      const verifyResult = this.buildVerifyWorkflowResult(ctx.shadow, args);
      return {
        result: verifyResult,
        reviewCompleted:
          (verifyResult as { ok?: boolean } | undefined)?.ok === true,
      };
    }
    if (toolName === 'get_node_schema') {
      // 같은 타입을 반복해서 조회하는 낭비 루프 방지. 첫 호출은 실제
      // 실행 (hits=1), 두 번째 호출(hits=2) 은 cached 결과 + warning,
      // 세 번째 호출(hits=3 ≥ SCHEMA_LOOKUP_HARD_STOP) 부터 error 로
      // escalate.
      const typeArg = typeof args.type === 'string' ? args.type : '';
      const cached = typeArg ? ctx.schemaCache.get(typeArg) : undefined;
      if (cached) {
        cached.hits += 1;
        if (cached.hits >= SCHEMA_LOOKUP_HARD_STOP) {
          return {
            result: {
              ok: false,
              error: 'REDUNDANT_SCHEMA_LOOKUP',
              message: `You have already fetched the schema for "${typeArg}" ${cached.hits} times this turn. Re-use the earlier result; do not call get_node_schema for this type again.`,
            },
            reviewCompleted: false,
          };
        }
        return {
          result: {
            ...(cached.result as Record<string, unknown>),
            warning: 'REDUNDANT_SCHEMA_LOOKUP',
            warningMessage: `get_node_schema for "${typeArg}" already returned in this turn — reuse that result instead of re-calling.`,
            cached: true,
          },
          reviewCompleted: false,
        };
      }
      const result = await this.handleExploreCall(
        toolName,
        args,
        ctx.workspaceId,
        ctx.currentWorkflowId,
      );
      if (typeArg) {
        ctx.schemaCache.set(typeArg, { result, hits: 1 });
      }
      return { result, reviewCompleted: false };
    }
    const result = await this.handleExploreCall(
      toolName,
      args,
      ctx.workspaceId,
      ctx.currentWorkflowId,
    );
    return { result, reviewCompleted: false };
  }

  // DB·registry 조회가 필요한 explore 도구를 `ExploreToolsService` 로
  // 위임한다. `get_current_workflow` 는 호출 루프에서 shadow 에 직접 접근해
  // 선처리되므로 여기로 오면 안 된다 (도달 시 프로그래밍 오류).
  private async handleExploreCall(
    name: string,
    args: Record<string, unknown>,
    workspaceId: string,
    currentWorkflowId: string,
  ): Promise<unknown> {
    switch (name) {
      case 'get_node_schema':
        return this.exploreTools.getNodeSchema(asString(args.type, ''));
      case 'list_integrations':
        return this.exploreTools.listIntegrations(
          workspaceId,
          typeof args.category === 'string' ? args.category : undefined,
        );
      case 'list_workflows':
        return this.exploreTools.listWorkflows(workspaceId, {
          search: typeof args.search === 'string' ? args.search : undefined,
          limit: typeof args.limit === 'number' ? args.limit : undefined,
          excludeId: currentWorkflowId,
        });
      case 'get_workflow':
        return this.exploreTools.getWorkflow(
          workspaceId,
          asString(args.id, ''),
          args.mode === 'full' ? 'full' : 'summary',
        );
      case 'list_knowledge_bases':
        return this.exploreTools.listKnowledgeBases(workspaceId);
      case 'get_workflow_executions':
        return this.exploreTools.getWorkflowExecutions(
          workspaceId,
          currentWorkflowId,
          {
            limit: typeof args.limit === 'number' ? args.limit : undefined,
            status: typeof args.status === 'string' ? args.status : undefined,
          },
        );
      case 'get_execution_details':
        return this.exploreTools.getExecutionDetails(
          workspaceId,
          currentWorkflowId,
          asString(args.id, ''),
        );
      case 'get_current_workflow':
        // Safety net: should have been handled by caller with shadow access.
        return {
          ok: false,
          error: 'INTERNAL',
          message:
            'get_current_workflow must be handled by the stream loop with shadow access.',
        };
      default:
        return { ok: false, error: 'UNKNOWN_EXPLORE_TOOL' };
    }
  }

  // 같은 턴 안에서 edit 도구로 수정된 최신 shadow 를 LLM 에 되돌려준다.
  // 시스템 프롬프트 스냅샷과 동일한 보안 정책(redactConfig) · 동일한 shape
  // (`toWorkflowView`) 을 공유해 두 표현이 발산하지 않도록 한다.
  private buildCurrentWorkflowResult(shadow: ShadowWorkflow): unknown {
    return { ok: true, ...toWorkflowView(shadow.snapshot()) };
  }

  /**
   * Phase 3: `verify_workflow` 도구의 결과 빌더. LLM 이 명시한 verifiedNodeIds /
   * verifiedEdgeIds 가 현재 shadow 의 모든 node / edge id 를 포함하는지 검사.
   *
   * - 누락 있으면 `ok:false, error: 'VERIFY_INCOMPLETE', missingNodeIds, missingEdgeIds`
   *   로 LLM 에게 정확히 무엇을 안 봤는지 알려준다 — LLM 은 그것들을 walk 한
   *   뒤 verify_workflow 를 다시 호출하면 된다. snapshot 자체를 응답에 포함하지
   *   않는 이유: WORKFLOW_VERIFY_REQUIRED 가 이미 토대로 currentWorkflow 를
   *   주었거나, LLM 이 `get_current_workflow` 로 따로 받을 수 있어 중복 노출 방지.
   * - 다 포함하면 `ok:true` + 검증된 카운트. 호출부에서 state.reviewCompleted
   *   를 set 해 다음 finish 가 verify 가드로 다시 막히지 않게 한다.
   */
  private buildVerifyWorkflowResult(
    shadow: ShadowWorkflow,
    args: Record<string, unknown>,
  ): unknown {
    const verifiedNodeIds = new Set(
      Array.isArray(args.verifiedNodeIds)
        ? args.verifiedNodeIds.filter((v): v is string => typeof v === 'string')
        : [],
    );
    const verifiedEdgeIds = new Set(
      Array.isArray(args.verifiedEdgeIds)
        ? args.verifiedEdgeIds.filter((v): v is string => typeof v === 'string')
        : [],
    );
    const snapshot = shadow.snapshot();
    const missingNodeIds = snapshot.nodes
      .filter((n) => !verifiedNodeIds.has(n.id))
      .map((n) => n.id);
    const missingEdgeIds = snapshot.edges
      .filter((e) => !verifiedEdgeIds.has(e.id))
      .map((e) => e.id);
    if (missingNodeIds.length > 0 || missingEdgeIds.length > 0) {
      return {
        ok: false,
        error: 'VERIFY_INCOMPLETE',
        missingNodeIds,
        missingEdgeIds,
        message:
          'Your verifiedNodeIds / verifiedEdgeIds did not include every node/edge currently on the canvas. Walk the listed missing items, confirm each was intended, and call verify_workflow again with the COMPLETE arrays — or call finish if you decide they should be left as-is (the verify gate will only block once per turn).',
      };
    }
    return {
      ok: true,
      verifiedNodeCount: snapshot.nodes.length,
      verifiedEdgeCount: snapshot.edges.length,
    };
  }
}
