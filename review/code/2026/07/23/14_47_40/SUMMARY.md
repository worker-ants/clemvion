# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건. `codebase/` 제품 코드가 아닌 `.claude/` 리뷰 harness 자체(line-number gutter 도입)에 대한 변경이며, 신규 핵심 모듈(`line_anchors.py`)은 fail-open 설계와 실제 git 히스토리 재생 테스트로 두텁게 검증됨. 지적된 WARNING 은 전부 "신규 규약/상수가 여러 곳에 하드코딩되고 그 사이 drift 를 막는 테스트가 없다"는 유지보수성 성격의 사각지대이며 기능적 결함은 아님.

forced(router_safety) 화이트리스트 7명(security, requirement, scope, side_effect, maintainability, testing, documentation) 전원 결과 확보됨 — 강제 포함 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| - | - | 없음 | - | - |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | MAINTAINABILITY / DOCUMENTATION | "위치 표기 규약"(line-anchor gutter 사용 지침)이 SoT 없이 3곳에 흩어짐: 프롬프트 동적 주입 `LINE_ANCHOR_LEGEND`, 13개 `*-reviewer.md` hand-copy 블록, 그리고 본래 공통 규약을 담아야 할 `subagent-call-contract.md`(이번 diff 에서 미갱신). 13개 파일 상호간 byte-identical 여부만 테스트로 고정되고, `LEGEND` 워딩과의 일치·`subagent-call-contract.md` 반영 여부는 검증되지 않아 향후 한쪽만 수정되면 조용히 drift 가능 | `code_review_orchestrator.py:435-454`(LEGEND), 13개 `*-reviewer.md:29-31`, `.claude/docs/subagent-call-contract.md`(미변경) | `subagent-call-contract.md` 에 "위치 표기 규약" 섹션 신설해 SSOT 로 삼고 13개 reviewer `.md` 는 그 섹션을 인용하는 한 줄로 축소, 또는 최소한 LEGEND-vs-`.md` 교차검증 테스트 추가 |
| 2 | MAINTAINABILITY / TESTING | 게이트 오버헤드(+8%) 반영한 사이즈 상한 기본값(`55296`/`141557`)이 코드(계산식) · README.md · SKILL.md 세 곳에 각각 하드코딩되어 있고, 문서 두 곳의 숫자가 코드 상수와 일치하는지 검증하는 drift 테스트가 없음. `_GUTTER_OVERHEAD` 재조정 시 문서가 조용히 stale 해질 수 있음(프로젝트에 이미 `test_doc_sync_matrix.py` 등 유사 drift 가드 전례 있어 대조됨) | `code_review_orchestrator.py:72-74`(계산식), `README.md:206-207`, `SKILL.md:188-189` | README/SKILL.md 표 값을 코드 상수(`DEFAULT_MAX_FILE_SIZE`/`DEFAULT_MAX_PROMPT_SIZE`)와 비교하는 작은 drift 테스트 추가 |
| 3 | REQUIREMENT (코드-주석 불일치) | `_split_hunks` 의 "bare empty line" 방어 분기 주석이 `text.split("\n")` 의 trailing element 를 근거로 설명하지만, 실제 호출 경로는 `text.splitlines()`(트레일링 개행에 빈 문자열 미생성)를 사용해 주석이 서술하는 트리거 상황이 실제로는 발생하지 않음(사실상 도달 불가능한 방어 분기 또는 근거 설명 오류). fail-open 설계 덕에 기능적 결함(잘못된 번호 출력)으로는 이어지지 않음 | `line_anchors.py:122-127`(주석) vs `:199`(`text.splitlines()`) | 주석을 `splitlines()` 실제 동작 기준으로 정정하거나, 도달 불가능함을 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `DEBUG_LOG_FILE = "/tmp/code-review-agents-log.txt"` 예측 가능 경로(사전 존재 코드, 이번 diff 범위 아님) — 멀티유저 시스템에서 이론적 symlink race 여지 | `code_review_orchestrator.py`(사전 존재 상수) | 이번 범위 밖, 참고만 |
| 2 | SIDE_EFFECT | 잘림 안내 문구가 새 한국어 동적 문자열(`_truncated_note`)로 바뀌었으나, 같은 스킬 내 `lib/session.py::truncate_to_budget()` 는 여전히 옛 영어 문구를 기본값으로 사용 — 두 관례 공존(소비자 미겹침으로 실질 충돌은 없음) | `code_review_orchestrator.py:457-463` vs `lib/session.py:58` | 문구 통일 검토(maintainability 성격) |
| 3 | TESTING | `GutterCorrectnessAgainstRealGitTest`/`PromptPayloadIntegrationTest` 가 실제 저장소의 최근 커밋 히스토리·`--prepare` 실행 결과에 의존 — shallow clone/얕은 히스토리 CI 환경에서는 전제가 깨질 수 있음(현재 non-issue, 이식성 참고) | `test_line_anchors.py:224, 283` | 필요 시 "비-shallow 히스토리 전제"를 주석/README 에 명시 |
| 4 | TESTING | `build_files_section` 의 3개 truncation 분기(전체 파일 truncate/prompt 예산 diff truncate/`new_len<=0` diff 생략)가 `--prepare` 통합 테스트로만 간접 커버되고 분기별 결정적 단위 테스트가 없음 | `code_review_orchestrator.py:496,533,543,563` | 합성 `change_infos`+작은 사이즈 캡으로 각 분기를 직접 발동시키는 단위 테스트 추가 |
| 5 | DOCUMENTATION | README.md/SKILL.md 가 line-anchor gutter 기능 자체를 서술하지 않고 사이즈 상한 수치의 각주로만 존재를 암시 | `README.md:206-207`, `SKILL.md:188-189` | "위치 표기(라인 앵커)" 절 1-2문단 추가 |
| 6 | DOCUMENTATION | `.claude/tests/README.md` 의 prose-checking 예외 컨벤션 문단이 새 선례(`test_line_anchors.py::ReviewerDefinitionContractTest`)를 예시로 포함하지 않음 | `.claude/tests/README.md`(§Conventions) | 해당 문단에 새 선례 한 줄 추가 |
| 7 | MAINTAINABILITY | `line_anchors.py` 내 타입힌트 커버리지 불균일(`_gutter`의 `lineno`, `truncate_to_line_boundary` 반환 타입 미표기) | `line_anchors.py:77, 233` | `lineno: int \| None`, `-> tuple[str, int, int]` 표기 추가 |
| 8 | REQUIREMENT / SCOPE | 관련 `spec/` 문서 없음(정상 — `.claude/` 리뷰 harness 는 spec 스코프 밖) / `user-guide-sync-reviewer.md` 는 다른 출력 스키마(위치 필드 없음)라 이번 배선 대상에서 의도적으로 제외 / scope 리뷰어가 검토한 부수 변경(상수 추출, 사이즈 상한 조정, 13파일 반복) 전부 근거 있는 필연적 파생물로 스코프 이탈 없음 | 전체 diff / `user-guide-sync-reviewer.md:49-57` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 보안 이슈 없음 — 순수 텍스트 처리 도구, 신규 서드파티 의존성 없음, subprocess 는 리스트 인자로 인젝션 표면 없음 |
| requirement | LOW | 방어 분기 주석-구현 불일치(도달 불가 가능성) 외 전부 정상, 사이즈 상한 계산·문서 수치 직접 검증 일치 확인 |
| scope | NONE | 스코프 이탈 없음 — 부수 변경(상수 추출/사이즈 상한/13파일 반복) 전부 기능과 분리 불가능한 필연적 파생물 |
| side_effect | LOW | 사이즈 상한 조용한 상향·잘림 문구 언어 혼재 — 둘 다 문서화돼 있고 실질 충돌 소비자 없음 |
| maintainability | LOW | 위치표기 규약 이중 서술 + 사이즈 상한 삼중 하드코딩, 양쪽 다 drift 테스트 부재 |
| testing | LOW | truncation 3분기 단위테스트 부재, 문서-코드 상수 drift 가드 부재. line_anchors 자체는 두텁게 테스트됨 |
| documentation | LOW | 위치표기 규약이 SSOT(`subagent-call-contract.md`) 미반영, README 가 기능 자체보다 부수효과만 기록 |

