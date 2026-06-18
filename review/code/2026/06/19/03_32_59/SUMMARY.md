# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `buildResumedStructuredOutput` 직접 단위 테스트 전무 + 여러 엣지 케이스 미커버. 기능·보안·아키텍처 위험은 없으나(순수 refactor, 행위보존) 테스트 갭이 실질적이다.

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 처분 |
|---|----------|----------|------|------|
| 1 | Testing | `buildResumedStructuredOutput` 직접 단위 테스트 전무 (previousOutput 체인 방지·Array fallback·meta 조건부 등 비자명 분기 미검증) | spec | **조치**: 독립 describe 추가(prevStructured undefined/Array/previousOutput 제거/prevMeta 유무/port·status·config 보존 ≥5) |
| 2 | Testing | `processButtonResumeTurn` 테스트에 `setStructuredOutput` assertion 없음 | spec | **조치**: port 케이스에 spy + 핵심 필드 단언 |
| 3 | Testing | `buttonId` undefined 인 `button_click` 경로 미검증 | service L133 | **조치**: `{type:'button_click'}` 케이스 추가 |
| 4 | Testing | link + item-level(selectedItem) 조합 미검증 | service | **조치**: link+selectedItem 케이스 추가 |
| 5 | Maintainability | `resolveButtonInteraction` describe 중복(2회 실행) 주장 | spec | **FALSE POSITIVE** — 실측 1회(L483). reviewer 줄번호 환각. 조치 불요 |
| 6 | Security/Type-safety | `payload.buttonId!` non-null assertion — buttonId 누락 시 INVALID_BUTTON_ID 로 "누락"="unknown ID" 혼선 | service L133 | **조치(행위보존)**: `clickedButton.id`(find 성공 후 확정 string) 사용으로 `!` 제거. reviewer 제안(MISSING_BUTTON_ID/required)은 행위변경이라 미채택 |

## 참고 (INFO 주요)

- **I-1 [SPEC-DRIFT]**: `button_continue` data shape — `4-nodes/6-presentation/0-common.md §4` 는 `url` 필수, `conventions/node-output.md §4.5` 는 `url?` 조건부. **코드·테스트는 node-output.md(조건부)와 일치, 0-common.md 가 낡음** → **planner** (0-common.md §4 표 수정).
- I-2/I-18 (StructuredInteraction 타입 위치 → shared/ 이동 검토), I-3 (buildResumedStructuredOutput read-timing 의존 — 의도적 문서화됨, 허용), I-4 (6-ary positional → options 객체), I-5/I-6 (보안: 에러메시지 사용자입력·node.config 전달 — pre-existing), I-10~14 (maintainability: 중복 베이스값·let 거리·rawPrevOutput 복잡도·`now` 명·테스트 언어혼용), I-15~17 (doc: StructuredInteraction JSDoc·@returns·dead link 참조). → 대부분 선택적/pre-existing, 본 PR defer.

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| testing | MEDIUM | buildResumedStructuredOutput 단위 전무·setStructuredOutput 단언 없음·엣지 미커버 |
| maintainability | LOW | describe 중복 주장(FALSE POS)·buttonId! 의미 불일치 |
| side_effect | LOW | buttonId! 에러메시지 모호, 기타 부작용 없음 |
| requirement | LOW | button_continue spec 두 문서 불일치(SPEC-DRIFT)·buildResumedStructuredOutput 격리테스트 부재 |
| security | LOW | 에러메시지 사용자입력(CWE-209 잠재)·런타임 타입검증 — INFO |
| architecture | NONE | 순수함수 추출 SRP 명확 |
| scope | NONE | 범위 적절 |
| documentation | NONE | JSDoc 양호, @returns 누락 등 보완 권고 |

## 처분 요약
- Warning #1-4(테스트)·#6(타입안전 행위보존) → **조치**(fix 커밋 → 재리뷰).
- Warning #5 → FALSE POSITIVE(실측 단일 describe).
- INFO SPEC-DRIFT(button_continue 0-common.md) → **planner**.
- 그 외 INFO → 선택적/pre-existing defer.

> (원본 reviewer SUMMARY 전문은 review 산출 transcript 에 보존. 본 파일은 main 의 멱등 persist — risk MEDIUM, Warning 6, 처분 명시.)
