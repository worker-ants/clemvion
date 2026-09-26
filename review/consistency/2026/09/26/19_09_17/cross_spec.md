# Cross-Spec 일관성 검토 — request-body-guard (swagger.md §5-4 요청 본문 스키마 규칙)

## 검토 범위

target 은 `spec/conventions/swagger.md`(§5-4 체크리스트 신설 항목 + frontmatter `code:` 신설 glob +
Rationale 신설 절)이며, 번들에 `spec/5-system/15-chat-channel.md` 전문이 함께 실렸다(§5.4
`rotate-bot-token` 이 새 규칙의 실제 첫 적용 사례이자 Rationale 이 인용하는 대상이기 때문). 예산 초과로
생략된 `spec/5-system/2-api-convention.md` · `12-webhook.md` 및 다른 spec 113개는 grep + 직접 Read 로
교차 확인했다(`CustomValidationPipe`/`whitelist`/`forbidNonWhitelisted`/`@Body()`/`@ApiBody`/
`@ApiExcludeEndpoint` 등 핵심 용어 전수 검색). 구현 plan(`plan/in-progress/request-body-guard.md`)과
그 spec draft(`plan/in-progress/spec-draft-swagger-request-body.md`), 트래커 항목
(`spec-draft-nullable-notation-followups.md` «요청 본문 스키마의 규칙과 가드»)도 대조했다.

## 발견사항

- **[INFO]** `15-chat-channel.md` §7 구현 파일 트리가 이미 병합된 요청 DTO 파일을 누락
  - target 위치: `spec/5-system/15-chat-channel.md` §7 (`### 7. 구현 파일 구조`) 의 `triggers/` 서브트리,
    `dto/chat-channel-config.dto.ts` 와 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 사이
  - 충돌 대상: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token-request.dto.ts`
    (커밋 `a3a418ae3`, request-body-guard 의 선례로 swagger.md Rationale 이 직접 인용하는 그 파일) ·
    같은 §7 절 상단의 자기 규칙("`code:` 는 기계 술어라 glob 이 새 파일을 자동으로 덮지만, 이 사람이 읽는
    트리는 손으로 채워야 한다")
  - 상세: `code:` frontmatter 의 `dto/**/chat-channel-*.dto.ts` glob 은 이 새 요청 DTO 파일을 이미 잡고
    있어 spec-linked 판정(게이트)에는 문제가 없다. 그러나 §7 의 사람이 읽는 열거에는 그 파일이 여전히
    빠져 있다 — 문서가 스스로 "글로브가 자동으로 덮어도 이 트리는 손으로 채워야 한다"고 못 박은
    바로 그 케이스다. 같은 문서의 R-CC-22 가 "새 파일이 `code:` 에 세 번 연속 누락됐다"는 사례를 이미
    다루고 있어, 이번 것은 (기계 술어가 아니라 사람 열거 쪽이지만) 같은 패턴의 반복이다. cross-spec
    충돌은 아니지만 — target 문서(swagger.md)가 새 규칙의 선례로 인용하는 바로 그 파일이, target 과
    같은 번들에 실린 15-chat-channel.md 자신의 최신 상태를 반영하지 못하고 있다는 점에서 함께 갱신
    대상으로 남긴다.
  - 제안: `15-chat-channel.md` §7 에 `dto/chat-channel-rotate-bot-token-request.dto.ts` 한 줄 추가
    (예: `# rotate 요청 본문 문서 전용 DTO(§5-4). 자리는 swagger.md §5-1 이 정한다` — 형제 응답 DTO 줄과
    대응하는 문구). request-body-guard 자체의 착수 조건은 아니다(별도 소소한 편집).

## 확인했으나 충돌 없음 (근거 요약)

- **데이터 모델**: 신규 규칙은 API 문서화 규약(`swagger.md`)에 한정되고 엔티티·컬럼을 정의하지 않는다.
  `ChatChannelRotateBotTokenRequestDto.newBotToken` 은 `15-chat-channel.md` §5.4 의
  `INVALID_BOT_TOKEN` 계약과 정확히 일치(비어있음/비-string → 그 코드)하고, `writeOnly: true` 도
  swagger.md §1-5 의무와 일치.
- **API 계약**: `spec/5-system/2-api-convention.md`·`12-webhook.md`(모두 직접 Read 로 확인)에는
  `@Body()`/요청 본문 스키마 형태에 대한 경쟁 규칙이 없다 — 두 문서 전체에서 `@Body()` 를 언급하는
  자리는 chat-channel/swagger 문서뿐이다. `2-api-convention.md` §5.4 "검증 층" 앵커, `3-error-handling.md`
  의 `CustomValidationPipe` 서술(파라미터가 클래스일 때만 진입)도 swagger.md 의 서술과 정확히 일치한다.
- **요구사항 ID**: 신규 규칙은 새 요구사항 ID 를 부여하지 않는다(체크리스트 항목 + Rationale 절 —
  `CCH-*`/`WH-*`/`EIA-*` 등 다른 영역 ID 네임스페이스와 무관).
  `codebase/backend/src/repo-guards/__tests__/request-body-advertised*.ts` glob 은 다른 어떤 spec
  문서의 `code:` 에도 등재돼 있지 않다(grep 확인) — 가드 소유권 충돌 없음.
- **상태 전이**: 대상 없음(문서화 규약).
- **RBAC**: 대상 없음. §5-4 의 인접 항목(403 설명 거부 코드)과는 별개 불릿이며 서로 참조하지 않는다.
- **계층 책임**: "인라인 타입 유지 + 문서 전용 DTO 는 `@ApiBody` 로만" 이라는 결정은
  `ExecuteWorkflowDto`/`workflows-execute-body.spec.ts` 선례와 `15-chat-channel.md` §5.4.1 의
  "PATCH 는 비밀을 쓰지 않는다"(R-CC-21) 결정 — 즉 파라미터를 검증 클래스로 승격하면 전역
  `CustomValidationPipe` 가 개입해 계약이 바뀐다는 전제 — 와 같은 방향이다. 트래커 항목이 §1-7 명명
  행(문서 전용 요청 DTO 접미사 규칙)을 의도적으로 이번 범위에서 제외했다고 명시하고 있어, 그 결정
  자체가 "아직 정하지 않음"을 정직하게 반영한 것이지 누락이 아니다.

## 요약

target(`swagger.md` §5-4 신설 + `code:` glob + Rationale)은 이미 커밋된 §5.4 응답/에러 데코레이터
규칙과 같은 층에서 일관되게 동작하며, 함께 번들된 `15-chat-channel.md`(rotate-bot-token 계약,
`INVALID_BOT_TOKEN`, `writeOnly` 의무)와 실제 코드 구현(`ChatChannelRotateBotTokenRequestDto`) 모두와
정합한다. `2-api-convention.md`/`12-webhook.md`(예산 절단으로 직접 Read 한 부분)에도 경쟁 규칙이
없고, 가드 파일 glob 소유권 충돌도 없다. 유일하게 남는 것은 `15-chat-channel.md` §7 사람이 읽는
파일 트리가 이미 병합된(그리고 이번 target 이 선례로 인용하는) 요청 DTO 파일을 아직 반영하지
않았다는 INFO 수준 동기화 갭이며, 이는 request-body-guard 구현 착수를 막을 사유가 아니다.

## 위험도

NONE
