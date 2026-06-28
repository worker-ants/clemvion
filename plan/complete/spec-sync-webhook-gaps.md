---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
spec_impact:
  - spec/5-system/12-webhook.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/2-api-convention.md
  - spec/4-nodes/7-trigger/1-manual-trigger.md
---

# webhook — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). 본 spec 을 `partial` 로 강등하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/12-webhook.md

## 미구현 항목
- [x] **비활성 chatChannel 트리거의 202+{ignored:true} 분기 (WH-EP-07 / §3.1 / §7 step 5)** — **이미 구현 확인됨** (2026-06-12, `spec-sync-chat-channel-gaps.md §5.5` 에서 동시 해소). `HooksService.handle` 의 `config.chatChannel` 분기가 `!trigger.isActive` 410 검사보다 먼저 실행되고, `handleChatChannelWebhook` 이 `verify()` 후 `!isActive` 시 `{ executionId: 'ignored' }` (202) 로 단락. spec §5.5 표 + R-CC-12 (d) 가 구현 일치로 기술. (plan 기재 "현재 410 Gone" 이 stale 이었음.)
- [x] **400 검증 실패 필드 목록 surface (WH-EP-05-2 / §5.2)** — **구현 완료 (2026-06-28)**. `toTriggerParameterErrorDetails`(`execution-engine/types/trigger-parameter.types.ts`)가 내부 reason 을 `error.details[]` 의 UPPER_SNAKE field code(`MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`/`INVALID_SCHEMA`)로 정규화. `hooks.service`(webhook `INVALID_WEBHOOK_PAYLOAD`)·`workflows.controller`(manual `INVALID_TRIGGER_PARAMETERS`) 두 경로 모두 `errors`→`details` 로 throw → `GlobalExceptionFilter` 가 봉투로 전달. spec §5.2·§1.7·manual-trigger §6 모두 implemented 로 반영. unit(resolve-trigger-parameters.spec·hooks.service.spec) + e2e(webhook-trigger B3) 추가. (배경 — 원래 상태:) spec §5.2 목표는 공식 봉투의 `error.details[]` 로 필드별 사유를 노출하나, 구 `hooks.service` 는 `BadRequestException({ code: 'INVALID_WEBHOOK_PAYLOAD', message, errors: [{ field, reason }] })`(`hooks.service.ts:164`)를 throw 하고 `GlobalExceptionFilter`(`http-exception.filter.ts`)가 봉투의 `details` 키만 전달해 `errors` 를 버린다 → 클라이언트는 `{ error: { code: 'INVALID_WEBHOOK_PAYLOAD', message, requestId } }` 만 받는다(필드 목록 없음). **목표 달성**: `hooks.service` 가 `errors` 대신 `details: [{ field, code, message }]`(field `code` = `MISSING_REQUIRED_FIELD`/`TYPE_COERCION_FAILED`, `UPPER_SNAKE_CASE`)를 throw 하도록 변경하면 필터가 그대로 `error.details[]` 로 전달한다. 최상위 `code` 는 `INVALID_WEBHOOK_PAYLOAD` 유지(breaking rename 회피, error-codes §2). 동일 갭이 `workflows.controller` 의 `INVALID_TRIGGER_PARAMETERS` 경로(manual-trigger §6)에도 존재 — 통합 처리 가능. reason→field-code 매핑: `missing_required`→`MISSING_REQUIRED_FIELD`, `coerce_failed`→`TYPE_COERCION_FAILED`(+ `invalid_schema` 는 저장 시점 검증이라 webhook 런타임 경로 미발생). e2e: 400 응답 body 가 `error.details[]` 포함하고 field code 가 UPPER_SNAKE 임을 단정.
- [x] **본문 크기 분리 임계 — 인증 webhook 1MB 게이트 (WH-NF-02 / §8)** — **구현 완료 (2026-06-28, 옵션 C)**. `main.ts` 가 `NestFactory.create(AppModule, { bodyParser: false })` 로 Nest 기본 파서를 끄고 `createHooksBodyParsers`(1MB, `HOOKS_MAX_BODY_BYTES` env)·`createGlobalBodyParsers`(100KB)를 직접 등록(`src/bootstrap/hooks-body-parser.ts`). hooks 를 먼저 등록 → hooks 만 1MB 로 파싱(`req._body` 가드로 전역 재파싱 skip), rawBody 보존(HMAC 호환). **함정 회피**: Nest 기본 파서를 켠 채 수동 `app.use(json())` 만 추가하면 Nest 가 자기 전역 파서 등록을 skip 해 non-hooks 본문 미파싱(register 500) → 전역도 명시 등록. 초과 시 body-parser 413 → `GlobalExceptionFilter` 에 `413 → PAYLOAD_TOO_LARGE` 매핑 추가(표준 봉투). **부수 발견(보안)**: e2e L(공개 64KB) 작성 중 `PublicWebhookThrottleGuard` 의 `findOne({ select: { authConfigId: true } })` partial projection 이 authConfigId 를 비-null 로 잘못 반환 → 모든 공개 webhook 이 인증으로 오판돼 32KB·IP rate-limit 보호가 전량 우회되던 pre-existing 버그를 발견·수정(full entity 로드). 회귀 가드는 e2e L. **잔여 기술부채(ai-review W1, 후속 plan 추적)**: `PublicWebhookThrottleGuard` SRP 경계(trigger 조회·body 크기·IP rate-limit 혼재)·`extractClientIp` 의 `auth/utils/client-ip` 이동 — 단기 허용, 중기 리팩토링 항목. 전역 100KB 기본은 non-webhook 라우트에 보존(라우트 스코프 분리). 공개 32KB 는 `PublicWebhookThrottleGuard` 가 그 위에서 유지. spec(WH-NF-02·§3.1·§6·§8)·api-convention(§5.3·§6 413 행)·error-handling(§1.3 `PAYLOAD_TOO_LARGE`) implemented 반영. 테스트: unit(hooks-body-parser.spec·http-exception.filter.spec) + e2e(webhook-trigger J 512KB HMAC 202 / K >1MB 413 PAYLOAD_TOO_LARGE / L 공개 64KB 413 PUBLIC_WEBHOOK_BODY_TOO_LARGE).

