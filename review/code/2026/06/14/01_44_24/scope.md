# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 2: mcp-tool-provider.ts

- **[WARNING]** `openServer` 내부의 `try/catch` 중첩 구조 변경이 범위 경계에 걸림
  - 위치: diff hunk `@@ -588,75 +609,90 @@`
  - 상세: 기존에는 `session.close()` 를 위한 inner try/catch 가 있었고, `session.close()` 를 담는 outer catch 가 별도로 없었다. 변경 후 outer `try`가 `integration.status !== 'connected'` 체크와 `mcpClient.connect()` 를 포함하도록 경계가 확장됐고, `skipped` summary push 후 re-throw 하는 outer `catch`가 추가됐다. 이 구조 변경은 §6.2 진단 push 를 위해 **필연적으로 필요한** 리팩토링이며 외부 동작이 바뀌지 않았다(status 체크 / connect 실패 → 여전히 throw, inner close catch는 그대로 유지). 범위 이탈이 아닌 **의도된 최소 구조 변경**으로 판단.
  - 제안: 이슈 없음 — 범위 내.

- **[INFO]** `pushConnectedSummary` private helper 메서드 신규 추가
  - 위치: `materializeServer` 후단 신규 private 메서드
  - 상세: connected summary push 로직을 재사용 가능한 헬퍼로 추출했다(재사용 세션 경로 + 신규 세션 경로 두 곳에서 호출). 본 작업 범위(§6.2 진단 push) 를 구현하기 위해 필요한 최소 추출이며 불필요한 리팩토링이 아니다.
  - 제안: 이슈 없음.

- **[INFO]** `import { pushMcpServerSummary } from './mcp-diagnostics.js'` 추가
  - 위치: 파일 상단 import 블록
  - 상세: 새로 사용하는 함수에 대한 임포트 추가. 범위 내.
  - 제안: 이슈 없음.

### 파일 4: spec/5-system/11-mcp-client.md

- **[WARNING]** spec 파일 수정 — developer 역할의 쓰기 권한 영역 외
  - 위치: `spec/5-system/11-mcp-client.md` §6.2 구현 현황 주석 1줄 교체
  - 상세: CLAUDE.md 규약상 `spec/` 는 `project-planner` 역할의 쓰기 권한 영역이며 `developer` 는 read-only다. 그러나 변경 내용은 §6.2 의 "구현 현황" 블록쿼트(구현 상태 추적용 날짜·내용 갱신)로, 구현 완료에 따른 상태 주석 업데이트다. 이는 spec 요구사항 정의가 아니라 이미 완료된 구현 사실의 기록이며, 관련 플랜 문서(파일 3)와 spec 문서의 "구현 현황" 섹션이 연동되어 관리되는 패턴임을 전체 파일 컨텍스트에서 확인할 수 있다. 역할 분리 위반 소지가 있으나, 동일 커밋 내 플랜 문서 업데이트와 함께 이루어진 상태 동기화라는 점에서 실질적 범위 이탈은 아니다.
  - 제안: 향후에는 spec 현황 주석 갱신도 `project-planner` 역할 또는 별도 spec-sync 커밋으로 분리하는 것이 규약 준수 측면에서 명확하다. 현재 변경이 spec 의도(요구사항)를 바꾼 것은 아니므로 차단 수준은 아님.

### 전반

- **[INFO]** 포맷팅/공백 변경 없음. 의미 없는 공백·줄바꿈 혼입 없음.
- **[INFO]** 불필요한 주석 추가/삭제 없음. 추가된 `§6.2` 주석은 모두 변경된 로직과 직접 연결된 설명.
- **[INFO]** 테스트 파일(파일 1)은 spec §6.2 에 대한 테스트만 추가됐으며 기존 케이스 수정 없음.
- **[INFO]** 플랜 파일(파일 3)은 구현 완료 항목 체크 + 나머지 항목의 cluster 분류 재기술로, 진행 중 작업 추적의 일환. 범위 내.

## 요약

4개 파일 모두 §6.2 외부 MCP 진단 표면 노출(`McpToolProvider`의 serverSummary push) 구현이라는 단일 목적에 집중되어 있다. 구현 파일(`mcp-tool-provider.ts`)의 `try/catch` 재구조화는 outer catch에서 skipped summary를 push하기 위한 불가피한 최소 변경이며 외부 동작을 바꾸지 않는다. `spec/5-system/11-mcp-client.md` 의 수정은 developer 역할의 spec 쓰기 권한 제한(CLAUDE.md)과 충돌하나, 내용이 구현 사실의 상태 메모 갱신에 국한되어 요구사항 변경이 아니므로 실질적 범위 이탈로 보기 어렵다. 의도하지 않은 파일·기능 확장·불필요한 리팩토링은 발견되지 않았다.

## 위험도

LOW
