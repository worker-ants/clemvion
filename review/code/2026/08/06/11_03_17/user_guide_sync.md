# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json`(`rows[]`, 22개 행) 을 Read 하고 PROJECT.md §변경 유형 → 갱신 위치 매핑 본문을 보조로 확인했다. 매트릭스의 모든 trigger 는 `codebase/backend/**`, `codebase/frontend/**`, `codebase/packages/expression-engine/**`, `spec/2-*`~`spec/5-*`, `spec/conventions/**`, `codebase/channel-web-chat/**` 등 **제품 코드/스펙/유저 가이드 트리** 안에서만 발화한다 (glob 매칭 행) 또는 그 트리에 대한 semantic 판단(신규 노드, i18n, 통합/제공자, 인증 흐름, 표현식 언어, 실행/디버깅 흐름, warning/error code, 신규 섹션 디렉토리, cross-cutting enum, GUI 흐름 절 등)이다.

## 변경 파일 식별
본 리뷰 payload 에 포함된 8개 파일 전체:

1. `.claude/tests/README.md`
2. `.claude/tests/test_block_integrity.py`
3. `.claude/tests/test_review_gate_ci.py`
4. `.claude/tests/test_stop_guard_failopen.py`
5. `.github/workflows/harness-checks.yml`
6. `.github/workflows/review-gate.yml`
7. `plan/in-progress/harness-review-gate-ci-backstop.md`
8. `scripts/check-review-gate.py`

## trigger 매칭
8개 파일 전부 `.claude/**`, `.github/workflows/**`, `plan/**`, `scripts/**` 경로에 위치한다. 이들은 **harness(자동화 계층) 자체의 자기 테스트·CI 워크플로·작업 plan**이며, 매트릭스의 22개 trigger 행 중 어느 것의 glob 도 이 경로들을 포함하지 않는다 (`codebase/`, `spec/` 하위만 존재). semantic 행(통합/제공자 변경, 인증·권한·세션 흐름 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경, cross-cutting enum, backend zod ui 값, handler output field, spec 결함 등) 도 모두 **제품 런타임 코드/스펙**을 대상으로 정의돼 있어, `review-gate.yml`(CI 워크플로)이나 `check-review-gate.py`(리뷰 게이트 스크립트), `test_review_gate_ci.py`/`test_block_integrity.py`/`test_stop_guard_failopen.py`(하네스 자기 테스트), `.claude/tests/README.md`(하네스 테스트 카탈로그 문서), `plan/in-progress/harness-review-gate-ci-backstop.md`(작업 plan) 어느 것도 해당하지 않는다.

내용 확인 결과도 이를 뒷받침한다: 이번 변경은 "로컬 push 훅이 평가하는 `review_guard.evaluate_review()` 를 GitHub PR 이벤트로 트리거하는 훅-독립 CI 백스톱"을 다루는 하네스/CI 인프라 작업(라운드 5, `review-gate.yml`/`check-review-gate.py`/그 테스트들)이다. 노드 추가, 프론트엔드 TSX, i18n dict, docs MDX, 표현식 엔진, 인증 모듈, 백엔드 API/DTO, warningRules/error-codes.ts 등 매트릭스가 감시하는 어떤 대상도 변경 set 에 없다.

## 판정
영역 무관 — 해당 없음. 매트릭스의 22개 trigger 행 중 매칭되는 행이 없으므로 유저 가이드(docs MDX)·i18n dict·backend-labels.ts 동반 갱신 검토 대상 자체가 존재하지 않는다.

## 발견사항
없음.

## 요약
매트릭스 22개 trigger 행을 전수 대조했으나 이번 변경(8개 파일, 전부 `.claude/tests/**` · `.github/workflows/**` · `scripts/**` · `plan/**` 하네스/CI 인프라)은 어느 trigger 에도 매칭되지 않았다 — 매칭 0건, 누락 0건. 이는 review-gate CI 백스톱(GitHub Actions 훅-독립 게이트)에 대한 harness 내부 작업으로, `codebase/`·`spec/` 트리를 전혀 건드리지 않아 User Guide Sync 관점에서는 검토 대상 밖이다.

## 위험도
NONE
