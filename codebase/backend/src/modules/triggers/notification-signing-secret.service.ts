import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Trigger } from './entities/trigger.entity';
import {
  acquireTriggerConfigLock,
  mergeIntoFreshSubKey,
  rewriteTriggerConfigLocked,
} from './trigger-config-lock';
import {
  SecretResolverService,
  SecretWorkspaceMismatchError,
} from '../secret-store/secret-resolver.service';
import { notificationSigningSecretRef } from './notification-signing-secret-ref';
import {
  decideNotificationSigning,
  newNotificationSigningSecret,
  notificationWithSigningRef,
  signingWithRef,
} from './notification-signing-secret';
import { TriggerResourceReleaserService } from './trigger-resource-releaser.service';

/** 시크릿 교체 유예. 이 시간이 지난 v2 를 승격한다([EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)). */
const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;

/** {@link NotificationSigningSecretService.settle} 의 결과. 저장할 `config` 와, 발급했으면 일회성 평문. */
export interface SettledNotificationSigning {
  config: Record<string, unknown>;
  issuedSecret?: string;
}

/**
 * 알림 서명 시크릿의 판정 · 시크릿 저장소 쓰기 · 보상을 맡는다.
 *
 * 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체), [시크릿 저장소 「규칙」](CLE-INT-SECRET#규칙),
 * [트리거 관리 「동시 쓰기 직렬화」](CLE-TRIG-MANAGE#동시-쓰기-직렬화).
 *
 * `TriggersService` 에서 옮겨 왔고 동작은 그대로다(NERV Task `CLE-T-EQDYC1`). 요청 흐름(잠금을 언제 잡고 응답에 무엇을
 * 싣는지)은 `TriggersService` 가 정하고, 이 서비스는 시크릿 한 종류의 규칙만 안다.
 *
 * | 메서드 | 부르는 자리 | 잠금 |
 * |---|---|---|
 * | `settle` | 생성 · `notification` 이 실린 PATCH | 호출부가 잡은 잠금 안에서 부른다 |
 * | `migrateLegacyPlaintext` | 원시 `config` PATCH 의 옛 평문 정규화 | 스스로 잡는다 |
 * | `writeRotation` | `rotate-secret` | 스스로 잡는다 |
 * | `promoteRotated` | 승격 cron | 트리거마다 스스로 잡는다 |
 */
@Injectable()
export class NotificationSigningSecretService {
  private readonly logger = new Logger(NotificationSigningSecretService.name);

  constructor(
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    private readonly secrets: SecretResolverService,
    private readonly resourceReleaser: TriggerResourceReleaserService,
  ) {}

  /**
   * 잠금 안에서 다시 읽은 행(`fresh`)을 보고 `config.notification.signing` 을 정한다. 시크릿 저장소 쓰기를
   * 하고 새 `config` 를 돌려준다. 호출부가 같은 잠금 안에서 그 `config` 를 쓴다.
   *
   * | 결정 | 시크릿 저장소 | `signing` |
   * |---|---|---|
   * | `rederive` | 쓰지 않는다 | `secretRef` 를 트리거 id 로 다시 만든다(행의 값을 복사하지 않는다) |
   * | `migrate` | 행의 옛 평문을 정식 참조에 쓴다 | `secretRef` 를 싣고 옛 평문 키를 뺀다 |
   * | `issue` | 새 `wsk_*` 를 정식 참조에 쓴다 | 위와 같다. 평문을 `issuedSecret` 으로 돌려준다 |
   *
   * @param manager 설정 잠금을 쥔 트랜잭션의 매니저. 시크릿 저장소 쓰기를 같은 트랜잭션에서 하려고
   *   `SecretResolverService.rotate` 에 넘긴다. 넘기지 않으면 풀에서 연결을 하나 더 빌려 잠금 보유자가 연결 둘을
   *   쥔다. 같은 트랜잭션이므로 뒤따르는 `config` 쓰기가 실패하면 시크릿 쓰기도 함께 롤백된다.
   * @param fresh 판정의 기준이 되는 행. PATCH 는 잠금 안 재읽기이고 생성은 같은 트랜잭션에서 INSERT 한 행이다.
   *   저장된 `notification` 을 여기서 읽는다.
   * @param nextConfig 저장할 `config`. 그 `notification` 위에 `signing` 을 얹는다. PATCH 면 요청 바디로
   *   통째로 바뀐 값이고 생성이면 INSERT 한 값 그대로다.
   */
  async settle(
    manager: EntityManager,
    fresh: Trigger,
    nextConfig: Record<string, unknown>,
  ): Promise<SettledNotificationSigning> {
    const ref = notificationSigningSecretRef(fresh.id);
    const decision = decideNotificationSigning(
      (fresh.config as { notification?: unknown } | null)?.notification,
    );
    let issuedSecret: string | undefined;
    if (decision.kind === 'migrate') {
      await this.secrets.rotate(
        ref,
        fresh.workspaceId,
        decision.plaintext,
        manager,
      );
    } else if (decision.kind === 'issue') {
      issuedSecret = newNotificationSigningSecret();
      await this.secrets.rotate(ref, fresh.workspaceId, issuedSecret, manager);
    }
    return {
      // 옛 평문 키는 남기지 않는다. 평문은 시크릿 저장소에만 둔다(규칙 14).
      config: {
        ...nextConfig,
        notification: notificationWithSigningRef(nextConfig.notification, ref),
      },
      issuedSecret,
    };
  }

