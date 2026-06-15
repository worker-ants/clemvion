# RESOLUTION — authentication God Component 분리 (최종 수렴, config-c1-auth-god-split)

> 대상 리뷰: `review/code/2026/06/16/01_02_20/SUMMARY.md` — **RISK LOW / Critical 0 / WARNING 4** (8 reviewer 전원 성공).
> 선행: 1차 `00_22_46`(C0/W4), 2차 `00_39_27`(C0/W10, RESOLUTION 有), impl-done `00_51_32`(CRITICAL: STATUS_BADGE_VARIANT export 충돌) → fix(commit 73ef0a77) → impl-done `01_02_21`(**BLOCK: NO**).
> 본 PR 제약: **순수 구조 리팩토링 — 동작·UI·API·i18n 불변**.

## 수렴 경과
1. 리팩토링 → ai-review C0 → testing W1·W2·W3 **테스트 추가**(commit 9ad6310a).
2. impl-done 이 **CRITICAL**(내가 `STATUS_BADGE_VARIANT` 를 file-private→export 하며 `lib/utils/execution-status.ts` 동명 export 와 충돌) 발견 → **page-local 로 원복 + TYPE_LABEL_KEYS 를 AUTH_TYPES 에서 파생**(commit 73ef0a77, 동작 불변).
3. 재무장된 가드 대응 fresh ai-review(01_02_20, **LOW/C0/W4**) + fresh impl-done(01_02_21, **BLOCK: NO**). **이후 코드 무변경** — 본 RESOLUTION + 산출물 커밋으로 종결.

## WARNING 4건 disposition (전부 pre-existing 또는 후속 — 본 PR 동작변경 없음)

| # | 발견 | 처분 |
| --- | --- | --- |
| W1 | Regenerate·Delete 버튼 Admin RBAC UI 가드 누락 | **DEFER (pre-existing)** — merge-base byte-identical, 백엔드 `@Roles('admin')` fail-closed(권한상승 불가). plan `spec-sync-config-gaps.md` 후속 항목 등록(Add 버튼 포함). 동작(UI) 변경이라 순수 리팩토링 범위 밖 |
| W2 | `generatedKey` 자동 만료 타임아웃 없음 / regenerate 생명주기 혼재 | **DEFER (pre-existing)** — 분리 전 page.tsx 도 generatedKey 에 타임아웃 없었음(revealedSecret 만 30초). 동작 등가. generatedKey 자동클리어는 **C-2(PR #615)** 가 별도 처리하는 항목 |
| W3 | 다이얼로그 래퍼 DOM 중복(create/edit + 확인모달) | **DEFER (후속 maintainability)** — `AuthConfigDialogShell` 추출은 추가 리팩토링. 본 PR 은 plan 한정 create/edit 폼 추출 범위 |
| W4 | `auth-config-form-fields.tsx` select className 중복 | **DEFER (후속 maintainability)** — `SelectField`/상수 추출 후속 |

## INFO disposition (요약)
- **SPEC-DRIFT (INFO-1) / impl-done I-1**: spec `6-config.md` frontmatter `code:` 에 신규 5파일 미등재 → **planner 위임**(developer 는 spec/ read-only). `code:` 의 `**` glob 확장 권고는 planner 가 판단. 빌드 가드(spec-code-paths)는 page.tsx 존재로 미차단.
- **Architecture INFO-2·3 (ISP·validateAndProceed toast 혼재)**: 동작보존 추출이 원본 패턴(원본 page.tsx 도 validateAndProceed 가 toast 직접 호출) 유지. 인터페이스 분할/에러반환형 전환은 후속.
- **Testing INFO-4·5·6·7·8**: api_key 경로는 통합테스트 커버, 신규 훅/유틸은 9ad6310a 로 직접 가드 추가됨. hmac 조건부 렌더·fireEvent/userEvent 통일·afterEach locale 복원·beforeEach cleanup 중복 제거 등은 경미 — 현행 유지(추가 테스트 편집은 가드 재무장 유발, 수렴 우선).
- **INFO-11 (plan STATUS_BADGE_VARIANT 산출목록 불일치)**: 73ef0a77 에서 page-local 로 원복했으므로 plan 산출목록 기술과 정합(plan 은 "신규 5파일" 만 산출로 명시, STATUS_BADGE_VARIANT 는 page 내 유지).

## 게이트 (최종)
- lint·tsc·eslint clean, frontend unit **4435 pass**, build PASS.
- ai-review 01_02_20: **LOW / Critical 0**. consistency --impl-done 01_02_21: **BLOCK: NO**.
- 잔여 WARNING 전부 pre-existing/후속 disposition. 본 RESOLUTION + 산출물은 codebase 무변경 → review·impl-done 가드 종결.
