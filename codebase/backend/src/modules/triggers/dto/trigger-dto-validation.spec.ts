import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTriggerDto } from './create-trigger.dto';
import { UpdateTriggerDto } from './update-trigger.dto';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALIDATE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true };

const baseCreate = {
  workflowId: VALID_UUID,
  type: 'webhook',
  name: 'Test',
};

describe('CreateTriggerDto', () => {
  const baseTrigger = {
    workflowId: VALID_UUID,
    type: 'webhook',
    name: 'Test',
  };

  describe('authConfigId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: '',
      });
      expect(dto.authConfigId).toBeNull();
    });

    it('should keep valid UUID unchanged', () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: VALID_UUID,
      });
      expect(dto.authConfigId).toBe(VALID_UUID);
    });

    it('should keep null as null', () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: null,
      });
      expect(dto.authConfigId).toBeNull();
    });
  });

  describe('validation', () => {
    it('should pass when authConfigId is null after empty string transform', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: '',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      const authError = errors.find((e) => e.property === 'authConfigId');
      expect(authError).toBeUndefined();
    });

    it('should fail when authConfigId is an invalid non-empty string', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseTrigger,
        authConfigId: 'not-a-uuid',
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'authConfigId')).toBeDefined();
    });
  });
});

describe('UpdateTriggerDto', () => {
  describe('authConfigId transform', () => {
    it('should transform empty string to null', () => {
      const dto = plainToInstance(UpdateTriggerDto, { authConfigId: '' });
      expect(dto.authConfigId).toBeNull();
    });
  });

  describe('validation', () => {
    it('should pass when authConfigId is null after empty string transform', async () => {
      const dto = plainToInstance(UpdateTriggerDto, { authConfigId: '' });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.length).toBe(0);
    });
  });
});

