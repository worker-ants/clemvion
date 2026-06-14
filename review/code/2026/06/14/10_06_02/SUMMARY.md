# Code Review 통합 SUMMARY — config-gaps ai-review 후속 fix 재리뷰 (delta)

> 대상: 이전 RESOLUTION 의 fix 커밋(`auth-config-form.ts` 신설 + 검증 wiring) 재리뷰.

## 전체 위험도
**MEDIUM** — 백엔드 DTO 서버 측 검증 여부·HMAC 헤더명 프런트 검증 누락·IPv6 정규식 부실이 핵심.

- **Critical**: 0 · **Warning**: 6 · **Info**: 16

## Critical
없음.

## 경고 (WARNING) — 처리

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | Security | IPv6 검증 정규식 부실(`:::` 등 통과) | **수정** — 연속 콜론·그룹 수 제한 강화 + 경계 테스트 |
| 2 | Security | 클라이언트 전용 검증 — 백엔드 DTO IP/헤더 검증 미확인 | **조사 후 처리** — 백엔드 IP-match 로직 확인(fail-closed 여부) + RESOLUTION 결론 |
| 3 | Requirement | `hmac` 서명 헤더명 RFC 7230 검증 누락(api_key 만 검증) | **수정** — hmac 분기에도 `isValidHeaderName` 적용 |
| 4 | Maintainability | 폼 상태 객체 `handleCreate`/`mutationFn` 2곳 수동 조립 중복 | **수정** — `collectFormState()` 헬퍼로 단일화 |
| 5 | Maintainability | 파라미터 이름 단일 문자 `s` | **수정** — `state` 로 변경 |
| 6 | Maintainability | God Component 심화 | **범위 외(선재)** — 별도 리팩토링. RESOLUTION 기록 |

## Info — 처리 요약
- INFO 8/9/13 (IPv6 `:::`·공백 헤더 경로·`\r\n` 경계 테스트): **테스트 추가** + `split(/\r?\n/)` 적용.
- INFO 4/5/12 (테스트 cleanup/mock clear): **beforeEach mock clear·cleanup 정리**.
- INFO 6 (`ko` dict 타입): **`satisfies` 추가 검토** — 저비용 시 적용.
- INFO 2 (generatedKey 타이머), INFO 10 (hmac/basic 통합 테스트), INFO 14/15 (JSDoc), INFO 7 (config 판별 유니온): 선재/경미 — 후속.
- INFO 16 (편집 폼): plan 추적 완비(조치 불필요).

## 에이전트별 위험도
security MEDIUM · requirement LOW · scope NONE · side_effect LOW · maintainability LOW · testing LOW · documentation LOW · api_contract NONE

## 결론
Critical 0. 신규 검증 로직의 actionable 개선(W1·W3·W4·W5 + 보안 경계 조사 W2)을 본 턴에서 처리. God Component(W6)는 선재 별도 범위. **BLOCK 없음.**
