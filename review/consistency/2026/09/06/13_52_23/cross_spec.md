# Cross-Spec 일관성 검토 — `spec/conventions/{review-citations.md, spec-impl-evidence.md}`

## 발견사항

### [CRITICAL] target 이 새로 성문화한 `code:` 무-YAML-주석 규칙이 다른 3개 영역 7개 spec 파일에서 이미 위반 중이고, 이번 branch 자신의 변경 파일까지 Gate 2 에서 안 보인다 (실측)

- **target 위치**: `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 설명 — "~~주석 형태를 강제하는 가드가 없다~~ **정정 (2026-09-06)**: ... 그런 문서의 `code:` 는 **준수 예시와 시행 코드를 섞어** 담아도 된다 — 다만 **범주를 YAML 주석으로 적지 않는다.** `review_guard._parse_frontmatter_code` 의 블록 리스트 루프가 `- ` 가 아닌 첫 줄에서 `break` 해 그 뒤 항목이 조용히 사라진다(실측: 주석 삽입 시 2개 → **0개**)." (uncommitted working-tree 버전 기준. 커밋된 HEAD 버전은 이 경고 없이 여전히 YAML 주석을 `code:` 에 넣은 상태 — 두 버전 다 아래 결함의 범위를 못 본다.)
  같은 취지가 `spec/conventions/review-citations.md` "`code:` 가 '구현 경로' 가 아니라 '준수 예시' 를 가리키는 이유" 절에도 있다.

- **충돌 대상**: 다른 3개 도메인의 7개 spec 파일 — 전부 **지금 `origin/main` 에 이미 있고 이 branch 가 건드리지 않았다** (`git diff origin/main...HEAD` 로 확인, 무변경):
  - `spec/2-navigation/_layout.md`
  - `spec/2-navigation/10-auth-flow.md`
  - `spec/2-navigation/11-error-empty-states.md`
  - `spec/2-navigation/9-user-profile.md`
  - `spec/7-channel-web-chat/2-sdk.md`
  - `spec/7-channel-web-chat/3-auth-session.md`
  - `spec/conventions/user-guide-evidence.md`

- **상세**: target 이 이번에 "SoT" 자리(`spec-impl-evidence.md` §2.1, **전 영역 `code:` 필드의 스키마 정의**)에 명문화한 규칙은 *"`code:` 블록 리스트에 `#` YAML 주석을 넣으면 게이트 파서가 그 줄에서 끊겨 뒤 항목이 전부 사라진다"* 이다. 그런데 이 규칙이 성립하는 바로 그 순간, 위 7개 파일이 **이미 그 안티패턴을 갖고 있다** — `code:` 블록 중간에 `#` 주석이 있고 그 뒤에 `- ` 항목이 이어진다. `.claude/hooks/_lib/review_guard.py` 를 직접 실행해 실측했다:

  ```python
  rg._parse_frontmatter_code("spec/2-navigation/9-user-profile.md")
  # -> ['.../profile/**', '.../workspace/settings/**']   (17개 중 2개만 생존)
  ```

  전역 패턴 집합(`_spec_code_patterns`, 537개)에 대해 아래 6개 실 경로를 매칭한 결과 **전부 0건**:

  | 경로 | 매칭 패턴 수 | 원 선언처 (주석 뒤라 드롭됨) |
  |---|---|---|
  | `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` | **0** | `9-user-profile.md` (`modules/workspaces/**`) |
  | `codebase/backend/src/modules/notifications/notifications.service.ts` | **0** | `9-user-profile.md` (`modules/notifications/**`) |
  | `codebase/backend/src/modules/users/users.service.ts` | **0** | `9-user-profile.md` (`modules/users/**`) |
  | `codebase/backend/src/modules/alerts/alerts.service.ts` | **0** | `9-user-profile.md` (`modules/alerts/**`) |
  | `codebase/frontend/src/app/(main)/[...rest]/page.tsx` | **0** | `_layout.md`·`10-auth-flow.md`·`9-user-profile.md`·`11-error-empty-states.md` **4곳 전부**에서 주석 뒤에 위치 — "URL slug = FE 라우팅 SoT" 의 그 catch-all 파일(`project_slug_routing_decisions_locked.md`)이 전 선언처에서 증발 |
  | `codebase/frontend/src/lib/workspace/href.ts` | **0** | `_layout.md`·`9-user-profile.md` 둘 다 주석 뒤 |

  **이번 branch 자신의 diff 도 걸린다** — 이번 세션이 수정한
  `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (14줄, `joinedAt` 필드 추가)가
  위 표의 첫 행이다. `9-user-profile.md` 가 `modules/workspaces/**` 로 이 경로를 명시적으로 커버 대상이라 선언했는데도,
  주석 뒤에 있어 **Gate 2 (`--impl-done` 스펙-링크 판정)가 이 파일 변경을 spec-linked 로 인식하지 못한다.**
  즉 review_guard 관점에서 이 파일은 "spec 이 추적하는 surface" 가 아닌 것처럼 보인다.

  target 의 정정은 **review-citations.md 자기 자신의 재발**(`review/code/2026/09/06/13_39_20` Critical 1, 2개→0개)만 고쳤고,
  `spec-impl-evidence.md` §2.1 에는 "주석을 넣지 마라" 는 일반 규칙만 추가했을 뿐 — **이미 걸려 있는 위 7개 파일을
  언급하거나 함께 고치지 않는다.** 결과적으로 target 이 선언한 새 불변식("`code:` 는 준수 예시/시행 코드를 섞어도
  되지만 주석으로 가르면 안 된다")과, **그 불변식이 적용되는 대상 스키마를 이미 위반 중인 다른 3개 영역의 실제
  상태**가 정면으로 어긋난다 — 그리고 그 어긋남의 결과(Gate 2 미작동)가 이번 PR 자신의 변경 파일에도 그대로 미친다.

  기존에 이 결함 자체는 harness 백로그로 등재돼 있다
  (`plan/in-progress/spec-draft-nullable-notation-followups.md` L1087-1114, "harness: `code:` 블록 리스트의 YAML
  주석이 게이트 파서를 조용히 끊는다") — 다만 그 항목의 "실측" 은 **`2-api-convention.md`·`swagger.md`(둘 다 이미
  주석 제거로 해소)·`review-citations.md` 재발** 세 건만 적고 있고, 위 7개 파일은 언급이 없다. **백로그 항목 자체가
  자신이 고치려는 결함의 실제 범위를 과소평가하고 있다.**

- **제안**:
  1. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 harness 항목에 위 7개 파일 + 6개 완전
     매칭-실패 경로를 실측으로 추가해 범위를 갱신한다 (새 항목으로 중복 등재하지 말 것 — 이미 등재된 결함이다).
  2. 근본 수정은 파서(`review_guard._parse_frontmatter_code`)가 `#` 주석·빈 줄을 스킵하도록 고치는 것 — 이미 그 플랜
     문서가 제안한 방향("파서를 고치거나(#·빈 줄 스킵)")과 일치한다. 그 전까지는 위 7개 파일에서 `#` 주석을 걷어
     `code:` 블록을 산문/표 설명과 분리해야 한다 (이번 target 이 `review-citations.md` 에 적용한 것과 동일 처방).
  3. `spec-impl-evidence.md` §2.1 의 새 경고 문단에 이 harness 백로그 항목으로의 링크를 추가해, 다음에 같은 실수를
     반복(이미 24시간 안에 2회 재발 — `review-citations.md` 자체가 그 두 번째 사례)하기 전에 기존 결함 목록을 먼저
     찾아보게 한다.

### [WARNING] 위 CRITICAL 항목이 지적하는 결함 클래스가 하루 안에 3번째로 재발할 위험 — target 의 회피책이 "그 문서만" 고치는 패턴을 반복 중

- **target 위치**: `spec/conventions/review-citations.md` "왜 PR 번호로 전환하지 않았나" 절 인접 — 정정 이력이 "같은 함정을 하루 전 같은 브랜치 계열이 이미 밟았다" 고 스스로 적는다(우선 지적 사항, uncommitted 버전).
- **충돌 대상**: `plan/in-progress/spec-draft-nullable-notation-followups.md` L1087-1114 의 동일 harness 항목.
- **상세**: target 문서 자신의 히스토리가 이미 "①`2-api-convention.md`/`swagger.md` 에서 발견 → 주석 제거로 회피 → ②하루 뒤 `review-citations.md` 에서 재발 → 주석 제거로 재회피" 패턴을 두 번 반복했다고 스스로 서술한다. 그런데 이번 정정도 **파서 자체를 고치거나 전역 스윕을 하지 않고, 또 그 문서 하나만** 고쳤다 — 그리고 위 CRITICAL 항목에서 실측했듯 **이미 존재하는 3번째 이상의 사례(2-navigation ×4, channel-web-chat ×2, user-guide-evidence.md ×1)** 는 여전히 미해소다. "회피책이 작동하지 않는다는 증거" 라고 plan 문서가 스스로 적어 놓고도, 이번 target 정정 역시 같은 국소 회피 방식을 반복한다.
- **제안**: 이번 라운드에서 파서를 고치거나 전역 스윕을 못 하더라도, 최소한 target(spec-impl-evidence.md §2.1)의 정정 문단에 "이미 알려진 3개 영역 7개 파일이 동일 결함을 갖고 있다" 는 사실과 harness 항목 링크를 남겨, 다음 checker/개발자가 "이 문서만 고치면 끝" 이라고 오판하지 않게 한다.

## 요약

target(`review-citations.md`, `spec-impl-evidence.md`)이 이번에 정정한 내용 자체(§3 응답 DTO 축만 강제, 컨트롤러 축 미강제 — `dto-jsdoc-citation-guard.ts` 의 `isResponseDtoFile()` 스코프와 실측 일치, `swagger.md` §3 JSDoc 정책과도 정합, `workspace-response.dto.ts` `joinedAt` 예시는 `spec/1-data-model.md` 의 `joined_at: Timestamp?` 및 엔티티 `nullable: true` 와 일치)은 다른 영역과 데이터 모델·API 계약·상태 전이·RBAC 관점에서 충돌이 없다. 그러나 target 이 이번에 새로 명문화한 `code:` 필드의 "YAML 주석 금지" 규칙은 **그 규칙이 적용되는 스키마의 SoT 문서(`spec-impl-evidence.md`) 자신이 관장하는 다른 3개 도메인(2-navigation, 7-channel-web-chat, conventions)의 7개 spec 파일에서 이미, 그리고 지금도 위반되고 있음**이 `review_guard.py` 직접 실행으로 실측 확인됐다 — 6개 실 경로(그중 하나는 이번 branch 자신이 수정한 `workspace-response.dto.ts`)가 전역 537개 패턴 중 어느 것과도 매칭되지 않아 `--impl-done` Gate 2 의 사각지대에 있다. 이는 이미 harness 백로그(`spec-draft-nullable-notation-followups.md`)에 등재된 결함 클래스의 재발이지만, 그 백로그 항목조차 위 7개 파일의 존재를 실측하지 못해 범위를 과소평가하고 있다.

## 위험도

HIGH
