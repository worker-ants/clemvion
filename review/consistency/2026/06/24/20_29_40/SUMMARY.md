# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**LOW** — 5개 checker 중 1개(Cross-Spec)만 LOW, 나머지 4개 NONE. Critical/Warning 0건. INFO 5건 전부 관찰 수준.

## Critical 위배 (BLOCK 사유)

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | 포트 3011 fallback 이 spec-silent — `.env.example` canonical 값과 일치하며 모순 없음 | `codebase/frontend/src/lib/api/constants.ts:18` | 현 상태 유지. spec 의 `{base_url}` 추상 표기가 의도된 패턴 |
| 2 | Cross-Spec | `auth-providers.ts` 의 `cache: "no-store"` 가 `spec/2-navigation/10-auth-flow.md §5` 의 `revalidate: 300` 과 불일치 — M-2 이전부터 존재하던 기존 drift, M-2 책임 밖 | `codebase/frontend/src/lib/api/auth-providers.ts:26` | M-2 범위 외. 별도 spec-sync 태스크에서 spec 또는 코드를 정합 |
| 3 | Rationale Continuity | `constants.ts` 가 단일 SoT 임을 명문화한 spec Rationale 항목 없음 — behavior-preserving 이라 Rationale 위반 아님 | `spec/0-overview.md` 또는 `spec/5-system/1-auth.md` Rationale | 필수 아닌 권장: 향후 `INTERNAL_API_URL` 적용 범위(Server Component 전용)를 Rationale 에 기록 |
| 4 | Convention Compliance | `webhook-url.ts` 가 `NEXT_PUBLIC_API_URL` 을 직접 참조 — 변환 로직(후행 `/api` 제거·webhook override) 때문에 `constants.ts` 재사용 불가, M-2 의도적 제외 | `codebase/frontend/src/lib/utils/webhook-url.ts:30` | 현 상태 유지. `3001` 리터럴 잔류 없음 이미 확인됨 |
| 5 | Plan Coherence | plan `03-maintainability.md §M-2` 체크박스가 `[ ] 미착수` 로 잔류 — 구현은 완료됨 | `plan/in-progress/refactor/03-maintainability.md §M-2` | plan 체크박스를 `[x] 완료` 로 갱신하고 완료 날짜·PR 번호 기록 (구현 코드 변경 불필요) |

> NOTE: INFO 2(Cross-Spec `revalidate:300` drift)와 INFO 4(Convention Compliance `webhook-url.ts`)는 서로 다른 checker 가 동일한 "기존 drift, M-2 책임 밖" 범주를 다른 각도에서 관찰한 것이나, 대상 파일이 달라 별도 항목으로 유지.

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | spec-API 계약 충돌 없음. 포트 3011 spec-silent(의도). `auth-providers` revalidate drift 는 기존 선행 이슈 |
| Rationale Continuity | NONE | 기존 `NEXT_PUBLIC_API_URL` 우선순위 체계·WS_BASE_URL suffix 규칙 모두 올바르게 계승 |
| Convention Compliance | NONE | `spec/conventions/` 정식 규약(error-codes·swagger·audit-actions) 직접 위반 없음. 명명 패턴 준수 |
| Plan Coherence | NONE | 구현이 plan 권장안(옵션 A)을 정확히 따름. plan 체크박스 갱신만 필요 |
| Naming Collision | NONE | 신규 식별자(`API_BASE_URL`, `WS_BASE_URL`, `getServerApiBaseUrl`) 기존 코드베이스와 충돌 없음. 이중 정의 제거 완료 |

## 권장 조치사항

1. **(plan 추적)** `plan/in-progress/refactor/03-maintainability.md §M-2` 체크박스를 `[x] 완료` 로 갱신하고 완료 날짜·PR 번호를 기록한다. 구현 코드 변경 불필요.
2. **(별도 spec-sync 태스크, 비긴급)** `spec/2-navigation/10-auth-flow.md §5` 의 `revalidate: 300` 표기와 코드 실제(`cache: "no-store"`) 의 불일치를 별도 태스크로 추적한다. M-2 범위 외 기존 drift.
3. **(권장, 비필수)** `spec/0-overview.md` 또는 `spec/5-system/1-auth.md` Rationale 에 `constants.ts` 가 frontend API URL 단일 SoT 이며 `INTERNAL_API_URL` 은 Server Component 전용임을 한 항목으로 명문화한다.
