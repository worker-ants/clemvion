# 유저 가이드 동반 갱신(User Guide Sync) Review

검토 일시: 2026-05-28
대상 변경: 통합 활동 로그에 API 식별 컬럼(`api_label`/`api_method`/`api_path`) 추가 + `GET /api/integrations/services/:type/catalog` 신규 endpoint + ActivityTab UI `API` 컬럼 신설

---

## 발견사항

### [WARNING] 통합 상세 페이지 Activity 탭의 신규 API 컬럼이 유저 가이드에 미반영

- 변경 파일: `codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` (ActivityTab 에 `API` 열 추가), `codebase/frontend/src/lib/api/integrations.ts` (OperationCatalogResponse 신규), `codebase/backend/src/modules/integrations/integrations.controller.ts` (`@Get('services/:type/catalog')` 신규)
- 매트릭스 항목: **통합 신규/제공자 변경** — "`codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` + dict 키". 또한 **백엔드 API 추가·변경** — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신:
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` — Activity 탭 자체가 탭 목록 FieldTable (line 62–68)에 없고, 신규 `API` 컬럼과 라벨 표시 동작(라벨+endpoint 2줄 / endpoint-only / `—` fallback)이 서술되어 있지 않음
  - `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx` — 동일 누락 (sibling 규약)
- 상세:
  - 통합 상세 페이지의 탭 목록 FieldTable에 **"Activity"** 행이 없다. 이번 PR에서 그 탭에 사용자 가시 `API` 컬럼이 추가됐음에도 가이드가 탭의 존재 자체를 기술하지 않으므로, 사용자는 활동 로그의 API 컬럼이 무엇인지, cafe24 통합에서 catalog key가 어떻게 라벨로 변환되는지 알 수 없다.
  - `GET /api/integrations/services/:type/catalog` 신규 endpoint 역시 내부 인프라 수준이지만, ActivityTab이 이 endpoint를 통해 API 라벨을 가져오는 UX 동작 변경이 사용자 안내에 해당한다.
- 제안:
  1. `integration-management.mdx` 의 탭 FieldTable에 `Activity` 행 추가 — 예: `{ name: "Activity", type: "탭", required: "항상", description: "최근 7일간 호출 기록을 API·상태·소요·오류 열로 확인해요. Cafe24 통합은 API 열에 operation 라벨이 표시되고, 그 외 서비스는 메서드와 경로가 그대로 표시돼요." }`
  2. `integration-management.en.mdx` 에 동일 내용 영문 추가 (sibling 규약)
  3. `cafe24.mdx` 와 `cafe24.en.mdx` 에 "활동 탭에서 API 컬럼" 관련 1–2문장 추가 고려 (선택적이나 UX 이해에 도움)

---

### [INFO] cafe24Catalog dict 가 빈 슬롯으로 도입 — 현재 사용자에게 라벨 미노출

- 변경 파일: `codebase/frontend/src/lib/i18n/dict/ko/cafe24Catalog.ts`, `codebase/frontend/src/lib/i18n/dict/en/cafe24Catalog.ts`
- 매트릭스 항목: **신규 UI 문자열 (TSX)** — "ko/en 양쪽 등록 필수" (parity 가드)
- 상세: `ko`와 `en` 양쪽 모두 빈 `Record<string, string>` 으로 동시 도입되어 i18n parity 가드는 통과한다. 그러나 ActivityTab의 `tryTranslateLabel` 함수는 dict 미매핑 시 항상 null을 반환하므로 cafe24 호출도 endpoint-only fallback으로만 표시된다. plan `cafe24-catalog-i18n.md` 로 follow-up 분리됨.
- 판정: 설계상 의도된 부분 구현(빈 슬롯 도입 후 follow-up 채우기)이고 `plan/in-progress/cafe24-catalog-i18n.md` 가 신설되어 추적 중이므로 CRITICAL/WARNING 아님. 단, follow-up plan 완료 전까지 cafe24 API 라벨이 사용자에게 노출되지 않는다는 사실을 리뷰어가 인지할 것을 권장.

---

## i18n parity 점검 결과

| 항목 | ko | en | 판정 |
|------|----|----|------|
| `integrations.activityApi` | 추가됨 | 추가됨 | PASS |
| `integrations.activityApiUnknown` | 추가됨 | 추가됨 | PASS |
| `cafe24Catalog` 섹션 (신규) | 빈 dict 도입 | 빈 dict 도입 | PASS (parity 유지) |

## backend-labels.ts 점검 결과

이번 변경에서 신규 warningCode / errorCode 발행 없음. `backend-labels.ts` 동반 갱신 불필요. PASS.

## 신규 섹션 디렉토리 점검 결과

`codebase/frontend/src/content/docs/` 하위 신규 디렉토리 없음. `locale.ts` SECTION_LABELS_BY_LOCALE 동반 갱신 불필요. PASS.

---

## 요약

PROJECT.md §변경 유형 → 갱신 위치 매핑 매트릭스의 trigger 중 **"통합 신규/제공자 변경"** 및 **"백엔드 API 추가·변경"** 두 항목이 이번 변경 set과 매칭된다. i18n parity(ko/en integrations + cafe24Catalog 신규 섹션)는 양쪽 동시 도입으로 정상 처리됐다. 그러나 ActivityTab에 추가된 사용자 가시 `API` 컬럼과 통합 상세 페이지의 Activity 탭 자체가 `/Volumes/project/private/clemvion/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.{mdx,en.mdx}` 에 반영되어 있지 않아 WARNING 1건이 발생한다. 매트릭스 trigger 2개 매칭 / 누락 1건(docs MDX 갱신 누락).

## 위험도

WARNING

STATUS=success ISSUES=1
