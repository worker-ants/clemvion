# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 사용자 보고 버그 fix 에 대한 CHANGELOG.md 엔트리 누락
  - 위치: `CHANGELOG.md` (본 diff 에 변경 없음), 대응 커밋 `34008deb5 fix(navigation): 사용자 가이드(/docs) 진입 시 /w/<slug> 무한 중첩 라우팅 fix`
  - 상세: 이 저장소는 사용자 가시 동작에 영향을 주는 feat/fix 커밋에 대해 `CHANGELOG.md` 에 `## Unreleased — ...` 절을 남기는 것이 확립된 관행이다. 직전 커밋들(`734864d4b fix(chat-channel): ...`, `693e52fe1 feat(ai-agent): ...`)은 모두 대응 CHANGELOG 절을 갖고 있고, 특히 같은 기능 영역(슬러그 라우팅)의 phase 1·phase 2 구현 시에도 상세한 CHANGELOG 절이 작성됐다(`CHANGELOG.md:201`, `:207` — "활성 워크스페이스가 URL 경로로 반영된다" 등). 반면 본 PR 은 실사용자가 보고한 "가이드 페이지에 영원히 도달 못 함" 회귀를 고치는 fix 임에도 CHANGELOG 엔트리가 없다. PROJECT.md §변경 유형→갱신 위치 매핑 표에는 이 케이스에 대응하는 명시적 행이 없어 개발자가 "해당 행 없음"으로 판단한 것은 그 표 기준으로는 맞지만, CHANGELOG 관행은 그 표 밖에서 별도로 지켜지고 있다.
  - 제안: 커밋 메시지 본문(원인 2단·수정 내용·검증)이 이미 CHANGELOG 절 수준으로 잘 작성돼 있으므로, 이를 재사용해 `## Unreleased — 사용자 가이드(/docs) 진입 시 워크스페이스 slug 무한 중첩 fix` 절을 추가할 것을 권장.

