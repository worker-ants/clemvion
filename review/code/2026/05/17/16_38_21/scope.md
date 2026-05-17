# 변경 범위(Scope) 리뷰

### 발견사항

- **[INFO]** `beforeEach` 초기화 블록에 `conversationMessages: []` 와 `selectedConversationItemIndex: null` 두 필드 추가
  - 위치: `apply-execution-snapshot.test.ts` diff @@ -46,6 +46,8 @@
  - 상세: 신규 테스트 케이스가 이 두 필드의 초기 상태를 전제하므로 `beforeEach` 리셋 블록에 추가한 것은 타당한 범위 확장이다. 테스트 격리를 위한 필수 초기화이며, 기존 테스트의 동작을 바꾸지 않는다.
  - 제안: 현 상태 유지. 불필요한 변경 아님.

- **[INFO]** plan 문서(`plan/in-progress/agent-session-restore-on-rejoin.md`) 가 같은 커밋에 포함됨
  - 위치: 파일 3 전체
  - 상세: plan 문서 신규 생성은 작업 추적 정책에 따른 정상 범위다. 내용은 이번 작업의 배경·근본 원인·작업 체크리스트·Side Effect 점검으로 구성되어 있고 구현 범위를 벗어나는 내용이 없다.
  - 제안: 현 상태 유지.

- **[INFO]** consistency check 결과(`review/consistency/2026/05/17/16_20_02/SUMMARY.md`) 가 같은 커밋에 포함됨
  - 위치: 파일 4 전체
  - 상세: `CLAUDE.md` 규약상 구현 착수 전 consistency-check 의무 호출이 요구되며 그 산출물은 `review/consistency/**` 에 기록된다. 포함 자체는 정책 준수이다. 단 이 파일은 `review/` 하위이므로 "의도하지 않은 설정 파일 변경"이나 "무관한 수정"에 해당하지 않는다.
  - 제안: 현 상태 유지.

### 요약

이번 변경은 커밋 메시지에 서술된 목적("REST 스냅샷 경로에서 AI 대화 메시지 hydration 누락 수정")에 정확히 부합한다. 핵심 구현 변경은 `apply-execution-snapshot.ts` 의 `ai_conversation` 분기 11줄 추가와 `parseHistoryMessages` 임포트 1줄로 한정되어 있으며, `setConversationMessages` 디스트럭처링 추가는 해당 로직 호출에 필요한 최소한의 변경이다. 테스트 파일의 205줄 추가는 모두 신규 기능(4개 케이스)에 대응하는 단위 테스트이며 기존 테스트를 변경하지 않았다. `beforeEach` 초기화 블록에 2개 필드를 추가한 것은 신규 테스트 격리를 위한 필수 처리다. plan 문서 및 consistency check 산출물 포함은 프로젝트 정책에 따른 의무 범위다. 의도 외 리팩토링, 불필요한 포맷팅/주석/임포트 변경, 무관한 파일 수정은 발견되지 않았다.

### 위험도

NONE
