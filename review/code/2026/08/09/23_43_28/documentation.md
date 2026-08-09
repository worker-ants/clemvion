# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** 신설된 두 규칙이 §4 에만 추가되고, 실제 "이동 시 확인" 체크리스트(§5)에는 반영되지 않음
  - 위치: `.claude/docs/plan-lifecycle.md:97-107` (§5 "이동 commit 자가 점검" — 이번 diff 로 변경되지 않은 기존 구간). 신설 규칙 자체는 같은 파일 `:79-90` (§4, diff 로 추가된 부분).
  - 상세: 이번 PR 은 "`complete/` 이동 시 `status:` 미갱신" 과 "이동 시 형제 plan 상대링크 깨짐" 이라는 **두 번 놓친 실패**(`#1108`·`#1117`)를 build guard(`plan-frontmatter.test.ts`)로 게이트화하고, 그 규칙을 §4(Frontmatter 스키마) 에 문서화했다. 그런데 정작 "plan 을 `complete/` 로 옮길 때 커밋 전에 무엇을 확인해야 하는가"를 나열한 §5 "이동 commit 자가 점검" 체크리스트(`- [ ] 본 PR 의 변경으로 plan 의 모든 체크박스가 [x] 인가` 등 5개 항목)는 이번 diff 에서 전혀 갱신되지 않았다. §3 "이동 규칙"에도 두 규칙에 대한 언급이 없다. 실제 강제는 build guard 가 여전히 하므로 기능적 위험은 낮지만(테스트 실패 메시지 자체가 "status: 를 함께 갱신하거나 TERMINAL_STATUSES 에 등재할 것" 처럼 조치법을 안내함), 이 PR 의 취지 자체가 "사람의 규율에만 기대던 필드에 게이트를 단다"는 것이었던 만큼, 같은 파일 안에서 사람이 직접 참조하는 체크리스트가 새 규칙을 누락한 채로 남아 있는 것은 문서 정합성 관점에서 이 PR 이 스스로 지적한 문제의 축소판이다. 다음에 §5 체크리스트만 보고 이동하는 사람은 여전히 두 항목을 놓칠 수 있다(테스트가 잡아주긴 하지만, 실패 후에야 안다).
  - 제안: §5 체크리스트에 두 항목을 추가한다 — 예: `- [ ] status: 를 선언했다면 종료 상태(TERMINAL_STATUSES)로 갱신했는가` / `- [ ] 형제 plan 을 가리키던 상대링크를 ../complete/<name> 으로 정정했는가`. 필요하면 §3 "이동 규칙"에도 한 줄 교차 참조를 추가.

- **[INFO]** §2.1 의 "build guard 강제 범위 = `plan/in-progress/*.md`" 서술이 이번 PR 이후 부분적으로만 정확
  - 위치: `.claude/docs/plan-lifecycle.md:32` (이번 diff 로 변경되지 않은 기존 문장)
  - 상세: "다만 build guard `plan-frontmatter.test.ts` 의 강제 범위는 `plan/in-progress/*.md` 이므로 `research/` 는 가드 대상 아님" 이라는 문장은 `worktree`/`started`/`owner` 3-필드 스키마 체크에 한정하면 여전히 참이지만, 이번 PR 로 같은 파일(`plan-frontmatter.test.ts`)이 `plan/complete/**` 전수(status 검사)와 top-level `in-progress` 링크 무결성까지 함께 검사하게 되어, 문장만 보면 이 테스트 파일의 스코프를 `plan/in-progress/*.md` 로만 오인하기 쉽다. `research/` 가 가드 대상이 아니라는 결론 자체는 (두 신규 검사 모두 research/ 를 보지 않으므로) 변하지 않아 실질 오류는 아니다.
  - 제안: 우선순위 낮음. 필요 시 "(3-필드 스키마 한정)" 같은 괄호를 덧붙여 새 두 검사와 스코프가 다름을 명시하면 더 정확해진다.

## 검토 확인 사항 (문제 없음)

- `.claude/docs/plan-lifecycle.md` 신설 문단(§4, `:79-90`)의 `TERMINAL_STATUSES` 값 목록(`complete`/`implemented`/`applied`/`superseded`)·"선택 필드" 서술·"`plan/complete/**` 는 링크 검사 대상 아님" 서술이 `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts` 의 실제 코드(`TERMINAL_STATUSES` 상수, `status` optional 처리, `collectTopLevelPlans` 스코프)와 정확히 일치함을 확인.
- `plan-frontmatter.test.ts` 의 신설 함수(`collectCompletedPlans`, `relativeLinkTargets`)와 상수(`TERMINAL_STATUSES`)에 목적·제외 사유(`archive` 제외, 등재 판단 기준 등)를 설명하는 JSDoc/인라인 주석이 충실하며, 두 신규 `describe`/`it` 블록에도 vacuity 방지 이유·실패 메시지에 조치 방법이 함께 적혀 있어 인라인 문서화 수준이 높음.
- `plan/complete/**`·`plan/in-progress/**` 의 `status:` 필드 일괄 정정(파일 3~19) 및 상대링크 정정(`../complete/<name>` 형태, 파일 20~22, 24~26)은 모두 신설 규약과 일치하며 문서 서술과 실제 변경 내용 사이 불일치 없음. `c1-pr2-aiturn-blueprint.md` 의 `status: complete (PR #625 머지)` → `status: complete` + 별도 `merged_pr: 625` 필드 분리도 YAML 파서 기준으로 올바른 정정.
- 신설 `plan/complete/spec-draft-secret-store-verification-footnote.md` 는 두 세션 병렬 작업으로 spec 이 일시적으로 stale 해진 경위·정정 근거·기각 대안을 `## Rationale` 에 충실히 기록했고, 이번 두 게이트 신설 사실도 자신의 "후속" 섹션에 이미 기록해 두어 harness 변경(`plan-frontmatter.test.ts`)이 별도 owning plan 없이 이뤄진 것에 대한 추적성이 확보됨(ad-hoc 이스케이프이지만 문서상 유실 없음).
- 저장소 관행상 `CHANGELOG.md` 는 product/spec 영향 변경만 기록하고 harness/CI/plan 프로세스성 변경은 기록하지 않는 기존 패턴과 일치 — 이번 PR 에 대한 CHANGELOG 누락은 결함 아님.

## 요약

이번 변경은 "plan 이동 시 `status` 모순·상대링크 깨짐을 사람의 규율에만 맡기던" 실제 갭을 build guard 로 닫고, 그 규칙을 `plan-lifecycle.md` §4 에 정확하고 근거(뮤테이션 검증 수치·과거 실패 사례 `#1108`/`#1117`)와 함께 문서화했다. 테스트 파일의 인라인 주석 밀도와 정확성도 높다. 다만 같은 문서 내 §5 "이동 commit 자가 점검" 체크리스트가 이 두 신규 규칙을 반영하지 않아, 사람이 직접 참조하는 체크리스트와 실제 게이트 사이에 문서 정합성 공백이 남는다(WARNING 1건). 그 외 대량의 `status:`/링크 일괄 정정 파일들은 신설 규약과 정확히 일치한다.

## 위험도

LOW
