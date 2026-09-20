# 정식 규약 준수 검토 — spec/2-navigation (--impl-done)

## 검토 범위

이번 PR 의 실제 구현 diff(`git diff origin/main...HEAD`, 3 파일 / 268줄)는 `spec/2-navigation`
을 변경하지 않는다(scope 델타 0개 파일 — 정상, 코드 전용 수정). 워킹트리를 절대경로로 직접
확인했다(`git -C .../trigger-dup-delete-3f7a92 diff origin/main...HEAD -- codebase/`):

- `codebase/backend/src/modules/triggers/triggers.service.ts` — advisory lock 획득 뒤 명시
  재조회(`m.findOne(Trigger, { where: { id, workspaceId } })`) 추가, 없으면
  `this.throwTriggerNotFound()`(기존 헬퍼, line 412 재사용) 호출. `.catch` 에서
  `NotFoundException` 인스턴스는 "반쯤 삭제됨" `logger.error` 를 남기지 않고 그대로 재던짐.
- `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — 위 분기 단위 테스트 2건 추가.
- `codebase/backend/test/trigger-delete-concurrency.e2e-spec.ts` — advisory lock 을 쥔 채 동시
  DELETE 두 건을 쏘아 `[204, 404]` + 감사 행 1건을 실제 Postgres 로 고정하는 신규 e2e.

번들 중 본문이 온전한 대상은 `spec/2-navigation/2-trigger-list.md` ·
`spec/2-navigation/1-workflow-list.md` (그리고 `3-schedule.md` 는 앞부분만) — 나머지
`spec/2-navigation/*` 파일은 컨텍스트 예산으로 절단됐다(해당 파일은 판정 보류, "위반 없음"의
근거로 쓰지 않는다). 대조군은 `spec/conventions/**` 전량이며, 이번 코드 diff 의 성격(트리거
삭제 동시성·감사·에러코드)에 맞춰 `error-codes.md` · `audit-actions.md` · `secret-store.md` 를
전문 대조했다.

## 발견사항

- **[INFO]** `GET /api/triggers/:id/history` 응답 포맷 인용 누락 (이번 PR 무관, 기존 상태 유지)
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표, `GET
    /api/triggers/:id/history` 행
  - 위반 규약: `spec/conventions/swagger.md §5-2`(`ApiOkWrappedArrayResponse` 카탈로그) ·
    참고 `spec/5-system/2-api-convention.md §5.2`(목록 응답 형식)
  - 상세: 같은 §3 표의 형제 행(`GET /api/triggers`, `3-schedule.md §4` 의 `GET
    /api/schedules`)은 "페이지네이션 응답 형식은 §5.2 준수" 를 명시하지만 이 행만 포맷 인용이
    없다. 구현(`triggers.controller.ts` `getHistory` → `@ApiOkWrappedArrayResponse`)은 규약을
    어기지 않으나, 문서만 보면 페이징 목록/비-페이징 고정 컬렉션/bare array 중 어느 것인지 알
    수 없다. 직전 `--impl-prep` 검토(`review/consistency/2026/09/20/21_43_47/convention_compliance.md`)
    가 이미 지적한 항목이며 이번 diff 가 그 영역을 건드리지 않아 그대로 남아 있다.
  - 제안: "최근 10건 고정 배열 — 페이지네이션 없음(`ApiOkWrappedArrayResponse`)" 한 줄 추가.
    BLOCK 사유 아님.

## 점검했으나 위반 없음 (이번 diff 관련, 근거 포함)

- **에러 코드**(`error-codes.md §1·§3`): 신규 재조회 분기가 던지는 코드는 `RESOURCE_NOT_FOUND`
  — 새 코드가 아니라 같은 파일의 기존 헬퍼 `throwTriggerNotFound()`(line 412, `findById`·
  `update()`·`interaction/revoke-token` 경로가 이미 공유)를 그대로 재사용한다. target
  §4.4("동시 삭제: … 두 번째는 404 `RESOURCE_NOT_FOUND`")가 이미 이 동작을 선언하고 있었고,
  이번 코드 변경은 그 선언을 실측으로 채운 것이다(spec 이 코드보다 먼저 계약을 명시한 SDD
  사례) — 명명·표기(UPPER_SNAKE_CASE) 모두 신규 위반 없음.
- **에러 로그 오탐 구분**(`triggers.service.ts` `.catch`): `NotFoundException` 을 "반쯤
  삭제된 상태" 로그에서 제외한 것은 target §4.3 상단 註("동시 삭제로 행이 이미 사라진 경우는
  반쯤 삭제된 상태가 아니다")와 문면 그대로 일치 — 새 문서 서술이 필요한 신규 정책이 아니라
  이미 spec 이 서술한 동작.
- **Secret Store 정리 생략**(`secret-store.md §2.1`): 진 쪽 요청(404)이 `deleteByPrefix`를
  호출하지 않는다는 단위 테스트 단언은 secret-store.md §2.1 "행 삭제가 커밋된 뒤 정리 — 이긴
  쪽이 이미 정리했다" 규약과 정합하며 별도 위반 없음.
- **감사 액션 명명**(`audit-actions.md §3`): 이번 diff 는 `trigger.deleted` 액션 자체의 명명을
  바꾸지 않는다(레지스트리의 과거분사 `deleted` 그대로) — 중복 행 발생을 막는 로직 수정일 뿐
  새 액션 이름을 도입하지 않아 §3 레지스트리와 계속 일치한다.
- **문서 구조**(CLAUDE.md 3섹션 권장): `2-trigger-list.md` 는 Overview 를
  `_product-overview.md` 링크로 위임, 본문(§1~§4)과 말미 `## Rationale`(R-1~R-17)을 갖췄고
  frontmatter 에 `id`/`status`/`code:` 도 있다 — 이번 diff 가 이 구조를 바꾸지 않았고 구조
  자체도 규약과 정합.
- **API 문서 도구 규약**(`swagger.md`): 이번 diff 는 컨트롤러·DTO·swagger 데코레이터를
  건드리지 않는다(순수 서비스 레이어 재조회 로직) — 신규 명명 표면 없음.

## 요약

이번 PR 의 실제 변경은 `TriggersService.remove()` 의 advisory-lock 재조회 로직과 그에 딸린
테스트뿐이며 `spec/2-navigation` 자체는 건드리지 않는다. 코드가 새로 구현한 동작(동시 삭제 시
두 번째 요청 404 `RESOURCE_NOT_FOUND`, 로그 오탐 억제, 승자만 secret 정리)은 모두
`spec/2-navigation/2-trigger-list.md` §3/§4.3/§4.4 가 이미 선언해 둔 계약과 `error-codes.md`·
`audit-actions.md`·`secret-store.md` 의 명명/책임 규약에 정확히 부합해 신규 CRITICAL/WARNING
위반이 없다. 유일한 지적은 이번 diff 와 무관한 기존 INFO(호출 이력 endpoint 응답 포맷 인용
누락)이며 이전 `--impl-prep` 검토에서 이미 식별된 항목이 그대로 이월된 것이다.

## 위험도

LOW
