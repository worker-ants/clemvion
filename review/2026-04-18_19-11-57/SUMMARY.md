파일 쓰기 권한이 필요합니다. 승인 후 보고서를 저장하겠습니다.

아래는 작성된 통합 보고서 내용입니다:

---

# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 결함은 없으며 이전 라운드 WARNING의 대부분이 해소됨. 아키텍처 레이어 경계 위반(auth 의존, SRP)·CLAUDE.md 명시 문서화 요구사항 미이행·소수 테스트 갭이 잔존

---

## Critical 발견사항
없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture/Dependency | `locale-sync.tsx`가 `i18n/` 모듈 내에서 `auth-store`에 직접 의존 — 크로스도메인 결합 | `locale-sync.tsx:4` | `lib/providers/`로 이동 또는 `userLocale` props 주입 |
| 2 | Architecture | `locale-store.ts` SRP 위반 — 상태관리·localStorage·DOM 동기화 혼재 | `locale-store.ts` 전체 | `applyHtmlLang` 외부 분리 또는 영속성 어댑터 추출 |
| 3 | Architecture | `index.ts` React 훅이 Zustand 스토어에 직접 결합 | `index.ts:4` | 의존성 주입 방식 분리 검토 |
| 4 | Side Effect | `index.ts` `"use client"` 배럴이 서버 컴포넌트의 `translate` 접근 차단 — 미문서화 | `index.ts:1` | 파일 상단에 서버/클라이언트 구분 주석 추가 |
| 5 | Documentation | `/docs` i18n 시스템 가이드 없음 — CLAUDE.md 요구사항 미이행 | `frontend/src/app/(main)/docs/` | `useT()` vs `translate()` 구분, 키 추가 절차, 폴백 동작 문서 추가 |
| 6 | Documentation | `DEFAULT_LOCALE = "ko"` 선택 근거 미문서화 | `types.ts:4` | JSDoc 추가 |
| 7 | Maintainability | `STORAGE_KEY` 상수가 스토어·테스트에 중복 정의 — 키 변경 시 무음 회귀 | `locale-store.ts:6`, `locale-store.test.ts:4` | export 후 테스트에서 import |
| 8 | Maintainability | `PathInto<T>` 타입 비표준 명명·제약 미문서화 | `core.ts:10-17` | `DotKeyOf<T>`로 이름 변경 또는 제약 주석 명시 |
| 9 | Performance | `LocaleSync`에서 stable action을 Zustand selector로 구독 | `locale-sync.tsx:21-22` | effect 내부에서 `useLocaleStore.getState()` 직접 사용 |
| 10 | Testing | "ignores unknown locale" 테스트에서 `document.documentElement.lang` 미검증 | `locale-sync.test.tsx:60-70` | `expect(document.documentElement.lang).toBe("en")` 추가 |
| 11 | Testing | `interpolate` 개발환경 경고 분기가 테스트 환경에서 미실행 | `core.ts:42-44` | 조건 `!== "production"`으로 완화 또는 `vi.spyOn` 활용 |
| 12 | Security (기존) | 서버 오류 메시지 UI 직접 노출 패턴 — 이번 변경과 무관한 기존 이슈 | 다수 컴포넌트 | API 에러 핸들러 중앙화, generic 키로만 표시 |

---

## 참고 (INFO) — 요약

- **Security**: `Object.hasOwn` 미사용(실질 위험 없음), interpolate XSS 잠재 경로(React 이스케이프로 보호), localStorage 키 오리진 충돌(화이트리스트로 제한)
- **Dependency**: locale-store ↔ i18n/index.ts 레이어 모호성, ko.ts 암묵적 마스터 미문서화
- **Concurrency**: `/g` 플래그 lastIndex footgun(현재 안전), Zustand 싱글톤 SSR 공유(현재 안전)
- **Architecture**: locale 추가 지점 3곳 분산
- **Maintainability**: `useT()`/`useLocale()` 구독 보일러플레이트 중복, `resetStore`/`resetStores` 네이밍 불일치
- **Testing**: `useT()`/`useLocale()` 훅 직접 테스트 없음, `translate()` 단위 테스트 미확인, falsy 경계값 미검증
- **Requirement**: `null` dead code, params 오타 컴파일 미감지
- **Documentation**: `isLocale()`·`LocaleState`·`TranslationKey`·`TFunction` JSDoc 없음

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | interpolate XSS 잠재, 서버 오류 노출(기존) |
| dependency | LOW | locale-sync.tsx auth-store 크로스 의존 |
| concurrency | LOW | /g 정규식 lastIndex footgun(현재 안전) |
| maintainability | LOW | STORAGE_KEY 중복, PathInto 제약 미문서화 |
| testing | LOW | ignores unknown locale DOM 미검증, 경고 분기 미테스트 |
| requirement | LOW | 훅 직접 테스트 없음, null dead code |
| documentation | LOW | /docs i18n 가이드 없음, DEFAULT_LOCALE 근거 미문서화 |
| architecture | LOW | SRP 위반, auth 크로스 결합, Zustand 직접 결합 |
| side_effect | LOW | "use client" 배럴 서버 차단 미문서화 |
| performance | LOW | stable action selector 구독 |
| scope | NONE | 범위 내 경미한 초과 2건(INFO 수준) |
| api_contract | NONE | 해당 없음 |
| database | NONE | 해당 없음 |

---

## 발견 없는 에이전트
- **api_contract**, **database** — 관련 변경 없음

---

## 권장 조치사항

1. `/docs` i18n 가이드 문서 추가 (CLAUDE.md 요구사항)
2. `locale-sync.tsx` → `lib/providers/`로 이동, auth 의존 제거
3. "ignores unknown locale" 테스트에 `document.documentElement.lang` 단언 추가
4. `STORAGE_KEY` export 및 테스트에서 import
5. `index.ts` 서버/클라이언트 분리 주석 명시
6. `DEFAULT_LOCALE` JSDoc 추가
7. `useT()`/`useLocale()` 훅 직접 테스트 추가
8. `interpolate` 경고 분기 테스트 추가
9. `LocaleSync` effect → `useLocaleStore.getState()` 직접 사용으로 전환
10. `locale-store.ts` SRP 점진적 분리 검토