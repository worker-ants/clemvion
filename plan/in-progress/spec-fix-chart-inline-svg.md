---
worktree: web-chat-presentation-rich-ea5a59
started: 2026-06-02
owner: resolution-applier
---
# Spec Fix Draft — chart inline SVG vs recharts

## 원본 발견사항
SUMMARY#I4: spec `spec/4-nodes/6-presentation/3-chart.md §4` 가 "recharts" 를 참조하나, channel-web-chat 위젯 구현은 번들 경량화를 위해 외부 차트 라이브러리 없이 inline SVG 로 차트를 렌더한다. spec-impl 불일치.

## 제안 변경
`spec/4-nodes/6-presentation/3-chart.md §4` (또는 관련 섹션)에서 "recharts" 참조를 다음으로 교체:
- channel-web-chat 위젯(임베드 SPA)은 번들 경량화 목적으로 **inline SVG** 로 차트를 렌더한다 (외부 라이브러리 없음).
- recharts 참조가 있다면 "일반 웹앱 기준 참고 구현 옵션"임을 명시하거나, 위젯 전용 예외 노트를 추가한다.

해당 파일: `spec/4-nodes/6-presentation/3-chart.md`
