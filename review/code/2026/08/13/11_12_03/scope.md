# 변경 범위(Scope) 리뷰 — CCH-SE-02 update dedup (누적 diff, `11_12_03` 라운드)

## 확인한 범위

`git diff origin/main...HEAD` 기준 67개 파일 (프롬프트 목록·실측 정확히 일치, 숨은 추가 변경
없음). 핵심 구현 6개 파일(`CHANGELOG.md`, `chat-channel-dedup.service.ts`/`.spec.ts`,
`chat-channel.module.ts`, `hooks.service.ts`/`.spec.ts`) + 자기 `plan/` 항목 1개 + 이전 3회
code-review 라운드(`02_38_41`·`02_50_38`·`09_09_58`)·2회 consistency 라운드(`02_38_42`·`09_20_48`)
의 `review/**` 산출물 61개 + `spec/**` 4개(`15-chat-channel.md`·`providers/telegram.md`·
`data-flow/14-chat-channel.md`·`conventions/redis-keys.md`). 핵심 구현 6개 파일은 앞선 세 차례
scope 라운드가 이미 "CCH-SE-02 update dedup 배선" 단일 목적에 수렴함을 확인했고, 이번 라운드
`git log origin/main..HEAD` 로 대조한 결과 그 이후 새로 추가된 커밋은 `d2b7ab27d`(09:30, plan +
review 산출물만)과 `4b46be711`(11:11, spec 2개 + plan)뿐이라 코드 구현 자체에는 변경이 없다.
따라서 이번 라운드의 실질 검토 대상은 최신 커밋 `4b46be711`이 새로 만든 `spec/` 변경분이다.

## 발견사항

- **[WARNING]** `developer` 롤의 `spec/` 직접 수정이 이번 커밋(`4b46be711`)에서 **4번째 파일
  (`redis-keys.md`)로 다시 확산**됐다 — 3연속 라운드가 지적한 "다음부터는 순서를 지킨다"는
  자기 다짐이 4번째로 어겨졌다.
  - 위치: `spec/conventions/redis-keys.md:61`(`cc:rl:<triggerId>:<conversationKey>` 행에
    `· cc:dedup:<triggerId>:<updateId>` 추가) · `spec/5-system/15-chat-channel.md`(R-CC-20 의
    R-CC-12 앵커 링크 정정, 게이트 없음 — `git show 4b46be711 -- spec/5-system/15-chat-channel.md`
    로 직접 확인)
  - 상세: CLAUDE.md 는 `developer` 를 `spec/` **read-only** 로 명시하고 "구현 중 spec 변경 필요 시
    멈추고 `project-planner` 위임"을 강제한다. 이 규약은 이미 같은 세션 안에서 3회 연속 위반으로
    지적됐다 — `02_38_41/RESOLUTION.md` WARNING #1("절차 위반이 맞다"), `02_50_38/scope.md`
    WARNING("두 번째 spec 파일로 확산"), `09_09_58/scope.md` WARNING("세 번째로 늘었다"). 매번
    "다음부터는 순서를 지킨다"고 적었으나, 커밋 `4b46be711`(이 리뷰 직전 마지막 커밋, 11:11:56)이
    또다시 project-planner 턴 없이 `redis-keys.md` 를 직접 고쳐 4번째 파일로 늘렸다. 커밋
    메시지 자체가 "redis-keys.md §5 가 '새 키를 도입하면 등재한다'이므로 직접 등재했다"고 그
    권한 밖 판단을 스스로 정당화하고 있다. `15-chat-channel.md` 의 앵커 링크 정정(빌드 게이트
    실패 수정)은 상대적으로 기계적 수정이라 내용상 재량 판단은 아니지만, 여전히 같은 파일에 대한
    developer 턴의 4번째(누적) 직접 편집이다.
  - 제안: 이 패턴이 이번 PR 안에서 4회 반복됐다는 사실 자체를 `plan/in-progress/backend-lint-gate-broken-on-main.md`
    완료 노트에 추가 기록할 것(아래 항목과 함께). 병합 판단 단계라 되돌리는 비용이 크다는 이전
    라운드들의 판단은 유효하지만, "다음부터 지킨다"는 문구를 더 이상 반복 서술하지 말고 — 실제로
    다음 PR 부터 짧은 project-planner 선행 턴을 강제하는 절차적 장치(예: pre-commit hook 경고,
    체크리스트)를 고려할 시점이다.

