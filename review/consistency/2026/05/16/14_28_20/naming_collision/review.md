# 신규 식별자 충돌 검토 — `spec/2-navigation/4-integration.md`

> 검토 모드: `--impl-prep` (구현 착수 전)
> 검토 범위: `cafe24-mall-dup-ux` plan 이 도입하는 신규 식별자

---

## 검토 전제

target 문서(`spec/2-navigation/4-integration.md`) 는 이 worktree 에서 아직 수정되지 않았다 (prompt 의 "구현 대상 영역: (없음)"). 그러나 `plan/in-progress/cafe24-mall-dup-ux.md` 와 `plan/in-progress/spec-update-cafe24-public-dup-guard.md` 에 명시된 구현 의도가 도입할 식별자들을 대상으로 분석한다. 해당 plan 들이 작성된 현 worktree 가 충돌 검토 범위다.

---

## 발견사항

### 발견 1

- **[WARNING]** `GET /api/integrations/cafe24/precheck` — 기존 `@Get(':id')` 라우트와의 정적/동적 경로 충돌 위험

  - **target 신규 식별자**: `GET /api/integrations/cafe24/precheck` (`spec-update-cafe24-public-dup-guard.md` §9.2 신규 행)
  - **기존 사용처**: `backend/src/modules/integrations/integrations.controller.ts:209` — `@Get(':id')` (`ParseUUIDPipe` 적용). 현재 정적 경로는 `GET /api/integrations` (목록), `GET /api/integrations/services` 두 가지 뿐이며, 이 두 라우트는 `:id` 보다 먼저 선언되어 있다.
  - **상세**: NestJS 는 컨트롤러 내 라우트를 선언 순서대로 매칭한다. 새 `GET /api/integrations/cafe24/precheck` 를 `@Get(':id')` 보다 위에 선언하지 않으면 `cafe24` 가 `:id` 파라미터로 소비되어 `ParseUUIDPipe` 에서 400 오류가 발생한다. 또한 path segment 가 2개 (`cafe24/precheck`) 이므로 단순 `@Get('cafe24')` 와도 다르다 — 이 경우 `precheck` 가 `@Get(':id/usages')` 또는 `@Get(':id/activity')` 의 `:id=cafe24`, `segment=precheck` 로 해석될 수도 있다. 즉 `@Get('cafe24/precheck')` 를 `@Get(':id/usages')` 와 `@Get(':id/activity')` 보다 앞에 선언해야만 정적 경로가 올바르게 매칭된다.
  - **제안**: 컨트롤러에 `@Get('cafe24/precheck')` 핸들러를 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 보다 앞 위치에 선언한다 (현재 `@Get('services')` 바로 아래가 적합). `ParseUUIDPipe` 는 이 라우트에 적용하지 않는다. 라우트 선언 순서 결정은 구현 착수 시 필수 확인 사항이다.

---

### 발견 2