  /**
   * [Spec EIA §7.1] — notification.signing.secret plaintext 정규화.
   *
   * config 에 `signing.secret` plaintext 가 포함됐을 때 secret store 로 마이그레이션하고
   * config 에는 `signing.secretRef` 만 남긴다. plaintext 가 DB JSONB / 로그에 영구 노출되지
   * 않도록 보장 (SS-SE-01).
   *
   * 이미 `secretRef` 만 있는 경우 noop. signing 자체가 없는 경우도 noop.
   *
   * **지금은 `TriggersService.update()` 의 원시 `config` 경로만 쓴다.** 생성과 top-level `notification` 이 실린
   * PATCH 는 {@link settle} 이 평문 이전과 첫 발급을 한 잠금 안에서 한다(NERV Task `CLE-T-M6PERB`). 원시 `config`
   * 경로의 계약은 NERV Task `CLE-T-EA7B5M` 이 맡는다.
   *
   * @param trigger 저장을 마친 엔티티. 호출부가 이 엔티티를 응답에 쓰므로 in-memory `config` 도 맞춘다.
   */
  async migrateLegacyPlaintext(trigger: Trigger): Promise<void> {
    const notificationCfg = (trigger.config as { notification?: unknown })
      ?.notification;
    if (!notificationCfg || typeof notificationCfg !== 'object') return;
    const signing = (notificationCfg as { signing?: unknown }).signing;
    if (!signing || typeof signing !== 'object') return;
    const plaintext = (signing as { secret?: unknown }).secret;
    if (typeof plaintext !== 'string' || plaintext.length === 0) return;

    const ref = notificationSigningSecretRef(trigger.id);
    await this.secrets.rotate(ref, trigger.workspaceId, plaintext);

    const updatedSigning = signingWithRef(signing, ref);
    const normalizedNotification = {
      ...(notificationCfg as Record<string, unknown>),
      signing: updatedSigning,
    };
    trigger.config = {
      ...trigger.config,
      notification: normalizedNotification,
    };
    // 재읽은 `config.notification` **위에** `signing` 만 얹는다. 스냅샷으로 만든
    // `normalizedNotification` 을 통째로 대입하면 그 사이 커밋된 `notification.url` 등이
    // 되돌아간다 — `mergeIntoFreshSubKey` JSDoc 참조.
    const wrote = await rewriteTriggerConfigLocked(
      this.triggerRepository.manager,
      trigger.id,
      (freshConfig) =>
        mergeIntoFreshSubKey(
          freshConfig,
          'notification',
          { signing: updatedSigning },
          normalizedNotification,
        ),
    );
    // 그 사이 트리거가 삭제됐다 — 위에서 락 밖에 쓴 서명 비밀을 되돌린다(spec 트리거 목록 §3).
    if (!wrote) {
      await this.resourceReleaser.undoAbsentWrite(
        trigger.id,
        undefined,
        'NotificationSigningSecretService.migrateLegacyPlaintext',
      );
    }
  }

