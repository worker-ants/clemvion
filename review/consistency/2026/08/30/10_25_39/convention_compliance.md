# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-followups-drain-2026-08-30.md`

## 검토 범위

target 은 developer 턴이 실측으로 찾아 등재만 해 둔 spec 결함 4건을 처분하는 spec draft plan 이다.
`spec_impact`: `14-external-interaction-api.md` · `data-flow/15-external-interaction.md` ·
`conventions/egress-masking.md` · `5-system/6-websocket-protocol.md`. 각 §의 "변경안" 블록이
실제로 spec 에 반영될 텍스트이므로, 그 텍스트가 대상 문서 및 `spec/conventions/` 의 기존 규율과
정합한지를 중심으로 검토했다(사실관계 자체의 참/거짓은 다른 검토자의 영역이라 배제).

## 발견사항

- **[WARNING]** §3 변경안이 `egress-masking.md` 자신의 "좌표계 표 갱신" 규율을 어긴다
  - target 위치: target §3 "변경안" 블록 (`egress-masking.md:89` 캐비엇 교체)
  - 위반 규약: `spec/conventions/egress-masking.md` §1 좌표계 표(표 2행) + §3 "이 문서는 기계가
    지키지 않는다" 의 자기 규율(사람이 갱신) — 특히 2026-08-23 `assistant-mask-leak` 실례
    ("`deepRedactSecrets` 가 새 표면에 도달하면 표 2행 소비처 열을 갱신하고 `code:` 에
    파일을 등재한다")
  - 상세: 변경안 텍스트는 `TerminalErrorPayload` 를 채우는 5개 호출부가
    `redactTerminalError` → `deepRedactSecrets` 를 경유한다고 명시한다. `deepRedactSecrets`
    는 표 2행(`MAX_REDACT_DEPTH`)의 소비처 심볼이고, 현재 그 열은
    "REST 응답·저장 에러·conversation thread · workflow-assistant explore 응답" 만 나열한다.
    실측(`codebase/backend/src/shared/utils/terminal-error-payload.ts:3,107,110`)으로
    `redactTerminalError` 가 같은 `deepRedactSecrets`(`sanitize-error-message.ts` export)를
    호출함을 확인했다 — 이는 §3 이 예시로 든 "마스커가 새 표면에 도달" 케이스와 구조적으로
    동일하다. 그런데도 변경안은 이 사실을 §2 캐비엇 프로즈에만 "별도 egress 초크포인트"로
    적고, §1 표 2행 소비처 열과 frontmatter `code:` 목록(현재 `terminal-error-payload.ts`
    부재)에는 반영하지 않는다. 이 갭은 자동 가드로 걸리지 않으므로(§3 이 스스로 명시)
    다음 사람이 §1 표만 보면 이 소비처를 놓친다.
  - 제안: §1 표 2행 소비처 열에 "`TerminalErrorPayload` emit(WS, `redactTerminalError` 경유)"
    를 추가하고, frontmatter `code:` 에
    `codebase/backend/src/shared/utils/terminal-error-payload.ts` 를 등재한다. 이미 §3 에
    이 정확한 절차의 실례(2026-08-23)가 있으므로 같은 PR 에서 반복하면 된다.

- **[WARNING]** §4 변경안이 대상 문서의 `## Rationale` 서브섹션 구조(`###` 헤딩)를 따르지 않는다
  - target 위치: target §4 "변경안" 블록 (`spec/5-system/6-websocket-protocol.md` `## Rationale`
    삽입 문단)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" — 정식 규약
    검토 점검 관점 3 "문서 구조 규약". `6-websocket-protocol.md` 의 `## Rationale` 은 현재
    10개 이상의 서브섹션을 갖고 전부 `### <제목> — <근거> (날짜·결정)` 형식이다(예:
    `### KB 채널 단위 전환 — ...`, `### 메시지 origin 마커 도입 — ...`). blockquote 만으로
    이뤄진 최상위 Rationale 항목은 그 문서에 없다.
  - 상세: 변경안은 `> **WS 이벤트 enum 명명 — <도메인>EventType**. ...` 로 시작하는 blockquote
    를 그대로 `## Rationale` 에 "얹는다"고 서술한다. 같은 파일의 다른 모든 Rationale 항목과
    형식이 달라, 목차·검색(헤딩 기준 grep) 관례를 깨고 이 항목만 시각적으로 부속 caveat 처럼
    보이게 만든다.
  - 제안: `### WS 이벤트 enum 명명 — <도메인>EventType (2026-08-30, #1238 후속)` 형태의
    `###` 헤딩을 신설하고, 본문을 그 아래 일반 프로즈로 두고 "왜 conventions/ 신설이
    아닌가" 만 nested blockquote 로 유지한다(그 부분은 이미 이 문서의 다른 Rationale
    항목들이 쓰는 "결정 + nested 왜" 패턴과 합치한다).