describe('CreateTriggerDto — notification/interaction sub-DTO', () => {
  it('통과 — 유효한 notification + interaction 전체 필드', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed', 'execution.failed'],
        signing: { algorithm: 'hmac-sha256' },
        retry: { maxAttempts: 3, backoff: 'exponential' },
      },
      interaction: { enabled: true, tokenStrategy: 'per_execution' },
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors).toEqual([]);
  });

  it('실패 — notification.events 에 잘못된 type', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed', 'execution.bogus_event'],
      },
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    const target = errors.find((e) => e.property === 'notification');
    expect(target).toBeDefined();
  });

  it('실패 — notification.signing.algorithm 화이트리스트 외', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed'],
        signing: { algorithm: 'sha256' }, // hmac- prefix 누락
      },
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'notification')).toBeDefined();
  });

  it('실패 — notification.retry.maxAttempts 가 10 초과', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed'],
        retry: { maxAttempts: 99 },
      },
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'notification')).toBeDefined();
  });

  it('실패 — interaction.tokenStrategy 가 화이트리스트 외', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      interaction: { tokenStrategy: 'bogus' },
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'interaction')).toBeDefined();
  });

  it('통과 — notification/interaction 둘 다 미명시 (옵셔널)', async () => {
    const dto = plainToInstance(CreateTriggerDto, baseCreate);
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors).toEqual([]);
  });

  it('통과 — forbidNonWhitelisted 모드에서도 notification/interaction 화이트리스트 통과', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed'],
      },
      interaction: { enabled: false },
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors).toEqual([]);
  });

  // [Spec providers/_overview.md §1 v1 supported: telegram / slack / discord]
  // [secret-store.md §5.5 (b) provider-issued plaintext]
  describe('chatChannel (ChatChannelConfigDto)', () => {
    const SLACK_SIGNING_SECRET = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // hex 32
    const DISCORD_PUBLIC_KEY =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'; // hex 64

    it('통과 — provider=telegram + botToken', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:TelegramBotToken',
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors).toEqual([]);
    });

    it('통과 — provider=slack + botToken + inboundSigningPlaintext (hex 32)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'slack',
          botToken: 'xoxb-fake',
          inboundSigningPlaintext: SLACK_SIGNING_SECRET,
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors).toEqual([]);
    });

    it('통과 — provider=discord + botToken + inboundSigningPlaintext (hex 64)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'discord',
          botToken: 'discord-bot',
          inboundSigningPlaintext: DISCORD_PUBLIC_KEY,
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors).toEqual([]);
    });

    it('실패 — provider enum 외 (whatsapp)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: { provider: 'whatsapp', botToken: 'fake' },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    it('실패 — botToken 누락', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: { provider: 'telegram' },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    it('실패 — inboundSigningPlaintext 가 minLength 미달 (5 chars)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'slack',
          botToken: 'xoxb-fake',
          inboundSigningPlaintext: 'short',
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    it('실패 — botTokenRef 외부 입력 (IsEmpty 가드)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          botTokenRef: 'secret://triggers/x/bot-token',
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    it('실패 — inboundSigningRef 외부 입력 (IsEmpty 가드)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          inboundSigningRef: 'secret://triggers/x/inbound-signing',
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    it('실패 — legacy inboundSigning 입력 (IsEmpty 가드, provider-issued 는 inboundSigningPlaintext 사용)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          inboundSigning: 'some-secret',
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    it('통과 — uiMapping enum 모두 valid (visualNode=auto, formMode=multi_step, buttonLayout=horizontal)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          uiMapping: {
            formMode: 'multi_step',
            visualNode: 'auto',
            buttonLayout: 'horizontal',
          },
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors).toEqual([]);
    });

    it('통과 — uiMapping.visualNode 의 legacy text_only → text 로 read-time normalize', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          uiMapping: { visualNode: 'text_only' },
        },
      });
      // class-transformer @Transform 이 read-time normalize 적용.
      expect(dto.chatChannel?.uiMapping?.visualNode).toBe('text');
    });

    it('실패 — rateLimitPerMinute 가 범위 밖 (1000 > 600 max)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          rateLimitPerMinute: 1000,
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
    });

    describe('languageLocale (CCH-ERR-01 / §4.1)', () => {
      it('통과 — languageLocale 미설정 (default ko)', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: { provider: 'telegram', botToken: '111:fake' },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(
          errors.find((e) => e.property === 'chatChannel'),
        ).toBeUndefined();
      });

      it('통과 — languageLocale=ko / en', async () => {
        for (const locale of ['ko', 'en']) {
          const dto = plainToInstance(CreateTriggerDto, {
            ...baseCreate,
            chatChannel: {
              provider: 'telegram',
              botToken: '111:fake',
              languageLocale: locale,
            },
          });
          const errors = await validate(dto, VALIDATE_OPTIONS);
          expect(
            errors.find((e) => e.property === 'chatChannel'),
          ).toBeUndefined();
        }
      });

      it('실패 — languageLocale 가 unknown 값 (fr)', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageLocale: 'fr',
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
      });
    });

    describe('languageHints CCH-ERR-* placeholder validator (R-CC-15 (c))', () => {
      it('통과 — CCH-ERR-* 키에 {statusCode} placeholder 만 사용', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: {
              executionFailedThirdParty4xx: '4xx ({statusCode})',
              executionFailedThirdParty5xx: '5xx ({statusCode})',
              executionFailedInternal: '내부 오류',
            },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(
          errors.find((e) => e.property === 'chatChannel'),
        ).toBeUndefined();
      });

      it('통과 — 기존 키 (executionCompleted 등) 는 검증 면제 — {nodeId} 같이 unknown placeholder 도 통과', async () => {
        // 기존 키들은 본 PR scope 밖 — validator 가 CCH-ERR-* 6 키만 검증
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: {
              executionCompleted: '완료 — {nodeId}', // 기존 키는 면제
            },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(
          errors.find((e) => e.property === 'chatChannel'),
        ).toBeUndefined();
      });

      it('실패 — CCH-ERR-* 키에 unknown placeholder ({nodeId}) 사용 시 reject', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: {
              executionFailedInternal: '오류 발생 in {nodeId}',
            },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        const chatChannelError = errors.find(
          (e) => e.property === 'chatChannel',
        );
        expect(chatChannelError).toBeDefined();
        // nested error message 에 UNKNOWN_PLACEHOLDER:languageHints.executionFailedInternal:{nodeId} 포함
        const serialized = JSON.stringify(chatChannelError);
        expect(serialized).toContain('UNKNOWN_PLACEHOLDER');
        expect(serialized).toContain('executionFailedInternal');
        expect(serialized).toContain('{nodeId}');
      });

      it('실패 — CCH-ERR-* 키에 {executionId} 사용 시 reject', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: {
              executionFailedTimeout: 'timeout in {executionId}',
            },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
      });
    });
  });
});
