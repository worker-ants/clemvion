import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Address4, Address6 } from 'ip-address';
import { AuthConfig } from './entities/auth-config.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

// HMAC 알고리즘 허용 목록. 외부 입력(인증 설정)이 crypto.createHmac 에 전달되므로
// 화이트리스트로 좁혀 임의 알고리즘·약한 다이제스트 사용을 차단한다.
const HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512']);

// 응답에서 마스킹할 config 키 (spec/1-data-model.md §2.17.2).
const SECRET_CONFIG_KEYS = new Set(['key', 'token', 'secret', 'password']);

export interface WebhookAuthContext {
  /** 소문자 키의 요청 헤더 맵 */
  headers: Record<string, string>;
  /** HMAC 검증용 원본 바이트 */
  rawBody?: Buffer;
  /** ip_whitelist 검증용 클라이언트 IP */
  clientIp?: string;
}

@Injectable()
export class AuthConfigsService {
  constructor(
    @InjectRepository(AuthConfig)
    private readonly authConfigRepository: Repository<AuthConfig>,
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async findAll(
    workspaceId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<AuthConfig>> {
    const { page = 1, limit = 20, search } = query;
    const qb = this.authConfigRepository
      .createQueryBuilder('ac')
      .where('ac.workspace_id = :workspaceId', { workspaceId });

    if (search) {
      qb.andWhere('ac.name ILIKE :search', { search: `%${search}%` });
    }
    qb.orderBy('ac.created_at', 'DESC');

    const totalItems = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // 목록 응답은 secret 류 필드를 마스킹 (평문 노출은 create/regenerate/reveal 만).
    const masked = data.map((ac) => this.toMasked(ac));
    return PaginatedResponseDto.create(masked, totalItems, page, limit);
  }

  /** 내부 전용 — 평문 config 를 그대로 반환. verify / reveal / update / regenerate / usage 가 사용. */
  async findById(id: string, workspaceId: string): Promise<AuthConfig> {
    const config = await this.authConfigRepository.findOne({
      where: { id, workspaceId },
    });
    if (!config) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Auth config not found',
      });
    }
    return config;
  }

  /** 외부 응답용 — secret 류 필드를 마스킹한 복제본. */
  async findByIdForResponse(
    id: string,
    workspaceId: string,
  ): Promise<AuthConfig> {
    return this.toMasked(await this.findById(id, workspaceId));
  }

  async create(
    workspaceId: string,
    data: Partial<AuthConfig>,
  ): Promise<AuthConfig> {
    const config: Record<string, unknown> =
      (data.config as Record<string, unknown>) || {};

    // type 별 비밀값은 항상 제품이 자동 발급 — 사용자 입력 비밀값은 받지 않는다
    // (spec/1-data-model.md §2.17.1 / §2.17.3: "사용자 입력 옵션 제거, 자동 발급 강제").
    // hmac 의 header/algorithm 은 검증 메타라 사용자 입력을 보존하지만 secret 은 강제 발급.
    if (data.type === 'api_key') {
      config.key = `wfk_${randomBytes(24).toString('hex')}`;
    }
    if (data.type === 'bearer_token') {
      config.token = `wft_${randomBytes(32).toString('hex')}`;
    }
    if (data.type === 'hmac') {
      config.secret = `whs_${randomBytes(32).toString('hex')}`;
      if (!config.header) config.header = 'X-Hub-Signature-256';
      if (!config.algorithm) config.algorithm = 'sha256';
    }
    // basic_auth 는 username/password 사용자 입력 — 자동 발급 없음.

    const authConfig = this.authConfigRepository.create({
      ...data,
      config,
      workspaceId,
    });
    return this.authConfigRepository.save(authConfig);
  }

  async update(
    id: string,
    workspaceId: string,
    data: Partial<AuthConfig>,
  ): Promise<AuthConfig> {
    const config = await this.findById(id, workspaceId);
    Object.assign(config, data);
    const saved = await this.authConfigRepository.save(config);
    return this.toMasked(saved);
  }

  async regenerate(id: string, workspaceId: string): Promise<AuthConfig> {
    const config = await this.findById(id, workspaceId);
    const configData = config.config || {};

    if (config.type === 'api_key') {
      configData.key = `wfk_${randomBytes(24).toString('hex')}`;
    } else if (config.type === 'bearer_token') {
      configData.token = `wft_${randomBytes(32).toString('hex')}`;
    } else if (config.type === 'hmac') {
      // secret 만 교체 — header/algorithm 은 보존.
      configData.secret = `whs_${randomBytes(32).toString('hex')}`;
    }
    config.config = configData;
    // 재발급 응답은 신규 값을 1회 평문 노출.
    return this.authConfigRepository.save(config);
  }

  async remove(id: string, workspaceId: string): Promise<void> {
    const config = await this.findById(id, workspaceId);
    await this.authConfigRepository.remove(config);
  }

  /**
   * 평문 config 1회 노출. 현재 로그인 사용자의 비밀번호를 재확인하고 audit_log 에
   * 기록한다 (spec/2-navigation/6-config.md §A.4). 권한 게이트(Admin+)는 controller.
   */
  async reveal(
    id: string,
    workspaceId: string,
    userId: string,
    password: string,
    ipAddress?: string,
  ): Promise<{ config: Record<string, unknown> }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    // OAuth 단독 가입 사용자는 passwordHash 가 NULL — 비밀번호 재확인 불가.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Password confirmation required',
      });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Password confirmation failed',
      });
    }
    const config = await this.findById(id, workspaceId);
    await this.auditLogsService.record({
      workspaceId,
      userId,
      action: 'auth_config.reveal',
      resourceType: 'auth_config',
      resourceId: id,
      ipAddress,
    });
    return { config: config.config };
  }

  /**
   * Webhook 수신 시 인증 검증의 단일 진입 (spec/5-system/12-webhook.md §7 step 6).
   * authConfigId 로 AuthConfig 를 조회해 is_active / ip_whitelist / type 별 검증을
   * 수행하고, 성공 시 last_used_at 을 fire-and-forget 으로 갱신한다.
   * 실패는 type 무관 단일 401 AUTH_FAILED (enumeration·information leakage 차단).
   */
  async verifyWebhookRequest(
    authConfigId: string,
    workspaceId: string,
    ctx: WebhookAuthContext,
  ): Promise<void> {
    const ac = await this.authConfigRepository.findOne({
      where: { id: authConfigId, workspaceId },
    });
    if (!ac || !ac.isActive) {
      throw this.authFailed();
    }

    // ip_whitelist — 단일 IP 와 CIDR 표기(예: 10.0.0.0/8, 2001:db8::/32)를 모두 지원
    // (단일 IP 는 /32·/128 호스트로 취급). ip_whitelist 가 설정되면 클라이언트 IP 를 알 수
    // 없는 경우(헤더 strip·직접 연결)에도 거부한다 — 화이트리스트가 silent bypass 되지 않도록
    // (fail-closed). ip_whitelist 는 AuthConfig 종속이라 여기서만 시행.
    if (ac.ipWhitelist?.length) {
      if (!ctx.clientIp || !this.ipInWhitelist(ctx.clientIp, ac.ipWhitelist)) {
        throw this.authFailed();
      }
    }

    switch (ac.type) {
      case 'bearer_token':
        this.verifyBearer(ac, ctx);
        break;
      case 'api_key':
        this.verifyApiKey(ac, ctx);
        break;
      case 'basic_auth':
        this.verifyBasicAuth(ac, ctx);
        break;
      case 'hmac':
        this.verifyHmac(ac, ctx);
        break;
      default:
        throw this.authFailed();
    }

    // 성공 시에만 last_used_at 갱신 (실패 시 미갱신 — 활성 가시성 차단).
    // fire-and-forget: 트랜잭션 외, 실패해도 인증 결과에 영향 없음.
    void this.authConfigRepository
      .update({ id: ac.id }, { lastUsedAt: new Date() })
      .catch(() => undefined);
  }

  /**
   * clientIp 가 ip_whitelist 의 한 항목에 속하는지 검사. 각 항목은 단일 IP
   * (예: 10.0.0.1) 또는 CIDR (예: 10.0.0.0/8, 2001:db8::/32) — 단일 IP 는
   * /32(v4)·/128(v6) 호스트로 취급된다. clientIp 또는 항목이 파싱 불가하면
   * 매칭에서 제외(fail-closed). 서로 다른 주소 패밀리(v4 vs v6)는 교차 매칭하지
   * 않는다. dual-stack 소켓의 IPv4-mapped IPv6 (::ffff:1.2.3.4) 는 IPv4 로
   * 정규화해 v4 항목과 비교한다.
   */
  private ipInWhitelist(clientIp: string, whitelist: string[]): boolean {
    const client = this.parseIp(clientIp);
    if (!client) return false;
    return whitelist.some((entry) => {
      const range = this.parseIp(entry);
      if (!range || range.isV4 !== client.isV4) return false;
      try {
        return client.addr.isInSubnet(range.addr as never);
      } catch {
        return false;
      }
    });
  }

  /**
   * IP 문자열(단일 또는 CIDR)을 ip-address 객체로 파싱. IPv4-mapped IPv6 는
   * IPv4 로 정규화한다. 파싱 불가 시 null.
   */
  private parseIp(
    value: string,
  ): { addr: Address4 | Address6; isV4: boolean } | null {
    if (Address4.isValid(value)) {
      try {
        return { addr: new Address4(value), isV4: true };
      } catch {
        return null;
      }
    }
    if (Address6.isValid(value)) {
      try {
        const a6 = new Address6(value);
        if (a6.is4()) {
          return { addr: a6.to4(), isV4: true };
        }
        return { addr: a6, isV4: false };
      } catch {
        return null;
      }
    }
    return null;
  }

  private verifyBearer(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const authHeader = ctx.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const expected = (ac.config.token as string) ?? '';
    if (!token || !expected || !this.constantTimeEquals(token, expected)) {
      throw this.authFailed();
    }
  }

  private verifyApiKey(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const headerName = (
      (ac.config.headerName as string) ?? 'X-API-Key'
    ).toLowerCase();
    const provided = ctx.headers[headerName] ?? '';
    const expected = (ac.config.key as string) ?? '';
    if (
      !provided ||
      !expected ||
      !this.constantTimeEquals(provided, expected)
    ) {
      throw this.authFailed();
    }
  }

  private verifyBasicAuth(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const authHeader = ctx.headers['authorization'] ?? '';
    if (!authHeader.startsWith('Basic ')) {
      throw this.authFailed();
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    const username = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const passwd = idx >= 0 ? decoded.slice(idx + 1) : '';
    const expectedUser = (ac.config.username as string) ?? '';
    const expectedPass = (ac.config.password as string) ?? '';
    const userOk = this.constantTimeEquals(username, expectedUser);
    const passOk = this.constantTimeEquals(passwd, expectedPass);
    if (!userOk || !passOk) {
      throw this.authFailed();
    }
  }

  private verifyHmac(ac: AuthConfig, ctx: WebhookAuthContext): void {
    const headerName = (
      (ac.config.header as string) ?? 'X-Hub-Signature-256'
    ).toLowerCase();
    const algorithm = (ac.config.algorithm as string) ?? 'sha256';
    if (!HMAC_ALLOWED_ALGORITHMS.has(algorithm)) {
      throw this.authFailed();
    }
    const signature = ctx.headers[headerName] ?? '';
    const secret = (ac.config.secret as string) ?? '';
    if (!signature || !ctx.rawBody) {
      throw this.authFailed();
    }
    const expected = `${algorithm}=${crypto
      .createHmac(algorithm, secret)
      .update(ctx.rawBody)
      .digest('hex')}`;
    if (!this.constantTimeEquals(signature, expected)) {
      throw this.authFailed();
    }
  }

  private authFailed(): UnauthorizedException {
    return new UnauthorizedException({
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
    });
  }

  /**
   * 길이가 다르면 즉시 false. timingSafeEqual 은 길이가 다르면 RangeError 를 던지므로
   * 사전 길이 비교가 없으면 외부 입력으로 요청 단위 DoS 가 가능하다.
   */
  private constantTimeEquals(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  }

  private toMasked(ac: AuthConfig): AuthConfig {
    return { ...ac, config: this.maskConfig(ac.config) };
  }

  private maskConfig(config: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config ?? {})) {
      if (SECRET_CONFIG_KEYS.has(k) && typeof v === 'string') {
        out[k] = v.length >= 4 ? `***${v.slice(-4)}` : '***';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  async getUsage(
    id: string,
    workspaceId: string,
  ): Promise<{
    totalCalls: number;
    lastUsedAt: Date | null;
    recentCalls: Array<{
      id: string;
      triggerName: string;
      status: string;
      startedAt: Date;
    }>;
  }> {
    const config = await this.findById(id, workspaceId);

    const triggers = await this.triggerRepository.find({
      where: { authConfigId: id },
    });
    const triggerIds = triggers.map((t) => t.id);

    if (triggerIds.length === 0) {
      return {
        totalCalls: 0,
        lastUsedAt: config.lastUsedAt,
        recentCalls: [],
      };
    }

    const totalCalls = await this.executionRepository
      .createQueryBuilder('e')
      .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
      .getCount();

    const recentExecutions = await this.executionRepository
      .createQueryBuilder('e')
      .innerJoinAndSelect('e.trigger', 't')
      .where('e.trigger_id IN (:...triggerIds)', { triggerIds })
      .orderBy('e.started_at', 'DESC')
      .limit(20)
      .getMany();

    return {
      totalCalls,
      lastUsedAt: config.lastUsedAt,
      recentCalls: recentExecutions.map((e) => ({
        id: e.id,
        triggerName: e.trigger?.name ?? 'Unknown',
        status: e.status,
        startedAt: e.startedAt,
      })),
    };
  }
}