  /**
   * 새 시크릿을 만들어 `notification_secret_v2` 와 교체 시각에 쓴다. 행이 없으면 `null` 이다.
   *
   * **트리거 설정 잠금 안에서 컬럼만 쓴다.** `save(trigger)` 는 엔티티를 통째로 저장해 읽은 시점의 `config`
   * 까지 되쓴다(`hooks.service.ts` 의 `touchLastTriggeredAt` 과 같은 규율). 잠금을 잡는 이유는 승격이 잠금
   * 안에서 같은 컬럼을 비우기 때문이다. 승격이 v2 를 고른 뒤 교체가 새 값을 쓰면 응답으로 나간 새 시크릿을
   * 승격이 지울 수 있었다(NERV Task `CLE-T-M6PERB`). `config` 를 쓰지 않는 컬럼 한정 쓰기 가운데 이 경로만
   * 잠금을 잡는다. 근거: [트리거 관리 「동시 쓰기 직렬화」](CLE-TRIG-MANAGE#동시-쓰기-직렬화), REQ-TRIG-054.
   * 유예 중 재교체는 앞의 v2 를 덮고 유예를 다시 시작한다([EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)).
   */
  async writeRotation(
    triggerId: string,
    workspaceId: string,
  ): Promise<{ secret: string; rotatedAt: Date } | null> {
    const secret = newNotificationSigningSecret();
    const rotatedAt = new Date();
    const wrote = await this.triggerRepository.manager.transaction(
      async (m) => {
        await acquireTriggerConfigLock(m, triggerId);
        const fresh = await m.findOne(Trigger, {
          select: { id: true },
          where: { id: triggerId, workspaceId },
        });
        if (!fresh) return false;
        const { affected } = await m.update(
          Trigger,
          { id: triggerId },
          { notificationSecretV2: secret, notificationRotatedAt: rotatedAt },
        );
        return (affected ?? 0) > 0;
      },
    );
    return wrote ? { secret, rotatedAt } : null;
  }

  /**
   * 24h grace 가 경과한 trigger 의 notification_secret_v2 → primary 승격.
   * 별도 scheduled job (NotificationSecretRotatorService) 이 매시간 호출.
   * trigger 단위 idempotent — v2 가 null 이면 no-op.
   *
   * [리뷰 C3 fix] 승격은 평문을 config 에 쓰지 않고 **secret store 의 canonical ref
   * 내용을 회전**한다 (`migrateLegacyPlaintext` 와 동일 ref 규약). 과거 구현은
   * `signing.secret` 평문을 썼는데, 발송측 `resolveSigningSecret` 이 `secretRef` 우선이라
   * ref 보유 trigger 는 승격 후에도 구 secret 으로 서명을 지속했다 (rotation 무효).
   *
   * 후보 조회는 `id` 와 v2 두 컬럼만 읽는다. 판정과 쓰기는 트리거마다 잠금 안에서 다시 읽은 행으로 한다
   * (NERV Task `CLE-T-EQDYC1`).
   */
  async promoteRotated(nowMs: number): Promise<{ promoted: number }> {
    const candidates = await this.triggerRepository
      .createQueryBuilder('t')
      .select(['t.id', 't.notificationSecretV2'])
      .where('t.notification_secret_v2 IS NOT NULL')
      .andWhere('t.notification_rotated_at <= :cutoff', {
        cutoff: new Date(nowMs - ROTATION_GRACE_MS),
      })
      .getMany();
    let promoted = 0;
    for (const candidate of candidates) {
      const pickedV2 = candidate.notificationSecretV2;
      if (!pickedV2) continue;
      if (
        (await this.promoteOneLocked(candidate.id, pickedV2)) === 'promoted'
      ) {
        promoted++;
      }
    }
    return { promoted };
  }

