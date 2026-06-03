import {
  buildExtractionTranscript,
  parseExtractionResponse,
  type ExtractionTurnSnapshot,
} from './agent-memory-extraction.queue';

describe('agent-memory-extraction queue helpers (spec §3)', () => {
  describe('buildExtractionTranscript', () => {
    it('user/assistant turn 을 역할 라벨 라인으로 직렬화한다', () => {
      const turns: ExtractionTurnSnapshot[] = [
        { source: 'ai_user', text: '내 이름은 지수야', nodeLabel: 'Agent' },
        {
          source: 'ai_assistant',
          text: '안녕하세요 지수님',
          nodeLabel: 'Agent',
        },
      ];
      expect(buildExtractionTranscript(turns)).toBe(
        '사용자: 내 이름은 지수야\n어시스턴트: 안녕하세요 지수님',
      );
    });

    it('system / ai_tool turn 은 제외한다', () => {
      const turns: ExtractionTurnSnapshot[] = [
        { source: 'system', text: 'You are helpful', nodeLabel: 'Agent' },
        { source: 'ai_user', text: '질문', nodeLabel: 'Agent' },
        { source: 'ai_tool', text: '{"result":1}', nodeLabel: 'Agent' },
      ];
      expect(buildExtractionTranscript(turns)).toBe('사용자: 질문');
    });

    it('빈/공백 text turn 은 건너뛴다', () => {
      const turns: ExtractionTurnSnapshot[] = [
        { source: 'ai_user', text: '   ', nodeLabel: 'Agent' },
        { source: 'ai_assistant', text: '', nodeLabel: 'Agent' },
      ];
      expect(buildExtractionTranscript(turns)).toBe('');
    });

    it('presentation_user 도 사용자로 매핑한다', () => {
      const turns: ExtractionTurnSnapshot[] = [
        { source: 'presentation_user', text: '폼 제출 값', nodeLabel: 'Form' },
      ];
      expect(buildExtractionTranscript(turns)).toBe('사용자: 폼 제출 값');
    });
  });

  describe('parseExtractionResponse', () => {
    it('JSON 문자열 배열을 그대로 파싱한다', () => {
      expect(
        parseExtractionResponse(
          '["사용자는 간결한 답변을 선호한다", "계정 등급은 gold"]',
        ),
      ).toEqual(['사용자는 간결한 답변을 선호한다', '계정 등급은 gold']);
    });

    it('빈 배열 → 빈 결과 (no-op)', () => {
      expect(parseExtractionResponse('[]')).toEqual([]);
    });

    it('앞뒤 설명이 붙은 응답에서 첫 배열 리터럴만 회수한다', () => {
      expect(
        parseExtractionResponse('추출 결과: ["사실 A", "사실 B"] 입니다.'),
      ).toEqual(['사실 A', '사실 B']);
    });

    it('파싱 불가 응답은 빈 배열로 graceful fallback', () => {
      expect(parseExtractionResponse('this is not json')).toEqual([]);
      expect(parseExtractionResponse('')).toEqual([]);
      expect(parseExtractionResponse(null)).toEqual([]);
      expect(parseExtractionResponse(undefined)).toEqual([]);
    });

    it('비-string 항목 제외 + trim + 정확일치 dedup', () => {
      expect(
        parseExtractionResponse('[" 사실 A ", "사실 A", 42, "", "사실 B"]'),
      ).toEqual(['사실 A', '사실 B']);
    });

    it('객체(배열 아님) 응답은 빈 배열', () => {
      expect(parseExtractionResponse('{"facts":["a"]}')).toEqual([]);
    });
  });
});
