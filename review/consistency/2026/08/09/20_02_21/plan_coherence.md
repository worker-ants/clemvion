# Plan 정합성 검토 — spec/5-system/ (impl-prep, 전체 도메인 번들)

## 발견사항

- **[WARNING]** `15-chat-channel.md` frontmatter 의 `pending_plans` 가 이미 완료·이동된 plan 을 가리킴
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` 4번째 항목
    (`plan/in-progress/spec-sync-chat-channel-gaps.md`)
  - 관련 plan: `plan/complete/spec-sync-chat-channel-gaps.md` (전 항목 `[x]`, 커밋 `88ab25bcc`
    "완료 spec-sync 2건 종결" — 2026-06-13 — 로 `in-progress/` → `complete/` 이동)
  - 상세: 실제 파일은 `plan/complete/`에 있고 `plan/in-progress/spec-sync-chat-channel-gaps.md` 경로는
    더 이상 존재하지 않는다(확인: `ls plan/in-progress | grep chat-channel` → discord-gateway·
    slack-socket-mode·visual-ssr-png 3건만 존재). 해당 이동 커밋이 target frontmatter 를 함께
    갱신하지 않아 dangling reference 가 남았다. 이 프로젝트가 `plan-lifecycle.md` 로 정한
    "이동 시 참조 갱신" 관행에서 벗어난 사례이며, 다음 사람이 이 포인터를 따라가면 존재하지
    않는 in-progress 항목을 찾게 된다.
  - 제안: target `pending_plans` 목록에서 `spec-sync-chat-channel-gaps.md` 항목 제거(나머지 3건은
    실재 backlog 이므로 유지).

- **[WARNING]** `auth-guard-reflection-hardening.md` (완료, PR #1108 머지)의 "후속 (이 PR 밖)" spec 쓰기
  항목이 target 에 아직 반영되지 않음
  - target 위치: `spec/5-system/3-error-handling.md §1.3` (에러 코드 카탈로그),
    `spec/5-system/1-auth.md §3.3` 또는 `data-flow/12-workspace.md §1.5`(Rationale), frontmatter `code:`
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` `## 후속 (이 PR 밖)` 3개 항목
    (모두 `[ ]`, "planner 턴 필요 — spec/ 쓰기" 로 명시)
  - 상세: 실제 코드(PR #1108, 머지됨)는 이미 `X-Workspace-Id` 헤더가 UUID 형태가 아니면
    `400 VALIDATION_ERROR` 를 던지는데, target `3-error-handling.md §1.3` 카탈로그에는 그
    케이스에 대응하는 행이 없다(실측: `grep -n "VALIDATION_ERROR\|WORKSPACE_ID_REQUIRED"
    spec/5-system/3-error-handling.md` → 기존 `WORKSPACE_ID_REQUIRED`(헤더·클레임 **둘 다 없음**)
    행만 있고, "헤더는 있으나 형식이 틀림 → VALIDATION_ERROR" 케이스는 미등재). 마찬가지로
    헤더(`isUuidShaped`, 느슨)와 경로 파라미터(`ParseUUIDPipe`, 엄격)의 **의도된** 검증 강도
    비대칭도 어느 spec 에도 없다 — plan 이 명시적으로 "일관성 명목으로 헤더를 조이면
    nil-UUID e2e 프로브가 깨진다" 는 회귀 위험을 적어 뒀다. `1-auth.md` frontmatter `code:` 글로브도
    신설된 `common/utils/uuid.ts`·캐너리 파일이 빠져 있다.
  - 제안: 코드는 이미 배포됐으므로 spec 을 코드에 맞춰 갱신하는 순수 planner 턴. 이 항목이
    선행되지 않은 채 §1.3 이나 §3.3 인가 표면을 건드리는 개발 작업이 들어오면 "결정 필요"가
    아니라 "구현과 spec 이 이미 갈라진 상태에서 추가 변경을 쌓는" 리스크가 생긴다.

- **[WARNING]** `spec-sync-auth-gaps.md` 가 명시한 선행 조건(신규 audit action 카탈로그)이 아직
  target 에 없음 — 트리거 시크릿/토큰 회전 감사 착수 시 즉시 막힘
  - target 위치: `spec/5-system/1-auth.md §4.1` (감사 로그 카테고리), `spec/conventions/audit-actions.md §3`
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md` "트리거 시크릿/토큰 회전 3종 감사 —
    planner 선행 필요" 항목(8차 리뷰 security, `[ ]`)
  - 상세: `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 은
    `recordAudit` 를 호출하지 않는데(plan 의 실측), 대응할 `trigger.rotate*` 액션이 spec
    카탈로그에 아예 없다(재확인: `grep -rn "trigger\.rotate\|rotateBotToken\|rotateNotificationSecret
    \|revokePerTriggerToken" spec/5-system/1-auth.md spec/conventions/audit-actions.md` → 0건).
    plan 이 스스로 "이 항목은 감사 로깅이 아니라 **새 설계**라 별도 planner 턴 필요, 정정 턴에
    얹지 말 것" 이라고 순서를 명시해 뒀다.
  - 제안: developer 가 이 3개 라우트에 감사 로깅을 추가하려면 그 전에 `1-auth.md §4.1` +
    `audit-actions.md §3` 에 `trigger.rotate*` 액션명·시제·범위를 먼저 확정하는 planner 턴이
    선행돼야 한다(plan 이 이미 그렇게 순서를 정해 뒀음 — 우회하지 말 것).

- **[INFO]** SIGTERM/timeout 유발 abort 최종 상태 분류 — 미해결 (a)/(b) 결정은 target 에 의해
  선점되지 않음(정상), 다만 인접 정밀도 후속 2건이 미반영
  - target 위치: `spec/5-system/4-execution-engine.md §8/§11`, `spec/5-system/6-websocket-protocol.md:375`
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
    최상단 "결정이 필요하다 (택일)" (미체크, 사용자 몫으로 명시) + `#9` 항목(경량 정밀도 2건, `[ ]`)
  - 상세: 확인 결과 target `4-execution-engine.md:1305` 는 여전히 "SIGTERM 미완료 시 `failed` +
    `SERVER_INTERRUPTED`" (기존 (a) 계약)를 그대로 서술하고 있어, plan 이 미결로 남긴 (a)/(b)
    택일을 **target 이 선점하지 않는다** — 충돌 없음. 다만 같은 plan `#9` 가 지목한
    `6-websocket-protocol.md:375` "진행 중 turn 을 조기 종료" 표현은 `#8` 이 §1.1 에 확정한
    "즉시 끊지 않는다 / 기록은 지연되지 않는다" 어휘와 아직 맞춰지지 않은 상태(target 재확인:
    `6-websocket-protocol.md` 의 `replay 중 cancel` 각주는 §1.1 갱신 이후에도 동일 문구 유지).
    이 자체는 모순이 아니라 정밀도 문제로 plan 도 낮은 우선순위로 분류했다.
  - 제안: 새 CRITICAL/WARNING 아님 — 다만 이 도메인(cancellation/SIGTERM 분류)에 대한 후속
    개발 작업이 들어오기 전에 `#9`/`#11` 잔여 2건을 정리해 두면 target 표현의 일관성이 개선된다.

## 요약

target(`spec/5-system/` 17개 파일)과 `plan/in-progress/**` 전반을 pending_plans frontmatter ·
관련 코드/spec 경로 교차 참조로 점검했다. **결정을 선점하는 CRITICAL 충돌은 발견되지 않았다** —
가장 위험도가 높았던 SIGTERM/timeout abort 분류 (a)/(b) 미결 항목을 target 이 올바르게 중립
서술로 유지하고 있다. 다만 세 가지 WARNING 급 갭이 확인된다: (1) `15-chat-channel.md` 의
`pending_plans` 가 이미 `plan/complete/`로 이동한 항목을 여전히 in-progress 로 가리키는 dangling
포인터, (2) 최근 머지된 PR(#1108)이 구현한 동작(400 VALIDATION_ERROR 분기·헤더/경로 UUID 검증
비대칭)이 아직 `1-auth.md`/`3-error-handling.md` 에 반영되지 않은 spec-lags-code 상태, (3) 트리거
시크릿 회전 3종 감사 로깅에 필요한 신규 audit action 카탈로그가 target 에 없어 그 작업을
시작하면 즉시 선행 planner 턴이 필요해지는 상태. 세 항목 모두 이미 각 plan 문서에 정확한
위치·근거로 등재돼 있어 "유실"은 아니지만, target 문서 자체가 아직 그 갭을 반영하지 못하고
있으므로 해당 영역(auth 감사, 워크스페이스 헤더 에러 코드, chat-channel plan 포인터) 작업 착수
전 확인이 필요하다.

## 위험도
MEDIUM
