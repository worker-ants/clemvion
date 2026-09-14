# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 보안-관련 동작 수정인데 `CHANGELOG.md` 항목이 없다
  - 위치: `CHANGELOG.md` (신규 항목 부재) / 관련 커밋 `567c82edb`
  - 상세: 이번 브랜치는 "동시 PATCH 가 서로의 `trigger.config` 를 되돌려, 인입 서명(inbound
    signing) 검증이 fail-open 으로 되돌아간다" 는 실제 보안-관련 결함을 고친다
    (`plan/in-progress/trigger-config-lost-update.md`). 그런데 `CHANGELOG.md` 에는 이 수정에
    대응하는 항목이 없다. 이 저장소는 최근 병합된 동급 fix 커밋 전부(`git log --oneline -- CHANGELOG.md`
    로 확인한 `fdf576a2f`·`afaef5bef`·`ce454e046`·`22edfb122`·`7ef8dc993`·`fad828884` 등, 특히
    `fad828884 "chatChannel PATCH 가 비밀을 쓰지 못하게 한다 — 두 CRITICAL 을 한 수정으로 닫는다"`
    처럼 이번 건과 같은 chat-channel/inboundSigning 보안 축의 선례)에서 같은 커밋 안에
    `## Unreleased — ...` 항목을 추가해 왔고, 유사한 성격의 항목은 `**Behavior change**`
    태그까지 붙여 왔다(예: `잘못된 커서가 500 이 아니라 …`, `rotate-bot-token 의 비-UUID …`).
    이번 fix 는 그 패턴에 정확히 들어맞는 사례(잠재적 fail-open → fail-closed 로 되돌리는
    동작 변경)인데 항목이 빠져 있다.
  - 제안: `CHANGELOG.md` 에 `## Unreleased — **Behavior change**: 동시 PATCH 가 인입 서명
    ref 를 지워 fail-open 이 되던 경로를 닫는다` 류의 항목을 추가한다. (plan 체크리스트의
    `/ai-review` + `--impl-done` 항목이 아직 미완이므로, 종결 커밋 전에 넣을 여지가 있다.)

- **[WARNING]** 신규 파일 2건이 `15-chat-channel.md` 의 `code:` glob 과 §7 "구현 파일 구조"
  양쪽 모두에서 빠져 있다 — 이 문서 자신의 R-CC-22 가 경고하는 패턴의 재발
  - 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` (파일 상단) 및 `## 7. 구현
    파일 구조` (526번째 줄 부근) — 대상은 신규 `codebase/backend/src/modules/triggers/trigger-config-lock.ts`
    와 신규 `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts`
  - 상세: `code:` 리스트는 `codebase/backend/src/modules/triggers/chat-channel-*.ts` ·
    `trigger-callback-url*.ts` · 개별 e2e 파일명(`chat-channel-slack.e2e-spec.ts` 등)만
    나열한다. `trigger-config-lock.ts` 는 이름이 `chat-channel-`로 시작하지 않고
    `trigger-callback-url*` 패턴과도 다르므로 **어떤 glob 에도 걸리지 않는다.** 새 e2e
    파일도 명시 파일명 나열 방식이라 걸리지 않는다. `grep -rn "trigger-config-lock\|trigger-config-lost-update"
    spec/` 결과 0건 — 이 문서 트리 전체에 두 파일에 대한 언급이 전혀 없다.
    같은 문서의 `R-CC-22` 절 자체가 *"`triggers/` 안의 chat-channel 부분을 명시 경로로
    뒀더니 새 파일이 세 번 연속(#1317·#1319·#1320) 누락됐다"* 를 이유로 glob 전환을 했다고
    적고 있는데, `trigger-config-lock.ts` 는 그 glob 이 잡는 이름 패턴(`chat-channel-*`)
    밖에 있어 **같은 결함 클래스가 네 번째로 재발**한 형태다. 다만 `status: partial` 의
    `code:` ≥1 매치 의무 자체는 기존 glob(`chat-channel-binder.service.ts` 등)으로 이미
    충족돼 빌드 가드는 통과한다 — 이것은 게이트 위반이 아니라 **추적성(traceability) 갭**이다.
    `§7 구현 파일 구조` 는 "손으로 채워야 한다" 고 문서 자신이 명시하는 인간용 열거인데도
    두 파일 다 없다. `--impl-prep` 컨시스턴시 체크(`review/consistency/2026/09/14/17_10_16`)는
    이 gap 을 지적하지 않았는데, 그 시점엔 두 파일이 아직 생성 전(설계 단계)이었기 때문으로
    보인다.
  - 제안: `spec/` 은 developer 쓰기 권한 밖이므로 직접 고치지 말고, 이미 plan 이 만들어 둔
    "`--impl-prep` INFO 등재 (planner 범위)" 표(§D)에 항목을 하나 추가한다 — `trigger-config-lock.ts`
    를 `code:` 에 추가(또는 `trigger-*.ts` 로 glob 확장) + §7 tree 에 한 줄
    (`trigger-config-lock.ts  # trigger.config 재작성 advisory-lock 직렬화 (binder·rotateBotToken 공용)`,
    `trigger-callback-url.ts` 항목과 대구를 이루는 서술) 추가, e2e 파일명도 `code:` 리스트에 추가.

