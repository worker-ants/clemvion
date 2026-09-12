# 문서화(Documentation) 리뷰 — round 18_21_05 (7번째)

## 점검 방법

이 라운드가 새로 다루는 유일한 변경은 마지막 커밋 `1e1d484c2`(`docs(plan): 게이트 3층 통과 —
plan 종결 + swagger.md 규약 갭 등재`)다 — `codebase/**` 는 라운드 6(`17_52_34`)이 마지막으로
평가한 `f978f8d77` 이후 변경이 없고(`git diff f978f8d77..HEAD -- codebase/` 0줄), 이번 커밋은
plan 이동(`plan/in-progress/chat-channel-rules-cleanup.md` → `plan/complete/`) + 체크리스트/표
갱신 + `review/consistency/2026/09/12/18_08_30/**` 산출물만 건드린다. 직전 6라운드의
documentation.md 를 모두 읽어 이미 확인된 사실(bare `hh_mm_ss` 인용 정정, JSDoc/`//` 분리,
citation 체인 등)을 재확인하지 않고, 이번 커밋이 만든 **plan 문서 자체의 신규 diff** 에 집중했다.

- `git show 1e1d484c2` 로 이 커밋이 건드린 두 plan 파일의 실제 변경분을 전수 대조.
- 체크리스트·`## 증거`·`## 실측 기록` 세 곳의 수치 서술이 서로 일치하는지 교차 검증.
- `review/consistency/2026/09/12/18_08_30/_prompts/**` (이 커밋 **이전** 시점 스냅샷)과 대조해,
  이번 커밋이 그 스냅샷 이후에 만든 변경인지 확인.

## 발견사항

