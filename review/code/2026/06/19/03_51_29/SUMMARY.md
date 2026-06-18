# Code Review 통합 보고서 (full re-review — refactor + fix 최종상태)

## 전체 위험도
**LOW** — 보안·아키텍처·테스팅 LOW, 범위·부작용·문서화 NONE. 리팩터링으로 공격 표면 확대 없음. Critical 0. Warning 7건은 **전부 maintainability-nicety 또는 pre-existing** (행위버그·신규 위험 아님).

> 본 세션(03_51_29)은 fix 커밋(`2ad44a71`) 후 **full re-review**. 첫 리뷰 `03_32_59`(MEDIUM·W6)의 Warning 은 `2ad44a71` 로 조치됨 — 그 RESOLUTION 참조.

## Critical 발견사항
해당 없음.

## 경고 (WARNING) — 전부 수용/이연 (회귀 아님)

| # | 카테고리 | 발견사항 | 처분 |
|---|----------|----------|------|
| 1 | Architecture | `StructuredInteraction` 타입이 button 서비스 파일에 정의(범용 타입인데 구체 구현 소유) → 순환 위험 | **이연(pre-existing)**: 타입은 본 refactor 이전부터 동 파일 거주. `shared/` 이동은 대형·별도 후속(타 소비자 영향). |
| 2 | Maintainability | `resolveButtonInteraction` let 4개 + if/else, CC~5 | **수용**: 4 variant 분기의 본질. helper 분리는 선택적 polish (함수 tested·명확). |
| 3 | Maintainability/Security | `payload as ButtonClickPayload` 캐스팅 잔류 + null/primitive 시 TypeError 가능 | **수용(회귀 아님)**: unknown→typed 경계 cast 는 sibling `form-interaction.service.ts` 컨벤션. null-risk 는 **원본 cast 도 동일**(pre-existing) — 상위 레이어 wire-shape 보장. 행위보존. |
| 4 | Maintainability | `isButtonClickPayload` describe 가 `resolveButtonInteraction` describe 내부 중첩 | **이연**: 테스트 구조 nicety. isButtonClickPayload 는 검증됨. |
| 5 | Maintainability | `NOW` 상수 2개 describe 중복 선언 | **이연**: trivial nicety. 수정 시 재무장 → 수렴 위해 보류. |
| 6 | Testing | `setStructuredOutput` 단언이 port 케이스에만 (link/fallback/item-level 통합 미검증) | **이연**: port 통합 + 순수함수 단위테스트(6)가 buildResumedStructuredOutput 전 분기 커버. |
| 7 | Testing | `buildResumedStructuredOutput` Array 분기 — 의도 계약인지 레거시인지 주석 없음 | **이연**: Array fallback 은 verbatim 보존된 기존 방어 코드. 주석 보강은 선택. |

## 참고 (INFO 주요)

- **I-1 [SPEC-DRIFT]**: 순수함수 추출(resolveButtonInteraction 등) spec 미등재 → `4-execution-engine.md §Rationale C-1` 에 한 줄 (**planner**).
- **I-2 [SPEC-DRIFT]**: `node-output.md §4.2` interaction.type 열거에 `button_continue` 누락(§4.5 엔 있음) — 코드는 §4.5 와 일치, §4.2 낡음 → **planner**.
- I-3~5 (보안: cast null-guard·buttonItemMap 인덱스 경계·에러메시지 입력값 — pre-existing), I-6~8/13 (Array 분기 문서화·updatedOutput 타입·테스트 cache 접근·JSDoc 분기), I-9 (buttonId optional 방어 — 조치 불요), I-10~12/14~17 (매직 문자열·`@param` 계약·doc 경로·테스트 주석·prevOutput.interaction 덮어쓰기 테스트). → 선택적/pre-existing.

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | LOW | cast null-guard·인덱스 경계·에러메시지 — 전부 INFO·pre-existing |
| architecture | LOW | StructuredInteraction 위치(W1, pre-existing)·Array 분기 문서화(INFO) |
| requirement | LOW | 순수함수 추출/§4.2 button_continue spec 미등재(SPEC-DRIFT INFO) |
| scope | NONE | 두 파일 단일 목적 수렴 |
| side_effect | NONE | 행위·부작용 무변 |
| maintainability | LOW | StructuredInteraction 위치·CC~5·cast·describe 중첩·NOW 중복 (W1-5) |
| testing | LOW | setStructuredOutput link 미검증·Array 분기 주석 (W6-7) |
| documentation | NONE | JSDoc 양호 |

## 처분 요약
- Critical 0. Warning 7건 **전부 수용/이연**(회귀 아님 — pre-existing/nicety/convention) → RESOLUTION dispositioning, **수렴**(추가 코드변경 0).
- SPEC-DRIFT INFO 2건 → **planner**.
- 라우터: 대부분 reviewer 실행, performance/dependency/database/concurrency/api_contract/user_guide_sync 등 무관 제외.

> (reviewer SUMMARY 전문은 transcript 보존. 본 파일 = main 멱등 persist — risk LOW, W7 전부 수용/이연.)
