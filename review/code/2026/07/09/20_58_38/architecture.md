# 아키텍처(Architecture) Review

## 리뷰 대상
- `spec/7-channel-web-chat/3-auth-session.md` — 재로드 복원 시퀀스에 `context.conversationThread` 히스토리 시드 반영
- `spec/conventions/conversation-thread.md` §8.4 — `Execution.conversation_thread` 컬럼 소비처를 "durable park resume 전용" 에서 "+ 공개 REST(`getStatus`) 읽기 전용 노출" 로 확장

두 파일 모두 스펙(문서) 변경만 포함하며 코드 diff는 없음. 이번 변경은 이미 존재하는 durable 컬럼·이미 SSE로 노출 중인 데이터를 재노출하는 설계 결정의 문서화다.

## 발견사항

- **[WARNING]** 내부 durable resume 스냅샷의 다목적(multi-purpose) 재사용 — 계층 경계가 문서상으로만 관리됨
  - 위치: `spec/conventions/conversation-thread.md` §8.4 "소비처 갱신 (2026-07-09)" 단락, `spec/7-channel-web-chat/3-auth-session.md` §3.1
  - 상세: `Execution.conversation_thread` 컬럼은 원래 "park 중 in-flight thread 무손실 재개" 라는 단일 책임(엔진 내부 rehydration)으로 도입됐다(§8.4 원본 결정). 이번 변경으로 소비처가 (a) rehydration(내부) → (b) SSE waiting emit → (c) 공개 REST `getStatus`(읽기 전용) 3갈래로 확장된다. 세 소비처는 서로 다른 신뢰 경계(내부 엔진 / 인증된 실행 소유자 SSE 채널 / 공개 브라우저 위젯이 호출하는 REST)를 가지므로, 이 컬럼이 계속 "엔진 내부 데이터 모델"로만 취급되면 향후 필드 추가(`runningSummary` 확장, 디버그용 메타 필드 등) 시 공개 REST 노출 영향을 놓치기 쉽다. 현재 안전장치는 "노드 핸들러가 turn 텍스트에 민감 정보를 남기지 않는다"는 **컨벤션 수준의 규율**뿐이며, 구조적(타입/DTO) 경계가 아니다.
  - 제안: EIA `getStatus` 응답이 `context.conversationThread` 를 그대로(raw internal shape) 직렬화하는지, 아니면 별도 public-facing DTO/whitelist 를 거치는지 EIA §5.3/§R17 원문에서 확인해 명시. raw 그대로라면, 향후 ConversationThread 스키마 확장 시 "이 필드가 공개 REST 로도 나간다"는 사실을 스키마 정의 지점에서 알아챌 수 있는 구조적 장치(예: 별도 PublicConversationThreadView 타입, 혹은 필드 단위 `@public` 주석 컨벤션)를 검토할 가치가 있음.

- **[INFO]** 범용 EIA `getStatus` 응답에 대화 히스토리 전체를 무조건 동봉 — 인터페이스 분리 관점 확인 필요
  - 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1 "`waiting_for_input` 이면 그 `context` 로 현재 표면 + `context.conversationThread`(durable 스냅샷)로 **과거 대화 히스토리 전체**를 시드한다"
  - 상세: `GET /api/external/executions/:id`(`getStatus`)는 웹챗 위젯 전용이 아니라 EIA(External Interaction API)를 쓰는 모든 외부 봇/커스텀 클라이언트가 공유하는 범용 엔드포인트다. 이번 결정은 `waiting_for_input` 상태일 때 이 엔드포인트가 항상 전체 대화 히스토리(potentially 최대 turn 수)를 포함하도록 확장한다. 웹챗처럼 새로고침 복원이 필요한 클라이언트에는 유용하지만, 히스토리가 필요 없는 다른 EIA 소비자(예: 상태 폴링만 하는 단순 webhook 통합)에도 동일하게 큰 페이로드가 강제된다면 이는 인터페이스 분리 원칙(ISP)의 경계 사례다.
  - 제안: 이 diff 만으로는 EIA §5.3/§R17 원문(별도 파일, 이번 리뷰 대상에 미포함)을 확인할 수 없어 실제로 무조건적 동봉인지, opt-in(쿼리 파라미터 등) 방식인지 판단 불가. EIA 스펙에서 "모든 waiting_for_input 소비자에 대해 무조건 포함"인지, 다른 채널(비-웹챗) 영향까지 고려했는지 확인 권장.

