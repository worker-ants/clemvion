# 변경 범위(Scope) 리뷰 — CCH-SE-02 update dedup (누적 diff, `09_09_58` 라운드)

## 확인한 범위

`git diff $(git merge-base HEAD origin/main)` 기준 44개 파일. 핵심 구현 6개 파일(`CHANGELOG.md`,
`chat-channel-dedup.service.ts`/`.spec.ts`, `chat-channel.module.ts`, `hooks.service.ts`/`.spec.ts`)
+ 자기 `plan/` 항목 1개 + 이전 두 리뷰 라운드(`02_38_41`, `02_50_38`)의 `review/code/**` 산출물
19개 + `--impl-done` consistency 라운드(`02_38_42`, `02_50_39`)의 `review/consistency/**` 산출물
9개 + `spec/**` 3개(`15-chat-channel.md`, `providers/telegram.md`, `data-flow/14-chat-channel.md`).
프롬프트 파일 목록과 `git diff --stat` 실측이 정확히 일치함을 확인했다(숨은 추가 변경 없음).

## 발견사항

- **[WARNING]** `developer` 롤이 `spec/` 를 3개 파일 직접 수정 — CLAUDE.md 의 "`developer` 는
  `spec/` read-only, 구현 중 spec 변경 필요 시 멈추고 `project-planner` 위임" 규약 위반이 이번
  라운드에서도 해소되지 않았고, 오히려 대상 파일이 한 개 더 늘었다.
  - 위치: `spec/5-system/15-chat-channel.md:88`(CCH-SE-02 표 행 재작성) · `spec/5-system/15-chat-channel.md:710`(신규 `### R-CC-20` Rationale 절) · `spec/4-nodes/7-trigger/providers/telegram.md`(§8 "미구현" → "구현됨" 정정, 프롬프트 게이트 235-236) · `spec/data-flow/14-chat-channel.md`(프롬프트 게이트 196, `cc:dedup:` Redis 키 표 행 신규 추가)
  - 상세: `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 완료 노트와 `review/code/2026/08/13/02_38_41/RESOLUTION.md` WARNING #1 은 절차 위반을 스스로 인정하고 "다음부터는 순서를 지킨다"고 적었다. 그런데 바로 다음 라운드(`02_50_38`)에서 같은 세션이 또 `providers/telegram.md` 를 spec-read-only 원칙을 어기며 직접 고쳤고(`02_50_38/RESOLUTION.md` WARNING #1 이 "확산" 이라 자인), 이번 최종 라운드에서는 `spec/data-flow/14-chat-channel.md` 까지 세 번째로 늘었다(`02_50_39` cross_spec WARNING #2 지적에 대한 대응). 즉 "다음부터 순서를 지킨다"는 약속이 같은 PR 안에서 두 번 더 어겨진 패턴이다. 내용 자체는 매 건 검증됐다 — 기존 `필수` 요구사항의 메커니즘 서술 정정/미러 동기화이지 새 요구사항 도입이 아니며, `--impl-done` consistency 가 BLOCK:NO 로 확인했다. 다만 이 리뷰는 **범위(scope)** 관점이므로 "내용이 옳다"와 "권한 밖 롤이 직접 썼다"는 별개다.
  - 제안: 이번 PR 은 이미 병합 판단 단계라 되돌리는 비용이 더 크므로 내용을 되돌릴 필요는 없다(선행 두 라운드의 판단과 동일). 다만 다음 세션에서는 실제로 짧은 `project-planner` 턴을 분리해 사후 추인을 받거나, 최소한 "이 패턴이 3회 반복됐다"는 사실 자체를 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트에 추가해 규약이 실질적으로 유명무실화되지 않도록 기록할 것.

- **[INFO]** 위 WARNING 의 자기 기록(self-disclosure)이 실제 위반 범위보다 좁다 — `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트는 "**`spec/` 까지 직접 고쳤다**(`15-chat-channel.md` · `providers/telegram.md`)" 라고만 적어 spec 파일을 2개로 센다. 실제로는 `spec/data-flow/14-chat-channel.md` 까지 3개가 이번 PR 에서 developer 턴 중 직접 수정됐다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md`(완료 노트, 프롬프트 게이트 708-709 부근 문구) / `spec/data-flow/14-chat-channel.md`(프롬프트 게이트 196-197, 신규 두 행)
  - 상세: 은폐는 아니다 — `review/code/2026/08/13/02_50_38/RESOLUTION.md` 검증 절 마지막 줄("data-flow 미러 · … 같은 커밋에서 조치")에 사실 자체는 남아 있다. 다만 정확히 "절차 이탈" 이라고 못박은 plan 문구의 파일 카운트가 실측과 어긋나 있어, 이 항목만 읽는 다음 사람은 위반 범위를 과소평가할 수 있다.
  - 제안: `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 노트의 "(`15-chat-channel.md` · `providers/telegram.md`)" 목록에 `data-flow/14-chat-channel.md` 를 추가한다.

