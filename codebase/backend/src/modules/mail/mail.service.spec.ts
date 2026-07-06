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
          subject: 'Clemvion - 이메일 인증',
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
          subject: 'Clemvion - 비밀번호 재설정',
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

  // W4 — 신규 메서드 2개 테스트

  describe('sendEmailChangeVerification', () => {
    it('신규 이메일로 변경 확인 링크 발송', async () => {
      await service.sendEmailChangeVerification(
        'new@example.com',
        'Test User',
        'change-token-abc',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@example.com',
          subject: 'Clemvion - 이메일 변경 확인',
        }),
      );
      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(
        '/profile/change-email/verify?token=change-token-abc',
      );
      expect(callArgs.html).toContain('Test User');
      expect(callArgs.text).toContain('change-token-abc');
    });

    it('발송 실패 → throw (rethrow)', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP error'));
      await expect(
        service.sendEmailChangeVerification('new@example.com', 'User', 'tok'),
      ).rejects.toThrow('SMTP error');
    });

    it('CONSOLE transport — mailer 여전히 호출', async () => {
      const result = await createService({ 'mail.transport': 'console' });
      await result.service.sendEmailChangeVerification(
        'new@example.com',
        'User',
        'dev-token',
      );
      expect(result.mailerService.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendEmailChangedNotice', () => {
    it('옛 이메일로 변경 완료 통지 발송', async () => {
      await service.sendEmailChangedNotice(
        'old@example.com',
        'Test User',
        'new@example.com',
      );

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'old@example.com',
          subject: 'Clemvion - 이메일이 변경되었습니다',
        }),
      );
      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).toContain('new@example.com');
      expect(callArgs.text).toContain('new@example.com');
    });

    it('발송 실패 → throw (rethrow)', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(
        service.sendEmailChangedNotice(
          'old@example.com',
          'User',
          'new@example.com',
        ),
      ).rejects.toThrow('SMTP down');
    });

    it('XSS — 이름/신규 이메일 HTML 이스케이프', async () => {
      await service.sendEmailChangedNotice(
        'old@example.com',
        '<script>alert(1)</script>',
        'safe@example.com',
      );
      const callArgs = mailerService.sendMail.mock.calls[0][0];
      expect(callArgs.html).not.toContain('<script>');
      expect(callArgs.html).toContain('&lt;script&gt;');
    });
  });

  describe('sendNotificationEmail', () => {
    it('subject=title, to=email, 알림 페이지 CTA 링크 포함', async () => {
      await service.sendNotificationEmail('user@example.com', {
        title: 'Workflow failed',
        message: 'run xyz failed',
        type: 'execution_failed',
      });

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      const args = mailerService.sendMail.mock.calls[0][0];
      expect(args.to).toBe('user@example.com');
      expect(args.subject).toBe('Workflow failed');
      expect(args.html).toContain('run xyz failed');
      expect(args.html).toContain('http://localhost:3000/notifications');
      expect(args.text).toContain('run xyz failed');
    });

    it('title/message 를 HTML escape (XSS 방어)', async () => {
      await service.sendNotificationEmail('user@example.com', {
        title: '<script>alert(1)</script>',
        message: '<img src=x onerror=1>',
        type: 'execution_failed',
      });
      const args = mailerService.sendMail.mock.calls[0][0];
      expect(args.html).not.toContain('<script>');
      expect(args.html).toContain('&lt;script&gt;');
      expect(args.html).not.toContain('<img src=x');
    });

    it('발송 실패 시 throw (호출자가 best-effort 처리)', async () => {
      mailerService.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
      await expect(
        service.sendNotificationEmail('user@example.com', {
          title: 't',
          message: 'm',
          type: 'execution_failed',
        }),
      ).rejects.toThrow('SMTP down');
    });
  });
});
