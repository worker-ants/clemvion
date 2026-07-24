# 정식 규약 준수 검토 — convention_compliance

검토 대상: `spec/7-channel-web-chat/` (impl-done, diff-base `origin/main`, HEAD 워크트리
`/Volumes/project/private/clemvion/.claude/worktrees/webchat-apibase-binding-a14e68`)
diff 범위: `codebase/channel-web-chat/src/lib/api-base.ts`(신규) · `eia-client.ts` · `session-store.ts`(+test) ·
`widget/use-widget.ts` · `widget/use-token-refresh.test.ts` · `widget/use-widget-eager-start.test.ts`
(세션 ↔ 발급 `apiBase` origin 바인딩 — cross-origin 토큰 유출 방지)

## 검토 방법

- diff 는 절대경로 워크트리에서 `git -C <worktree> grep/show` 로 현재 상태를 직접 재확인(diff 스냅샷만 신뢰하지 않음).
- 동일 세션 이전 두 라운드(`review/consistency/2026/07/24/11_12_46`, `22_35_51`)의 `convention_compliance.md`·
  `naming_collision.md` 를 대조해 이미 다룬 항목(특히 `normalizeApiBase` 명명 충돌 CRITICAL, 22_35_51)이 본 diff에서
  어떻게 처리됐는지 재확인.

## 점검 관점별 결과

### 1) 명명 규약
- 신규 파일 `codebase/channel-web-chat/src/lib/api-base.ts` — kebab-case, 기존 `session-store.ts`/`eia-client.ts`/
  `eia-types.ts` 와 동일한 lib 파일 명명 스타일. 준수.
- 신규 식별자 `stripTrailingSlash`/`apiBase`/`expectedApiBase` — camelCase, 기존 코드베이스 스타일과 일관.
- **선행 CRITICAL 해소 확인**: 22_35_51 라운드가 지적한 `normalizeApiBase` 이름 충돌(`session-store.ts` 로컬 wrapper
  vs `app/demo/demo-config.ts` 의 기존 export — 후행 `/api` 제거 여부가 정반대인 함수가 동명이라 향후 오인 통합 시
  보안 불변식이 무너질 위험)이 본 diff 에서 **완전히 제거**됐다. `session-store.ts` 는 더 이상 `normalizeApiBase` 라는
  이름의 로컬 함수를 정의하지 않고 공용 `stripTrailingSlash` 를 직접 호출한다(`git -C <worktree> grep -n
  normalizeApiBase codebase/channel-web-chat/src/lib/session-store.ts` → 주석 1건만 남고 함수 정의 없음 확인).
  `demo-config.ts::normalizeApiBase`(경로까지 제거)는 그대로 유지되지만 이제 동명 충돌 대상이 없어 오인 통합 위험이
  구조적으로 사라졌다 — 단순 개명/주석 추가보다 강한 해소법.
- 참고(비위반): `stripTrailingSlash` 라는 동일 이름의 module-private 헬퍼가 `codebase/frontend/src/lib/utils/
  webhook-url.ts`·`codebase/frontend/src/lib/web-chat/widget-base.ts` 에도 독립 존재하나, `codebase/frontend` 와
  `codebase/channel-web-chat` 은 아키텍처상 완전히 분리된 애플리케이션(0-architecture.md §2 iframe 격리 — 위젯은
  frontend 패키지를 import 하지 않음)이라 import 충돌이 없고 의미도 동일(단순 관용구 재발명)하다. 22_35_51 라운드도
  이를 INFO/참고로만 기록했으며 본 검토도 동일 결론.

### 2) 출력 포맷 규약
- 본 diff 는 API 응답·이벤트 페이로드·에러 코드를 신설·변경하지 않는다(순수 클라이언트 sessionStorage 스키마 확장
  + 함수 시그니처 변경). `spec/conventions/error-codes.md`(백엔드 `error.code` 명명) 대상 아님. N/A.

### 3) 문서 구조 규약
- 본 diff 는 `spec/**.md` 를 변경하지 않는다(`git diff origin/main...HEAD` 에 `spec/` 경로 hunk 없음, diff 전체 확인).
  대상 6개 spec 문서(`0-architecture.md`~`5-admin-console.md`)는 모두 Overview → 본문 → Rationale 3섹션 구조,
  `_product-overview.md`·`0-` prefix 진입 문서 명명을 기존과 동일하게 준수(변경 없음이므로 이번 diff 로 인한 회귀 없음).
