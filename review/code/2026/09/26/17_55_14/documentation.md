# 문서화(Documentation) 리뷰 — rotate-bot-token-body

## 발견사항

- **[WARNING]** 이 작업이 "닫는다"고 선언한 상위 트래커 항목이 아직 갱신되지 않았다 — 낡은 처방 문구 + 미해결 체크박스 방치
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:2459` (실제 파일을 직접 열어 확인한 원본 줄 번호) ·
    관련 `plan/in-progress/rotate-bot-token-body.md:79`(체크리스트 마지막 줄, "전체 파일 컨텍스트" 게이트 기준)
  - 상세: `rotate-bot-token-body.md` 본문(§요구사항)은 "트래커 `spec-draft-nullable-notation-followups.md` 항목
    «`rotate-bot-token` 엔드포인트에 OpenAPI 데코레이터가 전무하다» 를 닫는다" 라고 명시한다. 그런데 실제로 열어보면
    (`spec-draft-nullable-notation-followups.md:2459`) 그 항목은 여전히 `- [ ]`(미체크)이고, 본문 처방 문구도
    "`RotateBotTokenDto` 요청 DTO 승격"으로 남아 있다 — 이번 PR 이 실제로 채택한 방식("문서 전용 DTO +
    `@ApiBody`, class-validator 데코레이터 없이 인라인 `@Body()` 유지")과 정반대다. 이 괴리는 이미
    `review/consistency/2026/09/26/17_20_45/plan_coherence.md`(§발견사항 1)이 impl-prep 단계에서 INFO로
    지적했고, 처리 방법도 "이 항목을 닫는 커밋/planner 턴에서 트래커 문구를 실채택안으로 정정"이라고
    구체적으로 제시했다. 그런데 `rotate-bot-token-body.md` 자신의 체크리스트(79번째 줄) "트래커 항목 닫기 ·
    전역 가드 후속 등재" 도 여전히 `[ ]`(미완료)로 남아 있어, 코드·테스트·CHANGELOG·`--impl-prep` 커밋이 전부
    끝난 이 리뷰 시점까지 트래커 쪽 정정이 실제로 이뤄지지 않았음을 plan 스스로 인정하고 있다. `--impl-done`
    전에 고치지 않으면, 다음 사람이 트래커의 낡은 "요청 DTO 승격" 처방을 그대로 다시 시도해 이번에 일부러
    피한 계약 변경(전역 `CustomValidationPipe` 진입 → 에러 코드·여분 키 처리 변경)을 재도입할 위험이 있다.
  - 제안: 이 PR(또는 바로 다음 커밋)에서 `spec-draft-nullable-notation-followups.md:2459` 를 `[x]` 로 체크하고,
    처방 문구를 "문서 전용 DTO(`ChatChannelRotateBotTokenRequestDto`) + `@ApiBody` — 요청 DTO 승격 대신 실측
    근거(전역 파이프 계약 변경 회피)로 채택안 갱신, `#<PR>` 참조"로 정정할 것. 같은 김에
    `rotate-bot-token-body.md` 체크리스트의 "트래커 항목 닫기 · 전역 가드 후속 등재" 줄도 체크.

- **[INFO]** `*RequestDto` 명명 관례가 `swagger.md` §1-7 에 아직 규약화되지 않음 (이미 알려진 갭, 후속 등재 대기)
  - 위치: `spec/conventions/swagger.md` §1-7(파일 라인 207 부근) — `Update` 접두만 표로 다룬다
  - 상세: 신규 클래스 `ChatChannelRotateBotTokenRequestDto`/`ContinueExecutionRequestDto` 는 저장소 기존 관례
    (`ReRunRequestDto`, `AssistantMessageRequestDto`, `EmailChangeRequestDto`)와 일치해 그 자체로 문제는 아니지만,
    §1-7 표에는 이 "문서 전용 action-body `<Domain><Action>RequestDto`" 형태가 명문화돼 있지 않다.
    `convention_compliance.md`(impl-prep) 가 이미 같은 지점을 INFO 로 지적했고, plan 의 "안 하는 것" 절도
    "전역 가드 후속 등재" 트래커에 이 항목을 함께 묶기로 예고했다. 위 WARNING 과 같은 체크박스(미완료)가
    이 후속도 함께 묶고 있어, 트래커 정정 시 이 항목도 같이 등재되는지 확인이 필요하다.
  - 제안: 별도 조치 불필요 — 위 WARNING 의 트래커 정정 작업에 "§1-7 표에 `<Domain><Action>RequestDto` 행 추가"
    항목을 함께 등재하면 된다(plan 이 이미 그렇게 계획했다).

## 참고 (양호한 점)

- 신규 DTO 2개(`chat-channel-rotate-bot-token-request.dto.ts`, `continue-execution.dto.ts`) 모두
  `spec/conventions/swagger.md` §3("JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다")을 정확히 지켜
  설계 서사(왜 `@Body()` 를 DTO 로 안 바꿨는지, 캐너리 파일명 등)는 `//` 주석에, 소비자 대상 설명만 `/** */`
  에 담았다 — 직접 인용한 선례(`execute-workflow.dto.ts`)가 두 서사를 섞어 쓴 것과 대비된다
  (`convention_compliance.md` WARNING #2 가 impl-prep 에서 지적한 위험을 실제 구현 단계에서 피해 갔다).
- `newBotToken` 필드는 `writeOnly: true` + 필수(`?` 없음)로 선언돼 있어, impl-prep 단계에서 나온 세 checker
  (cross_spec/rationale_continuity/convention_compliance) 의 WARNING 이 모두 실제 코드에 반영됐다.
- CHANGELOG 항목은 `CHANGELOG.md` 상단 기준 1번("OpenAPI 로 광고하는 계약의 변화")에 정확히 해당하고,
  세 라우트의 필수/선택·스키마 형태 서술이 실제 DTO/컨트롤러 코드와 정확히 일치한다.
- 각 모듈의 캐너리 스펙(`*-body.spec.ts`)은 "여기가 RED 면 문서 작업이 계약 변경으로 번진 것이다" 라는
  명시적 경고 주석을 달아 다음 사람이 조용히 테스트를 고쳐 통과시키는 것을 막는다 — 인라인 주석으로 복잡한
  의도(문서 전용 DTO가 실수로 검증 파이프에 연결되는 회귀)를 잘 설명한 사례.
- `hooks.controller.ts`/`hooks-webhook-body.spec.ts` 의 "형태는 외부 발신자가 정한다" 서술은
  `spec/5-system/12-webhook.md` WH-EP-04/05, `hooks.service.ts` 의 실제 `최상위 키` 추출 로직과 대조 확인한 결과
  정확하다.

## 요약

이번 PR 은 API 문서(OpenAPI `@ApiBody`) 신설이 본 목적인 문서화 전용 변경으로, DTO JSDoc/`//` 주석 분리 원칙·
CHANGELOG 기준·spec 서술과의 정합성 모두 impl-prep 단계 5개 checker 의 WARNING 을 실제 구현에서 정확히
반영해 전반적으로 문서 품질이 높다. 유일하게 남은 결함은 코드가 아니라 plan 계보 쪽이다 — 이 PR 이 "닫는다"고
선언한 상위 트래커 항목(`spec-draft-nullable-notation-followups.md:2459`)이 아직 미체크·낡은 처방 문구
그대로이고, 그 정정 작업 자체가 `rotate-bot-token-body.md` 체크리스트에도 미완료로 남아 있다. `--impl-done`
전에 반드시 정정해야 다음 사람이 폐기된 처방("요청 DTO 승격")을 다시 시도하지 않는다.

## 위험도

LOW
