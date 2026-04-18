import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;
  let mailerService: jest.Mocked<MailerService>;

  const createService = async (
    overrides: Record<string, unknown> = {},
  ): Promise<{
    service: MailService;
    mailerService: jest.Mocked<MailerService>;
  }> => {
    const config: Record<string, unknown> = {
      'app.frontendUrl': 'http://localhost:3000',
      'mail.transport': 'smtp',
      ...overrides,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: MailerService,
          useValue: {
            sendMail: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    return {
      service: module.get<MailService>(MailService),
      mailerService: module.get(MailerService),
    };
  };

  beforeEach(async () => {
    const result = await createService();
    service = result.service;
    mailerService = result.mailerService;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct parameters', async () => {
      await service.sendVerificationEmail(
        'test@example.com',
        'Test User',
        'verify-token-123',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Idea Workflow - 이메일 인증',
        }),
      );

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'http://localhost:3000/verify-email?token=verify-token-123',
      );
      expect(callArgs.html).toContain('Test User');
      expect(callArgs.text).toContain(
        'http://localhost:3000/verify-email?token=verify-token-123',
      );
      expect(callArgs.text).toContain('Test User');
    });

    it('should HTML-escape name to prevent XSS', async () => {
      await service.sendVerificationEmail(
        'test@example.com',
        '<script>alert("xss")</script>',
        'token',
      );

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).not.toContain('<script>');
      expect(callArgs.html).toContain('&lt;script&gt;');
    });

    it('should URL-encode token in verification link', async () => {
      await service.sendVerificationEmail(
        'test@example.com',
        'User',
        'token with spaces&special=chars',
      );

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'token=token%20with%20spaces%26special%3Dchars',
      );
    });

    it('should throw when mailer fails', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendVerificationEmail('test@example.com', 'Test User', 'token'),
      ).rejects.toThrow('SMTP error');
    });

    it('should still call mailer when transport is console', async () => {
      const result = await createService({ 'mail.transport': 'console' });

      await result.service.sendVerificationEmail(
        'test@example.com',
        'Test User',
        'dev-token',
      );

      expect(result.mailerService.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct parameters', async () => {
      await service.sendPasswordResetEmail(
        'test@example.com',
        'Test User',
        'reset-token-123',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Idea Workflow - 비밀번호 재설정',
        }),
      );

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'http://localhost:3000/reset-password?token=reset-token-123',
      );
      expect(callArgs.html).toContain('Test User');
      expect(callArgs.text).toContain(
        'http://localhost:3000/reset-password?token=reset-token-123',
      );
      expect(callArgs.text).toContain('Test User');
    });

    it('should HTML-escape name to prevent XSS', async () => {
      await service.sendPasswordResetEmail(
        'test@example.com',
        '<script>alert("xss")</script>',
        'token',
      );

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).not.toContain('<script>');
      expect(callArgs.html).toContain('&lt;script&gt;');
    });

    it('should URL-encode token in reset link', async () => {
      await service.sendPasswordResetEmail(
        'test@example.com',
        'User',
        'token with spaces&special=chars',
      );

      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        'token=token%20with%20spaces%26special%3Dchars',
      );
      expect(callArgs.text).toContain(
        'token=token%20with%20spaces%26special%3Dchars',
      );
    });

    it('should throw when mailer fails', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP error'));

      await expect(
        service.sendPasswordResetEmail(
          'test@example.com',
          'Test User',
          'token',
        ),
      ).rejects.toThrow('SMTP error');
    });

    it('should still call mailer when transport is console', async () => {
      const result = await createService({ 'mail.transport': 'console' });

      await result.service.sendPasswordResetEmail(
        'test@example.com',
        'Test User',
        'dev-token',
      );

      expect(result.mailerService.sendMail).toHaveBeenCalled();
    });
  });
});
