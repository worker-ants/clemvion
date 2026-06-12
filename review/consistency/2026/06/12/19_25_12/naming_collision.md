# 신규 식별자 충돌 검토

검토 모드: --impl-prep (구현 착수 전), scope=spec/5-system/

## Target 변경 요약

이번 커밋(HEAD)이 `spec/5-system/` 에 도입한 신규 식별자:

| 파일 | 신규 식별자 |
|------|------------|
| `spec/5-system/15-chat-channel.md` | 요구사항 ID `R-CC-18`, 이를 설명하는 텍스트 내 심볼 `WORKSPACE_ID_REQUIRED`(기존 canonical 재사용), `@WorkspaceId()` 데코레이터 참조 |
| `spec/conventions/error-codes.md §5` | 은퇴 코드 등록: `WORKSPACE_REQUIRED` → `WORKSPACE_ID_REQUIRED` 매핑 |
| `spec/5-system/1-auth.md §1.1` | `POST /api/auth/resend-verification` 설명에 "발급되는 인증 토큰은 24h 유효 (§5 동일)" 문구 추가 |
| `spec/5-system/11-mcp-client.md §3.1` | Internal Bridge 표에 `makeshop` / `MakeshopMcpToolProvider` 행 추가 |

---

## 발견사항

### [INFO] R-CC-18 — 번호 연속성 확인 완료

- target 신규 식별자: `R-CC-18`
- 기존 사용처: `spec/5-system/15-chat-channel.md` 의 기존 ID 시퀀스: R-CC-10, 11, 12, 13, 15, 16, 17
- 상세: R-CC-14 가 부재하고 R-CC-15~17 이 앞선 커밋에서 이미 할당되어 있다. R-CC-18 은 기존에 할당된 번호가 아니므로 충돌 없음. R-CC-14 결번은 이전 커밋 선례이며 본 변경의 문제가 아님.
- 제안: 해당 없음 (충돌 없음).

### [INFO] WORKSPACE_ID_REQUIRED — 기존 canonical 코드를 재인용

- target 신규 식별자: R-CC-18 본문 및 §5.4 에러 표에서 `WORKSPACE_ID_REQUIRED` 언급
- 기존 사용처: `spec/5-system/3-error-handling.md:47` 에 canonical 정의 존재; `codebase/backend/src/common/decorators/workspace.decorator.ts:18` 에서 발행
- 상세: `WORKSPACE_ID_REQUIRED` 는 신규 도입이 아니라 기존 canonical 코드를 재참조하는 것이다. 충돌 없음.
- 제안: 해당 없음.

### [INFO] WORKSPACE_REQUIRED — 은퇴 코드 등록

- target 신규 식별자: `error-codes.md §5` 에 `WORKSPACE_REQUIRED` 은퇴 이력 등록
- 기존 사용처: 코드베이스(`codebase/`) 전체에서 `WORKSPACE_REQUIRED` 문자열이 0건 — 이미 삭제 완료 (`grep` 확인). `spec/conventions/error-codes.md §5` 의 다른 은퇴 항목들과 형식 일치.
- 상세: 이미 코드베이스에서 완전히 제거된 코드의 이력 등록으로, 신규 active 코드가 아님. 충돌 없음.
- 제안: 해당 없음.

### [INFO] 1-auth.md §1.1 — 24h 유효기간 명시 추가

- target 신규 식별자: "발급되는 인증 토큰은 24h 유효 (§5 동일)" 문구
- 기존 사용처: `spec/5-system/1-auth.md §5` 엔드포인트 표에 이미 "24h 유효" 명시 존재; `spec/data-flow/2-auth.md:228` 에도 "24h 유효 인증 토큰" 기술 존재
- 상세: 기존 §5 표의 "24h 유효"와 cross-reference 일치. 새로운 값이나 이름을 도입하는 것이 아니라 기존 정책을 §1.1 표에도 명시하는 것으로, 정보 중복이지 충돌이 아님.
- 제안: 해당 없음.

### [INFO] 11-mcp-client.md §3.1 — makeshop / MakeshopMcpToolProvider 행 추가

- target 신규 식별자: Internal Bridge 표의 `makeshop` 행 + `MakeshopMcpToolProvider` 명칭
- 기존 사용처: `spec/5-system/11-mcp-client.md §2.3` 본문에 `cafe24`, `makeshop` 이 이미 병기되어 있었으며, `spec/4-nodes/4-integration/5-makeshop.md §8`, `spec/0-overview.md`, `spec/5-system/11-mcp-client.md §10` 등 여러 파일에서 `MakeshopMcpToolProvider` 가 이미 사용 중.
- 상세: 이번 변경은 §2.3 본문에 이미 언급된 `makeshop` 항목을 §3.1 표에 공식 행으로 추가하는 것이다. 이름 자체는 신규 도입이 아니며 기존 사용처와 동일 의미로 쓰임. 충돌 없음.
- 제안: 해당 없음.

---

## 요약

이번 커밋이 `spec/5-system/` 에 도입한 식별자는 총 4종이며, 모두 충돌이 없다. `R-CC-18` 은 기존 할당 번호와 중복되지 않는다. `WORKSPACE_ID_REQUIRED` 는 기존 canonical 코드의 재참조다. `WORKSPACE_REQUIRED` 은퇴 등록은 코드베이스에서 이미 제거된 코드의 이력 기록으로 active 코드 영역에 영향이 없다. `makeshop`/`MakeshopMcpToolProvider` 행 추가는 `11-mcp-client.md §2.3` 에 이미 기술된 항목을 표에 명시하는 것으로 신규 명칭이 아니다. 전체 검토 범위에서 명명 충돌은 발견되지 않았다.

---

## 위험도

NONE

STATUS: OK
