# Rationale 연속성 검토

대상 diff: `origin/main...HEAD` — URI-userinfo secret 마스킹을 MCP 전용 패턴에서 공용
`SECRET_LEAK_PATTERNS`(`shared/utils/sanitize-error-message.ts`)로 통합(scheme-preserving),
MCP 전용 중복 패턴 제거, `spec/5-system/11-mcp-client.md` §8.3 동기화.

관련 커밋: `2aa4c8093`(#886, whole-mask URI userinfo 최초 추가) → `90ab8f390`(공용 SoT 통합,
scheme 보존으로 변경 + MCP 중복 제거) → `b48d4c10b`(ai-review 반영, JSDoc/테스트 보강).

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 검토 근거

1. **기각된 대안의 재도입 여부** — 확인 결과 없음. `spec/5-system/11-mcp-client.md` §8.3
   Rationale 의 기존(diff 이전부터 존재하던) 문장 "별도 redaction 로직을 새로 두지 않은
   이유: secret 패턴은 보안 민감 SoT 라 파편화 시 '공용에 새 패턴 추가 → MCP 는 누락' 하는
   유지보수 위험이 크기 때문이다" 는 애초에 **중복을 지양하라는 원칙**이었다. 이번 diff 는
   그 원칙이 예외로 남겨뒀던 URL-userinfo 항목까지 마저 흡수한 것으로, 과거에 명시적으로
   "URL-userinfo 는 MCP 전용으로 반드시 분리 유지" 라고 기각한 대안을 뒤집는 사례가 아니다
   (그런 명시적 rejection 텍스트를 spec/전체 git 이력에서 찾지 못함).

2. **합의된 원칙 위반 여부** — 오히려 반대다. 이번 변경은 §8.3 에 이미 박혀있던
   "secret 패턴 SoT 파편화 방지" 원칙을 뒤늦게 완전히 적용한 것 — CLAUDE.md/MEMORY 의
   `Shared secret redaction SoT` 항목("에러 메시지 토큰 마스킹은
   `shared/utils/sanitize-error-message.ts` `SECRET_LEAK_PATTERNS` 재사용, 새로 구현 금지")과도
   완전히 정합한다.

3. **결정의 무근거 번복 여부** — 공용 패턴의 마스킹 방식이 "scheme 포함 전체 마스킹"(구
   `/\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s:@]+@/gi` → `***`)에서
   "scheme 보존 마스킹"(`(?<=:\/\/)[^/\s:@]+:[^/\s@]+(?=@)` → `scheme://***@host`)으로
   행동이 바뀌었다 — 이것은 실질적 동작 변경이지만, **새 Rationale 이 함께 작성**됐다:
   - 코드 JSDoc(`sanitize-error-message.ts` 2026-07-10 주석): "MCP 전용으로 있던 동형 패턴을
     이 SoT 로 흡수(파편화 제거)"
   - 커밋 메시지(`90ab8f390`): "PR #886 후속(consistency cross_spec WARNING)" — 직전
     consistency-check 가 지적한 파편화를 해소하는 명시적 후속 조치임을 밝힘
   - spec 갱신: `spec/5-system/11-mcp-client.md` §8.3 에 "2026-07-10 갱신" 블록으로 변경
     사유·기존 상태·신규 상태를 명시
   따라서 관점 3("결정의 무근거 번복") 기준을 충족하지 않는다 — 번복이되 근거가 함께 기록됐다.

4. **암묵적 가정 충돌 여부** — 인접 sink 인 `codebase/backend/src/modules/execution-engine/sanitize-error-message.ts`
   의 `CONNECTION_STRING_PATTERN`(DB 스킴 한정 전체 strip → `[REDACTED_URI]`)과는 목적·스킴
   범위가 달라 충돌하지 않으며 diff 대상도 아니다. `spec/conventions/node-output.md` §"절대
   echo 금지"의 `https://user:pass@host → https://host`(HTTP 노드 config echo 전용, userinfo
   완전 제거)도 별개 sink(에러 메시지 redaction이 아니라 config echo)로, 이번 diff 가 손대지
   않았고 상충하지 않는다. 두 sink 가 서로 다른 마스킹 표현을 쓰는 것은 이미 spec 상 별개
   문서(§8.3 vs node-output.md)로 분리된 기존 상태이며 이번 변경으로 새로 생긴 모순이 아니다.

5. **코드-스펙 동기화** — `spec/5-system/11-mcp-client.md` §8.3 표(`error.message` 필드 설명)와
   Rationale 문단이 모두 diff 에 포함되어 "공용이 URL-userinfo(scheme 보존)·bare JWT 커버,
   MCP 전용은 bare `token=` 만" 으로 코드와 1:1 일치하게 갱신됐다 — half-stale 서술이 남지
   않았다.

6. **선행 코드 리뷰와의 정합** — `review/code/2026/07/10/10_54_39/` 및 `11_04_04/` 의
   security/testing 리뷰가 이미 이 diff(scheme 신규 노출 tradeoff 포함)를 심사해 Critical/
   Warning 0, 전부 INFO(처분 완료)로 결론지었다. Rationale 연속성 관점에서 별도로 재확인한
   결과도 이와 배치되지 않는다.

## 요약

이번 diff 는 `spec/5-system/11-mcp-client.md` §8.3 Rationale 에 이미 명문화된 "secret redaction
SoT 파편화 방지" 원칙을 뒤늦게 URL-userinfo 케이스에도 적용한 통합(consolidation)이며, 직전
consistency-check(cross_spec WARNING, PR #886 후속)가 지적한 파편화를 해소하는 정당한 후속
조치다. 마스킹 표현이 "scheme 포함 전체 마스킹"에서 "scheme 보존 마스킹"으로 바뀌는 실질적 동작
변경이 있으나, 코드 JSDoc·커밋 메시지·spec §8.3 갱신문 세 곳 모두에 변경 사유가 명시적으로
기록되어 "무근거 번복"에 해당하지 않는다. 과거 Rationale 에서 명시적으로 기각된 대안을 재도입한
정황도, 합의된 설계 원칙(SoT 단일화)을 위반하는 정황도, 인접 sink(`CONNECTION_STRING_PATTERN`·
`node-output.md` config echo)의 invariant 를 침범하는 정황도 발견되지 않았다.

## 위험도

NONE
