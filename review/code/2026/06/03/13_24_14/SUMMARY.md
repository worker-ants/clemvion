# Code Review 통합 보고서

리뷰 대상: feat-web-chat-demo
리뷰 일시: 2026-06-03 13:24:14

---

## 전체 위험도

**LOW** — 이번 변경(데모 하니스 `apiBase` 정규화, SSE `onError` 진단 로깅, README/UI 힌트 추가)은 실질적인 결함이 없다. WARNING 2건은 테스트 경계값 커버리지 공백이며 런타임 동작에는 영향이 없다. CRITICAL 발견 없음.

---

## Critical 발견사항

발견 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `normalizeApiBase` 빈 문자열·경계값 케이스 미테스트 — `""`, 공백만, `"/"` 입력에 대한 명시 테스트가 없어 유지보수 시 회귀 위험 | `demo-config.test.ts` `describe("normalizeApiBase")` 블록 | `expect(normalizeApiBase("")).toBe("")`, `normalizeApiBase("   ")`, `normalizeApiBase("/")` 케이스 추가 |
| 2 | Testing | `use-widget.ts` `onError` 콜백이 테스트 불가 구조로 인라인됨 — `EiaClient`가 내부에서 직접 `new EiaClient(...)` 생성되어 mock 주입 지점 없음, 회귀 잡기 불가 | `use-widget.ts` L1128–1133, `use-widget.test.ts` 전체 | `EiaClient` 생성을 팩토리 함수로 추출하거나, 단기적으로 `console.warn` spy + `onError` 트리거 블랙박스 테스트로 커버 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | SSE 토큰을 URL 쿼리 파라미터(`?token=`)로 전달 — 서버 로그·브라우저 히스토리 노출 가능. 기존 설계이며 spec `EIA §8.3` 허용 패턴 | `eia-client.ts` `openStream()` L104 | 중장기적으로 POST 기반 SSE 또는 단명 쿠키 전환 검토. 현재는 HTTPS 강제 + 짧은 토큰 만료로 완화 |
| 2 | Security | `configFromQuery()` — `?apiBase=` 쿼리 파라미터를 검증 없이 직접 사용, `javascript:` 이상 스키마 미차단 | `use-widget.ts` `configFromQuery()` L1046–1053 | `apiBase` 스키마를 `https?:` 로 제한하는 가벼운 검증 추가 |
| 3 | Security | `normalizeApiBase`의 `/api$/i` 대소문자 무관 제거 — `/API`·`/Api` 포함 변형도 영향. dev-only 데모 함수라 공격 표면 없음 | `demo-config.ts` `normalizeApiBase()` L357 | `/\/api$/` 대소문자 구분 정규식으로 변경하면 더 명확 |
| 4 | Requirement | `normalizeApiBase` — `/api/api` 이중 suffix 케이스 미처리. 1회 replace만 적용되어 `/api/api` → `/api` 가 남음 | `demo-config.ts` L354–358 | 주석에 "단 1회만 제거" 명시하거나 반복 적용 고려 |
| 5 | Requirement | `normalizeApiBase` — query string/fragment 포함 URL(`?foo=bar`, `#x`) 정규화 미정의 | `demo-config.ts` L354–358 | 주석에 "query string/fragment 미지원" 명시 |
| 6 | Requirement | `buildBootConfig` 테스트에서 `apiBase` 정규화 결과(`cfg.apiBase`)를 직접 assert하지 않음 | `demo-config.test.ts` L272–300 | `expect(cfg.apiBase).toBe("http://x")` 한 줄 추가 |
| 7 | Requirement | 데모 하니스 동작(폼 필드 정규화, `normalizeApiBase`, UI 힌트 텍스트)이 `spec/7-channel-web-chat/` 어디에도 명세 없음 | `spec/7-channel-web-chat/` 전체 | spec 기록 여부는 project-planner 판단 위임 |
| 8 | Maintainability | `demo-host.tsx` 인라인 힌트에 포트 번호(`3013`)·환경 변수명이 하드코딩 — `.env PORT`와 동기화 안 됨, 드리프트 위험 | `demo-host.tsx` L509–515 | `process.env.PORT ?? "3013"` 상수로 추출해 상단 정의 |
| 9 | Maintainability | SSE CORS 경고 메시지(`/api/external/*`, `WEB_CHAT_WIDGET_ORIGINS`)가 README·demo-host JSX·use-widget 3곳에 분산 — 단일 진실 원칙 위반 가능성 | `use-widget.ts` L1128–1133, `demo-host.tsx` L509–515, `README.md` | `use-widget.ts` 상단 상수(`const SSE_CORS_WARN = "..."`)로 분리하거나 짧게 단순화 |
| 10 | Maintainability | `normalizeApiBase` 정규표현식 체이닝 순서 의존성 — `trim()` → 후행 슬래시 제거 → `/api` 제거 순서가 코드만으로 즉각 파악 어려움 | `demo-config.ts` L353–358 | 단일 정규식 `replace(/\/api\/?$/i, "")` 검토, 또는 순서 의존성 주석 명시 |
| 11 | Testing | `normalizeApiBase` — 이중 trailing `/api` 중첩 케이스(`http://host/api/api`) 의도 테스트 없음 | `demo-config.test.ts` `describe("normalizeApiBase")` | `it("does not strip repeated /api — only one trailing segment")` 추가 |
| 12 | Testing | `use-widget.ts` `onError` 콜백에 대한 테스트 전무 — `console.warn` 발화 여부·SSE 흐름 유지 미검증 | `use-widget.test.ts`, `use-widget-commands.test.ts` | `openStream` mock의 `onError` 트리거 + `console.warn` spy 패턴으로 검증 |
| 13 | Documentation | `demo-host.tsx` CORS 힌트 문단이 항상 표시되는 이유에 대한 코드 주석 없음 | `demo-host.tsx` L509–515 | `{/* CORS 주의사항은 항상 노출 — ready 여부와 무관하게 사전 안내 */}` 한 줄 추가 (필수 아님) |
| 14 | Side Effect | `defaultDemoForm.apiBase` 기본값 변경 — 메모리 전용 초기값이므로 영속 상태 충돌 없음. 다른 픽스처·문서 스니펫에서의 하드코딩 참조 여부 grep 권장 | `demo-config.ts` L397 | 현재 변경 범위 안에서 문제 없음 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 모든 발견이 기존 설계 트레이드오프 또는 dev-only 컨텍스트. 신규 취약점 없음 |
| requirement | NONE | 기능 완전성·데이터 유효성·에러 시나리오 처리에 결함 없음. 이중 `/api` 극단 케이스만 INFO |
| scope | N/A | 출력 파일 부재 (status=success로 보고됐으나 `scope.md` 디스크에 없음) |
| side_effect | NONE | 의도치 않은 전역 상태 변경·런타임 부작용 없음 |
| maintainability | LOW | 포트 하드코딩·경고 메시지 분산·정규식 순서 의존성 등 유지보수 드리프트 위험. 기능 결함 없음 |
| testing | LOW | `normalizeApiBase` 경계값·`onError` 콜백 커버리지 공백. WARNING 2건 포함 |
| documentation | NONE | 전반적으로 우수. JSDoc, README 일치, 인라인 주석 충실 |

