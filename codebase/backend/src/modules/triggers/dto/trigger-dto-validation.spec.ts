import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTriggerDto } from './create-trigger.dto';
import { UpdateTriggerDto } from './update-trigger.dto';
import { WebChatAppearanceDto } from './web-chat-appearance.dto';
import { QueryTriggerDto } from './query-trigger.dto';
import { CustomValidationPipe } from '../../../common/pipes/validation.pipe';
import { ArgumentMetadata, BadRequestException } from '@nestjs/common';
import {
  CHAT_CHANNEL_BLOCKED_FIELDS,
  CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES,
} from '../chat-channel-rejection-messages.const';

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

    // 근본 fix (control-plane per-provider escape 이관) — 발송 시 어댑터가 escape 하므로
    // operator 는 languageHints 를 **평문**으로 넣으면 된다. 종전 F-5 의 telegram MarkdownV2
    // 등록 시점 거부(UNSAFE_TELEGRAM_MARKDOWN)는 제거됐다: 평문 마침표 override 도 통과한다.
    it('통과 — telegram + control-plane 키 평문 override(마침표 포함) 수용 (F-5 검증 제거)', async () => {
      const dto = plainToInstance(CreateTriggerDto, {
        ...baseCreate,
        chatChannel: {
          provider: 'telegram',
          botToken: '111:fake',
          languageHints: {
            surfaceMismatch: '받을 수 없어요.',
            executionStillRunning: '처리 중입니다. 잠시만 기다려 주세요.',
          },
        },
      });
      const errors = await validate(dto, VALIDATE_OPTIONS);
      expect(errors.find((e) => e.property === 'chatChannel')).toBeUndefined();
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

/**
 * PATCH 전용 `chatChannel` DTO — D-1.
 *
 * 여기서는 `validate()` 를 직접 부르지 않고 **전역 `CustomValidationPipe` 를 통과시킨다.**
 * 그래야 `details.field` 가 실제로 어떤 경로 문자열로 나가는지 볼 수 있다 — 그것이
 * `spec-draft-nullable-notation-followups.md` 의 미해결 질문이었다(*"§5.4.1 문면이 flat
 * `botTokenRef` 라고 적는데 파이프는 중첩 경로를 만들지 않는가"*).
 */
describe('ChatChannelUpdateConfigDto — PATCH 는 비밀을 받지 않는다 (R-CC-21 / D-1)', () => {
  const pipe = new CustomValidationPipe();
  const meta = {
    type: 'body',
    metatype: UpdateTriggerDto,
  } as unknown as ArgumentMetadata;

  const run = async (chatChannel: Record<string, unknown>) => {
    try {
      await pipe.transform({ chatChannel }, meta);
      return null;
    } catch (err) {
      return (err as BadRequestException).getResponse() as {
        code: string;
        details: { field: string; message: string }[];
      };
    }
  };

  /** `ChatChannelCard` 가 실제로 보내는 바디 — 이것이 **통과해야** 두 CRITICAL 이 닫힌다. */
  const cardBody = (provider: string) => ({
    provider,
    uiMapping: { formMode: 'multi_step', visualNode: 'auto' },
    rateLimitPerMinute: 30,
    languageLocale: 'ko',
  });

  it.each(['telegram', 'slack', 'discord'])(
    '%s — 카드 편집 바디가 통과한다 (종전에는 세 provider 모두 400 이었다)',
    async (provider) => {
      expect(await run(cardBody(provider))).toBeNull();
    },
  );

  it('botToken 이 실리면 거부한다', async () => {
    const res = await run({ ...cardBody('telegram'), botToken: '111:New' });
    expect(res?.code).toBe('VALIDATION_ERROR');
    expect(res?.details.map((d) => d.field)).toContain('chatChannel.botToken');
  });

  it('inboundSigningPlaintext 가 실리면 거부한다 — slack 도 예외가 아니다', async () => {
    const res = await run({
      ...cardBody('slack'),
      inboundSigningPlaintext: 'a'.repeat(32),
    });
    expect(res?.code).toBe('VALIDATION_ERROR');
    expect(res?.details.map((d) => d.field)).toContain(
      'chatChannel.inboundSigningPlaintext',
    );
  });

  /**
   * **`null`/`''` 는 DTO 를 통과한다** — `@IsEmpty()` 가 그 둘을 유효로 보기 때문이다.
   * 그래서 같은 논리적 위반이 **값의 형태에 따라 다른 레이어에서 거부**되고, `details.field`
   * 표현도 갈린다. 위 `[실측]` 케이스는 비어있지 않은 값만 써서 **한 갈래만 쟀다** —
   * 그 결과를 "전부 중첩 경로" 로 일반화한 것이 과했다(`/ai-review` `23_55_23` requirement W).
   */
  it('[실측] 값이 null/빈 문자열이면 DTO 를 통과한다 — 거부는 서비스 층이다', async () => {
    expect(await run({ ...cardBody('telegram'), botToken: null })).toBeNull();
    expect(await run({ ...cardBody('telegram'), botToken: '' })).toBeNull();
    expect(
      await run({ ...cardBody('slack'), inboundSigningPlaintext: null }),
    ).toBeNull();
    expect(
      await run({ ...cardBody('slack'), inboundSigningPlaintext: '' }),
    ).toBeNull();
  });

  /**
   * **`details.field` 실측 — 다섯 필드 전부.**
   *
   * 결론: 전역 파이프의 `flattenErrors` 는 **중첩 경로**(`chatChannel.<field>`)를 만든다.
   * **단 이 결론은 「비어있지 않은 값」 갈래에 한정된다** — `null`/`''` 는 `@IsEmpty()` 를
   * 통과해 서비스 층에서 **flat** 이름으로 거부된다(바로 위 케이스가 그것을 고정한다).
   * `3-error-handling.md §2.1` 의 *"중첩/배열 경로를 유지한다"* 규약을 **구현이 지키고 있고**,
   * flat 이름(`details.field='botTokenRef'`)을 적은 **spec 문면 쪽이 낡았다.**
   *
   * 이 단언이 그 실측의 정본이다 — 후속 planner 턴이 §5.4.1·§5.4.1.1 의 표기를 고칠 때
   * 여기 값을 근거로 쓴다. 서비스 층 가드(`assertChatChannelInputSafe`)는 **flat** 이름을
   * 쓰지만, 전역 파이프가 먼저 거부하므로 HTTP 응답에 나가는 것은 아래 중첩 경로다.
   */
  it('[실측] 차단 5필드의 details.field 는 **비어있지 않은 값일 때** 중첩 경로다', async () => {
    const observed: Record<string, string[]> = {};
    for (const field of [
      'botToken',
      'inboundSigningPlaintext',
      'botTokenRef',
      'inboundSigningRef',
      'inboundSigning',
    ]) {
      const res = await run({
        ...cardBody('telegram'),
        [field]: 'x'.repeat(40),
      });
      observed[field] = (res?.details ?? []).map((d) => d.field);
    }
    expect(observed).toEqual({
      botToken: ['chatChannel.botToken'],
      inboundSigningPlaintext: ['chatChannel.inboundSigningPlaintext'],
      botTokenRef: ['chatChannel.botTokenRef'],
      inboundSigningRef: ['chatChannel.inboundSigningRef'],
      inboundSigning: ['chatChannel.inboundSigning'],
    });
  });

  /**
   * **생성 경로는 안 건드렸다.** `CreateTriggerDto` 는 여전히 `botToken` 을 필수로 요구한다 —
   * D-1 을 공유 DTO 에 넣었으면 여기가 깨졌을 자리다(R-CC-21 「구현 시」 경고).
   */
  it('CreateTriggerDto 는 여전히 botToken 을 요구한다 (생성 경로 무회귀)', async () => {
    const createMeta = {
      type: 'body',
      metatype: CreateTriggerDto,
    } as unknown as ArgumentMetadata;
    let thrown: unknown = null;
    try {
      await pipe.transform(
        {
          workflowId: VALID_UUID,
          type: 'webhook',
          name: 'T',
          chatChannel: cardBody('telegram'),
        },
        createMeta,
      );
    } catch (err) {
      thrown = (err as BadRequestException).getResponse();
    }
    expect(
      (thrown as { details?: { field: string }[] } | null)?.details?.map(
        (d) => d.field,
      ),
    ).toContain('chatChannel.botToken');
  });

  /**
   * **[등가성] 파이프 층의 `message` 는 공유 상수와 바이트 동일하다 (D).**
   *
   * 이 5필드는 **두 층**에서 거부되고 어느 층이 잡느냐는 사용자가 보낸 값의 형태로 갈린다
   * (비어있지 않은 값 → 파이프 / `null`·`''` → 서비스 가드, 위 두 `[실측]` 케이스가 고정).
   * 두 층의 문면이 갈리면 **같은 거부에 두 가지 설명**이 되므로, 양쪽을 하나의 상수에 묶었다.
   * 이 단언이 파이프 쪽 절반이고, `triggers.service.spec.ts` 의 자매 단언이 서비스 쪽 절반이다
   * — 둘이 같은 상수를 가리키므로 등가성이 전이적으로 고정된다.
   *
   * **리터럴을 복사해 적지 않는다** — 그러면 상수를 고쳐도 이 테스트가 통과해 버린다.
   */
  it('[등가성] 차단 5필드의 message 는 공유 상수에서 온다 (D)', async () => {
    const observed: Record<string, string | undefined> = {};
    for (const field of CHAT_CHANNEL_BLOCKED_FIELDS) {
      const res = await run({
        ...cardBody('telegram'),
        [field]: 'x'.repeat(40),
      });
      // 「정확히 이 필드 하나만 거부됐다」를 명시한다 — 길이를 안 보면 `[0]` 만 맞고
      // 다른 필드가 함께 터져도 통과한다(`/ai-review` `11_05_27` testing INFO 3).
      expect(res?.details).toHaveLength(1);
      observed[field] = res?.details?.[0]?.message;
    }
    expect(observed).toEqual({ ...CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES });
  });

  /**
   * **[A] 파이프가 내는 `details[]` 원소는 `code: 'INVALID_FIELD'` 를 싣는다.**
   *
   * 이 층은 원래부터 싣고 있었다(`flattenErrors`) — 이 단언은 **회귀 캐너리**다. 같은 PR 이
   * 서비스 가드 쪽에 `code` 를 새로 배선했으므로, 두 층이 이제 같은 키 집합을 낸다는 것이
   * 규약(`2-api-convention.md` §5.3 「`field` 를 실으면 `code` 도 싣는다」)의 요구다.
   */
  it('[A] 파이프 details 원소는 field·message·code 세 키를 모두 싣는다', async () => {
    const res = await run({ ...cardBody('telegram'), botToken: '111:New' });
    expect(res?.details?.[0]).toEqual({
      field: 'chatChannel.botToken',
      message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botToken,
      code: 'INVALID_FIELD',
    });
  });

  /**
   * **[C] 생성 경로의 `botToken: ''` 는 거부된다.**
   *
   * 종전에는 통과했다 — `@ApiProperty` 가 `minLength: 1` 을 광고하는데 검증 체인에는
   * `@MinLength` 이 없었다(**선언이 구현보다 넓었다**). 통과하면 `setupChatChannel` 의
   * `[쓰기 ①]` 이 `SecretResolver.rotate(botTokenRef, ws, '')` 로 **빈 시크릿을 먼저 저장**하고,
   * provider 호출 실패(401 → `BOT_TOKEN_INVALID`)는 그 **뒤**다 — 요청은 실패하는데 시크릿
   * 행은 남는다.
   *
   * **PATCH 경로는 반대로 `''` 를 통과시켜야 한다** — `ChatChannelUpdateConfigDto` 가
   * `OmitType` 으로 부모 데코레이터를 떼고 `@IsEmpty()` 를 새로 선언하기 때문이다. 위
   * *"값이 null/빈 문자열이면 DTO 를 통과한다"* 케이스가 그 방향의 캐너리이므로, 만약
   * `@MinLength(1)` 이 `OmitType` 을 넘어 새면 그 테스트가 RED 가 된다.
   *
   * **공백 전용 문자열(`'   '`)은 이 가드가 막지 못한다** — `@MinLength(1)` 은 길이만 본다.
   * 그 경계는 이 PR 이 의도적으로 스코프 아웃했다(trim 정책은 별개 결정). *"빈 문자열 문제가
   * 전부 닫혔다"* 로 읽지 말 것.
   */
  it('[C] CreateTriggerDto 는 botToken 빈 문자열을 거부한다', async () => {
    const createMeta = {
      type: 'body',
      metatype: CreateTriggerDto,
    } as unknown as ArgumentMetadata;
    let thrown: unknown = null;
    try {
      await pipe.transform(
        {
          workflowId: VALID_UUID,
          type: 'webhook',
          name: 'T',
          chatChannel: { ...cardBody('telegram'), botToken: '' },
        },
        createMeta,
      );
    } catch (err) {
      thrown = (err as BadRequestException).getResponse();
    }
    expect(
      (thrown as { details?: { field: string }[] } | null)?.details?.map(
        (d) => d.field,
      ),
    ).toContain('chatChannel.botToken');
  });
});
