# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] 리뷰 산출물 파일(review/consistency) 이 변경 대상에 포함됨
- 위치: 파일 23~27 (review/consistency/2026/06/06/10_18_24/ 하위 5개 파일)
- 상세: SUMMARY.md, _retry_state.json, cross_spec.md, meta.json, naming_collision.md 가 diff 에 포함됐다. 이들은 본 작업의 --impl-prep consistency-check 단계에서 자동 생성된 산출물로, 워크플로 정책(review/ 산출물 누적 보관) 에 따라 의도적으로 커밋되는 파일이다. 기능 구현과 무관한 관리 파일이지만 정책상 포함이 정당하다.
- 제안: 없음. 정책 준수 커밋에 해당한다.

### [INFO] plan/in-progress/embedding-model-ux.md 신규 생성이 diff 에 포함됨
- 위치: 파일 22
- 상세: plan 파일은 developer 역할의 허용 쓰기 영역(plan/**)이며, worktree 식별자·spec_impact·진행 상태를 포함한 작업 추적 문서다. 본 구현 작업과 직접 연결된 계획 문서로 의도된 포함이다.
- 제안: 없음.

### [INFO] embedding-input-type.ts 배치 위치 — llm 모듈 vs 계획상 knowledge-base/embedding 경로
- 위치: 파일 13 (codebase/backend/src/modules/llm/embedding-input-type.ts)
- 상세: plan Phase A 에는 codebase/backend/src/modules/knowledge-base/embedding/embedding-input-type.ts 로 명시했으나, 실제 구현은 llm 모듈 하위에 배치했다. plan 진행 메모에 "결합 방향: knowledge-base→llm 유지" 를 이유로 명기했으며 의도적 결정이다. google.client.ts, openai.client.ts, llm.service.ts, llm-client.interface.ts 에서 직접 임포트하는 구조상 llm 모듈 배치가 합리적이다. naming_collision.md 의 INFO 4번도 knowledge-base/embedding/ 경로를 예상했으나 실제와 다르다 — scope 위반은 아니고 위치 선택의 합리적 변경이다.
- 제안: plan 문서의 Phase A 파일 경로 기술을 codebase/backend/src/modules/llm/embedding-input-type.ts 로 정정하면 사후 추적이 명확해진다.

### [INFO] anthropic.client.ts 시그니처 변경이 diff 에 없음
- 위치: plan Phase A 항목 — clients/anthropic.client.ts — 시그니처만 맞춤(throw 유지) 로 기술
- 상세: plan 에 명시된 항목이나 변경된 파일 목록에 anthropic.client.ts 가 없다. Anthropic 클라이언트가 embed 를 throw 로만 구현하고 있어 inputType 파라미터 추가가 LLMClient 인터페이스 구현 계약 상 필요하다. plan 에 tsc backend 수정 소스 클린 기록이 있으므로, anthropic.client.ts 의 embed 시그니처가 인터페이스와 이미 호환되는지 확인이 필요하다.
- 제안: anthropic.client.ts 가 optional 파라미터 추가로 호환을 유지한다면 문제없다. tsc 통과 기록이 있으므로 문제 없음으로 보이나, 의도 목록에 명시된 파일이 누락됐으므로 확인을 권장한다.

## 요약

전체 26개 파일 변경은 plan/embedding-model-ux.md 에 정의된 세 Phase(A: inputType 배선, B: 한국어 추천 배지, C: consistency 산출물·plan 문서)의 범위 내에 있다. 의도된 변경인 embed 인터페이스 시그니처 확장·Google/OpenAI 클라이언트 inputType 적용·호출부 6곳 명시·프론트 한국어 추천 배지·i18n 2개 언어·테스트 파일들이 모두 포함됐다. 불필요한 리팩토링, 관련 없는 파일 수정, 무의미한 포맷팅 변경은 발견되지 않았다. embedding-input-type.ts 의 실제 배치가 plan 명시 경로와 다른 점은 의도적 결정이나 plan 문서 업데이트가 필요하고, anthropic.client.ts 누락은 tsc 통과 근거로 호환 유지로 판단되나 확인 권장이다. 프로세스 관리 파일(review/consistency 산출물, plan 파일)의 diff 포함은 프로젝트 정책에 부합한다.

## 위험도

NONE
