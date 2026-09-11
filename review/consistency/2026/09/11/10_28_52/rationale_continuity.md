# Rationale 연속성 검토 — spec/5-system/ (impl-prep: `impl-details-code-wiring.md`)

## 조사 방법

`Target 문서` 번들 중 `spec/5-system/{2-api-convention,1-auth,3-error-handling}.md` 는 본문이
포함돼 있었으나 실제 구현 대상과 가장 밀접한 `spec/5-system/15-chat-channel.md` 는 컨텍스트
예산 초과로 절단돼 있어 저장소에서 직접 `Read` 했다. 아울러 이번 턴이 실행하려는
`plan/in-progress/impl-details-code-wiring.md`(4건: A `details[].code` 배선 15곳 · B 인용
정정 · C `botToken` `@MinLength(1)` · D 거부 메시지 공유 상수화)를 대조 대상으로 삼아, 그
작업이 손대는 각 spec 자리의 `## Rationale`·`기각한 대안`·병렬 트래커(`spec-draft-nullable-
notation-followups.md`)를 직접 열어 대조했다.

## 발견사항

- **[INFO]** `details[].code` 배선(A)이 병존하는 미결정 사안(도메인 특화 코드 신설 여부)을 언급하지 않는다
  - target 위치: `plan/in-progress/impl-details-code-wiring.md` §A (`triggers.service.ts` 13곳 +
    `password.util.ts` 2곳에 `code: 'INVALID_FIELD'` 배선)
  - 과거 결정 출처: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    미해결 항목 `[ ] "details 의 도메인 특화 세부 코드를 신설할지 — INVALID_FIELD 하나로는
    사유가 안 갈린다"` (planner + 결정, 2026-09-11 등재) — `triggers.service.ts` 의 세 거부
    사유((a) 내부 필드 외부 입력 금지 (b) PATCH 변경 불가 (c) 최초 설정/provider 불변)가
    generic `INVALID_FIELD` 하나로는 소비자에게 구분되지 않는다는 지적이며, 판정에는
    "소비자가 실제로 이 셋을 갈라 다르게 행동하는가" 에 대한 별도 조사가 필요하다고 명시돼
    있다(카탈로그 등재가 딸려 규약 확정 턴 범위를 넘겼다고 스스로 적음).
  - 상세: 같은 트래커의 바로 위 항목(`[ ] "서비스 가드가 details[].code 를 안 싣는다"`)은
    "남은 것 = 15곳 배선 (developer)" 이라고 못 박아 두 항목을 **명시적으로 분리**해 뒀고, 그
    분리 자체는 합리적이다 — generic 기본값을 먼저 배선하고 도메인 세분화는 별도 결정으로
    미루는 것은 `2-api-convention.md §5.3` 이 이미 규정한 "기본값 `INVALID_FIELD` / 도메인
    특화 사유가 있으면 그 코드를 쓴다" 구조와 어긋나지 않는다. 다만 `impl-details-code-
    wiring.md` 자신은 이 인접 미결정 항목을 전혀 인용하지 않아, 이 PR 이 착지한 뒤 "배선
    완료 = 사유 구분 문제도 닫힘" 으로 잘못 읽힐 위험이 있다(트래커 항목이 이후 다른 세션에
    의해 열릴 때 이 PR 커밋을 "그 항목도 이미 반영됨" 으로 오인할 수 있음).
  - 제안: `impl-details-code-wiring.md` A 섹션 또는 커밋 본문에 "이 배선은 generic
    `INVALID_FIELD` 만 채우며, 3가지 거부 사유를 구분하는 도메인 특화 코드 신설 여부는
    `spec-draft-nullable-notation-followups.md` 의 별도 미결정 항목(2026-09-11 등재)으로
    남아 있다" 한 줄을 cross-reference 로 남긴다. 코드 변경은 필요 없다.

- **[INFO]** `botToken` 형식 검증(regex) 갭은 이번 PR(`@MinLength(1)`)로 닫히지 않고 남는다
  - target 위치: `plan/in-progress/impl-details-code-wiring.md` §C (`ChatChannelConfigDto.botToken`
    에 `@MinLength(1)` 추가)
  - 과거 결정 출처: `spec/2-navigation/2-trigger-list.md` §2.3.1 `Chat Channel | botToken` 행 —
    *"형식 검증 `^\d{6,}:[A-Za-z0-9_-]{30,}$` ([Spec Chat Channel §5.4])"*. 참고로
    `spec/5-system/15-chat-channel.md:200` 의 인접 주석은 이 정규식이 **telegram 전용**
    형식(`\d+:[A-Za-z0-9_-]+`)이고 slack(`xoxb-*`)·discord(Developer Portal 형식)는
    별도임을 밝힌다 — 즉 `2-trigger-list.md` 의 "형식 검증" 서술 자체도 provider 무관인 것처럼
    읽혀 정밀도가 낮다(이번 PR 이 만든 drift 아님, pre-existing).
  - 상세: 실측 — DTO 는 `@IsString() @MaxLength(256)` 뿐이고 이번 PR 이 더하는 것도
    `@MinLength(1)`(빈 문자열 거부)뿐이다. 문서가 "형식 검증" 이라 부르는 regex 제약은 이
    PR 이후에도 여전히 코드에 없다. 이는 `conventions/swagger.md §3 Rationale` 이 이미
    기록해 둔 실패 패턴 — *"문서에 규칙이 적혀 있는데 강제하는 코드가 없으면, 그건 지켜지지
    않는 규칙이 아니라 애초에 규칙이 아니었다는 뜻"* — 과 같은 클래스다. 다만 이번 PR 이
    이 gap 을 **만든** 것이 아니라 손대지 않고 지나가는 것뿐이고, 처방 대상으로 등재된 항목도
    아니라서 이번 PR 의 스코프 확대를 요구하는 것은 아니다.
  - 제안: 차단 사유는 아님. `spec-draft-nullable-notation-followups.md` 후속 목록에
    "`botToken`/`inboundSigningPlaintext` provider 별 형식 정규식 미검증" 한 줄을 등재해
    두면(이미 있는 "`@MinLength(1)` 또는 provider 별 정규식" 처방 문구가 정규식 갈래를
    미집행으로 명시하게 됨) 다음 사람이 "형식 검증" 문서 문구를 신뢰해 이미 강제된다고
    오판하는 것을 막는다.

## 확인했으나 문제 없음(양성 대조)

아래는 이번 PR 이 과거 Rationale 을 위반할 뻔했으나 실제로는 정합적으로 확인된 지점들이다
(발견사항으로 올리지 않지만 검토 과정에서 명시적으로 대조했다):

- **§A 의 대상 제외(진단 payload 6곳)** — `2-api-convention.md §5.3` 의 "field 가 없는 진단
  payload 는 대상이 아니다"(둘을 겹쳐 쓰지 않는다) 원칙을 계획이 정확히 존중한다.
- **§A 의 `rethrowEndpointPathConflict` 무조치** — 이미 도메인 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)
  를 보유한 선례라 재작업 대상에서 제외한 것은 §5.3 표와 일치한다.
- **§C `botToken` `@MinLength(1)`** — `spec-draft-nullable-notation-followups.md` 에 이미
  "developer, 2026-09-11 등재" 로 정확히 이 처방(`@MinLength(1)` 또는 provider 별 정규식)이
  선등재돼 있다. 신규 임의 결정이 아니라 기존 등재 항목의 집행이다.
- **§D 메시지 상수 공유** — R-CC-21 은 "PATCH 를 두 층(파이프/서비스 가드) 중 어느 쪽이
  잡느냐는 **값의 형태**로 갈린다" 고만 규정하고 **문면이 갈라져야 한다**고는 규정하지 않는다.
  따라서 두 층이 동일 문자열을 공유 상수로 참조하는 것은 R-CC-21 이 세운 층 분리 설계를
  건드리지 않는다. 또한 `chat-channel-config.dto.ts` 는 이미 `codebase/backend/src/modules/
  triggers/dto/` 하위라, `#676`(`e827ed2a7`)이 끊은 `chat-channel → triggers` 역방향
  의존(`forwardRef` 순환)을 되살리지 않는다 — 계획 문서가 스스로 이 역사를 인용해 항목 E
  (모듈 경계 추출)를 후속 PR 로 가른 판단도 `15-chat-channel.md §7` 구현 파일 구조의
  "C-2: rotateBotToken 엔드포인트 이전(forwardRef 순환 해소)" 서술과 부합한다.
