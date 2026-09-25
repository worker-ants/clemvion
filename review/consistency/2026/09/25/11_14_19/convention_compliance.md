# 정식 규약 준수 검토 — `plan/in-progress/lockfile-libc-pin.md`

## 검토 범위 및 전제

target 은 `plan/` 문서(개발 작업 plan)이며 `spec/` 문서가 아니다. 검토 관점 3("문서 구조 규약")이 언급하는 Overview/본문/Rationale 3섹션·`_product-overview.md`·`0-` prefix 규칙은 CLAUDE.md 상 **`spec/` 문서 전용** 규약이고, plan 문서의 구조·frontmatter 규약은 별도로 [`.claude/docs/plan-lifecycle.md`](../../../../.claude/docs/plan-lifecycle.md) 가 SoT 다. 따라서 본 검토는 (a) plan-lifecycle.md 의 frontmatter/배치 규약, (b) `spec/conventions/**` 25개 정식 규약 파일과의 저촉 여부, 두 축으로 수행했다.

`spec/conventions/**` 전체 목록을 확인한 결과 audit action 명명, cafe24/makeshop API 카탈로그, chat-channel-adapter, conversation-thread, egress-masking, error-codes, node-cancellation/output, secret-store, swagger, migrations 등 25개 파일은 모두 **API/DTO/DB 마이그레이션/도메인 명명** 규약이며, target(pnpm `packageManager` 핀 상향 + lockfile `libc:` 진동 해소)은 이 중 어느 도메인도 건드리지 않는다(`spec_impact: none` 이 실측과 일치 — B절 변경 파일은 `package.json`·`Dockerfile.playwright-e2e` 뿐, API endpoint·DTO·audit action·DB 마이그레이션 없음). 즉 관점 2(출력 포맷)·4(API 문서 규약)는 target 에 해당 표면이 아예 없어 **적용 대상 없음(N/A)**.

## 발견사항

해당 사항 없음 (CRITICAL/WARNING 없음).

아래는 확인했으나 위반이 아니라고 판단한 항목들이다 (참고용):

- **frontmatter 스키마 준수** — `worktree`/`started`/`owner` 필수 3필드가 모두 존재하고(`lockfile-libc-oscillation`/`2026-09-25`/`developer`), 값의 형식도 plan-lifecycle.md §4 예시와 일치한다. `title`/`status`/`spec_impact` 는 허용된 추가 필드다.
- **`spec_impact: none` 조기 선언** — plan-lifecycle.md §4 는 `spec_impact` 를 "완료 시점 필드(Gate C)" 로 규정하며 in-progress 단계 의무는 아니라고 명시하지만, 조기 선언 자체를 금지하지도 않는다. `hasValidSpecImpact` 판정 기준(문자열이면 `none`/`없음`/`n/a`/`na` 리터럴만 허용)에도 부합하는 값이라 완료 이동 시 그대로 두어도 게이트를 통과한다.
- **파일 배치·명명** — `plan/in-progress/<kebab-case>.md` 위치·명명이 CLAUDE.md "정보 저장 위치" 표 및 plan-lifecycle.md §1 과 일치한다.
- **`packageManager` 필드로 pnpm 버전 고정** — B절의 처방(`package.json` 의 `packageManager: pnpm@10.34.5`)은 PROJECT.md 의 명시 규약("pnpm 버전은 루트 `package.json` 의 `packageManager` 필드(corepack)로 고정한다")과 정확히 일치하는 경로를 쓴다. 새 버전 고정 메커니즘을 발명하지 않았다.
- **사전 일관성 검토 모드 선택** — C절 체크리스트가 "spec 영역이 없는 변경이라 `--impl-prep` 의 scope 가 성립하지 않는다 → 이 plan 을 target 으로 `--plan`" 이라고 스스로 근거를 적은 것은 CLAUDE.md "developer 는 구현 착수 직전 consistency-check --impl-prep 의무" 조항과 consistency-checker SKILL.md 의 `--plan`/`--impl-prep` 모드 구분(§실행 절차 1)에 부합하는 정확한 모드 선택이다.

## 요약

target 은 pnpm lockfile 의 `libc:` 필드 진동을 해소하기 위한 개발 작업 plan 으로, spec 영역·API 계약·DTO·audit action·DB 마이그레이션 등 `spec/conventions/**` 가 규율하는 어떤 표면도 건드리지 않는다(코드 변경 범위가 `package.json`·Dockerfile 의 pnpm 버전 문자열 두 곳뿐이며 `spec_impact: none` 이 실측과 부합). plan 자체의 frontmatter·배치·모드 선택은 plan-lifecycle.md 및 CLAUDE.md 규약과 정확히 일치하고, 처방 내용도 PROJECT.md 가 지정한 `packageManager` 필드 경로를 그대로 따른다. 정식 규약 준수 관점에서 위반·경계 사례를 발견하지 못했다.

## 위험도

NONE
