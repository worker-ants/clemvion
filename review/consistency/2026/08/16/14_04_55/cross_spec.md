# Cross-Spec 일관성 검토 — spec-draft-eia-error-masking-catalog

## 발견사항

- **[WARNING]** 내부 REST 원문 노출 근거가 인용한 정확히 그 인접 불릿과 반대다 + 같은 엔드포인트의 기존 보안 원칙(masking parity)과 충돌
  - target 위치: `plan/in-progress/spec-draft-eia-error-masking-catalog.md` §변경안①, 신설 5번째 불릿의 마지막 하위 항목
    `**내부 REST 는 마스킹하지 않는다(비대칭 — 의도)**: ... 워크스페이스 인증을 거친 **내부 관찰자 표면**이고,
    위 `ai_message` 불릿이 문서화한 *"내부 표면은 원문 유지"* 방향과 같은 판단이다.`
  - 충돌 대상:
    1. `spec/5-system/14-external-interaction-api.md` §R17 의 **바로 위** `execution.ai_message` 불릿
       (line ~1436-1440, `- **내부 WS·Chat Channel 도 마스킹됨(수용된 trade-off)**: ...`)
    2. `spec/2-navigation/14-execution-history.md` line 466
       (`GET /api/executions/:id` 의 Config 탭 노출 보안 근거)
  - 상세:
    - target 이 근거로 인용한 `ai_message` 불릿은 실제로는 **"내부 WS·Chat Channel 도 마스킹됨"** —
      즉 내부 표면이 **원문을 유지하지 않고 오히려 마스킹된다**고 명시한다("보안 우선으로 이 rare FP
      를 수용"). target 의 "내부 표면은 원문 유지 방향과 같은 판단" 이라는 인용은 그 불릿의 실제
      결론과 **정반대**다. 같은 §R17 안에서 인접 불릿을 잘못 인용해 근거가 무너진다.
    - `spec/2-navigation/14-execution-history.md` 는 **동일 엔드포인트** `GET /api/executions/:id`
      의 노출 안전성을 이렇게 규정한다: *"별도 `@Roles` 게이트 없이 워크스페이스 멤버 전원(viewer
      포함)이 조회 가능하므로 ... 노출 자체가 새로운 시크릿 유출 경로를 만들지 않는다. 즉 **안전성은
      롤 게이팅이 아니라 서버 boundary masking parity 에 의존한다** — 신규 핸들러/integration 이
      config 에 시크릿 평문을 싣지 않도록 하는 것이 상시 불변식이다."* 이 문서의 원칙은 "워크스페이스
      인증(롤 게이팅)을 신뢰 경계로 삼아 원문을 노출해도 안전하다" 는 논리를 **정확히 그 근거로 명시
      기각**한다. target 의 `Execution.error` 비대칭 결정은 바로 그 기각된 논리("워크스페이스 인증을
      거친 내부 관찰자 표면이라 안전")를 근거로 쓴다 — 같은 엔드포인트에 대해 두 spec 섹션이 서로
      다른 보안 모델(masking parity vs 인증 기반 신뢰)을 전제한다.
  - 제안: 다음 중 하나를 명시적으로 선택하고 Rationale 에 남긴다.
    (a) 인용을 정정 — `ai_message` 불릿이 아니라 `conversationThread` 불릿의 "egress-only(의도)"
        항(내부 **소비처**는 원문 유지 — LLM 컨텍스트 주입·durable 스냅샷 등 **비-사용자-대면** 소비)을
        근거로 쓰되, `GET /api/executions/:id` 는 워크스페이스 멤버가 브라우저로 직접 읽는
        **사용자 대면 표면**이라 그 전례("내부 소비처")와도 정확히 맞물리지 않음을 인지하고 별도
        근거를 세운다. 또는
    (b) `14-execution-history.md` 의 masking-parity 원칙을 이 필드에도 적용해 내부 REST 도 마스킹
        범위에 포함시킨다 (트래커 `spec-sync-external-interaction-api-gaps.md` I1 항목의 두 옵션 중
        후자를 선택). 어느 쪽이든 두 spec 문서의 상충하는 보안 모델 서술을 나란히 두지 않는다.

- **[INFO]** pending_plans 트래커 I1 항목과의 동기화 누락
  - target 위치: frontmatter `pending_plans: plan/in-progress/spec-sync-external-interaction-api-gaps.md`
  - 충돌 대상: 같은 파일의 `## 종결 error.message 가 값-패턴 마스킹을 안 거친다` 절,
    `- [ ] **내부 REST 와 WS 가 같은 Execution.error 에 다른 값을 말한다** (2026-08-16 등재, 11_36_45 I1)`
  - 상세: 이 트래커 항목은 정확히 "(a) 의도된 비대칭이면 caveat 로 명시 / (b) REST 에도 적용 검토 —
    둘 중 하나를 고르는 것이 이 항목" 이라고 미결 상태로 남아 있다. target 의 §R17 5번째 불릿은
    사실상 (a) 를 선택해 이 항목을 닫는 것과 같은데, target 문서 어디에도 "I1 을 이렇게 해소한다"는
    명시적 연결이 없다 (범위 밖 절에도 언급 없음). 위 WARNING 이 가리키듯 그 (a) 선택의 근거 자체가
    틀린 인용이라, 이 항목을 진짜로 닫으려면 target 수정과 함께 트래커 체크박스도 갱신해야 한다.
  - 제안: target 을 수정해 근거를 바로잡은 뒤, 트래커 I1 항목에 "(a) 채택, 근거 = spec-draft-eia-error-masking-catalog" 로 체크·링크한다.

- **[INFO]** `Execution.error` 문구가 `1-data-model.md` 의 필드 설명과 살짝 어긋나는 지점 없는지 확인됨 — 충돌 아님, 참고만
  - target 위치: 변경안① 5번째 불릿 "DB `Execution.error` 는 원문을 보존한다"
  - 대조 대상: `spec/1-data-model.md` §Execution.error ↔ NodeExecution.error 관계 (line 556-563)
  - 상세: data-model.md 는 masking 을 전혀 언급하지 않고 `{nodeId, code, message, details}` 구조만
    규정한다. target 의 "egress-only, DB 는 원문 보존" 주장과 **모순되지 않는다** — data-model.md 는
    write-time 스키마만 다루고 egress 마스킹은 원래 EIA 문서 소관이라는 기존 관례(예: `conversationThread`
    도 data-model.md line 480 에 마스킹 언급 없이 convention 문서로 포인터만 있음)와 일치한다. 별도
    수정 불필요.

## 요약

target 은 §R17 3번째 불릿(`getStatus` 의 `outputData` 기반 `error`)과 이번에 마스킹하는 종결 이벤트
`Execution.error` 를 명확히 구분해 문서화하려는 시도 자체는 견고하고, `spec-sync-external-interaction-api-gaps.md`
에 이미 등재된 개별 갭들(값-패턴 마스킹 미적용·잔여 패턴 갭·§6.4/§R17 미등재)과도 정합하게 맞물린다.
다만 새로 추가하는 "내부 REST 는 마스킹하지 않는다(비대칭 — 의도)" 판단의 근거가 (1) 바로 인접한
`ai_message` 불릿을 정반대로 인용하고 있고, (2) 같은 엔드포인트(`GET /api/executions/:id`)의 노출
안전성을 이미 다른 spec 문서(`2-navigation/14-execution-history.md`)가 "롤 게이팅이 아니라 masking
parity 에 의존한다" 로 명시적으로 규정해 둔 것과 상충한다. 이 비대칭 결정 자체(내부 REST 원문 유지)가
틀렸다는 뜻은 아니지만, 현재 근거 문장은 두 곳 모두에서 반증되므로 그대로 채택하면 향후 독자가 §R17
을 신뢰할 수 없는 근거 사슬로 읽게 된다. WARNING 1건 해소(근거 정정 또는 결정 재검토) 후 채택을 권장한다.

## 위험도
MEDIUM
