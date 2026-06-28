# Code Review 통합 보고서

## 전체 위험도
**NONE** — 전체 리뷰어 발견사항이 모두 INFO 수준이며 Critical/Warning 항목 없음. `buildDefaultCorsOptions` 순수 팩토리 추출 리팩터링은 안전하고 범위 내에서 완료됐다.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

해당 없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `buildDefaultCorsOptions` JSDoc 이 SoT 로 지정한 `spec/5-system/17-agent-memory §6 AGM-13` 에 `X-Deleted-Count` CORS `exposedHeaders` 요구사항이 명문화되지 않음. 코드 동작은 합리적·의도적이나 spec 본문 누락 | `web-chat-cors.ts` `buildDefaultCorsOptions` JSDoc; `spec/5-system/17-agent-memory §6`, `spec/7-channel-web-chat/4-security §2` | 코드 유지. project-planner 가 해당 spec 섹션에 "`DELETE /agent-memories?scopeKey=` 응답은 `X-Deleted-Count` 헤더로 삭제 건수 반환, CORS `Access-Control-Expose-Headers: X-Deleted-Count` 설정 필수" 항목 추가 |
| 2 | Testing | `resolveAllowlist` 실패(reject) 경로 테스트에서 `credentials: false` assertion 누락. 프로덕션 코드는 명시적으로 `credentials: false` 반환하나 이 부분이 검증되지 않음 | `web-chat-cors.spec.ts` 라인 138–151 | 해당 케이스에 `expect(opts.credentials).toBe(false)` 추가해 fail-closed 시 credentials 도 안전히 닫힘을 명시적으로 검증 |
| 3 | Testing | `buildDefaultCorsOptions(undefined)` 엣지 케이스 미검증. 파라미터 타입(`CorsOptionsLike['origin']`)이 `undefined` 허용하나 해당 경계값 테스트 없음. 프로덕션 경로에서는 항상 콜백 주입이라 런타임 위험 낮음 | `web-chat-cors.spec.ts` 라인 182–200; `web-chat-cors.ts` 라인 126–134 | `buildDefaultCorsOptions(undefined)` 호출 시 `opts.origin === undefined` 검증 케이스 추가 또는 파라미터 타입을 narrowing해 `undefined` 명시적 배제 |
| 4 | Testing | `decide` 헬퍼의 `opts!` non-null 단언 — `cb(null, undefined)` 경로 추가 시 assert 없이 `undefined` 를 resolve할 수 있음 | `web-chat-cors.spec.ts` 라인 14–17 | `resolve(opts ?? ({} as CorsOptionsLike))` 또는 `if (!opts) reject(...)` 패턴으로 방어, 또는 단언 이유 주석 명시 |
| 5 | Maintainability | `createWebChatCorsDelegate` describe 블록에서 최소 스텁 `defaultOptions`와 실제 팩토리 `buildDefaultCorsOptions` 주입 패턴이 혼재 — 의도는 명확하나 문서화 부재로 미래 유지자 혼동 가능 | `web-chat-cors.spec.ts` 라인 197–200, 284–297 | 로컬 스텁 선언부에 1줄 주석(`// 라우팅 로직만 검증하는 최소 스텁 — exposedHeaders 검증은 별도 케이스 참조`) 추가 |
| 6 | Maintainability | `buildDefaultCorsOptions` JSDoc 과 `CorsOptionsLike.exposedHeaders` JSDoc 에 `X-Deleted-Count` 배경 설명이 중복. 향후 헤더 이름 변경 시 한 곳만 수정해 불일치 발생 가능 | `web-chat-cors.ts` 라인 416–421, 371–382 | `buildDefaultCorsOptions` JSDoc 의 exposedHeaders 설명 부분을 "CorsOptionsLike.exposedHeaders JSDoc 참고" 참조로 대체 |
| 7 | Maintainability | `main.ts` 인라인 주석의 `// W3` 같은 내부 태그가 맥락 없이 불투명 | `main.ts` 라인 790–792 | 내부 티켓 태그 제거 또는 spec 링크(`spec/5-system/17-agent-memory §6`)로 대체 |
| 8 | Security | `/api/external/*` 경로에서 `origin` 없는 요청 무조건 허용 — interaction token 인가 레이어 존재 여부가 이번 diff 범위 밖 | `web-chat-cors.ts` 라인 455 | diff 범위 밖이나 후속 리뷰에서 `/api/external/*` 에 interaction token 인가 레이어가 반드시 적용되어 있는지 확인 |
| 9 | Security | `decodeURIComponent` 결과물이 DB 쿼리로 전달 시 parameterized query/ORM 사용 여부 이번 diff 범위에서 확인 불가 | `web-chat-cors.ts` 라인 446; `resolveAllowlist` 구현체 | execution id를 SQL로 처리하는 `resolveAllowlist` 구현체에서 반드시 parameterized query/ORM 바인딩 사용 확인 (별도 검토 필요) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | CORS 정책 전반 안전. 주의사항은 이번 diff 범위 밖 구현체(interaction token 인가, resolveAllowlist 쿼리 처리)에 한정 |
| requirement | NONE | 기능 완전성 달성. SPEC-DRIFT 1건: spec에 `X-Deleted-Count` CORS 요구사항 명문화 필요 |
| scope | NONE | 변경 범위 일탈 없음. 3개 파일 모두 단일 목적(팩토리 추출)에 수렴 |
| side_effect | NONE | 순수 팩토리 전환, additive export 추가, 런타임 동작 동일 — 의도치 않은 부작용 없음 |
| maintainability | NONE | 유지보수성 향상 리팩터링. 주석/JSDoc 중복·혼재 관련 INFO 3건 |
| testing | LOW | 핵심 목표(동어반복 제거·실 팩토리 검증) 달성. `credentials: false` assertion 누락 등 보완 가능 테스트 항목 INFO 4건 |

## 발견 없는 에이전트

- scope: 변경 범위 일탈 발견 없음
- side_effect: 의도치 않은 부작용 발견 없음

## 권장 조치사항

1. **(SPEC-DRIFT)** project-planner 에게 `spec/5-system/17-agent-memory §6` 또는 `spec/7-channel-web-chat/4-security §2` 에 `X-Deleted-Count` CORS `exposedHeaders` 요구사항 명문화 요청 (코드 변경 불필요, spec 보완 과제)
2. `web-chat-cors.spec.ts` 의 `resolveAllowlist` reject 경로에 `expect(opts.credentials).toBe(false)` assertion 추가
3. `buildDefaultCorsOptions(undefined)` 엣지 케이스 테스트 추가 또는 파라미터 타입 narrowing
4. 로컬 스텁 `defaultOptions` 선언부에 혼재 이유 주석 1줄 추가 (maintainability + testing 공통 제안)
5. `decide` 헬퍼의 `opts!` 단언을 방어적 패턴으로 교체 또는 주석 명시
6. `main.ts` 주석의 내부 티켓 태그(`W3`) 제거 또는 spec 링크로 대체
7. 후속 별도 리뷰: `/api/external/*` interaction token 인가 레이어 존재 확인, `resolveAllowlist` 구현체의 parameterized query 사용 확인

## 라우터 결정

라우터 미사용 — `routing=all` 로 전체 reviewer 강제 실행.

- **실행(강제 포함)**: security, requirement, scope, side_effect, maintainability, testing (6명)
- **제외**: 없음
- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (전체)