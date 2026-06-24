import { Injectable } from '@nestjs/common';
import { WorkflowAssistantSessionService } from '../workflow-assistant-session.service';
import {
  AssistantPlanRecord,
  AssistantToolCallRecord,
  AutoResumeReason,
} from '../entities/workflow-assistant-message.entity';

/**
 * 한 assistant 턴에 실리는 토큰 사용량 스냅샷. SSE `usage` 이벤트
 * (`AssistantStreamEvent`) 와 동형이며, persist 시 entity `usage` 컬럼에
 * 그대로 기록된다.
 */
export interface UsageSnapshot {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  thinkingTokens?: number;
  model: string;
}

/**
 * Stall 자동 복구로 한 턴이 여러 row 로 쪼개질 때, 각 row 가 "복구 이후
 * 새로 시작된 row" 인지 표시하는 메타. entity 필드명과 1:1 대응한다.
 */
export interface ResumeMeta {
  autoResumed: boolean;
  autoResumeReason: AutoResumeReason | null;
  autoResumeAttempt: number | null;
}

/**
 * `persistAssistantTurn` 이 요구하는 resumeMeta literal object 를 한 곳에서
 * 생성한다. 기존에는 세 persist 경로(라운드 한도 초과 / 에러 / 최종 정상
 * 종료) 에서 같은 삼항 패턴을 복붙하던 것을 통합 (review W-11).
 *
 * `stallRounds === 0` → 정상 턴으로 간주해 autoResumed=false 의 기본값 메타.
 * `stallRounds > 0` → 이번 턴이 stall 복구로 한 번 이상 쪼개졌으므로 해당
 *   row 는 "복구 이후 새로 시작된 row" 로 표시.
 *
 * `streamMessage` 가 소유한 turn-scoped 카운터(`totalStallCount`)로부터 메타를
 * derive 해 `persistAssistantTurn` 에 넘기는 leaf 헬퍼. persist 본체와 한
 * 파일에 둬 두 곳에서 공유한다 (M-3 3단계 — 무상태 collaborator 분리).
 */
export function makeResumeMeta(stallRounds: number): ResumeMeta {
  if (stallRounds <= 0) {
    return {
      autoResumed: false,
      autoResumeReason: null,
      autoResumeAttempt: null,
    };
  }
  return {
    autoResumed: true,
    autoResumeReason: 'stall_pending_steps',
    autoResumeAttempt: stallRounds,
  };
}

/**
 * Workflow AI Assistant 한 턴의 **세션/메시지 영속** 책임을 `streamMessage`
 * 에서 분리한 무상태 collaborator (M-3 3단계). turn-scoped 상태(누적 텍스트·
 * toolCalls·plan·stall 카운터)는 여전히 `streamMessage` 가 소유·변이하고, 본
 * 서비스는 그 스냅샷을 받아 `WorkflowAssistantSessionService.appendMessage`
 * 로 DB row 를 append 하는 순수 persist 동작만 수행한다.
 *
 *  - `persistUserTurn` : user 메시지 저장 + 세션 title 자동 생성.
 *  - `persistAssistantTurn` : assistant 턴(텍스트/toolCalls/plan/usage/
 *    finishReason + stall 복구 resumeMeta) 저장.
 *
 * 1단계 `AssistantToolRouter`(#670)·2단계 `AssistantFinishGuard`(#680)와 동일
 * 패턴 — 메서드 verbatim 이동 + 생성자 주입.
 */
@Injectable()
export class AssistantTurnPersistenceService {
  constructor(
    private readonly sessionService: WorkflowAssistantSessionService,
  ) {}

  /**
   * user 메시지를 저장하고, 세션 title 이 비어있으면 첫 user 발화의 앞부분
   * (≤40자) 으로 자동 생성한다. `currentTitle` 은 턴 시작 시점에 로드한 세션
   * title — 비어있을 때만 `setTitleIfEmpty` (idempotent) 로 derive.
   */
  async persistUserTurn(
    sessionId: string,
    content: string,
    currentTitle: string | null | undefined,
  ): Promise<void> {
    await this.sessionService.appendMessage(sessionId, {
      role: 'user',
      content,
    });
    if (!currentTitle) {
      const derived = content.trim().slice(0, 40);
      if (derived)
        await this.sessionService.setTitleIfEmpty(sessionId, derived);
    }
  }

  /**
   * assistant 턴 한 row 를 저장한다. 누적 텍스트·toolCalls·plan·usage·
   * finishReason 와 stall 복구 메타를 받아 entity 필드로 그대로 append 한다
   * (`appendMessage` 가 `Partial<WorkflowAssistantMessage>` 를 수용).
   *
   * `finishReason` 은 의도적으로 `string` — provider 가 돌려주는 원본
   * finishReason(`'stop'`/`'tool_calls'`/`'length'`/`'content_filter'`/
   * `'aborted'`)과 서버 합성 마커(`'error'`/`'auto_resume_pending'`)가 모두
   * 흘러들고, entity 컬럼도 `string | null` 이라 strict union 으로 좁히면
   * 누락 케이스가 생긴다.
   *
   * @param resumeMeta stall 복구 row 표시 메타. 기본은 정상 단일 row 용.
   */
  async persistAssistantTurn(
    sessionId: string,
    content: string,
    toolCalls: AssistantToolCallRecord[],
    plan: AssistantPlanRecord | null,
    usage: UsageSnapshot | null | undefined,
    finishReason: string,
    resumeMeta: ResumeMeta = makeResumeMeta(0),
  ): Promise<void> {
    await this.sessionService.appendMessage(sessionId, {
      role: 'assistant',
      content: content || null,
      toolCalls: toolCalls.length ? toolCalls : null,
      plan,
      usage: usage ?? null,
      finishReason,
      autoResumed: resumeMeta.autoResumed,
      autoResumeReason: resumeMeta.autoResumeReason,
      autoResumeAttempt: resumeMeta.autoResumeAttempt,
    });
  }
}
