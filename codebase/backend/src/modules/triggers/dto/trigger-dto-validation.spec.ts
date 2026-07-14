import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTriggerDto } from './create-trigger.dto';
import { UpdateTriggerDto } from './update-trigger.dto';
import { WebChatAppearanceDto } from './web-chat-appearance.dto';
import { QueryTriggerDto } from './query-trigger.dto';

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

// W1 (보안) — endpoint_path 는 라우팅 키가 전역이라 추측 불가한 v4 UUID 여야 한다.
// 서버가 형식을 강제해 예측 가능 값 직접 지정(squatting/enumeration)을 차단한다.
describe('endpointPath — v4 UUID 강제 (W1 보안)', () => {
  it('통과 — 유효한 v4 UUID', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      endpointPath: VALID_UUID,
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeUndefined();
  });

  it('통과 — endpointPath 미설정 (옵셔널)', async () => {
    const dto = plainToInstance(CreateTriggerDto, baseCreate);
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeUndefined();
  });

  it('실패 — 예측 가능한 비-UUID 경로 (squatting 방지)', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      endpointPath: 'my-integration',
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeDefined();
  });

  it('실패 — 경로형 문자열 (/hooks/custom)', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      endpointPath: '/hooks/custom',
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeDefined();
  });

  it('실패 — v1 UUID (시간 기반·추측 가능 — v4 만 허용)', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      // version nibble(3번째 그룹 첫 char) = 1 → v1
      endpointPath: '550e8400-e29b-11d4-a716-446655440000',
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeDefined();
  });

  it('실패 — v5 UUID (name 기반 — v4 만 허용, WH-MG-02)', async () => {
    const dto = plainToInstance(CreateTriggerDto, {
      ...baseCreate,
      // version nibble(3번째 그룹 첫 char) = 5 → v5. @IsUUID('4') 는 v5 도 거부한다.
      endpointPath: '550e8400-e29b-51d4-a716-446655440000',
    });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeDefined();
  });

  it('UpdateTriggerDto — 비-UUID endpointPath 도 형식 거부', async () => {
    const dto = plainToInstance(UpdateTriggerDto, { endpointPath: 'webhook' });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeDefined();
  });

  it('UpdateTriggerDto — 유효한 v4 UUID 통과 (데코레이터 실효 회귀 가드)', async () => {
    const dto = plainToInstance(UpdateTriggerDto, { endpointPath: VALID_UUID });
    const errors = await validate(dto, VALIDATE_OPTIONS);
    expect(errors.find((e) => e.property === 'endpointPath')).toBeUndefined();
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

    // SUMMARY#10 — native_modal / auto 신규 enum 값 검증 (testing review)
    it('통과 — uiMapping.formMode = native_modal', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          uiMapping: { formMode: 'native_modal' },
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors).toEqual([]);
    });

    it('통과 — uiMapping.formMode = auto', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          uiMapping: { formMode: 'auto' },
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors).toEqual([]);
    });

    it('실패 — uiMapping.formMode = invalid_mode', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          uiMapping: { formMode: 'invalid_mode' },
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeDefined();
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

    // F-5 — telegram control-plane raw-send 키의 MarkdownV2-safety 등록 시점 검증.
    describe('raw-send 키 MarkdownV2-safety (F-5, telegram 한정)', () => {
      it('실패 — telegram + surfaceMismatch override 에 unescaped 특수문자(.) → UNSAFE_TELEGRAM_MARKDOWN', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: { surfaceMismatch: '받을 수 없어요.' },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        const chatChannelError = errors.find(
          (e) => e.property === 'chatChannel',
        );
        expect(chatChannelError).toBeDefined();
        const serialized = JSON.stringify(chatChannelError);
        expect(serialized).toContain('UNSAFE_TELEGRAM_MARKDOWN');
        expect(serialized).toContain('surfaceMismatch');
      });

      it('통과 — telegram + escaped 특수문자(\\.) 는 허용', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: { executionStillRunning: '처리 중입니다\\.' },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(errors.find((e) => e.property === 'chatChannel')).toBeUndefined();
      });

      it('통과 — telegram + 특수문자 없는 override', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: { surfaceMismatch: '양식이나 버튼을 사용해 주세요' },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(errors.find((e) => e.property === 'chatChannel')).toBeUndefined();
      });

      it('통과 — slack 은 검증 대상 아님 (unescaped . 허용)', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-fake',
            languageHints: { surfaceMismatch: '받을 수 없어요.' },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(errors.find((e) => e.property === 'chatChannel')).toBeUndefined();
      });

      it('통과 — telegram + 비-raw-send 키(sessionExpired, 렌더러 escape 경로)는 . 허용', async () => {
        const dto = plainToInstance(CreateTriggerDto, {
          ...baseCreate,
          chatChannel: {
            provider: 'telegram',
            botToken: '111:fake',
            languageHints: { sessionExpired: '세션이 만료되었습니다.' },
          },
        });
        const errors = await validate(dto, VALIDATE_OPTIONS);
        expect(errors.find((e) => e.property === 'chatChannel')).toBeUndefined();
      });
    });
  });
});

