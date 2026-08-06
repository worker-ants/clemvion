# 정식 규약 준수 검토 — convention_compliance

## 검토 모드
구현 완료 후 검토 (--impl-done, scope=`spec/conventions`, diff-base=`origin/main`)

## 사전 검증 (diff 실측)

- `git diff origin/main...HEAD --stat -- spec` → **출력 없음** (spec/ 하위 전체에 변경 파일 0개, `spec/conventions/**` 포함).
- `code_areas` (`.claude.project.json`) = `["codebase"]`. `git diff origin/main...HEAD -- codebase` 실측 결과, 변경분은 아래 7개 패키지 `package.json` 의 `prepare` 스크립트뿐이다 (TypeScript 부재 시 fail-fast 가드 추가):
  - `codebase/packages/ai-end-reason/package.json`
  - `codebase/packages/chat-channel-validation/package.json`
  - `codebase/packages/expression-engine/package.json`
  - `codebase/packages/graph-warning-rules/package.json`
  - `codebase/packages/node-summary/package.json`
  - `codebase/packages/sdk/package.json`
  - `codebase/packages/web-chat-sdk/package.json`
- 나머지 diff(`.github/workflows/harness-checks.yml`, `.claude/tests/test_packages_prepare_contract.py`, `review/code/2026/08/06/18_55_02/**`)는 `code_areas` 필터 밖이라 이번 impl-done 번들의 diff 섹션에는 반영되지 않는다.

즉 이번 브랜치는 **spec/conventions 문서를 전혀 건드리지 않았고**, `code_areas` diff 역시 API endpoint·이벤트 페이로드·에러 코드·문서 명명 등 conventions 가 규율하는 표면과 무관한 `package.json` 빌드 스크립트 변경뿐이다. `spec/conventions/**` 안에 `package.json` `prepare` 스크립트나 pnpm build 파이프라인을 규율하는 컨벤션은 존재하지 않는다 (grep 결과 없음).

## 발견사항

없음 — 이번 diff 로 인해 신규 도입되거나 위반된 정식 규약 항목이 없다. impl-done 모드는 diff 기반 사후 검증이 목적이므로, diff 가 없는 영역(`spec/conventions/**`)에 대해 "구현이 spec 을 위반했다" 류의 CRITICAL/WARNING 을 성립시킬 근거가 없다.

- **[INFO]** 번들된 target 문서가 diff 와 무관한 전체 conventions 코퍼스임
  - target 위치: 프롬프트 `## Target 문서` 전체 (spec/conventions/** 대부분, 264개 파일은 컨텍스트 예산 초과로 생략)
  - 위반 규약: 해당 없음 (규약 위반이 아니라 orchestrator 번들링 특성)
  - 상세: `--impl-done spec/conventions` 로 호출되었으나 이번 브랜치의 실제 diff(`git diff origin/main...HEAD`)는 `spec/` 하위를 전혀 건드리지 않는다. 그 결과 번들은 diff 대조용이 아니라 spec/conventions 전체의 static dump 가 되었고, `code_areas` 필터(`["codebase"]`) 때문에 실제 코드 변경분 중 `.github/workflows/**`·`.claude/tests/**`(이번 PR 의 핵심 변경인 CI 백스톱/gate 로직)는 diff 섹션에 아예 나타나지 않는다.
  - 제안: 이 자체는 정식 규약 위반이 아니라 `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` 의 `code_areas=["codebase"]` 설정과 `.github/workflows/**` 변경이 겹치는 케이스에 대한 정보 공유. 다른 checker(예: architecture/scope reviewer)가 `.github/workflows/review-gate.yml` 변경 자체를 이미 다루고 있다면 이 항목은 조치 불요.
  - (표본 점검) 컨텍스트에 실제로 포함된 문서 중 `spec/conventions/audit-actions.md` 는 frontmatter(`id`/`status`/`code`) + `## Overview` / 본문(§1~§3) / `## Rationale` 3섹션 구조를 정확히 따르고 있어 CLAUDE.md 문서 구조 컨벤션과 일치한다 (특이사항 없음). `spec/conventions/cafe24-api-catalog/_overview.md` 도 §1~§8 + `## Rationale` 구조로 일관됨. 이 표본들은 diff 밖이라 이번 판정에는 영향 없음(참고용).

## 요약
이번 브랜치(diff-base `origin/main`)는 `spec/conventions/**` 를 전혀 변경하지 않았으며(`git diff --stat -- spec` 실측 결과 0건), `code_areas` 로 잡히는 `codebase/**` 변경도 7개 패키지 `package.json` 의 `prepare` 스크립트(TypeScript 부재 fail-fast 가드) 뿐이라 명명·출력 포맷·문서 구조·API 문서·금지 항목 등 conventions 가 규율하는 표면과 접점이 없다. 표본으로 열어본 기존 conventions 문서(`audit-actions.md`, `cafe24-api-catalog/_overview.md`)도 구조·명명 상 특이사항이 없었다. 따라서 이 checker 관점에서 이번 변경이 정식 규약을 위반한다고 판단할 근거가 없다.

## 위험도
NONE
