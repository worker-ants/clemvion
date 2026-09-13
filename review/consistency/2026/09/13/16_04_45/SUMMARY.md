# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 성공, Critical 발견 0건.

## 전체 위험도

**MEDIUM** — 신규 CRITICAL 은 없으나, `rationale_continuity` 가 5라운드(14:41→15:03→15:23→15:43→16:04) 연속 동일하게 짚는 WARNING(SoT 문서 미갱신 + `#1330` "허용목록 없음" 원칙 번복의 Rationale 미승격)이 여전히 열려 있어 checker 개별 판정을 하향하지 않고 그대로 반영.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음) — 이번 라운드에 CRITICAL 이 없으므로 이 표는 해당 없음. 다만 아래 WARNING 항목의 근본 조치는 developer 권한 밖(`spec/` 쓰기는 project-planner 전속)이라 실행 가능한 조치는 §권장 조치사항에 planner 턴 지정으로 명시.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity, convention_compliance (중복 통합, 더 강한 등급 채택) | 신규/개명된 가드 파일(`guide-identifier-existence.test.ts`·`guide-identifier-scan.ts`·`guide-sanitized-message-parity.test.ts`)이 자칭 SoT 문서에 미등재 + `#1330`이 세운 "허용목록 없음" 설계 원칙을 실측 근거로 번복했음에도 그 근거가 spec `## Rationale` 로 아직 승격되지 않음 (5라운드 연속 동일) | `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:44-51`(`GUIDE_EXTERNAL_VOCABULARY` 절), `guide-identifier-existence.test.ts` | `spec/conventions/user-guide-evidence.md` §2 "Build-time 가드 (3건)" 표(신규 2건 미반영, "5건"이어야 함) · §2.1 관계표 · frontmatter `code:` 목록(3파일 누락) · Rationale 섹션(원칙 번복 근거 부재) | 다음 **planner 턴**에서 한 번에 반영: (1) §2 표 3→5건 갱신, (2) §2.1 관계표에 2행 추가, (3) frontmatter `code:` 에 `guide-identifier-scan.ts`·`guide-identifier-existence.test.ts`·`guide-sanitized-message-parity.test.ts` 3개 추가, (4) `## Rationale` 신규 2문단(① 왜 "허용목록 없음" 원칙을 유지 못했는가 — 문맥 게이팅이 가드 존재 이유였던 결함을 못 잡음, 실측표 포함, ② 왜 이번 허용목록은 `guide-error-code-truth.md §D` 가 기각한 대안과 다른가 — `GUIDE_EXTERNAL_VOCABULARY` 4강제 + 뮤테이션 검증). 초안은 `plan/in-progress/spec-draft-nullable-notation-followups.md`(약 3247~3269행 부근, 원 트래커 항목)에 이미 등재돼 있어 복붙 수준. developer 는 자기-반증형 소정정 예외(조건 2: 설계 원칙 문장은 "예고 문장"에 해당 안 함)에도 해당하지 않음을 스스로 판정해 spec 을 직접 고치지 않았다 — 권한 경계는 정확히 지켜졌다. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | 코드 주석의 spec 인용(`3-error-handling.md §1.4` 앵커 3분류)이 실제 문서와 정확히 일치 — 충돌 없음 | `guide-identifier-scan.ts` `collectSourceTokens` JSDoc | 조치 불필요 |
| 2 | cross_spec | `GUIDE_EXTERNAL_VOCABULARY` 허용목록과 `error-codes.md §3` Historical-artifact 예외는 서로 다른 대상(가이드 인용 어휘 vs 코드 명명 위반)을 다루는 별개 메커니즘 — 충돌 없음 | `guide-identifier-scan.ts`, `spec/conventions/error-codes.md §3` | 조치 불필요 |
| 3 | cross_spec | frontend 테스트가 backend/packages 소스를 `fs` 로 읽는 것은 `frontend-layering.md §1` 의 import 축 규율 대상이 아님(리네임 전부터 있던 패턴) — 신규 레이어 위반 아님 | `guide-identifier-existence.test.ts` | 조치 불필요 |
| 4 | rationale_continuity | 이번 원칙 번복은 부분적 — 전수 열거(백틱)는 채택하되 frontend 소스를 기준집합에 넣는 것(`#1330`이 기각한 "자기증명 오염" 축)은 계속 거부 중, 완전 재도입 아님 | `guide-identifier-existence.test.ts`("frontend 소스는 넣지 않는다" 주석) | WARNING#1 의 Rationale 신설 시 "무엇을 뒤집고 무엇을 보존했는가" 한 문장 포함 |
| 5 | convention_compliance | `review-citations.md §2` 리뷰 인용 형식(날짜 포함 전체 경로) 전수 준수, bare `hh_mm_ss` 0건 | 신규/변경 파일 전수 | 조치 불필요 |
| 6 | plan_coherence | `cafe24-api-metadata.md:441` "Principle 7" 오인용은 이 PR 과 무관한 선재 결함이며 이미 `spec-draft-nullable-notation-followups.md:3401-3411` 에 별도 등재됨 — 중복 등재 아님 | `spec/conventions/cafe24-api-metadata.md:441` | 조치 불필요(이미 추적 중) |
| 7 | naming_collision | 모듈-private 상수 `UPPER_SNAKE` 이름이 `engine-error-code-anchor-guard.ts` 와 우연히 중복 — 둘 다 비export·무import 관계라 충돌 아님 | `guide-identifier-scan.ts`, `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:60` | 조치 불필요 |
| 8 | naming_collision | `GUIDE_EXTERNAL_VOCABULARY` 명명이 무관 도메인의 `KNOWN_DOCS_ABSENT`(`KNOWN_*` 접두) 와 의도적으로 접두사를 공유하지 않도록 설계됨 — 실측으로 재확인 | `plan/in-progress/guide-identifier-existence.md` §명명 | 조치 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `spec/conventions/**` 델타 0, 순수 harness 리네임/확장. SoT 미등재는 이미 planner 백로그 이관 완료 |
| rationale_continuity | MEDIUM | `#1330` "허용목록 없음" 원칙 번복의 spec Rationale 미승격이 5라운드 연속 오픈(developer 쪽 조치는 완료, 잔여는 planner 턴) |
| convention_compliance | LOW | 동일 SoT 미등재(§2/§2.1/frontmatter) — developer 권한 밖, planner 백로그에 정확히 이관됨 |
| plan_coherence | NONE | plan 서술과 실제 저장소 상태 불일치 없음. 선행 gap 2건 모두 정상 추적 중(중복 등재 없음) |
| naming_collision | NONE | 신규 식별자(타입·함수·상수·경로) 전수 grep 결과 기존 의미와 충돌 0건. 라운드 4 신규 변경은 정규식 버그 수정뿐 |

## 권장 조치사항

1. (Non-blocking, planner 턴) `spec/conventions/user-guide-evidence.md` 를 한 턴에 갱신 — §2 표 3→5건, §2.1 관계표 2행, frontmatter `code:` 3파일 추가, `## Rationale` 신규 2문단("허용목록 없음" 원칙을 왜 못 지켰는지 + 이번 허용목록이 `#1330` 기각 사유와 왜 다른지). 초안은 `plan/in-progress/spec-draft-nullable-notation-followups.md`(원 트래커 항목, 취소선+반증 근거 기재)에 이미 있음.
2. (No-op) 이번 PR(코드 스코프 5파일, `spec/conventions/**` 델타 0)은 CRITICAL 없이 5개 checker 전원 수렴 — developer 턴에서 추가로 취할 조치 없음. push/turn-end 게이트 통과 가능.