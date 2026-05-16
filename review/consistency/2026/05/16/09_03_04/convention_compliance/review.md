# Convention Compliance Review

**대상 문서**: `spec/4-nodes/4-integration/4-cafe24.md`
**검토 모드**: 구현 착수 전 (--impl-prep)
**작업 범위**: `Cafe24Config` UI 버그 수정 (fields "추가" 버튼 동작 안 함)

---

## 발견사항

### 1. [INFO] §9.4 Rationale 의 9.7·9.8 절 순서 역전

- target 위치: 문서 §9 Rationale 의 절 순서 (라인 404~451)
- 위반 규약: CLAUDE.md 문서 구조 권장 — 본문 끝의 `## Rationale` 순서 정합성
- 상세: `9.7 OAuth scope wire format` 절(라인 441~451)이 `9.8 Private 앱 App URL HMAC 검증` 절(라인 406~438) 뒤에 텍스트상 위치하지만 번호는 9.7 < 9.8 이다. 실제 파일에서는 9.8 절 내용 본문(라인 406~438) 이 먼저 나오고, 그 뒤에 9.7 절 텍스트(라인 441~451) 가 이어진다. 즉, 절 번호와 파일 내 순서가 불일치한다.
- 제안: 9.7 과 9.8 절을 파일 내 순서와 번호가 일치하도록 재배열하거나, CHANGELOG(§10) 직전 순서로 정리한다.

### 2. [INFO] Principle 11 Case 번호 불연속 (5.1 / 5.3 / 5.8)

- target 위치: §5 출력 구조 (Case 번호: 5.1, 5.3, 5.8)
- 위반 규약: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)"
- 상세: Principle 11 의 포맷 규칙은 `### Case: <케이스 이름>` 형식을 요구한다. 본 문서는 Case 를 `5.1`, `5.3`, `5.8` 로 번호 붙여 관리하는데, 5.2 / 5.4~5.7 이 없어 독자가 누락을 의심하게 만든다. 실제 누락은 아니고 의도적 skip 이지만 규약이 권장하는 연속 Case 서술 패턴과 거리감이 있다.
- 제안: 연속 번호를 쓰거나 (`5.1`, `5.2`, `5.3`), 또는 번호 없이 `### Case: 2xx 성공`, `### Case: API 에러 또는 Transport 실패`, `### Case: Pre-flight throw` 형식으로 서술한다.

---

## 이번 작업과의 직접 관련성 검토

이번 구현 작업(Cafe24Config fields "추가" 버튼 버그 수정)은 다음 범위에만 영향을 미친다:

- `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` — `Cafe24Config` 컴포넌트에 React state 추가
- 신규 unit test 1건

아래 항목들이 **변경 없음**을 확인하였다:

| 항목 | 확인 결과 |
|------|-----------|
| `spec/4-nodes/4-integration/4-cafe24.md` §1 `config.fields` 타입 (`Record<string,unknown>`) | 보존 — 백엔드 계약 변경 없음 |
| `spec/conventions/cafe24-api-metadata.md` §2 `fields` 형식 | 보존 — 메타데이터 테이블 변경 없음 |
| `spec/conventions/node-output.md` Principle 0~11 출력 포맷 | 보존 — 출력 구조 변경 없음 |
| 옛 `prd/` / `memory/` 경로 답습 여부 | 없음 |

---

## Target 문서 전체 규약 준수 요약

`spec/4-nodes/4-integration/4-cafe24.md` 는 정식 규약과 전반적으로 잘 정합한다:

- **명명 규약**: 파일명 `4-cafe24.md` — 숫자 prefix + 평문명 패턴 준수. Integration 영역의 `0-common.md` 참조 구조도 정상.
- **문서 구조**: Overview(§ 없는 서두) / 본문(§1~§8) / Rationale(§9) / CHANGELOG(§10) 의 3섹션 + CHANGELOG 구성으로 CLAUDE.md 권장 구조 준수.
- **출력 포맷 규약**: Principle 0(5필드), Principle 3.2(`output.error` envelope), Principle 7(`config` echo), Principle 8.2(`output.response` HTTP 관용 네이밍), Principle 11(JSON 예시 + 표) 모두 명시적으로 준수하고 있음.
- **API 문서 규약**: Swagger/DTO 패턴 직접 정의 없으나 Source of Truth 를 `backend/src/nodes/integration/cafe24/cafe24.schema.ts` 로 명시해 DTO 명명 책임을 코드로 위임함.
- **금지 항목**: 옛 `prd/`, `memory/`, `user_memo/` 경로 참조 없음. `spec/conventions/` 의 카페24 메타데이터 컨벤션을 올바르게 참조.
- **이번 작업 직접 영향**: 발견된 2건은 모두 INFO 등급으로, 이번 구현 작업(프론트엔드 UI 버그 수정)의 착수를 차단할 규약 위반 없음.

---

## 위험도

NONE
