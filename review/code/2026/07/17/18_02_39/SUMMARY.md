# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 로직 변경이 전무한 순수 정리(cleanup) 커밋(`a8c9460564df00131fcb39c516d9ee8ca6a3383b`, "리뷰 WARNING#1,2,5,6,9,10 정리"). 8개 reviewer 전원(NONE×4, LOW×4) 중 CRITICAL 없음, WARNING 3건은 모두 문서/주석 정확성 문제로 런타임 동작에는 영향 없음. router_safety 로 강제 포함된 8개 reviewer(`dependency, documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 확보되어 있어 화이트리스트 미이행으로 인한 거짓 음성 위험 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation (plan) | plan 정정 각주가 커밋 SHA를 잘못 인용 — 실제로는 `f17fc18dd`가 아니라 `f0ef4a821`가 `IS_MULTI_TURN_INTERACTION` exhaustive 구조를 신설한 커밋. `git show f17fc18dd -- .../interaction-type-registry.ts`는 빈 diff(그 커밋은 이 파일을 전혀 건드리지 않음)로 반증됨. 같은 문서 18줄 앞(line 226)은 동일 커밋을 `f0ef4a821`로 올바르게 인용하고 있어 문서 자체가 자기모순 | `plan/in-progress/is-conversation-output-restructure.md:244` | `f17fc18dd` → `f0ef4a821`로 정정 |
| 2 | Documentation/Requirement/Maintainability | 재배치된 `isConversationOutput` JSDoc이 "Handles all four shapes"라 서술하나 실제 OR-체인은 최상단 legacy early-return을 포함해 5개 이상의 독립 인식 분기를 가짐 — `looksLikeConversationEnd`(post-Stage-5 `output.result.messages`+endReason 화이트리스트)와 `hasConvConfig`(`output.conversationConfig` 단독 존재)가 4-bullet 목록 어디에도 명시적으로 대응되지 않음. 이번 diff가 신설한 테스트 스스로 전자를 별도 이름("detects post-Stage-5 ai_agent terminal via output.result.messages + endReason")으로 불러 코드가 자기증언. `isConversationOutput`은 plan이 "대화 UI 전체의 게이트"라 부르고 동일 계열 버그가 이미 2회 발생(PR #959, error/condition 누락)한 고위험 함수라 불완전한 열거가 세 번째 회귀로 이어질 위험 있음 | `codebase/frontend/src/components/editor/run-results/output-shape.ts:114-125`(JSDoc, 이번 diff가 이 정확한 블록을 위치만 이동) / `:127-179`(함수 본문, 이번 diff 미변경) | 누락된 2개 분기를 bullet에 추가하거나 "all four shapes"를 "여러 shape(정확한 개수는 OR-체인 참고)"로 완화 |
| 3 | Documentation | `@workflow/ai-end-reason` drift 구조적 차단 작업(사용자 제보 버그 — 대화 미리보기 탭 소실 — 의 구조적 fix) 전체에 `CHANGELOG.md` Unreleased 항목 누락. 직전 PR(#958)의 review-fix 커밋 메시지가 "사용자 가시 fix마다 CHANGELOG 절을 남기는 컨벤션"을 명시적으로 언급·이행한 선례가 있고, 직전 15개 머지 커밋 100%가 이 컨벤션을 준수함을 확인 | 저장소 루트 `CHANGELOG.md` (관련 7개 커밋 `f0ef4a821`~`a8c946056` 중 어디에도 없음) | plan을 `plan/complete/`로 이동하기 전 `## Unreleased — endReason 화이트리스트 drift 구조적 차단` 류의 절 추가 (이번 정리 커밋 자체의 스코프는 아니나, plan의 마지막 라운드이므로 놓치기 전 마지막 지점) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation/Maintainability | README 신규 섹션 표제(`## 빌드`/`## 사용(Exports)`)가 "형제 패키지 4개 전부와 동일"이라는 커밋 메시지 주장과 달리 실측 불일치 — `chat-channel-validation`엔 `## 빌드` 자체가 없고(3/4만 보유), `## 사용(Exports)`라는 정확한 표제는 4개 형제 중 어느 것도 쓰지 않는 제3의 변형. 내용(빌드 커맨드·export 목록)은 실제 코드와 정확히 일치 | `codebase/packages/ai-end-reason/README.md` | 5개 패키지 README 절 표제를 하나의 관용구로 통일(후속 정리로 미뤄도 무방, 기능 영향 없음) |
| 2 | Testing | Dockerfile 패키지 개수("N개") 주석에 자동 가드가 없어 재발 가능 — `check-e2e-playwright-config.py`는 COPY 구조적 집합 일치만 검증할 뿐 주석 문자열 속 숫자는 어떤 스크립트도 읽지 않음(backend는 동급 가드 자체 없음). 이번 커밋이 고친 stale 값도 결국 사람이 손으로 세어 정정한 것이라 재발 가능 | `codebase/backend/Dockerfile:28`, `codebase/frontend/Dockerfile.playwright-e2e:36,38` | 우선순위 낮음. 개수 리터럴 제거/완화를 백로그로 |
| 3 | Testing | `looksLikeConversationEnd`의 `hasResultMessages` 단독 분기(1번째 절이 false인 고립 케이스)는 여전히 전용 negative 테스트가 없음. 코드 정독상 `&&` 단락평가로 현재는 안전하나, 이 함수는 회귀가 반복된(PR #959 2회) 게이트 함수라 완전한 분기 커버리지가 안전망 가치 있음 | `output-shape.ts:1271-1274` | 향후 이 함수를 다시 만질 때 고립 케이스 테스트 추가 권장 |
| 4 | Maintainability | `isConversationOutput`의 OR-체인 복잡도(~8개 불리언 플래그, 4-way OR 결합)는 이번 diff 범위 밖으로 유지됨 — plan 문서에 "architecture reviewer: 반복적 heuristic OR-체인 확장, 회귀 계열의 반복 진원지"로 이미 별도 추적 중인 기존 채무이며 이번 diff는 의도적으로 이를 건드리지 않음(E-4 항목 "동작·조건 무변경" 명시) | `output-shape.ts:125-179`(미변경) | 이번 diff 조치 불요, 기존 백로그 추적 유지 |
| 5 | Documentation | 루트 `README.md`/`PROJECT.md`의 `codebase/packages` 예시 목록이 이미 stale(2개만 예시, 실제 7개 패키지 존재) — `ai-end-reason` 도입 이전부터 존재한 staleness로 이번 diff 범위 밖 | `README.md:107`, `PROJECT.md:14` | 별도 백로그 후보 |
| 6 | Security | 신규 negative-path 테스트(화이트리스트 거부 경로) 추가로 기존 positive-only 사각지대를 메워 방어적 검증 커버리지 개선 — 보안 결함 아님. `isConversationOutput`은 인증/신뢰 경계가 아닌, 이미 인증된 세션이 보는 UI 렌더링 게이트(판정이 틀려도 정보노출/권한상승 아닌 UX 영향만) | `output-shape.test.ts:346-365`, `interaction-type-registry.test.ts:1-23` | 조치 불필요, 현행 유지 권장 |
| 7 | Testing | 신규 `interaction-type-registry.test.ts`의 두 번째 테스트는 첫 번째 테스트(exact-set `toEqual`)에 논리적으로 포함되나, 실패 시 더 구체적 진단 메시지를 주는 의도적 belt-and-suspenders 패턴으로 결함 아님 | `interaction-type-registry.test.ts:19-22` | 조치 불필요 |
| 8 | Dependency/Scope | `package.json`/`pnpm-lock.yaml`/워크스페이스 매니페스트 변경 전무, 신규 의존성 없음. `git show --stat` 실측(`7 files changed, 86 insertions(+), 25 deletions(-)`)이 payload diff와 정확히 일치, 7개 파일 전부가 커밋 메시지 SUMMARY 항목과 1:1 대응 | 전체 diff(7 파일) | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음(JSDoc 이동 제외), 하드코딩 시크릿 없음, 신규 테스트가 화이트리스트 거부 경로 커버리지 보강 |
| requirement | LOW | plan SHA 오인용(WARNING) + JSDoc shape 서술 부정확(WARNING) 발견 + mutation 직접 재현으로 신규 테스트 2건의 유효성을 실측 검증(커밋 메시지 주장과 정확히 일치 확인) |
| scope | NONE | 7개 파일 변경 전부가 커밋 메시지 SUMMARY#1/2/5/6/9/10과 1:1 대응, 선언되지 않은 추가 수정 없음(발견사항 없음) |
| side_effect | NONE | 전역 상태·파일시스템·함수 시그니처·공개 API·환경 변수·네트워크·이벤트/콜백 전 축에서 부작용 없음 |
| maintainability | LOW | README 표제 불일치(INFO), JSDoc "네 가지 shape" 열거 부정확(사전 존재, INFO), OR-체인 복잡도는 기존 백로그(INFO) — 정리 자체는 깨끗 |
| testing | LOW | mutation 직접 재현으로 신규 테스트 2건이 실제 겨냥한 회귀만 잡음을 확인(31 passed/1 failed 재현), Dockerfile 주석 자동가드 부재·hasResultMessages 고립 테스트 부재 지적(모두 INFO) |
| documentation | LOW | CHANGELOG.md 누락(WARNING), JSDoc shape 서술 불일치(WARNING), README 표제 과장(INFO), 루트 README/PROJECT.md stale 예시(INFO, 범위 밖) |
| dependency | NONE | package.json/lockfile 변경 없음, 순수 정리 커밋, Dockerfile 주석 정정이 실제 COPY 라인 수와 정확히 일치함을 실측 확인 |

## 발견 없는 에이전트

- scope — "7개 파일 변경 전부가 커밋 메시지의 SUMMARY#1/2/5/6/9/10 항목과 1:1로 정확히 대응하며, 선언되지 않은 추가 수정을 찾지 못했다"고 명시적으로 발견사항 없음을 보고.

## 권장 조치사항

1. `plan/in-progress/is-conversation-output-restructure.md:244`의 커밋 SHA 오인용을 `f17fc18dd` → `f0ef4a821`로 정정 (같은 문서 내 자기모순 해소, 저비용·확실한 수정)
2. `output-shape.ts`의 `isConversationOutput` JSDoc "all four shapes" 서술에 누락된 2개 분기(`looksLikeConversationEnd`, `hasConvConfig`)를 추가하거나 문구를 완화 — 반복 회귀 이력(PR #959 2회)이 있는 안전 임계 함수라 다음 확장 시 오독 방지 효과가 큼
3. plan을 `plan/complete/`로 이동하기 전 `CHANGELOG.md`에 `## Unreleased` 절 추가 — 이 작업 계열(사용자 제보 버그의 구조적 차단)이 저장소의 확립된 "PR당 CHANGELOG 절" 컨벤션 대상에 해당
4. (선택, 낮은 우선순위) `ai-end-reason/README.md`의 `## 사용(Exports)` 표제를 형제 패키지들과 통일하거나, 5개 패키지 전체의 README 절 표제 관용구를 일원화

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, dependency (8명)
  - **강제 포함(router_safety)**: dependency, documentation, maintainability, requirement, scope, security, side_effect, testing (8명) — forced 전원 결과 확보됨(누락 없음, 재시도 불요)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | workflow manifest에 개별 사유 필드 미제공. diff 특성상(Dockerfile 주석 정정·JSDoc 재배치·테스트 2건·README/plan 문서) 성능 영향 표면 없음 |
  | architecture | 상동 — 구조적 변경 없음(로직 라인 변경 0건, JSDoc 재배치만) |
  | database | 상동 — DB 스키마/쿼리 접촉 없음 |
  | concurrency | 상동 — 비동기/동시성 코드 접촉 없음 |
  | api_contract | 상동 — API 계약(요청/응답 스키마) 변경 없음 |
  | user_guide_sync | 상동 — 사용자 가이드 문서 대상 변경 없음(README는 내부 패키지 개발자 문서) |