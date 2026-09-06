# 정식 규약 준수 검토 — spec/2-navigation/ (impl-done)

검토 범위: `spec/2-navigation/2-trigger-list.md` · `spec/2-navigation/3-schedule.md` (컨텍스트 예산 내 전문 확보). 그 외 15개 영역 파일과 코드 diff 는 프롬프트 예산 절단으로 본문 미확보 — 아래 발견사항은 확보된 두 파일과, 전문을 직접 읽은 관련 `spec/conventions/*.md`(swagger.md·error-codes.md·audit-actions.md·egress-masking.md·secret-store.md·spec-impl-evidence.md·review-citations.md) 대조에 근거한다. 코드 diff 본문은 미확보 상태라 코드 자체의 규약 위반(예: DTO 데코레이터)은 이번 라운드에서 직접 관측하지 못했고, 별도로 `triggers.service.ts` 를 직접 열어 아래 CRITICAL/WARNING 판정의 실측 근거로 삼았다.

## 발견사항

### WARNING — `2-trigger-list.md` frontmatter `status: implemented` 가 본문이 자백한 미구현 surface 와 모순
- target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter(`status: implemented`, `pending_plans:` 없음) vs 본문 §3 API 표 `GET /api/triggers` 행 — "⚠️ `PaginationQueryDto` 가 `sort`/`order` 를 받긴 하나 `findAll` 은 이를 무시하고 `created_at DESC` 로 고정 정렬한다. sort/order 반영은 미구현/Planned"
- 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `status` 라이프사이클 — `implemented` = "모든 약속 구현 완료"이고 미구현 surface 가 있으면 `partial` + `pending_plans:` 의무.
- 상세: 실측 확인 결과(`codebase/backend/src/modules/triggers/triggers.service.ts:294` `qb.orderBy('t.created_at', 'DESC')` 하드코딩, whitelist 기반 `orderBy` 미구현) 본문의 "미구현/Planned" 서술이 현재도 참이다. 즉 이 spec 문서는 자신이 약속한 API surface(`sort`/`order` 쿼리 반영)가 아직 구현되지 않았음을 스스로 명시하면서도 frontmatter 는 `status: implemented`(pending_plans 없음)를 유지한다. 같은 문제를 겪었던 **자매 문서 `3-schedule.md`** 는 정확히 이 패턴을 이미 겪었고(`GET /api/schedules` 의 동일 sort/order 갭을 `plan/in-progress/spec-sync-schedule-gaps.md` 로 추적하며 Rationale "sort/order 쿼리 반영 — '미구현/Planned' 표기 해제 (2026-06-10)" 에 그 경위를 남겼다), 실제 구현 완료 후에야 표기를 해제했다. `2-trigger-list.md` 는 같은 처리를 받지 못한 채 미구현 상태로 `implemented` 를 자칭하고 있다.
- 제안: (a) trigger 목록 `sort`/`order` whitelist 정렬을 구현해 표기를 해제하거나, (b) 구현 전까지는 frontmatter 를 `status: partial` 로 낮추고 이 갭을 추적하는 `pending_plans:` 항목(신규 plan 파일, 예: `plan/in-progress/spec-sync-trigger-sort-order.md`)을 등재한다 — `3-schedule.md` 의 기존 처리 패턴을 그대로 따르면 된다.

### WARNING — Rationale R-2 가 이미 폐기된 설계를 정정 표시 없이 서술
- target 위치: `spec/2-navigation/2-trigger-list.md` `### R-2. Webhook HMAC secret 입력 vs. rotate 분리`
- 위반 규약: 직접적으로 `spec/conventions/*.md` 항목 하나를 위반하는 것은 아니지만, CLAUDE.md 가 요구하는 "결정의 배경·근거"로서의 Rationale 신뢰성 및 이 저장소 전반의 확립된 관행(`review-citations.md`/`spec-impl-evidence.md` 등에서 관측되는 "~~취소선~~ + **정정 (날짜)**" 표기로 폐기된 결정을 명시하는 패턴)과 어긋난다.
- 상세: R-2 는 `PATCH /api/triggers/:id { config.hmacSecret }` (v1) vs `POST /api/triggers/:id/auth/rotate-secret` (v1.1) 이원 설계를 현재형으로 서술한다. 그러나 같은 문서의 §2.3.1 매트릭스(Auth Config 행은 `authConfigId` 단일 필드만 존재, 인라인 `hmacSecret` 없음), R-14("인라인 인증 필드 없음 — `hmacSecret` 인라인 행은 두지 않는다"), §3 API 표 하단 각주("과거 v1.1 예약 행 `POST /api/triggers/:id/auth/rotate-secret` 은 신설되지 않은 채 본 PR 에서 폐기됐다 (Rationale R-14)")가 이 R-2 의 전제를 명시적으로 뒤집었다. R-2 자체에는 취소선·정정 콜아웃이 없어, R-2 만 읽으면 아직 유효한 v1/v1.1 계획인 것으로 오독된다.
- 제안: R-2 본문에 취소선 처리 + "정정: authConfigId 단일 경로로 대체됨 — R-14 참조" 콜아웃을 추가해 이 저장소의 기존 정정 표기 관행과 맞춘다.

