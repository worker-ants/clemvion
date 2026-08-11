# Rationale 연속성 검토 — trigger 시크릿/토큰 회전 3종 감사 대상 추가 (착수 전 게이트)

## 판정 요약 (선결론)

**"고빈도 액션은 보존 정책 확정 전까지 유예" 원칙이 회전 액션에는 적용되지 않는다는 구분은 기존
Rationale 과 정합한다. 과거에 이 결정(회전 액션 감사 추가)이 기각된 이력은 발견되지 않았다.**
오히려 저빈도 회전 액션(`integration.rotated`, `auth_config.regenerate`)은 이미 2026-06-10 이전부터
구현·감사되어 왔고, `conventions/audit-actions.md §3` 의 원문이 명시하는 유예 사유는 "감사 액션
신설 자체의 유예"가 아니라 **"고빈도(카디널리티) 액션 + 무제한 테이블"의 조합**에 한정된다.

근거 원문 (`spec/conventions/audit-actions.md` L61):

> `workflow.executed` 는 의도적으로 미구현이다. 나머지 13개와 카디널리티 차원이 다르다 — **CRUD 는
> 저빈도지만 `executed` 는 트리거·webhook 발동마다 쌓인다.** 그런데 `audit_log` 은 보존 정책이
> 미정이고 pruner 가 없다. 무제한 테이블에 **고빈도 액션**을 넣는 것은 보존 정책 결정과 묶여야
> 하므로 별도 항목으로 분리했다.

이 원칙의 대비축은 "CRUD(저빈도) vs. `executed`(호출마다 발생, 고빈도)" 이지 "일반 액션 vs. 특권
액션"이 아니다. 회전(rotate/regenerate)은 사용자가 명시적으로 트리거하는 **저빈도 수동 행위**이며,
이미 이 축의 "저빈도" 쪽 선례가 두 건 확정 구현돼 있다:

- `integration.rotated` — "credential 회전" (`spec/data-flow/1-audit.md` L50, 구현됨).
- `auth_config.regenerate` — "키/토큰 재발급" (`spec/data-flow/1-audit.md` L64, 구현됨. `auth_config`
  경로로 유입되는 webhook trigger 의 HMAC secret 회전도 이 액션으로 이미 감사된다 —
  `spec/5-system/12-webhook.md` L472-473 "AuthConfig 는 `regenerate` 로 일원화").