## 발견 없는 에이전트

- security (NONE — 위 참고 INFO 1건만)
- scope (NONE — 위 참고 INFO 1건만)

## 권장 조치사항

1. "위치 표기 규약"을 `subagent-call-contract.md` 에 SSOT 로 신설하고 13개 reviewer `.md` 는 그 섹션을 인용하는 한 줄로 축소 — 또는 최소한 `LINE_ANCHOR_LEGEND` 와 `.md` 블록 간 교차검증 테스트 추가.
2. README.md/SKILL.md 의 사이즈 상한 하드코딩 수치(`55296`/`141557`)와 코드 상수(`DEFAULT_MAX_FILE_SIZE`/`DEFAULT_MAX_PROMPT_SIZE`) 간 drift 테스트 추가.
3. `line_anchors.py::_split_hunks` 의 방어 분기 주석을 실제 `splitlines()` 동작 기준으로 정정.
4. (선택) `build_files_section` 의 3개 truncation 분기(특히 `new_len<=0` diff 생략 분기)에 대한 결정적 단위 테스트 추가.
5. (선택) `lib/session.py::truncate_to_budget()` 의 잔존 영어 잘림 문구를 신규 한국어 컨벤션과 통일 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명 전원 — forced 전원 결과 확보됨, 미이행 없음)
  - **제외**: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 변경이 로컬 오프라인 텍스트 처리(정규식 파싱)로, 런타임 성능 관측 대상(사용자 트래픽 경로) 아님 |
  | architecture | 신규 모듈 1개 + 기존 오케스트레이터 배선 확장으로 아키텍처 구조 변경 없음(라우터 판단, 개별 사유 상세는 prompt 미제공) |
  | dependency | 신규 외부 패키지 도입 없음(표준 라이브러리만 사용) |
  | database | DB 관련 코드 변경 없음 |
  | concurrency | 동시성/락/레이스 관련 코드 변경 없음 |
  | api_contract | API 엔드포인트/DTO 변경 없음 |
  | user_guide_sync | 사용자 대상 제품 문서/가이드 변경 없음 — 대상은 개발자 전용 harness 내부 문서 |
