# Plan 정합성 검토 — target `spec/5-system` (`--impl-prep`)

## 발견사항

- **[WARNING]** 부트 캐너리 Rationale 에 박힌 캐럿 버전 `^11.0.1` 이 이 plan 자신의 실행으로 낡는다
  - target 위치: `spec/5-system/1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection 자가검증" (806~807행), 원문: `` (`@nestjs/*` 는 caret `^11.0.1` 이라 minor/patch 업그레이드로도 온다) ``
  - 관련 plan: `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §E 종결 조건, `frontmatter: spec_impact: none`
  - 상세: 이 문장은 reflection 판별이 `@nestjs/common` 비공개 API 에 기대는 위험을 설명하며 **현재 고정된 캐럿 값**을 구체적으로 인용한다(`^11.0.1`). `nestjs-v12-coordinated-upgrade.md` 가 목표로 하는 바로 그 작업 — `@nestjs/*` 전 패키지를 v12 로 올리는 것 — 이 완료되면 `codebase/backend/package.json` 의 실제 캐럿 값은 `^11.0.1` 이 아니게 되어 이 문장은 사실과 어긋난다(실측: 현재 `package.json` 에 `@nestjs/common: ^11.0.1` 확인, 업그레이드 후 `^12.x.x` 로 바뀔 것). 저장소는 이미 같은 실수 클래스를 한 번 겪고 교정한 전례가 있다 — 같은 Rationale 절 인접 문단이 "부트 캐너리 소비 라우트 수(142)를 spec 에 미러링하지 말 것 — 스냅샷이라 조용히 stale 해진다" 고 명시적으로 적어 두었다(`spec-canary-count-relation` planner 턴). 그런데 바로 옆 문장의 버전 숫자는 같은 원칙이 적용되지 않은 채 남아 있다. `CHANGELOG.md` 의 동형 문장(2865행 부근)은 이미 "caret 범위라" 로만 적어 숫자를 빼 두었는데, spec 쪽만 구체 버전을 유지한다.
  - `nestjs-v12-coordinated-upgrade.md` §E "종결 조건"·"후속" 어디에도 이 spec 문장을 정정하는 항목이 없다. `spec_impact: none` 이 이 사실 정정까지 포함하는지 불명확 — 이 문장의 정정은 developer 자기-반증형 소정정 예외(예고·트리거 문장에 한정) 대상이 아니다(이 문장은 예고가 아니라 현재 상태 서술 + Rationale 설명이므로), planner 턴이 필요하다.
  - 제안: `nestjs-v12-coordinated-upgrade.md` §E 또는 "후속 (이 PR 밖)" 에 "`1-auth.md` 806~807행의 `^11.0.1` 을 실제 업그레이드 후 캐럿 범위로 갱신하거나(권장: 숫자를 빼고 CHANGELOG 와 동형으로 `caret 범위라` 로 일반화) planner 턴으로 넘긴다" 는 항목을 추가할 것. 업그레이드 전에는 조치 불필요(문장이 아직 참이므로) — 실행 완료 시점에만 유효해지는 후속 항목이라 지금 plan 에 "종결 조건 이후 처리" 로 등재하면 된다.

## 요약

target `spec/5-system` 번들(특히 `1-auth.md` reflection/부트 캐너리 절)과 진행 중인 두 관련 plan(`nestjs-v12-coordinated-upgrade.md`, `auth-guard-reflection-hardening.md`) 사이에 결정 충돌이나 선행 조건 미해소는 발견되지 않았다. 선행 조건(§B, PR #1387/`0b5b226b3`)은 실측대로 충족돼 있고, §C 의 reflection 보안 회귀 우선조사 방침은 spec Rationale·`auth-guard-reflection-hardening.md` §1·`CHANGELOG.md` 세 곳과 정확히 정렬되며, 업그레이드 전 기준값(캐너리 142건, 3스위트 48/48, mutation-break 9건 RED)도 그 방침이 요구하는 형태 그대로 이미 실측·기록돼 있다. `1-auth.md` 의 `pending_plans`(spec-sync-auth-gaps.md)는 프롬프트 예산 때문에 번들에서 생략됐으나 직접 열어 확인한 결과 LDAP/SAML·감사 로깅 갭 등 완전히 다른 주제라 이번 두 plan 과 충돌하지 않는다. 유일한 실질 지적은 이 plan 의 실행 자체가 target spec 문서 안의 구체적 버전 숫자(`^11.0.1`)를 낡게 만드는데 그 정정이 plan 의 종결 조건에 반영돼 있지 않다는 점으로, 심각도는 낮지만(이 저장소가 이미 같은 클래스의 실수를 옆 문단에서 교정한 전례가 있어) 후속 항목으로 등재할 가치가 있다.

## 위험도

LOW
