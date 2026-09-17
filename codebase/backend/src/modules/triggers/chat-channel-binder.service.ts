import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from './entities/trigger.entity';
import { rewriteTriggerConfigLocked } from './trigger-config-lock';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import { ChatChannelConfig } from '../chat-channel/types';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { buildSecretRef } from '../secret-store/secret-ref';
import {
  stripChatChannelPlaintext,
  extractInboundSigningRef,
} from './chat-channel-input-rules';
import type { ChatChannelInput } from './chat-channel-input-rules';
import { buildTriggerCallbackUrl } from './trigger-callback-url';
import { undoAbsentTriggerWrite } from './trigger-resource-release';

/**
 * chat-channel **adapter 바인딩** — setup / teardown 과 그에 딸린 secret store 쓰기·ref 보존.
 *
 * `TriggersService` 에서 그대로 옮겨왔다 (동작 보존, `plan/complete/impl-chat-channel-binder-t2.md`).
 *
 * ## 왜 클래스(Nest provider)인가 — 자매 모듈 `chat-channel-input-rules.ts` 는 순수 함수인데
 *
 * **기준은 외부 의존의 수**다. 그쪽은 입력만 보는 검증이라 협력자가 **0개**여서 DI 가 군더더기였다.
 * 이쪽은 repository · 두 registry · secret store 를 **실제로** 쓴다(4개 주입). 협력자를 쓰는 코드는
 * 이 저장소의 idiom 대로 provider 로 만든다 — 같은 폴더의 `chat-channel-token-rotator.service.ts`
 * 가 선례다.
 *
 * ## 경계 — 여기 있는 것 / 없는 것
 *
 * | 있다 | 없다 |
 * |---|---|
 * | `setupChatChannel` · `teardownChatChannel` | `rotateBotToken` · `cleanupRotatedChatChannelTokens` · `tryRevokeOldBotToken` |
 *
 * 오른쪽 셋도 chat-channel 이지만 **엔드포인트 오케스트레이션**이라 `TriggersService` 에 남았다 —
 * `findById` · `recordAudit`(감사 로그) · BullMQ 큐를 함께 쓰므로 옮기면 그 협력자까지 끌고 온다.
 * 옮길 수 있는 경계를 정한 것은 취향이 아니라 **의존 방향의 실측**이다.
 *
 * ## `chat-channel/` 이 아니라 `triggers/` 에 있는 이유
 *
 * 원 지적은 *"`chat-channel/` 하위로 옮겨라"* 였는데 그러면 **끊어 둔 순환이 되살아난다**.
 * `#676`(`e827ed2a7`) 이 `chat-channel→triggers` 역방향 의존 2곳을 의도적으로 제거해
 * `forwardRef` 를 없앴다(잔존 0건 실측). 이 클래스는 `triggers/` 안의 협력자여야 한다.
 *
 * ## 로그 메시지 접두
 *
 * 메시지는 이 클래스 이름을 접두로 쓴다. 옮길 때는 *"순수 이동"* 주장을 지키려고
 * `TriggersService:` 를 남기고 정정을 후속으로 미뤘는데, 트리거 삭제 자원 정리가 보상 경로에서
 * 이 로그를 새로 부르게 되면서 정정했다 — 호출 경로가 늘수록 틀린 접두가 진단을 흐린다.
 */
