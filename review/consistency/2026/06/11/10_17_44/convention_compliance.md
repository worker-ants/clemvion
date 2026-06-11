# 정식 규약 준수 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=origin/main)
검토 대상: `spec/5-system/` 내 변경 파일 5종 (1-auth.md, 3-error-handling.md, 7-llm-client.md, 11-mcp-client.md, 14-external-interaction-api.md)

---

## 발견사항

### [INFO] `3-error-handling.md` — `TOKEN_INVALID` 설명 단축: data-flow 링크 제거
- target 위치: `spec/5-system/3-error-handling.md` §1.2 인증/인가 에러 테이블, `TOKEN_INVALID` 행
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명, 클라이언트 계약)
- 상세: 기존 설명 "변조/형식 오류, refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건 (동일 토큰 동시 회전 경합 — [data-flow §1.4](...))" 에서 data-flow 링크와 세부 케이스가 제거돼 "변조/형식 오류" 만 남았다. `error-codes.md §1` 은 "코드의 정의(spec 본문)가 진실이고 이름은 그 정의를 읽히게 하는 라벨"이라 명시하므로, 설명 열이 실제 발행 조건(refresh 토큰 미존재·회전 경합 포함)을 충분히 서술해야 한다. 현재 설명은 발행 조건의 일부만 반영해 spec 본문으로서 불완전하다.
- 제안: 삭제된 세부 조건("refresh 토큰 미존재/소유자 부재, 또는 refresh 회전 시 조건부 revoke 매칭 0건")과 data-flow 링크를 복원하거나, 해당 내용이 data-flow 문서로 이전됐다면 `TOKEN_INVALID` 설명 열에 "자세한 발행 조건은 [data-flow §1.4]" 형태의 참조를 남긴다.

### [INFO] `1-auth.md` §2.1 — production fail-closed 노트 위치: 본문 테이블 아래 blockquote
- target 위치: `spec/5-system/1-auth.md` §2.1 JWT 토큰 구조, 테이블 직후 추가된 blockquote
- 위반 규약: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- 상세: 신규 추가된 `JWT_SECRET` production fail-closed 설명은 구현 결정의 배경·근거에 해당한다. CLAUDE.md 정보 저장 위치 원칙은 "결정의 배경·근거"를 해당 spec 끝 `## Rationale` 섹션에 두도록 권장한다. 현재 내용은 §2.1 본문 테이블 직후 blockquote 로 박혀 있어 구조 규약과 거리가 있다. 단, 인접성(§2.1 이 다루는 토큰 구조와 직결)·간결성(2~3줄 요약)을 고려하면 본문 주석으로 유지하는 선택도 합리적이다.
- 제안: 현 본문 주석을 유지하되, 상세 근거(왜 부팅 차단인가)를 `## Rationale` 에 별도 항목(`2.1.A`)으로 두어 3-섹션 구조를 보완하는 것이 권장된다. 긴급 위반은 아니며 선택적 개선.

### [INFO] `7-llm-client.md` §7.1 — `assertProductionConfig` 관할 목록을 spec 본문에서 열거
- target 위치: `spec/5-system/7-llm-client.md` §7.1 프로덕션 차단 bullet
- 위반 규약: CLAUDE.md "단일 진실 원칙" (SoT 중복 위험), `spec/conventions/error-codes.md §1` (유사 원칙)
- 상세: 변경 후 문장이 `assertProductionConfig`의 관할 항목("JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·OAUTH_STUB·LLM_STUB")을 `7-llm-client.md` 본문에 열거한다. 같은 목록이 `1-auth.md`(C-1), `11-mcp-client.md`(M-7)에도 각각 기술되어 있어 목록이 변경될 때 세 파일을 동시에 갱신해야 한다. `spec/5-system/` 내 어느 한 파일이 이 목록의 단일 진실이 되고 나머지가 참조하는 구조가 더 안전하다.
- 제안: 목록의 정식 SoT를 한 파일(예: 새 `spec/5-system/production-guards.md` 또는 `3-error-handling.md` 내 별도 섹션)로 응집하고, 나머지 세 파일은 해당 섹션 링크만 유지. 단, 현 변경 범위 내에서는 minor한 문서 중복이므로 CRITICAL이 아닌 INFO 수준.

---

## 요약

이번 변경(spec/5-system/ 5개 파일)은 production fail-closed 가드 응집(`assertProductionConfig`) 내용을 spec에 반영한 것으로, 정식 규약의 핵심 invariant를 직접 위반하는 항목은 없다. `error-codes.md §1` 관점에서 `TOKEN_INVALID` 설명이 발행 조건 일부를 누락해 spec 본문의 완전성이 저하된 점, `1-auth.md` 의 구현 결정 근거가 Rationale 섹션 대신 본문 blockquote에 위치한 점, `assertProductionConfig` 관할 목록이 세 파일에 분산돼 SoT 중복 위험이 있는 점이 INFO 수준 개선 사항으로 확인됐다. 채택 시 다른 시스템의 invariant를 깨는 항목은 없다.

## 위험도

LOW

STATUS: OK
