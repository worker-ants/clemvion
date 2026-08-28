STATUS=success scope review complete — 30 files, 0 critical, 3 info
===REPORT_MARKDOWN_BELOW===
# 변경 범위(Scope) 리뷰 — eslint 9→10 상향

커밋 `beed5143e`("build(deps): eslint 9 → 10 상향 — 11개 중 9개, 나머지 2개는 상류가 막는다")
기준, `git diff origin/main...HEAD` 30개 파일 전수 검토. `plan/in-progress/deps-peer-gating-and-eslint10.md`
§2 를 작업 명세로 삼아 각 diff 가 그 범위 안인지 판단했다.

## 발견사항

- **[INFO]** 새 recommended 룰(`no-useless-assignment`/`preserve-caught-error`) 위반 수정이 12개
  비-config 백엔드 파일에 퍼져 있다
  - 위치: `codebase/backend/src/common/utils/ssrf-safe-url.util.ts:156`,
    `codebase/backend/src/modules/chat-channel/shared/form-mode.ts:289`,
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4918`,
    `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts:316`,
    `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts:67`,
    `codebase/backend/src/modules/knowledge-base/chunking/text-chunker.ts:79`,
    `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:601`,
    `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:94`(disable),
    `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:1583,1620,2038`,
    `codebase/backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts:239`,
    `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:332,1076`,
    `codebase/backend/src/nodes/data/code/code.handler.ts:454`,
    `codebase/packages/web-chat-sdk/src/index.ts:63`
  - 상세: 순수 config/lockfile 변경이 아니라 업무 로직 파일 12곳(+web-chat-sdk 1곳)을 건드린다.
    다만 이는 "회귀 정리성 리팩토링"이 아니라 `@eslint/js@10` recommended preset 이 새로 켠
    두 룰(`no-useless-assignment` 12건, `preserve-caught-error` 3건)을 `--max-warnings 0` 로
    통과시키기 위한 **강제 수반 수정**이며, `plan/in-progress/deps-peer-gating-and-eslint10.md`
    §"상향이 깨뜨린 것" 항목에 15건 전부가 사전에 명시돼 있다. `ai-turn-executor.ts` 의
    `finalSystemPrompt` 제거를 직접 grep 해 그 지역 변수가 라인 1611 이후 같은 함수 스코프
    내에서 실제로 다시 읽히지 않음을 확인했다 — 동작 변경이 아닌 순수 사문(死文) 제거로 보인다.
    `expression-resolver.service.ts`/`code.handler.ts` 의 `cause: err` 추가는 에러 체인을
    보강하는 실질 동작 변화이지만, 이 역시 새 룰이 요구하는 최소 수정이고 plan 에 근거가
    적혀 있다.
  - 제안: 별도 조치 불요 — scope 관점에서는 "의도된 범위(eslint 10 상향 완주)"에 속한다.
    다만 병합 조율자는 이 파일들을 config-diff 로만 보지 말고 개별 hunk 로 리뷰 대상에
    포함시킬 것(다른 리뷰어가 "config 커밋이라 스킵"하는 사각지대를 만들 수 있음).

- **[INFO]** plan 문서에 이번 작업과 무관한 새 백로그 섹션(§3, frozen lockfile 사각지대)이 추가됨
  - 위치: `plan/in-progress/deps-peer-gating-and-eslint10.md` — 신설 `## 3. frozen 게이트의
    사각지대 — lockfile 에 이미 박힌 미충족 peer (P3)` 절 및 그 위 "이 게이트의 보장 범위 정정"
    블록
  - 상세: eslint 10 상향 작업 도중 `pnpm install --strict-peer-dependencies`(non-frozen) 를
    돌려보다가 `typeorm→ioredis`, `nunjucks→chokidar` 의 기존 unmet peer 를 우연히 발견하고,
    이를 이번 PR 범위(§2)가 아닌 새 P3 항목(§3)으로 분리해 기록했다. 코드 수정은 없고 조사
    결과만 plan 에 적었다.
  - 제안: 실제 코드/설정 변경이 아니라 "발견한 것을 그 자리에서 기록"하는 이 저장소의 관행
    (미기록 발견은 유실된다는 프로젝트 교훈)에 부합하므로 이 자체는 문제로 보지 않는다.
    다만 병합 조율자는 이 PR 이 §2(체크박스) 완료만 주장하고 §3(신규)은 별도 미해결
    항목임을 함께 확인할 것 — §3 을 이 PR 의 "완료"로 착각하지 않도록.

- **[INFO]** `pnpm-lock.yaml` 에 eslint/unicorn 과 무관한 전이 의존성 버전 이동이 소수 섞여 있음
  - 위치: `pnpm-lock.yaml` (예: `browserslist@4.28.7→4.28.8`, `entities@4.5.0` 의
    `optional: true` 플래그 소실 — 게이트 숫자 대조 불가한 대량 diff 이므로 파일명으로만 기재)
  - 상세: 나머지 대다수 lockfile 변경(builtin-modules, is-builtin-module, reserved-identifiers,
    quote-js-string, mdn-data, change-case, strip-indent, super-regex, p-timeout 등)은
    `eslint-plugin-unicorn@56→73` / `eslint@9→10` 전이 트리 재계산의 정상적 부산물로 확인된다
    (구버전이 끌던 `read-pkg`/`normalize-package-data`/`spdx-*`/`semver@5`/`globals@15` 계열이
    사라지고 신버전 트리로 교체). 그 중 `browserslist` 패치 버전 이동 등 극소수는 이번
    작업과 인과관계가 뚜렷하지 않은 전체 재해석 부산물로 보인다.
  - 제안: 위험도가 낮고(devDependency 트리의 patch 이동) `pnpm install` 전체 재해석의 통상적
    결과이므로 별도 조치는 불필요. 다른 PR 에서 "왜 이 버전이 바뀌었나" 질문이 나올 수 있어
    기록만 남긴다.

## 확인된 정상 범위

- `.github/dependabot.yml`: unicorn major-ignore 블록만 제거/재작성, 다른 항목 불변 (`git diff`
  로 hunk 단독 확인).
- `codebase/backend/eslint.config.mjs`: 버전 표·근거 주석 갱신만, 룰 셋 변경 없음.
- `codebase/backend/package.json` + 8개 `codebase/packages/*/package.json`: `eslint`/`@eslint/js`
  (`eslint-plugin-unicorn` 은 backend 만) 버전 필드만 변경.
- `codebase/frontend/eslint.config.mjs`, `codebase/channel-web-chat/eslint.config.mjs`: 파일
  상단 사유 주석 추가뿐 — 두 워크스페이스는 실제로 eslint 9 에 **남았고** 코드 변경 없음.
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts` +
  `eslint-unicorn-peer.spec.ts`: unicorn 66+ 의 `>=10.4`(2-component) 표기를 파싱하도록 가드
  확장 + `exports` 맵 차단 우회(`readInstalledPackageJson`) + 회귀 케이스 추가 — 전부 이번
  상향이 깨뜨린 가드를 고치는 목적에 정확히 부합.

## 요약

30개 변경 파일 전수를 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 명세와 대조한
결과, 범위를 벗어난 무관한 리팩토링·기능 확장·설정 드리프트는 발견되지 않았다. 업무 로직
파일 12~13곳에 걸친 수정은 언뜻 "config 상향치고 손댄 파일이 많다"는 인상을 주지만, 전부
`@eslint/js@10` recommended 두 룰이 새로 켜지며 `--max-warnings 0` 를 통과하기 위해 강제된
수반 수정이고 plan 문서에 사전 목록화돼 있어 의도된 범위로 판단한다. plan 문서에 신설된 §3
백로그와 lockfile 의 미세한 전이 버전 이동은 코드 변경이 아니거나 위험도가 낮아 INFO 로만
기록한다.

## 위험도

LOW