## 비고
- 각 항목의 근거(claim→코드부재)는 audit findings/5-system/5-system__12-webhook.md 참조.
- 항목 1 은 기존 `plan/in-progress/auth-config-webhook-followups.md §2` 에서도 동일 갭이 식별됨 (chat-channel 도메인 재검토 항목). 구현 시 통합 처리 가능.

## 결정 옵션 (2026-06-13)

> 대상: 미해결 항목 **WH-NF-02 / §8 — 본문 크기 임계**. 본 섹션은 결정 보조용 분석이다.
>
> **✅ 결정됨 (2026-06-28): 옵션 C** (공개 32KB 유지 / 인증 webhook 1MB). 아래 권장안대로 확정. spec 반영 완료, 구현은 위 체크박스 항목으로 추적.

### 맥락

- **spec 약속**: `spec/5-system/12-webhook.md` §3.1 표("요청 본문 최대 크기 | 1MB", 182행), WH-NF-02(106행), §8 보안 고려사항(370행)이 모두 "요청 본문 최대 1MB 초과 시 413" 통일 임계를 의도한다 (다만 WH-NF-02·§8 본문은 이미 현행을 "Planned" 로 솔직하게 기술 중 — §3.1 표만 순수 "1MB" 약속으로 남아 stale).
- **코드 현실**: 본문 크기 게이트는 공개 webhook(`auth_config_id IS NULL`)에만 존재한다 — `PublicWebhookThrottleGuard` 의 `DEFAULT_MAX_BODY_BYTES = 32 * 1024`(32KB, `public-webhook-throttle.guard.ts:38`)가 초과 시 `413 PUBLIC_WEBHOOK_BODY_TOO_LARGE`(같은 파일 92–98행). 인증 webhook(`authConfigId !== null`)은 같은 Guard 의 88행에서 **무제한 통과**한다.
- **전역 한계 부재**: `main.ts` 는 `NestFactory.create(AppModule, { rawBody: true })`(146행) + `cookieParser()`(162행)만 등록할 뿐 body-parser limit 을 명시하지 않는다 → express 기본값(json/urlencoded **100KB**)이 인증·비-webhook 모든 라우트에 적용된다. 즉 어떤 경로로도 1MB 413 은 실현되지 않으며, 인증 webhook 은 100KB 초과 시 413 이 아니라 express 가 던지는 `PayloadTooLargeError`(표준화되지 않은 에러)로 끊긴다.

