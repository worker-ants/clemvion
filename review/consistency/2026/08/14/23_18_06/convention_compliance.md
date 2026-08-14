# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md` (EIA)

## 검토 범위

- target: `spec/5-system/14-external-interaction-api.md` (bundle 에 전문 포함, ~1516줄) + 인접 번들 `spec/5-system/2-api-convention.md` (전문 포함)
- 대조: `spec/conventions/**` 중 target 이 명시 참조하는 문서를 절대경로로 직접 Read — `swagger.md`, `redis-keys.md`, `secret-store.md`, `error-codes.md`, `conversation-thread.md`(§1~§4, §8.4 발췌), `interaction-type-registry.md`, `audit-actions.md`, `migrations.md`, `node-output.md`(§3.2/§4.5) — prompt 번들에는 이 271개 conventions 파일이 전부 예산 초과로 생략되어 있었기 때문에 직접 열어 대조했다.
- 코드 대조는 필요한 1건(`external-interaction/dto/responses/` 디렉터리 실재 파일 목록)만 절대경로로 확인.

## 발견사항

- **[INFO]** `api-convention.md §6` HTTP 상태 코드 표에 `410 Gone` 누락 — target 의 광범위한 사용과 불일치
  - target 위치: EIA §5.1 에러 표 (`410 Gone | EXECUTION_TERMINATED`), §5.5 토큰 갱신 응답, EIA-IN-12
  - 위반 규약: `spec/5-system/2-api-convention.md §6` (target 자신이 "HTTP 상태 코드 선택의 SoT"로 여러 번 cross-ref 하는 표) — 단 이 파일은 `spec/conventions/**` 가 아니라 `spec/5-system/` 소속이라 엄밀히는 이 리뷰의 1차 스코프(spec/conventions) 밖이다.
  - 상세: `2-api-convention.md §6` 표에는 200/201/204/400/401/403/404/409/413/422/429/500/503 만 열거되고 `410` 이 없다. 그러나 같은 파일 §11.3("비활성 410 Gone")과 `12-webhook.md`, 그리고 target 문서(EIA)가 `410`을 반복적으로 1급 상태 코드로 쓴다. target 의 사용 자체는 기존 선례(webhook)를 재사용하는 것이라 target 의 신규 위반은 아니지만, target 이 의존하는 "canonical 상태 코드 표"가 자신이 매우 많이 쓰는 코드를 빠뜨리고 있어 대조 문서 쪽의 완결성 갭이 target 의 규약 준수 여부를 판단하기 어렵게 만든다.
  - 제안: target 을 고칠 필요는 없음. `2-api-convention.md §6` 표에 `410 | Gone | 리소스가 더 이상 유효하지 않음(webhook 비활성 트리거, EIA 종료된 execution/토큰)` 행을 추가해 표를 실사용과 동기화할 것을 제안(규약 문서 갱신 필요 항목).

- **[INFO]** 본문 곳곳에 "정정(correction)" 서술이 `## Rationale` 밖 인라인 blockquote 로 산재
  - target 위치: 예) §5.1 "`STATE_MISMATCH` 강제 정합 (2026-07)" 콜아웃, §5.2 "`id:` 생략" 뒤 "2026-07-17 정정" 콜아웃, §5.4 cancel ack shape 정정, §5.5 refresh-token 상태코드 정정, §6.2 turnDebug 누출 정정 등 10여 곳
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (권장 사항)
  - 상세: 이 문서는 결정 배경·이력 정정을 본문 각 섹션에 날짜 스탬프와 함께 인라인으로 남기는 패턴을 광범위하게 쓴다. CLAUDE.md 표는 "배경·근거"의 정본 위치를 `## Rationale` 로 명시한다. 다만 이 패턴은 이 spec 파일에 국한되지 않고 `conversation-thread.md`, `15-chat-channel.md` 등 인접 `5-system` 문서에서도 동일하게 반복되는 저장소 전역 관행으로 보이며, CLAUDE.md 문구도 "권장"이지 강제형이 아니다. 또한 각 콜아웃이 "그 문장 바로 다음에" 와야 재발을 막는 실익(오독 방지)이 있어, Rationale 로 몰아넣으면 본문에서 잘못된 옛 서술만 남고 정정 맥락이 멀어지는 trade-off 도 있다.
  - 제안: target 단독 수정을 요구하지 않음 — 이 저장소가 이미 이 패턴을 표준처럼 쓰고 있다면 CLAUDE.md 문구를 "단문 정정은 본문 인라인 허용, 설계 대안 비교/기각 근거는 Rationale" 정도로 명확화하는 편이 실제 관행과의 괴리를 줄인다(규약 문서 쪽 정정이 더 적절할 수 있음).