- **[INFO]** `spec/7-channel-web-chat/3-auth-session.md` frontmatter `code:` 에 신규 파일 `codebase/channel-web-chat/
  src/lib/api-base.ts` 미등재.
  - target 위치: `3-auth-session.md` frontmatter `code:` (4개 명시 경로: `session-store.ts`/`eia-client.ts`/
    `use-widget.ts`/`use-token-refresh.ts`)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1/§R-1 (evidence completeness 취지 — 단, §4 가드는
    "status ∈ {partial, implemented} 인 spec 의 `code:` 글로브가 **≥1** 파일 매치"만 요구하므로 build 가드 관점에서는
    이미 통과 상태)
  - 상세: `api-base.ts` 는 본 문서 §3.1 이 서술하는 "발급 origin 바인딩"(`stripTrailingSlash` 기반 origin 비교) 로직의
    핵심 구현 단위이며 `session-store.ts`/`eia-client.ts`/`use-widget.ts`(이미 code: 등재) 세 곳 모두 이 파일을
    import 한다. 명시 파일 나열 방식(글로브 아님)인 이 문서 특성상 신규 의존 파일이 자동으로 커버되지 않는다.
  - 제안: `code:` 리스트에 `codebase/channel-web-chat/src/lib/api-base.ts` 한 줄 추가(선택 — build 가드 차단 아님,
    evidence 완결성 개선 목적). 필수 아님.

### 4) API 문서 규약 (swagger/OpenAPI)
- 본 diff 는 backend controller·DTO·decorator 를 건드리지 않는다(채널 위젯 클라이언트 코드 한정). N/A.

### 5) 금지 항목
- 발견된 금지 패턴 없음. 오히려 다음 두 지점이 이 프로젝트가 반복 지적해온 안티패턴(과거 세션 피드백: "truthiness 만으로
  판정 금지", "optional 파라미터가 조용한 스킵을 허용해선 안 됨")을 **적극적으로 회피**하도록 설계됨:
  - `loadSession(triggerEndpointPath, expectedApiBase, storage?)` — `expectedApiBase` 를 **필수 인자**로 두어
    호출부가 조용히 origin 검사를 생략할 수 없게 함(JSDoc 이 그 의도를 명시).
  - 미기록(레거시, 필드 도입 이전) 세션도 "아마 같겠지"로 통과시키지 않고 **폐기**(fail-safe) — 약한 증거를 받아주지
    않는 설계.
- 전 호출부(`use-widget.ts`, 8개 이상 테스트 파일) `loadSession` 시그니처 갱신 여부를
  `git -C <worktree> grep -n "loadSession("` 로 전수 확인 — 구버전 1-인자 호출 잔존 없음 확인.

## 발견사항

- **[INFO]** `3-auth-session.md` frontmatter `code:` 리스트에 신규 구현 파일 `codebase/channel-web-chat/src/lib/
  api-base.ts` 미등재 (상세는 §3 참조). build 가드 비차단, evidence 완결성 제안 수준.

CRITICAL/WARNING 없음.

## 요약

이번 diff(세션 ↔ 발급 `apiBase` origin 바인딩)는 정식 규약 관점에서 깨끗하다. 특히 동일 세션 이전 라운드
(`22_35_51`)가 CRITICAL 로 지적한 `normalizeApiBase` 동명 충돌(반대 계약을 가진 두 함수가 같은 이름을 공유해 향후
오인 통합 시 cross-origin 토큰 유출 취약점이 재도입될 위험)을, 로컬 wrapper 를 아예 제거하고 공용
`stripTrailingSlash` 를 직접 호출하는 방식으로 **완전히 해소**했다(단순 개명이나 주석 추가보다 근본적인 해법).
API 응답 포맷·스웨거·문서 구조 규약은 이번 diff 의 범위 밖(순수 클라이언트 코드, spec 문서 미변경)이라 해당 사항이
없으며, 기존 spec 6개 문서의 3섹션 구조·파일 명명도 그대로 유지된다. 유일한 관찰 사항은 spec-impl-evidence 프론트매터
`code:` 리스트에 신규 헬퍼 파일 한 줄이 빠진 완결성 이슈로, build 가드를 통과하는 INFO 수준이다.

## 위험도

NONE
