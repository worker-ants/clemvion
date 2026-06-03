## 발견사항

- **[INFO]** `id: common` 다중 정의 — 기존 패턴, 신규 아님
  - target 신규 식별자: (신규 도입 없음. `spec/4-nodes/5-data/0-common.md` 의 `id: common` 은 target 변경 전부터 존재)
  - 기존 사용처: `spec/4-nodes/1-logic/0-common.md`, `spec/4-nodes/2-flow/0-common.md`, `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/0-common.md`, `spec/4-nodes/7-trigger/0-common.md` — 모두 `id: common`
  - 상세: 6개 파일이 frontmatter `id: common` 을 공유한다. target(이번 변경)이 이 값을 새로 도입한 것이 아니고 기존 관례이므로 충돌은 이번 변경 기인이 아니다. plan 의 "잔여 INFO" 절에서 이미 인지된 사항.
  - 제안: 이번 PR scope 밖이므로 별도 정합 작업에서 카테고리 prefix 를 붙여 구분 (`data-common`, `logic-common` 등). 본 변경과 직접 충돌 없음.

- **[INFO]** `0-common.md §5 색인` 에서 `§5.8` 참조 — `2-code.md` 에 해당 절 없음
  - target 신규 식별자: (target 이 수정한 파일은 아니나 `0-common.md §5` 색인이 `2-code.md` 의 §5.8 을 참조)
  - 기존 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/conventions-code-data-9b32d5/spec/4-nodes/5-data/0-common.md` line 74 — `| [code](./2-code.md#5-출력-구조) | §5.1 (\`success\` port) | §5.3 (\`error\` port) | §5.8 (코드 컴파일 실패) |`
  - 상세: `2-code.md` 에는 §5.1 / §5.3 만 있고 §5.8 은 없다. 컴파일 실패(pre-flight throw)는 `2-code.md` §6 "에러 코드 (Pre-flight throw)" 에 정의되어 있다. 색인 셀의 `§5.8` 이 잘못된 앵커를 가리키므로 cross-reference 는 깨진 링크다. target 변경에서 `2-code.md` §5 구조를 정합화했으나 `0-common.md` 의 이 행은 함께 수정되지 않은 것으로 보인다.
  - 제안: `0-common.md` line 74 의 `§5.8 (코드 컴파일 실패)` 를 `§6 (코드 컴파일 실패)` 로 수정.

- **[INFO]** `EXECUTION_TIMEOUT` vs `CODE_TIMEOUT` — 두 코드가 동일 타임아웃 시나리오에 혼재
  - target 신규 식별자: `CODE_TIMEOUT` (Code 노드 런타임 타임아웃의 정규화 에러 코드, `2-code.md §5.3.2`)
  - 기존 사용처: `spec/5-system/3-error-handling.md` line 55 — `EXECUTION_TIMEOUT | 워크플로우 또는 노드 실행 타임아웃`, `spec/5-system/4-execution-engine.md` line 919 — `EXECUTION_TIMEOUT 에러`, `spec/5-system/14-external-interaction-api.md` — `EXECUTION_TIMEOUT` 을 노드 에러 코드와 같은 문맥에서 혼용
  - 상세: `CODE_TIMEOUT` 은 Code 노드 핸들러가 `output.error.code` 로 반환하는 노드-레벨 에러 코드이고, `EXECUTION_TIMEOUT` 은 엔진-레벨(워크플로우 전체 타임아웃) 에러 코드로 `3-error-handling.md` 가 별도 정의한다. `2-code.md` 의 legacy 매핑 표(§5.3)가 `EXECUTION_TIMEOUT → CODE_TIMEOUT` 으로 명시하므로 양자는 의도적 별개 계층 코드다. `chat-channel-adapter.md` line 381 이 `EXECUTION_TIMEOUT (engine) · CODE_TIMEOUT` 을 나란히 나열해 계층을 정확히 구분하고 있다. 실질 혼동은 없으나 `3-error-handling.md` Code 노드 행(line 72, 213)이 `CODE_TIMEOUT` 만 열거하고 `CODE_TIMEOUT ← EXECUTION_TIMEOUT (legacy)` 연원을 언급하지 않아 독자 혼동 가능성.
  - 제안: `3-error-handling.md` Code 노드 행에 `(구 내부 코드: EXECUTION_TIMEOUT — 핸들러가 CODE_TIMEOUT 으로 정규화)` 정도의 주석 추가. 충돌 자체는 아님.

## 요약

target 변경(`node-output.md` Principle 7/8.2 정합화, `0-common.md §4` Code meta 행 수정, `0-overview.md §2.5` 포트 수 수정, `2-code.md §Rationale` 신설)은 새로운 엔티티 이름·API endpoint·이벤트 이름·환경변수·설정 키를 신규 도입하지 않는다. 변경 내용은 기존 식별자(`Principle 7/8.2` 본문 텍스트 수정, `meta.error/meta.errorCode` 제거, 포트 수 숫자 수정, Rationale 섹션 추가)에 한정되므로 요구사항 ID·엔티티명·API·이벤트·ENV 충돌은 없다. `id: common` 다중 정의는 이번 변경과 무관한 기존 관례이고, `0-common.md §5` 색인의 `§5.8` 참조 깨짐과 `CODE_TIMEOUT / EXECUTION_TIMEOUT` 계층 표기 미흡은 INFO 수준 개선 사항이다.

## 위험도

NONE
