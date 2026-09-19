# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep)

## 점검 범위와 제약

`spec/2-navigation/`(1-workflow-list.md · 2-trigger-list.md · 3-schedule.md 전문 + 그 외 15개 파일)을 대상으로,
번들 프롬프트에 포함된 `spec/0-overview.md` 전문과 실제 저장소의 `spec/1-data-model.md` · `spec/5-system/1-auth.md` ·
`spec/5-system/2-api-convention.md` · `spec/5-system/12-webhook.md` · `spec/5-system/15-chat-channel.md` ·
`spec/5-system/14-external-interaction-api.md` · `spec/5-system/3-error-handling.md` ·
`spec/4-nodes/7-trigger/providers/_overview.md` 를 `Read`/`grep` 로 직접 대조했다.

**중요한 제약**: 조립된 `_prompts/cross_spec.md` 는 컨텍스트 예산 초과로 `spec/2-navigation/` 의 15개 파일(4-integration ·
5-knowledge-base · 6-config · 8-marketplace · 9-user-profile · _product-overview · 0-dashboard · 7-statistics ·
10-auth-flow · 11-error-empty-states · 13-user-guide · 14-execution-history · 15-system-status · 16-agent-memory ·
_layout)과 "관련 spec 본문" 109개 파일 중 105개(1-data-model.md 포함 대부분)를 플레이스홀더로 절단했다. 이 파일들은
저장소에서 직접 `Read`/`grep` 하여 교차검증했으나, 전수는 아니고 target 문서가 실제로 인용하는 앵커·필드를
표본 추출해 대조했다. 아래 "발견사항 없음" 판정은 **검증한 범위 안에서**의 결론이다.

## 검증한 교차 참조 (일치 확인)

- `spec/1-data-model.md` §2.4 Workflow / §2.5 Folder / §2.8 Trigger / §2.8.1 WebhookEndpointReservation / §2.9 Schedule /
  §2.9.1 동기화 규칙 / §2.17 AuthConfig(type 4값 `api_key`/`bearer_token`/`basic_auth`/`hmac`) / §2.17.2 마스킹 정책 —
  1-workflow-list.md · 2-trigger-list.md · 3-schedule.md 의 필드·제약·cascade 서술과 전부 일치.
- `spec/5-system/1-auth.md` §3.1~3.2 RBAC 매트릭스 — Trigger/Schedule CRUD=Editor+, Auth Config CRUD=Admin+/R=Editor,
  Auth Config Reveal=Admin+ — 2-trigger-list.md §4.1 권한 표·§2.3.1 "+ 새 인증 설정 만들기 Admin+ 한정" 서술과 일치.
- `spec/5-system/2-api-convention.md` §5.2 목록 응답(`data`+`pagination` top-level 형제) · §5.4 부재 표현 (b) 기준
  ("소비자가 부재를 정상 경로로 다룬다") — 2-trigger-list.md `TriggerDto.workflow` 키 생략 근거, 3-schedule.md
  `trigger.workflow` 키 생략 근거와 정확히 부합.
- `spec/5-system/12-webhook.md` WH-EP-02(URL 형식) · WH-SC-01(무인증 공개 옵션) · WH-SC-08/09(last_used_at, ip_whitelist) ·
  WH-MG-09(chatChannelHealth 배지 위치) — target 인용과 앵커·내용 모두 일치.
- `spec/5-system/15-chat-channel.md` §5.4/§5.4.1/§5.4.1.1/§5.4.1.2/§5.4.2, R-CC-10 — 앵커 실재 확인, target 의
  single-path rotate·PATCH 차단 서술과 일치.
- `spec/5-system/14-external-interaction-api.md` §4/§7.1/§7.3 의 `enabled`/`tokenStrategy` 필드 — target §2.3.1
  External Interaction 행과 일치.
- `spec/4-nodes/7-trigger/providers/_overview.md` §1 — telegram/slack/discord 셋 다 `supported (v1)`, target 의
  Chat Channel `provider` enum 서술과 일치.
- 요구사항 ID `NAV-WF-07` / `NAV-IN-07` / `NAV-WC-01~06` — `_product-overview.md` 에 각각 유일하게 정의, target 이
  인용하는 의미와 충돌 없음.

## 발견사항

- **[INFO]** Folder 리소스가 중앙 RBAC 매트릭스에 없음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 (`POST/PATCH/DELETE /api/folders` 를 `editor+` 로 명시)
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스 — Workflow/Trigger/Schedule/Integration/KB 등은
    행이 있으나 **Folder 행이 없다**
  - 상세: 실제 값(editor+)은 인접 리소스(Workflow CRUD=Editor+)와 정합적이라 모순은 아니지만, §3.2 표가 "리소스별
    권한"을 표방하면서 워크플로우 정리 단위인 Folder 를 누락해 그 표만 보고는 Folder 권한을 확인할 수 없다.
  - 제안: 차단 사안은 아니므로 급하지 않음. 다음 auth.md 정비 시 Folder 행(또는 "Workflow 하위 리소스로 취급" 각주)
    추가를 권장.

- **[INFO]** 번들 컨텍스트 절단으로 미검증 잔여 표면
  - target 위치: `spec/2-navigation/4-integration.md`(§5.8/§5.9/§8/§9.2 다수 피인용) · `6-config.md`(§3 API·§권한) ·
    `_layout.md`(오삭제 확인 다이얼로그 패턴 향후 승격처로 지목됨) 등 15개 파일
  - 충돌 대상: 위 파일들과 그것들이 참조하는 `data-flow/10-triggers.md` · `data-flow/11-workflow.md` ·
    `conventions/chat-channel-adapter.md` · `conventions/secret-store.md` 등
  - 상세: 표본 검증(§자세 위)에서는 불일치가 나오지 않았으나, 이 파일들 전체를 대조하지 못했으므로 여기 없다는
    사실을 "충돌 없음"의 확정 근거로 쓰지 않는다.
  - 제안: 위 15개 파일이 실제로 수정 대상에 포함되는 후속 라운드에서는 `--spec` 예산을 늘리거나 타겟 파일만
    별도로 `Read` 하여 재검증할 것.

## 요약

`spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md`(번들에서 전문이 제공된 3개 파일)는
데이터 모델(§2.4/2.5/2.8/2.8.1/2.9/2.9.1/2.17), RBAC 매트릭스(§3.1/3.2), API 응답 규약(§5.2/5.4), Webhook/Chat
Channel/EIA 세부 spec, 요구사항 ID 카탈로그와 표본 대조한 범위 내에서 **직접적 모순을 발견하지 못했다** — 오히려
각 문서가 자체 Rationale 절(R-1~R-17, S3/Flyway 등)에서 잠재 충돌 지점을 이미 명시적으로 해소해 둔 상태다. 다만
조립 프롬프트가 `spec/2-navigation/` 15개 파일과 관련 spec 109개 중 105개를 컨텍스트 예산 초과로 플레이스홀더
처리했기 때문에, 이번 검토는 target 문서가 인용하는 핵심 앵커의 표본 검증이며 전수 대조가 아니다. Folder RBAC
누락은 차단 사유가 아닌 문서 완결성 개선 항목이다.

## 위험도

LOW
