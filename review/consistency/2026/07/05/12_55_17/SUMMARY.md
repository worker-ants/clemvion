# consistency-check --impl-prep SUMMARY — SSRF 에러 메시지 일반화 (HTTP)

**BLOCK: NO** — CRITICAL(실제 위반) 없음. rationale_continuity·plan_coherence 가 visibility 목적으로 CRITICAL 표기했으나 둘 다 "**이미 합의된 follow-up 의 구현 대기**(DB_HOST_BLOCKED Rationale 이 HTTP/Email 확장을 명시)"로 특성화 — 위반 아님. 나머지 WARNING 은 전부 본 작업이 해소할 갭 또는 구현 설계 정교화.

- 모드: `--impl-prep spec/4-nodes/4-integration/` · checker 5/5 (직접 Agent fan-out)

## checker 종합

| Checker | 위험도 | 핵심 |
|---------|--------|------|
| cross_spec | MEDIUM(WARN) | (1) HTTP spec 에 `HTTP_BLOCKED` 메시지 예시/필드표 부재 → 구현 후 DB 수준 문서화 필요(§5.3·Rationale·2-nav). (2) **DB 선례가 "원본 상세는 서버 로그에 남는다" 약속을 실제론 안 지킴**(catch 에서 원본 폐기) → HTTP 는 미러 말고 `logger.warn` 로 원본 보존 |
| rationale_continuity | MEDIUM | DB Rationale(2026-06-12)이 host/IP 미노출 원칙의 HTTP/Email 확장을 follow-up 으로 이미 합의 → 본 작업이 그 구현. 위반 아님 |
| convention_compliance | WARN | (1) HTTP 만 raw host/IP 노출(DB/Email 은 일반화). (2) **redirect-hop SSRF 가 별도 catch 없이 바깥 catch 로 떨어져 HTTP_BLOCKED 아닌 오분류** — spec §4.2/§6 "redirect SSRF=HTTP_BLOCKED" 와 drift |
| plan_coherence | MEDIUM(WARN) | 유일 미완 코드 항목과 정확히 일치. 착수 전 plan 읽기(완료). spec 3-node 비대칭 확인 |
| naming_collision | NONE | 일반화 문구는 기존 `"... blocked by SSRF policy."` 패턴(DB/Email + frontend test fallback 기대)과 정렬. `SSRF_BLOCKED` raw prefix ≠ `ErrorCode.*_BLOCKED` enum |

## 확정 작업 스코프

1. **코드 `http-request.handler.ts`**:
   - Preflight SSRF(line 364-368): `output.error.message` 일반화(host/IP 미노출, `"... blocked by SSRF policy."` 패턴). 원본 err.message 는 `logger.warn` 서버 로그 보존(DB 가 놓친 부분).
   - Redirect SSRF(line 407 try 내 hop 검증): SSRF 예외를 `HTTP_BLOCKED` + 일반화로 라우팅(현재 바깥 catch 오분류 수정 — spec §4.2/§6 만족).
2. **테스트 `http-request.handler.spec.ts`**: 기존 `/SSRF_BLOCKED/` message 단언 4곳 → 일반화 문구 + host/IP(예: 127.0.0.1·169.254.169.254·localhost) 미노출 단언. redirect SSRF→HTTP_BLOCKED+일반화 케이스 추가. logger 원본 보존 spy.
3. **spec 문서화**(합의된 follow-up 정합): `1-http-request.md` §5.3 HTTP_BLOCKED 예시(일반화)+Rationale 대칭 절(원본 서버 로그 보존 명시), `2-navigation/4-integration.md` HTTP_BLOCKED 행 각주, `2-database-query.md` Rationale follow-up→완료 갱신. spec 연결 → `--impl-done` 의무.
4. **(검토) DB 원본-폐기 갭**: cross_spec 이 "3-node 일관 위해 이번에 정정" 제안 — DB catch 에도 원본 logger 보존 추가할지 구현 중 판단(스코프 관리).

## 판정
BLOCK: NO → TDD 착수.
