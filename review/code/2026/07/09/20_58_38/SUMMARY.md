# Code Review 통합 보고서 (round 7 — styles.ts 주석 델타 + spec 사후 문서 커버)

## 전체 위험도
**LOW** — Critical 0, WARNING 1. 이번 라운드 코드 델타는 styles.ts CSS 구분 주석 1블록(런타임 무영향) +
spec 문서. WARNING 1은 durable thread 노출의 "민감정보 미기록" 불변식이 자동 강제 수단 없이 컨벤션에만
의존한다는 defense-in-depth 지적(security/architecture 공동).

## Critical
없음.

## 경고 (WARNING) 및 처리
| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| 1 | security/architecture | `Execution.conversation_thread` durable 컬럼 소비처가 rehydration→SSE→공개 REST getStatus 로 확장. "노드 핸들러가 turn 텍스트에 민감정보 미기록" 불변식이 lint/test/타입경계 없이 문서 서술에만 의존. public REST vs 내부 필드 DTO 경계 부재 | **defer(문서화, RESOLUTION.md)** — 동일 데이터가 **이미 SSE `waiting_for_input` 으로 공개 중**(cloneThread 스냅샷, 동일 execution-scope 토큰). 본 PR 은 **additive REST 재노출**로 신규 데이터·principal 노출 아님. 불변식은 SSE 경로에 이미 적용된 pre-existing. R17 이 redaction allowlist 를 후속 하드닝 backlog 로 명문. 토큰 단명·execution-scope 완화 존재. 제안된 secret-scan test/public DTO 는 thread 누적 경로 전반의 별도 security 트랙 하드닝(본 additive 변경의 안전성 전제 아님) |

## 참고 (INFO) — 전부 defer(비차단)
- security INFO: 토큰 유출 시 REST 히스토리 재조회 가능 트레이드오프 → 4-security/EIA 명시 권장(backlog).
- architecture: getStatus 가 waiting 시 thread 무조건 동봉(비-웹챗 EIA 소비자 영향) — EIA §5.3 원문은 waiting 한정·optional. frontmatter `code:` 에 interaction.service.ts 추적성(후속).
- requirement: multi-turn 히스토리 복원 reducer 통합 테스트 추가 권고(회귀 방지, non-blocking) — 부품 단위는 커버됨.
- database: getStatus findOne projection 없이 대형 jsonb fetch(pre-existing) — 폴링/대화길이 증가 시 2단계 조회 backend/performance 트랙.
- api_contract: conversationThread 키생략 vs null 관례 혼재(spec 명문)·Swagger sub-shape 미노출(pre-existing)·conversationEnded.reason 열린 문자열(문서화됨).
- side_effect: getStatus 응답 payload 확대(additive, breaking 아님).
- resetSession-during-booting 중복 webhook: spec Planned/backlog 명문.

## 점검 문제없음
security(토큰 스코프·종료시 context null·IDOR 불가), requirement(line-level 정합), scope(범위 이탈 없음),
side_effect(문서-only diff), documentation(cross-ref 정합), database/concurrency(변경 없음), api_contract(additive).

## 결론
Critical 0. WARNING 1 = pre-existing 신뢰모델의 defense-in-depth 하드닝(동일 데이터 SSE 기노출, additive REST
재노출) → RESOLUTION.md 에 defer 근거 기록. 나머지 advisory INFO. 코드 델타는 CSS 주석뿐(런타임 무영향).
