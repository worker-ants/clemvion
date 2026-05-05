파일 쓰기 권한 승인이 필요합니다. 승인해주시면 SUMMARY.md를 `review/2026-05-05_16-07-30/`에 저장하겠습니다.

통합 보고서 주요 내용을 먼저 공유합니다:

---

# Code Review 통합 보고서 요약

## 전체 위험도: **MEDIUM**

런타임 핫패스(shadow-workflow, button-slug.util)는 설계가 견고하나, **`uniqueSlug` 64자 경계 버그**와 마이그레이션 스크립트의 복수 운영 리스크가 배포 전 수정을 요합니다.

## 경고 (WARNING) — 13건

| # | 핵심 이슈 | 위치 |
|---|-----------|------|
| W-1 | **`uniqueSlug` 64자 경계 uniqueness 깨짐** — base=64자+충돌 시 slice가 동일 값 반환 | `button-slug.util.ts:37-41` |
| W-2 | **`normalizeButtonsArray` fallback 충돌 검사 누락** — `btn_1`이 reserved인데 index 1이 빈 label이면 중복 ID | `button-slug.util.ts:normalizeButtonsArray` |
| W-3 | **DB 패스워드 하드코딩** — `?? 'workflow_dev'` fallback | `migrate-button-ids.ts:170` |
| W-4 | **CLI UUID 미검증** — audit_log 무결성 훼손 | `migrate-button-ids.ts:50-53` |
| W-5 | **N+1 UPDATE** — 노드 수만큼 개별 쿼리 실행 | `migrate-button-ids.ts:225-233` |
| W-6 | **전체 메모리 적재 OOM** — 페이지네이션 없음 | `migrate-button-ids.ts:183-200` |
| W-7 | **TOCTOU 경쟁 조건** — SELECT→UPDATE 사이 앱 수정 덮어씀 | `migrate-button-ids.ts:main()` |
| W-8 | **`ds.destroy()` finally 없음** — 커넥션 누수 | `migrate-button-ids.ts:main()` |
| W-9 | **`dotenv.config()` 모듈 import 시 즉시 실행** — 테스트 `process.env` 오염 | `migrate-button-ids.ts` 상단 |
| W-10 | **`PORT_ID_SLUG_REGEX`/`isValidExistingId` 이중 정의** — drift 위험 | 스크립트 vs util |
| W-11 | **배포 순서 의존성이 코드 밖에만 존재** — 마이그레이션 선행 보장 없음 | — |
| W-12 | **audit_log 범위 불일치** — 전체 스캔인데 단일 workspace_id 기록 | `migrate-button-ids.ts` audit_log |
| W-13 | **buttons 배열 null 항목 미방어** — items 레벨은 있지만 buttons 레벨 없음 | `normalizeButtonsArray`, `backfillButtonIds` |

## 즉시 수정 우선순위

1. W-1 `uniqueSlug` 버그 수정 + 테스트 보강
2. W-2 fallback 경로에 `uniqueSlug` 적용
3. W-3 DB 패스워드 필수값 강제
4. W-8 `ds.destroy()` try/finally 추가
5. W-9 `dotenv.config()` entrypoint 가드