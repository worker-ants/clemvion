# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 2건(테스트 신설 메시지 텍스트 미검증, 오래된 fail-open 에러 문구)은 회귀 안전성·디버깅 UX 관점의 개선 권고이며 기능적 결함이나 spec 불일치는 아님. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | 이번 diff 의 핵심 변경(메시지 생성 로직: `STATIC_IMPORT_MSG`/`DYNAMIC_IMPORT_MSG`/`REQUIRE_MSG`, `LAYERS_LABEL`, `RESOLUTION_HINT`)이 어떤 테스트에서도 `.message` 내용을 assertion 하지 않음. 두 스위트 모두 `errors.length`/`severity` 만 검증해, 변수 뒤바뀜·라벨 누락 같은 오타가 나도 47개 테스트가 그대로 통과함 | `codebase/frontend/eslint.config.mjs` (메시지 상수), `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts` (`layeringErrors`, `errorsAt`) | 최소 1개 케이스에서 `.message` 가 `LAYERS_LABEL`(`"src/lib/** · src/types/**"`) 과 spec 링크 문자열을 포함하는지 `toContain` 으로 고정 |
| 2 | documentation | fail-open 에러 메시지가 옛 `files: ["src/lib/**"]` 리터럴을 그대로 인용 — 실제 config 는 이제 `LOWER_LAYERS = ["src/lib/**", "src/types/**"]` 로 확장되어 텍스트가 현재 구성을 정확히 기술하지 못함. 검증 로직 자체는 무손상이나, fail-open 발동 시 디버깅하는 사람에게 잘못된 인상을 줄 수 있음 | `codebase/frontend/src/lib/__tests__/eslint-layering-guard.test.ts:67` | 메시지를 `` `files: ${JSON.stringify(LOWER_LAYERS)}` `` 형태로 파생시키거나 배열 확장 가능성을 반영하는 표현으로 변경 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 에러 메시지가 위반 계층을 특정하지 않고 `LOWER_LAYERS` 전체(두 계층)를 항상 함께 나열 — 현재는 두 계층 제약이 동일해 트레이드오프로 타당 | `codebase/frontend/eslint.config.mjs:45-51` | 현 상태 유지 가능. 계층별 예외가 생기면 블록 분리 검토 |
| 2 | architecture / maintainability / side_effect | 프로덕션 `eslint.config.mjs` 가 테스트 전용 named export(`LOWER_LAYERS`)를 노출해 config↔test 결합 발생. 의도된 SoT 단일화 패턴으로 문서화됨 | `codebase/frontend/eslint.config.mjs:43`, `eslint-layering-guard.test.ts:5` | 계층 수가 늘어 관리 비용이 커지면 별도 상수 모듈(`layering.constants.mjs`)로 분리 검토 |
| 3 | architecture | 경계 강제 방식(`no-restricted-imports`+`no-restricted-syntax` 수동 조합)이 경계 쌍 증가 시 선형 증식하는 한계. spec Rationale 에 이미 인지·유예 명시됨 | `eslint.config.mjs:146-187`, `spec/conventions/frontend-layering.md` Rationale | 경계 쌍 2개 이상으로 늘면 `no-restricted-paths` 등 zone 기반 도구로 재평가 (spec 에 이미 기록됨) |
| 4 | requirement | 메시지 문자열의 한국어 조사(`"은"`) 가 `LAYERS_LABEL` 항목 수 변화와 무관하게 고정 — 원본부터 있던 표기 이슈, 기능 영향 없음 | `eslint.config.mjs:50-52` | 선택적: 조사 없는 표현으로 변경 |
| 5 | requirement | spec §2 의 규약상 금지 방향과 CI 가드 실제 범위의 간극은 spec 이 스스로 명시한 의도된 설계(회색지대 아님) | `spec/conventions/frontend-layering.md` §2 | 조치 불필요 |
| 6 | scope | 메시지 상수 리팩터(`STATIC_IMPORT_MSG`/`LAYERS_LABEL`/`RESOLUTION_HINT`)가 최소 diff 이상이지만 스코프 확장의 필연적 파생 변경으로 근거 문서화됨 | `eslint.config.mjs` L16-27 부근 | 조치 불필요 |
| 7 | scope | 신규 "가드 스코프" 테스트 스위트(약 62줄)가 원 plan 예정보다 넓은 규모지만, 합성 config 의 스코프 검증 불가 문제를 메우는 근거가 3중 문서화됨 | `eslint-layering-guard.test.ts` L263-322 | 조치 불필요 |
| 8 | scope | plan 문서 이동이 단순 rename 이상(완료 기록·처분 확정 문단 추가)이나 PLAN 라이프사이클 규약이 요구하는 정상 사후 기록 | `plan/complete/spec-draft-frontend-layering.md` | 조치 불필요 |
| 9 | maintainability | `layeringErrors()`/`errorsAt()` 의 rule-id 필터 predicate 가 두 스위트에 중복 — 향후 규칙 추가 시 두 곳 手동 동기화 필요 | `eslint-layering-guard.test.ts` | `const LAYERING_RULE_IDS = [...] as const` 상수화 후 `.includes()` 로 재사용 (급하지 않음) |
| 10 | maintainability | `LOWER_LAYERS`/`EXPECTED_LOWER_LAYERS` 리터럴 중복은 mutation false-green 방지를 위한 의도된 예외로 근거 명확 | `eslint.config.mjs` vs `eslint-layering-guard.test.ts` | 조치 불필요 — 현 상태 유지 |
| 11 | testing | 신규 스코프 스위트에 `src/types-legacy/**`, `src/typescript/**` 같은 근접 오탐(near-miss) 경계 케이스 부재 — 기존 콘텐츠 스위트 대비 엄격성 비대칭 | `eslint-layering-guard.test.ts` 신규 `describe` 블록 | `it.each` 에 근접 디렉터리를 "차단되지 않아야 한다" 케이스로 추가 |
| 12 | testing | spec 이 명시한 `src/lib/types/` vs `src/types/` 혼동 지점에 대한 회귀 고정 테스트 없음 | `spec/conventions/frontend-layering.md` §1, `eslint-layering-guard.test.ts` | `"src/lib/types/probe.ts"` 가 `src/lib/**` 블록으로만 차단되는지 확인하는 케이스 추가 |
| 13 | documentation | spec 문서 내 PR 번호 각주 보존 정책이 §4 와 §4.1 사이에서 일관되지 않음 (한쪽은 유지, 한쪽은 제거) | `spec/conventions/frontend-layering.md` §4 vs §4.1 | 방침을 정해 두 곳 통일 (완전 제거 또는 둘 다 유지) |
| 14 | security | 이번 변경은 빌드타임 정적분석(ESLint) 설정·테스트·문서로만 구성, 런타임 사용자 입력·인증·네트워크 I/O 없음 — 점검 항목 8개 전부 해당 없음 | 전체 diff | 해당 없음 |
| 15 | side_effect | ESLint 가드 스코프 확장이 향후 `src/types/**` 기여자에게 새 lint 제약을 부과하는 정책 변경 — 실측 확인 결과 현재 위반 0건, 의도된 인터페이스 변경 | `eslint.config.mjs:146` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 런타임/보안 관련 코드 변경 없음, 빌드타임 정적분석 설정만 |
| architecture | LOW | 구조적 결함 없음. DRY/OCP 적용 양호, 확장성 트레이드오프는 spec 에 문서화됨 |
| requirement | NONE | 기능 완전성·엣지케이스·spec fidelity 실측 검증(lint/vitest 재실행) 통과, INFO 2건만 |
| scope | NONE | 7개 파일 전부 단일 의도(레이어 가드 확장+spec 승격)에 직접 연결, 무관한 수정 없음 |
| side_effect | LOW | 전역 오염/네트워크/시그니처 파괴 등 고전적 부작용 없음, lint 정책 확장은 의도된 인터페이스 변경 |
| maintainability | LOW | 리팩터가 문자열 중복을 정확히 해소, 네이밍/구조 견고, CRITICAL/WARNING 없음 |
| testing | LOW | 스코프 검증 gap(이전 리뷰 WARNING)은 정확히 메워짐(실측 mutation 재현 확인). 단, 메시지 텍스트 검증 부재(WARNING) |
| documentation | LOW | 문서 정합성 전반 우수. fail-open 에러 메시지 미갱신(WARNING) 1건 |