- **[WARNING]** `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` — Public 흐름에도 동일 에러 코드를 사용하여 이름과 의미가 불일치

  - **target 신규 식별자**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 Public (`app_type='public'`) 흐름에도 반환하도록 의미 확장 (`cafe24-mall-dup-ux.md` §Backend (1), `spec-update-cafe24-public-dup-guard.md` §9.2 보강)
  - **기존 사용처**:
    - `spec/2-navigation/4-integration.md:684` — "Cafe24 Private 흐름 진입 시" 로 기술. 코드 이름에 `PRIVATE` 이 포함.
    - `spec/2-navigation/4-integration.md:713` — 에러 코드 설명에 "Private" 을 명시.
    - `backend/src/modules/integrations/integration-oauth.service.ts:1068` — Private begin 분기에서만 throw.
    - `backend/src/modules/integrations/integrations.controller.ts:170` — Swagger doc 에 "connected 통합이 이미 존재" 와 함께 "private" 맥락으로 기술.
  - **상세**: 코드 이름 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 에 `PRIVATE` 이 포함되어 있어, Public 흐름에서도 동일 코드를 반환하면 API 클라이언트(프론트엔드, 외부 통합)가 코드 이름만 보고 "Private 전용 오류"로 오인할 수 있다. 현재 프론트엔드에서 이 코드를 기반으로 분기 로직을 작성하면 `PRIVATE` 이름 때문에 Public 경로의 409 처리를 누락할 가능성이 높다. `spec-update-cafe24-public-dup-guard.md` 에서도 기존 코드 이름을 그대로 재사용하는 방향으로 기술되어 있어 혼동이 구체적으로 발생한다.
  - **제안 (두 가지 중 선택)**:
    - (a) **코드 이름 일반화**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` → `CAFE24_MALL_ALREADY_CONNECTED` 로 rename. `PRIVATE` 한정 의미를 제거하면 Public/Private 양쪽에 자연스럽게 적용 가능하다. backend, spec, Swagger doc, 프론트엔드 toast/banner 메시지 키 모두 함께 변경.
    - (b) **별도 코드 신설**: `CAFE24_MALL_ALREADY_CONNECTED` (app_type 무관) 를 신설하고, 기존 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 는 Private 전용으로 유지. Public begin 가드에는 새 코드 사용. 단, 두 코드가 동일 HTTP 상태(409)와 유사 의미를 갖게 되어 장기적으로 혼란이 가중된다 — 옵션 (a) 가 권장.

---

### 발견 3

- **[INFO]** `findExistingConnectedCafe24Mall` helper — 기존 네이밍 컨벤션과의 일관성 확인 권장

  - **target 신규 식별자**: `findExistingConnectedCafe24Mall(workspaceId, mallId)` (`cafe24-mall-dup-ux.md` §Backend (1) — private/public 공유 helper)
  - **기존 사용처**: `backend/src/modules/integrations/integration-oauth.service.ts` 의 기존 private method 들 (`_buildCafe24AuthUrl`, `_handleCafe24Callback` 등 추정). 정확한 메서드 명칭은 파일 직접 확인 필요.
  - **상세**: helper 이름이 `find...Connected` 로 `status='connected'` row만 조회한다는 의미를 내포하는데, `spec-update-cafe24-public-dup-guard.md` 에 따르면 `pending_install` / `expired` / `error` status 도 V045 backstop 이 다루므로 `connected` 만 감지하는 helper 가 전체 중복 방어의 절반만 담당한다. helper 이름에서 범위가 명확히 드러나도록 정합이 필요하다.
  - **제안**: helper 이름을 `findConnectedCafe24MallIntegration(workspaceId, mallId)` 등 `connected` 상태만 조회한다는 사실을 명확히 드러내도록 유지하되, precheck endpoint 에서는 모든 status 를 반환하기 위해 별도 조회 로직이 필요함을 구현 시 주석으로 명시한다. 또는 `findAnyCafe24MallIntegration(workspaceId, mallId)` 로 범용 helper 를 만들고 caller 가 status 를 필터링하는 방식을 채택한다.

---

## 요약

이번 `cafe24-mall-dup-ux` 구현 착수 전 검토에서 심각한 직접 충돌은 없으나, 두 가지 명명 위험이 발견된다. 첫째, `GET /api/integrations/cafe24/precheck` 는 기존 NestJS 라우터의 동적 경로 `@Get(':id')`, `@Get(':id/usages')`, `@Get(':id/activity')` 와 라우트 우선순위 충돌 위험이 있으며, 핸들러 선언 순서를 잘못 배치하면 런타임에 400 오류나 잘못된 핸들러 호출이 발생한다. 둘째, `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 를 Public 흐름에 재사용하면 코드 이름의 `PRIVATE` 이 의미를 오도하여 프론트엔드 분기 로직의 결함으로 이어질 수 있다. 에러 코드를 `CAFE24_MALL_ALREADY_CONNECTED` 로 일반화하는 리네이밍이 구현 착수 전에 결정되어야 한다.

---

## 위험도

**MEDIUM**