- **[INFO]** §4 의 "conventions/ 신설 대신 Rationale 에 얹는다" 판단은 CLAUDE.md 표와 결이 다르지만 방어 가능
  - target 위치: target §4 "왜 `spec/conventions/` 신설이 아닌가" 블록
  - 관련 규약: CLAUDE.md "정보 저장 위치" 표 — "정식 규약 | `spec/conventions/<name>.md`"
  - 상세: CLAUDE.md 표만 보면 "명명 규칙"은 원칙적으로 `spec/conventions/` 행 소관으로 읽힌다.
    target 은 이를 `#1194`(egress-masking.md 신설 커밋, 실제 로그로 확인함: `bdcfdc514`)의
    "cross-file·영구적 사실만 승격" 판단을 근거로 반대 방향("단일 파일 스코프는 승격 불필요")
    으로 유비한다. `#1194` 자체는 "단일 파일이면 승격 안 한다" 를 직접 진술하지 않으므로 이는
    같은 원칙의 역방향 추론이며, 문서에 명시적으로 기록된 선례는 아니다 — 다만 원칙 자체(승격
    기준 = 파일 경계를 넘는 영속적 사실)와 모순되지는 않는다.
  - 제안: 현재 방어 논리로 충분히 통과 가능하나, 이런 "한 파일 스코프 명명 규칙" 사례가 반복되면
    (`audit-actions.md` 가 실제로 이 임계값을 넘어 별도 conventions 파일로 승격된 선례이므로)
    다음 번엔 conventions/ 승격을 재검토할 것을 권한다.

- **[INFO]** §2 변경안의 링크가 "§3" 을 라벨링하면서도 앵커 fragment 를 달지 않는다
  - target 위치: target §2 "변경안" 블록, `[conventions/redis-keys.md §3](../conventions/redis-keys.md)`
  - 관련 규약: `spec/conventions/redis-keys.md` 자신은 다른 문서를 인용할 때 항상 절 번호와
    앵커를 함께 단다(예: `[엔진 §9.2](../5-system/4-execution-engine.md#92-...)`,
    `[EIA §8.4](../5-system/14-external-interaction-api.md#84-rate-limit)`).
  - 상세: target 의 링크는 라벨에 "§3" 을 명시하지만 href 는 문서 최상단으로만 간다
    (`redis-keys.md` §3 실제 헤딩 앵커는 `#3-전역-인벤토리-포인터`). 클릭하면 §3 이 아니라
    문서 맨 위로 이동한다. `data-flow/15-external-interaction.md:255` 의 기존 링크는 애초에
    라벨에 절 번호가 없어 이 문제가 없었는데, target 이 라벨만 구체화하면서 href 가 못 따라간
    형태다.
  - 제안: href 를 `../conventions/redis-keys.md#3-전역-인벤토리-포인터` 로 갱신한다.

## 요약

target 이 제안하는 4건의 spec 텍스트 변경 중 §1(EIA statusCode 정정)·§2(Redis 각주 재배선)는
인용 형식(심볼/앵커 기반)·SoT 분리 원칙 모두 기존 규약과 정합했다. §3(egress-masking 캐비엇
회수)은 캐비엇 자체의 문구는 정확하지만, 같은 문서가 명시적으로 요구하는 "좌표계 표·`code:`
동반 갱신" 규율(2026-08-23 실례로 문서 자체에 기록됨)을 놓쳤다 — `TerminalErrorPayload` 가
`deepRedactSecrets` 의 새 소비처임을 발견해 놓고 §1 표에는 반영하지 않는 자기모순적 누락이다.
§4(`<도메인>EventType` 명명 규칙 신설)는 `spec/conventions/` 미신설 판단 자체는 방어 가능하나,
삽입 형식이 대상 문서의 기존 Rationale 서브섹션 구조(`###` 헤딩)를 따르지 않는다. 두 WARNING
모두 이 draft 가 spec 에 쓰이기 전에 같은 PR 안에서 쉽게 고칠 수 있는 문서 정합성 문제이며,
기계가 강제하는 invariant 를 깨지는 않는다(CRITICAL 없음).

## 위험도

MEDIUM
