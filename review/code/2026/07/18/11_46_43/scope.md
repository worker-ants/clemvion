# 변경 범위(Scope) 리뷰 결과

## 발견사항

- **[INFO]** 동일 docblock 내용이 두 파일(구현체 + 인터페이스)에 상당 분량 중복
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1180~` (`endMultiTurnConversation` docblock), `codebase/backend/src/nodes/core/node-handler.interface.ts:452~`/`:1281~` (`ResumableNodeHandler.endMultiTurnConversation` docblock)
  - 상세: IE 가 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 를 의도적으로 무시하는 이유(§5.3 code-기반 invariant, self-fill, retry_last_turn 미지원)가 두 위치에 거의 같은 문장으로 반복 서술됨. 순수 스코프 관점에서는 "요청 범위 밖"이 아니라 계획서(`plan/in-progress/ie-endmultiturn-errorpayload-contract.md`) 체크리스트 1번(핸들러 시그니처+주석)·2번(인터페이스 docblock 정정)이 각각 명시적으로 요구한 산출물이며, PR #975 코드 리뷰에서 "4회 연속 반복 지적된 혼란"을 근절하려는 목적이 plan 배경에 명시돼 있어 과잉이라 보기 어려움.
  - 제안: 조치 불요 (계획 대비 정합). 향후 세 번째 위치에 동일 설명이 또 필요해지면 그때 단일 SoT 로 통합 검토.

- **[INFO]** `review/consistency/2026/07/18/11_19_02/**` 8개 신규 파일 및 `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` 가 코드 변경과 함께 diff 에 포함
  - 위치: 파일 4~12
  - 상세: 이 프로젝트 워크플로 규약(`CLAUDE.md` "developer 는 구현 착수 직전 consistency-check --impl-prep 의무")에 따라 착수 전 실행한 `/consistency-check --impl-prep` 산출물과 그 결과에 대한 사용자 승인(BLOCK:YES bypass) 근거를 담은 plan 문서다. plan 본문의 "impl-prep 결과" 섹션이 이 산출물을 직접 참조하고 있어 코드 변경의 정당성 근거로 함께 커밋되는 것이 정상 워크플로다. 스코프 이탈 아님.
  - 제안: 조치 불요.

## 스코프 대비 실제 변경 매핑

`plan/in-progress/ie-endmultiturn-errorpayload-contract.md` §Q3 체크리스트 3개 항목과 실제 diff 가 1:1 대응한다.

1. "IE `endMultiTurnConversation` 시그니처에 무시 인자 3개를 `_` prefix 로 명시 + 이유 주석" → `information-extractor.handler.ts` 의 `_errorPayload`/`_failedUserMessage`/`_failedUserMessageSource` 추가(순수 optional 파라미터 확장, 기존 로직 `hydrateState`/`buildMultiTurnFinalOutput` 호출부는 무변경) + `ResumableMessageSource` import 1건(실사용).
2. "`node-handler.interface.ts` 의 docblock 정정" → 해당 인터페이스 메서드 docblock 한 곳만 수정(단일 hunk), 다른 인터페이스 필드·타입 정의는 무변경.
3. "pinning 테스트" → `information-extractor.handler.spec.ts` 말미에 새 `describe` 블록 1개(2 케이스)만 append. 기존 테스트 케이스·헬퍼 함수·import 는 무변경.

세 파일 모두 "behavior 무변경, 문서화+계약 명시화"라는 plan 의 Q3 결론과 정확히 일치하며, `AiAgentHandler` 등 다른 핸들러 파일에는 손을 대지 않았다(docblock 서술에서만 언급). import 추가는 실사용 1건뿐이고 불필요한 정리·재포맷·주석 삭제·미사용 임포트·설정 파일 변경은 발견되지 않았다.

## 요약

변경 범위는 plan 문서(`ie-endmultiturn-errorpayload-contract.md`) §Q3 에서 사전 정의한 "문서화 전용, behavior 무변경" 목표에 정확히 부합한다. 실제 코드 diff 는 (1) IE 핸들러 시그니처에 `_` 접두 optional 파라미터 3개 추가 + 사유 docblock, (2) 인터페이스 docblock 정정, (3) 회귀 방지용 pinning 테스트 추가로 국한되며, 관련 없는 리팩터링·포맷팅·불필요 임포트·설정 변경은 없다. 동봉된 plan/consistency 산출물도 프로젝트 표준 impl-prep 워크플로의 정상 부산물이다.

## 위험도
NONE
