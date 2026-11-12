import { NotFoundException } from '@nestjs/common';

import type { SecretResolverService } from '../secret-store/secret-resolver.service';

/**
 * 쓰기 전에 읽어 둔 비밀의 상태.
 *
 * - `absent` — 행이 없었다(`resolve` 가 `NotFoundException`).
 * - `present` — 행이 있었고 복호화했다. 빈 값이나 공백만인 값도 여기에 든다.
 * - `unreadable` — 행은 있을 수 있는데 읽지 못했다(복호화 실패 등). 되돌릴 값을 모른다.
 */
export type PriorSecret =
  | { state: 'absent' }
  | { state: 'present'; plaintext: string }
  | { state: 'unreadable' };

type SecretWriter = Pick<
  SecretResolverService,
  'resolve' | 'rotate' | 'delete'
>;

/** `Logger` 에서 쓰는 것만. 순수 클래스가 Nest 인스턴스에 묶이지 않게 한다. */
interface JournalLogger {
  warn(message: string): unknown;
  error(message: string): unknown;
}

interface JournalEntry {
  ref: string;
  written: string;
  prior: PriorSecret;
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * 여러 비밀을 차례로 쓰는 작업이 중간에 실패하면 **이 작업이 쓴 것만** 쓰기 전 값으로 되돌린다.
 *
 * 봇 토큰 재발급(`TriggersService.rotateBotToken`)이 쓴다. 재발급은 유예 백업 · 새 토큰 · 인입 서명 비밀을
 * 차례로 쓰고 provider 호출과 트리거 행 갱신을 사이에 끼운다. 뒤 단계가 실패하면 앞서 쓴 비밀이 남아
 * provider 가 거부한 토큰이 primary 에 남거나, 행이 가리키지 않는 유예 백업이 남는다(NERV Task `CLE-T-Q353Y4`).
 * 근거: [채팅 데이터 「봇 토큰 라이프사이클」](CLE-CHAT-DATA#봇-토큰-라이프사이클).
 *
 * 규칙은 넷이다.
 *
 * 1. **성공한 쓰기만 기록한다.** `rotate` 가 던지면 기록하지 않는다. 다른 워크스페이스 행이라 거부된 쓰기
 *    (`SecretWorkspaceMismatchError`)를 되돌린다며 그 행을 지우면 남의 비밀을 지운다.
 * 2. **거꾸로 되돌린다.** 마지막 쓰기부터 되돌린다.
 * 3. **그 사이 바뀐 행은 건드리지 않는다.** 되돌리기 직전에 다시 읽어 이 작업이 쓴 값이 아니면 건너뛴다.
 *    같은 트리거의 다른 재발급이 끼어들어 성공했으면 그 결과를 덮지 않는다. 읽기와 쓰기 사이의 창은 남는다.
 * 4. **쓰기 전 상태로 맞춘다.** 값이 있었으면 그 값을 다시 쓰고, 없었거나 빈 값이었으면 행을 지운다.
 *    저장소가 빈 평문을 받지 않으므로 빈 값은 되살릴 수 없다. 빈 값도 토큰으로 쓸 수 없어서 «없음» 과 같다.
 *    읽지 못한 행은 되돌릴 값을 모르므로 건너뛰고 error 로그를 남긴다. 지우면 읽지 못했을 뿐인 원래 행을 잃는다.
 *
 * 되돌리기는 **던지지 않는다.** 호출자는 원래 오류를 그대로 던져야 응답 코드가 바뀌지 않는다. 되돌리지 못한
 * 비밀은 ref 만 로그에 남긴다. 평문은 남기지 않는다.
 */
export class SecretWriteJournal {
  private readonly entries: JournalEntry[] = [];

  constructor(
    private readonly secrets: SecretWriter,
    private readonly workspaceId: string,
  ) {}

  /** 쓰기 전 상태를 읽는다. 던지지 않는다. */
  async read(ref: string): Promise<PriorSecret> {
    try {
      return { state: 'present', plaintext: await this.secrets.resolve(ref) };
    } catch (err) {
      return err instanceof NotFoundException
        ? { state: 'absent' }
        : { state: 'unreadable' };
    }
  }

  /** `prior` 는 이 쓰기 직전에 {@link read} 로 읽은 값이다. 쓰기가 성공했을 때만 기록한다. */
  async write(
    ref: string,
    plaintext: string,
    prior: PriorSecret,
  ): Promise<void> {
    await this.secrets.rotate(ref, this.workspaceId, plaintext);
    this.entries.push({ ref, written: plaintext, prior });
  }

  /**
   * `run` 이 던지면 기록한 쓰기를 되돌리고 그 오류를 다시 던진다. 성공하면 기록을 비운다.
   *
   * @param caller 로그에 붙일 호출 위치. 트리거 id 처럼 대상을 알아볼 값을 함께 넣는다.
   */
  async undoOnFailure<T>(
    logger: JournalLogger,
    caller: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      const value = await run();
      this.entries.length = 0;
      return value;
    } catch (err) {
      await this.undo(logger, caller);
      throw err;
    }
  }

  private async undo(logger: JournalLogger, caller: string): Promise<void> {
    const entries = this.entries.splice(0).reverse();
    for (const entry of entries) {
      try {
        await this.undoOne(entry, logger, caller);
      } catch (err) {
        logger.error(
          `${caller}: ${entry.ref} 를 쓰기 전 값으로 되돌리지 못했다. ` +
            `이번 요청이 쓴 값이 남는다: ${describeError(err)}`,
        );
      }
    }
  }

  private async undoOne(
    entry: JournalEntry,
    logger: JournalLogger,
    caller: string,
  ): Promise<void> {
    const current = await this.read(entry.ref);
    if (current.state !== 'present' || current.plaintext !== entry.written) {
      logger.warn(`${caller}: ${entry.ref} 가 그 사이 바뀌어 되돌리지 않는다.`);
      return;
    }
    const { prior } = entry;
    if (prior.state === 'unreadable') {
      logger.error(
        `${caller}: ${entry.ref} 의 쓰기 전 값을 읽지 못해 되돌리지 않는다. ` +
          `이번 요청이 쓴 값이 남는다.`,
      );
      return;
    }
    if (prior.state === 'present' && prior.plaintext.trim() !== '') {
      await this.secrets.rotate(entry.ref, this.workspaceId, prior.plaintext);
      return;
    }
    await this.secrets.delete(entry.ref);
  }
}
