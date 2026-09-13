# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 강제(forced) 7명 포함 14개 reviewer 전원이 실행되어 전문을 확보했다(누락 없음). 이 changeset 은 이미 3라운드의 `/ai-review` + `/consistency-check` 를 거친 누적 상태이며, 이번(4차) 라운드는 그 처분들이 실제로 반영됐는지 재검증하는 성격이 강하다. 남은 것은 WARNING 3건(모두 "차단 사유 아님, 신호 유지" 성격)과 다수의 확인성 INFO다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect / API 계약 | `LlmService.testConnection` 반환 필드 rename(`error`→`message`)은 저장소 내부 호출부·프런트엔드와는 전부 정합하지만, `POST /api/model-configs/:id/test` 는 인증된 사용자가 직접 호출 가능한 HTTP 엔드포인트라 저장소 밖 3rd-party/자동화 클라이언트가 `.error` 를 파싱하고 있었다면 조용히 깨질 수 있다(코드로 완전히 배제 불가능) | `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`, 반환 타입 선언 및 catch 블록) | 이미 `CHANGELOG.md` 에 "⚠️ 배포 시 확인"으로 고지돼 있고 3라운드 연속 LOW 로 수렴 — 차단 사유 아님. 신호로 유지, 배포 시 재확인 |
| 2 | testing | 이번 PR 이 `/api/model-configs/:id/test` 에 도입한 HTTP 와이어(TransformInterceptor 포함) 계약 검증 층이 같은 인터셉터를 타는 형제 엔드포인트 `/api/integrations/:id/test` 에는 없다 — `code` 필드를 서비스-레벨 `assertMatchesContract` 로만 검증, supertest 왕복 검증 0건 | `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (서비스 레벨만) vs `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts` (HTTP 왕복 신설) | diff 밖, 차단 사유 아님. 기존 backlog(`plan/in-progress/spec-draft-nullable-notation-followups.md:3266`, MCP 필드 미선언 항목)는 서비스-레벨 축이라 이 와이어-레벨 축을 커버하지 않음 — 옆에 한 줄 추가 권고 |
| 3 | documentation | 신규 build-time 가드 2건(`guide-error-code-existence.test.ts`, `guide-sanitized-message-parity.test.ts`)이 `PROJECT.md` 의 "자동 가드(build-time 차단)" 카탈로그에 등재되지 않음 — 이 문서는 `spec/` 이 아니라 developer 가 직접 쓸 수 있는 문서라 이번 PR 안에서 바로 닫을 수 있었다 | `PROJECT.md:289-307` (`### 자동 가드 (build-time 차단)` 절) | `impl-anchor-existence.test.ts` 항목 근처에 두 줄 추가(각 가드 한 줄 설명) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / requirement / user_guide_sync | "가이드→코드" 단방향 존재성 가드(`guide-error-code-existence`)만 있고 "코드→가이드"(완전성) 역방향 가드는 없음 — 이 사각지대가 실제로 라운드3에서 발현(spec §1.4 5종 누락)했으나 이번 라운드에서 완전히 처분 확인됨. DTO 유령 필드 결함과 근본 원인(단방향 존재성 검사, 완전성 검사 부재)이 동일 | `codebase/frontend/src/lib/docs/__tests__/guide-error-code-scan.ts` | 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3305` 에 developer 명의로 등재됨. DTO 유령 필드 backlog 항목과 "같은 근본 원인"임을 plan 에 명시적으로 연결해 두면 다음 재발 시 하나의 해법(완전성 검사기)으로 두 항목 동시 종결 가능 |
| 2 | maintainability | `TestConnectionResultDto`(integrations)와 `ModelTestConnectionResultDto`(model-config)가 거의 동일 shape 을 각자 독립 선언 — 이번처럼 같은 결함(유령 `latencyMs`)이 양쪽에 동시 발생·동시 수정 필요했음(shotgun surgery) | `integration-response.dto.ts` / `model-config-response.dto.ts` | 지금은 2곳뿐이라 즉시 추출 불요. 3번째 유사 DTO 발생 시 공통 베이스 추출 검토 |
| 3 | scope | 원 트래커("가이드 에러 코드 5종 정정")보다 스코프가 상당히 확장(형제 Integrations DTO, 신규 가드 3건, spec §1.4 카탈로그 보정)됐지만, 매 확장 지점이 코드 주석·CHANGELOG(별도 절)·plan·커밋 메시지로 일관되게 disclosure 됨 | `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` 외 | 없음 — 심각한 스코프 위반 아님, 기록만 |
| 4 | api_contract / requirement | `testConnection` 실패 응답 shape 이 `spec/5-system/7-llm-client.md` 에 미문서화, `TestConnectionResultDto` 의 MCP 전용 필드(`capabilities`/`serverInfo`/`preview`) 미선언 | `spec/5-system/7-llm-client.md` (성공 경로만 문서화) | `developer` 는 `spec/` 쓰기 권한 없어 이번 PR 스코프 밖 — `plan/in-progress/spec-draft-nullable-notation-followups.md:3225-3241,3266` 에 이미 정확히 위임됨. 병합 후 planner 턴 추적만 |
| 5 | user_guide_sync | 신규 가드 가족 3종이 `spec/conventions/user-guide-evidence.md` 관계표에 아직 미등재(매트릭스 21행 어디도 이를 요구하지 않아 엄밀히는 범위 밖) | `spec/conventions/user-guide-evidence.md` | planner 턴에서 관계표 갱신 시 참조 |
| 6 | security | `testConnection` catch 블록의 `logger.warn` 이 sanitize 되지 않은 원본 에러를 서버 로그에 남기지만, `LlmUsageLogService.record` 를 호출하는 workspace 노출 경로로는 재전파되지 않음(diff 미변경 코드, 새 결함 아님) | `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`) | 없음 — 확인용 기록 |
| 7 | performance | `guide-error-code-existence.test.ts` 가 vitest 프로세스당 1회 backend+packages 전체(500+ 파일)를 동기 로드 — 선형 스캔이고 자매 가드와 동일 패턴, 이전 2라운드에서 이미 NONE/INFO 확인 | `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` | 지금 규모에서 조치 불요 — 저장소가 수배 커지면 대상 축소/캐싱 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | sanitizeLlmErrorMessage 8갈래 고정 문구만 노출 확인, 하드코딩 시크릿 없음 |
| performance | NONE | 응답 필드 rename/DTO 정리는 알고리즘·쿼리·캐싱 영향 없음, 신규 가드는 선형 build-time 스캔 |
| architecture | LOW | 레이어 경계·의존 방향 견고. DTO 유령 필드 vs 가이드 표 누락이 같은 결함 클래스의 두 표현 |
| requirement | NONE | 핵심 결함(3층 필드명 불일치) 및 5종 에러코드 정정 실측 검증 완료, GREEN 다수 |
| scope | LOW | 스코프 확장 있으나 매 지점 disclosure 됨, 임의 리팩토링/무관 변경 없음 |
| side_effect | LOW | 응답 필드 rename 이 저장소 밖 클라이언트에 breaking 가능성(WARNING), 내부는 전부 정합 |
| maintainability | NONE | 형제 DTO 구조 중복(2곳, 조치 불요), 나머지는 양호한 테스트/주석 관례 |
| testing | LOW | 형제 엔드포인트 HTTP 와이어-레벨 계약 테스트 비대칭(WARNING), 신규 테스트 자체는 vacuity floor·대조군 우수 |
| documentation | LOW | PROJECT.md 가드 카탈로그 누락(WARNING), 그 외 JSDoc/CHANGELOG/spec 대조 정확 |
| dependency | NONE | 신규 외부 의존성 0건, 크로스-패키지 결합은 기존 관례 |
| database | NONE | DB 관련 코드 diff 없음 |
| concurrency | NONE | 공유 가변 상태·락·async 흐름 변경 없음, 테스트 생명주기 정확 |
| api_contract | LOW | 이전 라운드 지적(형제 DTO code 선언 등) 실제 반영 재확인, 인가 데코레이터 변경 없음 |
| user_guide_sync | NONE | 매트릭스 3개 trigger 매칭, 전부 동반 갱신 완료(spec §1.4 셀단위 대조, vitest 21/21 PASS) |

