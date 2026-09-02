# Rationale 연속성 검토 — `spec-draft-ws-badge-flip-tracker-close.md`

## 검토 범위 · 방법

target 의 두 결정(① `6-websocket-protocol.md` status 승격, ② `2-api-convention.md §10.4` 예외
위임)을 관련 spec 4곳(`3-workflow-editor/3-execution.md`, `5-system/2-api-convention.md`,
`5-system/6-websocket-protocol.md`, `data-flow/3-execution.md`)의 `## Rationale` 전문과 대조했다.
target 이 인용하는 과거 결정 2건(`#1265` 의 "§10.4 안 고침", `#1266` 의 backend·frontend 구현)은
`git log`/`git show` 로 실제 커밋을 열어 원문과 대조해 검증했다 — 지어낸 이력이 아님을 확인.

## 발견사항

- **[WARNING]** 결정 ① — frontmatter 승격 근거(선례 실측)가 spec 자신의 `## Rationale` 에 정착할
  계획이 불명확
  - target 위치: `## 결정 ①` 전체 + 변경안 표 `#7` (`6-websocket-protocol.md :1101 status 강등 기록`)
  - 과거 결정 출처: `spec/3-workflow-editor/3-execution.md` 의 Rationale
    `### partial 강등 → implemented 복귀 — 추적 surface 전건 해소 (2026-06-03 audit → 2026-06-16 종결)`
    — 이 문서가 정확히 같은 패턴(추적 대상이 아닌 "§6 향후 로드맵(미구현)" 절이 남아 있어도
    `implemented` 로 복귀)을 겪었을 때, **그 판단 자체를 전용 Rationale 서브섹션으로 못박았다**
    ("남은 미구현은 §6 브레이크포인트뿐인데, 이는 본 audit 추적 대상이 아니라 별도로 '향후
    로드맵(미구현)' 으로 분리·명시된 surface 다").
  - 상세: target 은 "이 저장소의 선례는 '향후 로드맵 — 미구현' 절이 `implemented` 를 막지
    않는다는 것" 이라고 논증하고 이를 **추측이 아니라 선례 실측**이라고 명시한다. 이 추론은
    (실측 결과) 옳다 — `spec-impl-evidence.md §3` 의 가드는 `pending_plans:` 만 보고
    `execution.paused`/`continue`/`step` 배지는 WS 문서 자신의 `pending_plans`
    (`spec-sync-websocket-protocol-gaps.md`) 에 없다(직접 확인). 문제는 **이 판단의 정착 위치**다.
    현재 변경안 표 `#7` 은 "원문 보존 + 승격 후속 주석" 이라고만 적어 분량·내용이 미정이고,
    `#9`(Rationale 추가)는 `R-ws-socket-lifetime-binds-token` 에 "구현 완료 사실 + 커밋 한 줄"만
    더한다 — **배지 잔존이 승격을 막지 않는 이유 자체를 설명하는 문장은 표 어디에도 명시적으로
    할당돼 있지 않다.** 이 추론이 plan 문서 본문에만 남고 spec 자체의 Rationale 에 정착하지
    않으면, 다음에 `6-websocket-protocol.md` 만 읽는 사람(plan 은 결국 `plan/complete/` 로 이동)은
    `implemented` 옆에 남은 3개 `_(계획·미구현)_` 배지를 보고 재조사해야 한다 — 정확히
    `0-overview.md` Rationale 도입부가 분리하려는 문제("무엇이 남았는가 / 왜 그런가"를 섞지
    않도록 본문과 근거를 분리)가 재발한다.
  - 제안: 변경안 `#7`(`:1101` 인근) 또는 신설 서브섹션에 3-execution.md 의
    "partial 강등 → implemented 복귀" 문단과 **동형 구조**로 — "잔여 미구현은
    `execution.paused`/`continue`/`step` 뿐인데, 이는 본 문서의 추적 대상(`pending_plans`)이
    아니라 [`3-execution.md §6 로드맵`](../3-workflow-editor/3-execution.md#6-브레이크포인트-향후-로드맵--미구현)
    을 소유처로 미러링만 하는 배지다" 를 **명문화**할 것을 제안. (선례 문서를 가리키기만 해도
    충분 — 전문 복제 불필요, 결정 ②의 "위임" 원칙과도 정합.)

- **[WARNING]** 결정 ② — `#1265` 의 "§10.4 불변경" 결정을 번복하면서 새 Rationale 을
  `api-convention.md` 자신에는 남기지 않는다
  - target 위치: `## 결정 ②` 전체 + 변경안 표 `#10` (`2-api-convention.md §10.4`)
  - 과거 결정 출처: 커밋 `6ffadb1f4`(`#1265`, `docs(spec): WS 소켓 수명을 토큰 수명에 종속`)
    커밋 메시지 "2R WARNING 4건" 중 **③** — *"§10.4 는 의도적으로 안 고쳤다 — 그 절은 재연결을
    3줄로 요약하고 상세를 §6 에 위임한다. 요약에 예외를 복제하면 두 곳이 갈릴 자리를 새로
    만든다."* (실측 확인: `git show 6ffadb1f4` 의 해당 절 diff 에 `2-api-convention.md` 변경 없음 —
    실제로 "안 고침" 이 지켜졌었다.)
  - 상세: target 은 이 결정을 뒤집는다 — 전제(발동 빈도: 드묾 → `#1266` 이후 상시)가 바뀌었다는
    근거로 §10.4 에 위임 한 줄을 **추가**하기로 한다. 이 논증 자체는 견고하고(전제 변화를
    명시), 정직하게 "번복" 이라 부르며 원 논리("복제 대신 위임")를 계승한다 — **criterion 3 이
    요구하는 "새 Rationale 작성" 을 draft 자신은 이미 수행**했다(`## Rationale (본 draft 의
    결정 근거)` § "왜 §10.4 를 복제가 아니라 위임으로 쓰는가"). 문제는 **그 Rationale 이
    적히는 장소**다 — 프로젝트 규약("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")상
    영구 SoT 는 `api-convention.md` 자신의 `## Rationale` 이어야 하는데, 변경안 표 `#10` 은
    §10.4 **본문**(위임 한 줄) 개정만 명시하고 `api-convention.md` 의 `## Rationale` 절에 대응
    항목을 추가하는 행이 없다. `api-convention.md` 의 기존 Rationale 4항목(413/§11/비-페이징/
    conversationThread)은 모두 이 급의 정정마다 항목을 남기는 이 문서의 확립된 패턴이라, §10.4
    변경만 예외로 남기면 그 패턴과 거리가 생긴다. plan 문서는 결국 `plan/complete/` 로
    이동하므로, 향후 "§10.4 요약에 왜 예외 한 줄이 있는가" 를 묻는 사람이 `api-convention.md`
    안에서 답을 못 찾는다.
  - 제안: 변경안 표에 `api-convention.md` `## Rationale` 신설 항목(예: "§10.4 재연결 요약에
    서버발신 disconnect 예외 위임 — `#1265`(불변경) → `#1266`(빈도 변화) 전제 갱신")을 한 줄로
    추가. 내용은 draft 자신의 "왜 §10.4 를 복제가 아니라 위임으로 쓰는가" 문단을 그대로
    이식하면 되므로 비용은 낮다.

## 요약

target 이 인용하는 두 과거 결정(3-execution.md 의 partial→implemented 복귀 선례, `#1265` 의
§10.4 불변경 결정)은 모두 `git log`/spec 실측으로 검증되며 지어낸 이력이 아니다. 결정 ①의
논증(잔존 `_(계획·미구현)_` 배지가 승격을 막지 않는다)은 `spec-impl-evidence.md §3` 가드
실측(승격은 `pending_plans:` 만 본다)과 정확히 일치해 **원칙 위반이 아니다**. 결정 ②의 번복도
전제 변화(드묾 → 상시)를 명시하며 원 논리("복제 대신 위임")를 계승해 **무근거 번복이 아니다**.
다만 두 결정 모두 그 정당화 논증이 **plan 문서 본문에만** 남을 위험이 있고, 대응하는 spec
문서(`6-websocket-protocol.md`/`api-convention.md`) 자신의 `## Rationale` 에는 명시적으로
정착시키는 표 항목이 없다 — 이는 이 저장소가 반복적으로 지켜온 "결정 근거는 spec 문서 자체에
남긴다" 관행과의 거리이며, 두 건 모두 WARNING 이다. CRITICAL 급(기각된 대안의 무단 재도입,
invariant 직접 위반)은 발견되지 않았다.

## 위험도

LOW
