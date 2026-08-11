# 신규 식별자 충돌 검토 — naming_collision

대상: `spec/conventions` (spec_impact: `spec/conventions/swagger.md`, `spec/conventions/node-cancellation.md`,
`spec/3-workflow-editor/3-execution.md`), plan `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md`.

`git diff origin/main...HEAD` 실측(워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/stop-editor-403-docs`)
기준으로 4개 확인 항목을 점검했다.

## 확인 항목별 결과

### 1. 새 식별자 0개인가

`git diff origin/main...HEAD --stat -- codebase/backend/src` → 16개 컨트롤러, `+57/-0`(데코레이터 51 +
import 6). 전량이 기존 `@nestjs/swagger` export `ApiForbiddenResponse` 를 기존 import 문에 추가하고,
기존 데코레이터 `@ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })` 를 그대로 재사용하는
형태다. 신규 클래스/DTO/enum/함수명 없음. **신규 식별자 0개 확인.**

### 2. `swagger.md` 앵커 실재 확인

`spec/conventions/swagger.md` 가 2곳에 추가한 프래그먼트:

```
../data-flow/12-workspace.md#멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08
```

`spec/data-flow/12-workspace.md:313` 실제 헤딩:

```
### 멤버십 검증은 가드 1곳에서 — `@Roles()` 와 무관 (2026-08-08)
```

GitHub 슬러그 규칙(소문자화, 백틱/`@`/괄호/em-dash 등 구두점 완전 삭제, 공백→`-`, 삭제된 em-dash
자리는 공백 두 개가 남아 `--`)으로 직접 산출하면:

`멤버십-검증은-가드-1곳에서--roles-와-무관-2026-08-08`

— target 이 넣은 프래그먼트와 **정확히 일치**. 같은 문서 내 동일 헤딩 텍스트 중복도 없어(`grep` 1건)
GitHub 가 `-1` 접미를 붙일 상황도 아니다. **죽은 앵커 아님.**

### 3. spec 3곳 링크(1-auth.md · 3-execution.md) 실재 확인

- `spec/3-workflow-editor/3-execution.md:178` → `[1-auth §3.2](../5-system/1-auth.md)` (파일 전체 링크,
  프래그먼트 없음)
- `spec/conventions/node-cancellation.md:109` → `[1-auth §3.2](../5-system/1-auth.md)` ·
  `[에디터 실행 §4](../3-workflow-editor/3-execution.md)` (둘 다 파일 전체 링크)

세 링크 모두 앵커 프래그먼트가 없는 **파일 단위 링크**라 슬러그 오류 위험이 없고, 대상 파일
(`spec/5-system/1-auth.md`, `spec/3-workflow-editor/3-execution.md`) 은 실재한다. 인용 근거("Workflow
실행 | Owner ✅ | Admin ✅ | Editor ✅ | Viewer —")도 `1-auth.md:373` 에 실재 확인.

### 4. 설명 문자열 `'워크스페이스 멤버가 아님'` 철자 일치

diff 로 새로 붙은 51곳 전부 `description: '워크스페이스 멤버가 아님'` 로 바이트 단위 동일(모든
`+` 라인 육안 대조 + `grep` 대조). 저장소 전체에서 이 정확한 문자열을 쓰는 `@ApiForbiddenResponse`
는 총 63건 = 이번 51건 + 기존 12건(P0 PR, `auth-workspace-membership-guard`) — 산수가 맞는다.

**target 범위 밖 참고 (기존 결함, 이번 diff 미포함)**: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:286`
에 `@ApiForbiddenResponse({ description: '해당 워크스페이스 멤버가 아님' })` — "해당 " 접두가 붙은
변형이 1건 존재한다. `git diff origin/main...HEAD -- .../workspaces.controller.ts` 결과가 비어 있어
이번 target 이 만든 변형이 아니라 그 이전부터 있던 표기다. target 이 이 파일을 건드리지 않았으므로
"신규 식별자 충돌"은 아니지만, `swagger.md §5-4` 가 이 문서에서 canonical 문구로 재확정한 값과
grep 기준으로 갈리는 지점이라 언급만 남긴다(별도 조치 불요 — target 스코프 밖).

## 발견사항

없음. 4개 확인 항목 모두 문제 없음.

## 요약

target 은 코드 쪽에서 기존 `@ApiForbiddenResponse` 데코레이터·기존 설명 문자열을 51곳에 재부착했을
뿐 신규 식별자를 도입하지 않았고, spec 쪽에서 추가한 `swagger.md` 앵커 2곳은 `data-flow/12-workspace.md`
의 실제 헤딩과 슬러그까지 정확히 일치하며, `1-auth.md`·`3-execution.md` 로의 링크 3곳도 프래그먼트
없는 파일 단위 링크로 안전하게 실재 파일을 가리킨다. 설명 문자열도 신규 51건 전량이 기존 관례와
철자까지 일치한다. target 스코프 밖에서 발견한 `workspaces.controller.ts` 의 사소한 표기 변형("해당 "
접두)은 이번 diff 가 만든 것이 아니라 참고로만 남긴다.

## 위험도

NONE

BLOCK: NO
STATUS: OK
