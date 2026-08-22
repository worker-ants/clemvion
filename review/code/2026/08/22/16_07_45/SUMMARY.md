# Code Review 통합 보고서

## 전체 위험도
**LOW** — 프로덕션 코드 변경 없음(테스트 전용 diff, 76/76 GREEN, 뮤테이션 실측으로 판별력 확인). Critical 0건. WARNING 2건은 모두 코드가 아닌 plan 트래커 문서에서의 스코프 확장(무관 결정 기록 + 요청 범위를 넘는 백로그 37건 일괄 재판정)이며 즉각적 리스크는 낮음. forced(router_safety) 화이트리스트 7개 전원 결과 확보 완료 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | scope | 이 작업의 명시 목표(backend `deepRedactSecrets` 깊이 경계 테스트 추가)와 무관한 신규 결정 — 두 Manual 엔드포인트(`re-run`/`execute`)의 `error.code` 를 `INVALID_TRIGGER_PARAMETERS` 로 통일하는 breaking change 결정을 같은 커밋 계열(`5d5d4565f`)에서 트래커에 새로 기록 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (결정 노트 절, "결정됨 (2026-08-22, 사용자)"부터 "집행은 별 PR" 까지) | 무관 결정 기록은 별도의 작은 planner/plan 전용 커밋으로 분리하거나, 최소한 PR 설명에 "redact 테스트 + 무관 트래커 결정 1건 포함"임을 명시. 코드 변경은 없고 "집행은 별 PR" 로 명시돼 즉각 리스크는 낮음 |
| 2 | scope | 같은 커밋에서 consistency-check 가 요구한 범위(L192 항목 1건 `[x]` 전환)를 넘어 트래커의 미체크 항목 37건 전부를 재판정하는 절을 신규 추가 — `result.outputs` 미구현, 분산 SSE fan-out, HMAC §8.2 등 완전히 무관한 항목들까지 함께 재검토 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — "미체크 항목 재판정 (2026-08-22, backend-redact-depth-boundary)" 절 전체 | 규모가 크면(37건) 별도 `chore(plan)` PR 로 분리하거나 최소한 PR 설명에 "부수 grooming 작업"임을 명시. 문서화 품질 자체는 높고 잘못된 재판정은 발견되지 않음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 신규 테스트가 검증하는 depth-boundary redaction 로직을 프로덕션 `deepRedactCore` 와 직접 대조 — 문자열 리프는 깊이 무관 항상 값-패턴 검사, 컨테이너만 상한 초과 시 서브트리 통째 마스킹. 두 경로 모두 새는 지점 없음(fail-closed 방향 회귀 방어 확인) | `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:301-382`, `sanitize-error-message.ts:259-272` | 조치 불필요 |
| 2 | security | 테스트 픽스처의 "비밀" 값은 전부 명백한 가짜/예시 문자열(`hunter2`, `AKIAEXAMPLE` 등) — 실제 자격증명 유출 없음 | `sanitize-error-message.spec.ts` 전체 | 조치 불필요 |
| 3 | security | `review/consistency/2026/08/22/15_35_56/**` 산출물이 마스킹 알고리즘 내부 좌표(경계 연산자·상수 위치)를 평문 기술하나, 이미 프로덕션 JSDoc 에 동일 정보 공개돼 있어 추가 노출 없음 | `review/consistency/2026/08/22/15_35_56/*.md` | 조치 불필요 |
| 4 | requirement | 경계 테스트 제목의 방향 표현("한 칸 위(-1)")이 실제로는 상한보다 한 칸 **아래**(`MAX_REDACT_DEPTH - 1`)를 검사 — 괄호 `(-1)` 표기로 disambiguate 되어 실질적 오독 위험은 낮음 | `sanitize-error-message.spec.ts:307` | (선택) "한 칸 아래(-1)" 로 표현 다듬기 |
| 5 | maintainability | `nestObj`/`nestArr`/`nestMixed` 세 헬퍼가 구조적으로 거의 동일한 루프 반복(래핑 표현식만 다름) | `sanitize-error-message.spec.ts:276-292` | 현재도 각 3줄로 짧고 JSDoc 으로 의도 명확 — 넷째 분기 추가 시에만 공통 헬퍼 추출 고려 |
| 6 | maintainability | 스택 오버플로 회귀 테스트의 깊이 값(`5000`)이 리터럴 — 다만 바로 위 JSDoc 이 실측 근거(#1188, JSON.parse 는 100,000 통과·재귀는 5,000 에서 터짐)를 상세히 설명해 매직넘버치고 이례적으로 잘 문서화됨 | `sanitize-error-message.spec.ts:379` | 이 값이 재사용될 경우에만 `STACK_OVERFLOW_PROBE_DEPTH` 상수로 승격 권장 |
| 7 | maintainability | 경계 쌍 검증 테스트 입자성이 object 분기(별도 `it` 2개)와 array 분기(`it` 1개+`expect` 2개)에서 다름 — 리포트 가독성 관점의 사소한 비일관 | `sanitize-error-message.spec.ts:301,307` vs `:336` | (선택) array 분기도 두 개의 `it` 로 분리 |
| 8 | testing / side_effect | 스택오버플로 회귀 테스트가 5,000-깊이 트리를 `run()` 호출 2회(`not.toThrow()`+`toEqual()`)로 매번 새로 생성·순회 — 실질 비용은 낮음(실제 재귀는 상한 10에서 조기 종료, 스위트 전체 실행 0.18~0.2s) | `sanitize-error-message.spec.ts:377-382` | (선택) 트리 생성을 변수로 캐시해 1회 호출로 축소 가능, 우선순위 낮음 |
| 9 | testing | 세 번째 깊이 상한(`MAX_SANITIZE_DEPTH`, `websocket.service.ts`)에는 대응 경계 테스트가 이번 diff에 없음 — plan 문서에 "건드리지 않는다"는 명시적 스코프 결정으로 확인됨, 갭이 아니라 의도된 범위 | `plan/complete/masked-marker-shared-package.md:79-93` | 조치 불필요 — 향후 WS sanitizer 작업 시 동일 패턴(경계 상수 import + 순서/연산자 뮤턴트 대조) 적용 근거로 참고 |
| 10 | testing | `deepRedactCore` 는 비공개 함수, 새 테스트는 공개 API(`deepRedactSecrets`)로만 경계 검증 — 바람직한 설계(내부 구현 미노출), 판별력도 뮤턴트 실측으로 충분 확인 | `sanitize-error-message.ts:259` | 조치 불필요 |
| 11 | side_effect | 모듈 레벨 `WeakMap` 캐시(`DEEP_REDACT_CACHE`)가 depth-0 전용 키인데, 테스트 헬퍼가 매 호출 새 wrapper 객체를 생성하므로 leaf 재사용이 캐시 오염으로 이어지지 않음 확인 | `sanitize-error-message.ts:202,227`, 테스트 헬퍼 전반 | 조치 불필요 — 향후 `PLAIN_SUBTREE` 를 depth-0 인자로 직접 재사용하는 테스트 추가 시에만 재검토 |
| 12 | scope | `plan/in-progress/{masked-marker-shared-package,mirror-guard-single-copy}.md` → `plan/complete/` 이동은 이 작업의 후속 체크리스트 항목을 올바른 위치에서 닫기 위한 정당한 선행 조건(머지 SHA·라운드 수 등 근거 명시됨) | `plan/complete/*.md` (신규), `plan/in-progress/*.md` (삭제) | 조치 불필요 |
| 13 | scope | 핵심 코드 변경(`sanitize-error-message.spec.ts`, +149줄)은 순수 테스트 추가로 목표에 정확히 부합, 스코프 이탈 없음 | `sanitize-error-message.spec.ts` | 조치 불필요 |
| 14 | documentation | egress 마스킹 규약(마커 3종·깊이 상한 SoT·경계 연산자)이 정식 `spec/conventions/**` 문서 없이 코드 JSDoc 에만 존재 — `--impl-prep` consistency 라운드가 낸 기존 WARNING 을 트래커에 등재만 함, developer 권한 밖(planner 판단)이라 정당하게 보류 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:825` | 조치 불필요 — 다음 planner 턴에서 신설 여부 확인 |
| 15 | documentation | 신규 테스트 설명 블록이 헤더/표 포함 긴 Markdown 을 TS 블록 코멘트 안에 담아 IDE hover 등에서 표가 정상 렌더링되지 않음 — 파일 자체 및 프로덕션 코드의 기존 스타일과 일치 | `sanitize-error-message.spec.ts:240-273` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | fail-closed 로직 확인, 가짜 시크릿 픽스처, 추가 정보 노출 없음 |
| requirement | NONE | 8개 신규 테스트 전부 구현과 line-level 일치, 뮤턴트 1종 RED 확인, INFO 1건(제목 표현) |
| scope | LOW | 핵심 코드 diff 는 깔끔하나 plan 트래커에 무관 결정 + 범위 초과 재판정 WARNING 2건 |
| side_effect | NONE | WeakMap 캐시 안전, 전역/시그니처/네트워크 부작용 없음 |
| maintainability | NONE | 가독성 높음, 경미한 헬퍼 중복·매직넘버·테스트 입자성 INFO 3건 |
| testing | NONE | 뮤턴트 2종 직접 재현 검증(RED 확인), 커버리지 충분, INFO 3건 |
| documentation | NONE | 소스 대조 검증 전부 일치, 기존 갭 1건은 정당하게 이연 |

## 발견 없는 에이전트

없음 — 7개 forced reviewer 모두 최소 INFO 이상 발견사항을 보고함 (security/requirement/side_effect/maintainability/testing/documentation 은 실질 결함 없이 NONE 위험도의 INFO 확인 사항만 보고, scope 만 WARNING 2건 보고).

## 권장 조치사항

1. (scope WARNING #1) `INVALID_TRIGGER_PARAMETERS` 통일 결정 기록을 이 PR 에서 분리하거나, PR 설명에 "무관 결정 1건 포함"을 명시한다.
2. (scope WARNING #2) 37건 백로그 재판정을 별도 `chore(plan)` PR 로 분리하거나 PR 설명에 "부수 grooming 작업"임을 명시한다.
3. (선택, INFO) 스택오버플로 회귀 테스트의 5,000-트리 이중 생성을 1회로 축소하거나 그대로 유지 — 우선순위 낮음.
4. (선택, INFO) requirement #4·maintainability #6/#7 의 표현/입자성 다듬기는 필수 아님, 여유 있을 때 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **제외**: 표 (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced 화이트리스트 7개 전원 — 전원 결과 확보 완료, 누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트 전용) 와 무관 |
  | architecture | router 판단상 이번 diff(테스트 전용) 와 무관 |
  | dependency | router 판단상 이번 diff(테스트 전용) 와 무관 |
  | database | router 판단상 이번 diff(테스트 전용) 와 무관 |
  | concurrency | router 판단상 이번 diff(테스트 전용) 와 무관 |
  | api_contract | router 판단상 이번 diff(테스트 전용) 와 무관 |
  | user_guide_sync | router 판단상 이번 diff(테스트 전용) 와 무관 |