- **[INFO]** (긍정) 스테일(stale) 독스트링을 같은 PR 안에서 발견·정정
  - 위치: `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 상단 JSDoc
  - 상세: 기존 독스트링의 전제 "specific route 가 우선하므로 `/w/[slug]/...`·`/docs/...` 는 여기 오지 않는다" 는 실제로 틀린 서술이었고(이번 버그의 근본 원인 중 하나), 본 diff 가 이를 정확한 설명("이미 `/w/` 로 시작하는 경로는 여기서 종결한다")으로 정정했다. `plan/in-progress/user-guide-routing-loop-fix.md` 의 consistency-check 대응 섹션(I#5)에도 이 정정이 명시적으로 추적되어 있다. 문서화 관점에서 모범 사례.
  - 제안: 없음(권장 패턴으로 유지).

- **[INFO]** JSDoc/주석 품질 전반 우수
  - 위치: `page.tsx`, `sidebar.tsx` (`navItems` 상단 + `isActive` 계산부), `href.ts` (`buildWorkspaceHref`), 신규 테스트 3종(e2e·unit·sidebar) 상단 블록
  - 상세: 모든 변경 파일이 "증상 → 근본 원인 → 채택하지 않은 대안과 그 이유(idempotent 화 미채택, strip-and-reforward 미채택) → spec 근거"를 명시한다. 특히 `href.ts` 의 "비-idempotent 는 의도된 것" 단락은 향후 리뷰어/개발자가 같은 실수(호출자 버그를 헬퍼가 조용히 삼키게 만드는 시도)를 반복하지 않도록 근거를 명문화했다. `spec/2-navigation/_layout.md §2.2`, `9-user-profile.md §3`, `11-error-empty-states.md §1.3` 인용을 실제 spec 본문과 대조 확인했고 모두 정확하다.
  - 제안: 없음.

- **[INFO]** spec 본문 갱신은 별도 draft 로 위임 처리(정상 프로세스 준수, 단 미완결 추적 필요)
  - 위치: `plan/in-progress/spec-update-catch-all-terminal-contract.md` (신규, 본 diff 범위 밖으로 orchestrator payload 에는 포함 안 됨 — 직접 확인)
  - 상세: catch-all 의 실제 계약이 "흡수(redirect)만" 에서 "`/w/` 접두는 terminal(dashboard forward 또는 404)" 로 넓어졌으나, developer 는 `spec/` 쓰기 권한이 없어 CLAUDE.md §Skill 체계에 따라 project-planner 위임 draft 를 작성했다. draft 는 `_layout.md`/`9-user-profile.md`/`11-error-empty-states.md` 3곳에 대한 구체적 patch 문안까지 준비돼 있고, `_layout.md` frontmatter `code:` 글로브에 `(main)/[...rest]/page.tsx` 가 아직 미포함임을 스스로 확인해 반영 후속 항목으로 남겼다(실제 확인 결과 맞음 — 현재 `code:` 는 `components/layout/**` 등만 포함). 본 PR 의 `plan/in-progress/user-guide-routing-loop-fix.md` 체크리스트 항목 10("spec 보강 draft → project-planner 위임")은 아직 미체크 상태다.
  - 제안: spec 본문 반영이 완료되기 전까지는, 코드의 실제 계약(terminal 404/redirect)과 spec 문언(흡수만 서술) 사이에 일시적 gap 이 존재함을 인지하고 project-planner 위임을 빠르게 후속 진행할 것. (현재는 explicit 하게 추적되고 있어 CRITICAL 로 격상하지 않음.)

- **[INFO]** README·API 문서·신규 설정 문서화: 해당 없음 확인
  - 위치: `PROJECT.md` §변경 유형 → 갱신 위치 매핑
  - 상세: 본 변경은 신규 API 엔드포인트, 신규 env, 신규 노드 schema, 신규 UI 문자열(i18n)을 도입하지 않는 순수 FE 라우팅 버그 fix다. 매핑 표 전 행을 대조한 결과 대응 행이 없음을 독립적으로 재확인했다 — plan 문서(`user-guide-routing-loop-fix.md` §작업체크리스트 4)의 자체 판단과 일치.
  - 제안: 없음.

- **[INFO]** (경미) `sidebar.tsx` `isActive` 인라인 주석의 미세한 불완전성
  - 위치: `codebase/frontend/src/components/layout/sidebar.tsx` (변경된 `isActive` 계산부 주석)
  - 상세: 주석은 "catch-all 이 아직 흡수하지 않은 bare 경로에선 `item.href` 로 활성 판정한다"고 설명하나, `workspaceScoped: false` 인 유일한 항목(`/docs`)은 애초에 `href === item.href` 라 이 두 번째 `startsWith` 조건이 사실상 no-op 이라는 점까지는 짚지 않는다. 로직 자체는 정확하고 회귀도 아니므로 문서화 결함이라기보다 사소한 설명 보완 여지.
  - 제안: 필요 시 "workspaceScoped:false 항목은 href===item.href 라 두 조건이 동치" 한 줄만 보강 가능(선택 사항, 낮은 우선순위).

- **[INFO]** 범위 밖 파일(`plan/complete/ai-agent-tool-payload-budget-followups.md`) 변경은 별개 관심사이나 문서화 품질 양호
  - 위치: 파일 7 (frontmatter `status: complete` + `spec_impact:` 추가)
  - 상세: 이번 라우팅 fix 와 무관한, 선행 plan(#955/#956)의 Gate C(spec-plan-completion) frontmatter 보정이다. 근거 출처(`git show --name-only 693e52fe1 7aa7856a5 -- spec/`)를 주석으로 남겨 추적 가능성이 좋다. 본 PR 의 diff 에 섞여 있는 이유는 불명확하나 문서화 관점 결함은 아니다.
  - 제안: (문서화 범위 밖) 이 변경이 의도적으로 같은 커밋/PR 에 포함된 것인지 정도만 확인 권장.

## 요약

전반적으로 이번 변경의 문서화 수준은 매우 높다 — 모든 핵심 파일(page.tsx, sidebar.tsx, href.ts)과 신규 테스트에 "증상·근본원인·채택하지 않은 대안·spec 근거"를 포함한 상세 독스트링이 있고, 기존에 존재하던 반증된(stale) 독스트링을 같은 PR 안에서 발견해 정정했으며, spec 인용은 전수 대조 결과 모두 정확하다. spec 본문 자체의 계약 확장(catch-all terminal 동작)은 developer 의 쓰기 권한 제약에 따라 project-planner 위임 draft 로 적절히 분리돼 있어 프로세스상 문제는 없다. 유일한 실질적 공백은 사용자 보고 버그 fix 임에도 이 저장소의 확립된 관행인 `CHANGELOG.md` "Unreleased" 절이 누락된 점이며, 이는 커밋 메시지 재사용만으로 쉽게 보완 가능하다.

## 위험도

LOW
