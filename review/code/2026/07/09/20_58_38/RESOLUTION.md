# RESOLUTION — 2026/07/09 20_58_38 code review (round 7)

LOW, Critical 0, WARNING 1. 이번 라운드 코드 델타 = styles.ts CSS 구분 주석 1블록(런타임 무영향, consistency
naming WARNING 반영) + spec 사후 문서. WARNING 1 은 defer(문서화), 나머지 advisory INFO 는 backlog.

## WARNING #1 (security/architecture) — DEFER (문서화)

**발견**: `Execution.conversation_thread` durable 컬럼 소비처가 rehydration→SSE→공개 REST `getStatus` 로 확장됐고,
안전 근거인 "노드 핸들러가 turn 텍스트에 민감정보 미기록" 불변식이 자동 강제 수단(lint/test/타입경계) 없이 문서
서술에만 의존한다. public REST 노출과 내부 필드 사이 DTO/whitelist 타입 경계 부재.

**Defer 근거**:
1. **신규 노출 아님(additive)**: 동일 데이터가 **이미 SSE `waiting_for_input` 이벤트로 공개 중**이다 —
   `conversationThread: cloneThread(context.conversationThread)` (button/form/ai-turn interaction service). 본 PR 의
   getStatus 변경은 **동일 durable 스냅샷을 REST 로 재노출**할 뿐, 새 데이터도, 새 principal(동일 execution-scope
   `iext_*` 토큰)도 노출하지 않는다. 노출 window/ease 만 소폭 증가(SSE 구독 → REST 단발).
2. **불변식은 pre-existing**: "turn 텍스트에 민감정보 미기록" 제약은 SSE 노출 경로에 **이미 적용**돼 있었다(본 PR 이
   약화하지 않음). getStatus JSDoc·EIA R17·conversation-thread §8.4 에 동일 제약을 명문화했다.
3. **redaction 하드닝은 이미 backlog**: EIA §R17 이 "허용 키 런타임 allowlist 필터는 후속 하드닝 항목" 으로 명문.
   제안된 (a) secret-pattern scan test / (b) public-facing DTO 경계는 **thread 누적 경로 전반의 security-track
   하드닝**으로, 본 additive 변경의 안전성 전제가 아니라 신뢰모델 전반의 심화다.
4. **기존 완화**: `iext_*` 토큰은 단명 + execution-scope(종료 시 jti blacklist), 종료 상태에서 `context: null` 로
   미노출. IDOR 성 cross-execution 조회 불가(InteractionGuard 토큰↔executionId 바인딩).

**결론**: 본 PR 이 신규 취약점을 도입하지 않으므로 merge blocking 아님. secret-scan 강제 수단·public DTO 경계는
security/backend 트랙 후속 하드닝으로 이관(R17 backlog 와 함께 추적).

## INFO — 전부 defer(backlog/문서화됨)
- 토큰 유출 시 REST 재조회 트레이드오프 명시(4-security/EIA), frontmatter code: 추적성, multi-turn reducer 통합
  테스트, getStatus 2단계 조회(performance), Swagger sub-shape DTO, conversationEnded.reason 열린 문자열(문서화됨),
  resetSession-during-booting(spec Planned) — 모두 비차단 backlog.

## 검증
- 이번 코드 델타(styles.ts CSS 주석)는 런타임 무영향. web-chat 279·backend external-interaction 200 통과 상태 유지.
- Critical 0. WARNING 1 defer(근거 상기). 리뷰 resolved.
