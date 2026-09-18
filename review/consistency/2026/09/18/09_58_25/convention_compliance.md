### 발견사항

- **[WARNING]** `secret-store.md` 승격이 `spec-impl-evidence.md §3.1` 이 서술한 전이 트리거와 다른 경로로 일어난다
  - target 위치: draft `### C7. spec/conventions/secret-store.md frontmatter` (target 문서 118~126행)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `status` 라이프사이클 표 및 §3.1 전이 규칙 — *"`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동하는 commit 안에서 승격 (가드)"*
  - 상세: C7 은 `secret-store.md` 의 `pending_plans:` 블록(유일한 항목 `plan/in-progress/spec-draft-nullable-notation-followups.md`)을 통째로 삭제하고 `status: implemented` 로 올린다. 그런데 이 pending_plan 이 가리키던 트래커 파일 자체는 이번 PR 에서도 `plan/complete/` 로 옮겨지지 않는다 — draft 의 "비대상" 표(140~146행)가 밝히듯 그 트래커에는 이 PR 이 처리하지 않는 다른 미해결 항목(성능 인덱스 등)이 남아 있기 때문이다. 즉 §3.1 이 명시한 유일한 승격 트리거("마지막 `pending_plans` 가 `complete/` 로 이동하는 커밋")가 실제로 발생하지 않은 채 promotion 이 일어난다. 실측: `spec-status-lifecycle.test.ts` (c) 조건은 "`pending_plans` 가 모두 `complete` 인데 status 미승격"만 검사하므로 이 *조기* 승격 자체는 가드가 막지 못한다 — 그러나 문서가 서술한 상태 기계와 다른 경로로 값이 바뀌는 셈이다. (선례는 있다 — `git log` 상 `aecf877c1 fix(spec): trigger-list — pending_plans 제거 (구현이 동일 PR 완료, 지연 surface 아님)` 이 유사 패턴이나, 이 예외적 승격 경로가 `spec-impl-evidence.md` 본문에 명문화돼 있지는 않다.)
  - 제안: (a) C7 의 Rationale 또는 secret-store.md 자체의 정정 각주에 "이 pending_plan 은 여러 spec 이 공유하는 트래커이고, 본 spec 이 약속한 몫만 끝나 승격한다 — 트래커 자체는 다른 spec 의 잔여 항목 때문에 계속 in-progress"라는 취지를 한 줄 남기거나, (b) `spec-impl-evidence.md §3.1` 에 "여러 spec 이 같은 tracker plan 을 `pending_plans` 로 공유할 때, 그 tracker 안의 자기 몫만 끝나면 tracker 파일 자체가 `complete/` 로 가지 않아도 그 spec 만 독립적으로 승격할 수 있다"는 예외 조항을 추가해 규약 자체를 갱신. 어느 쪽이든 명문화하지 않으면 다음 검토자가 매번 `aecf877c1` 같은 선례를 다시 찾아야 한다.

- **[INFO]** draft 의 "실측 대조" 표가 `1-workflow-list.md §2.6` 의 동종 서술을 다루지 않음
  - target 위치: draft `## 실측 — 머지된 코드(a9288bf6e)와 대조` 표, 특히 "4'" 행 (target 문서 56행)
  - 상세: `1-workflow-list.md` 109행("삭제 | ... 트리거가 쓰던 외부 등록과 비밀도 정리한다 — [트리거 목록 §4.3]...")은 이미 현재형으로 서술돼 있고 "미구현 (Planned)" 태그가 없다. `git log -L` 로 확인하면 이 줄은 #1345(`aaee17206`) 자신이 쓴 것인데, 같은 PR 이 `10-triggers.md`/`11-workflow.md`/`12-workspace.md` 세 곳에는 "미구현 (Planned)" 태그를 달았으면서 이 줄에는 달지 않아 애초부터 태깅이 빠져 있었다(우연히 지금은 사실과 일치). 이는 정식 규약(`spec/conventions/**`)이 강제하는 룰의 위반은 아니다 — "미구현 (Planned)" 태그는 여러 spec 파일에 반복되는 비공식 관행일 뿐 전용 convention 문서가 없다(grep 결과 `audit-actions.md`/`node-cancellation.md` 외 없음). 다만 draft 자신이 "실측 — 머지된 코드와 대조"를 전수 감사로 제시하는 만큼, 이 자리를 표에 넣거나 비대상 사유를 명시하는 편이 draft 스스로의 주장 범위와 일치한다.
  - 제안: 실측 표에 `1-workflow-list.md §2.6` 행을 추가(이미 정확하므로 "수정 불필요"로 판정)하거나, 최소한 이 자리를 검토했다는 흔적을 남긴다.

- **명명·프런트매터·문서구조 — 위반 없음**: `spec_impact` 7개 경로 전부 실존 확인(Gate C 충족, `- none` 오형태 아님), `id:`/`status:`/`code:` 필드 스키마는 `spec-impl-evidence.md §2` 예시와 일치, `code:` 블록의 인라인 YAML 주석 삽입(C3)은 2026-09-06 파서 수정 이후 안전한 것으로 확인된 기존 패턴과 동일 스타일. `[트리거 목록 §4.3](../2-navigation/2-trigger-list.md#43-cascade-동작)` 앵커는 실제 헤딩(`### 4.3 cascade 동작`)과 일치하며 상대경로도 `data-flow/`·`5-system/` → `2-navigation/` 모두 정확. `spec/data-flow/**` 세 파일은 frontmatter 의무 대상에서 제외돼 있어(§1) 그 파일들의 "미구현 (Planned)" 문구 변경(C4~C6)은 frontmatter 스키마 검증 대상이 아니다. 플랜 파일명 `spec-draft-deletion-release-current-tense.md` 는 기존 `spec-draft-<topic>.md` 명명 패턴과 일치하고 기존 파일과 충돌하지 않는다.
- **API 문서·출력 포맷 규약**: 해당 없음 — 이 draft 는 DTO·엔드포인트·이벤트 페이로드를 변경하지 않고 spec 서술만 현재형으로 정정한다.

### 요약
검토 대상은 spec 서술을 구현 완료 상태에 맞춰 현재형으로 정정하는 plan draft로, 명명·frontmatter 스키마·링크 앵커·`code:` 주석 포맷 등 `spec/conventions/spec-impl-evidence.md` 의 명시적 요구사항은 대부분 충실히 지킨다. 유일하게 규약 문면과 어긋나는 지점은 `secret-store.md` 의 `partial → implemented` 승격이 §3.1 이 서술한 "pending_plan 이 `complete/` 로 이동하는 커밋" 트리거 없이 일어난다는 점인데, 빌드 가드는 이를 차단하지 못하고 저장소에 유사 선례(`aecf877c1`)도 있어 실무적으로는 용인 가능한 수준이나 규약 문서에 명문화돼 있지 않다. 부수적으로 draft 의 "실측 대조" 표가 스스로 전수 감사를 표방하면서도 `1-workflow-list.md §2.6` 의 동종 사례를 누락한 점은 정식 규약 위반은 아니지만 완결성 관점의 INFO 로 남긴다.

### 위험도
LOW
