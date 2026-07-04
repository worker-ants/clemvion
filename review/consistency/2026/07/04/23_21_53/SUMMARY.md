# consistency-check --impl-prep SUMMARY — exec-limits 리팩터 (ARCH#4·6·MAINT#9)

- 모드: `--impl-prep` scope=`spec/5-system/` · 세션: `review/consistency/2026/07/04/23_21_53`
- 계획: 동작 보존 리팩터 — ARCH#4(resolver 이관)·ARCH#6(모듈 JSDoc)·MAINT#9(continuation 파싱 canonical 통일). ARCH#5 deferred.

## BLOCK: NO (착수 승인) — 5/5 checker

| checker | 결과 | 핵심 |
| --- | --- | --- |
| cross_spec | BLOCK: NO | 충돌 없음. MAINT#9 는 §11/§16 문서 계약(비정수→1)과 loose 파싱의 기존 drift 해소. ARCH#4/6 은 spec 이 파일 아닌 함수만 명명 → 이관 무제약. INFO: JSDoc 에 §8+§11 인용. |
| rationale_continuity | BLOCK: NO | MAINT#9 = conformance fix(spec L892/1245 이미 strict fallback 문서화) — 번복 아님. 양의 정수 입력 동작 불변. |
| convention_compliance | BLOCK: NO | ARCH#4 이관 후 순환 의존 없음. 두 concurrency 상수는 모듈-로드 1회 평가가 spec 의도 → getter 전환 대상 아님(스코프 밖). |
| plan_coherence | BLOCK: NO | ARCH#5 deferral 정당 — 타 in-progress plan(http-ssrf·node-output-redesign)이 error-codes.ts 에 항목 추가 중이라 지금 재편 시 충돌. |
| naming_collision | BLOCK: NO | 이관 이름이 execution-limits.ts export 와 비충돌. 신규 식별자 없음. |

## 착수 반영

- ARCH#6 JSDoc 에 §8(active-running·cap·queue-wait) + §11(worker concurrency env) 모두 인용.
- MAINT#9 에 기존 loose→strict drift 해소 취지 주석(rationale INFO).
- spec_impact: none(spec 본문 무변경 — 코드를 문서 계약에 정합).

## 잔여(별도) — ARCH#5

engine 에러코드 레이어 분리는 `error-codes.ts` 공용 재편 + 하드코딩 문자열 enum 편입 + 소비처 리다이렉트로 blast radius 큼. 타 in-progress plan 과 현재 충돌 위험 → `exec-intake-followups.md` 후속 유지.
