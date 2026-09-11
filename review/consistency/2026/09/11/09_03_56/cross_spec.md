# Cross-Spec 일관성 검토 — `spec-draft-chat-channel-conventions.md`

## 검토 방법 안내

전달받은 `_prompts/cross_spec.md` 번들은 `spec/5-system/15-chat-channel.md`·`spec/0-overview.md` 등
대다수 관련 spec 본문이 **"컨텍스트 예산 초과로 절단"** 상태였다 (기존에 알려진 `--spec` 모드 예산
갭). 이 검토는 번들 대신 워크트리의 실제 파일(`spec/5-system/15-chat-channel.md`,
`spec/5-system/2-api-convention.md`, `spec/conventions/swagger.md`,
`spec/conventions/chat-channel-adapter.md`, `spec/conventions/error-codes.md`,
`spec/2-navigation/2-trigger-list.md`, 관련 코드)을 직접 읽어 대조했다.

## 발견사항

- **[WARNING]** D-1 의 새 전역 규칙이 같은 PR 이 손대지 않는 `15-chat-channel.md §5.4.1.2` 의 기존
  명시적 서술과 정면으로 어긋난다
  - target 위치: `## 결정` D-1 (`2-api-convention.md §5.3` 에 "객체 행에 `code` 는 생략하지
    않는다" 신설) · D-4 (`15-chat-channel.md §5.4.1` 의 "3축 표"만 수정 범위로 명시)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1.2 (`chatChannel` 필드 존재성 ·
    `provider` 불변성) 마지막 문단 — *"`details[].code` 는 두 항목 모두 **서비스 가드 갈래**라
    싣지 않는다(위 §5.4.1 의 두-갈래 서술 참조)"*
  - 상세: D-1 은 "필드 검증 사유의 기본값은 파이프와 같은 `INVALID_FIELD`" 를 **일반 규칙**으로
    신설한다. §5.4.1.2 의 두 항목(`details.field='chatChannel'`, `details.field='provider'`)은
    정확히 그 "필드 검증 사유" 범주에 속하는 서비스 가드 케이스인데, 이 섹션은 `code` 부재를 —
    §5.4.1 표의 경우처럼 "단위 테스트 실측"이라는 잠정적 관측값이 아니라 — **정당화까지 붙인 확정
    서술**로 적어 놓았다(*"두 항목은 R-CC-21 의 필연적 귀결이라 새 결정이 아니다"*). 실측으로도
    확인된다 — `triggers.service.ts:733,744` 가 실제로 `details: { field: 'chatChannel' }` /
    `details: { field: 'provider' }` 로 `code` 없이 던진다. 그런데 target 의 section (a) 실측
    표는 "11자리 중 9자리가 `code` 를 안 싣는다"고 셀 때 이 두 자리를 **빠뜨렸다** — 실제로는
    `triggers.service.ts` 안에서만 최소 11자리(9+이 2개), 전체 최소 13자리다. D-4 는 "§5.4.1 의
    3축 표"만 고친다고 스코프를 명시했으므로, 이 PR 이 착지한 뒤에도 §5.4.1.2 는 새로 신설되는
    전역 규칙과 문면으로 직접 모순되는 상태로 남는다.
  - 제안: D-4 의 스코프를 §5.4.1.2 까지 넓히거나(그 문단도 "계약값·배선 대기"로 각주), 아니면
    "왜 이 두 자리는 예외인가"를 명시적으로 결정해 적어라. §5.4.1.1(`inboundSigningPlaintext`
    rotation 의 동일한 두-갈래 서술)도 "3축 표"라는 표현이 §5.4.1 표만 가리키는지 §5.4.1.1 까지
    포함하는지 모호하므로 같이 명확히 하는 편이 좋다. section (a) 의 실측 표도 이 2자리를 반영해
    "11자리"→"13자리"로 정정하는 것을 권한다.

