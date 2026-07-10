# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 19건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표 + 자주 누락 항목 + DOCUMENTATION 체크리스트) 를 함께 Read.

## 변경 set 요약 (7 파일)
- 신규: `activity-disconnected-banner.tsx` / `.test.tsx`
- 수정: `integrations/[id]/page.tsx` (ActivityTab 에 배너 결선)
- 수정: `dict/en/integrations.ts`, `dict/ko/integrations.ts` (`activityDisconnectedTitle/Hint/Action` 3키)
- 수정: `spec/2-navigation/4-integration.md` (§4.6 배너 서술 추가)
- 신규: `plan/in-progress/activity-disconnected-banner.md`

## 발견사항

### [WARNING] 유저 가이드 MDX "Activity 탭" 설명이 신규 배너를 반영하지 못함(stale)
- 변경 파일: `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx`, `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/activity-disconnected-banner.tsx`
- 매트릭스 근거: 개별 glob trigger("통합 신규/제공자 변경" 행 — `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx} + dict 키`)는 provider-specific 이라 문자 그대로는 매칭되지 않지만, PROJECT.md §DOCUMENTATION 체크리스트("사용자 가시면 … 이 코드 변경의 의미를 정확히 반영하는가? 단순 동기화가 아닌 *의미 갱신*")와 §자주 누락되는 항목("노드 schema 변경 vs 가이드 본문 — dict 키만 갱신하고 …mdx 미갱신. 가이드 본문이 spec 과 어긋남")의 정신에 해당하는 케이스.
- 근거 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` (frontmatter `code:` 배열이 바로 이 PR 이 수정한 `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/page.tsx` 를 명시적으로 가리킴 — 즉 이 mdx 가 해당 파일을 문서화하는 공식 유저 가이드임이 frontmatter 로 확정됨)
- 누락된 동반 갱신:
  - `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx` (line 67, `Activity` 탭 `FieldTable` row) — 현재 "최근 7일간 호출 기록을 API·상태·소요·오류 열로 확인해요…" 로만 서술, `status ≠ connected` 시 뜨는 "연결 안 됨" 경고 배너 + `[상태 확인]` 버튼(개요 탭 이동)에 대한 언급 없음
  - `codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx` (line 56, 동일 row, 영문도 동일하게 stale — ko/en 모두 누락이라 parity 문제는 아니지만 두 로케일 다 stale)
- 상세: spec(`spec/2-navigation/4-integration.md` §4.6)과 dict(ko/en)는 이번 커밋에서 정확히 갱신됐으나, 실제 사용자가 `/docs/06-integrations-and-config/integration-management` 에서 읽는 "Activity 탭" 설명 문단은 이 신규 배너를 반영하지 않는다. 사용자가 통합이 `error`/`expired`/`pending_install` 상태일 때 활동 탭에 새 경고 배너가 왜 뜨는지, 원인 확인을 위해 어디로 가야 하는지 가이드에서 찾을 수 없다 — spec 은 내부 SoT 이고 실제 사용자 가시 문서는 이 mdx 이므로 "사용자 가이드가 stale" WARNING 에 해당.
- 제안: `integration-management.mdx` / `.en.mdx` 의 Activity 탭 `FieldTable` description(또는 그 아래 `<Callout>`)에 "연결이 끊긴 상태(error/expired/pending_install)에서는 새 활동이 기록되지 않으므로 경고 배너가 뜨고, Overview 탭에서 상태를 확인·재연결할 수 있다" 는 문장을 ko/en 동시 추가.

## 정상 확인된 동반 갱신 (참고용, 이슈 아님)
- **신규 UI 문자열 (TSX)** 매칭 — `dict/ko/integrations.ts` + `dict/en/integrations.ts` 양쪽에 `activityDisconnectedTitle`/`Hint`/`Action` 3키가 같은 변경 set 에 동시 등록됨 (parity 충족, CRITICAL 없음).
- **spec 신규/대규모 변경** 매칭 (`spec/2-navigation/4-integration.md`, `spec/2-*/**` glob) — frontmatter `status: implemented` 유지, `code:` 글로브에 이미 `codebase/frontend/src/app/(main)/w/[slug]/integrations/[id]/**` 가 포함돼 있어 신규 `activity-disconnected-banner.tsx`/`.test.tsx` 도 커버됨 (frontmatter 정합 갱신 불필요).
- **통합 신규/제공자 변경** — provider(cafe24/makeshop/google 등) 자체의 신규·변경이 아니라 전 provider 공통 상태 배너이므로 이 trigger 는 미해당(gray-zone 아닌 명확한 비매칭).
- 노드 추가/schema 변경, 신규 섹션 디렉토리, 인증·세션 흐름 변경, 표현식 언어 변경, 실행·디버깅 흐름 변경, 신규 warning/error code — 이번 변경 set 에 해당 파일 없음, 전부 비매칭.

## 요약
매트릭스 19개 trigger 중 "신규 UI 문자열(TSX)"·"spec 신규/대규모 변경" 2건이 매칭되었고 둘 다 동반 갱신이 이번 커밋 안에서 정확히 완료됨(CRITICAL 없음, i18n parity 정상). 다만 매트릭스에 정확히 1:1 대응하는 named trigger 는 없지만 PROJECT.md 의 "가이드 본문이 spec 과 어긋남" 원칙에 해당하는 유저 가이드 stale 1건(WARNING) — `integration-management.mdx`/`.en.mdx` 의 Activity 탭 설명이 신규 "연결 안 됨" 배너를 반영하지 않음 — 을 발견.

## 위험도
LOW