- **[INFO]** SoT 문서(`conversation-thread.md`) frontmatter `code:` 목록이 신규 소비처를 반영하지 않음 — 추적성 갭
  - 위치: `spec/conventions/conversation-thread.md` frontmatter `code:` (파일 상단, 이번 diff 밖 기존 목록)
  - 상세: 해당 컨벤션 문서는 자신이 규율하는 코드 파일 목록을 frontmatter에 명시하는 관례를 따른다(`shared/conversation-thread/**`, `modules/execution-engine/conversation-thread/**`, AI 노드 핸들러들, 프런트 store/컴포넌트 등). 이번 §8.4 갱신으로 EIA의 `getStatus` 컨트롤러/서비스가 새로운 소비처로 추가됐음에도, 이 문서의 `code:` 목록에는 해당 경로가 반영되지 않았다. `ConversationTurn`/`ConversationThread` 필드를 변경할 때 이 SoT 문서 하나만 보고 영향 범위를 판단하는 워크플로우(spec-impl-evidence 등)에서 공개 API 영향을 누락할 위험이 있다.
  - 제안: EIA 쪽 getStatus 구현 경로가 확정되면(코드 PR 시점) `conversation-thread.md` frontmatter `code:` 에 해당 컨트롤러/서비스 경로를 추가해 추적성을 보강. 이는 이번 spec-only PR에서 강제할 사항은 아니며 후속 구현 PR에서 처리 가능.

- **[INFO]** (positive) Rationale 확장 방식 — 날짜 명시 addendum 으로 히스토리 보존
  - 위치: `spec/conventions/conversation-thread.md` §8.4 "소비처 갱신 (2026-07-09)" 단락
  - 상세: 기존 결정(§8.4 원문)을 덮어쓰지 않고 "소비처 갱신 (날짜)"라는 별도 단락으로 추가해, "저장 목적은 park resume 그대로이고 소비처만 확장됐다"는 점을 명확히 구분했다. 이는 결정 이력의 append-only 보존, 그리고 "원칙의 번복이 아니라 적용 범위 분리"라는 기존 프로젝트 컨벤션(§ "신규 컬럼 없음 원칙과의 정합" 단락과 동일 패턴)을 재사용한 governance 방식으로 바람직하다.
  - 제안: 없음 (모범 사례로 기록).

## 요약
이번 변경은 코드가 아닌 스펙 문서 2건(웹챗 인증/세션 흐름, conversation-thread 컨벤션)만을 다루며, 이미 존재하는 durable park-resume 컬럼(`Execution.conversation_thread`)의 소비처를 내부 rehydration/SSE emit에서 공개 REST(`getStatus`)로 확장한다는 설계 결정을 문서화한다. 저장소를 새로 만들지 않고 기존 단일 컬럼을 재사용하는 점, 그리고 "이미 SSE로 공개 중인 데이터의 REST 재노출"이라는 논리로 신규 민감 표면이 아니라고 명시적으로 정당화한 점은 아키텍처적으로 합리적이다. 다만 (1) 내부 전용으로 설계됐던 데이터 모델이 컨벤션(핸들러 규율)에만 의존해 공개 API 경계를 유지하는 구조적 취약점, (2) 범용 EIA 엔드포인트에 채널 특화 요구(웹챗 히스토리 복원)가 무조건적으로 반영되는 것으로 보이는 서술(인터페이스 분리 재검토 여지) 은 EIA 스펙 원문(§5.3·§R17, 이번 diff 범위 밖)을 직접 확인해 스코핑 방식을 검증할 필요가 있다. 문서 자체의 구성(Rationale append 방식, 계층별 SoT 분리: 위젯 스펙/컨벤션 스펙/EIA 스펙 간 cross-reference)은 견고하다.

## 위험도
LOW
