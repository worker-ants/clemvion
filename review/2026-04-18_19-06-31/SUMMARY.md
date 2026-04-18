# Code Review 통합 보고서

## 전체 위험도
**LOW** — i18n 핵심 설계는 견고하며 Critical/High 이슈 없음. 다중 리뷰어가 지적한 WARNING은 유지보수성·테스트 완전성 중심이며 즉각적 기능 결함은 없음.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성·요구사항 | `isLocale()`이 `LOCALES` 배열과 독립적으로 하드코딩됨. 로케일 추가 시 `Locale` 유니온, `LOCALES` 배열, `isLocale` 함수 내 리터럴 3곳을 수동 동기화해야 하며 TypeScript가 불일치를 감지하지 못함 | `types.ts:1-8` | `type Locale = (typeof LOCALES)[number]`, `isLocale = (v): v is Locale => (LOCALES as readonly string[]).includes(v as string)`로 단일 소스 통합 |
| 2 | 아키텍처·의존성 | `dict/types.ts`가 `ko.ts` 런타임 값(`typeof ko`)으로 `Dict`를 파생해 한국어 dict가 스키마 권위로 고정됨. `ko.ts` 삭제 또는 구조 변경 시 `types.ts`·`en.ts`·`core.ts` 전체가 컴파일 오류 | `dict/types.ts:1` | 단기: `import type { ko }` 위에 `// ko.ts is the reference shape` 주석 추가. 장기: 명시적 인터페이스 또는 codegen으로 독립 스키마 정의 |
| 3 | 아키텍처·의존성 | `LocaleSync`(i18n 인프라 레이어)가 `auth-store`(도메인 레이어)를 직접 import — DIP 위반. auth 모듈 교체·리팩터링 시 i18n까지 변경 전파 | `locale-sync.tsx:4-5` | `LocaleSync`를 `src/lib/providers/` 또는 `src/components/layout/`으로 이동. 단기 이월 시 RESOLUTION.md에 명시 |
| 4 | 성능 | `translate()`/`resolve()` 결과 캐싱 없음. 매 호출마다 `key.split(".")` 새 배열 할당 + dict 트리 처음부터 순회. locale 전환 시 `useT()` 소비 컴포넌트 전체 재렌더 중 모든 번역 키 반복 재계산 | `core.ts:24-57` | `params` 없는 순수 키 번역에 한해 `Map<string, string>` 모듈 캐시로 `${locale}\x00${key}` 키 메모이즈. locale 전환 시 캐시 clear |
| 5 | 동시성·성능·부수효과 | `INTERPOLATION_RE`에 `/g` 플래그를 모듈 상수로 공유. `String.prototype.replace`는 안전하나, 향후 `exec()`/`test()` 루프에서 재사용 시 stale `lastIndex`로 매칭 오류 발생 | `core.ts:10-21` | 인라인 리터럴로 교체하거나 `replaceAll` 사용. 유지 시 `// safe with replace(); do not use with exec()/test() loops` 주석 필수 |
| 6 | 테스트 | "ignores unknown locale values" 테스트에서 `useLocaleStore.getState().locale`만 검증, `document.documentElement.lang` 누락. `applyHtmlLang` DOM 부수효과 회귀 감지 불가 | `locale-sync.test.tsx:63-68` | `expect(document.documentElement.lang).toBe("en")` 추가 |
| 7 | 테스트 | `localStorage.getItem` 예외 경로(`readStoredLocale`의 catch 블록) 미테스트 | `locale-store.ts:9-12` | `vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("SecurityError"); })` 케이스 추가 |
| 8 | 테스트 | localStorage에 "en"이 있고 user가 이미 인증된 상태로 마운트될 때 locale 우선순위(`user.locale > localStorage`) 미검증 | `locale-sync.tsx:22-29` | `setUser("ko")` 후 `render(<LocaleSync />)`로 초기 마운트 시 ko가 선택되는 케이스 추가 |
| 9 | 유지보수성 | `STORAGE_KEY`가 `locale-store.test.ts`에 하드코딩 중복. 키 문자열 변경 시 컴파일러가 불일치를 감지하지 못함 | `locale-store.test.ts:3` | `locale-store.ts`에서 `export const LOCALE_STORAGE_KEY`로 노출 후 테스트에서 import |
| 10 | 유지보수성 | `useT`가 `useLocale`을 호출하지 않고 `useSyncExternalStore` 패턴을 중복 작성. 구독 방식 변경 시 두 곳 동기화 필요 | `index.ts:21-25, 31-34` | `useT` 내부에서 `const locale = useLocale();` 호출로 단일 구독 경로로 정리 |
| 11 | 요구사항 | `interpolate()`가 누락된 파라미터를 빈 문자열(`""`)로 무음 치환. 프로덕션에서 `"m ago"` 같은 깨진 메시지가 탐지 없이 노출 | `core.ts:31` | 원본 플레이스홀더(`{{minutes}}`) 유지 또는 key 반환으로 폴백. JSDoc에 동작 명시 |
| 12 | 부수효과 | `applyHtmlLang` → `localStorage` → Zustand `set()` 순서가 의도적이나 문서화 없이 암묵적 계약. DOM은 새 locale, Zustand는 이전 locale인 짧은 창 존재 | `locale-store.ts:29-36` | 해당 블록에 `// DOM and storage are updated before state notification so subscribers observe a consistent world` 주석 추가 |
| 13 | 테스트·부수효과 | `useAuthStore.setState`가 partial merge로 리셋됨. `useAuthStore`에 필드 추가 시 이전 테스트 상태 잔존 위험 | `locale-sync.test.tsx:8-11` | `useAuthStore.setState({...}, true)` replace mode 사용 또는 전체 초기 상태 명시 |
| 14 | 문서화 | spec/README i18n 기여 가이드 미작성 이월 지속. 번역 키 추가 절차(`ko.ts`+`en.ts` 동시 수정), 폴백 동작, `LocaleSync` 마운트 요구사항 미문서화 | RESOLUTION.md | `frontend/src/lib/i18n/README.md` 최소 내용: 지원 로케일, 키 추가 절차, `useT` vs `translate` 기준, `LocaleSync` 역할 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 |
|---|----------|----------|------|
| 1 | 문서화 | `isLocale()` 공개 API JSDoc 누락 | `types.ts:5-7` |
| 2 | 문서화 | `readStoredLocale()` SSR 가드·catch 이유 주석 누락 | `locale-store.ts` |
| 3 | 문서화 | `interpolate()` `{{placeholder}}` 문법 및 누락 파라미터 동작이 `translate()` JSDoc에 미반영 | `core.ts` |
| 4 | 아키텍처 | `locale-store` 초기값이 `DEFAULT_LOCALE`이고 실제 값은 `LocaleSync` 마운트까지 반영 안됨. `LocaleSync` 없이 store만 사용하면 항상 기본값 | `locale-store.ts:29` |
| 5 | 아키텍처 | `Locale` 유니온과 `LOCALES` 배열이 별도 정의 — 이중 소스. `type Locale = (typeof LOCALES)[number]`로 통합 가능 (RESOLUTION 이월) | `types.ts:1-5` |
| 6 | 의존성 | `PathInto<Dict>` 재귀 타입 — dict 2배 이상 확장 시 TypeScript 재귀 연산 증가로 IDE 지연 및 `Type instantiation is excessively deep` 오류 우려 | `core.ts:7-13` |
| 7 | 유지보수성 | `resolve()`의 `let current: any` — `Record<string, unknown>`으로 시작 후 타입 좁히기 가능 | `core.ts:24` |
| 8 | 유지보수성 | `if (value === undefined \|\| value === null)` → `if (value == null)` 간결화 가능 | `core.ts:31` |
| 9 | 유지보수성 | `locale-store.test.ts` `beforeEach`/`afterEach` 초기화 범위 비대칭 (`afterEach`에 store reset 누락) | `locale-store.test.ts:11-18` |
| 10 | 테스트 | `locale-sync.test.tsx` `afterEach`의 `resetStores()` 중복 호출 (`beforeEach`에도 있음) | `locale-sync.test.tsx:37-42` |
| 11 | 테스트 | `setLocale`을 동일 값으로 호출하는 no-op 시나리오 미테스트 (`applyHtmlLang` 조건 분기 미검증) | `locale-store.ts:20-23` |
| 12 | 테스트 | localStorage 비어있고 user 없는 순수 기본값 경로가 `LocaleSync` 통해 미검증 | `locale-sync.test.tsx` |
| 13 | 성능 | `useSyncExternalStore` snapshot 함수가 매 렌더마다 인라인 생성 — 모듈 상수로 추출하면 의도 명확 | `index.ts:17-18, 26-27` |
| 14 | 보안 | `resolve()`의 dot-notation 순회 시 `__proto__`/`constructor` 키 접근 이론적 가능 (쓰기 없음, 타입 시스템 방어로 실질 위험 없음) | `core.ts:18-25` |
| 15 | 보안 | `translate()` 반환값을 `dangerouslySetInnerHTML`에 사용 시 XSS 위험 (현재 코드베이스는 텍스트 노드 렌더링으로 안전) | `core.ts:27-40` |
| 16 | 요구사항 | `WidenString` 배열 분기가 현재 dict 구조에서 dead code (dict에 배열 미사용) | `dict/types.ts:6-7` |
| 17 | 요구사항 | `translate()`가 두 로케일 모두 키 없을 때 raw key 반환 — 프로덕션 탐지 수단 없음 | `core.ts:53-57` |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | LOW | 3개 WARNING: DOM 부수효과 미검증, getItem 예외 경로 미테스트, 인증 사용자 마운트 시나리오 누락 |
| Maintainability | LOW | `useT` 구독 경로 중복, `isLocale` 3곳 동기화 필요, `STORAGE_KEY` 하드코딩 |
| Requirement | LOW | `isLocale` LOCALES 비연동, `interpolate` 빈 문자열 무음 치환 |
| Dependency | LOW | `dict/types.ts`→`ko.ts` 의존, `LocaleSync`→`auth-store` DIP 위반 |
| Architecture | LOW | dict 비대칭 스키마 권위, auth 레이어 의존, store 초기화 컴포넌트 의존 |
| Performance | LOW | `translate()` 캐싱 없음, INTERPOLATION_RE `/g` 플래그 모듈 공유 |
| Side Effect | LOW | `setLocale` 순서 암묵적 계약, `useAuthStore.setState` partial merge |
| Concurrency | LOW | `INTERPOLATION_RE` `/g` 플래그 future footgun |
| Documentation | LOW | spec/README i18n 기여 가이드 이월 지속 |
| Security | LOW | `resolve()` dot-notation 이론적 체인 접근, `dangerouslySetInnerHTML` 미래 위험 |
| Scope | NONE | 범위 벗어난 변경 없음 |
| Database | NONE | 해당 없음 |
| API Contract | NONE | 해당 없음 |