## 발견 없는 에이전트

없음 — 전 에이전트가 최소 1건 이상의 INFO/WARNING 관찰을 기록했다(신규 결함이 아니라 재확인·확인성 기록 포함).

## 권장 조치사항

1. `PROJECT.md` 자동 가드 카탈로그에 신규 가드 2건(`guide-error-code-existence.test.ts`, `guide-sanitized-message-parity.test.ts`) 등재 — developer 소유 문서라 이번 PR 턴에서 바로 처리 가능(WARNING #3).
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 기존 backlog(서비스-레벨 계약 미배선, 3266행)와는 별개로 "`/api/integrations/:id/test` 와이어-레벨(HTTP) 계약 검증 부재"를 한 줄 추가 등재(WARNING #2) — 오판 방지 목적.
3. `error`→`message` rename 은 배포 전 "저장소 밖 소비자 존재 여부"를 최종 확인(WARNING #1) — CHANGELOG 고지는 이미 완료, 코드 변경 요구 아님.
4. (저우선) DTO 유령 필드 재발과 가이드 표 완전성 누락이 "단방향 존재성 검사, 완전성 검사 부재"라는 동일 근본 원인임을 plan 문서에 명시적으로 연결(INFO #1) — 다음 재발 시 하나의 해법으로 두 backlog 동시 종결.
5. 나머지 INFO 는 모두 이미 developer/planner 권한 경계에 맞춰 정확히 위임되었거나 확인 완료된 항목으로, 이번 PR 을 막을 조치는 불요.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 전체 14개 reviewer 실행.
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음, forced 화이트리스트 정상 이행).
  - **실행**: 전체 14개 reviewer(`security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync`) 전원 success + 전문 확보.
  - **제외**: 없음.