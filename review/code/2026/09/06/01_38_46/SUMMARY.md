# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. WARNING 1건(스케줄 목록 API 의 blast-radius 확대)은 이전 라운드부터
이월된 항목으로, 이번 diff 의 CHANGELOG 에 "의도된 트레이드오프"로 이미 문서화·수용되어
있다. forced(router_safety) 7명 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음, 안 본
Critical 로 인한 거짓 낮은 위험도 판정 아님. 이 PR 은 §5.4 응답-계약 검증자 배선을
4→18개 DTO 로 넓히는 과정에서 실측으로 발견한 트리거 회전 secret 유출(엔티티 컬럼 2개
+ JSONB 3축 + 스케줄 조인을 통한 2차 유출)을 같은 커밋에서 수정한 **보안 결함 수정 PR**
이며, 9개 reviewer 전원이 신규 CRITICAL/구조적 결함을 찾지 못했다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용/가용성 | `SchedulesController.toResponse` 가 `trigger` 관계 미로드를 500 으로 승격시키며, `findAll` 경로는 `data.map()` 안에서 호출되므로 워크스페이스 스케줄 중 단 한 행만 손상돼도 목록 조회 전체가 실패한다(장애 반경이 "행"에서 "목록"으로 확대). `Schedule.trigger_id` NOT NULL + FK `CASCADE` 로 "정상 데이터로는 도달 불가"라는 근거가 있고 CHANGELOG 에 의도된 트레이드오프로 명시돼 있어 직전 라운드 WARNING 이 문서화로 대응됐으나, 가용성 위험 자체는 줄지 않아 이월 | `codebase/backend/src/modules/schedules/schedules.controller.ts` `toResponse()`(약 71~101행), `findAll`(약 131행 `page.data.map((s) => this.toResponse(s))`) | 조치 불요(이미 의도적으로 수용·문서화됨) — 다만 "고아 행이 생길 수 없다"는 전제가 깨지는 사고(스키마 마이그레이션 실수, FK 제약 우회 등)가 발생하면 "부분 성공 + 문제 행만 표시" 전략으로 재검토할 신호로 삼을 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서/SPEC | `secret-store.md §1` 의 "노출 창은 아직 설계대로 닫혀 있지 않다" 서술이 이 PR 의 수정으로 사실과 어긋나게(stale) 됨 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 담당 항목으로 등재돼 있음(신규 발견 아님, 재확인) | `spec/conventions/secret-store.md` §1 비대상 항목 blockquote | 조치 불요 — 다음 planner 세션에서 정정 이력 문장 추가 |
| 2 | 보안/설계 | 트리거 응답 비밀 스트립이 손으로 짠 `Set<string>` 4벌(deny-list: `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`INTERACTION_RESPONSE_STRIP_KEYS`/`TRIGGER_RESPONSE_STRIP_COLUMNS`)로 구성 — 현재는 spec 요구 필드를 전수 커버하지만 다음 비밀 축 추가 시 같은 유형의 누락이 재발할 구조적 위험. 이미 plan 후속 항목으로 등재됨 | `codebase/backend/src/modules/triggers/triggers.service.ts` | 조치 불요(추적 중) — 향후 엔티티 데코레이터 기반 선언적 SoT 전환 고려 |
| 3 | 아키텍처 | 응답 경계에서 "연관 엔티티를 참조 수준으로 좁히기" 책임이 모듈마다 다른 레이어(컨트롤러 vs 서비스)에 위치 — 둘 다 정상 동작하고 근거 문서화돼 있으나 세 번째 모듈이 같은 문제를 만나면 참고할 단일 관례가 없음 | `schedules.controller.ts:71`(`toResponse`) vs `triggers.service.ts:698`(`sanitizeForResponse`) + `:190`(`narrowWorkflowRef`) | 급하지 않음 — 컨벤션 문서에 "응답 경계 좁히기는 어디에 두는가" 한 줄 명문화 고려 |
| 4 | 아키텍처 | 응답 좁히기 매핑이 DTO 클래스와 타입 수준으로 연결되지 않은 손수 작성 객체 리터럴 — 필드 목록 drift 를 컴파일러가 아니라 테스트(`assertMatchesContract`)로만 막고 있음 | `schedules.controller.ts:104-112`(`toResponse` 반환 리터럴), `triggers.service.ts:741-745`(`overrides.workflow`) | 조치 불요(현재 테스트 안전망 실효성 확인) — 향후 `Pick<Trigger,...>` 등 유틸리티 타입으로 원본-반환 타입 링크 고려 |
| 5 | 아키텍처 | 모듈 경계를 넘는 테스트 전용 의존 — `modules/executions` 스펙이 `repo-guards/__tests__` 의 스캐너 함수를 직접 import | `execution-response.dto.spec.ts:13` | 조치 불요 — 재발 시 공유 함수를 `shared/testing` 등 중립 위치로 이동 고려 |
| 6 | 스코프/스타일 | `workflow-crud.e2e-spec.ts` 에서 `ExportWorkflowDto`/`WorkflowDto` 를 같은 모듈에서 별도 import 두 줄로 가져옴(병합 가능) — 이전 라운드부터 이월된 사소한 잔여물 | `codebase/backend/test/workflow-crud.e2e-spec.ts` | import 한 줄로 병합. 병합을 막을 사유 아님 |
| 7 | 스코프 | 보안 수정(트리거 secret 유출 4곳)과 §5.4 검증자 배선 확장(4→18 DTO)·선언 보정(23필드)이 한 브랜치 15개 커밋에 섞여 있음 — CHANGELOG 가 "스윕 도중 실측 발견" 인과관계를 명시해 추적성은 확보됨 | `CHANGELOG.md` 전체 | 조치 불요 |
| 8 | API계약 | `IntegrationDto.consecutiveNetworkFailures`(프런트엔드 참조 0곳, 내부 헬스 카운터)가 이번 스윕으로 공개 DTO 에 정식 선언됨 — PR 자신과 plan 트래커가 "제거가 나은 후보지만 wire 변경이라 별도 항목으로 미룬다"고 이미 명시 | `integration-response.dto.ts`(`consecutiveNetworkFailures` 필드) | 조치 불요 — 별도 트래커 항목에서 제거 여부 결정 |
| 9 | 부작용/API계약 | `GET/POST/PATCH /api/schedules`,`/api/triggers` 의 `trigger`/`workflow` 중첩 객체가 조인 엔티티 전체에서 참조 2~4필드로 좁혀짐(breaking change) — 소비처 전수 검색 근거(프런트 `RawSchedule` 타입, `@workflow/sdk` 미사용)와 함께 CHANGELOG 에 문서화됨. 원래 노출 대상에 회전 비밀 컬럼이 섞여 있어 보안 수정 성격이 강함 | `schedules.controller.ts:70-101`, `triggers.service.ts`(`narrowWorkflowRef`, `sanitizeForResponse`) | 조치 불요 — 참고용 기록. 향후 서드파티 소비자 등장 시 API 버전 정책 재검토 |
| 10 | 부작용 | 테스트 유틸리티에 신규 module-level 캐시(`contractCache`) 도입 — 실패한 Promise 는 캐시에서 삭제 후 재던지도록 처리돼 있고(테스트로 회귀 고정), 격리 단위는 Jest 파일 단위라 파일 간 오염 없음. 프로덕션 런타임 영향 없음 | `codebase/backend/src/shared/testing/response-contract.ts:386, 412-425` | 조치 불요 |
| 11 | 부작용 | `sanitizeForResponse` 의 조기 return 제거로 "정화할 것이 없어도 항상 새 객체" 로 바뀌어 반환값의 참조 동일성 보장이 사라짐 — JSDoc 이 명시적으로 경고하고, 현재 4개 내부 호출부는 참조 비교를 하지 않아 실질 영향 없음 | `triggers.service.ts:698, 748` | 조치 불요 — 향후 이 반환값을 캐싱/`===` 비교하는 코드 추가 시 주의 |
| 12 | 부작용 | `TriggersService.update()` 의 `setupChatChannel` 후 재조회에 `relations: ['workflow']` 추가로 JOIN 하나 증가 — PATCH 응답에서 `workflow` 가 소실되던 버그(§5.4 계약 위반) 수정 목적, 부수 쿼리 비용 외 다른 부작용 없음 | `triggers.service.ts` `update()` | 조치 불요 |
| 13 | 유지보수성 | DTO 4개 파일(`AlertRuleDto`/`IntegrationDto`/`KnowledgeBaseDto`/`TriggerDto`)에 동일한 6줄 §5.4 설명 주석이 글자 그대로 복제됨 — 규칙이 바뀌면 4곳을 모두 갱신해야 하고 누락 시 조용히 낡음 | `alert-rule-response.dto.ts:55-61`, `integration-response.dto.ts:118-124`, `knowledge-base-response.dto.ts:93-99`, `trigger-response.dto.ts:104-110` | 규칙 설명을 `spec/conventions/` 문서로 한 번만 두고 각 DTO 는 링크만 남기는 편 권장(급하지 않음) |
| 14 | 유지보수성 | `SchedulesController.toResponse` 가 비밀 필드 드롭·불변식 검증(500 던지기)·응답 형태 재구성 세 책임을 한 메서드에서 겸함 | `schedules.controller.ts` `toResponse` | 급하지 않은 리팩터 후보 — `assertTriggerLoaded` 같은 별도 가드 함수로 검증 분리 고려 |
| 15 | 테스트 | CWE-209 회귀 테스트(`'trigger 미로드 행은 던지되 응답에 진단을 싣지 않는다'`)가 컨트롤러를 동일 입력으로 두 번 호출 — 불필요한 중복 호출 | `schedules.controller.spec.ts` | `try/catch` 한 번으로 통합해 단언을 함께 적용 권장(사소함) |
| 16 | 테스트 | `sanitizeForResponse` 의 "정화할 것이 없어도 항상 새 참조를 돌려준다" 불변식(JSDoc 명시)을 직접 검증하는 테스트(`not.toBe`)가 없음 — 현재 스트립 대상 필드가 항상 존재하는 도메인에서는 도달하기 어려운 분기라 우선순위 낮음 | `triggers.service.spec.ts` | `expect(result).not.toBe(trigger)` 단언 추가 고려(우선순위 낮음) |
| 17 | 테스트 | `expectNarrowedScheduleTriggerRef` 헬퍼가 `trigger` 최상위 키셋만 검사하고 중첩된 `trigger.workflow` 자체 키셋은 검사하지 않음 — 다만 같은 e2e 에서 나란히 호출되는 `assertMatchesContract` 가 `$ref` 재귀로 이미 커버함을 코드 확인. unit 계층에는 이 회귀 감지가 없어 피드백 루프가 느림 | `shared/testing/schedule-trigger-ref.ts`, `test/schedule-trigger.e2e-spec.ts` | 조치 불요(e2e 가 커버) — 더 빠른 신호 원하면 unit mock 에 `withWorkflow: true` 케이스 추가 고려 |
| 18 | 문서화/SPEC | `TriggerDto.workflow`/`ScheduleDto.trigger.workflow` 의 키-생략형 사유가 코드 주석에는 상세히 있으나 nav-spec 본문(`2-trigger-list.md`, `3-schedule.md §4`)에는 아직 미반영 — 이미 plan 에 planner 담당 항목으로 등재됨 | `spec/2-navigation/2-trigger-list.md`, `spec/2-navigation/3-schedule.md §4` | 조치 불요 — 다음 planner 세션에서 반영 |
| 19 | API계약 | `ExportWorkflowDto.formatVersion` 이 `required: true` 로 선언돼 있으나 실제 export 구현이 방출하지 않아 `allowMissing: ['formatVersion']` 으로 계약 검증에서만 눈감음 — `spec/2-navigation/1-workflow-list.md` 에 이미 "Planned" 로 문서화된 갭이고 코드 주석이 완료 조건까지 명시 | `test/workflow-crud.e2e-spec.ts`, `shared/testing/response-contract.ts`(`allowMissing`) | 조치 불요(범위 밖, 추적됨) — 갭을 닫을 때 `required:false` 또는 실값 채우기로 마무리 |
| 20 | API계약 | `INTERNAL_ERROR` 메시지 문구가 `GlobalExceptionFilter` 기본값(영어)과 이번 PR 이 추가한 `schedules.controller.ts` 문구(한국어) 사이에서 갈림 — 이 PR 이 만든 drift 아니며 plan 에 별도 항목으로 이미 등재(필터를 고치면 매핑 안 된 모든 5xx 문구가 바뀌어 범위 초과) | `http-exception.filter.ts`(`UNKNOWN_ERROR_MESSAGE`/`UNHANDLED_ERROR_MESSAGE`) vs `schedules.controller.ts` `toResponse()` | 조치 불요(추적 중) — 별도 PR 에서 필터 전역 문구 한국어 통일 |
| 21 | 보안 | `TriggerDto.chatChannelLastError`/`notificationLastError`(외부 provider 에러 메시지, 최대 1024자)는 이 PR 이전부터 이미 wire 로 나가던 값을 문서화(선언)한 것뿐이라 신규 노출 아님 — 다만 업스트림(Slack/Discord/Telegram) 에러 문자열이 헤더/토큰 일부를 반향하는 경우가 있는지는 이 PR 범위 밖 별도 감사 가치 있음 | `trigger-response.dto.ts`(신규 필드 선언), `triggers.service.ts` `setupChatChannel` catch(약 987~996행) | 조치 불요(범위 밖) — 백로그 기록 권고 |
| 22 | 보안 | `IntegrationDto.appUrl` 이 1회성 install token 을 URL 에 포함(`.../install/:installToken`) — 기존 설계이며 DTO 선언은 이미 나가던 값을 문서화했을 뿐, 신규 노출 아님. 프록시/access 로그/Referer 노출 표면이라는 일반적 우려는 있으나 이번 diff 의 결함 아님 | `integration-response.dto.ts:133-140` | 조치 불요(범위 밖) |
| 23 | 부작용/투명성 | 리뷰 도중 `schedules.controller.ts` 의 예외 메시지가 일시적으로 진단 정보(스케줄 id) 를 포함하는 형태로 바뀌었다가 즉시 원복된 것을 관측 — `git diff`/`git status --short` 로 커밋 상태와 현재 디스크 상태가 일치함(안전)을 재확인. 병렬로 도는 다른 세션의 뮤테이션 검증 잔상으로 추정, 본 리뷰어가 파일을 쓴 적 없음 | `schedules.controller.ts:96-99` | 조치 불요 — 최종 push 전 고정 문구 여부 및 관련 테스트 GREEN 재확인 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 트리거 secret 유출 수정(4축)의 완결성을 교차 검증 — 누락 없음. 신규 결함 없음, INFO 6건(전부 조치 불요/범위 밖) |
| architecture | LOW | 응답 경계 좁히기 책임이 컨트롤러/서비스로 레이어 불일치, 매퍼가 컴파일타임 대신 테스트로만 DTO 와 연결, 모듈 경계 넘는 테스트 의존 — 전부 INFO, 즉각 위험 낮음 |
| requirement | NONE | spec 본문(§5.4, secret-store, data-model, error-handling 등) 과 line-level 대조 전량 일치. secret-store.md 낡은 서술 1건은 이미 plan 추적 중(재확인) |
| scope | NONE | `sweep-response-contract` 목적에 부합하는 응집력 있는 스윕. import 미병합 등 사소한 스타일 잔여물 외 스코프 위반 없음 |
| side_effect | LOW | WARNING 1건(스케줄 목록 500 blast radius, 문서화된 트레이드오프 이월) — 그 외 breaking change/캐시/참조동일성 상실 등은 전부 INFO |
| maintainability | LOW | DTO 4파일 주석 verbatim 중복, 컨트롤러 헬퍼 책임 혼재 — 둘 다 실행 동작 무관, 병합 저지 사유 아님 |
| testing | NONE | unit 220건 GREEN, CWE-209 회귀 테스트에 대해 직접 뮤테이션 검증(되돌림→RED 확인) 수행 — vacuous 아님. INFO 3건만(가독성/커버리지 세분화) |
| documentation | NONE | 신규 필드 전부 JSDoc, CHANGELOG 완결, plan 트래커 취소선 정정 관례 준수 — 예외적으로 높은 문서화 수준. nav-spec 미러링 갭 1건은 이미 추적 중 |
| api_contract | LOW | 500 blast radius(side_effect WARNING 과 동일 사안 재확인), breaking change 는 근거와 함께 문서화, formatVersion/에러문구 drift 는 범위 밖 기추적 항목 |

## 발견 없는 에이전트

없음 — 9개 에이전트 전원이 최소 1건 이상의 관찰(대부분 INFO, 대부분 이미 조치 불요 또는
plan 에 추적 중)을 보고했다. CRITICAL 을 보고한 에이전트는 없다.

## 권장 조치사항

1. WARNING(스케줄 목록 API 의 500 blast-radius 확대)은 이미 CHANGELOG 에 의도된
   트레이드오프로 문서화·수용돼 있으므로 이번 PR 에서 즉시 조치 불요 — 다만 "고아 행이
   생길 수 없다"는 FK 전제가 깨지는 인시던트가 실제로 발생하면 "부분 성공 + 문제 행만
   표시" 전략으로 재검토할 신호로 삼을 것.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된 후속
   항목들(secret-store.md §1 정정, deny-list 4벌 → 선언적 SoT 전환, nav-spec 에
   trigger/workflow 키-생략 사유 반영, `consecutiveNetworkFailures` 제거 여부 결정,
   `INTERNAL_ERROR` 메시지 한국어 통일)을 다음 planner/developer 세션에서 순차 처리.
3. (경미, 급하지 않음) `workflow-crud.e2e-spec.ts` import 병합, DTO 4파일 주석 중복
   제거(convention 문서로 이관), `SchedulesController.toResponse` 책임 분리,
   CWE-209 테스트 중복 호출 통합 — 다음 터치 시 함께 정리 권장.
4. `sanitizeForResponse` 의 "항상 새 참조 반환" 불변식에 대한 명시적 `not.toBe` 단언
   추가를 고려(현재 실질 위험은 낮음).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (9명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨, 강제 화이트리스트 미이행 없음
  - **제외**: 5명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(사유 상세는 `_routing_decision.json` 참조) — 이번 diff 는 응답 필드 선언/스트립 위주로 성능 영향 낮음 판단 추정 |
  | dependency | 신규 의존성 도입 없음(security 리뷰에서도 확인) |
  | database | 스키마/마이그레이션 변경 없음(관계 로드에 `relations` 추가만) |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | user_guide_sync | 사용자 가이드 영향 표면 없음(내부 API 계약/보안 수정) |