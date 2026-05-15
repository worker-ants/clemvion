# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 테스트 커버리지 갭(document.lang 부수효과, 로그아웃 시나리오, localStorage 예외 경로)과 두 useEffect 이중 실행으로 인한 동시성 문제가 실사용에서 재현 가능하며, 파라미터 누락 무음 치환이 프로덕션 탐지를 어렵게 함

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `locale-sync.test.tsx` — `initFromStorage` 실행 후 `document.documentElement.lang` 부수효과 미검증 | `locale-sync.test.tsx` | `expect(document.documentElement.lang).toBe("en")` 검증 추가 |
| 2 | Testing | `locale-sync.test.tsx` — 사용자 로그아웃(`user → null`) 시나리오 테스트 없음 | `locale-sync.tsx:17-21` | `user → null` 전환 후 locale 유지 케이스 추가 |
| 3 | Testing | `locale-store.test.ts` — `localStorage.setItem` 예외(QuotaExceededError) 경로 미테스트 | `locale-store.ts:34-38` | QuotaExceededError 케이스 추가 |
| 4 | Testing | `locale-store.test.ts` — 잘못된 저장값 폴백 시 `document.documentElement.lang` 미검증 | `locale-store.test.ts` | `lang` 검증 추가 |
| 5 | Testing | `locale-sync.test.tsx` — user locale 양방향 전환(en → ko) 시나리오 미테스트 | `locale-sync.test.tsx` | en→ko 재설정 케이스 추가 |
| 6 | Concurrency | `LocaleSync`의 두 `useEffect`가 첫 렌더에서 연속 실행되어 부수효과가 두 번 호출됨 | `locale-sync.tsx:12-21` | 단일 effect로 통합 |
| 7 | Concurrency | `setLocale` 내 state → storage → DOM 순서가 비원자적 | `locale-store.ts:25-36` | DOM + storage 우선 → state publish 로 재정렬 |
| 8 | Requirement | `interpolate`에서 누락된 파라미터를 빈 문자열로 무음 치환 | `core.ts:27-31` | `NODE_ENV !== "production"` 블록에서 경고 |
| 9 | Requirement | 로그아웃 후 locale 처리 정책 미명시 | `locale-sync.tsx:17-21` | 테스트 + 주석 명시 |
| 10 | Architecture | `i18n/` 레이어가 auth 도메인에 직접 의존 | `locale-sync.tsx:5` | 유지 (1회성 비용, 도메인 역전 없음 — RESOLUTION 참조) |
| 11 | Architecture | `en.ts`가 `ko.ts`에서 `Dict` 직접 임포트 | `dict/en.ts:1` | `Dict` 타입을 `dict/types.ts`로 분리 |
| 12 | Performance | `interpolate` 내 정규식 매 호출 재생성 | `core.ts:25` | 모듈 상수 `INTERPOLATION_RE` |
| 13 | Performance | `locale === "ko"` 일 때 `resolve()` 이중 호출 | `core.ts:44-47` | 조건 스킵 |
| 14 | Performance | `applyHtmlLang`이 현재 값 확인 없이 DOM 무조건 갱신 | `locale-store.ts:14-17` | 값 비교 후 갱신 |
| 15 | Maintainability | `WidenString`/`PathInto` 문서화 누락 | `dict/ko.ts`, `core.ts:7-13` | JSDoc 추가 |
| 16 | Maintainability | `index.ts` 서버 스냅샷 `"ko"` 하드코딩 | `index.ts:20` | `DEFAULT_LOCALE` 사용 |
| 17 | Side Effect | `initFromStorage`와 `setLocale`의 `applyHtmlLang` 호출 순서 비대칭 | `locale-store.ts:40-43` | 동일 순서로 정렬 |
| 18 | Security | `date.ts`가 `"use client"` 없이 클라이언트 store 임포트 | `date.ts` 상단 | 이미 해결됨 (이전 리뷰) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `afterEach` cleanup 순서 비관례적 | `locale-sync.test.tsx` | cleanup → localStorage → stores |
| 2 | Testing | localStorage:"en" + user.locale:"ko" 우선순위 통합 케이스 미작성 | `locale-sync.test.tsx` | 통합 케이스 추가 |
| 3 | Testing | `locale-store.test.ts` `afterEach`에서 `document.documentElement.lang` 초기화 누락 | `locale-store.test.ts:16-18` | 초기화 추가 |
| 4 | Architecture | `LOCALES` 배열과 `Locale` 유니온 타입 수동 동기화 | `types.ts:1-5` | 파생 타입 고려 |
| 5 | Architecture | `initFromStorage` 책임 분산 | `locale-store.ts:23`, `locale-sync.tsx:13-15` | 검토 |
| 6 | Concurrency | `useSyncExternalStore` 서버 스냅샷 hydration mismatch | `i18n/index.ts:19` | 후속 과제 |
| 7 | Side Effect | `core.ts` `console.warn`이 development와 test 환경 모두 실행 | `core.ts:43-45` | `NODE_ENV === "development"`로 좁힘 |
| 8 | Dependency | `PathInto<Dict>` 재귀 타입 성능 주의 | `core.ts:7-13` | 수용 가능 |
| 9 | Security | `resolve()` dot-notation `__proto__` 이론적 경로 | `core.ts:17-23` | 실질 위험 없음 |
| 10 | Documentation | `LocaleSync`, `applyHtmlLang`, `isLocale()` JSDoc 보완 | 각 파일 | 추가 |
| 11 | Documentation | spec/README i18n 아키텍처 미문서화(이월) | `spec/`, `frontend/README.md` | 후속 과제 |
| 12 | Maintainability | `en.ts` → `ko.ts` 의존 설명 없음 | `dict/en.ts:1` | 주석 추가 |
| 13 | Maintainability | localStorage catch 블록에 무시 이유 미명시 | `locale-store.ts:32, 37` | 주석 추가 |
| 14 | API Contract | `GET /users/me` 응답 locale 필드 가정 | `locale-sync.tsx:16` | `isLocale` 가드로 방어 중 |

---

## 발견 없는 에이전트

- **scope** — 리뷰 대상 파일 모두 i18n 구현 범위 내
- **database** — 데이터베이스 관련 변경 없음

---

## 권장 조치사항

1. **[필수]** `locale-sync.test.tsx`에 lang 검증, 로그아웃, 양방향 전환 케이스 추가
2. **[필수]** `locale-store.test.ts`에 QuotaExceededError 및 lang 검증 추가
3. **[필수]** `interpolate` 파라미터 누락 경고 추가
4. **[필수]** 로그아웃 locale 유지 동작 명시
5. **[권장]** 두 useEffect 단일 effect로 통합
6. **[권장]** `applyHtmlLang`에 현재 값 비교 조건 추가
7. **[권장]** `INTERPOLATION_RE` 모듈 상수, ko 이중 순회 제거
8. **[권장]** `Dict` 타입 `dict/types.ts`로 분리
9. **[권장]** `index.ts` 서버 스냅샷 `DEFAULT_LOCALE` 사용
10. **[선택]** `LOCALES` → `Locale` 타입 파생, spec 문서화
