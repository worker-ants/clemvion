STATUS=success scope review complete — 64 files (30 code/config + 34 review/plan artifacts), 0 critical, 0 warning, 2 info
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — eslint 9→10 상향 (round 2, `12_28_11`)

`git log origin/main..HEAD`: `beed5143e`(본 상향) → `0f3b3e0c3`/`9bcbb7fa5`/`3a540aa81`(직전
`/ai-review` SUMMARY #1~#5 조치) → `214af6d0e`(리뷰 산출물 등재 + dangling 참조 정정) →
`bb278116e`(plan 게이트 이행 기록). `git diff origin/main...HEAD --stat` = 64 files,
+2501/-375 로 프롬프트의 파일 목록과 일치함을 확인했다. 직전 라운드(`review/code/2026/08/28/11_45_02/scope.md`)가 이미 동일 스코프 질문을 다뤘고(INFO 3건, CRITICAL/WARNING 0), 본 라운드는 그 이후 추가된 5개 커밋(REST fix + 산출물 커밋 + plan 갱신)까지 포함해 재확인했다.

## 발견사항

- **[INFO]** 코드 실질 변경 12개 파일이 순수 config/lockfile 이 아니라 업무 로직 파일이다
  — 그러나 전부 **eslint 10 recommended 신규 룰의 강제 수반 수정**으로, plan 문서에 사전
  명시돼 있다
  - 위치: `codebase/backend/src/common/utils/ssrf-safe-url.util.ts:156`,
    `codebase/backend/src/modules/chat-channel/shared/form-mode.ts:289`,
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4918`,
    `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316-318`,
    `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:67`,
    `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts:79`,
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:601`,
    `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:94`,
    `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1583,1620,2038`,
    `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts:239`,
    `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:332,1076`,
    `codebase/backend/src/nodes/data/code/code.handler.ts:454`,
    `codebase/packages/web-chat-sdk/src/index.ts:63`
  - 상세: `@eslint/js@10` `recommended` 가 새로 켠 `no-useless-assignment`(12건)와
    `preserve-caught-error`(3건)를 `--max-warnings 0` 로 통과시키기 위한 최소 수정이며,
    `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 "상향이 깨뜨린 것" 항목에 15건
    전부가 사전 나열돼 있다. `ai-turn-executor.ts` 의 `finalSystemPrompt` 재할당 두 곳 제거는
    직접 grep 해 이후 스코프 내 재참조가 없음을 확인했고(사문 제거), `knowledge-base.service.ts`
    의 `graphRequeued -= slice.length;` 제거도 바로 다음 줄이 무조건 `throw err` 로 함수를
    종료시키므로 죽은 코드임을 코드 흐름으로 직접 확인했다. `expression-resolver.service.ts`/
    `code.handler.ts` 의 `{ cause: err }` 추가는 실질 동작 변화(에러 체인 보강)이지만 이 역시
    새 룰이 요구하는 최소 대응이다. 12개 파일 전부 "차제에 정리"성 드라이브바이 리팩터가
    아니라 룰이 지목한 지점 1곳씩만 건드렸다(추가 개행·이름 변경·구조 변경 없음).
  - 제안: 조치 불요 — scope 관점에서 "의도된 범위(eslint 10 상향 완주)" 안에 있다.

- **[INFO]** plan 문서에 이번 PR 코드가 다루지 않는 별개 이슈(§3 "frozen 게이트 사각지대",
  `typeorm→ioredis` unmet peer)가 새로 추가됐다 — 코드 변경 없이 문서로만 등재됨
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` §3 신설 블록(체크리스트
    `- [ ] §3 frozen 게이트 사각지대 — … `typeorm → ioredis` 실측이 선행`)
  - 상세: 이 발견은 `pnpm install --strict-peer-dependencies`(non-frozen) 실측 중
    우연히 드러난 것으로, 이번 PR(eslint 9→10)과는 다른 문제(기존 lockfile 에 이미 박혀
    CI 의 frozen 게이트가 못 잡는 unmet peer)다. 다만 (a) 같은 plan 문서(`deps-peer-gating-and-eslint10`) 의 주제(peer gating) 안이고, (b) 코드/설정 변경을 전혀 수반하지 않으며,
    (c) 체크박스가 `[ ]`(미착수)로 명시적으로 남아 후속 작업으로 분리돼 있어 "이번 PR 이
    몰래 범위를 넓혔다"는 종류의 문제는 아니다. `plan_coherence`(consistency-check) 도
    같은 결론(§3 는 "이번 작업의 범위 밖임이 본문에 명시")을 독립적으로 확인했다.
  - 제안: 조치 불요 — 순수 문서 기록이며 착수하지 않았음이 명시돼 있다. 향후 §3 을 실제로
    구현할 때는 그 자체를 별도 스코프로 다룰 것.

## 검증한 항목 (스코프 이탈 아님)

- `pnpm-lock.yaml`(+803/-… 대량 diff)을 `codebase/backend`/`packages/*` importer 블록 밖에서
  살펴본 결과, 신규/제거되는 패키지는 전부 `eslint-plugin-unicorn@56→73`(17 major) 상향이
  끌고 온 transitive devDependency(예: `builtin-modules`, `change-case`, `espree`,
  `regjsparser`, `mdn-data`, `p-event` 등 sindresorhus/ESLint 생태계)뿐이었다. 프로덕션
  런타임 의존성이나 `dependencies` 블록 변경은 없다.
- `.github/dependabot.yml`·`PROJECT.md`·`codebase/backend/eslint.config.mjs`·
  `codebase/frontend/eslint.config.mjs`·`codebase/channel-web-chat/eslint.config.mjs` 의
  대량 주석 교체는 전부 "왜 이 버전에 머무는가/무엇이 바뀌었는가"를 갱신하는 문서 변경이며,
  같은 커밋 세트 안에서 발견된 자기모순(2-place 카운트 drift, dangling "아래 참조")도
  각각 별도 fix 커밋(`0f3b3e0c3`, `214af6d0e`)으로 좁게 정정됐다 — 관련 없는 서술까지
  손댄 흔적 없음.
- 9개 `package.json`(backend 제외 8개 + backend 1개)의 diff 는 각 파일당 정확히
  `@eslint/js`/`eslint`(+ backend 는 `eslint-plugin-unicorn`) 버전 문자열 2~3줄 치환뿐이며,
  키 재정렬·포맷팅 변경·무관한 필드 수정이 없다.
- `eslint-unicorn-peer-guard.ts`/`eslint-unicorn-peer.spec.ts` 의 파서 확장(`>=X`/`>=X.Y`
  지원)과 `readInstalledPackageJson` 헬퍼 도입은 이번 상향(`unicorn@73` 의 2-component
  peer 표기·`exports` 맵 제약)이 직접 깨뜨린 가드를 고치는 것으로, 가드의 책임 범위를
  넓히는 기능 확장이 아니라 원래 계약("설치본 실측")을 유지하기 위한 방어적 수정이다.
  신규 `import * as fs from 'node:fs'` 도 이 워크어라운드에 필요한 임포트이지 불필요한
  정리/추가가 아니다.
- 34개 `review/**` 신규 파일(`11_45_02` 코드리뷰 9종 + RESOLUTION/상태 파일, `11_15_50`·
  `12_20_11` consistency-check 각 7종)은 CLAUDE.md "코드 리뷰 산출물은 `review/code/**`,
  일관성 검토 산출물은 `review/consistency/**`" 규약 및 "구현 완료 후 자동 review/fix 는
  상시 승인된 강제 의무" 조항에 따라 이 작업의 정규 산출물이다 — 별개 작업의 산출물이
  섞여 들어온 것이 아니라 이번 PR 자신의 리뷰/검증 이력이다.
- `text-chunker.spec.ts`/`secret-resolver.service.spec.ts` 신규 테스트 2건은 직전
  `/ai-review`(`11_45_02`) SUMMARY WARNING #2·#3 에 대한 지정 조치이며, 다른 기능을
  덧붙이지 않고 정확히 지적된 두 분기만 커버한다.
- `plan/in-progress/deps-peer-gating-and-eslint10.md` 본문 diff(155줄)는 실행 결과 기록
  (11개 중 9개만 상향, 상류 차단 근거, 상향이 깨뜨린 15건 목록), 체크리스트 갱신, TEST
  WORKFLOW 결과 기록으로 구성되며 이번 작업의 자기 서술 범위를 벗어나지 않는다. §3 신설을
  제외하면 새로운 작업 항목을 만들지 않았다.

## 요약

이번 diff(64개 파일, `origin/main` 대비 +2501/-375)는 "eslint 9→10 상향(11개 워크스페이스
중 9개, 나머지 2개는 상류 차단)"이라는 단일 목적에서 벗어나지 않는다. 코드 실질 변경은
버전 파일(설정·package.json·lockfile) 외에 12개 업무 로직 파일을 건드리지만, 전부 새로
활성화된 두 recommended 룰(`no-useless-assignment`/`preserve-caught-error`)이 요구하는
지점 1곳씩만 최소로 수정했고 plan 문서에 사전 목록화돼 있어 "의도 이상의 변경"이 아니다.
직전 `/ai-review` 라운드의 Critical 1건·Warning 2건에 대한 조치 커밋과, 표준 워크플로가
요구하는 리뷰/일관성-검토 산출물 커밋, plan 문서 갱신이 뒤따랐으며 이들 모두 이 작업
자신의 검증·기록 사이클이지 별개 기능이 아니다. 유일하게 눈에 띄는 부수 발견(§3 frozen
게이트 사각지대, `typeorm→ioredis`)은 코드 변경 없이 문서로만 등재되고 명시적으로
미착수 상태로 남아 있어 스코프 침범으로 보기 어렵다. 포맷팅-only 변경, 무단 리팩토링,
기능 확장, 무관한 파일 수정, 불필요한 주석/임포트 정리, 의도치 않은 설정 변경 — 8개 점검
관점 중 어느 것도 CRITICAL/WARNING 급으로 걸리지 않는다.

## 위험도
NONE
