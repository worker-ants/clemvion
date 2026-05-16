# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `Makefile` — `--build` 플래그 추가는 요청된 수정 범위(stale 이미지 문제 해소)와 정확히 일치
  - 위치: `e2e-up` (L41), `e2e-test` (L51-52), `e2e-test-full` (L59-61)
  - 상세: 3개 타겟 전부에 `--build` 플래그를 일관되게 추가했으며, 어느 타겟도 누락 없이 같은 방식으로 처리됨. 범위 초과 없음.
  - 제안: 없음.

- **[INFO]** `Makefile` — 새로 추가된 주석 블록(L36-38)은 `--build` 플래그의 목적과 side-effect 를 설명
  - 위치: `e2e-up` 타겟 위 4줄 주석
  - 상세: 주석이 변경 의도(stale 이미지 방지), BuildKit layer cache 동작, 실제 사례(`background-monitoring` 사전 결함)를 명시적으로 기술함. 불필요한 주석이 아니라 미래 유지보수자에게 필수적인 WHY 설명이므로 정당한 추가임.
  - 제안: 없음.

- **[INFO]** `third-party-oauth.controller.spec.ts` — 타입 좁히기와 불필요한 `String()` 캐스트 제거
  - 위치: L85-88 (diff 기준)
  - 상세: `Record<string, unknown>` → `Record<string, string>` 로 좁혀 `@typescript-eslint/no-base-to-string` lint 오류를 해소하고, `expect(String(contentType ?? '')).toContain(...)` 를 `expect(contentType ?? '').toContain(...)` 로 단순화. plan 문서(파일 3)의 "의도적 제외" 섹션에 이 lint fix 가 '동반 수정'으로 명시되어 있어 의도된 범위 안의 변경임.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/e2e-makefile-stale-image-fix-2026-05-16.md` — 신규 plan 문서 생성
  - 위치: 전체 파일 (49 lines)
  - 상세: 작업 배경, 근본 원인, 증거, 작업 범위 체크리스트, 의도적 제외 항목, 후속 내용이 구조적으로 문서화됨. frontmatter(`worktree`, `started`, `owner`) 도 규약대로 포함. REVIEW WORKFLOW 체크박스(`[ ]`)가 미완 상태로 올바르게 남아 있으므로 `in-progress/` 위치가 정확함. 범위 초과 없음.
  - 제안: 없음.

- **[INFO]** `review/consistency/2026/05/16/09_13_51/SUMMARY.md` — consistency-check 산출물 추가
  - 위치: 전체 파일 (30 lines)
  - 상세: developer 가 구현 착수 전 `--impl-prep` 모드로 consistency-check 를 실행한 결과물. CLAUDE.md 규약("구현 착수 직전 consistency-checker --impl-prep 의무 호출")에 따른 정상적인 부산물이며, `review/consistency/` 경로는 쓰기 권한 범위에 포함됨.
  - 제안: 없음.

- **[INFO]** `review/consistency/2026/05/16/09_13_51/_prompts/convention_compliance.md` — consistency-check orchestrator 생성 파일
  - 위치: 전체 파일 (635 lines 이상)
  - 상세: orchestrator 가 자동으로 생성한 내부 prompt 파일. `review/consistency/.../_prompts/` 경로는 consistency-checker 세션의 산출 규약상 허용 경로. 내용은 기존 `spec/conventions/` 문서를 그대로 인용한 것으로 새로운 코드나 설정 변경이 아님.
  - 제안: 없음.

## 요약

이번 변경은 `make e2e-test` 계열 타겟의 stale Docker 이미지 문제를 해소하기 위한 `--build` 플래그 추가가 핵심이며, 그 외 수정은 (1) lint 오류 동반 수정으로 plan 에 명시된 항목, (2) plan 문서 신규 생성, (3) 의무 consistency-check 산출물 세 가지에 한정된다. 요청 범위를 벗어난 리팩토링, 기능 확장, 무관한 파일 수정, 의미 없는 포맷팅 변경은 존재하지 않는다. 모든 변경이 plan 문서의 "작업 범위"·"의도적 제외" 섹션과 정합하며, 과도한 over-engineering 징후도 없다.

## 위험도

NONE