@Injectable()
export class ChatChannelBinderService {
  private readonly logger = new Logger(ChatChannelBinderService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    private readonly channelAdapterRegistry: ChannelAdapterRegistry,
    private readonly channelListenerRegistry: ChannelListenerRegistry,
    private readonly secrets: SecretResolverService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Chat Channel adapter setupChannel 호출 + 결과를 trigger.config 와 health 컬럼에 반영.
   * Spec CCH-AD-02. best-effort — 실패 시 chat_channel_health=degraded, last_error 저장하되 trigger
   * 자체는 비활성화 X (CCH-SE-01 / WH-MG-04).
   *
   * ## secret store 쓰기는 셋이고, PATCH 에서의 처분이 서로 다르다
   *
   * | 쓰기 | 자원 | `storeUserSuppliedSecrets: false` 일 때 |
   * |---|---|---|
   * | bot token rotate | 사용자가 body 로 보낸 값 | **건너뛴다** |
   * | provider-issued signing (slack/discord) | 사용자가 body 로 보낸 값 | **건너뛴다** |
   * | server-issued signing (telegram) | adapter 가 provider 와 합의해 발급 | **그대로 쓴다** |
   *
   * **세 번째를 함께 막으면 안 된다.** telegram adapter 는 `setupChannel` 마다 새
   * `secret_token` 을 Telegram 에 등록하므로, 저장을 건너뛰면 DB 는 옛 값이 되고
   * `X-Telegram-Bot-Api-Secret-Token` 검증이 어긋나 **그 트리거의 인입이 전부 401** 이 된다.
   * 플래그 이름을 `writeSecrets` 처럼 뭉뚱그리지 않고 `storeUserSuppliedSecrets` 로 둔 이유가
   * 이것이다 — 게이팅 대상이 *"사용자가 보낸"* 비밀임을 이름이 말하게 한다.
   *
   * @see spec/5-system/15-chat-channel.md §5.4.1.1 (inboundSigning — 회전 주체별 분기)
   * @see spec/5-system/15-chat-channel.md R-CC-21 (PATCH 는 비밀을 쓰지 않는다)
   */
  async setupChatChannel(
    trigger: Trigger,
    chatChannelCfg: ChatChannelInput,
    {
      storeUserSuppliedSecrets,
      preservedInboundSigningRef,
    }: {
      storeUserSuppliedSecrets: boolean;
      /**
       * 이 PATCH **이전에** config 에 있던 `inboundSigningRef`. 호출자가 병합 전에 집어 준다
       * — 병합 후에는 사라져 있어 이 함수가 스스로 알 수 없다. 생성 경로는 `undefined`.
       */
      preservedInboundSigningRef?: string;
    },
  ): Promise<void> {
    if (!this.channelAdapterRegistry.has(chatChannelCfg.provider)) {
      this.logger.warn(
        `ChatChannelBinderService: chatChannel.provider="${chatChannelCfg.provider}" 미등록 — setupChannel skip`,
      );
      return;
    }
    if (!trigger.endpointPath) {
      throw new BadRequestException({
        code: 'CHAT_CHANNEL_ENDPOINT_REQUIRED',
        message:
          'Chat channel trigger requires endpointPath (callback URL을 만들기 위해 필요).',
      });
    }
    const adapter = this.channelAdapterRegistry.get(chatChannelCfg.provider);
    const callbackUrl = buildTriggerCallbackUrl({
      baseUrl: this.configService.get<string>('app.url'),
      endpointPath: trigger.endpointPath,
    });

    // secret store ref 생성 — spec/conventions/secret-store.md §1 URI scheme 단일 진입점.
    const botTokenRef = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'bot-token',
    });
    const inboundSigningRef = buildSecretRef({
      scope: 'triggers',
      resourceId: trigger.id,
      name: 'inbound-signing',
    });

    // [쓰기 ①] secret store 에 botToken 저장 (UPSERT — 재시도 안전).
    // **PATCH 에서는 건너뛴다.** 종전에는 조건이 없어서, 값이 없으면 `?? ''` 가 빈 문자열로
    // 회전해 저장된 토큰을 지웠다 — `SecretResolver.rotate` 에 빈 값 가드가 없기 때문이다
    // (R-CC-21 「처방의 함정」). 필드를 막는 것만으로는 그 파괴를 못 막으므로 경로를 막는다.
    if (storeUserSuppliedSecrets) {
      await this.secrets.rotate(
        botTokenRef,
        trigger.workspaceId,
        chatChannelCfg.botToken ?? '',
      );
    }

    // [secret-store.md §5.5 (b)] provider-issued inbound-signing plaintext 처리.
    // Slack signing secret / Discord public key — 사용자가 외부 portal 에서 입력한 값을
    // secret store 로 옮기고 plaintext 는 config 에 절대 흘리지 않음 (SS-SE-01).
    // [쓰기 ②] **PATCH 에서는 건너뛴다** — §5.4.1.1 이 v1 에서 이 회전을 차단한다.
    // 종전 구현은 slack/discord 에서 이 값을 **필수로 요구**해 매 PATCH 마다 회전시켰다.
    const providerIssuedPlaintext = storeUserSuppliedSecrets
      ? chatChannelCfg.inboundSigningPlaintext
      : undefined;
    let providerIssuedStored = false;
    if (
      typeof providerIssuedPlaintext === 'string' &&
      providerIssuedPlaintext.length > 0
    ) {
      await this.secrets.rotate(
        inboundSigningRef,
        trigger.workspaceId,
        providerIssuedPlaintext,
      );
      providerIssuedStored = true;
    }

    // chatChannelCfg 에서 plaintext 필드들을 제거 — config 에 흘러가지 않음 (SS-SE-01).
    // create()/update() 의 stripChatChannelPlaintext 와 의도적으로 이중 방어 — adapter
    // 코드가 dto.botToken 을 직접 mutate 하는 회귀에 대비.
    const sanitizedCfg = stripChatChannelPlaintext(chatChannelCfg);

    // [ref 보존 — 두 ref 는 **대칭**이어야 한다]
    //
    // `mergeExternalConfig` 가 `config.chatChannel` 을 **통째로 교체**하므로, 요청 바디에 없는
    // 필드는 전부 사라진다. `botTokenRef` 는 `buildSecretRef(trigger.id)` 로 매번 재유도돼
    // 무조건 다시 실리는데, `inboundSigningRef` 는 종전에 *"이번 호출에서 값을 새로 썼을 때만"*
    // 실렸다. D-2 가 그 쓰기를 게이팅하자 **slack/discord PATCH 에서 그 조건이 구조적으로 항상
    // 거짓**이 되어 ref 가 사라졌고, `ChatChannelInboundAuthenticator` 는 세 provider 모두
    // `if (!config.inboundSigningRef) return;` 으로 검증을 건너뛴다 — 카드 편집 PATCH 한 번으로
    // 그 트리거의 인입 웹훅이 **서명 없이 통과**하게 된다(fail-open).
    //
    // **그렇다고 `botTokenRef` 처럼 무조건 싣지는 않는다.** 이 ref 의 존재는 *"signing 비밀이
    // 저장돼 있다"* 는 신호이기도 해서, 행이 없는 트리거(legacy · setupChannel 이전)에 ref 를
    // 붙이면 검증이 resolve 실패로 넘어가 **fail-open 을 fail-closed 로 바꾸는 별개의 동작
    // 변경**이 된다. 그래서 "새로 썼거나 · 이미 있었으면 보존" 으로 좁힌다.
    // **`trigger.config` 에서 읽으면 안 된다** — `update()` 는 `mergeExternalConfig` 로
    // `config.chatChannel` 을 통째로 교체한 뒤 저장하고, 그 결과를 이 함수에 넘긴다. 즉 여기
    // 도착한 시점의 `trigger.config.chatChannel` 은 **이미 요청 바디로 갈아치워져** 옛 ref 가
    // 없다. 그래서 호출자가 **병합 전에** 집어 인자로 넘긴다.
    const inboundSigningRefSurvives =
      providerIssuedStored || Boolean(preservedInboundSigningRef);

    const internalCfg: ChatChannelConfig = {
      ...(sanitizedCfg as ChatChannelConfig),
      botTokenRef,
      ...(inboundSigningRefSurvives ? { inboundSigningRef } : {}),
    };

    /**
     * **presence 게이트를 락 안에서 다시 계산한다.**
     *
     * 위 `inboundSigningRefSurvives` 는 이 요청이 **시작할 때**의 상태로 계산된 값이다.
     * 동시 PATCH 가 그 사이에 ref 를 **처음 확립**하면 이쪽 게이트는 여전히 `false` 라
     * `chatChannel` 에서 ref 를 빼 버린다 — 이 수정이 겨누는 바로 그 fail-open 이다
     * (`--impl-prep` `review/consistency/2026/09/14/17_10_16` rationale_continuity W1).
     *
     * 그래서 **재읽은 행의 ref presence** 를 세 번째 항으로 더한다. 컨테이너(`config`)만
     * 다시 읽고 이 값을 그대로 넣으면 결함이 그대로 재발한다.
     */
    const survivesWithFresh = (freshConfig: Record<string, unknown>): boolean =>
      inboundSigningRefSurvives ||
      Boolean(extractInboundSigningRef(freshConfig));