---

## 발견 없는 에이전트

- **documentation**: 발견사항 없음 (양호). 신규 함수 JSDoc, README 갱신, 인라인 주석 모두 우수 수준.
- **side_effect**: 발견사항 없음. 추가-only 변경으로 하위 호환 파괴 없음.
- **requirement**: 기능 결함 없음. 발견된 항목 모두 INFO 수준.

---

## 권장 조치사항

1. **(WARNING — 권장)** `normalizeApiBase` 경계값 테스트 추가: `""`, `"   "`, `"/"` 입력에 대한 명시 케이스를 `demo-config.test.ts`에 추가해 함수 계약을 문서화한다.
2. **(WARNING — 중기)** `use-widget.ts` `onError` 테스트 가능성 확보: `EiaClient` 생성을 팩토리 함수로 추출하거나, 단기적으로 `console.warn` spy + mock `onError` 트리거 패턴으로 최소 검증을 추가한다.
3. **(INFO — 선택)** `demo-host.tsx` 포트 번호 하드코딩 해소: `process.env.PORT ?? "3013"` 형태의 상수로 추출해 `.env` 드리프트를 방지한다.
4. **(INFO — 선택)** `normalizeApiBase` 이중 `/api` 케이스 의도 문서화: 주석에 "1회만 제거" 명시 또는 의도 확인용 테스트 추가.
5. **(INFO — 선택)** `configFromQuery` `apiBase` 스키마 검증: `https?:` 제한 검증을 추가해 `javascript:` 이상 스키마를 방어적으로 차단한다.

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

**실행 (강제 포함 전체)**: security, requirement, scope, side_effect, maintainability, testing, documentation (7명 — 모두 router_safety 강제 포함)

**제외 (skipped)**: 7명

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | router 판단에 의해 생략 |
| architecture | router 판단에 의해 생략 |
| dependency | router 판단에 의해 생략 |
| database | router 판단에 의해 생략 |
| concurrency | router 판단에 의해 생략 |
| api_contract | router 판단에 의해 생략 |
| user_guide_sync | router 판단에 의해 생략 |

**강제 포함 (router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (전원 강제 포함)

---

*참고: `scope` reviewer는 status=success로 보고됐으나 출력 파일(`scope.md`)이 디스크에 부재하여 내용을 읽을 수 없었습니다. 해당 에이전트의 발견사항은 이 보고서에 반영되지 않았습니다.*