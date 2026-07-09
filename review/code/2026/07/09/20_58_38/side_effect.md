# 부작용(Side Effect) 리뷰 — spec 문서 2건

## 리뷰 대상
- `spec/7-channel-web-chat/3-auth-session.md` (Review, md)
- `spec/conventions/conversation-thread.md` (Review, md)

두 파일 모두 diff 가 서술문(prose) 만 수정하는 순수 문서 변경이며, 코드(함수/클래스/모듈)는 diff 에 포함되어 있지 않다.

## 발견사항

- **[INFO]** 코드 부작용 없음 — 문서 전용 diff
  - 위치: 두 파일 전체
  - 상세: 이번 diff 는 마크다운 서술만 수정한다. 함수/메서드 시그니처 변경, 전역 상태·전역 변수 도입, 파일시스템 생성/삭제, 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 발생 등 런타임 부작용을 유발할 수 있는 코드 변경이 전혀 포함되지 않았다. 부작용 관점에서 이 diff 자체의 위험은 없다.
  - 제안: 해당 없음(정보성).

- **[INFO]** 문서가 서술하는 실제 동작은 공개 REST 응답 payload 확장 — 코드는 이 리뷰 범위 밖, 교차확인 결과 서술과 일치
  - 위치: `3-auth-session.md` §3.1 (재로드 복원 시퀀스), `conversation-thread.md` §8.4 "소비처 갱신 (2026-07-09)"
  - 상세: 두 문서는 공통적으로 `GET /api/external/executions/:id`(`getStatus`, EIA)가 `waiting_for_input` 상태에서 durable 컬럼(`Execution.conversation_thread`) 스냅샷을 `context.conversationThread` 로 **신규 동봉**한다고 서술한다. 이 문서가 가리키는 실제 구현 파일(`codebase/backend/src/modules/external-interaction/interaction.service.ts`, `codebase/backend/src/modules/executions/entities/execution.entity.ts`)은 본 side-effect 리뷰 payload 에 포함되어 있지 않아 코드 자체는 이 호출의 리뷰 대상이 아니다. 다만 참고용으로 대조한 결과, 실제 구현(`interaction.service.ts` 의 `getStatus`)이 문서 서술과 일치하며, SSE `waiting_for_input` 이벤트 쪽은 이미 이전부터 `conversationThread` 를 동봉하고 있었다(`execution-engine.service.ts:6514-6526`, 이번 브랜치 diff 밖의 기존 코드) — 즉 문서가 강조하는 "이미 SSE 로 공개 중인 데이터의 REST 재노출이라 신규 민감 표면이 아니다"라는 주장은 근거가 있다. 그럼에도 이는 **인증 없는 공개 REST 엔드포인트의 응답 payload 에 필드가 추가**되는 인터페이스 변경(관점 5)에 해당한다 — additive 필드라 기존 위젯 소비자에는 breaking 하지 않지만, 응답 바디 크기·노출 데이터 범위가 넓어지는 side effect 는 실질적으로 존재한다.
  - 제안: 이 자체는 문서 서술의 정확성 문제가 아니라 참고 사항이다. 코드 변경분(`interaction.service.ts`, `execution.entity.ts`, 위젯 `use-widget.ts` 등)이 별도 side_effect / interface 리뷰 트랙에서 "공개 REST 응답에 read-only 필드 추가"·"노드 핸들러가 turn 텍스트에 민감정보를 남기지 않는다는 제약 유지" 관점으로 실제 커버되고 있는지 orchestrator 쪽에서 확인 권장 (이번 호출의 대상 파일 밖이라 여기서는 검증 불가).

## 요약
리뷰 대상 2개 파일은 모두 spec 마크다운 문서로, diff 자체가 서술문 수정에 그쳐 상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크 호출·이벤트/콜백 등 어떤 부작용 카테고리에도 해당하는 코드 변경이 없다. 문서가 서술하는 기반 동작(공개 REST `getStatus` 가 durable 대화 히스토리를 read-only 로 신규 노출)을 참고 삼아 실제 구현과 대조한 결과 서술은 정확했고, SSE 로 이미 공개되던 데이터의 재노출이라는 보안 근거도 코드상 확인됐다. 다만 그 REST payload 확장 자체(코드는 이 payload 밖)는 인터페이스 관점의 side effect 성격을 띠므로, 해당 코드 파일을 다루는 리뷰 트랙에서 별도 확인이 이루어졌는지 참고할 가치가 있다.

## 위험도
NONE
