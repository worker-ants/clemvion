# 신규 식별자 충돌 검토 — spec-draft-integration-personal-owner

## 발견사항

없음 (검토한 6개 관점 모두 충돌 없음).

### 확인 내역 (참고용)

- **요구사항 ID** — target 은 새 ID 를 발급하지 않는다. `404 RESOURCE_NOT_FOUND` · `403 FORBIDDEN` 을 신규 판정 응답으로 쓰는데, 두 코드 모두 `spec/5-system/2-api-convention.md:195`("400=`VALIDATION_ERROR`, 401=`AUTH_REQUIRED`, 403=`FORBIDDEN`, 404=`RESOURCE_NOT_FOUND` …")가 정의한 상태코드별 **기본 코드**이자 코드베이스 전역(`http-exception.filter.ts`, `triggers.service.ts`, `workflow-ownership.util.ts` 등)에서 이미 같은 의미로 쓰인다. target 의 사용은 그 기존 정의와 정확히 같은 의미(리소스 부재 / 권한 없음)라 충돌이 아니라 올바른 재사용이다.
- **엔티티/타입명** — 새 DTO·인터페이스를 도입하지 않는다. 언급되는 `Cafe24PrecheckResultDto`(`existingIntegrationId?`·`existingName?`), `IntegrationDto` 는 §9.1~9.2 에 이미 정의된 기존 타입이며, target 은 그 위에 "남의 personal 이면 두 필드를 싣지 않는다" 는 값-레벨 규칙만 얹는다 — 필드가 이미 optional(`?`)이라 스키마 충돌이 없다.
- **API endpoint** — target 은 endpoint 를 신설하지 않는다. `GET /api/integrations`, `:id` 하위 전 endpoint, `POST /api/integrations/oauth/begin`, `PATCH /api/integrations/:id/scope`, `GET /api/integrations/cafe24/precheck` 등 언급된 경로 전부가 `spec/2-navigation/4-integration.md §9.1~9.2`(라인 806~831)에 이미 method+path 로 정의돼 있고, target 은 그 응답 판정(404/403)만 새로 규정한다.
- **이벤트/메시지명** — webhook·queue·SSE 이벤트명을 신설하지 않는다.
- **환경변수·설정키** — 새 ENV var 없음. frontmatter `pending_plans:` 키는 `spec/conventions/spec-impl-evidence.md`(R-5, §3)가 정의한 기존 정식 필드이며, 이미 `4-integration.md` 를 포함해 다수 spec 파일(`1-auth.md`, `9-user-profile.md`, `1-workflow-list.md` 등)에서 같은 의미로 쓰인다 — 새 키가 아니라 기존 컨벤션의 정상 사용.
- **파일 경로** — 동반 산출물 `plan/in-progress/integration-personal-owner-followup.md` 는 저장소에 아직 존재하지 않아(확인: `ls` 결과 없음) 기존 파일과 겹치지 않는다. `-followup.md`(단수) 명명은 기존 선례(`webchat-spec-rationale-followup.md`)와 `-followups.md`(복수, `harness-review-gate-followups.md` 등) 양쪽이 공존하는 저장소라 컨벤션 이탈도 아니다. 같은 worktree(`integration-personal-owner`)를 가리키는 다른 `worktree:` frontmatter 중복도 없음(grep 1건 = 자기 자신).
- **섹션 제목 재사용(참고, 비-식별자)** — "판정 규칙" 이라는 소제목은 `spec/2-navigation/14-execution-history.md:99`(표 컬럼명), `spec/5-system/4-execution-engine.md:1552`, `spec/5-system/2-api-convention.md:330` 등에서도 쓰이지만, 이는 전역 식별자가 아니라 각 문서 내부 지역 소제목("판정 기준을 설명하는 문단")으로 문서마다 독립적으로 스코프된다. 상호 참조나 앵커 충돌이 없어 등급 부여 대상이 아니다.
- **Rationale 상호참조 정합성** — target 이 인용하는 기존 Rationale 제목 "«경로 파라미터 워크스페이스도 가드가 본다»"(`spec/data-flow/12-workspace.md:354`)와 DB 제약 `integration_workspace_name_unique`(`4-integration.md:1618`), 에러코드 `INTEGRATION_NAME_TAKEN`(`integrations.service.ts:1594`)은 모두 실제로 존재하며 target 의 인용과 의미가 일치한다.

## 요약

target 문서는 새 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수를 전혀 신설하지 않고, 기존 §8 표·§9 API 목록·`RESOURCE_NOT_FOUND`/`FORBIDDEN` 표준 에러코드·`pending_plans` frontmatter 컨벤션 위에 판정 규칙(누가·무엇을·어떤 응답으로)만 얹는 방식으로 작성됐다. 유일한 신규 파일 경로(`integration-personal-owner-followup.md`)도 미사용 경로이고 명명 컨벤션 이탈이 없다. 신규 식별자 충돌 관점에서 문제 될 소지가 없다.

## 위험도

NONE
