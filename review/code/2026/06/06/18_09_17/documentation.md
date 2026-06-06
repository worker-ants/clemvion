# 문서화(Documentation) Review

## 발견사항

### [INFO] `driveResumeAwaited` JSDoc — "메서드명은 옛 detach 모델의 잔재" 자기모순 주석
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, 새 JSDoc 마지막 줄
- 상세: 새로 작성된 JSDoc 끝에 `(메서드명은 옛 detach 모델의 잔재 — 현재는 awaited 구동.)` 이라는 문장이 남아 있다. 이 변경의 목적 자체가 `driveResumeDetached` → `driveResumeAwaited`로 메서드명을 정정하는 것이므로, 새 메서드명 `driveResumeAwaited`는 더 이상 "옛 detach 모델의 잔재"가 아니다. 주석이 이름 변경 전의 임시 상태를 설명하는 것처럼 읽혀 혼란을 준다.
- 제안: 해당 parenthetical을 제거하거나 "메서드명은 awaited 구동을 명시적으로 반영한다."처럼 긍정형으로 교체.

### [INFO] `ProcessTurnResult` 타입 alias — 인라인 주석의 "ai-review W11" 태그 독자 맥락 부재
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `ProcessTurnResult` 정의 블록
- 상세: JSDoc 내 `ai-review W11 —` 태그가 있으나 이를 이해하려면 별도 리뷰 산출물을 참조해야 한다. 코드 독자 입장에서 "W11이 무엇인지"를 알 수 없다. 반면 문서 자체의 설명("인라인 `void | ParkSignal` 혼용을 named alias 로 통일해 처리기 추가 시 계약을 명시")은 충분히 명확하다.
- 제안: `ai-review W11 —` 참조 태그를 제거하거나, 간단히 "이전에 `void | ParkSignal` 인라인 혼용을 named alias로 통일"처럼 의미만 남길 것. 리뷰 시스템 내부 식별자를 프로덕션 소스에 남기면 유지보수 시 노이즈가 된다.

### [INFO] `.env.example` — `LLM_STUB_MODE` 가 OAuth 섹션 안에 위치
- 위치: `codebase/backend/.env.example`, 204~209번째 줄
- 상세: `LLM_STUB_MODE=false`가 `# OAuth — shared between Integration OAuth and User Auth OAuth` 섹션 헤더 아래에 삽입됐다. 기능 유사성(stub mode 계열)으로 `OAUTH_STUB_MODE` 근처에 두는 의도는 명확하나, 섹션 제목과 내용이 불일치한다. 현재 상태에서는 OAuth 섹션 내에 LLM 스텁 관련 변수가 섞여 있어 단순 grep 시 혼란을 줄 수 있다.
- 제안: `LLM_STUB_MODE` 블록 앞에 별도 간략 헤더(`# LLM stub — local/e2e 전용`) 또는 분리 구분선을 추가하거나, `# Execution Engine` 섹션으로 이동. 혹은 현행 OAuth 섹션 헤더를 `# Dev stubs (OAuth / LLM)`으로 확장.

### [INFO] `interaction-token.service.spec.ts` — `describe` 블록 중복: `itk_*` 케이스에도 동일한 `constructor — secret 미설정 시 prod fail-closed` describe 블록이 이미 존재
- 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.spec.ts`, 파일 마지막 두 `describe` 블록
- 상세: 동일한 `constructor — secret 미설정 시 prod fail-closed` describe가 `iext_*` describe 내(파일 430번째 줄 근방)와 `itk_*` describe 내(파일 끝 근방) 두 곳에 각각 추가됐다. 두 블록의 내용(케이스, 단언)이 완전히 동일하다. 생성자 레벨 가드이므로 어느 describe 아래에 있든 동작 차이가 없고, 중복 실행만 발생한다.
- 제안: 두 `describe`(iext/itk) 바깥의 최상위 레벨에 `describe('InteractionTokenService — constructor guards', ...)` 단일 블록으로 통합. 이미 완료된 구현이므로 향후 리팩터링 대상으로 메모.

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` — 변경된 문장의 괄호 표현 길이
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md`, §7 재시도 진입 블록
- 상세: `마지막 turn 단발 재진입(\`processAiResumeTurn\`, exec-park full B3 turn-park 모델 — 옛 장수 loop 폐기)` 괄호 설명이 spec 문서 독자(기획·설계자)에게 코드 구현 상세(`exec-park full B3`, `processAiResumeTurn`)를 과도하게 노출한다. 기술 명세 spec 에서는 "단발 turn 처리로 재진입(구현 상세: full B3 turn-park 모델)"처럼 독자 기준을 구분하는 편이 낫다.
- 제안: spec 문서 목적(무엇을 하는지)과 구현 상세(어떻게 하는지)를 분리. 예: `마지막 turn 단발 재진입 → 마지막 user message 부터 LLM 재호출`로 줄이고 구현 참조는 코드 링크 또는 Rationale 섹션으로 위임. 단, 현재로서도 기술 명세 수준에서 허용 가능한 범위이므로 LOW 우선순위.

### [INFO] `plan/in-progress/exec-park-polish.md` — `진행 메모` 의 e2e 진행 상태
- 위치: `plan/in-progress/exec-park-polish.md`, 진행 메모 마지막 줄
- 상세: "e2e 진행"이라는 미완료 상태 메모가 있으나, 이후 완료 처리 여부가 해당 파일에 갱신되지 않았다. plan 파일이 complete로 이동하지 않은 상태에서 e2e 결과 기록이 없으면 추적 불완전.
- 제안: e2e 완료 후 해당 라인을 완료 결과로 갱신하고, plan을 `plan/complete/`로 이동할 때 plan-lifecycle 규약에 따라 처리.

## 요약

이번 변경은 `driveResumeDetached` → `driveResumeAwaited` 메서드명 정정, `ProcessTurnResult` 타입 alias 신설, `.env.example` 환경변수 등재(`INTERACTION_JWT_SECRET`, `LLM_STUB_MODE`), `InteractionTokenService` prod fail-closed 가드 추가, spec frontmatter `code:` 갱신이 주를 이룬다. 전반적으로 주석과 JSDoc가 변경 사항을 충실히 반영했고, 새로 추가된 환경변수들도 충분한 한국어/영어 병행 설명을 갖추고 있다. 다만 새 `driveResumeAwaited` JSDoc에 메서드명이 "잔재"라는 자기모순 표현이 남아 있고, 동일한 constructor 가드 테스트 describe 블록이 `iext_*`·`itk_*` 두 곳에 중복 추가된 점, `LLM_STUB_MODE`의 섹션 위치가 OAuth 섹션 헤더와 불일치하는 점이 사소한 문서화 불완전으로 남는다. 핵심 변경의 계약·의도·제약 조건은 모두 인라인 주석과 spec에 문서화됐으며, 치명적 문서 누락은 없다.

## 위험도

LOW

---

STATUS: SUCCESS