또한 2026-08-01 에 `workflow.*`/`trigger.*`/`schedule.*` CRUD 13개 액션이 **감사 로그 보존 정책이
여전히 미정인 상태에서** 구현·병합됐다(`spec/data-flow/1-audit.md` §3 은 지금도 "정책 미정 — 현재
무제한"). 즉 "보존 정책 미확정"이 신규 액션 추가 전체를 막는 블랭킷 유예가 아니라는 것은 이미
실제 구현 이력으로 입증돼 있다 — `workflow.executed` 만 예외적으로 유예됐다.

---

## 발견사항

- **[WARNING]** "3종" 중 하나가 이미 구현·감사된 `auth_config.regenerate` 와 물리적으로 동일 행위일
  위험 — 중복 감사 시 기존 "단일 기록 지점" 원칙 위반
  - target 위치: (target 문서에 아직 구체 초안 없음 — 사용자 프롬프트의 "trigger 시크릿/토큰 회전
    3종" 정의 자체)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-10 (L608-612) 및 §3.4 표(L378)
    "PATCH + rotate 양쪽 허용 시 ... audit log 가 `trigger.updated` 와 `chat-channel.rotate-bot-token`
    으로 mixed" · `spec/conventions/audit-actions.md` §3 각주(L63) "짝 리소스는 호출된 엔드포인트
    쪽만 기록한다 ... 감사는 호출된 엔드포인트의 리소스 기준"
  - 상세: 트리거의 webhook HMAC secret 회전은 `POST /api/auth-configs/:id/regenerate` 로 이미
    `auth_config.regenerate` 감사가 붙어 있다(`spec/5-system/12-webhook.md` L472-473). "3종" 목록에
    이 경로(웹훅 인증 회전)를 다시 `trigger.*` 네임스페이스의 별도 액션으로 신설해 넣으면, 같은
    사용자 행위 1건에 대해 `auth_config.regenerate` + 신규 `trigger.*_rotated` 두 행이 동시에
    남아 위에 인용한 "짝 리소스는 호출된 엔드포인트 쪽만 기록" 원칙과 충돌한다. 반면 EIA
    notification-secret 회전(`POST /api/triggers/:id/notification/rotate-secret`, EIA-NX-12)과
    chat-channel bot-token 회전(`POST /api/triggers/:id/chat-channel/rotate-bot-token`, CCH-SE-04)은
    현재 어떤 감사 액션에도 기록되지 않는 **순수 신규 갭**이다(`spec/data-flow/1-audit.md` L213
    "그 외 도메인은 현재 audit 기록 없음" — writer 8곳에 triggers.service/controller 의 rotate
    엔드포인트 없음).
  - 제안: 착수 시 "3종"을 (a) EIA notification-secret rotate, (b) chat-channel bot-token rotate,
    (c) — 만약 세 번째가 webhook HMAC(authConfigId 경로) 이라면 **신규 액션을 만들지 말고**
    기존 `auth_config.regenerate` 를 그대로 그 회전의 감사 기록으로 간주(문서화만 보강)한다. 세
    번째가 다른 행위(예: EIA interaction 토큰 `revoke-token`/`refresh-token`)라면 문제 없음 — 이
    경우도 신규 액션 대상 후보로 확인.

- **[INFO]** 신규 액션 2건의 명명·레지스트리 반영 지점 체크리스트
  - target 위치: (착수 후 반영될 `spec/5-system/1-auth.md §4.1`, `spec/conventions/audit-actions.md
    §3`, `spec/data-flow/1-audit.md §1.1`)
  - 과거 결정 출처: `spec/conventions/audit-actions.md` §1(L21-27, dot-prefix 필수)·§2.1(L33-35,
    과거분사 기본·합성 과거분사 허용)
  - 상세: `notification/rotate-secret`·`chat-channel/rotate-bot-token` 는 URL 동사가 현재형
    (`rotate`)이지만, 기존 `trigger.created/updated/deleted` 는 모두 과거분사(§2.1)다. 같은
    resource(`trigger`) 안에서 CRUD 생애주기 verb 는 과거분사로 이미 확정돼 있으므로(§2 "같은
    성격의 CRUD 생애주기 verb 끼리는 ... 혼용하지 않는다"), 신규 회전 액션은 `integration.rotated`·
    `integration.scope_changed` 같은 합성 과거분사 패턴(§2.1 "목적어/부사 + 과거분사")을 따르는 것이
    기존 taxonomy 와 가장 정합적이다(예: `trigger.notification_secret_rotated`,
    `trigger.chat_channel_bot_token_rotated`). 단, verb 자체가 도메인 고유 동사(§2.3)로 분류될
    여지도 있어 이는 확정이 아니라 taxonomy 정합성 관점의 권고다.
  - 제안: 등록 시 (1) `conventions/audit-actions.md §3` 레지스트리 테이블에 `trigger` row 갱신,
    (2) `1-auth.md §4.1` "Planned" 또는 "구현" 표에 추가, (3) `data-flow/1-audit.md §1.1` 의
    "8개 위치(5개 service + 3개 controller)" 카운트 및 writer 표를 함께 갱신 — 이 문서는 해당
    개수를 "현재 코드에서 실제로 기록되는 action 의 SoT" 로 명시하고 있어 갱신 누락 시 즉시
    stale 진술이 된다.

- **[INFO]** "회전은 저빈도라 다르다"는 근거를 명시적 Rationale 항목으로 남기는 것을 권고
  - target 위치: `spec/5-system/1-auth.md §4.1` 또는 `spec/conventions/audit-actions.md §3`
  - 과거 결정 출처: `spec/5-system/1-auth.md §Rationale` 의 4.1.A(L843-864, Planned 액션 확정 시
    근거를 §Rationale 에 남기는 기존 관례) 및 `conventions/audit-actions.md §3` 자체의
    `workflow.executed` 유예 각주(L61, 유예 사유를 그 자리에 직접 남겨둔 선례)
  - 상세: 본 게이트가 "고빈도 유예 원칙이 회전에도 적용되는가"를 정확히 되묻는다는 사실 자체가,
    이 구분이 문서에 명시적으로 드러나 있지 않으면 앞으로도 반복해서 재질문될 수 있음을 보여준다.
    현재 `audit-actions.md §3` 은 `workflow.executed` 의 유예 사유(고빈도)만 적어두고 있고, "회전류
    액션은 저빈도라 이 유예 대상이 아니다"라는 대비 진술은 어디에도 명문화돼 있지 않다(암묵적으로
    `integration.rotated`/`auth_config.regenerate` 의 기 구현 사실로만 추론 가능).
  - 제안: 신규 액션을 레지스트리에 추가할 때, `workflow.executed` 각주 옆에 "회전류(rotate/
    regenerate) 액션은 사용자 트리거형 저빈도 행위로 본 유예 대상이 아니다 — `integration.rotated`·
    `auth_config.regenerate` 선례와 동일 축"이라는 한 문장을 함께 남긴다. 이는 결정 번복이 아니라
    기존 결정(§3 카디널리티 축)의 **적용 범위를 명시화**하는 것이므로 새 Rationale 신설보다 기존
    각주 보강으로 충분하다.

---

## 요약

이번 게이트의 핵심 질문 — "회전은 저빈도 특권 작업이라 `workflow.executed` 유예 원칙과 다르다"는
구분이 기존 Rationale 과 정합하는가 — 에 대해 **정합한다**고 판단한다. `conventions/audit-actions.md
§3` 이 명시하는 유예 사유는 액션의 "특권성"이 아니라 "카디널리티(호출 빈도) × 보존 정책 미정" 의
조합이며, 이 축에서 회전 액션은 이미 `integration.rotated`·`auth_config.regenerate` 로 저빈도 쪽에
구현돼 있어 과거 기각 이력이 없을 뿐 아니라 오히려 강한 선례로 뒷받침된다. 2026-08-01 에 보존 정책이
여전히 미정인 상태로 13개 CRUD 액션이 구현된 사실도 "정책 미정이 신규 액션 전체를 막지 않는다"는
해석을 뒷받침한다. 다만 실제 착수 시 두 가지를 유의해야 한다 — (1) "3종" 중 webhook HMAC 회전이
포함된다면 이미 `auth_config.regenerate` 로 감사되고 있어 중복/혼재 위험이 있고(WARNING), (2) 신규
액션 2건(notification-secret·chat-channel bot-token)은 명명 taxonomy·레지스트리·writer 카운트를
함께 갱신해야 하며, 이 구분 근거 자체를 `audit-actions.md §3` 에 한 문장으로 명시해두면 향후 동일
질문의 재발을 막을 수 있다.

## 위험도

LOW