  /**
   * 한 트리거의 v2 를 승격한다 — **판정 · 시크릿 저장소 쓰기 · 컬럼 비우기를 한 트리거 설정 잠금 안에서 한다.**
   *
   * 근거: [EIA 알림 웹훅 「시크릿 교체」](CLE-EIA-NOTIFY#시크릿-교체)(승격 조건의 기준), REQ-EIANOTI-036,
   * [EIA 데이터와 흐름 「서명 시크릿 교체와 승격」](CLE-EIA-DATA#서명-시크릿-교체와-승격).
   *
   * - **잠금 안에서 다시 읽은 v2 가 고른 값과 같을 때만** 정식 참조로 옮기고 비운다. 다르면 그사이 교체가 다시
   *   일어난 것이라 옮기지도 비우지도 않는다 — 새 값은 다시 시작한 유예가 끝난 뒤에 승격한다. 종전엔 잠금
   *   밖에서 먼저 옮겼다. 그래서 재교체가 끼면 덮인 옛 v2 가 주 시크릿이 됐다(NERV Task `CLE-T-M6PERB`).
   * - EIA 알림 웹훅 설정이 없는 트리거는 승격하지 않고 v2 와 교체 시각을 비운다 — 매 주기 건너뛰면 v2 평문이
   *   DB 에 계속 남는다(`[SUMMARY W-2]`).
   * - 다른 워크스페이스 소유의 저장소 행이면 이 트리거만 건너뛴다(NERV Task `CLE-T-XYR067`). 그 밖의 실패는
   *   던져 job 재시도에 맡긴다.
   * - 시크릿 저장소 쓰기는 이 트랜잭션의 매니저로 한다 — 풀 연결을 더 빌리지 않고 던지면 함께 롤백된다.
   * - 잠금 안에서도 행이 사라질 수 있다(FK CASCADE 는 advisory lock 을 거치지 않는다). 쓰기가 0행이면 커밋 뒤
   *   시크릿 저장소에 쓴 것을 되돌린다(시크릿 저장소 규칙 9). cron 이라 알릴 상대가 없고 «승격했다» 고 세지 않는다.
   *
   * 승격은 평문을 설정에 쓰지 않는다 — 정식 참조 내용을 바꾸고 `signing.secretRef` 를 연결한다.
   */
  private async promoteOneLocked(
    triggerId: string,
    pickedV2: string,
  ): Promise<'promoted' | 'skipped'> {
    let wroteSecret = false;
    const outcome = await this.triggerRepository.manager.transaction(
      async (m): Promise<'promoted' | 'skipped' | 'absent'> => {
        await acquireTriggerConfigLock(m, triggerId);
        const fresh = await m.findOne(Trigger, { where: { id: triggerId } });
        if (!fresh) return 'skipped';
        if (fresh.notificationSecretV2 !== pickedV2) return 'skipped';
        const notificationCfg = (fresh.config as { notification?: unknown })
          ?.notification;
        if (!notificationCfg || typeof notificationCfg !== 'object') {
          this.logger.warn(
            `trigger ${triggerId} has notificationSecretV2 but no notification config — clearing stale v2 columns`,
          );
          // 컬럼만 쓴다 — `config` 를 건드리지 않는다.
          await m.update(
            Trigger,
            { id: triggerId },
            { notificationSecretV2: null, notificationRotatedAt: null },
          );
          return 'skipped';
        }
        const ref = notificationSigningSecretRef(triggerId);
        try {
          // ref 가 있으면 내용 교체, 없으면 신규 생성 — rotate 가 upsert 시맨틱.
          await this.secrets.rotate(ref, fresh.workspaceId, pickedV2, m);
        } catch (err) {
          if (err instanceof SecretWorkspaceMismatchError) {
            this.logger.error(
              `notification secret 승격 건너뜀 — 트리거 ${triggerId} 의 서명 비밀 행이 다른 워크스페이스 소유다. 저장된 행을 점검하세요.`,
            );
            return 'skipped';
          }
          throw err;
        }
        wroteSecret = true;
        // legacy 평문 키는 제거 — 평문은 DB config 에 남기지 않는다.
        const { affected } = await m.update(
          Trigger,
          { id: triggerId },
          {
            config: {
              ...fresh.config,
              notification: notificationWithSigningRef(notificationCfg, ref),
            },
            notificationSecretV2: null,
            notificationRotatedAt: null,
          },
        );
        return (affected ?? 0) > 0 ? 'promoted' : 'absent';
      },
    );
    if (outcome === 'absent') {
      if (wroteSecret) {
        // 위 `rotate` 가 쓴 서명 비밀을 되돌린다 — 삭제 쪽 정리보다 늦었으면 아무도 안 지운다.
        await this.resourceReleaser.undoAbsentWrite(
          triggerId,
          undefined,
          'NotificationSigningSecretService.promoteRotated',
        );
      }
      return 'skipped';
    }
    return outcome;
  }
}
