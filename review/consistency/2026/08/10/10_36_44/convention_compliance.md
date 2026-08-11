# 정식 규약 준수 검토 — `spec/conventions/spec-impl-evidence.md`

검토 모드: spec draft 검토 (`--spec`)

> **선결 사실 확인 (중요 컨텍스트)**: 아래 발견사항은 orchestrator 가 전달한 target 본문(bundle, 306줄) 을 그대로 분석한 결과다. 그런데 실제 저장소를 실측한 결과, 이 target 본문은 **현재 브랜치(`claude/spec-small-followups`) HEAD 에 반영되어 있지 않다.** 현재 `spec/conventions/spec-impl-evidence.md` (259줄, 커밋 `f8c334947` 이후 미변경) 에는 target 본문에 있는 `plan-link-integrity.test.ts` 행·R-11·"2번째 invariant" 행이 **전혀 없다.** git 이력을 추적하면:
>
> - 커밋 `62084e807`(08:32) 가 `plan-link-integrity.test.ts`(신규)·`spec-plan-completion.test.ts`(2번째 invariant 추가)·`spec-links.ts` 를 구현했으나 **이 문서 자체는 건드리지 않았다** (`git log -- spec/conventions/spec-impl-evidence.md` 에 미등장).
> - 같은 브랜치의 커밋 `9f2755822`(10:41, "revert: ... PR #1123 이 이미 구현했다 (중복 폐기)") 가 그 구현을 **전량 되돌렸다** — `plan-link-integrity.test.ts` 삭제, `spec-plan-completion.test.ts`/`spec-links.ts` 는 추가분만 원복. 현재 `ls codebase/frontend/src/lib/docs/__tests__/` 에 `plan-link-integrity.test.ts` 는 **존재하지 않는다.**
> - 미병합 PR #1123(`claude/plan-lifecycle-gates`, 로컬 워크트리 `/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 존재) 는 **동일 기능을 다른 파일명(`plan-scan.test.ts`/`plan-scan.ts`)** 으로 구현했고, 그 브랜치의 `spec-impl-evidence.md` 도 아직 §4.2 갱신 전(261줄, "build 4건")이라 target 본문과 일치하지 않는다.
> - 이 review 세션(`10_36_44`) 은 `62084e807`(08:32) 와 `9f2755822`(10:41) 사이(10:36) 에 번들됐다 — 즉 **커밋되지 않은 초안(작업 중 draft)** 상태를 캡처했고, 그 직후 세션이 스스로 중복을 발견해 되돌린 것으로 보인다.
>
> 결론: 이 target 은 **이미 저장소에서 철회된 초안**이다. 아래 발견사항은 "이 초안을 그대로 커밋한다면" 이라는 가정 하의 정식 검토이며, 실제 반영 여부는 사용자/orchestrator 가 최신 상태(PR #1123 병합 여부)를 확인해 판단해야 한다. 델타 0 (이미 철회됨) 이면 이 리포트에 따른 추가 조치는 불필요하다.

## 발견사항

- **[CRITICAL]** frontmatter `code:` 및 §4.2 표가 존재하지 않는 파일을 "구현 완료 증거"로 주장
  - target 위치: frontmatter `code:` 목록의 `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts` 항목, §4.2 표의 `plan-link-integrity.test.ts (build 차단, ratchet)` 행, §6 Rollout 3번의 "(초기 rollout 은 ... §4.2 family·Gate C 는 kb-quality 에서 추가)" 괄호, R-11 (c) 전체
  - 위반 규약: 본 문서 자체가 정의한 §3 라이프사이클 표 — `status: implemented` 는 "`code:` ≥1 매치 의무"이자, Overview 가 선언한 본 컨벤션의 존재 이유("spec 가 약속한 surface 가 *지금* 구현됐는가"). frontmatter 가 가리키는 개별 파일이 실제로는 존재하지 않는 상태로 커밋되면, 이 문서가 방지하려는 "spec 약속 vs 구현 부재" 갭을 **이 문서 자신이 재현**하게 된다.
  - 상세: `codebase/frontend/src/lib/docs/__tests__/plan-link-integrity.test.ts` 는 현재 저장소 어디에도 없다(현재 브랜치에서 생성 후 삭제됨, PR #1123 도 동일 기능을 `plan-scan.test.ts` 라는 다른 이름으로 구현). `spec-code-paths.test.ts` 가드는 `code:` 배열 중 **≥1개만** glob 매치하면 통과(`codes.some(...)`)하므로 이 한 항목 때문에 build 가 즉시 깨지지는 않지만, 문서가 "9건 가드 구현 파일" 로 열거한 목록에 죽은 경로가 섞여 있다는 사실 자체가 R-1 이 경고한 "stale glob" 실패 모드의 구체 사례다. 게다가 이 기능이 실제로 병합되면(PR #1123) 파일명이 `plan-scan.test.ts` 로 다를 것이 이미 확인됐으므로, 이 초안을 그대로 살리면 **두 개의 서로 다른 이름이 같은 기능을 가리키는 영구 드리프트**가 생긴다.
  - 제안: 이 초안을 되살리지 말 것. plan-lifecycle 게이트 2종(완료 plan 미완 status 차단 + plan 링크 무결성)을 spec-impl-evidence.md 에 반영하려면 PR #1123 이 병합된 뒤 **그 브랜치의 실제 파일명(`plan-scan.test.ts`)** 을 기준으로 §4.2 표·frontmatter `code:`·R-9/R-11 서술을 다시 작성해야 한다. 현재 커밋된 259줄 버전(§4.2 "build 4건", `spec-plan-completion.test.ts` 는 Gate C 전용)이 저장소의 실제 상태와 일치한다.

- **[WARNING]** §4.2 가드 개수 자기모순 — "5건" vs "4건"
  - target 위치: §4.2 도입부("... build 차단 **5건** + advisory 1건 ...") vs §6 Rollout 정책 3번("§4.2 지식저장소·plan 무결성 가드(build **4건** + advisory Gate D)")
  - 위반 규약: 본 문서는 자신을 "§4.2 규약 SoT" 로 선언한다(§4.2 헤더 "본 절이 규약 SoT"). SoT 문서 내부에서 같은 대상(§4.2 build-blocking 가드 개수)에 대해 서로 다른 숫자를 주장하면 SoT 로서의 신뢰성이 깨진다.
  - 상세: §4.2 표를 실제로 세면 build-blocking 파일은 `spec-link-integrity.test.ts`·`spec-area-index.test.ts`·`plan-frontmatter.test.ts`·`spec-plan-completion.test.ts`(Gate C + 2번째 invariant, 동일 파일)·`plan-link-integrity.test.ts` = **5개 파일**이라 §4.2 도입부의 "5건" 은 표와 일치한다. 반면 §6 Rollout 3번은 같은 대상을 "4건" 이라 적어 표·도입부와 어긋난다. (이 항목은 위 CRITICAL 발견과 별개로, "5건이 맞다고 가정해도" 존재하는 초안 내부 자기모순이다.)
  - 제안: §6 Rollout 3번의 "build 4건" 을 §4.2 도입부와 동일한 숫자로 동기화. 혹은 반대로 §4.2 도입부·표를 "4건"(plan-link-integrity 제외)으로 되돌려 §6 과 맞추는 방법도 있음 — 위 CRITICAL 발견(파일 부재)을 해소하는 방향(=plan-link-integrity 행 제거)을 택하면 이 모순도 자동으로 해소된다.

- **[INFO]** Gate D 가 §4.2("지식저장소·plan 무결성") 표 안에 배치돼 절 제목의 도메인과 어긋남
  - target 위치: §4.2 표 마지막 행("**Gate D** (advisory — build 차단 아님)"), §4.2 도입부 및 Overview 괄호("§4.2 의 지식저장소 무결성 가드는 별개 family")
  - 위반 규약: 문서 구조 규약(§ 표/절 제목이 내용을 정확히 대표해야 한다는 일반 원칙) — 직접적인 conventions 위반이라기보다 자기서술 정합성 이슈
  - 상세: §4.2 도입부는 스스로를 "지식저장소(링크·index)·plan frontmatter·plan 완료 정합을 지키는" family 로 규정하는데, Gate D(`/spec-coverage --mode reverse`)는 controller route·이벤트·env 가 spec 에 참조되는지 보는 **impl→spec 역커버리지**로, 지식저장소 링크·plan 정합과는 도메인이 다르다. 오히려 §4 frontmatter-evidence(spec→impl 정방향 증거)의 반대 방향 보완책에 더 가깝다(R-1 이 언급하는 stale-glob 보완 메커니즘과 같은 결).
  - 제안: 필수는 아니나, §4.2 도입부 문장에 "+ impl→spec 역커버리지 advisory" 를 명시적으로 추가하거나, Gate D 를 별도 §4.3(보완 advisory) 로 분리하면 절 제목과 표 내용이 더 정확히 일치함.

## 요약

target(`spec/conventions/spec-impl-evidence.md` draft, 306줄)은 문서 구조(Overview/본문/Rationale), frontmatter 스키마 자기적용, 링크 경로, 예시 코드 등 대부분의 항목에서 정식 규약을 잘 지키고 있고 — 실측 가능한 수치 주장(R-11 의 231/113/15/10/3/2/1/1 breakdown, 90일 TTL, `nav-agent-memory` 접두 사례 등)도 실제 코드·git 이력과 정확히 일치했다. 다만 **가장 중요한 문제는 규약 문구가 아니라 사실관계**다: 이 draft 는 이미 같은 브랜치에서 구현 후 되돌려진(중복 PR #1123 때문에 폐기된) 상태를 캡처한 것이며, 되돌려진 파일(`plan-link-integrity.test.ts`)을 여전히 구현 완료 증거로 주장하는 CRITICAL 결함과, §4.2 가드 개수를 "5건"/"4건" 두 가지로 동시에 주장하는 WARNING 자기모순을 포함한다. 이 draft 를 그대로 `spec/` 에 커밋해서는 안 되며, 병합될 PR #1123 의 실제 파일명·구조를 확인한 뒤 다시 작성해야 한다.

## 위험도

CRITICAL — (단, 위 사실 확인대로 이 초안은 이미 저장소에서 철회된 상태로 추정되므로, **실제 파일에 아직 반영되지 않았다면 이 리포트에 따른 즉시 조치는 불요**하다. 이 draft 를 다시 커밋하려는 시도가 있을 때만 위 CRITICAL 발견이 유효하다.)
