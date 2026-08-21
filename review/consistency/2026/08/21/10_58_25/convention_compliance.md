# 정식 규약 준수 검토 — `plan/in-progress/masked-marker-shared-package.md`

## 검토 방법 메모

`_prompts/convention_compliance.md` 에 번들된 `spec/conventions/**` 사본 대부분이 "컨텍스트 예산 초과" 로 절단되어(`error-codes.md`·`execution-context.md`·`spec-impl-evidence.md`·`frontend-layering.md`·`node-output.md` 등 핵심 문서 전부 포함) 번들만으로는 판단 근거가 부족했다. 대신 target worktree(`masked-marker-contract-7d2e14`)의 실제 `spec/conventions/**` 파일을 직접 읽어 대조했다(`spec-impl-evidence.md`, `frontend-layering.md`, `error-codes.md`, `node-output.md`, `secret-store.md`, `conversation-thread.md` 등 전문 확인). 아울러 target 이 인용한 사실 주장(심볼명·라인 번호·선례 패키지 구조)을 실제 코드/스펙에서 실측 검증했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 아래는 확인 과정에서 나온 참고 사항이다.

- **[INFO]** 공유 패키지(`codebase/packages/**`) 신설·명명·등록표면에 대한 전용 정식 규약 문서가 없다
  - target 위치: "무엇을 옮기나" / "선례가 정확히 같은 형태다" / "등록 표면 (실측 8곳)" 섹션
  - 위반 규약: 없음(정확히는 — `spec/conventions/` 에 대응 문서 자체가 부재함을 확인했다. `ls spec/conventions/` 24개 항목 중 `codebase/packages/**` 의 패키지 명명·워크스페이스 등록·재export 정책을 다루는 문서가 없다)
  - 상세: target 은 `@workflow/ai-end-reason` 패키지(`codebase/packages/ai-end-reason/package.json`)를 선례로 들어 `@workflow/masked-markers` 명명·`MAX_MASK_DEPTH` canonical export·재export 유지 전략을 정당화한다. 실측 결과 이 패턴(scoped `@workflow/*` 네이밍, `workspace:*` 의존, 소비처 재export 유지)은 실제로 `codebase/packages/` 전체(7개 패키지)에 걸쳐 일관되고, `frontend-layering.md §3` 이 명시하는 "정본 이동 + 소비처 re-export 유지" 원칙과도 정확히 부합한다. 다만 이 관례가 **정식 spec/conventions/ 문서로 코드화되어 있지 않아**, 매 추출 작업마다 target 처럼 `ls codebase/packages/` + grep 으로 선례를 재발굴해야 한다. target 자체의 결함은 아니다(오히려 실측 기반 선례 확인을 성실히 수행함) — 규약 갭이다.
  - 제안: target 자체를 고칠 필요는 없다. 이 PR 이후 `spec/conventions/shared-packages.md`(가칭)로 `@workflow/*` 명명·등록 8표면·재export 정책을 코드화하면 향후 유사 추출 작업의 반복 재발굴 비용을 줄일 수 있다 — target 의 "등록 8곳" 표가 그대로 초안이 될 수 있다.

- **[INFO]** 문서 구조가 spec 문서용 "Overview/본문/Rationale" 3섹션 표기를 정확히 따르지 않음(허용된 편차)
  - target 위치: 문서 전체 구조
  - 위반 규약: 해당 없음 — `project-planner/SKILL.md:16,39` 의 3섹션 규약은 **spec 문서**(`spec/<영역>/*.md`, `plan/in-progress/spec-draft-<name>.md`) 대상이며, target 은 일반 작업 plan(`plan/in-progress/masked-marker-shared-package.md`)이라 대상 밖이다.
  - 상세: 인접 plan 문서(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 등)도 동일하게 `## Overview` 헤더 없이 자유 서술+체크리스트+`## Rationale` 구조를 쓴다. target 의 `## Rationale` + "기각한 대안" 하위 섹션은 오히려 spec 문서의 Rationale 관행(예: `audit-actions.md §Rationale 기각된 대안`)을 잘 반영한다.
  - 제안: 조치 불요.

## 검증한 규약 준수 항목 (참고 — 위반 없음)

- **frontmatter 스키마** (`plan-lifecycle.md §4`, `.claude/docs/` — CLAUDE.md 인용 규약): `worktree`/`started`/`owner` 필수 3필드 모두 존재, `worktree: masked-marker-contract-7d2e14` 가 실제 worktree 디렉터리와 일치, `spec_impact` 가 bare string 이 아닌 **리스트**(`- spec/5-system/14-external-interaction-api.md`, 실존 파일 확인) 형식으로 Gate C 요구사항을 준수.
- **패키지 명명** (`@workflow/*` scoped kebab-case): target 이 제안한 `@workflow/masked-markers` 는 기존 7개 패키지(특히 `@workflow/ai-end-reason`) 명명 패턴과 정확히 일치.
- **UPPER_SNAKE_CASE 상수 표기**: `MASKED_MARKERS`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH` 등 target 이 인용한 심볼명이 실제 `codebase/backend/src/shared/utils/sanitize-error-message.ts`·`codebase/frontend/src/lib/utils/masked-markers.ts` 코드와 라인 단위로 정확히 일치.
- **spec 인용 정확성**: `spec/5-system/14-external-interaction-api.md:1624` 의 "마커 집합은 backend `sanitize-error-message.ts` 가 SoT" 문구, frontmatter `code:` 13번째 항목(`masked-markers.ts`), 그리고 인용된 "§R17" 이 실제로 해당 라인을 포함하는 Rationale 서브섹션(1392~1706행)이라는 점까지 모두 실측 일치 — spec 정정 항목("developer 는 read-only 라 planner 턴 분리")도 `CLAUDE.md` skill 체계(§`spec/` 변경 → `project-planner`)를 정확히 따른다.
- **re-export 전략**: `frontend-layering.md §3` ("기존 소비처 안정성이 필요하면 원래 경로에서 re-export 유지, 정본은 아래 계층에") 이 명시하는 정본 이동+재export 패턴과 target 의 "소비처 5파일 import 경로 불변 위해 재export 유지" 전략이 정확히 부합.
- **spec-impl-evidence 정합**: `code:` 목록 갱신 계획(패키지 경로 추가)이 `spec-impl-evidence.md §2.1` 의 `status: partial` spec 의 `code:` 매치 의무와 충돌하지 않음.

## 요약

target plan(`plan/in-progress/masked-marker-shared-package.md`)은 정식 규약(`spec/conventions/**`) 관점에서 CRITICAL/WARNING 위반이 발견되지 않았다. frontmatter 스키마(Gate C 리스트 형식 포함), 패키지 명명 패턴(`@workflow/*` 선례), 상수 표기(UPPER_SNAKE_CASE), 재export 전략(`frontend-layering.md §3` 원칙과 부합), spec 인용의 라인 단위 정확성을 모두 실측으로 대조했으며 전부 일치했다. 유일한 관찰은 "공유 패키지 신설" 자체를 다루는 전용 정식 규약 문서가 `spec/conventions/` 에 아직 없다는 INFO 성격의 규약 갭이며, 이는 target 의 결함이 아니라 target 이 (실측 기반으로) 잘 메운 기존 공백이다.

## 위험도
LOW