### 옵션 A — 전역 body-parser limit 1MB 도입 + authed/public 일관 413 (spec 유지)

`main.ts` 에 body-parser limit 을 1MB 로 명시하고, 인증 webhook 경로에도 동일 413 게이트를 둬 spec §3.1 의 "1MB" 약속을 그대로 구현한다.

- **장점**
  - spec 본문(§3.1 표) 을 손대지 않고 약속을 충족 — 문서-구현 정합.
  - 모든 webhook 진입점에서 413 표준 에러 형식(`{ error: { code, message } }`)이 일관 — 클라이언트가 본문 크기 초과를 공개/인증 무관 동일하게 핸들링.
  - 32KB → 1MB 로 공개 webhook 페이로드 한도도 완화 (큰 GitHub/Stripe 이벤트 수용).
- **단점**
  - 전역 `app.use(json({ limit }))` 는 **non-webhook 라우트 전체에 영향** — 현재 express 기본 100KB 가 의도된 방어선인 다른 API 에 1MB 를 열어주는 부작용. 라우트별(`/api/hooks/*` 한정) limit 분리가 필요해져 구현 복잡도 상승.
  - 공개 webhook 32KB → 1MB 상향은 DoS 표면 32배 확대 (아래 위협모델 참조). 공개 한도를 1MB 로 올리는 것이 본 결정의 의도가 아니라면 옵션 C 가 더 정합.
  - Guard 의 413 과 express body-parser 의 413 이 **두 레이어로 공존** — 어느 쪽이 먼저 끊는지(파싱 전 raw vs 파싱) 순서 정의·테스트 필요.

### 옵션 B — spec 을 현행 32KB(public) + express 기본(authed)에 맞춰 재정의

§3.1 표의 "1MB" 를 삭제/수정해, 공개 webhook 32KB + 인증 webhook express 기본(100KB) 의 현행 동작을 정본으로 확정한다 (WH-NF-02·§8 은 이미 이 방향으로 서술됨 — §3.1 표만 정합화).

- **장점**
  - 코드 변경 0 — `project-planner` spec write 한 번으로 종결, 회귀 위험 없음.
  - 공개 webhook 의 보수적 32KB 한도(DoS 방어선)를 그대로 유지.
  - 이미 WH-NF-02·§8 본문이 현행을 "Planned" 로 솔직 기술 중이므로, §3.1 표만 맞추면 문서 전체가 단일 진실로 수렴.
- **단점**
  - 인증 webhook 의 "100KB express 기본" 은 **명시적 설계 결정이 아니라 우연한 프레임워크 기본값** — spec 이 이를 정본화하면 "의도된 한도"로 굳어지나 표준 413 형식이 아닌 raw express 에러로 끊기는 비일관이 남는다.
  - chat/webhook 페이로드 현실성: 첨부·임베드·대화 히스토리를 담은 inbound 가 32KB(공개) 또는 100KB(인증)를 넘길 수 있어, 정당한 트래픽이 거부될 여지를 "현행 유지" 로 박제.