- **[INFO]** `trigger-config-lock.ts` 자신에는 지배 plan 문서로의 포인터가 없다
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` (파일 전체 JSDoc)
  - 상세: 같은 수정에 참여하는 다른 세 파일은 전부 `plan/in-progress/trigger-config-lost-update.md`
    를 명시적으로 인용한다 — `triggers.service.ts`(`update()` 창 1 주석, `rotateBotToken` 인접
    은 아니지만 파일 내 §D 인용), 신규 e2e spec(`상위 plan: ... §C`), plan 문서 자체. 그런데
    정작 이 lost-update 방지 로직의 핵심 구현체인 `trigger-config-lock.ts` 는 리뷰 세션
    경로(`review/consistency/2026/09/14/17_10_16`)만 인용할 뿐 plan 문서를 인용하지 않는다.
    이 파일의 JSDoc 은 "네 자리가 이 패턴을 갖고 있다"고 문제를 일반적으로 서술하는데, 실제로
    이 함수가 배선된 곳은 그중 3곳뿐이고(창 1 은 의도적으로 제외 — `triggers.service.ts`
    `update()` 주석과 plan §D 가 그 이유를 상세히 설명) 이 파일만 단독으로 읽으면 그 경계가
    드러나지 않는다.
  - 제안: 파일 상단 JSDoc 에 `상위 plan: plan/in-progress/trigger-config-lost-update.md §B·§D
    (창 1 은 의도적으로 미배선 — 이유는 triggers.service.ts update() 주석)` 한 줄을 추가하면,
    이 헬퍼만 단독으로 열어본 다음 사람이 "왜 `update()` 의 `save()` 는 이걸 안 쓰지?" 하고
    다시 조사하는 시간을 아낄 수 있다.

## 그 밖에 확인했지만 문제 없음으로 판정한 것 (오탐 방지 기록)

- `trigger-config-lock.ts` JSDoc 이 인용하는 선례들(`execution-engine.service.ts` 의
  `exec-cap:<workspaceId>` advisory lock, `workflows.service.ts` 의
  `nodeRows as QueryDeepPartialEntity<Node>[]` 캐스트, `spec/2-navigation/4-integration.md`
  의 Cafe24 advisory lock 기각 사례)는 모두 실측 확인됨 — 실제 코드/spec 라인과 일치한다.
- `redis-keys.md §4` 미등재 지적("이 문자열은 Redis 키가 아니다")은 developer 가 스스로
  planner 항목으로 이미 등재해 뒀다(plan §D 표) — 중복 지적 아님.
- 코드 주석의 `review/consistency/2026/09/14/17_10_16` 전체 경로 인용은 `spec/conventions/review-citations.md`
  §1~2 가 요구하는 "전체 경로 + 날짜" 형태를 정확히 따른다 — 위반 아님.
- `chat-channel-binder.service.ts` / `triggers.service.ts` 의 JSDoc·인라인 주석은 이번 diff
  구간 전체에서 코드 동작과 실측 대조했을 때 불일치를 찾지 못했다 (`R-CC-21` 인용, presence
  게이트 재계산 로직, fallback 경로 주석 모두 실제 구현과 일치).
- `plan/in-progress/spec-draft-nullable-notation-followups.md:2278` 의 원 트래커 항목이
  아직 `[ ]`인 것은 결함이 아니다 — 이 plan 의 체크리스트 자신도 "트래커 항목 `[x]` + 실측
  각주" 를 아직 미체크(`[ ]`)로 정직하게 남겨 뒀고, 종결 커밋 시점에 함께 갱신하기로 명시돼
  있다(SUMMARY 권장사항 4번과 동일 계획).

## 요약

핵심 구현(`chat-channel-binder.service.ts`, `trigger-config-lock.ts`, `triggers.service.ts`)의
JSDoc·인라인 주석은 이례적으로 상세하고 실측 근거(뮤턴트 결과, 실측 줄 수, 선례 대조)를
동반해 코드와 대조한 범위에서 불일치를 찾지 못했다. 다만 문서화 파이프라인의 "가장자리"
두 곳에서 갭이 확인된다 — (1) 보안-관련 동작 변경인데도 이 저장소가 확립해 온 커밋당
`CHANGELOG.md` 항목 관행을 따르지 않았고, (2) 신규 파일 2건이 `15-chat-channel.md` 의
`code:`/§7 열거에서 빠져, 그 문서 자신이 이미 세 차례 겪었다고 기록한 "명시 경로가 새 파일을
놓친다" 패턴이 네 번째로 재발했다(단, 빌드 가드를 깨뜨리지는 않는 추적성 갭). 둘 다 `spec/`
쓰기 권한 밖이거나 종결 커밋 전 보완 가능한 항목이라 CRITICAL 로 보지는 않는다.

## 위험도

MEDIUM
