# Code Review 통합 보고서

## 전체 위험도
**NONE** — 이번 changeset(24개 파일, `origin/main..HEAD`)의 실질 코드 변경은 `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 1개 파일뿐이며, `deepRedactSecrets` 의 재귀 깊이 상한(`MAX_REDACT_DEPTH`) 경계를 검증하는 순수 테스트 8종 추가다. 프로덕션 코드는 변경되지 않았고, 14개 reviewer(강제 7 포함) 전원이 CRITICAL/WARNING 없이 NONE 판정을 냈다.

> **검증 메모 (reviewer 간 사실 불일치 발견 → 직접 재검증)**: `user_guide_sync` 리포트는 `sanitize-error-message.ts` 가 "working tree 미커밋" 상태로 `depth >= MAX_REDACT_DEPTH` → `depth > MAX_REDACT_DEPTH` 로 변경되어 있다고 주장했다. 이는 다른 13개 reviewer(특히 security/requirement/testing 등이 소스를 직접 `Read` 로 대조한 결과)의 "프로덕션 코드 미변경" 판정과 정면으로 배치되어, summary 작성자가 `git status --porcelain`·`git diff -- codebase/backend/src/shared/utils/sanitize-error-message.ts`·`grep MAX_REDACT_DEPTH` 를 직접 실행해 재검증했다. **결과: working tree 는 clean(신규 review 산출물 디렉터리 외 변경 없음)이고, 소스의 비교 연산자는 여전히 `depth >= MAX_REDACT_DEPTH` 그대로다.** 즉 `user_guide_sync` 의 해당 서술은 사실이 아니다(아마 testing reviewer 가 스크래치패드에서 수행한 뮤테이션 테스트의 일시적 상태를 잘못 관측했거나 hallucination). 다만 `user_guide_sync` 는 이 잘못된 전제 하에서도 "동작 무변화 → 문서 동기화 불필요" 라는 동일한 결론에 도달했으므로 최종 판정(NONE)에는 영향이 없다. forced 미이행이나 결과 누락은 아니다 — 전 reviewer 전문이 확보되었다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing/Documentation | 신규 경계 테스트 스위트가 이전의 vacuous 한 `not.toThrow()` 단일 테스트(25겹 중첩)를 대체 — 값 검사가 깊이 검사보다 먼저인 순서 불변식·JSON 파싱을 통한 세 번째 재귀 진입점의 `depth+1` 보정까지 커버. 뮤턴트(`>=`→`>`) 직접 주입 재현 시 8건 중 5건 즉시 RED 확인(판별력 검증됨) | `sanitize-error-message.spec.ts:274-383` | 긍정적 하드닝 — 조치 불필요 |
| 2 | Architecture | 테스트가 비공개 `deepRedactCore` 대신 공개 API(`deepRedactSecrets`)만 통해 검증하고, 상한 값을 리터럴이 아니라 SoT 상수(`MAX_REDACT_DEPTH` → `@workflow/masked-markers`)로 import — 캡슐화·SoT 추종 모두 양호 | `sanitize-error-message.spec.ts` import 절, 각 `nestObj(MAX_REDACT_DEPTH, ...)` 호출부 | 조치 불필요 |
| 3 | Maintainability | `nestObj`/`nestArr`/`nestMixed` 세 헬퍼가 구조적으로 거의 동일한 for-루프 반복 (경미한 중복) | `sanitize-error-message.spec.ts:276-292` | 직전 라운드(`16_07_45`)에서 이미 "다음 분기까지 defer" 로 처분됨(RESOLUTION.md maintainability #5) — 재조치 불요 |
| 4 | Maintainability | array 분기는 `it` 1개 안에 `expect` 2개(경계/경계-1)를 담아 실패 시 어느 쪽이 깨졌는지 구분 어려움(object 분기는 `it` 2개로 분리됨) | `sanitize-error-message.spec.ts:336-343` | 직전 라운드에서 "(선택), 비용 근거 없음" 으로 이미 처분됨 — 재조치 불요 |
| 5 | Maintainability | 스택오버플로 회귀 테스트의 깊이 값 `5000` 이 명명 상수가 아닌 리터럴(단, JSDoc 에 실측 근거 상세 기술) | `sanitize-error-message.spec.ts:379` | 재사용처 생기기 전까지 현행 유지로 충분(직전 라운드 처분과 동일) |
| 6 | Performance/Side-effect/Testing | 스택오버플로 회귀 테스트의 `run()` 클로저가 `not.toThrow()`·`toEqual()` 양쪽에서 각각 호출되어 5,000-깊이 트리를 두 번 생성·순회 | `sanitize-error-message.spec.ts:377-382` | 실측 스위트 실행 0.177~0.2s(76 케이스)로 비용 무시 가능 — 조치 불필요(선택 시 트리 결과 캐시 가능) |
| 7 | Testing | 세 번째 깊이 상한(`MAX_SANITIZE_DEPTH`, `websocket.service.ts`)과 `deepRedactSecretsPreserving` 변형에는 대응하는 경계 테스트가 이번 diff 에 없음 — 의도적 스코프 제외(별개 불변식) | diff 밖 (`websocket.service.ts`, `strip-external-only-fields.ts`) | 향후 WS sanitizer 를 손댈 때 동일 패턴 적용 참고용 |
| 8 | Documentation | egress 마스킹 규약(마커 3종·깊이 상한 SoT·소비처별 경계 연산자)이 정식 `spec/conventions/**` 문서 없이 JSDoc 산문에만 존재 — 기존 갭, developer 권한 밖 | `plan/complete/masked-marker-shared-package.md` §, 원 지적 `review/consistency/.../15_35_56/convention_compliance.md` WARNING #1 | 다음 project-planner 턴에서 `spec/conventions/egress-masking.md`(가칭) 신설 여부 판단 |
| 9 | Documentation | JSDoc 블록 안 긴 Markdown(표 포함)이 일반 IDE hover 등에서 표로 렌더링되지 않음 — 저장소 기존 관례와 일치 | `sanitize-error-message.spec.ts:62-95` | 조치 불필요 |
| 10 | Requirement | 경계 테스트 제목의 "한 칸 위(-1)" 표현이 실제로는 상한보다 작은/아래 깊이를 가리켜 통상 직감과 다소 어긋나 보임 | `sanitize-error-message.spec.ts:307` | 이미 이전 라운드에서 "제목 의미상 맞다"로 dispositioned, 재검증 결과 동의 — 조치 불필요 |
| 11 | Scope | plan 문서 이동(`masked-marker-shared-package.md`, `mirror-guard-single-copy.md`: in-progress→complete)과 이전 라운드 리뷰/consistency 산출물 커밋은 목표 달성의 정당한 선행조건/워크플로 증적 | `plan/complete/*.md`, `review/code/.../16_07_45/**`, `review/consistency/.../15_35_56/**` | 조치 불필요 |
| 12 | Scope | 직전 라운드(`16_07_45`)의 scope WARNING 2건(무관한 결정 기록, 범위 밖 트래커 37건 일괄 재판정)은 `git rebase --onto` 로 문제 커밋(`5d5d4565f`) 드롭을 통해 이번 diff 에서 실제로 해소됨(재검증 완료) | — | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 운영 코드 미변경, 새 테스트가 fail-closed 방향 검증 강화 |
| performance | NONE | O(min(depth,10)) 상수 비용, DoS 방지 회귀 가드로 긍정 평가 |
| architecture | NONE | 캡슐화 존중, SoT 상수 참조, 3계열 깊이 불변식 의도적 분리 유지 확인 |
| requirement | NONE | 신규 8개 테스트 전부 구현과 line-level 일치, 뮤턴트 5/8 RED 재현 |
| scope | NONE | plan 이동/리뷰 산출물은 정당한 부수 범위, 직전 WARNING 2건 해소 검증 |
| side_effect | NONE | 전역상태/캐시 오염/env·fs·mock 부작용 없음 |
| maintainability | NONE | 경미한 INFO 3건 전부 직전 라운드 기처분(defer) 재확인 |
| testing | NONE | 76/76 GREEN, 뮤턴트 재현 판별력 검증, 이전 vacuous 테스트 대체 |
| documentation | NONE | JSDoc 산문 주장 소스와 line-level 대조 전부 일치, plan 링크 무결성 확인 |
| dependency | NONE | 신규 의존성/lockfile/Dockerfile 변경 없음 |
| database | NONE | DB 관련 코드 변경 전무 |
| concurrency | NONE | async/Promise/락/공유상태 관련 코드 없음 |
| api_contract | NONE | API 엔드포인트/DTO/인증 관련 코드 변경 없음 |
| user_guide_sync | NONE (단, 전제 오류 포함) | 매트릭스 21행 전부 미매칭 판정은 유효하나, 서술 중 "프로덕션 파일 uncommitted 변경" 주장은 summary 작성자가 git 재검증한 결과 **사실무근**으로 확인됨(위 캐비아트 참조) |

## 발견 없는 에이전트

dependency, database, concurrency, api_contract (검토 대상 표면 자체가 diff 에 없음 — "해당 없음")

## 권장 조치사항

1. (선택, 낮은 우선순위) 다음 project-planner 턴에서 egress 마스킹 규약(마커 3종·깊이 상한 SoT·소비처별 경계 연산자)을 `spec/conventions/**` 문서로 정식화할지 판단 — 이번 PR 의 developer 권한 밖이며 기존에 이미 인지된 갭.
2. 그 외 추가 조치 불필요 — 나머지 INFO 항목은 전부 직전 라운드(`16_07_45`)에서 이미 검토·처분되었거나 긍정적 설계 패턴 확인 성격.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 14명 reviewer 실행됨(강제(router_safety) 화이트리스트 7명: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨). 제외된 reviewer 없음.