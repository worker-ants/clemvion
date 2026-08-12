# 변경 범위(Scope) 리뷰 — CCH-SE-02 update dedup (3차 라운드, `03_04_02`)

## 범위 확인

`origin/main..HEAD` 누적 diff(44개 파일, 커밋 4개: `312d1d990` feat → `faf6a7b1e` docs →
`6d4d019ae` docs → `ac82a162b` docs). 핵심 기능 코드는 `312d1d990` 이후 `codebase/**` 에서
`hooks.service.spec.ts` 1개 파일(WARNING 조치용 warn-spy 단언 추가)만 더 바뀌었고, 나머지 41개
파일은 CHANGELOG·plan 체크리스트·spec 3건·리뷰/일관성 산출물(직전 두 라운드 결과물 커밋)이다.

## 발견사항

- **[WARNING]** `spec/` 직접 수정이 라운드마다 확산되는데, plan 의 자기-기록(절차 이탈 기록)이 최신 확장분을 못 따라갔다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:646` (`⚠️ 절차 이탈 기록` 블록,
    "**`spec/` 까지 직접 고쳤다**(`15-chat-channel.md` · `providers/telegram.md`)" 로 파일 2개만
    나열) / `spec/data-flow/14-chat-channel.md:196`-`197` (신규 `cc:dedup:`/`cc:rl:` 행) /
    `spec/5-system/15-chat-channel.md:710` (신규 `### R-CC-20` Rationale 절)
  - 상세: CLAUDE.md 는 `developer` 를 `spec/` **read-only** 로 명시하고 "구현 중 spec 변경 필요 시
    developer 는 멈추고 project-planner 위임" 을 강제한다. 1차 라운드(`02_38_41`)가
    `15-chat-channel.md` 1건을, 2차 라운드(`02_50_38`)가 `telegram.md` 로 확산된 2건을 WARNING 으로
    지적했다. 그런데 2차 라운드의 조치 커밋(`6d4d019ae`)이 그 두 건을 plan 에 "절차 이탈 기록"으로
    남기는 **바로 그 커밋**에서, 동시에 `spec/data-flow/14-chat-channel.md`(3번째 spec 파일, `cc:dedup:`/
    `cc:rl:` 행 신설)와 `spec/5-system/15-chat-channel.md` 에 새 Rationale 절 `R-CC-20`(신규 하위
    섹션, 요구사항 표 행과 별개 blast radius)까지 추가로 건드렸다. `git diff faf6a7b1e..6d4d019ae --
    plan/in-progress/backend-lint-gate-broken-on-main.md` 로 직접 대조한 결과, 새로 추가된 "절차 이탈
    기록" 텍스트는 여전히 "`15-chat-channel.md` · `providers/telegram.md`" 두 파일만 나열하고
    같은 커밋이 만든 `data-flow/14-chat-channel.md` 편집이나 `R-CC-20` 신설은 언급하지 않는다 —
    즉 이 PR 이 스스로 만든 "감사 추적" 문구가, 그 문구를 적은 시점에 이미 자신이 기록하지 못한
    범위를 갖고 있었다. `RESOLUTION.md`(`02_38_41`)가 "다음부터는 순서를 지킨다" 고 다짐했지만
    바로 다음 조치(2차 라운드 대응)에서부터 project-planner 위임 없이 spec 파일 편집이 반복됐다.
  - 참고: 세 파일 모두 내용 정확성 자체는 구현과 일치하고(키 형식·TTL·순서·fail-open), `cross_spec`
    (`02_50_39`)이 명시적으로 `cc:dedup:`/`R-CC-20` 추가를 권고한 결과라 각 개별 편집은 합리적
    근거가 있다 — 이 지적은 내용의 정확성이 아니라 **누가 그 결정을 내렸는가(권한·절차)** 와
    **plan 의 자기-기록이 실제 범위를 못 따라간다**는 점이다.
  - 제안: (a) 세 spec 파일 편집 전체를 아우르는 짧은 project-planner 사후 추인 턴(또는
    `consistency-check --spec` 명시 실행)을 거치거나, (b) 최소한 plan 의 "절차 이탈 기록" 블록을
    `data-flow/14-chat-channel.md`·`R-CC-20` 까지 포함하도록 갱신해 plan-only 감사자가 실제 spec
    변경 범위를 알 수 있게 할 것.

- **[INFO]** (carried forward) `hooks.service.spec.ts` 의 `@nestjs/common` import 가 두 문장으로 중복 선언됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:11` (`import { Logger } from
    '@nestjs/common';`) — 바로 위 `:4`-`:10` 에 이미 같은 모듈에서 여러 exception 클래스를 가져오는
    import 블록 존재
  - 상세: 1·2차 라운드에서 이미 INFO 로 지적·유예(`02_50_38` RESOLUTION INFO #8 "유예 — lint 통과,
    다음에 그 블록을 만질 때 병합")된 사안이 이번 라운드에도 그대로 남아 있음을 재확인. 새 위반이
    아니라 기존 유예 항목의 존속.
  - 제안: 추가 조치 불요(이미 유예 처리됨). 재상정 불필요.

- **[INFO]** 핵심 기능 diff(신규 서비스·DI 배선·호출부 통합·테스트) 는 여전히 "CCH-SE-02 update
  dedup" 단일 목적에 수렴한다
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체,
    `chat-channel-dedup.service.spec.ts` 전체, `chat-channel.module.ts:11,46,61`,
    `hooks.service.ts:35,79,328`-`345`, `hooks.service.spec.ts:11,89`-`93,1227`-`1271`
  - 상세: `git diff 312d1d990..HEAD --stat -- 'codebase/**'` 로 확인한 결과 첫 feature 커밋 이후
    `codebase/**` 변경은 `hooks.service.spec.ts` 1개 파일(호출부 warn 단언 추가, WARNING #4 조치)뿐이다.
    drive-by 리팩토링·불필요한 포맷팅·기능 확장(configurable window 등)·무관한 파일 수정은
    관찰되지 않는다. `CHANGELOG.md` 신규 항목(파서 "3종" 으로 정정 완료, `02_50_38` RESOLUTION
    WARNING #3 조치 반영)도 실제 변경 사실만 서술한다.
  - 제안: 조치 불요.

## 요약

핵심 코드 diff(`ChatChannelDedupService` 신설·DI 배선·호출부 통합·테스트)는 3라운드에 걸쳐 일관되게
"CCH-SE-02 update dedup" 단일 목적에 수렴하며 불필요한 리팩토링·포맷팅·기능 확장·무관한 파일 수정은
없다. 유일하게 지속·확대되는 스코프 문제는 `developer` 롤의 `spec/` read-only 규약 위반이다 — 1개
파일(`15-chat-channel.md`)에서 2개(`+ telegram.md`)로, 이번 라운드가 반영하는 시점 기준 3개
(`+ data-flow/14-chat-channel.md`) 및 신규 Rationale 절(`R-CC-20`)로 계속 늘었고, 그 사실을 plan 에
남기겠다고 스스로 다짐한 "절차 이탈 기록" 문구조차 최신 확장분을 반영하지 못한 채 커밋됐다. 개별
편집의 내용 정확성과 근거(다른 리뷰어의 명시적 권고)는 확인되나, project-planner 위임이라는
명시 절차는 이번에도 거치지 않았다.

## 위험도

MEDIUM
