# Consistency Check 통합 보고서 (§A.3 SoT dedup)

**BLOCK: NO** — Critical 발견 없음.

## 전체 위험도
**LOW** — Critical 0, WARNING 2, INFO 9. 전부 본 PR 1줄 편집(§A.3 호출이력 행 SoT dedup)과 **무관한 pre-existing** 항목.

## Critical 위배

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target | 제안 |
|---|---------|------|--------|------|
| W-1 | Cross-Spec | §3 Model Config API 의 Editor+ vs Auth Config Admin+ 병치 — 근거 링크 누락(모순 아님) | §3 Model Config API | `[인증 §3.2]` 근거 한 줄 |
| W-2 | Convention | §A.4 `FORBIDDEN`(대문자) vs error-codes `forbidden`(소문자 초대흐름 전용) 도메인 구분 불명확 — **spec 본문 수정 불필요** | §A.4 | `3-error-handling §1.2` 등재 확인만 |

## 참고 (INFO)
I-1 OAuth-only reveal 케이스 / I-3 §B.6.2 R-3 앵커 / I-4 audit action backtick / I-5 `## 3. API` 번호 / I-6 id:config / I-7 usage DTO / I-9 usage vs usages — 전부 pre-existing 스타일/gap, 본 PR 무관.

## Checker별 위험도
plan_coherence: **NONE — "순수 SoT 정합 작업으로 plan 영향 없음"** (본 편집 직접 확인). naming_collision: NONE. cross_spec/rationale/convention: LOW (전부 pre-existing).

---

## 호출자 사후판정 (main Claude, 2026-06-16 — spec-fix-a3-sot-dedup PR)

**BLOCK: NO 확정. 진행.** 본 PR 의 편집은 §A.3 "호출 이력 테이블" 행 **1줄** — source_ip/response_code 의 캡처·저장 **메커니즘 산문 중복**(`extractClientIp`·`202` 등, data-model §2.13 과 중복)을 걷어내고 `[데이터 모델 §2.13]` SoT cross-ref 로 위임하되, **설정화면 고유 UI 표시**(미캡처 소스 IP `—`·status 폴백)는 유지. W-3/W-4(#619 consistency) 해소.

WARNING/INFO 전부 본 PR 미편집 pre-existing:
- **W-1 (Model Config Editor+ 근거 링크)**: §3 Model Config API 표(내 미편집)의 기존 서술. #619 가 Auth 표엔 RBAC 한 줄을 넣었으나 Model Config 표는 별건 — 별도 grooming.
- **W-2 (FORBIDDEN 대/소문자 도메인)**: checker 도 "spec 본문 수정 불필요" 명시. error-codes 카탈로그 측 확인 사항(별건).
- **I-4/I-5 (backtick·heading 번호)**: 직전 PR 들에서도 의도적으로 DEFER 한 cosmetic/구조 항목(heading renumber 는 앵커 파급 리스크). 본 PR 도 동일 처분.

docs 빌드 가드 17파일 2199 PASS(§2.13 앵커 dead-link 통과). spec 전용이라 review_guard(codebase 트리거) 무관.