- **§C/§D 가 `SecretResolver.rotate` 의 빈 값 가드를 건드리지 않음** — R-CC-21 의 「기각한
  대안」이 정확히 이 가드를 "증상을 가리고 원인을 남긴다" 며 기각하고 "다른 호출부를 위해
  **별도로** 검토한다" 고 명시했다. 이번 계획이 그 가드에 손대지 않고 별도 트래커 항목
  (`SecretResolver.rotate 에 빈 값 가드가 없다`, 미해결)으로 남겨 둔 것은 그 기각 결정을
  정확히 존중한다.

## 요약

이번 impl-prep 대상(`impl-details-code-wiring.md`)은 `spec/5-system/2-api-convention.md §5.3`
의 2026-09-11 신규 규약과 `spec/5-system/15-chat-channel.md` R-CC-21·R-CC-10, `2-navigation/
2-trigger-list.md` R-12 가 기록한 「기각한 대안」·설계 원칙을 폭넓게 대조한 결과 **명시적으로
기각된 대안을 재도입하거나 합의된 invariant 를 위반하는 지점은 발견되지 않았다.** 유일하게
남는 것은 인접해 있지만 계획 문서가 인용하지 않는 미결정 트래커 항목(도메인 특화 코드 신설
여부) 하나이며, 이는 착수를 막을 사유가 아니라 향후 오독을 막기 위한 cross-reference 보강
제안(INFO)이다. 문서-실장 간 사전 존재하던 규정(botToken 형식 regex) 미집행도 이번 PR 범위
밖의 pre-existing gap 으로 별도 INFO 로만 남긴다.

## 위험도

LOW