    /**
     * 락 안에서 쓸 `chatChannel` 을 만든다 — **성공·실패 두 경로가 이 함수 하나를 쓴다.**
     *
     * 종전엔 거의 같은 스프레드-조건을 두 클로저가 각각 갖고 있었다. 차이는 `configUpdates`
     * 스프레드와 `issuedInboundSigning` 항뿐인데, 그런 쌍은 **한쪽만 고치고 다른 쪽을 놓치는**
     * drift 를 부른다 — 이번 PR 자체가 두 자리를 함께 고쳐야 했던 사례다
     * (`/ai-review` `review/code/2026/09/14/18_17_44` maintainability WARNING#6).
     *
     * `botTokenRef` 를 다시 스프레드하는 것은 no-op 이다 — `internalCfg` 가 이미 갖고 있다.
     * 명시해 두는 이유는 *"이 ref 는 매번 재유도돼 무조건 실린다"* 는 D-3 계약을 이 자리에서
     * 읽히게 하기 위해서다 (회귀 캐너리: *"config 를 통째로 교체해도 botTokenRef 가
     * 재유도돼 살아남는다"*).
     */
    const buildChannel = (
      freshConfig: Record<string, unknown>,
      setupResult?: {
        configUpdates?: Partial<ChatChannelConfig>;
        issuedInboundSigning?: string;
      },
    ): ChatChannelConfig => ({
      ...internalCfg,
      ...(setupResult?.configUpdates ?? {}),
      botTokenRef,
      // 회귀 캐너리: *"slack/discord — 카드 편집 PATCH 후에도 inboundSigningRef 가 살아남는다"*
      // 와 *"setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다"*.
      ...(setupResult?.issuedInboundSigning || survivesWithFresh(freshConfig)
        ? { inboundSigningRef }
        : {}),
    });

    /**
     * 락 안 재기록이 **행 부재**로 쓰지 못했을 때 — 이번 요청이 등록한 설정으로 teardown 한 뒤 그
     * 트리거의 비밀을 지운다(spec 트리거 목록 §3). 성공·degraded 두 경로가 같이 쓴다.
     */
    const undoWrite = (registered: ChatChannelConfig, caller: string) =>
      undoAbsentTriggerWrite(
        {
          teardown: () => this.teardownChannelConfig(trigger.id, registered),
          secrets: this.secrets,
          logger: this.logger,
        },
        trigger.id,
        caller,
      );

