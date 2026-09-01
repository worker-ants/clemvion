# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 발견사항

없음 — 이번 changeset 은 doc-sync-matrix(`.claude/config/doc-sync-matrix.json`) 의 어떤 trigger 에도 매칭되지 않는다.

### 근거 (trigger 별 배제 사유)

변경 파일 전수(116개, `meta.json`/git status 대조 완료)를 매트릭스 21개 행에 대입한 결과:

- **새 노드 추가 / 노드 schema 변경** (`codebase/backend/src/nodes/**`) — 매칭 파일 없음. 변경은 `codebase/backend/src/modules/{audit-logs,auth-configs,metrics}/**` 와 `codebase/backend/src/repo-guards/__tests__/**` 로, `nodes/` 트리 밖.
- **신규 UI 문자열 (TSX)** — `codebase/frontend/src/**/*.tsx` 변경 없음. frontend 코드 자체가 이번 changeset 에 없음.
- **통합/제공자 변경, 신규 위젯 chrome 문자열** — 해당 없음(frontend·channel-web-chat 미변경).
- **유저 가이드 신규 섹션 디렉토리** — `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음.
- **인증·권한·세션 흐름 변경** — trigger glob 은 `codebase/backend/src/modules/auth/**` 다. 변경 파일은 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 로 **다른 모듈**이다(`find codebase/backend/src/modules -maxdepth 1 -iname "auth*"` 로 `auth/` 와 `auth-configs/` 가 별도 디렉토리임을 확인). `auth-configs` 는 트리거/웹훅의 **외부 인증 설정**(api_key/bearer_token/basic_auth/hmac, spec/1-data-model.md §2.17)을 다루며 로그인·세션·워크스페이스 인가 흐름이 아니다. 07-workspace-and-team 갱신 대상이 아니다.
- **AuthConfig type enum 변경** — 이번 diff 는 `recordAudit` 의 `action` 파라미터 타입을 `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>` 로 좁힌 **컴파일 타임 전용** 변경이다. `AuthConfig.type` enum(api_key/bearer_token/basic_auth/hmac) 자체는 추가·변경되지 않았다 — 해당 없음.
- **표현식 언어 변경** — `codebase/packages/expression-engine/**` 변경 없음(관련 파일은 `plan/in-progress/expression-engine-error-shape-spec-broken-on-main.md` 뿐이며, 이는 **main 의 선재 컴파일 breakage 를 기록한 plan 문서**이지 expression-engine 소스 변경이 아니다).
- **실행·디버깅 흐름 변경** — 변경은 감사 로그(admin 특권 작업 audit trail)와 OTel 메트릭 카운터 신설이며, 워크플로 노드 실행·디버그 패널(05-run-and-debug) 흐름과 무관하다.
- **신규 warningCode 발행** — `business-metrics.service.ts` 에 추가된 것은 OTel `Counter`(`clemvion.audit.write_failed`, 내부 관측용) 이지, 워크플로 노드 validation/실행이 사용자에게 노출하는 `warningRules` 코드가 아니다. `backend-labels.ts` 의 `WARNING_KO` 대상이 아니다.
- **신규 errorCode 발행** — `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음.
- **spec 신규/대규모 변경** — `spec/5-system/_product-overview.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/9-observability.md` 3건이 매트릭스 glob(`spec/5-*/**`)에 매칭되나, 이는 `RESOLUTION.md`(14_31_12 SD1) 가 기록한 **planner 턴의 NF-OB-07 카탈로그 표 갱신**(frontmatter code:/status: 정합)이며 본 reviewer 의 점검 관점(①~⑨, frontend docs MDX·i18n dict·backend-labels·locale.ts)의 대상이 아니다 — spec 자체의 frontmatter 정합은 consistency-checker/spec-coverage 영역이다.

이번 changeset 의 실질 코드 변경은 (1) `AuditLogsService.record()` 의 삼킨 실패를 OTel 카운터 + 확장 로그 메시지로 관측 가능하게 한 것, (2) `AuthConfigsService.recordAudit` 의 `action` 파라미터를 리소스에 묶인 타입으로 좁힌 것, (3) 그 바인딩을 강제하는 정적 분석 repo-guard(AST 파서) 신설 — 세 가지 모두 **backend 내부 관측성·타입 안전성** 문제이며 사용자 가시 UI 문자열·노드 스키마·통합 문서·표현식 언어·워크스페이스 인증 흐름 어느 것도 변경하지 않는다. 나머지 파일(plan/*, review/*, CHANGELOG.md)은 문서/트래커/리뷰 산출물로 매트릭스 trigger 대상 소스가 아니다.

## 요약

매트릭스 21개 trigger 행 중 이번 changeset 에 매칭되는 행은 0건이다 — 변경은 감사 로깅 관측성(OTel 카운터·로그 메시지) + `recordAudit` 액션 타입 바인딩 정적 가드 + 관련 plan/review 산출물로 구성되며, `codebase/frontend/src/content/docs/**`·`codebase/frontend/src/lib/i18n/dict/**`·`backend-labels.ts`·`locale.ts` 어느 것도 갱신이 필요하지 않다. `auth-configs.service.ts` 변경은 트리거/웹훅용 외부 인증 설정 모듈이며 "인증·권한·세션 흐름 변경"(`modules/auth/**`)과는 다른 디렉토리이므로 오탐 배제를 명시적으로 확인했다.

## 위험도

NONE
