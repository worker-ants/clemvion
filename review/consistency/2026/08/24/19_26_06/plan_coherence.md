# Plan 정합성 검토 — spec/5-system/ (--impl-prep)

검토 대상 착수 예정 작업: `plan/in-progress/masking-expression-egress-split.md`
("config echo 마스킹을 어댑터에서 출구로" — 정본 트래커
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 "`DEFAULT_SENSITIVE_KEYS` 재개
신호" 항목을 집행하는 신규 plan).

## 발견사항

- **[WARNING]** 이 plan 이 손대는 바로 그 파일을 설명하는 자매 트래커 항목이 stale 화될 예정인데 체크리스트에 갱신 항목이 없다
  - target 위치: (spec 아님) `plan/in-progress/spec-sync-external-interaction-api-gaps.md:601-612` —
    "**자매 표면 `handler-output.adapter.ts` 의 값 축은 아직 열려 있다**" 항목
  - 관련 plan: `plan/in-progress/masking-expression-egress-split.md` (신규, 이번 착수 대상)
  - 상세: 601-612 항목은 "*그 값(마스킹된 `config`)은 DB 저장 · WS emit · 표현식 echo 로
    흐른다*" 는 **현재 아키텍처**를 전제로, "값 축을 겹치면 저장되는 값과 표현식이 읽는 값이
    바뀌어 정상 워크플로를 깨뜨릴 수 있다" 는 이유로 값-패턴 마스킹 추가를 **의도적으로
    보류**한 항목이다(2026-08-23 등재, 위 재개-신호 항목에서 "의도적으로 분리"라고 명시).
    그런데 신규 plan 은 바로 그 어댑터의 `maskSensitiveFields(r.config)` 호출 자체를
    **통째로 제거**한다 — 601-612 항목이 서술하는 "어댑터가 키 축만 가리고 그 결과가 DB·WS·
    표현식 세 곳으로 흐른다" 는 전제가 이 PR 이후 더는 사실이 아니게 된다(어댑터는 이제
    아무것도 가리지 않고, DB 는 원문을 그대로 받는다 — 신규 plan 의 "안전성" 표가 스스로
    주장하듯). WS·REST 목적지에 대한 값-축 우려는 각 출구의 `deepRedactSecrets` 계열이
    이미 값-패턴까지 훑으므로 이 PR 로 사실상 해소되는 side effect 도 생긴다. 신규 plan
    체크리스트(`- [ ] (planner 턴) egress-masking.md 에 이 중복 제거와 근거 반영`)는
    convention 문서 갱신만 겨냥하고, 이 원 트래커 항목을 닫거나 재-스코프하는 단계가 없다 —
    구현이 끝나면 601-612 는 이미 사라진 코드 경로를 여전히 "아직 열려 있다"고 서술하는
    낡은 기록으로 남는다. 이 저장소는 바로 이 항목의 서두에서 "*결합 항목을 한 체크박스로
    닫으면 나머지가 조용히 사라진다*" 패턴을 스스로 경계해 온 이력이 있다(`16_21_45` W5) —
    이번에는 방향이 반대(분리해 둔 항목이 남의 PR 로 무효화)지만 같은 결과(낡은 트래커)를
    낳는다.
  - 제안: `masking-expression-egress-split.md` 의 checklist 에 "(planner 턴) 자매 트래커
    항목(601-612) 을 이 PR 결과로 닫거나 재기술" 단계를 추가한다. 재기술 시 남는 진짜
    잔여는 "표현식이 이제 raw config 를 읽는다"(의도된 동작, R17/Principle 7 backstop 원칙과
    합치) 뿐이고, DB/WS/REST 값 축 우려는 이 PR 로 해소됨을 명시해야 한다.

