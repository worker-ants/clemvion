# Code Review 통합 보고서 (origin/main base)

## 전체 위험도
**MEDIUM** — 핵심 기능(autoRefresh=true 통합의 attention/expiring 제외)은 spec 을
올바르게 구현. 잔여 WARNING 은 i18n 문구 정합(W-1, 본 PR 수정) 및 spec 자체 결함
(W-2/W-3, project-planner 위임)·헬퍼 주석(W-4, 본 PR 수정).

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 처리 |
|---|----------|----------|------|
| 1 | Requirement / UserGuideSync | i18n EN `tokenExpiresAuto` 가 `"Auto-renews · in"` 로 남아 헤더 배지(`"next in"`, §4.1)와 상세 페이지 Token Expires 행이 EN 에서 불일치 | **본 PR 수정** — `en/integrations.ts` `tokenExpiresAuto` → `"Auto-renews · next in {{duration}}"`. KO 키는 자체 번역 문구라 §4.2 정합과 함께 별도 처리 |
| 2 | Requirement | spec §4.1(`Auto-renews · next in <duration>`) vs §4.2(`in <duration> · auto-renews`) 동일 필드 다른 형식 — spec 자체 결함 | **project-planner 위임** — §4.2 표기 통일 또는 의도적 차이 명시 결정 필요 |
| 3 | Documentation | Rationale L1194 provider 목록 stale(`makeshop` 누락) | **project-planner 위임** — `cafe24/google` → `cafe24/google/makeshop` 1행 정정 |
| 4 | Maintainability | `excludeAutoRefresh` 헬퍼(최상위 AND) vs attention 인라인 이중 경로 — JSDoc 명시 권장 | **본 PR 수정** — 헬퍼에 JSDoc 추가(attention 은 OR 합집합이라 헬퍼 사용 불가, 인라인 fragment 사용) |

## 참고 (INFO) — 주요
- **I-1 (SPEC-DRIFT)**: 헤더 subLabel 이 i18n 없이 영문 하드코딩 — spec §4.1 이 i18n 키를 명시하지 않는 침묵 영역. **project-planner 위임**(spec §4.1 에 헤더 보조 라벨 i18n 키 명시).
- I-2~I-13: 헬퍼 타입 명시(typeof qb), 빈목록 분기 테스트, 복합 인덱스 검토, 주석 한/영 혼용 등 — 모두 비차단. SQL 인젝션 방어(파라미터 바인딩) 양호(I-12).

## 에이전트별 위험도
| 에이전트 | 위험도 |
|----------|--------|
| security / architecture / scope / side_effect | NONE |
| requirement | MEDIUM (W-1 i18n, W-2 spec 결함) |
| maintainability / testing / documentation / database / user_guide_sync | LOW |

## 결론
Critical 0 / Warning 4. W-1·W-4 는 본 PR 에서 수정(i18n 1행 + JSDoc). W-2·W-3·I-1 은
spec/ 영역으로 project-planner 후속 위임. 처리 내역은 RESOLUTION.md 참조.