    try {
      const result = await adapter.setupChannel(internalCfg, callbackUrl);

      // [쓰기 ③] issuedInboundSigning (server-issued, Telegram) → secret store 저장.
      // provider-issued (slack/discord) 인 경우 setupChannel 의 issuedInboundSigning 은 비어 있음
      // — 이미 위에서 사용자 입력 plaintext 를 저장했으므로 noop.
      //
      // **`storeUserSuppliedSecrets` 로 게이팅하지 않는다 — 의도적이다.** 이 값은 사용자가
      // 보낸 것이 아니라 adapter 가 방금 Telegram 에 등록한 값이다. PATCH 에서 저장을
      // 건너뛰면 DB 는 옛 `secret_token`, Telegram 은 새 값으로 서명하게 되어 그 트리거의
      // 인입 웹훅이 **전부 401** 이 된다 (Spec §5.4.1.1 telegram 행 / R-CC-21 caveat).
      // 회귀 캐너리: `triggers.service.spec.ts` 의 *"server-issued 서명은 PATCH 에서도
      // 재저장된다"*.
      if (result.issuedInboundSigning) {
        await this.secrets.rotate(
          inboundSigningRef,
          trigger.workspaceId,
          result.issuedInboundSigning,
        );
      }

      // **락 안에서** config 를 다시 읽어 머지한다 — 외부 호출(`setupChannel`)은 이미 끝났으므로
      // 임계 구간에 들어가지 않는다. 근거는 `trigger-config-lock.ts` JSDoc.
      const wrote = await rewriteTriggerConfigLocked(
        this.triggerRepository.manager,
        trigger.id,
        (freshConfig) => ({
          ...freshConfig,
          chatChannel: buildChannel(freshConfig, result),
        }),
        {
          chatChannelSetupAt: new Date(),
          chatChannelHealth: 'healthy',
          chatChannelLastError: null,
        },
      );
      // [Spec R8 v1 적용 (2026-05-24)] setup success path 에서만 listener registry register.
      // setupChannel 멱등성 — 동일 triggerId 재호출 시 entry overwrite.
      //
      // **쓰기가 skip 됐으면(그 사이 삭제) 등록도 하지 않는다.** 안 그러면 해제되지 않는
      // 유령 entry 가 in-memory registry 에 남는다 — dispatcher 가 warn+skip 으로 관대하게
      // 처리해 오배달로는 안 이어지지만, 애초에 만들 이유가 없다
      // (`/ai-review` `review/code/2026/09/14/20_17_16` side_effect INFO#4).
      if (wrote) {
        this.channelListenerRegistry.register(
          trigger.id,
          chatChannelCfg.provider,
        );
      } else {
        // **그 사이 트리거가 삭제됐다 — 락 밖에서 만든 것을 되돌린다** (spec 트리거 목록 §3).
        // 방금 provider 에 등록한 콜백과 위에서 쓴 비밀은 삭제 쪽 정리보다 늦었을 수 있고, 그러면
        // 아무도 지우지 않는다. teardown 이 비밀을 읽으므로 설정은 이번 등록 결과로 넘긴다.
        await undoWrite(
          buildChannel({}, result),
          'ChatChannelBinderService.setupChatChannel',
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // SUMMARY#24: secret_store 에 botToken 저장 완료 후 setupChannel 실패 — trigger 는
      // degraded 로 저장되지만 secret_store row 는 남아 있음. remove() 시 deleteByPrefix 로 정리.
      this.logger.warn(
        `ChatChannelBinderService: secret_store 에 botToken 저장 완료 후 setupChannel 실패 — trigger=${trigger.id} 는 degraded 상태로 저장됨.`,
      );
      this.logger.warn(
        `ChatChannelBinderService: setupChannel 실패 (trigger=${trigger.id}, provider=${chatChannelCfg.provider}): ${message}`,
      );
      // fallback: `buildChannel` 을 **setupResult 없이** 부른다 — `internalCfg` 에 이미 적용된
      // `inboundSigningRefSurvives`(요청 시작 시점) **와** 재읽은 행의 ref presence, 두 항의
      // 합집합이다. 그래서 **실패 경로에서도 두 ref 가 함께 보존된다**.
      // 회귀 캐너리: *"setupChannel 이 실패해도(degraded) inboundSigningRef 를 잃지 않는다"*.
      //
      // **이 경로도 락 안에서 다시 읽는다.** 외부 mock 이 없는 e2e 에서는 `setupChannel` 이
      // 항상 던져 **실제로 도달하는 쓰기가 여기**다 — 성공 경로만 고치면 재현 테스트가
      // 고쳐지지 않은 코드를 통과시킨다.
      const wroteDegraded = await rewriteTriggerConfigLocked(
        this.triggerRepository.manager,
        trigger.id,
        (freshConfig) => ({
          ...freshConfig,
          chatChannel: buildChannel(freshConfig),
        }),
        {
          chatChannelHealth: 'degraded',
          chatChannelLastError: message.slice(0, 1024),
        },
      );
      // 성공 경로와 같은 보상이다. setup 이 실패했어도 **부분 등록**이 남았을 수 있고, 위의
      // bot token 쓰기는 이미 끝났다 — teardown 은 best-effort 라 등록이 없으면 조용히 넘어간다.
      if (!wroteDegraded) {
        await undoWrite(
          internalCfg,
          'ChatChannelBinderService.setupChatChannel(degraded)',
        );
      }
    }
  }

  /**
   * Chat Channel adapter teardownChannel 호출 — trigger 삭제 / chatChannel 제거 시. best-effort.
   * Spec CCH-AD-03.
   */
  async teardownChatChannel(trigger: Trigger): Promise<void> {
    const chatChannelCfg = (
      trigger.config as { chatChannel?: ChatChannelConfig }
    ).chatChannel;
    if (!chatChannelCfg) return;
    await this.teardownChannelConfig(trigger.id, chatChannelCfg);
  }

  /**
   * 설정 하나로 teardown 한다 — 저장된 `config` 가 아니라 **이번 요청이 등록한 설정**으로 되돌려야
   * 하는 보상 경로(행이 이미 없다)가 쓴다. best-effort.
   */
  async teardownChannelConfig(
    triggerId: string,
    chatChannelCfg: ChatChannelConfig,
  ): Promise<void> {
    if (!this.channelAdapterRegistry.has(chatChannelCfg.provider)) return;
    const adapter = this.channelAdapterRegistry.get(chatChannelCfg.provider);
    try {
      await adapter.teardownChannel(chatChannelCfg);
    } catch (err) {
      this.logger.warn(
        `ChatChannelBinderService: teardownChannel 실패 (best-effort, trigger=${triggerId}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