- **[WARNING]** `spec_impact` 목록에 없는 미러 문서 — `2-navigation/2-trigger-list.md` 가
  동일한 `details.field` 서술을 여러 곳에서 인용/재서술한다
  - target 위치: frontmatter `spec_impact` (4개 파일만 나열: `2-api-convention.md` ·
    `15-chat-channel.md` · `swagger.md` · `chat-channel-adapter.md`)
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` §3 (L176~179, L336) — `botTokenRef` ·
    `provider` · `chatChannel` · `inboundSigningPlaintext` PATCH 차단과 그 `details.field` 형식을
    `15-chat-channel.md §5.4.1`/`§5.4.1.2` 를 "SoT" 로 인용하며 거의 그대로 재서술
  - 상세: 이 문서는 새 사실을 정의하지 않고 15-chat-channel.md 를 인용하는 파생 문서라 즉시
    모순이 생기지는 않는다(현재는 `code` 값을 언급하지 않고 `details.field` 형식만 서술). 그러나
    D-4 가 `15-chat-channel.md §5.4.1`의 `details[].code` 서술을 바꾸는 순간 이 미러 문서가 그
    변경 이전 상태로 stale 해질 위험이 있고, `spec_impact` 에 없으므로 이 PR 의 리뷰·추적
    대상에서 누락된다. 저장소에 이미 "미러 문서 전수 확인" 이 반복 교훈으로 남아 있는 영역이다.
  - 제안: `spec_impact` 에 `spec/2-navigation/2-trigger-list.md` 를 추가하거나, 최소한 D-4 적용
    후 이 문서에 staleness 가 없는지 확인하는 체크리스트 항목을 명시한다.

- **[INFO]** B1 신설 명명 규칙이 `swagger.md §5-4` 체크리스트에는 반영되지 않는다
  - target 위치: `## 변경안` B1 (`conventions/swagger.md §1` 에 명명 규칙 신설)
  - 충돌 대상: `spec/conventions/swagger.md` §5-4 "새 엔드포인트 체크리스트"
  - 상세: 모순은 아니지만, 새 명명 규칙이 §1 에만 추가되고 새 엔드포인트 작성 시 참조하는
    체크리스트(§5-4)에는 언급이 없어 다음 사람이 놓치기 쉽다.
  - 제안: 체크리스트에 "요청 DTO 명명 — Update 접두 범위 확인" 한 줄 추가를 고려.

## 검증해 확인한 것 (충돌 없음)

- D-1 이 유지하는 "형태(객체/배열)는 지금 그대로 둔다"는 실제 `2-api-convention.md §5.3` 본문과
  일치한다(이미 두 형태 다 허용). §4.2(error-codes.md, trigger 파라미터 검증 사유)는 배열 형태 +
  도메인 특화 코드를 쓰므로 D-1 의 "기본값 `INVALID_FIELD`, 도메인 특화 코드 있으면 그것"과 충돌
  없음.
- B1(Update 접두 스코프)의 실측 — 18개 `Update*Dto` 전부 컨트롤러 `@Body()` top-level(그 중
  `UpdateScopeDto` 도 `integrations.controller.ts:544` 에서 top-level 로 확인) — 이 저장소 어디에도
  `Patch` 접두 클래스나 이와 상충하는 기존 명명 규칙 문서가 없음.
- D-3(`chat-channel-adapter.md §1.1` 멱등 각주)은 기존 문구("같은 config 재호출 OK")와 상충하지
  않고, 오히려 그 문구가 모호해서 생긴 실제 CRITICAL(#1313)을 명시화하는 보강.
- 신규 요구사항 ID 충돌·RBAC 모델 충돌·상태 전이 충돌·계층 책임 충돌 관점에서는 특별한 발견 없음
  (본 draft 는 새 요구사항 ID 를 발행하지 않고 기존 R-CC-21/CCH-AD-02 등을 인용만 함, spec→developer
  구현 순서도 기존 컨벤션과 일치).

## 요약

가장 실질적인 문제는 D-1 이 신설하는 전역 규칙("details 객체는 code 를 생략하지 않는다")이 같은
PR 의 D-4 가 손대지 않기로 스코프를 좁힌 `15-chat-channel.md §5.4.1.2` 의 기존 확정 서술과 문면
그대로 모순된다는 점이다 — 그 섹션이 다루는 두 필드(`chatChannel`, `provider`)가 정확히 D-1 이
규정하는 "필드 검증 사유" 범주에 들고, 실측으로도 `code` 가 실제로 빠져 있다(§5.4.1.2 통계는 target
자신의 실측 표에서도 누락됐다). 두 번째로, `2-trigger-list.md` 가 동일 사실을 반복 인용하는데
`spec_impact` 목록에 빠져 있어 D-4 적용 후 staleness 점검 경로가 없다. 나머지 결정(D-2/D-3, B1/C1)은
기존 spec·코드베이스 실측과 부합하며 새로운 영역 충돌을 만들지 않는다.

## 위험도

MEDIUM
