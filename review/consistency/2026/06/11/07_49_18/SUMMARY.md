# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

## 전체 위험도
**LOW** — spec Rationale 갱신 누락 2건(WARNING), 문서 동기화 INFO 4건. 기능 모순 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec / Rationale-Continuity / Convention-Compliance / Plan-Coherence | `spec/2-navigation/4-integration.md` Rationale L1147 "왜 초기엔 cafe24 만 응답하나" stale — 구현은 cafe24·makeshop 양쪽 응답, spec §9.3·§4.6 본문은 이미 갱신됐으나 Rationale 절·L1132–1139 표·L830 요약 문자열이 구 상태로 남음 | `spec/2-navigation/4-integration.md` L1147, L1132–1139, L830 | 4개 checker 모두 동일 stale 지점 보고 (중복 통합) | (1) L1147 제목 "왜 cafe24·makeshop 만 operations 를 채워 반환하나"로 변경, 본문에 makeshop 포함 설명 추가·"초기엔" 시제 제거. (2) L1132–1139 표에 `makeshop.<resource>.<operation>` 행 추가. (3) L830 요약 문자열 `"cafe24 는 …, 나머지 3종"` → `"cafe24·makeshop 은 …, 그 외 통합"` 수정. |
| W-2 | Plan-Coherence | `plan/in-progress/cafe24-catalog-i18n.md` 미존재 — `page.tsx` JSDoc `@see plan/in-progress/cafe24-catalog-i18n.md` 가 dead 링크 (pre-existing 누락) | `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` JSDoc | `plan/in-progress/` 내 해당 파일 없음 | `plan/in-progress/cafe24-catalog-i18n.md` 신규 생성해 cafe24 i18n dict 채우기 scope를 공식 plan으로 등록하거나, JSDoc에서 해당 경로 제거. pre-existing 이므로 이번 PR 차단 사유 아님. |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/conventions/cafe24-api-metadata.md §7.5` 책임 분리 표가 makeshop 누락 | `spec/conventions/cafe24-api-metadata.md` §7.5 L414–L432 | "i18n 변환" 행을 `cafe24Catalog.<key>` · `makeshopCatalog.<key>` 병기로 확장하거나 `makeshop-api-metadata.md` 에 동등 표 추가 |
| I-2 | Cross-Spec | `spec/2-navigation/4-integration.md` §4.6 L371 API 컬럼 예시가 cafe24 단독 | `spec/2-navigation/4-integration.md` L371 | L371 예시를 "cafe24 catalog key → '상품 목록 조회', makeshop catalog key → '주문 목록 조회' 등"으로 병기. 기능 동작은 spec-correct |
| I-3 | Convention-Compliance | controller `@ApiParam example: 'cafe24'` 단일 — description 엔 cafe24·makeshop 양쪽 명시됨 | `codebase/backend/src/modules/integrations/integrations.controller.ts` `@ApiParam` | `example: 'makeshop'` 또는 `examples: { cafe24: {...}, makeshop: {...} }` 로 보완해 Swagger UI 에서 새 기능 즉시 테스트 가능하도록 |
| I-4 | Rationale-Continuity | `tryTranslateLabel` `t()` → `locale` + flat-dict helper 교체 — Rationale 위반 아님, 코드 self-documenting 충분 | `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` `tryTranslateLabel` | 별도 spec Rationale 갱신 불필요. `cafe24-catalog-i18n.md` follow-up plan에 "cafe24 dict 도 동일 flat lookup 경로로 채워야 한다" 주석 추가 권장 |
| I-5 | Plan-Coherence | `claude/db-pool-creds-pubsub` 브랜치가 `integrations.service.ts`·`integrations.service.spec.ts` 동시 편집 중 — 편집 구역이 달라 텍스트 충돌 가능성 낮음 | `codebase/backend/src/modules/integrations/integrations.service.ts` | target 먼저 merge 후 db-pool-creds-pubsub 를 origin/main 으로 rebase해 빌드·테스트 재검증 권장 |
| I-6 | Naming-Collision | 신규 식별자 6종(`buildOperationCatalog`, `listAllMakeshopOperations`, `resolveMakeshopOperationLabel`, `tryTranslateLabel` 타입 변경, `descriptionKey` 채우기, `useLocale`/`Locale` import) — 모두 충돌 없음 | 각 해당 파일 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | Rationale L1147 stale (W-1과 동일), §7.5·§4.6 INFO 2건 |
| Rationale-Continuity | LOW | Rationale L1147 stale (W-1과 동일), `tryTranslateLabel` 교체는 Rationale 위반 아님 |
| Convention-Compliance | LOW | Rationale L1147 stale (W-1과 동일), Swagger example 단일화 INFO |
| Plan-Coherence | LOW | Rationale L1147 갱신 누락(W-1), cafe24-catalog-i18n.md 미존재(W-2), db-pool 브랜치 충돌 INFO |
| Naming-Collision | NONE | 신규 식별자 6종 모두 충돌 없음 |

## 권장 조치사항

1. **(W-1 해소 — 권장, merge 전)** `spec/2-navigation/4-integration.md` 3곳 갱신: L1147 Rationale 제목·본문, L1132–1139 api_label 표에 makeshop 행 추가, L830 ActivityItem apiLabel 요약 문자열. project-planner 위임 또는 현 브랜치에서 직접 수정.
2. **(W-2 해소 — 선택, merge 후 가능)** `plan/in-progress/cafe24-catalog-i18n.md` 신규 생성하거나 JSDoc dead 링크 제거. pre-existing 이므로 즉시 차단 아님.
3. **(I-3 권장)** controller `@ApiParam example` 을 `cafe24`·`makeshop` 양쪽 노출로 보완.
4. **(I-1, I-2 권장)** `cafe24-api-metadata.md §7.5` 및 `4-integration.md §4.6 L371` 문서 동기화 — 기능 무관, 가독성 개선.
5. **(I-5 참고)** db-pool-creds-pubsub 브랜치 rebase 순서 명시적 관리.