# 변경 범위(Scope) 리뷰 — assistant-e2e-contract-gaps

## 방법 노트

프롬프트의 unified diff 는 파일별로 최근 커밋(`9194ad5ee` 등) 기준의 부분 diff만 담고 있어, 실제
브랜치 전체 변경분을 판정하려면 별도 기준선 대조가 필요했다. 로컬 `main` 은 stale(여러 커밋 뒤짐 —
`0186bea98` 등 미포함)이라 `git diff main...HEAD` 는 이 브랜치가 만들지 않은 테스트 A·G·H·계약대조
전체를 신규 변경처럼 보여주는 오탐을 냈다. `git fetch origin main` 후 `origin/main...HEAD` 로 다시
대조해 `0186bea98` 이 이미 `origin/main` 조상임을 확인했고, 그 결과 `codebase/backend/test/workflow-assistant.e2e-spec.ts`
의 실제 변경분은 프롬프트가 보여준 45줄(테스트 F 재작성 + null 분기, 테스트 H 도구 호출 한 원소
추가)과 정확히 일치한다. 이하 판단은 `origin/main...HEAD` 기준.

## 발견사항

### [INFO] 브랜치가 서로 다른 두 plan(테스트 전용 작업 + spec PRD 상태 표기 정정)을 한 PR 에 묶는다

- 위치: `spec/3-workflow-editor/_product-overview.md`(ED-AI-19 행, `git diff` 상 `-`/`+` 각 1줄) + `plan/in-progress/spec-draft-ed-ai-19-status.md`(신규 66줄)
- 상세: 원 작업 plan(`plan/in-progress/assistant-e2e-contract-gaps.md`)은 frontmatter 에 `spec_impact: none` 을 명시하고 "테스트만 바뀐다 — 제품 코드 · spec 변경 없음" 이라고 스스로 범위를 좁혔다. 그런데 실제 브랜치에는 `spec/3-workflow-editor/_product-overview.md` §10.4 ED-AI-19 행에 미구현 표기 한 줄을 추가하는 별도 spec 커밋(`802bd61d5`)이 섞여 있다. 이것만 보면 "테스트 전용" 이라던 plan 이 spec 파일까지 건드린 스코프 확장처럼 보인다.
- 다만 이것은 은닉된 drive-by 가 아니다 — `--impl-prep`(`review/consistency/2026/09/26/16_14_14`) 가 이 작업과 무관한 기존 spec 모순(PRD 는 ED-AI-19 를 미구현 표기 없이 "필수"로, 상세 spec 은 "(계획) 미구현"으로 정반대 서술)을 CRITICAL 로 BLOCK 했고, CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 절차를 그대로 따라 별도 plan(`spec-draft-ed-ai-19-status.md`, owner: project-planner)을 만들어 처리했다. 그 plan 의 Rationale 에 "왜 이 PR 에 싣는가"(우회 대신 사후 그물 게이트 재실행으로 정합성 확보, PR 본문 첫머리에 두 plan 임을 적기로 약속)가 명시돼 있어 스코프 경계를 인지하고 문서화한 상태다.
- 제안: 실제 PR 생성 시 본문 첫 줄에 "이 PR 은 두 plan(`assistant-e2e-contract-gaps` + `spec-draft-ed-ai-19-status`)을 포함한다" 는 문구가 실제로 들어가는지 확인할 것 — plan 문서의 약속이 PR 본문에 이행되지 않으면 리뷰어가 스코프 이해 없이 승인할 위험이 있다.

## 항목별 점검 결과

1. **의도 이상의 변경**: 핵심 코드 변경(`workflow-assistant.e2e-spec.ts`)은 plan 이 명시한 세 처방(테스트 F 상태 단언 좁히기 + 방금 만든 세션 id 대조 + `data: null` 분기, 테스트 H 도구 호출 "전부 생략" 원소 추가)과 정확히 일치한다. 새 import·새 헬퍼 호출·다른 테스트 케이스 수정 없음. 위 INFO 의 spec 한 줄만 별도 plan 근거로 정당화된 확장.
2. **불필요한 리팩토링**: 없음. 테스트 파일에서 조건부 분기(`if (latest.status === 200)`)를 제거하고 단정 단언으로 바꾼 것은 처방 자체(상태 코드 200 고정)의 일부이며 별도 리팩토링이 아니다.
3. **기능 확장(over-engineering)**: 없음. 제품 코드 변경 자체가 없다.
4. **무관한 수정**: 없음. `--impl-prep`/`--spec` 과정에서 발견된 다른 결함(§6 REST 표 누락·RBAC 서술·에러 카탈로그 미등재·i18n 예외 등)은 전부 고치지 않고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 백로그에 등재만 했다(순수 추가, 기존 행 삭제 없음) — 스코프 밖 결함을 발견 즉시 고치려는 유혹에 넘어가지 않고 올바르게 이연했다.
5. **포맷팅 변경**: 실질 변경과 섞인 무의미한 공백/줄바꿈 변경 없음.
6. **주석 변경**: 추가된 주석(라우트 순서 회귀, `lastInteractionAt` 정렬 근거, 도구 호출 "두 끝" 커버리지 이유)은 모두 같은 diff 에서 추가된 단언의 근거를 설명하며, 불필요하거나 무관한 주석 추가/삭제는 없음.
7. **임포트 변경**: 이번 diff 에서 신규 import 없음(필요한 헬퍼는 이미 `origin/main` 에 존재).
8. **설정 변경**: 없음.

## 요약

핵심 코드 변경은 plan 이 선언한 세 칸(테스트 F·H)에 정확히 국한되며 드라이브바이 리팩토링·불필요한 포맷팅·임포트 변경은 없다. 유일한 스코프 경계 이슈는 `--impl-prep` 게이트가 강제한 무관 기존 spec 모순(ED-AI-19 PRD↔상세스펙 불일치)을 별도 plan 으로 만들어 같은 브랜치에 실은 것인데, 이는 CLAUDE.md 가 규정한 "developer 멈추고 planner 위임" 절차를 그대로 밟았고 plan 문서 자체가 그 근거·PR 본문 예고를 명시하고 있어 은닉된 확장이 아니라 문서화된 예외다. 발견된 다른 spec 결함들은 코드로 손대지 않고 전부 백로그 트래커에 등재만 해, 스코프 억제가 잘 지켜졌다.

## 위험도
LOW
