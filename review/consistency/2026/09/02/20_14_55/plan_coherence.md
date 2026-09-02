# Plan 정합성 검토 — `spec-draft-ws-badge-flip-tracker-close.md`

## 검토 방법

target 문서(`plan/in-progress/spec-draft-ws-badge-flip-tracker-close.md`)의 두 결정(① WS spec
`implemented` 승격, ② `2-api-convention.md §10.4` 위임 한 줄)을 다음과 대조했다:

- 번들에 포함된 4개 형제 plan(`spec-draft-ws-socket-lifetime-binds-token.md`,
  `spec-draft-ws-wontdo-maintenance-appping.md`, `spec-sync-websocket-protocol-gaps.md`,
  `ws-token-expired-socket-lifetime-impl.md`)의 실제 라이브 상태(`cat`/`grep` 로 직접 확인,
  번들 스냅샷이 아니라 워크트리 현재 파일)
- `spec/5-system/6-websocket-protocol.md`·`2-api-convention.md`·`3-workflow-editor/3-execution.md`
  의 실제 frontmatter·본문 (target 이 인용하는 줄 근처를 직접 열어 대조)
- `git log`로 `#1266`(구현) 실제 머지 여부, `spec-impl-evidence.md §3`(승격 가드) 원문
- `plan/in-progress/**` 전수에서 `6-websocket-protocol.md`·이동 대상 3파일을 참조하는 문서 전수
  grep (번들에 없는 60개 절단 파일 포함, 직접 파일시스템 조회)
- `.claude/docs/plan-lifecycle.md §3` (target 이 row 16 에서 인용하는 이동 규칙 SoT)

## 발견사항

- **[WARNING]** `:1101`·`:1115`·`:1133` "원문 보존" 이 plan-lifecycle §3 의 "인입 참조 동시 갱신"
  요구와 충돌할 여지
  - target 위치: `## 변경안` 표 row 7 (`〃 :1101 status 강등 기록 | 원문 보존 + 승격 후속
    주석`), row 8 (`〃 :1115·:1133 범위 밖 | 원문 보존 + 처분 완료 포인터`)
  - 관련 plan: `.claude/docs/plan-lifecycle.md §3` — *"인입 참조: `review/**` 같은 시점 기록
    문서는 옛 경로 유지. `spec/` 등 살아있는 문서의 plan 링크는 이동과 동시에 갱신."*
  - 상세: `6-websocket-protocol.md` 안에 `plan/in-progress/spec-sync-websocket-protocol-gaps.md`
    문자열이 정확히 4곳 있다(`:5` frontmatter, `:28` 전송계층 안내, `:1101` status 강등 기록,
    `:1133` R-wontdo-maintenance-appping "범위 밖"). target row 1(frontmatter)과 row 2(`:28`,
    내용 자체를 다시 쓰므로 자연히 해소)는 갱신을 명시하지만, row 7·8 은 `:1101`·`:1133` 을
    **"원문 보존"**(verbatim)으로 명시한다. 이동 후 그 문자열이 가리키는 경로는 더 이상
    존재하지 않는다(`plan/complete/spec-sync-websocket-protocol-gaps.md` 로 이동). plan-lifecycle
    §3 은 예외를 `review/**` 시점 기록에만 두고 `spec/` 은 "이동과 동시에 갱신" 대상으로
    명시한다 — 같은 §3 을 target 이 row 16 에서 (다른 방향, 이동 문서끼리의 outgoing 링크에)
    이미 인용하고 있어 이 조항 자체를 인지하고 있음이 분명하다. row 15 의 "살아있는 문서의
    경로 갱신" 이 일반 원칙으로 이를 커버한다고 읽을 수도 있으나, row 7·8 의 "원문 보존" 문구가
    구체적으로 그 반대(불변경)를 지시해 두 row 사이에 실행 시 무엇이 우선하는지가 target 문서
    자체에서 명시적으로 풀리지 않는다.
  - 제안: row 7·8 의 "승격 후속 주석"/"처분 완료 포인터" 에 **새 경로**
    (`plan/complete/spec-sync-websocket-protocol-gaps.md`)를 명시적으로 싣도록 target 을
    보강한다. 원 문장(옛 경로 포함)은 역사적 기록으로 보존하되, 그 옆에 붙는 신규
    annotation 이 §3 이 요구하는 "갱신된 살아있는 포인터" 역할을 하도록 문구를 못박으면
    두 요구가 함께 만족된다.