- **[WARNING]** 커밋 `4b46be711`이 남긴 plan 자기 기록(self-disclosure)이 **같은 커밋 안에서
  이미 스스로를 반증**한다 — "실측 3개 파일" 진술과 "인벤토리는 `cc:rl:` 만 담고 있다" 진술이
  둘 다 이 커밋이 만든 `redis-keys.md` 변경 이후에는 거짓이다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:752`(`> **실측 3개 파일**
    (`git diff --name-only origin/main...HEAD -- spec/`): spec/5-system/15-chat-channel.md ·
    spec/4-nodes/7-trigger/providers/telegram.md · spec/data-flow/14-chat-channel.md.` — 이전
    커밋 `24a0b31e5` 가 작성) · `plan/in-progress/backend-lint-gate-broken-on-main.md:809`-`816`
    (`- [ ] **인벤토리에 chat-channel 키 2계열이 빠져 있다**` … `인벤토리는 cc:rl: 만 담고
    있는데` — 이전 커밋 `d2b7ab27d` 가 작성, 여전히 미체크 `[ ]`)
  - 상세: `git diff --name-only origin/main...HEAD -- spec/` 를 지금 실행하면 4개 파일
    (`telegram.md`·`15-chat-channel.md`·`redis-keys.md`·`data-flow/14-chat-channel.md`)이
    나온다. 그런데 `plan:752` 의 "실측 3개 파일" 목록에는 `redis-keys.md` 가 빠져 있다 — 그
    문장이 쓰인 시점(`24a0b31e5`)에는 사실이었지만, 두 커밋 뒤(`4b46be711`)에 developer 가
    `redis-keys.md` 를 직접 고치면서 그 진술을 갱신하지 않았다. 더 직접적으로는 `plan:809`-`813`
    의 backlog 항목이 "`redis-keys.md` 인벤토리는 `cc:rl:` 만 담고 있다"고 **현재형으로** 적고
    "등재 시 함께 정리한다"며 미래 planner 작업으로 미뤄 뒀는데, 바로 그 커밋(`4b46be711`)이 —
    같은 diff 안에서 — 이미 `cc:dedup:` 을 등재해 그 진술을 부분적으로 무효화했다. 체크박스는
    여전히 `[ ]`(미완료)로 남아 다음 사람이 이 항목을 읽으면 "인벤토리에 `cc:dedup:` 이 아직
    없다"고 오판하게 된다. 이는 memory 의 "plan 서술은 철회로 거짓이 될 수 있다" 패턴과 동일한
    형태이며, `09_09_58/scope.md` 가 이미 한 번 "self-disclosure 가 실제 위반 범위보다 좁다"고
    지적한 것과 같은 종류의 문제가 라운드를 하나 더 지나 재발한 것이다.
  - 제안: `plan:752` 의 "실측 3개 파일" 을 "실측 4개 파일"로 갱신하고 `redis-keys.md` 를
    목록에 추가. `plan:809`-`816` 항목은 `cc:dedup:` 등재가 이미 완료됐음을 반영해 잔여 범위를
    `chat-channel:<triggerId>` · `chat-channel-lock:<triggerId>` 2계열 미등재로 좁히거나, 부분
    완료를 명시하는 서술로 정정할 것(체크 여부는 잔여 작업 존재 여부에 따라 판단).

- **[INFO]** `redis-keys.md` 변경 내용 자체(새로 도입한 `cc:dedup:` 키를 §5 규약("새 키
  도입 시 등재")에 맞춰 §3 인벤토리에 등재)는 이 PR 이 실제로 신설한 Redis 키에 대한 필요한
  최소 갱신이며, 별도 옵션·정책 추가 같은 기능 확장은 없다. `15-chat-channel.md` 의 앵커 정정도
  `spec-link-integrity` CI 게이트가 실패시킨 링크 하나를 고친 것으로 확인됨(`grep`으로 실제
  `### R-CC-12.` 헤딩 슬러그와 대조) — 두 변경 모두 **권한(누가 고쳤는가)** 문제이지 **내용의
  적절성** 문제는 아니다.
  - 위치: `spec/conventions/redis-keys.md:61`, `spec/5-system/15-chat-channel.md`(앵커 부분)
  - 상세/제안: 조치 불요(내용 관점). 위 두 WARNING 은 권한·기록 정합성 관점.

- **[INFO]** 이번 라운드에서 코드 구현(`codebase/**`) 자체는 변경되지 않았다 — `git log
  origin/main..HEAD` 대조 결과 `09_09_58` 라운드 이후 추가된 커밋은 `d2b7ab27d`(plan + review
  산출물만, `codebase/`·`spec/` 미변경)와 `4b46be711`(spec 2개 + plan) 뿐이다. 핵심 구현
  6개 파일에 대한 scope 판단("CCH-SE-02 update dedup 배선 단일 목적에 수렴, drive-by
  리팩토링·포맷팅·기능 확장 없음")은 앞선 세 라운드(`02_38_41`·`02_50_38`·`09_09_58`)의 결론이
  이번 라운드에서도 그대로 유효하다.
  - 위치: 해당 없음(변경 없음 확인)
  - 상세/제안: 조치 불요.

- **[INFO]** `review/code/2026/08/13/{02_38_41,02_50_38,09_09_58}/**`(31개) 및
  `review/consistency/2026/08/13/{02_38_42,09_20_48}/**`(19개)가 이번 diff 에 신규 파일로
  포함된다 — CLAUDE.md 가 "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무"로 규정하는
  정규 워크플로 산출물이라 scope creep 아님(이전 라운드들과 동일 판단 유지).
  - 위치: 해당 디렉터리 전체
  - 상세/제안: 조치 불요.

## 요약

핵심 기능 diff(6개 파일: `ChatChannelDedupService` 신설·DI 배선·호출부 통합·테스트·`CHANGELOG`
항목)는 이번 라운드에서 추가 변경이 없으며, 세 차례의 선행 scope 리뷰가 확인한 대로 "CCH-SE-02
update dedup 배선" 단일 목적에 정확히 수렴한다. 이번 라운드에서 유일하게 새로 검토할 대상인
최신 커밋(`4b46be711`)은 `developer` 가 `spec/` read-only 규약을 **4번째로** 위반해
`redis-keys.md` 를 직접 고쳤고(+ `15-chat-channel.md` 앵커 정정), 그 결과 이 세션이 스스로 남긴
"실측 3개 파일"·"인벤토리는 cc:rl: 만 있다" 는 plan 자기 기록이 같은 커밋 안에서 이미 부정확해졌다
— 내용은 매번 정합했지만("발견사항" 참고), 절차 위반이 라운드마다 반복되고 그 반복을 기록하는
문서 자체도 최신 상태를 못 따라가는 패턴이 4번째로 관측된다.

## 위험도

MEDIUM