### 옵션 C — 분리 임계: public 32KB 유지 + authed 1MB 명시 (실제 위협모델 반영)

공개 webhook 은 32KB(Guard 현행 유지), 인증 webhook 은 `/api/hooks/*` 스코프 한정 1MB body-parser limit + 413 게이트를 명시한다. spec §3.1 표를 "공개 32KB / 인증 1MB" 분리 임계로 재정의.

- **장점**
  - **위협모델 정합** — 미인증 공개 진입점은 brute-force·DoS 표면이므로 보수적 32KB 유지, 신원이 검증된 인증 webhook 은 큰 정당 페이로드(대형 PR/결제 이벤트)를 1MB 까지 허용. 한도를 위험도에 비례시킴.
  - 전역이 아닌 `/api/hooks/*` 라우트 스코프 limit 이라 **non-webhook 라우트 100KB 방어선은 보존** (옵션 A 의 부작용 회피).
  - 413 표준 형식을 인증 webhook 에도 적용해 일관성 확보 가능.
- **단점**
  - "본문 최대 크기"가 단일 값이 아닌 인증 여부 분기로 바뀌어 spec·문서·클라이언트 안내가 복잡해짐 (413 메시지에 한도 값 노출 시 공개/인증 차이 드러남).
  - 라우트 스코프 body-parser 분리 + Guard 32KB 게이트가 **두 경로로 공존** — 인증 webhook 1MB 게이트와 공개 32KB Guard 의 책임 경계·테스트 매트릭스가 늘어남.
  - 구현 비용은 옵션 A 와 유사(라우트별 limit + 413 표준화)하면서 spec 변경도 동반 — 세 옵션 중 변경 면적 최대.

### 권장안

**옵션 C**. 미인증 공개 진입점(DoS·abuse 표면)은 32KB 보수 한도를 유지하면서, 신원 검증된 인증 webhook 에만 1MB 를 열어 위협도에 비례한 한도를 두는 것이 현실적 페이로드 수용과 DoS 방어를 동시에 만족한다. spec 의 단일 "1MB" 의도(옵션 A)는 공개 표면까지 32배 확대해 방어선을 약화하고, 현행 박제(옵션 B)는 인증 webhook 의 정당한 대형 페이로드를 우연한 100KB 기본값으로 막는다.

### 트레이드오프

- **비용**: 옵션 B 는 spec write 1회(`project-planner` + `consistency-check --spec`)로 최저. 옵션 A·C 는 코드 경로 — `developer` 가 `/api/hooks/*` **라우트 스코프** body-parser limit 을 설정해야 한다(전역 `app.use(json({ limit }))` 는 non-webhook 라우트 100KB 방어선을 무너뜨리므로 금지 → per-route 또는 path-scoped middleware 필요).
- **Downstream (spec)**: §3.1 표(182행)·WH-NF-02(106행)·§8(370행)·§6 Guard 설명(314·320행)이 한 값으로 정합돼야 하며, `PublicWebhookQuotaService` 주석(`public-webhook-quota.service.ts:26`)의 32KB 기술도 동기화 대상. consistency-check 로 cross-spec(14-EIA·15-chat-channel 의 inbound 크기 가정) 충돌 확인.
- **Downstream (code, 옵션 A·C)**: 인증 webhook 413 게이트와 공개 Guard 32KB(`public-webhook-throttle.guard.ts:92`) 의 **레이어 순서**(raw 파싱 전 vs 후) 정의 필요. 413 응답이 Guard 의 표준 `{ error: { code, message } }` 형식과 일치하도록 인증 경로 게이트도 동일 형식으로 던질 것.
- **e2e**: 인증 webhook 1MB 경계(< 1MB 통과 / > 1MB 413), 공개 webhook 32KB 경계(옵션 C 유지), non-webhook 라우트가 1MB 영향 받지 않음(100KB 유지) — 3종 경계 회귀 테스트 추가. 413 응답 body 형식 단정 포함.
