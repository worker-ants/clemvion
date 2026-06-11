# 정식 규약 준수 검토 결과

**검토 범위**: `spec/5-system/` (diff vs origin/main — 구현 완료 후 검토, refactor 04 C-1·M-4·M-7)
**검토 일시**: 2026-06-11
**변경 파일**: `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/5-system/7-llm-client.md`

---

## 발견사항

- **[INFO]** Rationale 섹션 제목에 구현 추적 ID 포함
  - target 위치: `spec/5-system/1-auth.md` — 신규 Rationale 항목 제목 `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)`
  - 위반 규약: `spec/conventions/error-codes.md §1` "구현·역사를 이름에 박지 않음" 원칙 — 에러 코드 기준이나 spec 문서 제목의 안정적 명명 논리에 동일하게 적용. 또한 `CLAUDE.md` "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" — spec 이 아닌 plan/코드베이스 식별자를 spec SoT 제목에 박는 것은 이 원칙의 정신에 어긋남
  - 상세: 기존 Rationale 항목들(`### 1.4.A`, `### 1.5.B`, `### 2.3.A` 등)은 번호 또는 의미 기반 제목을 쓰고 plan task ID 를 포함하지 않는다. 신규 항목만 `(refactor 04 C-1·M-4·M-7)` 을 괄호 없이 제목 줄에 직접 박아 패턴 불일치가 발생한다.
  - 제안: `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL` 처럼 보호 대상 변수로만 제목 구성. task ID 는 본문 첫 줄 parenthetical 또는 삭제.

- **[INFO]** `spec/5-system/1-auth.md` §2.1 blockquote 에 설계 근거 요약 삽입
  - target 위치: `spec/5-system/1-auth.md` §2.1 JWT 토큰 구조 표 바로 다음 추가된 `> **JWT_SECRET production fail-closed (refactor 04 C-1)**:` 블록쿼트
  - 위반 규약: `CLAUDE.md` "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"
  - 상세: blockquote 안에 `설계 근거·응집 이유는 §Rationale "Production fail-closed 가드" 참조` 라는 지시자가 있어 Rationale 분리 의도가 보인다. 그러나 blockquote 자체가 근거("응집 이유")를 짧게 요약하고 있어 본문과 Rationale 의 경계가 흐릿해진다. "enforcement 위치(파일명, 함수명)는 본문", "왜 단일 블록인가는 Rationale" 원칙을 적용하면 분리가 더 명확해진다.
  - 제안: blockquote 를 구현 사실 1~2문장으로 축약 (`production 에서 JWT_SECRET 미설정/약설정·MCP_ALLOW_INSECURE_URL=true 시 부팅 거부 — 상세: §Rationale "Production fail-closed 가드"`). 현재 blockquote 내 "응집 이유" 서술은 Rationale 절로 이동.

- **[INFO]** `spec/5-system/7-llm-client.md` 변경 줄 길이 과도
  - target 위치: `spec/5-system/7-llm-client.md` `**프로덕션 차단**:` 항목 변경 줄
  - 위반 규약: 명시적 길이 규약 없음. `spec/conventions/swagger.md §3` "description 50~150자" 스타일 권장과 충돌하는 수준은 아니나 단일 문장이 200자 이상으로 길어짐
  - 상세: 기존 1문장에 `assertProductionConfig` 참조와 대상 env 나열 parenthetical 이 중첩 추가돼 읽기가 어렵다. 내용 자체는 정확.
  - 제안: 두 문장으로 나누거나, "가드 함수 위치 + 대상 env" 를 불릿 목록으로 분리. 정보 손실 없이 가독성 향상 가능.

- **[INFO]** `spec/5-system/14-external-interaction-api.md` 기존 긴 parenthetical 에 내용 추가
  - target 위치: `spec/5-system/14-external-interaction-api.md` §648 `iext_*` 서술 항목
  - 위반 규약: 명시적 규약 없음 (INFO 수준)
  - 상세: 기존에도 매우 길었던 parenthetical 에 `JWT_SECRET`/`ENCRYPTION_KEY` 가드 정보가 추가됨. 변경 자체의 내용은 정확하고, 기존 문서 스타일(복잡한 인라인 설명)과 일관성을 유지한다.
  - 제안: 향후 문서 정비 시 해당 항목을 별도 sub-section 또는 bulleted 목록으로 분리 검토 (이번 diff 범위 밖).

---

## 금지 항목 점검 (규약 직접 위반 여부)

| 점검 항목 | 결과 |
|-----------|------|
| 신규 에러 코드가 `UPPER_SNAKE_CASE` 미준수 (`error-codes.md §1`) | 이번 diff 에 신규 에러 코드 없음 — 해당 없음 |
| API 응답 봉투 형식 위반 (`node-output.md §3.2`) | API 응답 형식 변경 없음 — 해당 없음 |
| Swagger DTO 명명 패턴 위반 (`swagger.md §5-1`) | DTO 변경 없음 — 해당 없음 |
| `_product-overview.md` 파일 누락 (`CLAUDE.md`) | `spec/5-system/_product-overview.md` 존재 — 준수 |
| spec 문서 frontmatter (`id`/`status`) 누락 (`spec-impl-evidence.md §1`) | 변경된 파일 모두 frontmatter 유지 — 준수 |
| Rationale 섹션이 `## Rationale` 밖에 위치 | 모두 `## Rationale` 안 `###` 항목으로 배치 — 준수 |
| `lower_snake_case` 에러 코드 신규 도입 (non-historical) | 신규 에러 코드 없음 — 해당 없음 |

---

## 요약

이번 diff 는 production fail-closed 가드(`assertProductionConfig` — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL) 구현에 맞춰 `spec/5-system/` 4개 파일의 명세를 동기화한 변경이다. 에러 코드·API 응답 형식·DTO 명명 등 정식 규약이 직접 적용되는 표면에 변화가 없으므로 CRITICAL·WARNING 발견사항은 없다. 발견된 사항은 모두 INFO 수준으로, Rationale 제목에 구현 task ID 가 박힌 점(기존 패턴과 불일치), 일부 긴 blockquote/parenthetical 의 가독성 문제에 그친다. 채택이 다른 시스템의 invariant 를 깨거나 클라이언트 계약에 영향을 주는 요소는 없다.

## 위험도

NONE
