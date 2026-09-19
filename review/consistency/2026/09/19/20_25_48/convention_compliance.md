# 정식 규약 준수 검토 — 웹훅 경로 영구 예약 (spec/2-navigation/2-trigger-list.md, impl-done)

## 검토 범위

- target 델타: `spec/2-navigation/2-trigger-list.md` (2줄 변경 — `endpointPath` 409 사유에
  "다른 워크스페이스가 예약한 경로" 추가, `[데이터 모델 §2.8.1]` 링크 신설)
- 연동 구현 diff: V133 마이그레이션(`webhook_endpoint_reservation` 테이블 + DB 트리거) ·
  `WebhookEndpointReservation` 엔티티 · `triggers.service.ts`/`triggers.controller.ts`/
  `triggers.service.spec.ts` 갱신 · 신규 e2e 2건 · `spec/1-data-model.md` §2.8.1 신설 ·
  `spec/5-system/3-error-handling.md` §1.10 · `spec/5-system/12-webhook.md` · `spec/data-flow/10-triggers.md`
  동반 갱신
- 대조 규약: `spec/conventions/error-codes.md`, `spec/conventions/migrations.md`,
  `spec/conventions/raw-query-results.md`, `spec/conventions/swagger.md`,
  `spec/conventions/spec-impl-evidence.md`

## 발견사항

이번 델타에서 정식 규약(`spec/conventions/**`) 위반은 발견하지 못했다. 확인한 항목은 다음과 같다 (전부 준수):

- **명명 규약**
  - 마이그레이션 파일명 `V133__webhook_endpoint_reservation.sql` — `migrations.md §1` 의
    `V<번호>__<snake_case_descriptor>` 형식 준수. `origin/main` 의 max V(132) + 1, gap 없음
    (`migrations.md §2` 단조 증가/gap 금지) — 실측: `git ls-tree origin/main -- codebase/backend/migrations`
    확인 결과 V132 가 origin/main 최댓값.
  - 신규 에러 세부 코드 없음 — 기존 `TRIGGER_ENDPOINT_PATH_CONFLICT`(`UPPER_SNAKE_CASE`,
    `error-codes.md §1`)를 재사용. "의미 기반 명명" 원칙(§1) 은 조건의 *의미*(엔드포인트 경로
    충돌)를 이름에 담으라는 것이지 구현상의 DB 제약 이름 개수를 이름에 반영하라는 것이 아니므로,
    같은 의미의 두 DB-레벨 원인(살아 있는 UNIQUE 위반 · 예약 라벨)을 한 코드로 묶은 것은 원칙
    위반이 아니라 오히려 "구현 세부를 이름에 박지 않는다"에 부합한다. target 의 Rationale
    (`1-data-model.md` "지운 · 바꾼 웹훅 경로의 영구 예약")이 그 근거(정보 유출 방지)를 명시한다.
  - 신규 엔티티 `WebhookEndpointReservation`(PascalCase 클래스, `webhook_endpoint_reservation`
    스네이크케이스 테이블) — 기존 `Trigger`/`Schedule` 등 엔티티 네이밍과 일관.

- **출력 포맷 규약**
  - 409 응답 형태는 기존 `RESOURCE_CONFLICT` + `details.field='endpoint_path'` +
    `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'` 계약을 그대로 유지 — 새 원인을 추가하며
    `details` 형태를 바꾸지 않았다(`error-handling.md §1.10`, `api-convention.md §5.3` 객체
    형태 유지).
  - `pg` raw 쿼리(e2e) 의 컬럼 접근은 전부 snake_case(`endpoint_path`, `workspace_id`)로
    타입·구조분해 일관 — `raw-query-results.md` 불변식 (b) 위반 없음.

- **문서 구조 규약**
  - `spec/1-data-model.md` 신설 §2.8.1 은 기존 엔티티 섹션(§2.8 Trigger) 바로 아래 하위 절로
    배치되고, 근거는 문서 말미 `## Rationale` 에 새 절로 추가되어 Overview/본문/Rationale 3분할
    관례를 그대로 따른다. `frontmatter code:` 에 신규 e2e(`webhook-endpoint-reservation.e2e-spec.ts`)를
    추가해 `spec-impl-evidence.md` 의 "code: 는 그 사실을 시행하는 코드를 가리킨다" 원칙과 합치.
  - `spec/2-navigation/2-trigger-list.md` 자체는 두 줄만 바뀌었고 기존 섹션 구조(§3 API · Rationale)
    를 건드리지 않았다.

- **API 문서 규약**
  - `triggers.controller.ts` 의 `TRIGGER_ENDPOINT_PATH_CONFLICT_DESCRIPTION` 상수는 문자열
    내용만 갱신되고 `@ApiOperation`/`@ApiResponse` 데코레이터 구조·명명은 그대로 — `swagger.md`
    관련 패턴 변경 없음.

- **금지 항목**
  - `migrations.md §3` (append-only) 위반 없음 — 기존 V131/V132 파일은 수정하지 않고 신규
    V133 만 추가.
  - `outOfOrder`/alphanumeric suffix 등 금지 패턴 사용 없음.

## 참고 (규약 밖이라 등급 매기지 않음)

- V133 이 `RAISE EXCEPTION … USING ERRCODE = 'unique_violation', CONSTRAINT = '...'` 로
  실재하지 않는 제약 이름을 라벨링해 서비스가 그 이름으로 409 를 판별하게 하는 패턴은
  이 저장소 마이그레이션 중 최초 사용례다(`grep -rl "USING CONSTRAINT" migrations/*.sql` 결과
  V133 하나). `migrations.md` 는 이 관용구를 아직 문서화하지 않았지만, 명시적으로 금지하지도
  않고 SQL 헤더·엔티티 JSDoc·서비스 주석·spec Rationale 넷 모두에 그 의도(실재 제약이 아니라
  라벨)가 충분히 적혀 있어 규약 위반으로 보지 않는다. 다음에 유사 패턴이 또 나오면(2회째)
  `migrations.md` 작성 가이드에 관용구로 올리는 것을 고려할 만하다 — 지금은 갱신을 요구할
  정도는 아니다.

## 요약

target 델타(`spec/2-navigation/2-trigger-list.md` 2줄)와 그에 딸린 구현(V133 마이그레이션·
엔티티·서비스·컨트롤러·e2e, `spec/1-data-model.md` §2.8.1 신설 포함)은 명명(마이그레이션 V번호·
에러 코드 UPPER_SNAKE_CASE·엔티티 클래스명)·출력 포맷(409 `RESOURCE_CONFLICT` 계약 불변)·
문서 구조(Overview/본문/Rationale, frontmatter `code:`)·API 문서(Swagger 데코레이터 불변) 규약을
모두 준수한다. 금지 항목(마이그레이션 수정, alphanumeric suffix 등) 위반도 없다. 코드 하나로
두 DB-레벨 원인을 묶은 설계는 에러 코드 "의미 기반 명명" 원칙과 충돌하지 않으며 그 근거가
spec Rationale 에 명시돼 있다.

## 위험도

NONE