---

## 발견 없는 에이전트

- **Database** — 프론트엔드 i18n 구현으로 DB 관련 변경 없음
- **API Contract** — 백엔드 API 엔드포인트 직접 변경 없음 (`/users/me` `locale` 필드는 `isLocale()` 가드로 방어적 처리)
- **Scope** — 모든 변경이 이전 리뷰 이슈 조치로 RESOLUTION.md에 문서화됨

---

## 권장 조치사항

1. **`isLocale()` 단일 소스 통합** (WARNING #1) — `type Locale = (typeof LOCALES)[number]` + 배열 기반 `includes()` 가드로 교체. 신규 로케일 추가 시 조용한 버그 방지 효과 가장 큼
2. **테스트 3개 보강** (WARNING #6, #7, #8) — DOM lang 검증 추가, `getItem` 예외 케이스, 인증 사용자 마운트 시나리오
3. **`useT` → `useLocale()` 재사용** (WARNING #10) — `useSyncExternalStore` 중복 제거로 구독 경로 단일화
4. **`INTERPOLATION_RE` `/g` 플래그 처리** (WARNING #5) — 인라인 리터럴 교체 또는 `replaceAll` 전환. 유지 시 반드시 주석 추가
5. **`STORAGE_KEY` export** (WARNING #9) — 테스트 하드코딩 제거
6. **`interpolate()` 누락 파라미터 동작 명시** (WARNING #11) — JSDoc에 빈 문자열 치환 동작 문서화 또는 원본 플레이스홀더 유지로 변경
7. **`setLocale` 순서 주석** (WARNING #12) — DOM→storage→state 순서의 의도 한 줄 주석으로 명시
8. **`useAuthStore.setState` replace mode** (WARNING #13) — `true` 플래그 추가로 테스트 간 오염 방지
9. **`translate()` 결과 캐싱** (WARNING #4) — `params` 없는 순수 키에 `Map` 캐시 적용 (선택적, 현재 dict 규모에서 즉각적 체감은 낮음)
10. **i18n README 작성** (WARNING #14) — 기여 가이드 이월 해소