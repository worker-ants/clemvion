# Plan 정합성 검토 — `spec/7-channel-web-chat/` (--impl-prep)

## 발견사항

- **[WARNING]** i18n 활성화 후속 작업 포인터가 실제 작업 계획이 아닌 종결된 defer 결정 plan 을 가리킴
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md:158`("구현 상태" 콜아웃, `## 4. i18n` 절 말미) ·
    `spec/7-channel-web-chat/2-sdk.md:202`(§R6) · `spec/7-channel-web-chat/_product-overview.md:57`(§2 비목표 각주) — 세 곳 모두
    `[webchat-i18n-scope 후속](../../plan/complete/webchat-i18n-scope.md)` 로 동일하게 링크.
  - 관련 plan: `plan/in-progress/spec-draft-webchat-en-i18n.md` (본 target 6파일 편집을 실제로 수행한 plan. `started: 2026-07-12`,
    `worktree: llm-usage-doc-alignment-01d7a4` — 현재 검토 세션과 동일 worktree).
  - 상세: target 세 곳이 "코드 구현은 착수 예정"이라며 링크하는 `plan/complete/webchat-i18n-scope.md`(#922)는 **옵션 (c)(EN 착수)를
    명시적으로 기각(defer)한 종결 문서**일 뿐, 구현 안내를 담고 있지 않다(`> **결정 2026-06-02 (superseded)**` 류의 과거 기록,
    "코드 변경 없음" 스코프). 실제로 이 활성화를 실행하고 구현 핸드오프 체크리스트(§8 — 위젯 로컬 catalog·`resolveLocale`·§3.5
    32키 치환·ko/en parity 테스트·`PROJECT.md`/`doc-sync-matrix.json` 동반 갱신)를 담은 문서는 `plan/in-progress/spec-draft-webchat-en-i18n.md`
    이며, 이 plan 이 target 6파일(Edit A~F)을 직접 편집했다. 그런데 target 은 정작 자신을 만든 이 in-progress plan 을 어디서도
    참조하지 않는다(`grep -rn spec-draft-webchat-en-i18n spec/` 0건). 이 코드베이스에는 이미 spec 이 `plan/in-progress/*`
    를 직접 인용하는 선례가 있다(예: `14-external-interaction-api.md:424` 가 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    를 인라인 인용). 부가적으로 `1-widget-app.md`/`2-sdk.md` frontmatter 는 `status: implemented` (`pending_plans:` 없음)인데,
    같은 문서 본문이 "코드 구현은 착수 예정"인 surface 를 스스로 명시하고 있어 `spec/conventions/spec-impl-evidence.md §3`
    lifecycle 정의(`implemented`="모든 약속 구현 완료", 부분 구현은 `partial`+`pending_plans:` 의무)와 결이 어긋난다 —
    단 이 패턴 자체는 `3-auth-session.md`(§3.1 "Planned" 401 분기, 추적 plan 없이 status: implemented 유지)에도 이미 존재하는
    영역 관행이라 신규 결함이라기보다 관행의 연장이다. 다만 그 기존 사례와 달리 이번 건은 **추적 가능한 in-progress plan 이
    실재**하므로 `pending_plans:` 로 연결하지 않을 이유가 약하다.
  - 제안: 세 곳의 "webchat-i18n-scope 후속" 링크를 `plan/in-progress/spec-draft-webchat-en-i18n.md`(§8 후속 체크리스트)로
    교체하거나 병기. 가능하면 `1-widget-app.md`/`2-sdk.md` frontmatter 에 `pending_plans: [plan/in-progress/spec-draft-webchat-en-i18n.md]`
    추가 + `status: partial` 전환(§8 항목이 모두 `plan/complete/` 로 이동하면 `implemented` 로 재승격)을 검토.

- **[WARNING]** 카루셀 잘림 배너 후속 plan 에 자기보고된 각주가 실제로는 누락
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행·R8(carousel 잘림 배너 별도 후속 서술)
  - 관련 plan: `plan/in-progress/webchat-widget-presentation-followups.md` "미구현 항목 #2 — 카루셀 잘림 배너 미구현"
  - 상세: `plan/in-progress/spec-draft-webchat-en-i18n.md §7 "검증"` 은 자체적으로 다음을 완료로 보고한다 — "**[P1] plan_coherence
    교차참조**: 카루셀 잘림 배너 후속([webchat-widget-presentation-followups.md](webchat-widget-presentation-followups.md)
    '미구현 항목 #2')에 '착수 시 배너 문구는 `1-widget-app §4` i18n 키·ko/en parity 를 경유' 각주 1줄 추가." 그러나 실제
    `plan/in-progress/webchat-widget-presentation-followups.md` 파일을 확인하면 `i18n`/`parity`/`§4` 어느 키워드도 등장하지
    않는다(`grep -n "i18n\|parity\|§4" webchat-widget-presentation-followups.md` 0건) — 각주가 실제로는 반영되지 않았다.
    이 상태로 후속 developer 가 그 plan 만 보고 카루셀 배너를 착수하면, 방금 target 이 신설한 위젯 로컬 i18n catalog(§4)를
    거치지 않고 새 하드코딩 한국어 문자열을 또 추가할 위험이 있다(§3.5 인벤토리가 방금 정리한 "chrome 은 전부 catalog 경유"
    원칙과 충돌).
  - 제안: `webchat-widget-presentation-followups.md` "카루셀 잘림 배너 미구현" 항목에 누락된 각주를 실제로 추가하거나,
    `spec-draft-webchat-en-i18n.md §7` 의 "[P1] … 각주 1줄 추가" 완료 표기를 미완료로 정정.

- **[INFO]** EIA 명령-표면 매트릭스 breaking-change 공지 결정(F-3)이 target 의 M2 BYO-UI 문서화와 접점이 있으나 상호 인지 없음
  - target 위치: `spec/7-channel-web-chat/0-architecture.md` §5.3(M2 BYO-UI headless client, `@workflow/sdk` 직접 사용) ·
    `spec/7-channel-web-chat/2-sdk.md` §2(EIA HTTP/SSE 재사용 서술)
  - 관련 plan: `plan/in-progress/eia-command-waiting-surface-guard.md` "F-3. 외부 EIA 클라이언트 대상 breaking behavior 공지
    여부 결정(project-planner)" — 대기 표면과 안 맞는 명령이 종전 202/침묵 수용에서 409 거부로 바뀌는 변경에 대해 외부
    EIA 클라이언트(공지 여부·채널)를 project-planner 가 아직 결정하지 않은 상태(미해결, F-3).
  - 상세: target 이 문서화하는 M2(BYO-UI)는 `@workflow/sdk` 로 EIA `interact` 명령을 **직접 호출**하는 외부 개발자 경로다.
    M1(hosted iframe, 위젯 자신)은 항상 표면에 맞는 명령만 보내므로(§3.1 표) 영향이 없지만, M2 의 서드파티 구현은
    대기 표면과 안 맞는 명령을 보낼 수 있어 이 guard 변경(EIA-IN-13 이후 202→409)의 영향권에 들어간다. target 은 이
    F-3 미해결 결정을 인지·cross-ref 하지 않는다 — 직접적 충돌은 아니며(위젯 자체 동작에는 영향 없음), M2 관련 공개
    문서화나 `@workflow/sdk` changelog 작성 시점에 F-3 결정을 참고할 필요가 있다는 수준의 참고 사항이다.
  - 제안: 별도 조치 불요. `@workflow/sdk`/M2 관련 공개 문서를 작성하는 시점에 `eia-command-waiting-surface-guard.md` F-3
    의 project-planner 결정을 선행 확인하도록 메모.

## 요약

target(`spec/7-channel-web-chat/` 6개 문서)이 우회하거나 정면 충돌하는 "결정 필요" 항목은 발견되지 않았다 — locale 활성화(R6/R10),
EIA-RL-07 idle-wait GC(R9), 카루셀 잘림 배너 carve-out 등 target 이 참조하는 선행 plan(`spec-draft-webchat-en-i18n.md`,
`spec-sync-external-interaction-api-gaps.md`, `webchat-widget-presentation-followups.md`)과의 상태(구현 완료/미완료) 서술은 실측과
일치한다. 다만 target 을 실제로 편집한 in-progress plan(`spec-draft-webchat-en-i18n.md`) 자신이 남긴 두 가지 self-tracking 약속이
어긋나 있다 — (1) target 3곳의 "구현 착수 예정" 포인터가 그 plan 자신이 아니라 이미 종결된 defer 결정 문서를 가리키고,
(2) 그 plan 이 완료로 자기보고한 카루셀 배너 i18n 각주가 실제로는 sibling plan 파일에 반영되지 않았다. 둘 다 후속 작업자가
잘못된/불완전한 안내를 따라갈 위험이 있는 WARNING 이며, 즉시 차단할 CRITICAL 은 없다.

## 위험도
MEDIUM