## 발견 없는 에이전트

없음 (security 는 위험도 NONE 이나 INFO 성격의 요약 발견사항 보유).

## 권장 조치사항

1. [testing WARNING] 메시지 생성 로직(`LAYERS_LABEL`/`RESOLUTION_HINT` 파생)에 대해 최소 1개 `.message` 내용 assertion(`toContain`)을 추가해, 변수 뒤바뀜·라벨 누락 같은 조용한 회귀를 테스트로 고정한다.
2. [documentation WARNING] `eslint-layering-guard.test.ts:67` 의 fail-open 에러 메시지를 `LOWER_LAYERS` 확장을 반영하도록 갱신한다 (`JSON.stringify(LOWER_LAYERS)` 파생 또는 일반화된 표현).
3. [testing INFO] 스코프 스위트에 `src/types-legacy/**`, `src/lib/types/**` 같은 근접 디렉터리 음성 케이스를 추가해 기존 콘텐츠 스위트와 동일한 엄격성 수준을 맞춘다.
4. [documentation INFO] spec 본문의 PR 번호 각주 보존 정책을 §4/§4.1 사이에서 통일한다.
5. 그 외 INFO 항목들은 이미 근거가 문서화된 의도된 트레이드오프로, 즉시 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨 — 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(ESLint 정적분석 설정)과 무관 |
  | dependency | 신규/변경 의존성 없음 |
  | database | 데이터베이스 관련 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | API 계약 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 없음 (개발자 전용 lint 설정) |