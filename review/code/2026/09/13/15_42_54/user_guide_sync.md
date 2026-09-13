# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]` 21건, id: `new-node`, `node-schema-change`,
`new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`,
`new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`,
`new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`,
`new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`,
`expression-language-change`, `run-debug-flow-change`, `env-runtime-change`,
`spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found`)를 Read.
`PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문도 보조로 확인.

## 변경 파일 식별

`git diff --stat origin/main...HEAD` (44 files, +2717/-393) 기준, 구성은 다음 4그룹뿐이다:

1. `CHANGELOG.md`, `PROJECT.md` — 가드 카탈로그 문구 갱신 (구 `guide-error-code-existence` →
   신 `guide-identifier-existence` 리네임 반영)
2. `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` /
   `guide-error-code-scan.ts` (삭제) → `guide-identifier-existence.test.ts` /
   `guide-identifier-scan.ts` (신규) + `guide-sanitized-message-parity.test.ts` (주석 1줄 갱신)
3. `plan/in-progress/guide-identifier-existence.md`,
   `plan/in-progress/spec-draft-nullable-notation-followups.md` — 작업 추적 문서
4. `review/code/2026/09/13/14_41_14/**`, `review/code/2026/09/13/15_03_06/**`,
   `review/consistency/2026/09/13/12_33_41/**` — 이전 라운드 리뷰/컨시스턴시 산출물

추가로 working tree 에 `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
미커밋 수정 1건이 있다(같은 파일 계열의 소폭 편집으로 보이며 위 그룹 2 의 연장선).

## trigger 매칭 검사

매트릭스 각 행의 trigger glob/semantic 을 대조:

- `new-node` / `node-schema-change` (`codebase/backend/src/nodes/**`) — 매칭 파일 없음
  (`git diff --stat origin/main...HEAD -- codebase/backend/src/nodes` 결과 없음)
- `new-ui-string` (`codebase/frontend/src/**/*.tsx`) — TSX 변경 없음
- `new-widget-chrome-string` (`codebase/channel-web-chat/**`) — 변경 없음
- `integration-provider-change` — 신규/변경 provider 코드 없음
- `new-userguide-section-dir` (`codebase/frontend/src/content/docs/*/`) — 변경 없음
  (`codebase/frontend/src/lib/docs/__tests__/` 는 `src/content/docs/` 가 아니라 **가이드를
  검증하는 테스트 코드 위치**이며 이 trigger 의 glob 대상이 아니다)
- `backend-api-change` (`*.controller.ts`, `dto/**`) — 변경 없음
- `new-bullmq-queue` (`system-status.constants.ts`) — 변경 없음
- `new-warning-code` / `new-error-code` (`error-codes.ts` 등) — 변경 없음
  (`git diff --stat origin/main...HEAD -- codebase/backend/src/nodes/core/error-codes.ts` 결과 없음)
- `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — 변경 없음
- `expression-language-change` (`codebase/packages/expression-engine/**`) — 변경 없음
- `run-debug-flow-change` (실행·디버깅 흐름, semantic) — backend 실행 엔진 변경 없음
- `env-runtime-change` — README 대상 변경(신규 env var·기동 방법 변경) 없음
- `spec-major-change` (`spec/2-*/**` 등) — `spec/` 변경 없음
- `userguide-gui-flow-section` (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`) — 변경 없음
- `spec-defect-found` — `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  무관 백로그(cafe24 Principle 오인용) 1건이 등재됐으나, 이는 이번 diff 의 목적과 무관한
  건으로 별도 문서(`review/code/.../scope.md`)에서 이미 "무관 명시 + 관례 준수"로 처리됨.
  본 리뷰 관점(유저 가이드 동반 갱신)과는 무관.

## 판정

이번 changeset 은 **유저 가이드(MDX 문서) 자체를 검증하는 harness 가드 테스트의 내부
재설계**(`guide-error-code-*` → `guide-identifier-*` 리네임 + 축 확장 + 허용목록 도입)이며,
매트릭스가 규정하는 "유저 가이드가 동반 갱신돼야 하는 원인 코드"(신규 노드, 노드 schema
변경, provider 변경, 신규 UI 문자열, 신규 섹션 디렉토리, 인증/표현식/실행 흐름 변경,
신규 warning/error code) 그 어느 것에도 해당하지 않는다. 오히려 이번 PR 은 그 매트릭스가
막으려는 결함(가이드가 존재하지 않는 식별자를 인용하는 것)을 **검출하는 도구를 개선**하는
메타 레벨 작업이다. `codebase/frontend/src/content/docs/**` (실제 유저 가이드 MDX 원문),
`codebase/frontend/src/lib/i18n/dict/**`, `backend-labels.ts`, `codebase/frontend/src/lib/docs/
locale.ts` 어느 것도 diff 에 없다.

## 발견사항

없음 — 매칭되는 trigger 가 없어 동반 갱신 누락을 판정할 대상 자체가 없다.

(참고: 자매 문서 `guide-sanitized-message-parity.test.ts:16` 의 "자매" 상호참조 주석이
리네임 전 옛 파일명(`guide-error-code-existence.test.ts`)을 인용하던 stale 참조는 이미
이번 diff 의 파일 7 에서 `guide-identifier-existence.test.ts`(`#1330` 당시 옛 이름 병기)로
갱신되어 있음을 확인했다 — 다른 리뷰어(maintainability/side_effect/dependency)가 이전
라운드에서 지적했고 이번 diff 에 반영된 것으로 보인다. 이는 본 리뷰어의 점검 관점(유저
가이드 동반 갱신 매트릭스) 밖의 내부 코드 주석 정합성 문제이므로 여기서는 정보로만
남긴다.)

## 요약

매트릭스 trigger 21행 전수 대조 결과 이번 changeset(44 files, `CHANGELOG.md`/`PROJECT.md`
문구 갱신 + `guide-error-code-*`→`guide-identifier-*` 가드 테스트 리네임/재설계 +
plan/review 산출물)은 어떤 trigger 에도 매칭되지 않는다 — 노드·provider·UI 문자열·섹션
디렉토리·인증·표현식·실행 흐름·warning/error code 발행 어느 것도 변경되지 않았고, 변경된
파일은 오히려 유저 가이드를 검증하는 harness 가드 자체이다. 동반 갱신 누락 0건.

## 위험도

NONE
