import * as path from 'node:path';
import {
  findKoreanMessages,
  findKoreanMessagesInScope,
  listScannedFiles,
  SCANNED_PATHS,
} from './server-message-language-guard';

const BACKEND_SRC = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(BACKEND_SRC, '../../..');

/**
 * **에러 응답 `message` 는 영문이다** (CLE-UI-I18N-BACKEND 규칙 3 · 5).
 *
 * 백엔드는 영문 원문을 내고 한국어는 프런트엔드가 에러 코드로 고른다. 인증 · 트리거 모듈과 워크스페이스 가드 거부 본문은
 * NERV Task `CLE-T-MNX9KP` · `CLE-T-CP6E9B` · `CLE-T-CHP94Z` · `CLE-T-1K5CWP` 에서 영문으로 옮겼다. 그 전에는 한 줄만
 * 영문으로 고쳐도 같은 파일에 두 언어가 섞여서 매번 미뤘다. 옮긴 범위가 다시 섞이지 않게 이 가드가 막는다.
 *
 * 새 한국어 문구가 걸리면 영문으로 쓰고, 화면에 한국어가 필요하면 프런트엔드 사전에 코드로 매핑한다.
 */
describe('옮긴 범위의 에러 응답 message 에 한국어가 없다', () => {
  it('[전제] 스캔 범위가 비어 있지 않다', () => {
    expect(SCANNED_PATHS.length).toBeGreaterThan(0);
    expect(listScannedFiles(BACKEND_SRC).length).toBeGreaterThan(
      SCANNED_PATHS.length,
    );
  });

  it('범위 안에서 한국어가 든 응답 문구가 0건이다', () => {
    expect(findKoreanMessagesInScope(REPO_ROOT, BACKEND_SRC)).toEqual([]);
  });
});

/** 판정 규칙 픽스처. 실제 소스가 바뀌어도 흔들리지 않게 문자열로 둔다. */
describe('findKoreanMessages 판정', () => {
  it.each([
    [
      '예외 본문 객체의 message',
      `throw new BadRequestException({ code: 'X', message: '한국어' });`,
    ],
    ['예외 생성자의 문자열 인자', `throw new NotFoundException('없어요');`],
    [
      '템플릿 문자열 message',
      'throw new ConflictException({ code: "X", message: `${a} 는 안 돼요` });',
    ],
    ['throwInvalidField 의 문구', `throwInvalidField('f', '형식이 틀려요');`],
    [
      '예외를 돌려주는 헬퍼의 인자',
      `function notReady(message: string): BadRequestException { return new BadRequestException({ code: 'X', message }); }\nthrow notReady('먼저 시작하세요');`,
    ],
    [
      '거부 본문 상수의 message',
      `export const NOT_A_MEMBER = { code: 'NOT_A_MEMBER', message: '멤버가 아닙니다.' };`,
    ],
    ['*_MESSAGES 상수 표', `const FIELD_MESSAGES = { a: '내부 필드입니다.' };`],
    ['*_HINT 상수', `const CHAT_CHANNEL_HINT = '안내 문구';`],
    [
      'class-validator 옵션의 message',
      `class D { @Equals(true, { message: '동의해야 합니다.' }) a!: boolean; }`,
    ],
  ])('%s 는 잡는다', (_label, source) => {
    expect(findKoreanMessages(source)).toHaveLength(1);
  });

  it.each([
    [
      'Swagger description',
      `class C { @ApiForbiddenResponse({ description: '멤버가 아님' }) m() {} }`,
    ],
    [
      '예외 안의 description 속성',
      `throw new BadRequestException({ code: 'X', message: 'ok', description: '설명' });`,
    ],
    ['로거 호출', `this.logger.warn(\`트리거 \${id} 정리 실패\`);`],
    [
      '주석',
      `// 한국어 주석\nthrow new BadRequestException({ code: 'X', message: 'English' });`,
    ],
    ['응답 자리가 아닌 문자열', `const label = '유예 중 재교체로 덮인 토큰';`],
    [
      '예외를 돌려주지 않는 함수의 인자',
      `function revoke(reason: string): Promise<void> { return run(reason); }\nrevoke('유예 중 재교체로 덮인 토큰');`,
    ],
    [
      '영문 응답 문구',
      `throw new BadRequestException({ code: 'X', message: 'Invalid.' });`,
    ],
  ])('%s 는 잡지 않는다', (_label, source) => {
    expect(findKoreanMessages(source)).toEqual([]);
  });

  it('걸린 줄 번호를 1부터 센다', () => {
    const source = `const a = 1;\nthrow new BadRequestException({ code: 'X', message: '틀려요' });`;
    expect(findKoreanMessages(source)).toEqual([{ line: 2, text: "'틀려요'" }]);
  });
});
