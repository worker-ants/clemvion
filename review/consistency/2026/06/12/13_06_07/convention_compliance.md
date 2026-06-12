# 정식 규약 준수 검토 결과

**대상**: `spec/4-nodes/5-data/` (3개 파일: `0-common.md`, `1-transform.md`, `2-code.md`)
**검토 모드**: `--impl-prep` (구현 착수 전)
**검토일**: 2026-06-12

---

## 발견사항

### [INFO] `0-common.md` — Rationale 섹션 부재
- **target 위치**: `/spec/4-nodes/5-data/0-common.md` 전체
- **위반 규약**: CLAUDE.md "문서 구조 규약" — Overview / 본문 / Rationale 3섹션 권장
- **상세**: `0-common.md` 는 공통 규약 문서로 본문 섹션은 충분히 갖췄으나 `## Rationale` 섹션이 없다. `1-transform.md` 도 마찬가지다. `2-code.md` 만 Rationale 섹션을 갖고 있다.
- **제안**: 비어있어도 되는 Rationale 를 추가하거나, "본 문서는 분배 문서로 설계 근거가 없다" 고 명시. 단 이는 권장(recommended) 수준이며 강제 규약이 아니다. `spec-frontmatter.test.ts` 도 Rationale 유무를 강제하지 않으므로 실질 영향 없음.

---

### [INFO] `0-common.md` `§4` — `meta.error`/`meta.errorCode`/`exitReason` 폐기 언급에서 "Phase 1 (D)" 표현
- **target 위치**: `spec/4-nodes/5-data/0-common.md` §4 `meta` 행
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 Code 행 — `meta.error`/`meta.errorCode` 별칭을 "Phase 1 D 에서 폐기"로 기술
- **상세**: `0-common.md` 에서 "Phase 1 (D) 에서 폐기"라고 기술하지만, `node-output.md` Principle 2 는 단순히 "Phase 1 D 에서 폐기"로 표기. 사소한 표기 차이(괄호 유무)이나 일관성 측면에서 두 문서가 미세하게 다르다. 기능적 차이 없음.
- **제안**: 표기 통일 (`Phase 1 D`). 규약 자체를 바꿀 필요는 없음.

---

### [INFO] `1-transform.md` — Pre-flight throw 케이스 번호 규약 (`§5.8`)
- **target 위치**: `spec/4-nodes/5-data/1-transform.md` §5
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — "Case별로 분리 (성공 / 에러 / 재개 등)"
- **상세**: Transform 은 runtime 에러 케이스가 없어 §5.1(정상) 다음 §5.8(Pre-flight throw)로 번호가 8칸 건너뛴다. 규약에서 특정 번호 체계를 강제하지 않으나, 이 패턴이 다른 노드 문서(§5.3 등)와 달라 일관성이 떨어진다.
- **제안**: INFO 수준. transform 이 runtime 에러 포트를 갖지 않는 구조적 결정(Data 공통 §4.1)을 반영한 의도적 선택이므로 규약 갱신이 적절하다면 Principle 11 에 "runtime 에러 포트 없는 노드는 §5.8 번호를 pre-flight throw 케이스에 재사용한다" 패턴을 명시할 수 있다. 현재로서는 문서 내부 주석으로 충분히 설명되어 있음.

---

### [INFO] `2-code.md` `§1` 설정 표 — 필드명 `language`/`code`/`timeout` 대소문자 표기 비일치
- **target 위치**: `spec/4-nodes/5-data/2-code.md` §1 설정 표
- **위반 규약**: 없음 (명시 규약 없음). 관련 참고: `spec/conventions/swagger.md` DTO 패턴
- **상세**: 표 `필드` 컬럼에서 `language`, `code`, `timeout` 을 backtick 없이 소문자 plain text 로 기술하는 반면, `1-transform.md` §1 설정 표의 `operations` 는 backtick 없이 기술되어 두 문서 간 표기가 동일하다. 그러나 같은 문서(`2-code.md`) §5.1 출력 예시 표와 §5.3 출력 예시 표에서는 동일 필드를 backtick 으로 감싸고 있어 동일 문서 내 일관성이 떨어진다.
- **제안**: INFO 수준. 설정 표의 `필드` 컬럼도 backtick 형식으로 통일 권장 (`\`language\``, `\`code\``, `\`timeout\``).

---

## 요약

`spec/4-nodes/5-data/` 3개 문서는 정식 규약(`spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`)을 전반적으로 충실히 준수하고 있다. Frontmatter 스키마(`id`/`status`/`code:`)가 모두 올바르게 선언됐고, 5필드 invariant(Principle 0), config echo(Principle 7), output.error UPPER_SNAKE_CASE 에러 코드(Principle 3.2), Principle 11 문서화 포맷, 에러 코드 정규화 매핑(`conventions/error-codes.md §4`) 등 핵심 규약을 모두 따른다. 발견된 항목은 모두 INFO 등급(사소한 형식 일관성)이며 구현 착수를 차단할 CRITICAL/WARNING 위반은 없다.

## 위험도

NONE
