# Code Review 통합 보고서

## 전체 위험도

**LOW** — Critical 0건. `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 를 추가해 비-UUID 입력이
DB 까지 흘러 500 으로 마스킹되던 것을 400 `VALIDATION_ERROR` 로 정확히 분류하는 핵심 수정은
14개 reviewer(강제 포함 7명 전원 결과 확보) 전원이 실측(jest 실행·뮤테이션 RED 재현·grep 대조)
으로 검증했다. WARNING 5건 중 2건은 이 PR 스코프 밖의 **spec 문서 갱신 채무(SPEC-DRIFT)** 로
이미 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 에 planner 항목으로 등재되어
있고, 나머지 3건도 대부분 이미 CHANGELOG·주석으로 근거가 남아 있는 낮은 심각도다.

**참고(코드 결함 아님)**: `documentation` reviewer 가 리뷰 도중 `triggers.controller.ts` 에서
`ParseUUIDPipe` 가 미커밋 상태로 제거된 워킹트리 이상 상태를 관측했다고 보고했다. 이는
`testing` reviewer 가 명시한 뮤테이션 검증(M9: `ParseUUIDPipe` 제거 → RED 재현) 작업 중
스냅샷으로, `testing` reviewer 는 `cp` 로 즉시 원복 후 `git status --short`/`git diff` 로 클린
상태를 재확인했다고 기록했다. 병합 전 `git status`/`git diff` 로 `triggers.controller.ts` 에
`ParseUUIDPipe` 가 그대로 남아 있는지 한 번 더 확인할 것을 권장한다(현재 세션 종료 시점 기준
클린으로 보고됨).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/15-chat-channel.md` §5.4 실패 응답 표에 `rotate-bot-token` 의 신규 `400 VALIDATION_ERROR`(`:id` 비-UUID) 행이 없다 — 생성된 OpenAPI(`@ApiBadRequestResponse`)·CHANGELOG 에는 반영됐지만 canonical spec 표만 낡았다 | `spec/5-system/15-chat-channel.md:367-379` | 코드는 유지. §5.4 표에 `400 \| VALIDATION_ERROR \| :id 가 UUID 형식이 아님 (ParseUUIDPipe)` 행 추가는 project-planner 턴에서 처리(이미 plan 에 등재됨) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/conventions/swagger.md` §5-4 체크리스트가 UUID 경로 파라미터의 런타임 축(`ParseUUIDPipe`)을 요구하지 않고 문서 축(`@ApiParam format:'uuid'`)만 명시 — 신규 repo-guard 는 이미 두 축을 함께 베이스라인 0 으로 강제 중 | `spec/conventions/swagger.md:493` | §5-4 체크리스트에 `@Param('<id>', ParseUUIDPipe)` 항목 추가는 project-planner 턴에서(이미 plan 에 등재됨) |
| 3 | ARCHITECTURE | SQLSTATE 22P02(비-UUID→DB 파싱 실패) 방어가 `GlobalExceptionFilter` 공유 매핑 계층 대신 호출부마다(이번 PR 포함 최소 3곳) 개별 파이프/유틸로 반복 배치된다 — `@Param()` 이외 유입 경로(`@Query()`, body 필드 조회 등)는 여전히 500 마스킹 가능 | `codebase/backend/src/common/filters/http-exception.filter.ts:44,70,76` (닫힌 3분기, 22P02 미매핑) | 후속으로 `GlobalExceptionFilter` 에 Postgres `invalid_text_representation`(22P02) → 400 `VALIDATION_ERROR` 매핑 분기 추가를 검토 — 현재의 개별 파이프+AST 가드 조합을 "최후 방어선"에서 "이중 방어"로 격하 |
| 4 | API-CONTRACT / SIDE-EFFECT | `rotate-bot-token` 엔드포인트의 관측 가능한 응답 상태 코드가 500→400 으로 바뀌는 breaking 성격의 변경 — 의도된 결함 수정이며 CHANGELOG 에 "⚠️ 배포 시 확인"으로 공지되고 저장소 내 유일 소비자(프런트 토스트)가 status 를 분기하지 않음도 확인됨 | `codebase/backend/src/modules/triggers/triggers.controller.ts:291` | 배포 전 이 엔드포인트를 쓰는 저장소 밖 외부 자동화/모니터링의 상태 코드 의존 여부 재확인. 코드 자체는 추가 조치 불필요 |
| 5 | MAINTAINABILITY | 리뷰 세션 타임스탬프(`20_26_58`·`20_53_01`·`20_01_18`)가 프로덕션/테스트 소스 주석에 근거로 직접 인용됨(7곳 이상) — `review/code/**` 는 영구 보존이 명시된 SoT 가 아니라 세션 폴더 정리 시 근거 추적이 끊길 수 있음 | `param-uuid-pipe-guard.ts:13,73,201,202`, `param-uuid-pipe.spec.ts:34,47`, `sample.controller.ts:8,78`, `triggers.controller.spec.ts:212` | 세션 ID 인용은 영구 추적 대상인 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 한 곳에 모으고, 소스 주석은 결론 문장만 남기거나 그 plan 문서를 참조 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 신규 AST 가드의 `ParseUUIDPipe` 존재 판정이 텍스트 부분일치라 별칭 import 시 미탐 가능(저장소 실측 0건, 자체 문서화된 한계) | `repo-guards/__tests__/param-uuid-pipe-guard.ts:173` | 조치 불필요 — 별칭 import 등장 시 타입 체커 기반 판정 승격 검토 |
| 2 | Performance | `ParseUUIDPipe` 추가는 비-UUID 요청의 DB 라운드트립을 제거하는 성능 개선(fail-fast) | `triggers.controller.ts:291` | 없음 — 유지 |
| 3 | Performance | 신규 repo-guard 가 매 테스트 실행마다 컨트롤러 35개를 AST 재파싱 — 테스트 시간에만 영향, 기존 관례와 동일 | `param-uuid-pipe-guard.ts` (`scanUuidParams`) | 조치 불필요, 추후 가드 증가 시 SourceFile 캐시 공유 고려 |
| 4 | Architecture | `ERROR_KO` 가 서로 다른 서브시스템 에러 코드를 구조 구분 없이 한 flat map 에 섞고 귀속을 프로즈 주석에만 의존 — 이번 정정도 프로즈만 고쳐 구조적 재발 가능성 존재 | `codebase/frontend/src/lib/i18n/backend-labels.ts:568` | 키 단위 소유 서브시스템 명시(네임스페이스/owner 필드)로 구조화 검토 |
| 5 | Architecture | 신규 HTTP 왕복 테스트가 `RolesGuard`/인증 가드 없이 컨트롤러만 부트스트랩 — `:id` 파이프 검증 목적엔 문제 없으나 docstring 표현("진짜 파이프라인")이 스킵된 계층을 감출 수 있음 | `triggers.controller.spec.ts` (신규 describe, beforeAll) | 이번 PR 은 조치 불필요. 재사용 시 docstring 을 ":id 파이프만 검증"으로 좁힐 것 |
| 6 | Requirement | `backend-labels.ts`/`.test.ts` 의 `TRIGGER_NOT_FOUND` 매핑 자체는 유지 — 도달성 미증명 상태에서 제거하지 않은 의도된 스코프 제한(plan 에 사유 명시) | `backend-labels.ts:605-613` | 조치 불필요 |
| 7 | Scope | `auth.controller.ts` 의 `@ApiParam format:'uuid'` 추가는 태스크명이 가리키는 컨트롤러 밖이지만, 전수 가드 베이스라인 0 을 맞추다 발견한 부수 수정으로 plan/CHANGELOG 에 근거가 명시됨 | `auth.controller.ts:436-440` | 조치 불필요(이미 문서화) |
| 8 | Scope | 서로 다른 두 축(백엔드 런타임 검증 버그 vs 프런트엔드 문서·i18n 라벨 오귀속)이 한 배치에 묶임 — plan 에 의도 명시 | 태스크 전체 | 조치 불필요, 향후 PR 설명에서 두 축 구분 권장 |
| 9 | Scope | 단일 엔드포인트 결함 수정치고 신규 정적 가드 인프라 볼륨이 큼(신규 3파일, diff 의 약 45%) — 저장소 기존 `repo-guards/` 관례를 따름, 3라운드 선행 리뷰 거침 | 신규 가드/스펙/fixture 3파일 | 조치 불필요 |
| 10 | Side Effect | 신규 fixture 컨트롤러가 실제 Nest 데코레이터로 백도어형 라우트 선언 — `AppModule` 이 전부 정적 import 등록이고 가드 스캔 루트도 `src/modules` 한정이라 안전함을 확인 | `repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` | 조치 불필요, 향후 유사 fixture 추가 시 등록 방식 정적 유지 여부 재확인 |
| 11 | Maintainability | `UuidParamAxis` 타입 리터럴이 내부 식별자와 표시용 문구를 겸함 | `param-uuid-pipe-guard.ts:15` | 판별자와 출력 라벨 분리 검토 |
| 12 | Maintainability | 동일 rotate 결과 mock 리터럴이 파일 내 두 곳에서 하드코딩 반복 | `triggers.controller.spec.ts:30-35, 246-251` | 공용 팩토리 함수로 추출 |
| 13 | Maintainability | vacuity floor 임계값(30, 100)이 매직 넘버(주석은 있음) | `param-uuid-pipe.spec.ts:60,66` | 명명 상수로 추출(낮은 우선순위) |
| 14 | Testing | HTTP 왕복 describe 블록이 `*.controller.spec.ts`(unit 표방) 파일 안에 integration 스타일로 혼재 — 형제 `health.controller.spec.ts` 선례 있음 | `triggers.controller.spec.ts:229` | 지금 조치 불필요, 3번째 유사 사례 발생 시 파일 분리 고려 |
| 15 | Testing | 정적 스캐너 한계(별칭 import·비-리터럴 `@ApiParam` 미탐)가 docstring 에 실측 근거(0건)와 함께 문서화됨 | `param-uuid-pipe-guard.ts` | 조치 불필요 |
| 16 | Documentation | `models.mdx`/`models.en.mdx` 가 미구현(Planned) 에러 코드 2종을 이미 동작하는 것처럼 서술 — 이 PR 범위 밖, plan §C 에 이미 등재 | `06-integrations-and-config/models{,.en}.mdx` | 신규 조치 불요, 다음 세션에서 plan §C 근거로 착수 |
| 17 | Documentation | 같은 엔드포인트에 대한 두 개의 독립 `## Unreleased` CHANGELOG 항목이 인접 — 내용은 각각 정확 | `CHANGELOG.md:3, 26` | 선택 사항, 급하지 않음 |
| 18 | API Contract | id-형 경로 파라미터 UUID 계약 전수 가드(런타임+문서 축, 베이스라인 0)가 이번 결함 클래스의 재발을 구조적으로 방지 | `param-uuid-pipe-guard.ts`, `param-uuid-pipe.spec.ts` | 없음 — 긍정적 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 입력 검증 강화(500→400), 인가 우회 없음. 가드 텍스트-매칭 한계만 INFO |
| performance | NONE | `ParseUUIDPipe` 는 오히려 성능 개선(fail-fast). 가드 재파싱은 테스트 시간에만 영향 |
| architecture | LOW | 22P02 방어의 반복 배치(공유 seam 미보강), `ERROR_KO` flat map 구조 문제 |
| requirement | LOW | 실측(jest 실행) 전부 GREEN·SoT 대조 일치. WARNING 2건 모두 SPEC-DRIFT, 이미 plan 등재 |
| scope | LOW | plan 정의 범위와 diff 정확히 일치, 부수 수정(auth.controller.ts)도 근거 명시됨 |
| side_effect | LOW | 500→400 breaking 변경(문서화됨), fixture 백도어 라우트 안전성 검증 |
| maintainability | LOW | 세션 타임스탬프 근거 인용 반복(7곳+), 소수 매직넘버·중복 |
| testing | NONE | 뮤테이션(M9) RED 재현 확인, jest 20/20 GREEN 재현. 테스트 파일 성격 혼재만 INFO |
| documentation | LOW | 수치 주장 전수 재검증 일치. 워킹트리 이상 상태 관측(타 reviewer 뮤테이션, 이미 원복 확인) |
| dependency | NONE | 신규 외부 패키지/lockfile 변경 0건, 기존 devDependency 재사용만 |
| database | NONE | DB 접점은 `rotateBotToken` 뿐이며 오히려 불필요한 DB 왕복 감소(긍정적) |
| concurrency | NONE | 해당 없음 — 동시성 관련 코드 변경 없음 |
| api_contract | LOW | 핵심 계약 개선 확인, canonical spec §5.4 표 미반영(SPEC-DRIFT, WARNING #1 과 동일 사안) |
| user_guide_sync | NONE | doc-sync 매트릭스 trigger 1건 완전 충족, 나머지 매트릭스 행 무관, 누락 없음 |

## 발견 없는 에이전트

concurrency, dependency, database, user_guide_sync — 모두 위험도 NONE 이며 확인성 기록 외 실질 조치 항목 없음.

## 권장 조치사항

1. (선택, project-planner 턴) `spec/5-system/15-chat-channel.md` §5.4 표에 `rotate-bot-token` 의 신규 `400 VALIDATION_ERROR` 행 추가 — 이미 plan 에 등재된 SPEC-DRIFT 채무.
2. (선택, project-planner 턴) `spec/conventions/swagger.md` §5-4 체크리스트에 `ParseUUIDPipe` 런타임 축 요건 추가 — 이미 plan 에 등재된 SPEC-DRIFT 채무.
3. (선택, 후속 developer 작업) `GlobalExceptionFilter` 에 Postgres 22P02(`invalid_text_representation`) → 400 `VALIDATION_ERROR` 매핑 분기를 추가해, `@Param()` 이외 유입 경로(쿼리·body)의 동일 결함 클래스를 공유 계층에서 방지.
4. (권장) 병합 직전 `git status`/`git diff` 로 `triggers.controller.ts` 의 `ParseUUIDPipe` 가 온전히 남아 있는지 최종 확인(다른 reviewer 의 뮤테이션 테스트 원복 여부 재확인).
5. (선택, 낮은 우선순위) 소스 주석의 세션 타임스탬프 근거를 `plan/in-progress/trigger-uuid-and-guide-error-codes.md` 로 일원화.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 실행. 강제 포함(router_safety) 목록 `documentation, maintainability, requirement, scope, security, side_effect, testing` 전원 결과 확보됨(누락 없음).