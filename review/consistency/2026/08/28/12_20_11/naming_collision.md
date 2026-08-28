# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 방법론 메모

이번 impl-done 검토의 diff-base(`origin/main`) 대비 실제 변경분(`## 구현 변경 사항` 섹션,
1475~2181행)을 전수 확인했다. 변경 파일 목록:

- `codebase/backend/eslint.config.mjs`, `codebase/channel-web-chat/eslint.config.mjs`,
  `codebase/frontend/eslint.config.mjs`
- `codebase/backend/package.json`, `codebase/packages/*/package.json` (8개 워크스페이스)
  — `eslint ^9.18.0 → ^10.9.1`, `@eslint/js ^9.18.0 → ^10.0.1` 버전 상향
- `codebase/backend/src/common/utils/ssrf-safe-url.util.ts`,
  `.../chat-channel/shared/form-mode.ts`,
  `.../execution-engine/execution-engine.service.ts`,
  `.../execution-engine/expression/expression-resolver.service.ts`,
  `.../hooks/public-webhook-throttle.guard.ts`,
  `.../knowledge-base/chunking/text-chunker.ts`(+spec), `.../knowledge-base.service.ts`,
  `.../secret-store/secret-resolver.service.ts`(+spec),
  `.../nodes/ai/ai-agent/ai-turn-executor.ts`,
  `.../nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`,
  `.../nodes/ai/information-extractor/information-extractor.handler.ts`,
  `.../nodes/data/code/code.handler.ts`
  — 전부 신규 lint 규칙(`no-useless-assignment`, `preserve-caught-error` 등)에 대응한
  기존 코드 미세 수정(불필요 초기값 제거, `cause` 보존/차단, dead-store 주석화)
- `codebase/backend/src/repo-guards/__tests__/eslint-unicorn-peer-guard.ts`(+spec)
  — 버전 파서(`parseGteFloor`)가 2-component(`>=10.4`) 표기를 받도록 확장
- `codebase/packages/web-chat-sdk/src/index.ts` — 동일한 `no-useless-assignment` 대응

**diff 안에 `spec/**` 경로 변경은 0건이다** (`grep "^diff --git" ... | grep spec/` 결과 없음).
즉 이번 target(`spec/5-system/`) 은 이번 PR 에서 **내용이 변경되지 않았다** — 프롬프트에
번들된 `spec/5-system/1-auth.md`·`3-error-handling.md` 등은 diff-base 시점과 동일한
기존 문서이며, 본 PR 이 새로 도입한 요구사항 ID·엔티티명·API endpoint·이벤트명·ENV var·
spec 파일 경로는 존재하지 않는다.

## 발견사항

없음. 본 PR(`eslint10-upgrade`)은 ESLint 10 메이저 업그레이드 + 신규 lint 규칙에 대한
코드 대응(변수 초기값 제거, error `cause` 처리, repo-guard 버전 파서 확장)으로 구성되며,
`spec/5-system/` 문서 자체를 변경하지 않는다. 따라서 "target 문서가 새로 도입하는 식별자"
자체가 없어 신규 식별자 충돌 관점에서 점검할 대상이 없다.

참고로 변경된 코드 중 신규로 보이는 식별자(`readInstalledPackageJson` 헬퍼 함수,
`parseGteFloor` 의 2-component 파싱 분기)도 확인했으나, 둘 다 `repo-guards/__tests__/`
내부의 테스트 전용 유틸이며 spec 표면(요구사항 ID·엔티티·endpoint·이벤트·ENV·config key)과
무관한 순수 내부 구현 디테일이라 충돌 검토 대상이 아니다.

## 요약

이번 target(`spec/5-system/`)에 대한 diff 는 spec 문서 변경을 전혀 포함하지 않는
ESLint 10 업그레이드 PR이다. 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·
환경변수/설정키·spec 파일 경로 중 어느 것도 이번 변경으로 새로 도입되지 않았으므로,
신규 식별자 충돌 관점에서 보고할 발견사항이 없다.

## 위험도

NONE