// SUMMARY#4 — WebChatAppearanceDto 필드 유효성 검증 단위 테스트
describe('WebChatAppearanceDto — 필드 검증 (SUMMARY#4)', () => {
  const VALIDATE_OPTS = { whitelist: true, forbidNonWhitelisted: true };

  it('통과 — 모든 필드 유효값', async () => {
    const dto = plainToInstance(WebChatAppearanceDto, {
      locale: 'ko',
      primaryColor: '#5B4FE9',
      position: 'bottom-right',
      headerTitle: '봇',
      welcomeText: '안녕하세요',
      suggestions: '질문1\n질문2',
      disclaimer: 'AI 답변은 부정확할 수 있어요.',
    });
    const errors = await validate(dto, VALIDATE_OPTS);
    expect(errors).toEqual([]);
  });

  it('통과 — 모든 필드 미설정 (전부 optional)', async () => {
    const dto = plainToInstance(WebChatAppearanceDto, {});
    const errors = await validate(dto, VALIDATE_OPTS);
    expect(errors).toEqual([]);
  });

  describe('primaryColor — #RRGGBB 패턴', () => {
    it('통과 — #aabbcc (소문자 hex)', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        primaryColor: '#aabbcc',
      });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('통과 — #AABBCC (대문자 hex)', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        primaryColor: '#AABBCC',
      });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('실패 — # 없는 hex', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        primaryColor: 'AABBCC',
      });
      const errors = await validate(dto, VALIDATE_OPTS);
      expect(errors.find((e) => e.property === 'primaryColor')).toBeDefined();
    });

    it('실패 — 3자리 단축 hex (#abc)', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        primaryColor: '#abc',
      });
      const errors = await validate(dto, VALIDATE_OPTS);
      expect(errors.find((e) => e.property === 'primaryColor')).toBeDefined();
    });

    it('실패 — rgba 값 (패턴 외)', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        primaryColor: 'rgba(0,0,0,1)',
      });
      const errors = await validate(dto, VALIDATE_OPTS);
      expect(errors.find((e) => e.property === 'primaryColor')).toBeDefined();
    });
  });

  describe('headerTitle — MaxLength(80)', () => {
    it('통과 — 80자', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        headerTitle: 'a'.repeat(80),
      });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('실패 — 81자 초과', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        headerTitle: 'a'.repeat(81),
      });
      const errors = await validate(dto, VALIDATE_OPTS);
      expect(errors.find((e) => e.property === 'headerTitle')).toBeDefined();
    });
  });

  describe('locale — IsIn([ko, en])', () => {
    it('통과 — ko', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, { locale: 'ko' });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('통과 — en', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, { locale: 'en' });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('실패 — fr (화이트리스트 외)', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, { locale: 'fr' });
      const errors = await validate(dto, VALIDATE_OPTS);
      expect(errors.find((e) => e.property === 'locale')).toBeDefined();
    });
  });

  describe('position — IsIn([bottom-right, bottom-left])', () => {
    it('통과 — bottom-right', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        position: 'bottom-right',
      });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('통과 — bottom-left', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        position: 'bottom-left',
      });
      expect(await validate(dto, VALIDATE_OPTS)).toEqual([]);
    });

    it('실패 — top-right (화이트리스트 외)', async () => {
      const dto = plainToInstance(WebChatAppearanceDto, {
        position: 'top-right',
      });
      const errors = await validate(dto, VALIDATE_OPTS);
      expect(errors.find((e) => e.property === 'position')).toBeDefined();
    });
  });
});

// SUMMARY#5 — QueryTriggerDto.interactionEnabled Transform 경계값 테스트
describe('QueryTriggerDto — interactionEnabled Transform (SUMMARY#5)', () => {
  it("'true' → true (boolean)", () => {
    const dto = plainToInstance(QueryTriggerDto, {
      interactionEnabled: 'true',
    });
    expect(dto.interactionEnabled).toBe(true);
  });

  it("'false' → false (boolean)", () => {
    const dto = plainToInstance(QueryTriggerDto, {
      interactionEnabled: 'false',
    });
    expect(dto.interactionEnabled).toBe(false);
  });

  it('true (boolean) → true (그대로)', () => {
    const dto = plainToInstance(QueryTriggerDto, { interactionEnabled: true });
    expect(dto.interactionEnabled).toBe(true);
  });

  it('undefined → undefined (미설정)', () => {
    const dto = plainToInstance(QueryTriggerDto, {});
    expect(dto.interactionEnabled).toBeUndefined();
  });

  it("'1' → false ('1' !== 'true' 이므로 false)", () => {
    // Transform: value === true || value === 'true' — '1' 은 해당 안 되어 false
    const dto = plainToInstance(QueryTriggerDto, { interactionEnabled: '1' });
    expect(dto.interactionEnabled).toBe(false);
  });

  it("validate 통과 — 'true' 문자열 입력 후 boolean 검증", async () => {
    const dto = plainToInstance(QueryTriggerDto, {
      interactionEnabled: 'true',
    });
    const errors = await validate(dto, { whitelist: true });
    expect(
      errors.find((e) => e.property === 'interactionEnabled'),
    ).toBeUndefined();
  });

  it('validate 통과 — undefined (옵셔널)', async () => {
    const dto = plainToInstance(QueryTriggerDto, {});
    const errors = await validate(dto, { whitelist: true });
    expect(
      errors.find((e) => e.property === 'interactionEnabled'),
    ).toBeUndefined();
  });
});
