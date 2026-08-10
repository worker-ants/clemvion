# 문서화(Documentation) 리뷰 — plan-lifecycle-gates

## 리뷰 대상
1. `review/consistency/2026/08/10/01_37_01/rationale_continuity.md` (신규 리뷰 산출물)
2. `spec/conventions/spec-impl-evidence.md` (§2.2 신설 문단 + `plan-frontmatter.test.ts` 표 갱신 + `code:` frontmatter 1건 추가)

두 파일 모두 문서 자체(리뷰 산출물 / spec convention)라 코드 독스트링 관점보다는 **서술 정확성·교차참조 무결성**이 핵심이다. 각 파일이 인용하는 실제 소스(`plan-scan.ts`, `plan-frontmatter.test.ts`, `.claude/docs/plan-lifecycle.md`, backend `TERMINAL_STATUSES` 등)를 직접 열어 대조했다.

## 검증 결과 요약 (정확했던 부분)

- `rationale_continuity.md` 의 구체적 인용(파일:줄 — `execution-engine.service.ts:499`, `interaction.service.ts:44`, `plan/complete/spec-sync-5-system-metrics-gap.md:37`)은 전부 실측과 일치했다.
- `spec-impl-evidence.md §2.2` 신규 문단("`status:` 키 (plan frontmatter, 2026-08-09 추가)")의 날짜·SoT 주장(`plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES`)은 `git log`(`9e880e908`, 2026-08-09)·`.claude/docs/plan-lifecycle.md §4`·`plan-scan.ts:100` 대조 결과 정확했다.
- `plan-frontmatter.test.ts` 표 행이 서술한 "판정 로직은 `plan-scan.ts`(수집·status)와 `spec-links.ts`(링크) 소관, 이 파일은 호출부" 는 실제 import 문(`plan-frontmatter.test.ts:1-11`)과 일치했다.

## 발견사항

- **[WARNING]** `spec-impl-evidence.md` 가 새로 정확하게 서술한 아키텍처("판정 로직은 `plan-scan.ts` 소관")와, 그 서술이 가리키는 실제 가드 파일의 헤더 주석이 서로 어긋난다.
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:19-20` (오늘 리뷰 대상 diff 밖의 파일이지만, `spec-impl-evidence.md` 의 갱신 서술이 직접 가리키는 대상이라 교차검증 과정에서 발견)
  - 상세: 해당 주석은 "그 규칙의 **단일 구현**은 `spec-links.ts` 의 `collectLivePlanMarkdown` 이고" 라고 쓰여 있다. 그러나 `ebb6f9598`(`plan 스캔·status 판정을 plan-scan.ts 로 추출`) 리팩터 이후 `collectLivePlanMarkdown` 의 실제 구현은 `plan-scan.ts:83` 로 이동했고, `spec-links.ts` 는 단순 `import`+`export`(17행 import, 304행 re-export)로 통과시킬 뿐이다. 즉 "단일 구현 = spec-links.ts" 라는 서술은 리팩터 이후 stale 이다 — 이번에 새로 갱신된 `spec-impl-evidence.md §4.2` 표 행("판정 로직은 `plan-scan.ts` 소관")과 정면으로 어긋나는 상태로 남아 있다.
  - 제안: 해당 주석을 "단일 구현은 `plan-scan.ts` 의 `collectLivePlanMarkdown` 이고(`spec-links.ts` 는 하위호환 re-export)" 식으로 정정. `rationale_continuity.md` 가 "5곳 동기 반영"(`plan-scan.ts` export 부·`plan-scan.test.ts`·`plan-frontmatter.test.ts` 에러 메시지·`plan-lifecycle.md §4`·`spec-impl-evidence.md §2.2`)을 완결로 서술하는데, 정작 같은 파일의 **인접 헤더 주석**은 그 동기화 스윕에서 빠졌다는 점도 함께 기록해 둘 가치가 있다(재발 방지용 체크리스트 항목).

- **[INFO]** `code:` frontmatter 목록에 `plan-scan.ts` 는 추가됐지만 짝이 되는 `plan-scan.test.ts` 는 빠졌다.
  - 위치: `spec/conventions/spec-impl-evidence.md:15` (게이트 기준 — diff 상 `+  - codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`)
  - 상세: 같은 목록의 `spec-frontmatter-parse.ts`(5행)와 `spec-frontmatter-parse.test.ts`(6행)는 구현+테스트 쌍으로 함께 등재돼 있다. `plan-scan.test.ts` 는 커밋 메시지가 강조하듯 "합성 fixture 로 실제 탐지를 증명"하는, 판정 로직의 정확성을 담보하는 핵심 테스트인데 목록엔 없다. 다만 `spec-links.ts` 도 이미 `spec-links.test.ts` 없이 등재돼 있어(기존 패턴), 이번 추가가 새로운 불일치를 만든 것은 아니고 기존의 느슨한 관례를 답습한 정도다.
  - 제안: 우선순위 낮음. 이 `code:` 목록의 포함 기준(구현 파일만? 구현+단위테스트 쌍?)을 §4/§4.2 서두에 한 줄로 명문화하면 향후 추가 시 판단이 쉬워진다.

- **[INFO]** `rationale_continuity.md` 자체는 리뷰 산출물 문서로서 구조(선행사실→재구성→관점별확인→요약→위험도)가 명확하고 인용이 검증 가능해 문서화 품질은 양호하다. 특기할 결함 없음.

## 요약

두 파일 모두 문서(스펙 컨벤션 / 리뷰 산출물) 자체의 변경이라 코드 독스트링·README·CHANGELOG 관점의 통상적 지적 사항은 해당 없음. 핵심은 서술 정확성인데, `rationale_continuity.md` 의 구체적 사실 인용(파일:줄, 커밋 SHA, 날짜)은 전수 재검증 결과 정확했고, `spec-impl-evidence.md §2.2` 신설 문단·`plan-frontmatter.test.ts` 표 갱신도 실제 소스(imports, `plan-scan.ts`, `plan-lifecycle.md §4`)와 일치했다. 다만 교차검증 과정에서, 이번에 정확하게 갱신된 `spec-impl-evidence.md` 의 서술과 그것이 가리키는 실제 가드 파일(`plan-frontmatter.test.ts`)의 헤더 주석이 `ebb6f9598` 리팩터 이후 stale 상태로 방치돼 있음을 발견했다(WARNING) — "5곳 동기 반영 완료"라는 `rationale_continuity.md` 의 완결 주장에 사각지대가 있었음을 보여준다. `code:` frontmatter 목록의 `plan-scan.test.ts` 누락은 기존 관례를 답습한 경미한 완결성 이슈(INFO)다.

## 위험도

LOW
