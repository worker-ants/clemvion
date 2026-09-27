# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done)

## 검토 대상 요약

- **spec 델타**: `spec/2-navigation/` 0개 파일 (이 브랜치는 spec 을 바꾸지 않았다 — 정상).
- **코드 diff**: `folders.service.ts` PATCH 부분 본문 버그 수정(보내지 않은 필드가 응답에서 사라지거나
  거짓 `null` 로 실리던 결함), 공용 헬퍼 `common/utils/omit-undefined.ts` 신설, 그 호출을
  `triggers.service.ts` `update()` 의 기존 인라인 필터와 통합(동작 불변 리팩터), `FolderDto.parentId`
  를 `optional+nullable` → `required+nullable`(§5.4 기본형)로 승격.
- HEAD 워킹트리에서 diff·plan·2 라운드 `/ai-review`(Critical 0 수렴)를 직접 확인했다.

## 발견사항

Cross-Spec 관점에서 아래 항목을 점검했으며, **CRITICAL/WARNING 급 충돌은 발견되지 않았다**.

- **데이터 모델 충돌 — 없음**: `FolderDto.parentId: string | null`(상시 존재, nullable)은
  `spec/1-data-model.md §2.5 Folder` 의 `parent_id: UUID?` 정의와 모순되지 않는다. camelCase(API)
  vs snake_case(DB) 매핑도 기존 관행 그대로다.
- **API 계약 충돌 — 없음**: `spec/2-navigation/1-workflow-list.md §3.1` 은 PATCH 를 "부분 수정"으로만
  서술하고 응답 필드별 present/absent 형태를 규정하지 않는다 — 이번 수정은 그 서술과 어긋나지 않고,
  오히려 §3.1 이 이미 전제하던 "부분 수정 = 나머지 필드는 유지"라는 계약을 구현이 뒤늦게 맞춘 것이다.
  DTO 선언 형태 변경(`@ApiProperty({ type: String, format: 'uuid', nullable: true })`)도
  [`spec/5-system/2-api-convention.md §5.4`](../../../../../spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략)
  의 "상시 존재 + null" 기본형 규칙과 정확히 일치한다(`@ApiPropertyOptional` 미사용도 그 절이 명시한
  이유 그대로).
- **계층 책임 충돌 — 없음**: `omit-undefined.ts` 는 `triggers.service.ts` 와 `folders.service.ts`
  양쪽에서 쓰는 공용 헬퍼이며, 두 co-owner spec(`2-navigation/2-trigger-list.md`,
  `5-system/12-webhook.md` 가 같은 `triggers.service.ts` 를 `code:` 로 문다)이 이미 이 리팩터를
  "동작 불변"으로 확인했고(`/ai-review` 1R W1, 2R Critical 0 수렴) 두 spec 문서 어느 쪽 서술과도
  충돌하지 않는다. 신설된 `common/utils/omit-undefined.ts` 자체는 특정 도메인 spec 이 아니라
  cross-cutting 유틸리티라 특정 `code:` 리스트 소유권 다툼을 만들지 않는다.
- **요구사항 ID / 상태 전이 / RBAC 충돌 — 없음**: 이번 변경은 권한(`editor`+ 그대로), 상태 머신,
  요구사항 ID 체계에 손대지 않는다.
- **알려진 후속 결함은 이미 추적됨(신규 지적 아님)**: 같은 `Object.assign(엔티티, DTO)` 패턴이
  `workflows.service.ts` / `nodes.service.ts` / `auth-configs.service.ts` 에도 남아 있다는 사실은
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 백로그 항목으로 등재돼 있다
  (2026-09-27, "실측은 아직 없다" 로 명시). 이는 현재 target 문서와의 cross-spec 충돌이 아니라
  이미 처분된 추적 항목이므로 재-flag 하지 않는다.

### 참고 (비차단, target 밖)

- `GET /api/folders` 는 페이지네이션이 없는 목록이며 응답이 `{ data: [...] }` (bare array, `pagination`
  형제 없음) 형태다. `spec/5-system/2-api-convention.md §5.2` 의 "비-페이징 고정 컬렉션" 예외는
  세션·WebAuthn 두 엔드포인트로 좁게 스코프돼 있어 폴더 목록이 그 예외에 해당한다고 문서가 명시하지는
  않는다. 다만 이 형태는 `ApiOkWrappedArrayResponse` 라는 기존 공용 헬퍼가 다른 비-페이징 배열
  응답에도 이미 쓰는 기존 패턴이고, 이번 diff 가 `folders.controller.ts`/목록 엔드포인트를 전혀
  건드리지 않았으므로 이번 PR 이 만든 충돌이 아니다. INFO 수준의 문서 정합 검토 대상으로만 남겨둔다
  (§5.2 에 "bare-array 비-페이징" 세 번째 카테고리로 명시할지는 별도 planner 턴 판단).

## 요약

이번 변경은 `spec/2-navigation/` 을 직접 수정하지 않는 코드 전용 PR(폴더 PATCH 응답 버그 수정 +
트리거·폴더 공용 `omitUndefined` 헬퍼 통합 + `FolderDto.parentId` §5.4 기본형 승격)이며, 데이터 모델
(`1-data-model.md §2.5`)·API 계약(`1-workflow-list.md §3.1`, `2-api-convention.md §5.4`)·co-owner
spec(`2-trigger-list.md`, `12-webhook.md`)의 기존 서술 어느 것과도 모순을 일으키지 않는다. 관련된
동일 결함 패턴(다른 3개 서비스)은 이미 별도 plan 에 추적 등재돼 있어 재지적 대상이 아니다. 발견된
유일한 항목은 폴더 목록 응답 envelope 형태에 대한 §5.2 문서화 공백이며, 이는 이번 diff 의 산물이
아니고 심각도도 정보성(INFO)에 그친다.

## 위험도

NONE