- **[INFO]** target 의 초반부 편집이 다른 plan 의 하드코딩 줄 번호 인용을 stale 하게 만들 수 있음
  - target 위치: `## 변경안` 표 row 2(`:28` 전송 계층 안내), row 3(§1.2 `:52`)
  - 관련 plan: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:363,476`
    — `6-websocket-protocol.md:186`·`:375` 를 하드 줄 번호로 인용
  - 상세: target 의 row 2·3 편집은 `6-websocket-protocol.md` 상단부(28행·52행 부근) 문단을
    다시 쓴다. 편집으로 순증감 줄 수가 나면 그 아래(186행·375행)를 인용하는 다른 plan 의 줄
    번호 인용이 밀려 stale 해질 수 있다. 이 저장소는 이미 이런 drift 를 여러 차례 겪었고
    (`spec-draft-eia-notification-payload-contract.md` 자신이 "줄 번호로 줄 번호 결함을
    추적하면 같은 자리에서 다시 썩는다"고 기록), target 범위 밖의 사전 예방 조치이지만
    실행 후 `grep -n "6-websocket-protocol.md:186\|6-websocket-protocol.md:375"` 로 그 두
    인용이 여전히 맞는 절을 가리키는지 확인할 가치가 있다. target 결정을 막을 사안은 아니다.

- **[정보성 확인 — 문제 없음]** target 의 핵심 전제 3가지를 각각 실측 검증했고 모두 참이었다:
  1. `#1266`(구현) 은 실제로 `origin/main` 에 머지돼 있다(`git merge-base --is-ancestor` 확인).
  2. `spec-impl-evidence.md §3` 의 승격 가드 인용("마지막 `pending_plans` 가 `complete/` 로
     이동한 commit 안에서 승격")은 원문과 정확히 일치하며, `6-websocket-protocol.md` frontmatter
     의 `pending_plans:` 는 실제로 그 트래커 1건뿐이다 — 트래커가 이동하면 가드가 승격을
     **강제**한다(재량이 아니다).
  3. Decision① 의 선례 근거(`3-execution.md §6` 이 `status: implemented` 이면서 브레이크포인트
     3종을 "_(계획·미구현)_" 으로 남긴 채 그 상태를 Rationale 로 명시)도 실측과 일치한다.
  이 세 전제가 모두 사실이므로 Decision①·② 는 "미해결 결정 우회" 로 볼 근거가 없다.

## 요약

target 문서는 3개 형제 plan(spec draft 둘 + 트래커)의 실제 결정 이력을 정확히 반영하고 있고,
핵심 전제(`#1266` 머지 여부·승격 가드 문구·선례)를 모두 실측으로 확인했다 — 미해결 결정을
일방적으로 우회하는 지점은 찾지 못했다. 유일한 실질 리스크는 3개 plan 을 `plan/complete/` 로
이동시키면서 `6-websocket-protocol.md` 본문에 남아 있는 옛 경로 참조 2곳(`:1101`·`:1133`)을
"원문 보존" 으로 처리하겠다는 target 자신의 지시가, target 이 스스로 인용한
`plan-lifecycle.md §3`("살아있는 문서의 plan 링크는 이동과 동시에 갱신")과 문구 차원에서
정확히 어떻게 화해하는지 target 안에서 명시되지 않은 점이다 — 차단 사유는 아니고 실행 전
annotation 문구에 새 경로를 못박으면 해소된다.

## 위험도

LOW
