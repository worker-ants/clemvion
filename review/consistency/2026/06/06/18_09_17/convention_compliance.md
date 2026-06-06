# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
검토 범위: `spec/5-system/4-execution-engine.md` (diff base: origin/main)
검토 일시: 2026-06-06

---

## 발견사항

### 1. **[WARNING]** spec 본문에 폐기된 메서드명 `driveResumeDetached` 잔류
- **target 위치**: `spec/5-system/4-execution-engine.md` 라인 128, 903, 1306, 1311
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — spec 은 구현 코드 경로(`code:` 필드)와 정합성을 유지해야 한다. 단일 진실 원칙 (CLAUDE.md "정보 저장 위치")에 따라 spec 본문이 코드 식별자를 인용할 때 실제 코드와 일치해야 한다.
- **상세**: 구현 diff 에서 `execution-engine.service.ts` 의 `private async driveResumeDetached` 가 `driveResumeAwaited` 로 리네임됐다. 테스트 파일(`execution-engine.service.spec.ts`)의 spy/mock 대상 식별자도 전부 `driveResumeAwaited` 로 변경됐다. 그런데 spec 본문에는 구 이름(`driveResumeDetached`)이 4곳에 그대로 남아 있다:
  - 라인 128: `driveResumeDetached`/`driveResumeFrame` 가 도착 continuation payload 를 전달
  - 라인 903: `driveResumeDetached`(top-level, awaited)/`driveCallStackResume`
  - 라인 1306: caller(`runExecution` / `driveResumeDetached`) 가 세그먼트 종료 여부 판단
  - 라인 1311: 종전 `driveResumeDetached` 는 executeInline 스택을 재진입하지 않아...
  라인 1311 의 경우 "종전" 이라는 맥락이 붙어 있어 역사적 서술이지만, 라인 128/903/1306 은 현재 동작 기술에 구 이름을 쓰고 있어 독자 혼란 및 spec-code 불일치를 유발한다.
- **제안**: 라인 128, 903, 1306 의 `driveResumeDetached` 를 `driveResumeAwaited` 로 갱신한다. 라인 1311 은 "종전 `driveResumeDetached`(현 `driveResumeAwaited`)는..." 형태로 이름 변경 사실을 명시하거나, 단순히 `driveResumeAwaited` 로 교체한다(문맥상 이미 "종전 모델의 gap" 서술이라 역사적 맥락은 보존된다).

---

### 2. **[INFO]** spec 문서에 `## Overview` 섹션 미존재
- **target 위치**: `spec/5-system/4-execution-engine.md` 전체 구조
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장 패턴. 현재 `## Rationale` (라인 1171)은 있으나, 명시적인 `## Overview` 섹션 없이 본문(§1 실행 상태 머신)으로 바로 진입한다.
- **상세**: CLAUDE.md 및 각 SKILL.md 가 권장하는 3섹션 구조는 Overview / 본문 / Rationale 이다. 본 파일은 Rationale 섹션은 존재하나 Overview 섹션이 없다. 다만 제목 직하의 `> 관련 문서:` 블록이 overview 역할을 암묵 대체하는 패턴이 다른 spec 파일에서도 공통으로 쓰이므로, 프로젝트 전체 관행상 soft warning 에 해당한다.
- **제안**: 규약 위반의 심각도가 낮고 기존 패턴과 일관성이 있으므로 현상 유지 가능. 그러나 향후 spec 개정 시 `## Overview` 섹션을 추가해 제품 정의(실행 엔진의 책임 범위 요약)를 명시하면 규약 준수도가 높아진다. 또는 conventions 에서 "관련 문서 블록이 Overview 대역으로 인정" 임을 명시하도록 규약 자체를 보강하는 방안도 고려할 수 있다.

---

### 3. **[INFO]** `InteractionTokenService` fail-closed 동작이 spec 에 미반영
- **target 위치**: 구현 diff (`interaction-token.service.ts`, `interaction-token.service.spec.ts`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2` — `code:` 경로로 등재된 구현이 spec 본문 약속과 일치해야 한다.
- **상세**: diff 는 `InteractionTokenService` 생성자에 `NODE_ENV=production` 시 secret 미설정 → throw(fail-closed) 가드를 추가했다. 이 동작은 `spec/5-system/14-external-interaction-api.md §8.3` 에 이미 "프로덕션은 반드시 INTERACTION_JWT_SECRET 또는 JWT_SECRET 를 설정해야 한다"고 서술되어 있지만, fail-closed(생성자 throw)라는 **강제 메커니즘** 자체는 spec 에 명시되지 않았다. `spec/5-system/4-execution-engine.md` 의 직접 담당 범위는 아니나, 검토 대상 diff 에 포함된 변경으로 기록한다.
- **제안**: `spec/5-system/14-external-interaction-api.md §8.3` 에 "프로덕션에서 secret 미설정 시 `InteractionTokenService` 생성자가 fail-closed throw — `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 부팅 가드 패턴과 동일" 한 줄을 추가하면 spec-impl 증거가 완성된다. `spec/` 는 `developer` 직접 수정 불가이므로 `project-planner` 위임 사안.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 를 정확히 따르고, `pending_plans` 에 열거된 plan 파일 4개 모두 `plan/in-progress/` 에 실존하며, `## Rationale` 섹션도 존재한다. 정식 규약 면에서 CRITICAL 위반은 없다. 단, 구현 diff 에서 `driveResumeDetached` 가 `driveResumeAwaited` 로 리네임됐음에도 spec 본문 3곳(라인 128, 903, 1306)이 현재 동작 기술에 구 식별자를 사용하는 WARNING 수준 불일치가 있다 — 독자가 spec 을 보고 코드를 찾거나 역으로 코드를 보고 spec 을 조회할 때 명칭 혼동을 유발한다. 이 3곳을 `driveResumeAwaited` 로 갱신하는 것이 권장된다.

---

## 위험도

LOW
