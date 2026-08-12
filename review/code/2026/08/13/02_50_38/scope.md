# 변경 범위(Scope) 리뷰 — CCH-SE-02 update dedup (2차 라운드, `02_50_38`)

## 발견사항

- **[WARNING]** `spec/` 직접 수정이 developer 역할 경계를 벗어났고, 이번 라운드에서 **두 번째 spec 파일로 확산**됐다.
  - 위치: `spec/5-system/15-chat-channel.md:88` (CCH-SE-02 행 재작성), `spec/4-nodes/7-trigger/providers/telegram.md:235`-`236` (§8 비기능 항목을 "미구현(Planned)"→"구현됨"으로 재작성 + 인용구 추가)
  - 상세: CLAUDE.md 는 `developer` 를 `spec/` **read-only** 로 명시하고 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 을 강제한다. 1차 리뷰(`02_38_41/scope.md`)가 이미 `15-chat-channel.md` 수정을 WARNING 으로 지적했고, 같은 세션의 `RESOLUTION.md` 가 "절차 위반이 맞다" 고 인정하면서도 되돌리지 않았다. 그런데 이번 2차 라운드 diff 는 **같은 종류의 위반을 `telegram.md` 에도 반복**한다 — 이 파일 수정은 1차 리뷰가 아니라 1차 리뷰의 `documentation.md` WARNING #2 를 처리하는 과정에서 developer 턴이 직접 만든 것이다(`RESOLUTION.md` "WARNING #2 (documentation) … → 조치" 절에서 자인). 즉 project-planner 위임 없이 spec 파일을 고치는 패턴이 한 파일에서 두 파일로 늘었다. `RESOLUTION.md` WARNING #1 의 "다음부터는 순서를 지킨다" 라는 다짐이 정확히 같은 PR 의 다음 조치(WARNING #2 처리)에서부터 지켜지지 않았다.
  - 참고로 내용 정확성 자체는 두 파일 모두 구현과 일치하고(키 형식·TTL·fail-open), `telegram.md` 는 옛 문구가 "정확했다" 는 점까지 스스로 밝히는 등 결과물의 품질은 높다 — 이 지적은 **정확성이 아니라 권한·절차 범위**에 대한 것이다.
  - 제안: 두 spec 파일의 문면 정정이 project-planner 턴을 거쳤는지(또는 사후 `consistency-check --spec` 승인을 받았는지) 확인. 아니라면 developer 가 spec 을 직접 고치는 관행이 이 PR 안에서마저 확산되고 있다는 신호이므로, 최소한 커밋 메시지/PR 설명에 "spec 정정 2건, planner 승인 근거" 를 명시해 감사 추적을 남길 것.

- **[INFO]** `hooks.service.spec.ts` 에 `@nestjs/common` 을 소스로 하는 import 문이 두 줄로 중복 선언됐다.
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.spec.ts:11` (`import { Logger } from '@nestjs/common';`) — 바로 위 `:4`-`:10` 에 이미 같은 모듈에서 `BadRequestException`/`ConflictException`/`GoneException`/`NotFoundException`/`UnauthorizedException` 을 가져오는 import 블록이 존재
  - 상세: `Logger` 는 실제로 WARNING #4 조치(호출부 warn spy)에 쓰이므로 "사용하지 않는 import 추가"는 아니다. 다만 기존 블록에 병합하지 않고 별도 import 문을 새로 추가한 점은 스타일상 불필요한 중복이다. 이 저장소의 backend eslint 설정(`eslint.config.mjs`)에는 `import/no-duplicates` 류 규칙이 없어 lint 는 통과하지만(`RESOLUTION.md` 의 "eslint 0/0" 과 일치), 최소 변경 원칙에서 보면 기존 블록에 `Logger` 한 항목을 추가하는 편이 diff 노이즈가 더 작았다.
  - 제안: 급하지 않음. 다음에 이 import 블록을 만질 때 하나로 병합.

- **[INFO]** 1차 리뷰 세션(`review/code/2026/08/13/02_38_41/`)의 산출물 12개(`SUMMARY.md`, `RESOLUTION.md`, `meta.json`, `_retry_state.json`, 8개 reviewer `.md`)가 이번 diff 에 신규 파일로 함께 커밋된다.
  - 위치: `review/code/2026/08/13/02_38_41/*` 전체 (예시 gate: `_retry_state.json:8` `"routing_status": "pending"`)
  - 상세: CLAUDE.md 상 `review/code/**` 쓰기는 code-review-agents 의 정규 산출물이고, "구현 완료 후 자동 review/fix" 는 상시 승인된 강제 워크플로이므로 이 파일들 자체가 이번 작업(CCH-SE-02 구현)과 무관한 파일이라고 보기는 어렵다 — 다만 `_retry_state.json` 은 `routing_status: "pending"`, `agents_success: []`, `agents_fatal: []` 로 **오케스트레이션 시작 시점의 스냅샷**을 그대로 담고 있어, 실제로는 전 reviewer 가 성공 완료한 뒤에 커밋됐음에도 파일 내용은 "미완료" 상태를 영구 기록한다. 코드 스코프 위반은 아니지만, 이 상태 파일이 다른 산출물(`SUMMARY.md` 등 최종 결과)과 함께 "완료 기록"인 것처럼 커밋되는 것은 다소 오해의 소지가 있다.
  - 제안: 조치 불요(과거 세션에도 동일 패턴 존재로 추정). 참고 기록.

- **[INFO]** 핵심 기능 diff(서비스 신설·DI 배선·호출부 통합·테스트, `chat-channel-dedup.service.ts`/`.spec.ts`/`chat-channel.module.ts`/`hooks.service.ts`/`hooks.service.spec.ts`) 는 "CCH-SE-02 update dedup" 단일 목적과 `plan/in-progress/backend-lint-gate-broken-on-main.md` 완료 서술에 정확히 수렴한다. drive-by 리팩토링·불필요한 포맷팅·기능 확장(예: configurable window, 별도 옵션)·무관한 import 정리는 관찰되지 않는다. `CHANGELOG.md` 신규 항목도 실제 변경 사실(증상·원인·영향·메커니즘)만 서술하며 범위를 벗어나지 않는다.
  - 위치: 해당 6개 코드 파일 + `CHANGELOG.md:3`-`22`
  - 상세/제안: 조치 불요.

## 요약

핵심 기능 diff(신규 `ChatChannelDedupService`·DI 배선·호출부 통합·테스트·CHANGELOG 항목)는 "CCH-SE-02 update dedup 배선"이라는 단일 목적에 정확히 수렴하며 불필요한 리팩토링·포맷팅·기능 확장은 없다. 다만 가장 중요한 스코프 문제는 여전히 미해결이다 — `developer` 는 `spec/` read-only 라는 CLAUDE.md 명시 규약을 이번 라운드에서도 어겼고, 1차 리뷰가 지적한 위반(`15-chat-channel.md`)을 되돌리지 않은 채 같은 PR 안에서 `telegram.md` 로 위반을 한 파일 더 확장했다. `RESOLUTION.md` 가 사유를 밝히며 인정은 하지만, project-planner 위임 절차 자체는 이번에도 거치지 않았다. 이 외에는 사소한 import 중복(INFO)과 1차 리뷰 세션 산출물의 "pending" 상태 스냅샷 커밋(INFO) 정도만 있다.

## 위험도

MEDIUM