- **[INFO]** 핵심 구현 diff(6개 파일)는 "CCH-SE-02 update dedup 배선" 이라는 단일 목적에 정확히 수렴한다 — 신규 서비스(`chat-channel-dedup.service.ts`) + 단위 테스트 + DI 등록(`chat-channel.module.ts`) + 호출부 배선/테스트(`hooks.service.ts`/`.spec.ts`) + `CHANGELOG.md` 항목. `git diff`(`f59e2343d..HEAD`) 로 직접 대조해 drive-by 리팩토링·불필요한 포맷팅·요청 이상의 기능 확장(예: configurable window, 별도 옵션)·무관한 파일 수정을 발견하지 못했다.
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` 전체(신규 76줄), `chat-channel-dedup.service.spec.ts` 전체(신규 93줄), `chat-channel.module.ts:11,46,61`, `hooks.service.ts:35,79,328-345`, `hooks.service.spec.ts:11,22,89-93,1227-1271`
  - 상세/제안: 조치 불요.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md`(700줄대 파일) 변경분은 CCH-SE-02 체크박스 1개(`- [ ]` → `- [x]`)와 그 항목 바로 아래의 완료 노트 삽입뿐이다 — `git diff` 로 직접 대조해 파일의 다른 섹션은 건드리지 않았음을 확인했다. 자기 작업 plan 갱신은 developer 쓰기 권한 범위 안이라 스코프 문제 없음.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md`(프롬프트 게이트 681, 693-719)
  - 상세/제안: 조치 불요.

- **[INFO]** `review/code/2026/08/13/{02_38_41,02_50_38}/**`(19개 파일) 및 `review/consistency/2026/08/13/{02_38_42,02_50_39}/**`(9개 파일)가 이번 diff 에 신규 파일로 함께 포함된다.
  - 위치: 해당 디렉터리 전체
  - 상세: CLAUDE.md 는 "코드 리뷰 산출물 → `review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`", "일관성 검토 산출물 → `review/consistency/...`" 를 정식 저장 위치로 명시하고, "구현 완료 후 자동 review/fix 는 상시 승인된 강제 의무" 라고 규정한다. 이 파일들은 이번 작업(CCH-SE-02)에 대한 정규 워크플로 산출물이지 무관한 파일이 아니다 — scope creep 아님.
  - 제안: 조치 불요.

- **[INFO]** `hooks.service.spec.ts` 에 `import { Logger } from '@nestjs/common';` 을 기존 `@nestjs/common` import 블록(별도 `BadRequestException`/`ConflictException`/... 목록)에 병합하지 않고 새 줄로 추가했다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:11`(신규 줄, 프롬프트 게이트 그대로 일치) — 바로 위 4-10줄에 이미 같은 모듈 import 블록 존재
  - 상세: 사용하지 않는 import 는 아니다(WARNING #4 조치의 `Logger.prototype.warn` spy 에 실제 사용). 다만 최소 변경 원칙에서 보면 기존 블록에 병합하는 편이 diff 노이즈가 작았다. 이미 `review/code/2026/08/13/02_50_38/RESOLUTION.md` INFO #8 로 "lint 통과, 다음에 그 블록을 만질 때 병합" 사유와 함께 유예 처분됨을 확인했다 — 이번 라운드에서 새로 발견한 사안이 아니라 기존 처분을 재확인한 것이다.
  - 제안: 급하지 않음(이미 유예 처분과 일치).

## 요약

핵심 기능 diff(신규 `ChatChannelDedupService`·DI 배선·호출부 통합·테스트·`CHANGELOG` 항목·자기 plan 체크박스)는 "CCH-SE-02 update dedup 배선" 이라는 단일 목적에 빈틈없이 수렴하며, drive-by 리팩토링·불필요한 포맷팅·요청 이상의 기능 확장·무관한 파일 수정은 관찰되지 않았다. `review/code/**`·`review/consistency/**` 산출물이 함께 커밋되는 것도 이 프로젝트가 명시적으로 강제하는 리뷰 워크플로의 정규 산출물이라 스코프 이탈이 아니다. 유일하지만 반복되는 실질 스코프 문제는 `developer` 턴이 `spec/`(read-only 규약 대상)를 직접 세 번(`15-chat-channel.md`→`providers/telegram.md`→`data-flow/14-chat-channel.md`) 고쳤다는 점이다 — 내용은 매번 검증됐고 `--impl-done` consistency 가 BLOCK:NO 로 확인했지만, "다음부터 순서를 지킨다"는 이전 두 라운드의 자기 다짐이 같은 PR 안에서 두 번 더 어겨진 패턴 자체가 이 리뷰의 핵심 지적이다. 부수적으로 plan 의 절차 이탈 기록이 실제 spec 파일 수(3개)보다 적게(2개) 적혀 있어 완전하지 않다.

## 위험도

MEDIUM
