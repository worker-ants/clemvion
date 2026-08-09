# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(`plan-frontmatter.test.ts` 헤더 주석이 리팩터 이후 stale — "단일 구현=spec-links.ts" 서술이 실제로는 `plan-scan.ts`로 이동한 사실과 상충). 나머지는 전부 INFO(문서 가독성·인용 정밀도) 수준. forced(router_safety) 7개 reviewer 전원 결과 확보됨 — 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `plan-frontmatter.test.ts` 헤더 주석이 "그 규칙의 단일 구현은 `spec-links.ts`의 `collectLivePlanMarkdown`"이라고 서술하나, `ebb6f9598`(plan 스캔·status 판정을 `plan-scan.ts`로 추출) 리팩터 이후 실제 구현은 `plan-scan.ts:83`로 이동했고 `spec-links.ts`는 단순 re-export일 뿐이다. 이번에 갱신된 `spec-impl-evidence.md §4.2`("판정 로직은 `plan-scan.ts` 소관")와 정면으로 상충하는 stale 주석 | `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:19-20` | 주석을 "단일 구현은 `plan-scan.ts`의 `collectLivePlanMarkdown`이고(`spec-links.ts`는 하위호환 re-export)"로 정정. `rationale_continuity.md`가 주장한 "5곳 동기 반영 완료"에서 빠진 사각지대이므로 재발 방지 체크리스트에 추가 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement | `rationale_continuity.md`의 인용 위치가 실제 heading과 어긋남 — "`docs-guard-walker-dedup.md ## Rationale`"이라 인용했으나 해당 문구("왜 별 plan인가")는 실제로 `## Overview` 아래 blockquote 콜아웃에 있고, 그 문서의 `## Rationale`절은 별개 질문("왜 P3인가")을 다룸. 결론 자체는 사실과 일치하여 영향 없음 | `review/consistency/2026/08/10/01_37_01/rationale_continuity.md:31` | 인용을 "Overview 콜아웃(`왜 별 plan인가`) + `## Rationale`"로 분리 표기 |
| 2 | Maintainability | `plan-frontmatter.test.ts` 가드 설명 행이 3개 이질적 책임(frontmatter 필드 존재/plan status enum 검증/링크 무결성)을 한 표 셀에 나열, 파일명이 더 이상 실제 검증 범위를 정확히 반영하지 못함 | `spec/conventions/spec-impl-evidence.md:132` | 향후 이 가드에 책임이 하나 더 붙으면 파일 분리(`plan-status.test.ts` 등) 또는 표 셀 하위 bullet화 고려 |
| 3 | Maintainability | `rationale_continuity.md` 일부 문단이 다중 중첩 괄호·인용부호로 한 문장에 근거·반박·결론 3중 주장을 압축, 문장 경계 파악이 즉시 되지 않음 | `review/consistency/2026/08/10/01_37_01/rationale_continuity.md:22` | 일회성 리뷰 아티팩트라 필수 수정 아님. 반복되면 리뷰어 프롬프트에 "문장당 단일 주장" 가이드 추가 고려 |
| 4 | Maintainability | 신규 `status:`(plan frontmatter) 도메인 구분 bullet이 형제 bullet 대비 정보 밀도가 높음(날짜·SoT 포인터·값 공유 설명·가드 파일명 대응 4개 절 압축) | `spec/conventions/spec-impl-evidence.md:87` | 선택 사항 — 필요 시 날짜/이력 정보를 Rationale 절로 이동하고 본문 bullet은 의미 구분만 남기는 방식 고려 |
| 5 | Documentation | `code:` frontmatter 목록에 `plan-scan.ts`는 추가됐지만 짝이 되는 `plan-scan.test.ts`(합성 fixture로 판정 로직 정확성을 담보하는 핵심 테스트)는 누락. 다만 `spec-links.ts`도 이미 테스트 파일 없이 등재돼 있어 기존 느슨한 관례를 답습한 정도(새 불일치 아님) | `spec/conventions/spec-impl-evidence.md:15` | 우선순위 낮음. `code:` 목록의 포함 기준(구현 파일만 vs 구현+단위테스트 쌍)을 §4/§4.2 서두에 명문화 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | NONE | 사실관계 전수(날짜·SoT·개명 완결성·backend 상수 실존 등) 실측 일치. 인용 위치 오류 1건(INFO)만 발견 |
| scope | NONE | 발견 없음 — 두 파일 모두 plan `status` 가드 신설분에 직접 종속, 스코프 이탈 없음 |
| side_effect | NONE | 실행 코드가 아니라 부작용 표면 자체가 없음. `code:` frontmatter 신규 경로(`plan-scan.ts`) 실존 검증 완료 |
| maintainability | LOW | 함수/복잡도 지표는 N/A(문서 diff). 문서 산문 밀도·가드 책임 확장 관련 INFO 3건 |
| testing | NONE | 실행 로직 변경 없어 신규 테스트 불요. `spec-impl-evidence.md`가 서술하는 `plan-frontmatter.test.ts` 3-파트 검증이 실제 구현과 일치함을 직접 확인 |
| security | NONE | 실행 코드·시크릿·인증 로직 없음. 검토 표면 자체가 존재하지 않음 |
| documentation | LOW | `plan-frontmatter.test.ts` 헤더 주석 stale (WARNING) 1건 발견. `plan-scan.test.ts` 미등재(INFO) |

## 발견 없는 에이전트

- scope
- security

## 권장 조치사항

1. `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:19-20` 헤더 주석을 `ebb6f9598` 리팩터 반영해 정정 — "단일 구현은 `spec-links.ts`" → "단일 구현은 `plan-scan.ts`의 `collectLivePlanMarkdown`(`spec-links.ts`는 하위호환 re-export)"로 갱신. (WARNING 해소, `rationale_continuity.md`의 "5곳 동기 반영 완료" 주장의 사각지대 보완)
2. (선택) `review/consistency/2026/08/10/01_37_01/rationale_continuity.md:31`의 인용을 "Overview 콜아웃 + `## Rationale`"로 분리 표기
3. (선택) `spec/conventions/spec-impl-evidence.md`의 `code:` 목록 포함 기준(구현만 vs 구현+테스트 쌍) 명문화, `plan-scan.test.ts` 추가 고려
4. (선택) `plan-frontmatter.test.ts`가 3개 책임을 흡수하는 추세 — 추후 확장 시 파일 분리 검토

## 라우터 결정

- `routing: all` (router가 전체 reviewer를 forced 처리 — 명시적 skip 없음):
  - **실행**: `requirement, scope, side_effect, maintainability, testing, security, documentation` (7명, 전원 성공)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원) — **forced 전원 결과 확보됨**, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | — |