# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. `testing` reviewer 가 self-test fixture 커버리지 보강 여지를 이유로 LOW 를 매겼을 뿐, 기능적 결함이나 회귀는 발견되지 않았다(전체 findings 는 모두 INFO). router_safety 강제 화이트리스트 7개(`documentation`/`maintainability`/`requirement`/`scope`/`security`/`side_effect`/`testing`) 전원 실행·결과 전문 확보 완료 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## SPEC-DRIFT

| # | 발견사항 | 위치 | 제안 |
|---|----------|------|------|
| 1 | [SPEC-DRIFT] spec 본문이 이 가드를 1차 명칭으로 "AST 가드"라 5회 불러왔으나 검증 동작 서술은 "grep"(§1.2 rule 3, §2.1 `system_error`/`rag` 행, §5 rule 2·마지막 문단)으로 남아 있었음. 이번 diff 로 구현이 실제 `ts.createSourceFile` AST 파싱이 되면서 코드가 spec 의 1차 명칭에 도달 — 방향 판별상 "코드가 맞고 spec 의 부차 서술(grep)이 낡음". 계약·매트릭스·등록 사이트·enum 목록은 불변이라 의미 충돌 아님. 5개 독립 consistency checker(`review/consistency/2026/07/17/19_54_00/`)가 이미 동일 결론에 수렴했고 plan 문서 "후속" 절에 project-planner 위임으로 명시 이월됨 | `spec/conventions/interaction-type-registry.md` §1.2 rule 3, §2.1, §5 | 코드 되돌리기 대상 아님. project-planner 트리비얼 doc-sync 로 "grep" 계열 표현을 "AST 스캔"/"등록 사이트 파일"/"AST 파싱 결과" 등으로 정리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | diff 범위 밖 인접 소스 파일에도 동일 명명 이슈("grep 가드") 잔존 — 이번 PR 은 대상 테스트 파일 자체는 전수 갱신했으나 이 파일은 손대지 않음 | `codebase/frontend/src/lib/conversation/interaction-type-registry.ts` JSDoc·`IS_MULTI_TURN_INTERACTION` 위 주석 | 차단 아님. 후속 커밋에서 "grep 가드" → "AST 가드"/"literal-scan" 정정 권장(developer 소유 파일이라 스펙 위임 불요) |
| 2 | requirement, testing | self-test fixture 가 함수 docstring 이 주장하는 커버리지(switch case·union 타입 선언·객체 프로퍼티 값·`return`·삼항)보다 좁음 — `===` 비교와 template literal + 6종 comment 형태만 직접 검증. 실제 exhaustiveness 테스트가 저장소 파일을 통해 간접 검증하지만, 파일 리팩터로 그 형태가 사라지면 회귀 감지력도 조용히 사라짐 | `interaction-type-exhaustiveness.test.ts` `describe("collectCodeStringLiterals", ...)` | 선택적. fixture 에 union 타입 선언(`type X = "literal_type_value"`)·객체 프로퍼티 값(`{ key: "prop_value" }`) 등 1~2줄 추가 |
| 3 | testing | 설계 rationale 이 스스로 리스크로 지목한 "정규식 리터럴 오파싱"(`conversation-utils.ts` `/\[\/?user-input\]/g`, `use-execution-events.ts` UUID_REGEX) 비오염을 직접 검증하는 fixture 케이스가 없음 | `describe("collectCodeStringLiterals", ...)` fixture | fixture 에 `const re = /real_literal/;` 류를 추가해 정규식 리터럴 값이 `literals` Set 에 안 들어감을 명시적으로 단언하면 채택 근거가 self-test 로 완결됨 |
| 4 | testing | `ts.ScriptKind.TS` 하드코딩 — 현재 4개 registry site 전부 `.ts` 라 문제 없으나, 향후 `.tsx` 등록 사이트가 추가되면 JSX 태그/타입 단언 모호성으로 파싱이 실제와 달라질 수 있음(fail-closed 방향이라 최악도 거짓 실패 쪽) | `collectCodeStringLiterals` 함수 본문(`ts.ScriptKind.TS` 고정) | 당장 조치 불요. 향후 `.tsx` 확장 시 `fileName.endsWith(".tsx") ? TSX : TS` 분기 + self-test 케이스 추가 권장 |
| 5 | maintainability | 두 `describe` 블록(`WaitingInteractionType`/`ConversationTurnSource`)이 site/enum 목록과 에러 메시지만 다르고 구조적으로 완전히 중복(이번 diff 가 새로 만든 중복은 아니고 기존 정규식 버전의 구조를 그대로 이식) | `interaction-type-exhaustiveness.test.ts:134-155`, `:173-194` | 이번 PR 을 막을 사유 아님. 다음에 파일을 건드릴 때 `assertExhaustive(sites, values, guardName, sotRef)` 공용 헬퍼로 추출 권장 |
| 6 | testing | self-test 가 단일 `it` 블록에 5개 ghost + 2개 real 케이스를 결합 — 실패 시 원인 파악 자체는 가능하나 `it.each`/개별 `it` 분리 시 "어느 주석 형태가 새로 새는지" 테스트명만으로 즉시 파악 가능 | `describe("collectCodeStringLiterals", ...)` 내부 단일 `it(...)` | 선택 사항. 차단 아님 |
| 7 | maintainability | self-test fixture 를 문자열 배열 + `join("\n")` 으로 구성한 의도(백틱·홑따옴표·쌍따옴표 혼재 시 템플릿 리터럴 이스케이프 회피)를 설명하는 인라인 주석 없음 | `interaction-type-exhaustiveness.test.ts:107-115` | 선택 사항. 한 줄 주석 추가 권장, 필수 아님 |
| 8 | scope | 가드 메커니즘 자체를 검증하는 self-test 신규 추가는 "정규식→AST 리터럴 전환"이라는 원 지시의 직접 산출물은 아니나, plan 문서가 회귀 방지 근거(PR #968 finding 을 executable property 로 인코딩)를 명시해 over-engineering 아님 | `interaction-type-exhaustiveness.test.ts` 신규 `collectCodeStringLiterals` + self-test | 조치 불요. 투명성 차원의 기록 |
| 9 | maintainability | 저장소 내 유사 가드(`ui-label-parity.test.ts`, `migrations.md` SQL_NAME_RE)는 여전히 regex 기반이라 동일 패턴에 두 기법(regex vs AST)이 공존 — consistency checker 가 이미 규약 위반 아님을 확인 | 교차 파일 참고 | 조치 불요. 다른 가드까지 AST 로 통일하는 것은 이번 PR 스코프 밖의 별도 논의 사안 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | vitest 3/3 pass + mutation 실측(실 분기 mutate→red 전환 재현)으로 실제 동작 검증. SPEC-DRIFT wording 1건 외 결함 없음 |
| scope | NONE | 핵심 변경은 지시된 범위(정규식→AST)에 정확히 집중. self-test 추가·JSDoc 정정·plan/consistency 산출물 동반 모두 정당한 필수 동반 변경 |
| side_effect | NONE | test-only 파일 내부로 완전히 격리, `collectCodeStringLiterals` 순수 함수, production 코드·공개 API·환경변수·네트워크 미영향 |
| maintainability | NONE | 정규식→AST 전환 자체가 명확한 개선. 사소한 리팩터 기회(중복 describe 블록, 인라인 주석 부재)만 잔존 |
| testing | LOW | self-test 가 PR #968 핵심 결함(주석 false-negative)을 실행 가능한 property 로 영구 고정한 모범 사례. fixture 커버리지 보강 여지(union 타입/정규식 비오염/.tsx)만 잔존 |
| documentation | NONE | 대상 파일 JSDoc·주석 전수 정확히 갱신 확인(오래된 "grep" 표현 0건). spec 본문 wording 후속은 이미 project-planner 로 추적 중 |
| security | NONE | CI 전용 정적 분석 테스트, 프로덕션 공격 표면 무관. 이전 정규식의 이론적 값-삽입 표면도 이번 전환으로 제거됨(긍정적 부수효과) |

## 발견 없는 에이전트

- security — "발견사항: 없음" 명시 (인젝션·시크릿·인증/인가·입력검증·암호화·의존성 보안 전 항목 검토, 조치 필요 사항 없음)

## 권장 조치사항

1. (project-planner, 트리비얼) `spec/conventions/interaction-type-registry.md` §1.2 rule 3 / §2.1 두 행 / §5 rule 2·마지막 문단의 "grep" 계열 표현을 "AST 스캔"/"등록 사이트 파일"/"AST 파싱 결과" 로 정정 — 코드 revert 아님, spec wording 갱신
2. (선택, developer 후속) `interaction-type-registry.ts` 상단 JSDoc·`IS_MULTI_TURN_INTERACTION` 주석의 "grep 가드" 표현을 "AST 가드"로 정정
3. (선택) `collectCodeStringLiterals` self-test fixture 에 union 타입 선언·객체 프로퍼티 값·정규식 리터럴 비오염 케이스를 추가해 docstring 이 주장하는 커버리지와 rationale 이 지목한 리스크를 직접 고정
4. (선택, 향후) 등록 사이트가 `.tsx` 로 확장될 경우를 대비해 `ts.ScriptKind` 확장자 기반 분기 추가
5. (선택) 두 exhaustiveness `describe` 블록을 `assertExhaustive` 공용 헬퍼로 통합해 중복 제거 — 다음에 이 파일을 건드릴 기회에

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 router_safety 강제 포함이며 결과 전문 확보 완료)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 forced, 전원 결과 확보됨 (미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 test-only 파일(순수 정적 분석 가드) 교체로 성능 영향 표면 없음 |
  | architecture | 기존 파일 내부 헬퍼 함수 교체로 아키텍처 레이어·경계 변경 없음 |
  | dependency | 신규 의존성 추가 없음(`typescript` 는 기존 devDependency 재사용) |
  | database | DB 접근·쿼리·마이그레이션 변경 없음 |
  | concurrency | 비동기/동시성 로직 변경 없음(순수 동기 AST 파싱) |
  | api_contract | 공개 API·엔드포인트·DTO 계약 변경 없음 |
  | user_guide_sync | 사용자 가시 동작·UI 문자열 변경 없음(내부 테스트 가드 메커니즘 교체) |

---

## 산출 경위 + main 의 독립 검증 (main 기록)

Workflow 반환의 `summary_written: false` / `summary_status: STATUS=write_blocked` — 하네스가 `SUMMARY.md` basename 을 sub-agent 에게 write 허용하지 않으므로, 본 파일은 main 이 반환 `summary_markdown` 을 그대로 persist 한 것이다 (ai-review skill §3 규약).

**분류기 장애 중 router 실행 경고 대응**: 본 run 의 router 는 `claude-opus-4-8`(안전 분류기) 장애 구간에 실행돼 하네스가 "이 sub-agent 의 출력을 직접 검증하라" 경고를 붙였다. main 이 독립 확인한 사항:

- `agents_forced`(7) 와 실제 실행 reviewer(7) 집합이 **일치** — router 가 override 할 수 없는 강제 화이트리스트 불변식이 지켜졌다.
- `forced_missing: []`, `unfinished: []`, `recovered: []`, reviewer 7명 전원 `has_report: true` — disk-write 갭으로 인한 카운트 누락(거짓 clean) 없음.
- 스킵된 7명의 사유가 변경 성격(test-only 정적 가드 파일 1개)과 정합.

따라서 본 SUMMARY 의 CRITICAL=0 / WARNING=0 은 "리뷰어가 실행되지 않아 0" 이 아니라 "실행된 7명이 0건 보고" 다.