- **[WARNING]** plan 문서 안에서 뮤테이션 개수가 **세 자리에서 서로 다르게** 적혀 있다 — "9종"
  하나, "6종"/"여섯" 둘.
  - 위치: `plan/complete/chat-channel-rules-cleanup.md:87`(`## 증거` — "실제로는 **여섯** 을
    돌렸다"), `:102`(체크리스트 — "뮤테이션 **9종**"), `:120`(`## 실측 기록 — 뮤테이션 6종`
    소제목, 바로 아래 표는 1~9번 **9행**).
  - 상세: 라운드 2(`review/code/2026/09/12/16_39_18`)가 "plan 내부 모순 — 뮤테이션 개수를
    3종/5종 혼재에서 6종으로 통일"을 W2 로 조치했을 때는(커밋 `e07521a27`) 세 자리가 실제로
    전부 "6종"으로 일치했다. 이후 라운드 3~6 이 가드 재발방지(#7)·`botIdentity` 필드 누락
    회귀(#8)·label 스왑(#9) 세 뮤턴트를 추가로 요구했고, 그 세 행이 `## 실측 기록` 표에
    쌓였다. 그런데 마지막 커밋 `1e1d484c2` 가 체크리스트 한 곳만 "9종"으로 갱신하고
    (`git show 1e1d484c2` diff 로 확인), `## 증거` 문단과 `## 실측 기록` 소제목은 라운드 2
    시점의 "6종/여섯" 그대로 남겨 뒀다 — 표 자체는 9행인데 그 표의 **제목**이 "6종"이라고
    말하는 상태다. `review/consistency/2026/09/12/18_08_30/_prompts/plan_coherence.md:2466,
    2478, 2496` (이 커밋 **이전** 스냅샷)을 대조하면 그 시점엔 세 자리가 전부 "6종"으로
    일치했음이 확인돼 — 이 불일치는 **이 커밋이 새로 만든 것**이고 어떤 이전 라운드도
    검토하지 못했다(직전 documentation.md 라운드들은 모두 `1e1d484c2` 이전 diff 를 봤다).
    이 파일은 `plan/complete/` 로 이동해 "완료 이력"으로 굳은 상태라, 다음 사람이 이 표를
    참조하면 "예고 3 + 파생 2 + 후속 4 = 9" 인지 "여섯"인지 헷갈린다 — 하필 이 plan 문서 자체가
    "예측/실측 두 칸으로 정확히 적어라"를 실천 사례로 내세우는 문서라 아이러니가 크다.
  - 제안: `:87` "실제로는 **여섯** 을 돌렸다"를 "아홉"으로, `:120` 소제목 "뮤테이션 6종"을
    "뮤테이션 9종"으로 갱신해 체크리스트(`:102`)와 맞춘다. 이미 `spec_impact: none` ·
    `status: complete` 로 커밋된 문서라 코드 게이트는 걸리지 않지만, plan 사후 정정은 이
    저장소 관례상 새 커밋으로 가능하다.

## 확인했으나 문제 없음 (이월, 재지적 아님)

- **트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 종결/신규 카운트** —
  같은 커밋의 "종결 4 · 신규 6" 표기를 diff 와 전수 대조했다. 사전 존재 항목 중 `[ ]→[x]`
  전환 3건(`rotateBotToken` swagger 잔여 · 구조 정리 6건 · spec 보강 5건) + 신규 항목이면서
  즉시 닫힌 1건(naming 게이트 사각지대) = 종결 4, 신규 항목 6건(위 1건 + 열린 5건: swagger.md
  §5-1 갭·frontend 미소비·MDX 오기·`ParseUUIDPipe`·glob 갭) = 신규 6 — 정확히 일치. 이 자리는
  결함이 아니다.
- **`ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto` 의 JSDoc vs `//` 분리** —
  `swagger.md §3`("JSDoc 은 공개 OpenAPI 로 나간다")과 대조해 `/** */` 는 소비자용 설명만,
  내부 서사(리뷰 인용·경위)는 전부 `//` 에 있음을 재확인. 라운드 2 CRITICAL(orphan 주석)·
  라운드 4 WARNING(bare 인용)이 되풀이되지 않았다.
- **`dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 파일 위치·이름** —
  `swagger.md §5-1`("`dto/responses/*-response.dto.ts`")과 정확히 일치. 파일 헤더 `//` 가 이
  판단을 뒤집은 경위(글롭이 `/` 를 안 넘는다는 첫 판단 → 규약 우선으로 재수정)를 실측과 함께
  남겨 다음 응답 DTO 가 같은 실수를 반복하지 않게 한다.
- **`chat-channel-rejection-messages.const.ts`·`dto/chat-channel-config.dto.ts` 의 stale
  `TriggersService` 귀속 주석 정정** — `#1319`(T2, `ChatChannelBinderService` 분리) 이후 실제
  구조(module-level 함수, 서비스는 호출만)와 정확히 일치하도록 갱신됐다. 코드(`git blame`
  으로 확인 가능한 실제 함수 위치)와 주석이 지금 시점에 합치한다.
- **README/CHANGELOG** — 이 배치는 응답 형태·API 표면을 바꾸지 않는 순수 리팩터 + additive
  swagger 문서화(6라운드에 걸쳐 반복 확인된 결론)이므로 해당 없음. `CHANGELOG.md` 는 실제
  breaking-change 항목("502 최초 사용" 등)만 담는 문서라 이 PR 의 스코프 밖.
- **새 환경변수·설정 옵션** — 없음.
- **plan 문서 자체의 서사적 정확성** — "왜 세 번째 인자를 안 두나" · "왜 개명이 아니라 합치지
  않았나" · "정지 규칙 보정" 등 설계 판단은 모두 실측(뮤테이션 RED/GREEN, `tsc --noEmit` 진단
  불변 등)과 함께 남아 있어 근거 없는 주장이 아니다.

## 요약

이 라운드가 새로 다루는 diff(마지막 plan 커밋 `1e1d484c2`)는 `codebase/**` 를 건드리지 않고
plan 두 파일만 갱신한다. 트래커(`spec-draft-nullable-notation-followups.md`) 쪽 "종결
4·신규 6" 표기는 diff 와 정확히 일치함을 확인했으나, `chat-channel-rules-cleanup.md` 자체의
뮤테이션 개수 표기가 **체크리스트("9종") vs 증거 문단·실측 기록 소제목("6종"/"여섯") 두 곳**
사이에서 갈린다 — 표는 실제로 9행인데 그 표의 제목이 "6종"이라 말한다. 이 불일치는 라운드 2가
동일한 종류의 모순을 이미 한 번 잡아 "세 자리를 함께 고쳤다"고 기록한 바로 그 세 자리에서, 이번
마지막 커밋이 한 곳만 갱신하고 나머지 둘을 갱신하지 않아 재발한 것이며, 어떤 이전 리뷰 라운드도
이 커밋을 보지 못했으므로 새로 보고한다. `plan/complete/` 로 봉인된 이력 문서라 코드 동작에는
영향이 없지만, 이 배치의 뮤테이션 커버리지를 근거로 삼을 다음 사람에게 잘못된 숫자를 준다.
그 외에는 6라운드에 걸쳐 이미 정리된 문서화 품질(JSDoc/`//` 분리, 응답 DTO 위치 규약, stale
귀속 주석 정정, 인용 체인 정확성)이 이번 최종 커밋에서도 그대로 유지됐다.

## 위험도

LOW