### INFO — Rationale 번호 R-9~R-11 결번
- target 위치: `spec/2-navigation/2-trigger-list.md` Rationale 섹션 (R-8 다음 R-12로 이동, R-7 이 R-8 뒤에 위치)
- 위반 규약: 없음(번호 연속성을 강제하는 conventions 문서를 확인하지 못함) — 순수 가독성 제안.
- 상세: R-1~R-8(순서 R-6→R-8→R-7 로 뒤바뀜 포함)까지는 있으나 R-9/R-10/R-11 이 전혀 등장하지 않고 R-12 로 건너뛴다. 과거 항목이 정리되며 생긴 결번으로 보이나, 사유 주석이 없어 다음 편집자가 "빠진 항목이 있는가"를 재조사하게 만들 수 있다.
- 제안: 필요 시 번호를 연속으로 재정렬하거나, 결번 사유를 한 줄 각주로 남긴다. 우선순위 낮음.

## 확인했으나 위반 아님으로 판정한 항목 (참고)

- §3 API 표·PATCH 본문 설명의 에러 코드(`VALIDATION_ERROR`/`RESOURCE_CONFLICT`/`RESOURCE_NOT_FOUND`/`AUTH_CONFIG_NOT_FOUND`, 도메인 접두 `TRIGGER_ENDPOINT_PATH_CONFLICT`)는 `error-codes.md` §1 의 "의미 기반 명명 + 도메인 prefix" 원칙과 `UPPER_SNAKE_CASE` 표기에 부합한다.
- `trigger.chat_channel_bot_token_rotated` / `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked` / `trigger.deleted` / `trigger.updated` 감사 액션명은 `audit-actions.md` §3 레지스트리에 정확히 등재된 값과 일치한다(신규 미등재 액션 없음).
- frontmatter `id`(`trigger-list`/`schedule`) 는 `spec-impl-evidence.md` §2.1 의 "basename 기반, 번호 prefix 생략" 기존 관행과 일치한다(저장소 전역에 이미 정착된 패턴).
- 페이지네이션 응답 형식·`ApiOkPaginatedResponse` single-wrap 참조(§3 각 목록 API 설명)는 `swagger.md` §5-2/§Rationale, `api-convention §5.2` 인용과 정합적이다.
- Bot Token(`•••• <last4>`) vs AuthConfig 시크릿(`***<last4>`) 마스킹 표기가 문서 내에서 다르지만, 각각 서로 다른 SoT(Chat Channel §5.4.2 vs 데이터 모델 §2.17.2)를 인용하며 `egress-masking.md` 자체가 `AuthConfig.config` 마스킹을 명시적으로 비대상 처리한다 — 단일 마스킹 문자를 강제하는 정식 규약을 찾지 못해 위반으로 판정하지 않았다.

## 요약

확보된 범위(`2-trigger-list.md`, `3-schedule.md` 전문 + 관련 conventions 전문)에서 명명·에러코드·감사액션·API 응답 포맷 규약은 대체로 잘 준수되고 있다. 다만 `2-trigger-list.md` 는 자신이 명시한 미구현 API 동작(sort/order)에도 불구하고 `status: implemented` 를 자칭해 `spec-impl-evidence.md` 의 상태 라이프사이클 정의와 어긋나며, 자매 문서 `3-schedule.md` 가 동일 상황을 `pending_plans:` 로 정상 처리한 선례가 있어 대조가 뚜렷하다. 또한 R-2 Rationale 이 이후 결정(R-14)에 의해 뒤집혔음에도 정정 표시가 없어 문서 내부 정합성이 약하다. 코드 diff(20파일/2584줄) 와 나머지 15개 spec 파일은 컨텍스트 예산 절단으로 이번 라운드에서 직접 검토하지 못했으므로, 그 파일들에 대한 "위반 없음" 결론으로 읽어서는 안 된다.

## 위험도

LOW
