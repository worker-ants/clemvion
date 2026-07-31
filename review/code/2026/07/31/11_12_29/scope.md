# 변경 범위(Scope) 리뷰 — review/consistency/** 산출물 + spec 2건

## 검토 방법

`meta.json` 이 명시한 23개 파일 전부(전체 diff, 생략 없이)를 확인했다. 구성:
- `review/consistency/2026/07/30/{16_45_59,17_03_26,19_03_37}/**` 21개 — consistency-check 자동 산출물(신규 파일)
- `spec/2-navigation/1-workflow-list.md`, `spec/data-flow/11-workflow.md` 2개 — 기존 파일 수정

대조를 위해 `plan/in-progress/workflow-duplicate-nodes-edges.md` 를 직접 열어 task 범위(title/`spec_impact`)를 확인했고, 각 라운드 `meta.json` 의 `mode` 필드로 3개 세션이 각각 `--spec`/`--impl-prep`/`--impl-done` 임을 확인했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** 참고: 이 diff 에는 실제 애플리케이션 코드(`workflows.service.ts` 등)가 포함되어 있지 않음
  - 위치: 해당 없음 (파일 목록 자체가 근거 — `meta.json` `files[]` 23건 전부 `review/consistency/**` 또는 `spec/**`)
  - 상세: 각 checker 산출물 본문(예: `naming_collision.md` 19_03_37 라운드, "코드: `codebase/backend/src/modules/workflows/{workflows.service.ts,workflows.controller.ts}` … 재구현")은 `duplicate()` 재구현이 이미 완료됐다고 서술하지만, 그 코드 diff 자체는 이번 리뷰 batch 에 없다 — `git diff origin/main...HEAD --stat` 로 대조한 결과 `review/code/2026/07/30/{17_54_27,19_06_10,19_43_05}/**` 에 이미 별도 `/ai-review` 세션 산출물이 존재해, 코드는 그 라운드들에서 이미 리뷰된 것으로 판단된다("직전 검토 코드 제외" 관행과 일치). 즉 이번 batch 는 그 이후에 생성된 **잔여(residual) diff**만 다루므로, "코드 변경이 이 batch 안에 없다"는 것 자체는 스코프 이탈이 아니라 리뷰 diff-base 정책의 정상 결과다. 별도 조치 불요.

## 항목별 판단

1. **의도 이상의 변경** — 없음. 21개 consistency-check 산출물은 CLAUDE.md 가 명시적으로 강제하는 두 게이트(`project-planner`: spec 쓰기 직전 `--spec`, `developer`: 구현 착수 직전 `--impl-prep`)와, `developer/SKILL.md` §REVIEW WORKFLOW 4항이 "spec 의 `code:` glob 에 매칭되는 코드 변경 시 의무"로 승격한 `--impl-done` 게이트, 총 3개 라운드의 산출물이다(각 `meta.json` `mode` 필드로 실측 확인: `"spec draft 검토 (--spec)"` / `"구현 착수 전 검토 (--impl-prep, scope=spec/data-flow/)"` / `"구현 완료 후 검토 (--impl-done, scope=spec/data-flow/, diff-base=origin/main)"`). 요청 범위를 넘는 임의 산출물이 아니라 프로젝트가 상시 요구하는 필수 산출물이다.
2. **불필요한 리팩토링** — 없음. 코드 리팩토링이 이 batch 에 전혀 없다(문서/리뷰 산출물뿐).
3. **기능 확장(over-engineering)** — 없음. `spec/data-flow/11-workflow.md` 에 추가된 `## Rationale` 3개 절("메타-only 서술 철회", "export/import 미재사용 이유", "버전 이력·트리거·데이터셋 비승계 이유")은 각각 "기각한 대안"까지 포함해 duplicate 재구현의 **경계를 좁히는** 근거를 남기는 문서이지, 새 기능을 제안하는 내용이 아니다. `spec/2-navigation/1-workflow-list.md` 도 §2.6/§3 API 표의 duplicate 행 설명 정정 + frontmatter `pending_plans` 1줄 추가뿐, 신규 섹션·신규 기능 서술 없음.
4. **무관한 수정** — 없음. `plan/in-progress/workflow-duplicate-nodes-edges.md` 의 `spec_impact:` 가 정확히 이 2개 spec 파일을 지목하고 있고(직접 Read 로 확인), 21개 review 산출물의 경로도 전부 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 컨벤션(CLAUDE.md "정보 저장 위치" 표)과 정확히 일치한다. 다른 워크플로우 영역(예: `spec/data-flow/` 폴더의 나머지 13개 파일)은 각 checker 본문이 스스로 "diff 밖 — context 로만 사용"이라고 명시하며 실제로 손대지 않았다.
5. **포맷팅 변경** — 없음. 두 spec 파일의 diff hunk 는 duplicate 관련 행/문단에만 정확히 국한되고, 인접한 무관 행(예: `내보내기`/`활성-비활성` 행, `PATCH`/`GET export` 행)은 건드리지 않는다. 공백·개행만 바뀐 hunk 없음.
6. **주석 변경** — 해당 없음(diff 에 소스 코드가 없어 코드 주석 변경 자체가 없음). spec 문서 내 신설 Rationale 산문은 §3 항목에서 다뤘듯 기능 범위가 아니라 이번 계약 정정의 근거 문서화이므로 "불필요한 주석"에 해당하지 않는다.
7. **임포트 변경** — 해당 없음(코드 diff 없음).
8. **설정 변경** — 없음. `meta.json`/`_retry_state.json` 파일들은 프로젝트 설정이 아니라 consistency-check 세션의 실행 기록(타임스탬프·모드·재시도 상태) 산출물이며, 정확히 그 세션 디렉토리 안에서만 생성됐다.

## 요약

이번 diff batch(23개 파일)는 두 갈래로만 구성된다 — (1) `--spec`/`--impl-prep`/`--impl-done` 3개 필수 게이트가 만든 consistency-check 산출물 21개(전부 `review/consistency/**` 컨벤션 경로), (2) `workflow-duplicate-nodes-edges` plan 이 `spec_impact` 로 명시한 정확히 그 2개 spec 파일의 duplicate 계약 정정 + Rationale 보강. 애플리케이션 코드·설정 파일·무관한 spec 영역·포맷팅-only 변경·불필요한 주석/임포트 어느 것도 포함되지 않았으며, 신설 Rationale 산문도 새 기능이 아니라 "기각한 대안"을 명시해 오히려 구현 범위를 좁히는 문서다. 실제 코드 구현(`workflows.service.ts`)은 이 batch 밖(이전 `/ai-review` 세션에서 이미 리뷰됨)에 있어 이 batch 자체는 리뷰 리스크가 사실상 0에 가깝다. 스코프 이탈 없음.

## 위험도
NONE
