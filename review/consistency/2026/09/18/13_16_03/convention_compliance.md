# 정식 규약 준수 검토 — `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 검토 범위

`spec/2-navigation/` 자체의 이번 라운드 델타는 0파일이다. 실 diff(6파일/157줄)는 이 영역과
frontmatter `code:` 로 연결된 구현 파일에 있다 — `spec/2-navigation/2-trigger-list.md` 의
`code:` 목록이 다음 두 항목을 명시적으로 가리킨다:

- `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.ts` (§4.3 "트리거 행을
  없애는 모든 경로는 그 트리거의 자원을 정리한다" 의 시행 코드)
- `codebase/backend/test/trigger-deletion-releases-resources.e2e-spec.ts` (같은 계약의 증거 e2e)

여기에 마이그레이션 V111(`spec/1-data-model.md`/`spec/data-flow/10-triggers.md` 연결, `spec/2-navigation`
밖) 과 `codebase/backend/migrations/README.md` 갱신이 더해진다. 확인 대상 정식 규약:
`spec/conventions/migrations.md`(전문), `spec/conventions/secret-store.md`(전문, 예산 절단분 직접
Read), `spec/conventions/error-codes.md`(전문, 직접 Read), `spec/conventions/spec-impl-evidence.md`
(전문, 직접 Read), `spec/conventions/swagger.md`(부분), `spec/conventions/review-citations.md`(전문,
직접 Read), `spec/conventions/audit-actions.md`(전문). `git diff origin/main` 로 실제 6파일 diff를
직접 대조했다(프롬프트 번들은 예산 절단으로 diff 본문이 빠져 있었다).

## 발견사항

- **[INFO] `trigger-resource-releaser.service.spec.ts` 가 §4.3 정본 컬럼 계약의 "정본" 인데 `2-trigger-list.md` `code:` 에 없다**
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (라인 57~95, 트리거 모듈
    개별 파일 나열 구간 — glob 없이 `trigger-resource-releaser.service.ts` 단일 파일만 등재)
  - 위반 규약: 엄밀한 위반은 아님 — `spec/conventions/spec-impl-evidence.md` §4 `spec-code-paths.test.ts`
    가드는 "글로브가 ≥1 파일에 매치" 만 요구하므로 이 상태로도 빌드는 통과한다. 다만 **같은 frontmatter
    가 스스로 세운 원칙**(라인 84~87 주석: `"헬퍼도 등재 — 단언의 정본(키셋 · 비밀 컬럼 목록)이 헬퍼에
    있어 e2e 만 넣으면 그 정본이 code: 밖에 남는다"`)과 결이 다르다.
  - 상세: 이번 diff 는 `releaseExternalForParent` 의 `find()` 를 `select: { id, type, config }` 로
    좁혔다. 정확히 그 컬럼 집합("config 가 빠지면 teardown 이 조용히 no-op, type 이 빠지면 schedule job
    을 못 찾는다")이 **`.service.ts` 소스 리터럴에 이미 드러나므로** e2e/헬퍼 사례처럼 "정본이 코드 밖에
    있는" 상황은 아니다. 그러나 그 리터럴이 실제로 지켜지는지(회귀 시 어떤 필드가 빠지면 무엇이
    깨지는지)를 **실행 가능한 형태로 고정**하는 자리는 `.spec.ts` 의 새 단언
    (`expect(...).toHaveBeenCalledWith({ select: { id: true, type: true, config: true }, ... })`) 뿐이다.
    같은 문서가 `endpoint-path-conflict-wrap*.ts`(시행 코드)와 그 대조군(fixture)을 나란히 등재하며
    "정본+테스트를 함께 무는 선례" 라고 명시한 것과 같은 논리를 적용하면, 이 단위테스트도 등재 대상이다.
  - 제안: `2-trigger-list.md` `code:` 에 `codebase/backend/src/modules/triggers/trigger-resource-releaser.service.spec.ts`
    한 줄을 추가한다(또는 인접 `trigger-resource-release.ts`/`trigger-resource-releaser.service.ts` 두
    엔트리를 `trigger-resource-release*.ts` 글로브로 묶어 `.spec.ts` 를 자연히 포함). 게이트를 막는 항목이
    아니므로 다음에 이 자리를 건드릴 때 반영해도 무방하다(참고: `review-citations.md` §4 의 "다음에
    건드릴 때 맞춘다" 와 동일한 비용/이득 판단).

## 재확인 — 이전 라운드(13:04:19) WARNING 두 건의 현재 상태

- **해소됨 — `spec/conventions/migrations.md` §5 콜아웃 vs `README.md §5` 폭 불일치.** 직전 라운드가
  지적한 "인덱스 **교체**" 한정 문구는 이번 세션 커밋(`ff7d79967`, `b92c6a611`)으로
  `spec/conventions/migrations.md`(현재 워킹트리 925~929행)가 "**교체든 신규 추가든**" 로 넓혀졌고,
  `codebase/backend/migrations/README.md §5` 에도 대응하는 "**신규 추가에도 0) 을 둡니다**" 절과 형태
  비교표(교체=DROP(새)+CREATE+DROP(옛), 신규=DROP(새)+CREATE)가 실제로 추가됐다 — 두 문서가 이제
  같은 폭을 말한다. `git diff origin/main -- codebase/backend/migrations/README.md` 로 직접 확인.
- **부분 해소·의도적 유지 — `spec/data-flow/8-notifications.md:277` "교체" 한정 표현.** 이 파일은
  `spec/2-navigation` 밖이라 이번 target 스코프는 아니지만, 커밋 메시지(`b92c6a611`)가 "V056 교체
  이력에 대한 경고라 주어가 실제로 교체 — 그대로 둔다" 는 근거를 명시했고, 현재 본문(260~277행)도
  그 문단 전체가 V056 단일 사건 서술("V056 자신은 append-only 라 소급 수정 대상이 아니다")이라 일반화
  주장이 아니다 — 폭 불일치가 재생산되지 않는다. 다만 이 판단의 근거가 **spec 문서 자체의 `## Rationale`
  이 아니라 커밋 메시지에만** 있다(CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 Rationale" 원칙과
  결이 다르나, 이 checker 의 소관인 `spec/conventions/**` 직접 위반은 아니므로 등급 부여는 보류하고
  참고로만 남긴다).
- **해소됨 — forward reference (draft 가 아직 `plan/in-progress/` 에 있는데 코드가 `plan/complete/` 를
  선인용).** `plan/complete/spec-draft-trigger-workflow-index.md` 로 실제 이동 완료(`b92c6a611`),
  `V111__trigger_workflow_id_index.sql:5` · `trigger-deletion-releases-resources.e2e-spec.ts` 의 인용이
  이제 유효하다(파일 존재 확인).

## 개별 규약 대조 (위반 없음 확인)

- **`spec/conventions/migrations.md` §1·§2·§4** — `V111__trigger_workflow_id_index.sql`/`.conf` 파일명
  `V<번호>__<snake_case_descriptor>` 형식 준수, `.conf` base name 일치, `ls migrations/` 로 V105~V111
  단조·gap 없음 확인, `outOfOrder` 미사용.
- **`spec/conventions/migrations.md` §5 신규 콜아웃 + `README.md §5`** — `.sql` 이 정확히
  `DROP INDEX CONCURRENTLY IF EXISTS <새 이름>` → `CREATE INDEX CONCURRENTLY IF NOT EXISTS <새 이름>`
  순서로 새 "신규 추가" 패턴을 그대로 구현했고 `CREATE` 는 1개 뿐(§5 "한 statement" 컨벤션 준수).
- **`spec/conventions/secret-store.md` §1.1** — `select: { id, type, config }` 명시적 select 는 이
  절이 지시하는 "응답 경계에서 지운다" 방식(전역 `select:false` 금지)과 같은 방향이다. 이번 read 는
  API 응답이 아니라 내부 정리 로직이라 §1.1 의 "응답 바디 노출 금지" 자체는 애초에 관여하지 않는다 —
  위반도 완화도 아니고 범위 밖.
- **`spec/conventions/error-codes.md` §1·§3** — `2-trigger-list.md` 본문이 쓰는
  `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT`/`VALIDATION_ERROR`/`INVALID_FIELD`/
  `AUTH_CONFIG_NOT_FOUND`/`RESOURCE_NOT_FOUND`/`BOT_TOKEN_INVALID`/`INTERNAL_ERROR` 모두
  `UPPER_SNAKE_CASE` + 의미 기반 명명이며 예외 레지스트리(§3)에 걸리는 lowercase/PascalCase 사례가
  아니다.
- **`spec/conventions/spec-impl-evidence.md` §2·§3** — `2-trigger-list.md` frontmatter
  `id: trigger-list` (basename 기반 kebab-case), `status: partial` + `pending_plans` 로
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 가리키며 해당 파일이 실존
  (`find plan -iname "*nullable*"` 확인) — §4 가드 요건 충족. 같은 규약 §Rationale R-11 이 2026-09-18
  시점에 "`2-trigger-list.md`·`chat-channel-adapter.md` 는 아직 승격 전" 이라고 명시적으로 기록하고
  있어 현재 `partial` 상태가 stale 승격 누락이 아니라 의도된 상태임을 교차 확인했다.
- **문서 구조 (Overview/본문/Rationale)** — `2-trigger-list.md`/`3-schedule.md` 는 자체 `## Overview`
  절 없이 바로 본문(§1~)으로 시작하지만, 각 문서 상단이 `_product-overview.md` 의 해당 절을 링크한다
  (project-planner SKILL.md "다중 spec 파일을 가진 영역은 Overview 를 `_product-overview.md` 로 분리"
  규칙과 일치) — 위반 아님.
- **금지 항목** — `migrations.md` 가 금지하는 alphanumeric suffix(`V035a` 류), 기존 V파일 수정,
  `outOfOrder=true` 사용 중 어느 것도 이번 diff 에 없다.

## 요약

이번 라운드의 실질 변경(V111 마이그레이션 + `trigger-resource-releaser.service.ts` 컬럼 스코핑 +
`migrations/README.md` 갱신)은 `spec/conventions/migrations.md`·`secret-store.md`·`error-codes.md`·
`spec-impl-evidence.md` 어느 것도 위반하지 않는다. 오히려 직전 라운드(13:04:19)가 지적한 두 WARNING
중 하나(정책 문서 폭 불일치)를 이번 커밋들이 실제로 닫았고, forward-reference 문제도 draft 이동으로
해소됐다. 유일한 잔여는 새 단위테스트 단언(정본 컬럼 계약의 실행 가능한 고정점)이 `2-trigger-list.md`
`code:` 에 아직 등재되지 않은 완결성 공백으로, 빌드 게이트를 막지 않는 INFO 수준이다.

## 위험도

NONE
