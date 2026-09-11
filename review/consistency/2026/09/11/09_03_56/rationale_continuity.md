# Rationale 연속성 검토 — spec-draft-chat-channel-conventions

## 발견사항

- **[WARNING]** D-1(`details[].code` 생략 금지)이 wiring 되면 §5.4.1.2 의 기존 명시 문장과 정면 충돌하는데 변경안에 그 문장 수정이 없다
  - target 위치: `plan/in-progress/spec-draft-chat-channel-conventions.md` (a) 절 실측 표 · `## 결정` D-1 · `## 변경안` A1/D1
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1.2 (`f947b49f4`/`3f04761cd`, PR #1315, 2026-09-11 — **target 바로 직전 커밋**) — "`details[].code` 는 두 항목 모두 **서비스 가드 갈래**라 싣지 않는다"
  - 상세: 직전 커밋의 커밋 메시지 자체가 "`2-api-convention.md:205` 대비 갭이지만 **코드 사안**이라 후속 등재했다" · "후속 2건 신규 등재(서비스 가드 `details[].code` 부재 · `chat-channel-adapter.md §1.1` 멱등 각주)"라고 명시적으로 이 작업을 예고했으므로, target 의 (a)/D-1 이 그 후속을 닫는 것 자체는 정당하다(기각된 결정 재도입이 아니다). 문제는 **실측 범위 누락**이다 — target 의 "11자리 중 9자리" 표는 `triggers.service.ts` 의 `botToken`(702행)·`chatChannel`(733행)·`provider`(744행) 세 자리를 빠뜨렸고 `inboundSigningPlaintext` 도 5곳(710·797·812·824·833)인데 "×4"로 셌다(실측: `grep -n "field: '" triggers.service.ts`). 이 중 `chatChannel`·`provider` 두 자리는 바로 §5.4.1.2 가 "code 없음"이라고 **문장으로 직접 지목**한 자리다. D-1 이 "code 는 생략하지 않는다"를 명문화하면 이 두 자리도 대상에 들어가는데, target 의 변경안(A1/B1/C1/D1)에는 §5.4.1.2 문장을 함께 정정하는 항목이 없다 — 이대로 머지되면 같은 파일 안에서 §5.3(A1, "생략 금지") 과 §5.4.1.2("두 항목 모두... 싣지 않는다")가 서로 다른 말을 하게 된다.
  - 제안: (a) 절 실측 표에 `botToken`·`chatChannel`·`provider` 세 자리와 `inboundSigningPlaintext` 5번째 자리를 추가해 범위를 정정하고, 변경안에 "§5.4.1.2 의 '두 항목 모두... 싣지 않는다' 문장을 D-1 신 규칙에 맞춰 정정(또는 배선 전까지는 '계약상 코드 필요 — 배선 대기'로 명시)" 항목을 추가한다.

- **[WARNING]** 결정 라벨 `D-1`~`D-4` 가 같은 파일의 기존 `R-CC-21` 라벨(D-1/D-2) 및 직전 plan 의 `D-1`~`D-4` 와 충돌한다
  - target 위치: `plan/in-progress/spec-draft-chat-channel-conventions.md` `## 결정` 절 (D-1·D-2·D-3·D-4)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` "Rationale ID 컨벤션" 절(§ 하단, `R-CC-N`/`R-CCA-N` prefix 채택 근거) + 같은 파일 `R-CC-21` 이 이미 쓰고 있는 "D-1(필드를 받지 않는다)"·"D-2(경로가 그 두 비밀을 쓰지 않는다)" + `plan/complete/spec-draft-chat-channel-drift-3.md`(직전 완료 plan, PR #1315)의 `D-1`~`D-4`(전혀 다른 네 결정: `details.field` 분기 명시·신규 400 등재·`store()→rotate()`·근거 표현 정정)
  - 상세: "Rationale ID 컨벤션" 절은 정확히 이 문제 — "신규 로컬 Rationale 에 prefix 없는 `R10/R11/R12` 를 쓰면 검토자가 외부 참조와 혼동할 위험" — 를 이유로 `R-CC-N`/`R-CCA-N` prefix 를 채택했다. 그런데 plan 단계의 `D-N` 라벨은 그 방지책 밖에 있고, 실제로 `R-CC-21` 본문에 "D-1"/"D-2" 가 prefix 없이 그대로 커밋된 전례가 있다(즉 plan 라벨이 spec Rationale 산문에 그대로 옮겨진 이력이 있다). 이번 target 도 같은 관행을 따르면 같은 파일(`15-chat-channel.md`) 안에 의미가 다른 "D-1" 이 두 번 박히고, `2-api-convention.md`/`swagger.md`/`chat-channel-adapter.md` 에 흩어진 새 "D-1"~"D-4" 까지 더해져 `grep -rn "D-1"` 한 번으로는 어느 결정을 가리키는지 구분할 수 없다 — `R-CC-N` prefix 를 도입한 바로 그 사유가 재발한다.
  - 제안: 실제 spec 반영 시 plan 의 `D-1`~`D-4` 라벨을 그대로 옮기지 말고, 각 대상 파일의 기존 Rationale ID 체계(`R-CC-N`/`R-CCA-N`) 를 따르거나 최소한 파일별로 고유한 라벨(예: `D-CONV-1` 등)을 쓴다.

- **[INFO]** §5.4.1/§5.4.1.1 의 "실측" 콜아웃 셀을 "계약값(미배선)"으로 바꾸면 같은 셀 안에서 측정-사실과 아직-사실-아닌-값이 섞인다
  - target 위치: `## 결정` D-4 · `## 변경안` D1 ("`15-chat-channel.md §5.4.1` 3축 표 — `details[].code` 를 계약값으로 + 배선 PR 링크")
  - 과거 결정 출처: `spec/5-system/2-api-convention.md` Rationale "§5.3 에 `410` 기본 코드를 만들지 않은 이유" (문서가 구현에 없는 동작을 약속하면 다음 사람이 그 약속을 믿고 결함을 만든다는 원칙) + `spec/5-system/15-chat-channel.md` §5.4.1 콜아웃 "details.field 의 SoT 는 단일하지 않다 — 그것이 확정 설계다 (2026-09-11)"(근거: `trigger-dto-validation.spec.ts` 의 `[실측]` 2건)
  - 상세: 대상 표 셀은 현재 "**단위 테스트 실측**"이라는 실측 근거 태그를 달고 "code 없음"을 적고 있다. D-4 가 이 칸을 "계약값(양쪽 `INVALID_FIELD`)"으로 고쳐 쓰면서 "배선 전까지는 관측값이 아니다"를 한 줄로만 붙이면, 같은 행의 다른 두 축(위치·형태)은 여전히 "실측"인데 `code` 축만 "계약(아직 거짓)"이 되어 셀 하나의 인식론적 지위가 이웃 셀과 달라진다. `2-api-convention.md` 의 410-Rationale 이 이미 "구현에 없는 동작을 문서가 약속하면 안 된다"는 정확히 같은 함정을 지적하고, 그때는 "명시 의무"만 규약으로 적고 존재하지 않는 기본값은 문서화하지 않는 것으로 해소했다.
  - 제안: D-4 편집 시 기존 "실측: code 없음" 문구를 지우지 말고 보존한 채, 그 옆/아래에 "계약(D-1, 배선 대기)" 을 **별도 문장**으로 병기해 실측과 계약을 시각적으로 분리한다 — 하나의 셀 값을 통째로 교체하지 않는다.

## 요약

target 문서의 핵심 세 결정(details.code 명문화 · Update 접두 범위 · setupChannel 멱등 각주)은 기존 spec Rationale 이 명시적으로 기각한 대안을 되살리거나 R1~R9/R-CC-* 의 핵심 설계 원칙(단일 sink, EIA facade, provider 성격 구분 등)을 침해하지는 않는다 — 오히려 직전 커밋(PR #1315)이 스스로 예고해 둔 두 "후속" 항목(서비스 가드 `details[].code` 부재, `chat-channel-adapter.md §1.1` 멱등 각주)을 정확히 겨냥하고 있어 계보상 정당하다. 다만 (1) 그 후속의 실측 범위가 직전 커밋이 막 심어 둔 §5.4.1.2 의 명시 문장("두 항목 모두 code 를 싣지 않는다")을 놓쳐 머지 직후 같은 파일 안에서 자기모순을 만들 소지가 있고, (2) plan 단계의 `D-1`~`D-4` 라벨이 같은 파일에 이미 존재하는 다른 의미의 `D-1`/`D-2`(R-CC-21) 및 직전 plan 의 동명 라벨과 충돌해, 바로 그 혼동을 막으려 도입된 `R-CC-N`/`R-CCA-N` prefix 원칙과 어긋난다. 둘 다 머지를 막을 정도는 아니지만 변경안 체크리스트에 반영해야 하는 실질적 갭이다.

## 위험도

MEDIUM
