# 신규 식별자 충돌 검토 — naming_collision

검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat`, diff-base=`origin/main`
전제: 직전 라운드 CRITICAL 0. 이번 라운드는 그 사이 머지된 `origin/main`(#1132 install
게이트 + dependabot 범프)이 **새 식별자 충돌을 들여왔는지만** 재확인 대상이며, CRITICAL
판정을 특히 엄격히 한다(비-CRITICAL 은 본문 발견사항 없이 요약으로만 처분).

## 재확인 절차 및 근거

1. **merge 식별**: `git log --merges` 로 `cd96fc416 Merge remote-tracking branch
   'origin/main' into claude/webchat-reload-rest-branches` 확인. 두 번째 parent
   `d472443b0`(dependabot mysql2 범프)까지가 `origin/main` 유입분.
2. **merge-base 산출**: `git merge-base ed82c3e88 d472443b0` → `cbc0d33760c`.
3. **유입 diff 전수 확인** (`git diff cbc0d33760c d472443b0 -- . ':!review'`, 33 files):
   - `.claude/**`(harness 테스트·스크립트), `.github/**`(workflow/action), 각 영역
     `Dockerfile`/`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
     `plan/in-progress/deps-peer-gating-and-eslint10.md`,
     `plan/in-progress/harness-review-gate-followups.md` 뿐.
   - **`spec/**` 변경 0건** — target 영역(`spec/7-channel-web-chat`)은 물론 다른 어떤
     spec 파일도 이 merge 로 바뀌지 않았다.
   - `codebase/channel-web-chat/package.json` 변경은 `marked 18.0.4→18.0.9`,
     `jsdom ^29.0.1→^30.0.1` **버전 문자열 범프뿐**(신규 키·식별자 없음).
     `codebase/packages/web-chat-sdk/package.json` 도 동일하게 버전 필드만.
   - `#1132`(install 게이트)이 실제로 건드린 것은 `.github/actions/pnpm-workspace/action.yml`
     의 `--strict-peer-dependencies` 플래그, `pnpm-workspace.yaml` 의 빈
     `peerDependencyRules` 블록, 5곳 install 호출부(`Dockerfile`×3 +
     `.claude/test-stages.sh`), `.github/workflows/harness-checks.yml` 의
     `fetch-depth: 50` — 전부 CI/툴체인 내부 설정으로, 요구사항 ID·엔티티명·API
     endpoint·이벤트명·ENV var·spec 파일 경로 어느 축에도 해당하지 않는다.
4. **target 자체가 도입한 신규 함수 식별자 교차확인**
   (`isTerminalAuthError`, `redactToken` — target diff 의 `codebase/channel-web-chat/src/lib/eia-client.ts`):
   `git grep`로 전체 워크트리 검색한 결과 두 식별자 모두 `codebase/channel-web-chat/**` 와
   그 리뷰 산출물(`review/code/**`) 밖에서 재사용되지 않는다. `redactToken` 과 유사한
   이름 계열(`redactSecrets`, `redactMcpSecrets`, `redactConfig`,
   `redactThreadForPublic`)이 `codebase/backend/**` 에 있으나 **철자가 다르고 서로 다른
   모듈**이라 동일 식별자 충돌이 아니다(명명 패턴 재사용, WARNING 이하 성격 — 아래 요약).

## 발견사항

CRITICAL 없음. 요구사항 ID·엔티티/타입명·API endpoint·이벤트/메시지명·ENV
var/config key·파일 경로 6개 관점 전부에서, 이번 머지가 target(`spec/7-channel-web-chat`)의
신규 식별자와 충돌을 일으킨 사례를 찾지 못했다 — 애초에 머지 유입분이 `spec/` 을 전혀
건드리지 않았고, `codebase/channel-web-chat` 유입분도 dependency 버전 문자열 범프
2건뿐이라 신규 식별자 자체가 존재하지 않는다.

## 요약

`origin/main` 머지(#1132 install 게이트 + dependabot 범프)가 가져온 33개 변경 파일을
전수 확인한 결과 `spec/**` 변경은 0건, `codebase/channel-web-chat/**` 변경은
`package.json` 의 `marked`/`jsdom` 버전 범프 2줄뿐이었다 — 신규 요구사항 ID·엔티티명·
endpoint·이벤트명·ENV var·설정키·spec 파일 경로가 전혀 유입되지 않아 target 문서의 신규
식별자와 부딪힐 표면 자체가 없다. `#1132` 가 건드린 `--strict-peer-dependencies`
플래그·`peerDependencyRules`·`fetch-depth: 50` 은 CI/툴체인 내부 설정으로 spec 식별자
네임스페이스와 교집합이 없다. target 자신이 이번 사이클에 새로 도입한 `isTerminalAuthError`/
`redactToken`(`eia-client.ts`)도 워크트리 전수 grep 상 `codebase/channel-web-chat` 밖에서
재사용되지 않아 충돌이 없으며, `redact*` 명명 계열이 backend 에 이미 존재하는 것은 철자가
다른 별개 함수라 명명 패턴의 자연스러운 재사용이지 충돌이 아니다(비-CRITICAL, 참고 기록).
따라서 이번 라운드의 재확인 범위(머지 유입 신규 식별자)에서 CRITICAL 은 발생하지 않았다.

## 위험도

NONE
