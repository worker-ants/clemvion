# Code Review 통합 보고서

## 전체 위험도
**LOW** — 대상 커밋(`c89f0ffb9`)은 직전 fresh 리뷰(session `11_30_32`)가 지적한 Warning 2건(다건 렌더 회귀 가드 복원, harness-checks 트리거 서술 정정)을 정확히 조치한 후속 정리 커밋이며, 6개 reviewer 전원이 CRITICAL/WARNING 없이 INFO(대부분 기존에 이미 식별·defer 된 저위험 잔여 갭)만 보고. maintainability reviewer 는 status=success 로 보고됐으나 output 파일이 실제로 존재하지 않아 내용 확인 불가(재시도 필요).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/requirement/documentation | `_gha_escape`/`_emit_annotations` 의 GHA 커맨드 property 값(`file=`) 이스케이핑이 `%`/`\r`/`\n` 만 처리하고 공식 `escapeProperty` 가 추가로 요구하는 `,`/`:` 는 미처리. `file` 값 출처가 저장소 내부 Playwright spec 경로(공격자 통제 불가)라 실질 익스플로잇 경로 없음. 직전 라운드(`11_30_32`)에서 이미 INFO 로 식별되어 RESOLUTION.md 에 "불가능 입력 방어 과잉 회피"로 명시적 미조치 처리됨 — 이번 diff 도 그 판단을 뒤집을 요소 없음 | `scripts/report_playwright_flaky.py` `_gha_escape()`/`_emit_annotations()` | 현행 유지. 완벽을 원하면 `file=` 전용 property-escape 변형 추가 가능(필수 아님) |
| 2 | security | `main()` 의 blanket `except Exception` 이 예외 `repr()` 을 stdout 에 출력하나 입력 소스가 Playwright 자체 생성 JSON 리포트라 시크릿/자격증명 노출 경로 없음(`BaseException` 은 보존) | `scripts/report_playwright_flaky.py` `main()` | 조치 불필요 |
| 3 | security/side_effect | 리뷰 산출물(`review/code/2026/07/10/11_30_32/_retry_state.json`, `meta.json` 등)에 로컬 워크트리 절대경로가 그대로 기록됨 — 자격증명 아닌 디렉터리 구조 정보이며 본 리뷰 파이프라인의 기존 표준 산출물 포맷(신규 도입 아님) | `review/code/2026/07/10/11_30_32/_retry_state.json`, `meta.json` | 조치 불필요(기존 관행) |
| 4 | testing | `test_emit_annotations_escapes_title` 내부에서 `contextlib`/`io` 를 로컬 import — 같은 파일의 다른 테스트는 모두 모듈 상단 import 라 컨벤션 불일치(동작 영향 없음) | `.claude/tests/test_report_playwright_flaky.py` `GhaEscapeTest.test_emit_annotations_escapes_title` | `contextlib`/`io` 를 파일 상단 import 블록으로 이동 |
| 5 | testing | 신규 `test_emit_annotations_escapes_title` 이 `::warning file=...,line=...::` 접두부와 escape 결과만 부분 문자열로 단언, 중간의 `"flaky (재시도 {retries}회 후 통과): "` 문구/`retries` 값 자체는 미검증 — 향후 이 문구가 실수로 손상돼도 테스트 통과 | `.claude/tests/test_report_playwright_flaky.py` `test_emit_annotations_escapes_title` | (저비용) `self.assertIn("재시도 1회", out)` 한 줄 추가 보강 가능, 필수 아님 |
| 6 | testing/documentation | `_location()`(markdown, `line==0` 시 `:line` 생략) vs `_emit_annotations()`(`line=0` 그대로 출력)의 렌더 비대칭이 여전히 테스트/주석으로 고정되지 않음. 이전 라운드부터 추적돼 온 항목이며 이번 커밋의 RESOLUTION.md 도 "미조치(정당)"로 명시 defer | `scripts/report_playwright_flaky.py` `_location()`/`_emit_annotations()` | 필요 시 `line=0` 케이스 테스트 추가 + 근거리 주석 1줄(다음에 이 함수를 만질 때). 이번 라운드 조치 불필요 |
| 7 | documentation | `_spec()` 테스트 헬퍼 docstring 이 파라미터 의미 설명 없이 한 줄로 축약된 상태가 잔존 — 직전 라운드에서 이미 식별·RESOLUTION.md 로 명시적 defer 된 항목이며 이번 조치 목록 밖 | `.claude/tests/test_report_playwright_flaky.py:27-28` `_spec()` | 추가 조치 불필요(이미 defer 결정됨). 다음에 만질 때 1줄 복원 고려 |
| 8 | requirement | 관련 spec 문서 부재 — 이 변경은 제품 요구사항이 아닌 CI 관측 도구 후속 조치이며 governing plan frontmatter 가 `spec_impact: none` 으로 명시해 SDD 컨벤션과 정합 | `spec/` (검색 결과 관련 문서 0건), `plan/complete/e2e-retry-visibility-followup.md` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | property-escape 잔여 갭(기존, defer) 외 하드코딩 시크릿/인젝션/인증 이슈 없음 |
| requirement | NONE | W1/W2 fix 를 fresh 코드 대조·테스트 재실행(20/20, 183/183)으로 검증, 신규 결함 없음 |
| scope | NONE | 커밋 범위가 커밋 메시지와 1:1 대응, 스코프 일탈 없음 |
| side_effect | NONE | 신규 전역상태/파일시스템/네트워크 부작용 없음, 기존 부작용 범위·순서 불변 |
| maintainability | **재시도 필요** | status=success 로 보고됐으나 output 파일(`maintainability.md`) 실제 부재 — 내용 확인 불가 |
| testing | NONE | W1/W2 정확 반영 확인(fresh 실행 재검증), 남은 것은 저위험 INFO 3건뿐 |
| documentation | LOW | RESOLUTION.md 기록과 실제 diff 라인 단위 대응 확인, CI 배선 실측 대조 일치, 남은 것은 이미 defer 된 INFO 2건뿐 |