## 개별 검증 결과 (위반 없음 — 강한 정합성 확인)

아래는 명시적으로 대조해 **일치**를 확인한 항목들(발견사항이 아니라 검증 로그로 남긴다):

- **명명 규약**: URL 케밥 케이스(`/refresh-token`, `notification/rotate-secret`, `interaction/revoke-token`), RPC-style sub-channel 예외(`api-convention §2.2`)와 정합. Redis 키(`eia:rl:interact:<executionId>` 등)가 `conventions/redis-keys.md §3` 인벤토리와 문자열 단위로 일치. Secret ref (`secret://triggers/{id}/notification-signing[.v2]`)가 `conventions/secret-store.md §1` 스킴과 일치. 감사 액션(`trigger.notification_secret_rotated`, `trigger.interaction_token_revoked`)이 `conventions/audit-actions.md §3` 레지스트리에 동일 문자열로 등재됨(2026-08-11, 과거분사 §2.1).
- **출력 포맷 규약**: `{ data: ... }` 봉투, `null` vs 키 생략 선택 기준(§5.4)이 `api-convention.md §5.1/§5.4`, 그 Rationale과 상호 정합(오히려 target 사례가 그 규약의 근거 사례로 인용됨 — 순환 cross-ref 확인). 에러 코드 UPPER_SNAKE_CASE(`node-output.md §3.2`, `error-codes.md §1`) 전부 준수. `EXECUTION_TIMEOUT` 동명 코드의 레이어 분리 서술이 `error-codes.md §4` 의 명시적 caveat 와 1:1 대응.
- **문서 구조 규약**: `## Overview (제품 정의)` → 본문(§1~§12) → `## Rationale` 3섹션 구성 준수. frontmatter(`id`/`status`/`pending_plans`/`code:`) 형식 준수. 파일명 `14-external-interaction-api.md` 는 `spec/5-system/` 순번 규칙(13 다음)과 R9 Rationale 로 명시적 정당화.
- **API 문서 규약**: `interaction-token` Bearer scheme, `@ApiSecurity({})` 대신 설명 문구, `dto/responses/*-response.dto.ts` 배치, `oneOf`(discriminator 미사용 — 판별자 unsound 사례로 `swagger.md §1-4` Rationale 에 정확히 부합)까지 `conventions/swagger.md` 전 항목과 정합. 실제 코드에도 `execution-status.literal.ts` 가 존재해 §5-1 "형제 DTO 공유 enum → `*.literal.ts`" 규칙을 이행 중임을 확인(target 의 §10 파일 목록은 `...` 로 축약해 이 파일을 명시하지 않지만 누락이 아니라 생략 표기).
- **금지 항목**: `additionalProperties` 남용(§1-4), 빈 껍데기 스키마(§6), pagination double-wrap 버그 패턴 등 conventions 의 명시적 금지 패턴이 target 에 재현되지 않음.

## 요약

target(`14-external-interaction-api.md`)은 `spec/conventions/**`(swagger·redis-keys·secret-store·error-codes·conversation-thread·interaction-type-registry·audit-actions·node-output)의 명명·출력 포맷·API 문서 규약을 이례적으로 촘촘하게 준수하고 있으며, 다수의 규약 문서 자체가 이 target 의 사례를 근거/선례로 역참조할 만큼 co-evolve 되어 있다(예: `swagger.md`의 discriminator soundness 규칙, `conversation-thread.md §8.4`의 egress 마스킹 서술, `redis-keys.md §3` 인벤토리, `audit-actions.md §3` 신규 액션 3종). CRITICAL 급 위반은 발견되지 않았다. 유일하게 짚을 만한 것은 (1) target 이 크게 의존하는 `api-convention.md §6` HTTP 상태 코드 표에 이미 실사용 중인 `410 Gone`이 빠져 있는 완결성 갭(엄밀히는 spec/conventions 범위 밖의 인접 문서 문제)과, (2) 본문에 산재한 날짜 스탬프 정정 blockquote 가 CLAUDE.md 의 "배경·근거는 Rationale" 권장과 형식적 긴장이 있다는 점인데, 후자는 이 저장소 전역 관행이라 target 고유의 이탈로 보기 어렵다.

## 위험도

LOW
