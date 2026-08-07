# Cross-Spec 일관성 검토 — `spec/conventions/audit-actions.md`

## 검토 방법 메모

번들 프롬프트는 컨텍스트 예산 초과로 `spec/data-flow/1-audit.md`·`spec/data-flow/12-workspace.md` 등
target 이 SoT 로 지목하는 핵심 문서를 포함하지 못했다. "포함되지 않음 = 문제 없음" 으로 단정하지
않고, 워킹트리에서 `git diff origin/main`(이 target 이 속한 실제 커밋 diff)과 관련 spec 파일 원문을
직접 `Read`/`grep` 하여 검증했다.

## 발견사항

검토 결과 CRITICAL/WARNING 급 충돌은 발견되지 않았다. 확인한 항목:

- **데이터 모델·구현 상태 일관성 (통과)**: target 의 §3 레지스트리가 `workflow`/`trigger`/`schedule`/
  `model_config` CRUD 13개 액션을 "미구현"→"구현" 으로 정정한 것과 동일 커밋에서
  `spec/5-system/1-auth.md §4.1`(카탈로그, 4개 카테고리를 Planned 표에서 구현 표로 이동) ·
  `spec/data-flow/1-audit.md §1.1`(Writer 표에 13행 추가 + 커버리지 갭 문단 정정)이 함께 갱신됐다.
  세 SoT 문서가 동일 사실을 동일하게 서술하며 서로 모순이 없다.
- **코드 대조 (통과)**: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 의
  `AUDIT_ACTIONS` union 에 `WORKFLOW_CREATED/UPDATED/DELETED`, `TRIGGER_CREATED/UPDATED/DELETED`,
  `SCHEDULE_*`, `MODEL_CONFIG_*` 가 실제로 정의돼 있어 target 의 "구현" 표기와 정확히 일치한다.
  `workflow.executed` 는 union 에 없고, target·1-auth.md·data-flow/1-audit.md 세 곳 모두 이를
  "의도적 미구현(Planned)"으로 일관되게 서술한다.
- **명명 규약 위반 잔존 여부 (통과, 부수 수정 확인)**: 동일 커밋이 `spec/2-navigation/2-trigger-list.md`
  와 `spec/5-system/15-chat-channel.md` 에서 target §1/§2.1 규약(`<resource>.<verb>`, verb 는
  과거분사)과 어긋나던 `trigger.delete`/`trigger.update`(현재형 오기)를 `trigger.deleted`/
  `trigger.updated` 로 정정했다. `grep -rn` 전수 확인 결과 spec/ 전역에 이 오기의 잔존 사례가 없다.
  같은 diff 에서 trigger-list.md §4.1 의 "`trigger.delete` **permission**" 이라는 존재하지 않는
  권한명 언급도 "§3.2 리소스별 권한 매트릭스(역할 기반)" 인용으로 함께 정정돼, RBAC 서술과
  audit-actions 서술 사이의 잠재 충돌도 해소됐다.
- **RBAC 정합 (통과)**: trigger-list.md §4.1 삭제 권한 표(viewer 불가/editor 가능/admin·owner 가능)는
  1-auth.md §3.2 매트릭스의 `Trigger: Owner=CRUD, Admin=CRUD, Editor=CRUD, Viewer=R` 와 일치한다.
- **workspace.deleted 구조적 제외 (통과)**: target §3 하단 주석, 1-auth.md §4.1, data-flow/12-workspace.md
  §Rationale "workspace.deleted 감사 제외", audit-action.const.ts 주석 네 곳이 `ON DELETE CASCADE`
  근거를 동일하게 서술하며 서로 모순이 없다.
- **plan 추적 정합 (통과)**: `plan/in-progress/spec-sync-auth-gaps.md` 의 체크리스트가 이 커밋으로
  완료 처리된 항목(§4.1 동기화, Rationale 승격 2건)과 실제 diff 내용이 일치한다.

## 요약

target 문서는 `workflow`/`trigger`/`schedule`/`model_config` CRUD 액션의 구현 상태를 "미구현"에서
"구현"으로 정정하는 변경이며, 같은 커밋에서 `5-system/1-auth.md`(카탈로그 SoT)와
`data-flow/1-audit.md`(커버리지 SoT)가 동시에 갱신돼 세 SoT 가 여전히 일관된 사실을 말한다. 부수로
`2-navigation/2-trigger-list.md`·`5-system/15-chat-channel.md` 의 명명 오기(`trigger.delete`/
`trigger.update` → `trigger.deleted`/`trigger.updated`)와 존재하지 않는 권한명 언급도 함께 정정돼,
오히려 기존에 잠재해 있던 cross-spec 불일치(명명 규약 위반 표기)를 해소하는 방향의 변경이다. 데이터
모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 새로운 충돌은 발견되지 않았다.

## 위험도

NONE