- **[WARNING]** "포함관계 캐너리" 전제가 target spec(`egress-masking.md`) 이 이미 기록한 "동명 이형 상수" 위험을 반영하지 않는다
  - target 위치: `spec/conventions/egress-masking.md` §1 "⚠️ 이름이 한 단어 차이인 스캐너가
    둘 있다" 콜아웃(같은 논리로 §1 전체가 "좌표계는 사람이 손으로 맞춰야 한다"는 이 문서의
    핵심 주제) — 이 문서는 신규 plan 의 spec_impact 대상이자 신규 plan 이 직접 인용하는 SoT
  - 관련 plan: `plan/in-progress/masking-expression-egress-split.md` "안전성은 키 집합
    포함관계에 걸려 있다" 절 + 체크리스트 "포함관계 캐너리" 항목
  - 상세: plan 은 "출구는 `CREDENTIAL_KEY_PATTERN`(정규식)" 이라고 **단수**로 서술하고,
    `DEFAULT_SENSITIVE_KEYS ⊆ CREDENTIAL_KEY_PATTERN` 하나만 캐너리로 고정하면 안전하다고
    전제한다. 그런데 실측하면 `CREDENTIAL_KEY_PATTERN` 은 **독립 선언이 두 곳**이다 —
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:112`(REST 쪽,
    `redactStoredDataForResponse`/`deepRedactSecrets` 가 참조)와
    `codebase/backend/src/modules/websocket/websocket.service.ts:78`(WS 쪽,
    `maskWireEnvelope`/`deepRedactSecretsPreserving` 이 참조)이고, 두 파일 모두 스스로
    "동명이인이지 같은 심볼이 아니다"·"의도된 미러" 라고 명시한다. 실제로 **오늘 시점에도 두
    정규식은 다르다** — REST 쪽에만 `x[_-]api[_-]?key` 가 있고 WS 쪽은 의도적으로 뺐다
    (websocket.service.ts:74-76 JSDoc: "REST 표면 전용 확장이라 여기 없는 것이 정상이고
    동기화 대상이 아니다"). `egress-masking.md` §1 은 정확히 이 클래스의 실수("한쪽만 고치고
    양쪽 고쳤다고 적는 사고")가 PR #1190 에서 **두 번** 났다고 스스로 기록한 문서다. plan 의
    캐너리 서술이 "정본 구현을 실행해 확인" 이라고는 했지만 어느 구현(REST 것인지 WS
    것인지, 혹은 둘 다인지)을 겨냥하는지 명시하지 않아, 이 저장소가 이미 두 번 겪은 실수
    패턴과 같은 모양으로 착수될 위험이 있다. (현재 `DEFAULT_SENSITIVE_KEYS` 항목 중
    `x-api-key` 접두형과 충돌하는 키는 없어 오늘 당장 포함관계가 깨지지는 않지만, 그것은
    우연이지 캐너리가 보장하는 사실이 아니다.)
  - 제안: 체크리스트의 "포함관계 캐너리" 항목을 "`sanitize-error-message.ts` 의
    `CREDENTIAL_KEY_PATTERN` **및** `websocket.service.ts` 의 `CREDENTIAL_KEY_PATTERN` **각각에
    대해** `DEFAULT_SENSITIVE_KEYS` 포함관계를 단언" 으로 명시적으로 복수화한다. 뮤테이션
    단계("출구 마스킹을 하나씩 제거")도 이미 출구별로 나뉘어 있으니 자연히 두 상수를 따로
    건드리게 되지만, 캐너리 자체의 "무엇을 검증했는가" 서술이 단수인 채로 남으면 다음 사람이
    "포함관계 확인 끝" 을 "두 상수 다 확인" 으로 오독할 수 있다.

- **[INFO]** `mask-sensitive-fields.util.ts` 헤더 주석이 이 PR 이후 stale 해진다
  - target 위치: 없음(코드 주석) — 참고로 `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:22-24`
  - 관련 plan: `masking-expression-egress-split.md` 체크리스트 "어댑터에서
    `maskSensitiveFields(config)` 제거 + 왜 안전한지 JSDoc"
  - 상세: 해당 주석은 "이 상수는 `handler-output.adapter.ts` 도 쓰고, 그쪽은 노드 `config`
    echo 를 DB·WS·표현식으로 내보낸다" 는 문장으로 시작하는데, 이 PR 로 그 소비처 자체가
    사라진다(남는 소비처는 `explore-tools.service.ts` 뿐). plan 의 "왜 안전한지 JSDoc" 은
    새 위치(어댑터)에 추가하는 서술로 읽히는데, 이 옛 주석(마스킹 함수 쪽)도 같은 PR 에서
    같이 정정해야 다음 사람이 "이 상수는 아직 adapter 도 쓴다" 고 오독하지 않는다. 코드
    리뷰(`/ai-review`) 단계에서도 잡힐 수 있는 항목이라 INFO 로 낮춘다.

## 요약

신규 plan `masking-expression-egress-split.md` 는 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)
가 2026-08-23 에 명시한 재개 신호("config echo 를 다운스트림 표현식이 실제로 읽는 사례 확인")를
정확히 그 신호가 지정한 실측 형태로 확인하고, 트래커가 이미 선호 순서를 매겨 둔 옵션 (a)(표현식
경로만 마스킹 제외)를 택했다는 점에서 **미해결 결정을 우회하는 CRITICAL 성 충돌은 없다** — 오히려
node-output.md Principle 7(2026-08-17, "egress 값-마스킹은 backstop 이지 새 예외가 아니다·DB 는
egress-only")·EIA §R17 의 기존 결정과 정합한 방향이다. 다만 두 가지 WARNING 이 남는다: (1) 이 PR
이 변경하는 바로 그 코드를 서술하는 자매 트래커 항목이 구현 후 낡은 상태로 방치될 예정이고
plan 체크리스트에 이를 닫거나 재기술하는 단계가 없다, (2) plan 의 핵심 안전 전제("포함관계
캐너리")가 저장소가 이미 두 번 겪은 "동명이인 상수(WS/REST `CREDENTIAL_KEY_PATTERN`)를 하나로
착각" 패턴을 명시적으로 배제하지 않은 채 단수로 서술돼 있다 — target spec(`egress-masking.md`)이
바로 이 실수를 경계하려고 신설된 문서라는 점에서 이 누락은 가볍지 않다. 두 항목 모두 착수 자체를
막을 사안은 아니고(캐너리·뮤테이션 설계 자체는 이미 방어적이다), 체크리스트 보강으로 해소 가능하다.

## 위험도

MEDIUM
