# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/web-chat-snippet-queue-stub.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-25

---

## 발견사항

### INFO — 비표준 frontmatter 필드 `title` 사용
- **target 위치**: `plan/in-progress/web-chat-snippet-queue-stub.md` frontmatter 1번째 필드 (`title:`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 필드는 `worktree` / `started` / `owner` 3개. `priority`/`status`/`title` 등 추가 필드는 "허용"으로 명시됨.
- **상세**: `title:` 은 규약에서 금지하지 않는 허용 추가 필드이므로 위반은 아니다. 다만 plan-lifecycle §4 스키마 예시에 `title` 이 열거되지 않으며, 문서 H1 (`# 배경`) 과 별도로 title 을 frontmatter 에 두면 H1 이 실질 제목 역할을 수행하지 않게 돼 일관성 편차 발생. 규약 예시 스키마와 완전히 정합하려면 제거 후 H1 을 명확한 제목으로 대체하는 것이 자연스럽다.
- **제안**: `title:` 필드를 제거하고 `# 배경` 을 `# 웹채팅 설치 스니펫 — command-queue 스텁 누락으로 인한 ClemvionChat ReferenceError 수정` 으로 교체하거나, 현행 유지(허용 범위 내).

### INFO — `related_spec:` 비표준 필드
- **target 위치**: frontmatter `related_spec:` 키
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 표준 스키마에 없는 필드. `priority`/`status`/`title` 과 동일하게 추가 허용 필드이므로 위반은 아니나, 규약 스키마 예시에 열거된 필드가 아님.
- **상세**: `related_spec:` 의 의미는 spec frontmatter `pending_plans:` 와 역방향 관계로, 인식상 유용하지만 규약에서 명시적으로 정의되거나 가드로 검증되는 필드가 아니다. 가드(`plan-frontmatter.test.ts`)는 이 필드를 무시한다.
- **제안**: 현행 유지 가능(선택 필드). 규약에 공식 등재하려면 plan-lifecycle §4 스키마 갱신이 적절.

### INFO — 문서 구조: H1 이 "배경" 단어로 시작
- **target 위치**: `plan/in-progress/web-chat-snippet-queue-stub.md` 10번째 줄 (`# 배경`)
- **위반 규약**: CLAUDE.md — spec 문서는 Overview / 본문 / Rationale 3섹션 권장. plan 문서에 대한 구조 규약은 plan-lifecycle §4 에서 frontmatter 만 명시하며 본문 섹션 구조는 강제하지 않음.
- **상세**: plan 문서 본문 구조는 규약 강제 대상이 아니므로 위반 아님. INFO 수준 형식 제안만.
- **제안**: 현행 유지 가능.

---

## 핵심 필수 필드 준수 확인 (PASS)

plan-lifecycle §4 필수 3필드 점검:

| 필드 | 값 | 판정 |
|---|---|---|
| `worktree` | `web-chat-snippet-queue-stub-629472` | PASS (실제 worktree 디렉토리명과 일치) |
| `started` | `2026-06-25` | PASS (ISO 날짜 형식) |
| `owner` | `developer` | PASS |

`(unstarted)` sentinel 규칙: 실제 worktree 가 배정됐으므로 해당 없음 — PASS.

Gate C (`spec_impact`) 필드: `started: 2026-06-25` 로 cutoff `2026-06-04` 이후이므로 완료(`complete/`) 이동 시 `spec_impact` 선언 의무 적용 대상. 현재는 in-progress 이므로 미기재는 정상 (완료 시점에만 강제).

명명 규약 점검: 파일명 `web-chat-snippet-queue-stub.md` — kebab-case, `plan/in-progress/` 최상위 위치. `0-`/`_` prefix 없음. 규약 준수.

---

## 요약

`plan/in-progress/web-chat-snippet-queue-stub.md` 는 plan-lifecycle §4 의 필수 3개 frontmatter 필드(`worktree`·`started`·`owner`)를 모두 올바르게 기재하고 있으며, 파일 위치·명명 규약도 준수한다. 비표준 필드 `title:`·`related_spec:` 은 규약에서 명시 허용된 추가 필드 범위 내이며 가드에 저촉되지 않는다. CRITICAL·WARNING 위반은 없고, 사소한 형식 일관성 제안 3건(INFO)만 식별됐다. 구현 착수 차단 사유 없음.

## 위험도

NONE
