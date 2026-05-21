# Code Review SUMMARY — PR2 External Interaction API 구현

> 세션: `review/code/2026/05/21/12_23_04`
> 대상: PR2 (`origin/main..HEAD` 16+ 파일) — backend external-interaction 모듈, SDK 패키지, frontend 카드, e2e
> 12 reviewer 결과 통합 (router skip: performance 1건)

## 전체 위험도: **MEDIUM**

- **Critical**: 0건
- **Warning**: 24건
- **Info**: 36건

CRITICAL 수준 발견사항 없음. 즉시 조치 필요한 항목 4건은 모두 SDK 영역의 follow-up 으로 별도 PR 분리 가능 (backend 4232 unit + 97 e2e 는 통과 상태).

## 즉시 조치 필요 (Warning)

| # | 영역 | 발견 | 위치 | 권장 |
|---|------|------|------|------|
| W1 | SDK | `parseSseFrame` 다중 `data:` 라인 단순 concat → SSE RFC 위반, 멀티라인 JSON 이벤트 무음 드롭 | `packages/sdk/src/client.ts` | `data += '\n' + line.slice(5).trim()` |
| W2 | SDK | `subscribeToExecution` 전체 테스트 부재 | `packages/sdk/src/client.spec.ts` | ReadableStream mock 으로 happy/close/error 3 케이스 |
| W3 | SDK | `cancel()` 메서드 `Idempotency-Key` 미발급 — `interact()` 와 비대칭 | `client.ts` | `randomUUID()` 자동 발급 |
| W4 | SDK | `randomUUID from 'crypto'` 브라우저 런타임 오류 | `client.ts` | `globalThis.crypto?.randomUUID?.()` |
| W5 | Backend | `InteractionController` NestJS 통합 테스트 부재 | (신규 spec 필요) | Test.createTestingModule 통합 spec |
| W6 | Backend | `HooksService` interaction 토큰 동봉 회귀 케이스 미확인 | `hooks.service.spec.ts` | enabled=true fixture |
| W7 | SDK | `subscribeToExecution` 자동 재연결 미지원이 README 와 괴리 | `README.md` | "v1 미지원, onError 에서 lastSeq() 수동 재호출" 명시 |
| W8 | SDK | `ts-jest ^29` + `jest ^30` 메이저 불일치 | `package.json` | ts-jest ^30 으로 |
| W9 | Architecture | `subscribeToExecution` 책임 과부하 (HTTP + SSE parse + 연결 관리) | `client.ts` | `readSseStream` / `connectSse` 분리 |
| W10 | Architecture | `as unknown as T` 이중 캐스팅 — 응답 shape 불일치 흡수 | `client.ts` | runtime field check |
| W11 | API Contract | `{ data: ... }` 래퍼 처리 이중 경로 | `client.ts` | backend 응답 형식 통일 + JSDoc |
| W12 | API Contract | `cancel` 이 README 에서 alias 라고 표기되나 별도 endpoint | `README.md` | 차이 명시 |
| W13 | API Contract | `InteractCommand` 의 `'cancel'` 과 `cancel()` 이중 경로 — 멱등성 수준 상이 | `client.ts` | 권장 경로 하나 문서화 |
| W14 | Security | HMAC hex 입력 유효성 미검증 | `signature.ts` | `/^[0-9a-f]+$/i` 명시 |
| W15 | Security | `baseUrl` scheme 검증 없음 → SSRF 위험 | `client.ts` constructor | `https://` 검증 또는 문서 경고 |
| W16 | Side Effect | SSE 토큰 query string 로그 노출 | `client.ts` | 서버 로그 redact 또는 README 경고 |
| W17 | Side Effect | `reader.cancel()` 미호출 — ReadableStream lock 잔존 가능 | `client.ts` | finally 블록 추가 |
| W18 | Documentation | 패키지명 `@workflow/sdk` vs `@clemvion/sdk` plan 불일치 | `plan/complete/external-interaction-api.md §3.2` | plan 정정 |
| W19 | Documentation | `cancel`/`refreshToken`/`getStatus` API 경로 표기가 상대 경로 — `interact` 와 불일치 | `README.md` | 전체 경로 통일 |
| W20 | Database | `seq_counter` atomic INCR 방식 미확정 (Redis vs DB lock) — plan 양쪽 병기 | plan §P0 | 하나로 확정 (Redis INCR 권장) |
| W21 | Database | V059 슬롯 경합 (`replay-rerun` 브랜치) | plan | 본 PR2 가 V059 점유 — 이미 적용됨 (검증 OK) |
| W22 | Database | `notification_health` CHECK 제약 plan-spec 불일치 — 본 PR 의 V059 SQL 에는 포함됨 (검증 OK) | (해소됨) | 없음 |
| W23 | Requirement | i18n `notificationSecretRotate: "Secret rotation"` 한국어 미번역 | `ko/triggers.ts` | "시크릿 교체" |
| W24 | Testing | `NotificationDispatcher`-`NotificationWebhookProcessor` 계약 단절 위험 (typed job payload) | (양쪽 공유 schema) | follow-up |

## 영향도 분석

대다수 warning 은 SDK (`codebase/packages/sdk/`) 영역. backend 핵심 (interaction controller / token service / dispatcher / processor / SSE adapter) 의 단위 + e2e 회귀 테스트는 모두 통과. SDK 는 v0.1.0 으로 표시되어 있고 외부 publish 전이라 follow-up 으로 분리하기에 안전.

backend / spec / plan 영역의 warning:
- W5 InteractionController 통합 spec (개선)
- W6 HooksService 회귀 spec (개선)
- W18 plan 의 SDK scope 표기 정정 (`@workflow/sdk`)
- W20 plan §P0 노트 정확화 (실 구현은 in-memory Map)
- W23 i18n 한국어 (1줄)

## Router 결정 — performance skip

`performance-reviewer` 1건 skip. 사유: SDK 클라이언트 / SSE 구독 신규 추가이지만 성능 최적화·캐싱·쿼리 가속 변경 없음. router 자동 판정.

## 결론

본 PR2 의 backend 핵심 회귀는 안전 (lint 0 errors, 4232 unit passed, 97 e2e passed). SDK 의 SSE parser / 테스트 / 멱등성 follow-up 은 별도 PR 로 분리 권장. plan 의 §"완료 후 잔여" 절에 SDK follow-up 항목을 cross-link 로 추가하면 추적 가능.