## 발견 없는 에이전트

scope, side_effect, testing, requirement — CRITICAL/WARNING 없음 (NONE/LOW 등급, INFO 만 존재)

## 권장 조치사항

1. maintainability reviewer 결과가 status=success 로 보고됐음에도 output 파일이 디스크에 없다 — 다음 `/ai-review` 실행 시 이 discrepancy(플젠 위양성 success) 를 확인하고, 필요하면 maintainability reviewer 를 재실행해 실제 내용을 확보할 것. 이번 라운드에서 push 를 막을 CRITICAL/WARNING 근거는 없으나 감사 추적 공백으로 기록.
2. (저비용, 선택) `test_emit_annotations_escapes_title` 의 로컬 import 를 파일 상단으로 이동해 컨벤션 일관성 확보.
3. 나머지 INFO 항목은 전부 기존에 식별·RESOLUTION.md 로 명시적 defer 된 저위험 잔여 갭이므로 이번 라운드에서 추가 조치 불필요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (문서 파일 변경 + 소스 코드 변경 시 상시 강제 규칙에 의해 이 7개 전원이 강제 포함됨 — 실질적으로 router 의 자유 선택 없이 전원 강제)
  - **제외**: 표 (7명, 이번 diff — CI 스크립트(`scripts/report_playwright_flaky.py`) 및 테스트 파일 변경 범위에 해당 영역이 관련 없다는 router 판단. `_routing_decision.json` 이 세션 디렉터리에 없어 항목별 상세 사유 원문은 확인 불가, 아래는 diff 성격에 기반한 추정 사유)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 순수 import 재배치/docstring/주석 변경 — 성능 특성 변화 없음 |
  | architecture | 아키텍처/모듈 경계 변경 없음(단일 CI 스크립트 내부 정리) |
  | dependency | 신규/변경 서드파티 의존성 없음(stdlib 전용) |
  | database | DB 스키마/쿼리 관련 파일 변경 없음 |
  | concurrency | 동시성/병렬 처리 로직 변경 없음 |
  | api_contract | 공개 API/엔드포인트 계약 변경 없음(CI 내부 스크립트) |
  | user_guide_sync | 사용자 대면 기능/문서 변경 없음(CI 관측 도구, spec_impact: none) |