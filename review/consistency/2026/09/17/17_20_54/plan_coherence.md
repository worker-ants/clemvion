# Plan 정합성 검토 — spec-draft-deletion-releases-trigger-resources (3차)

## 발견사항

- **[INFO]** S1 이 편집하는 `1-workflow-list.md` frontmatter `pending_plans` 배열에 이미 dangling 항목이 있다 — 같은 자리를 만지면서 청소하지 않는다
  - target 위치: `## 변경안` S1 — *"frontmatter 의 **기존** `pending_plans:` 배열에 `plan/in-progress/spec-draft-nullable-notation-followups.md` 추가"*
  - 관련 plan: (a) `spec/2-navigation/1-workflow-list.md` 현재 frontmatter `pending_plans: [plan/in-progress/marketplace-and-plugin-sdk.md, plan/complete/workflow-duplicate-nodes-edges.md]` — 실측 결과 `plan/complete/workflow-duplicate-nodes-edges.md` 는 이미 `plan/complete/` 로 이동해 있다(`plan/in-progress/` 에는 없음). (b) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 아직 미체크(`- [ ]`) 항목 *"docs 가드가 spec frontmatter 의 dangling `pending_plans` 를 안 잡는다"*(harness, 2026-09-10 등재) — `15-chat-channel.md` 에서 같은 패턴(`pending_plans` 가 `plan/complete/` 로 이동한 plan 을 계속 가리킴)을 지목하며 *"`spec/**` frontmatter 의 `pending_plans` 경로가 실재하는지 검사하는 가드 한 줄"* 을 처방으로 남겨 뒀고, 이 가드는 아직 없다(그 항목 자체가 미체크).
  - 상세: target 은 이 배열에 **추가만** 하고 기존 dangling 항목은 그대로 둔다. 이 draft 가 다른 자리(secret-store.md 등)에서는 `pending_plans` 를 "정확한 근거 문서 하나" 로 다루는 데 공을 들이는 것과 대비된다. 이 dangling 항목 하나는 target 의 핵심 결정(D1~D7)과 충돌하지 않고 병합을 막을 사유도 아니지만, 정확히 열려 있는 harness 백로그 항목이 지목한 결함 클래스의 실사례가 target 이 지금 편집하는 바로 그 필드에 있다.
  - 제안: 필수는 아님 — S1 에 한 줄만 추가해 `plan/complete/workflow-duplicate-nodes-edges.md` 를 제거하거나(완료됐으므로), 제거하지 않는다면 최소한 정리하지 않는다는 사실과 그 이유를 한 줄 남긴다. 근본 처방(dangling 검사 가드 신설)은 target 의 책임이 아니라 위 harness 항목의 몫이므로 target 을 차단할 이유는 아니다.

## 검증한 정합 지점 (문제 없음 — 참고용, 1·2차 검토 대비 재확인)

- 1차 `--spec`(`16_32_44`)이 낸 CRITICAL/WARNING 3건 — (1) `secret-store.md` §6 두 문단이 §R4 정정과 모순, (2) developer 구현 작업이 어느 `plan/in-progress/**` 에도 없음, (3) 착수 계기 항목 8 이 새 draft 와 교차 참조 없음 — 은 현재 판(S9·S10, DRT-1~3)에서 실제로 닫혀 있다. `secret-store.md` §6 첫 문단·둘째 문단을 직접 읽어 "모든 경로" 서술과 미구현 SQL 정정이 반영 대상에 포함됨을 확인했다.
- 2차 `--spec`(`17_05_02`)의 유일한 WARNING(T2/DRT-2 모듈 순환 서술이 `#676`(`e827ed2a7`) 선례를 인용하지 않음)은 DRT-2 본문에 그 커밋·전례가 명시 인용되고 "착수 첫 판단은 협력자의 모듈 위치" 로 재작성돼 해소됐다. 2차 INFO 2건(deleteByPrefix 호출부 수 갱신·spec-link-integrity 멀티라인 사각지대)도 DRT-2 부수 주의 및 2차 처분표에 반영됨을 재확인했다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "trigger-config advisory lock 이 남긴 developer 범위 후속" 표 8·9행, "없는 메서드 `TriggersService.delete()`" 항목(1·2·3 처분)을 직접 읽어 DRT-1·DRT-3 의 서술과 문자 그대로 대조 — 일치한다. 항목 3(V063 마이그레이션 주석, Flyway 체크섬 무조치)도 target 의 "비대상" 표 서술과 정확히 같다.
- `plan/complete/trigger-config-lost-update.md` §"후속(developer 범위)" 표의 *"secret store 쓰기·provider 등록의 원자성 … 정리 순서를 바꾸려면 «외부 호출을 락 안에 두지 않는다» 제약과 충돌하므로 별도 설계 검토(5라운드 W1)"* 행을 원문 대조 — D4~D6 의 "미뤄 둔 항목과의 관계" 절 인용이 정확하다. D5 가 "비밀 쪽 절반만 닫고 provider 등록 절반은 D7 창 2 로 미룬다" 는 분할도 이 원 항목의 범위(secret store **+** provider 등록)와 어긋나지 않는다 — provider 쪽을 남긴다고 명시했으므로 원 항목을 부분적으로만 닫는다는 사실이 감춰지지 않는다.
- `1-workflow-list.md`(`pending_plans` 추가)·`2-trigger-list.md`(이미 같은 tracker 를 가리킴)의 상호 정합도 재확인 — `2-trigger-list.md` frontmatter 가 이미 `pending_plans: [spec-draft-nullable-notation-followups.md]` 이므로, S1 이 같은 tracker 를 `1-workflow-list.md` 에도 추가하는 것은 "그 tracker 에 DRT-2 로 실제 구현 항목이 생긴다" 는 target 자신의 계획과 정합한다(임의 문서를 가리키는 것이 아니다).
- `backend-lint-gate-broken-on-main.md` 의 `deleteByPrefix()` LIKE 메타문자 항목은 이미 `[x]` 종결(e2e+단위 회귀 고정)이며 target 이 전제하는 "prefix 는 항상 트리거 UUID" 불변식과 충돌하지 않는다 — 선행 조건 미해소 아님.
- Cafe24 advisory lock 기각 선례(`spec/2-navigation/4-integration.md:1444`, `2-trigger-list.md §3` 인용)를 원문 대조 — D3 의 인용이 정확하다.
- `TriggersModule`/`SchedulesModule`/`WorkflowsModule` 순환 관련 다른 in-progress plan(`WorkflowsService.remove`·`deleteWorkspace`·`secret_store` 키워드 전수 grep)을 확인한 결과 target·`spec-draft-nullable-notation-followups.md`·(이미 닫힌) `backend-lint-gate-broken-on-main.md` 외에는 겹치는 문서가 없다 — 중복·경합 결정 없음.

## 요약

이전 두 차례 `--spec` 검토가 낸 실질적 WARNING(§6 자기모순 · 미등재 구현 작업 · 항목 8 교차참조 단절 · 모듈 순환 선례 미인용)은 이번 판에서 원문 대조로 재확인한 결과 모두 실제로 닫혀 있고, D1~D7·S1~S10·DRT-1~3 은 `plan/in-progress/**` 의 다른 미해결 결정과 충돌하지 않으며 오히려 봉인된 `trigger-config-lost-update.md`·열려 있는 `spec-draft-nullable-notation-followups.md` 의 기존 항목들을 정확히 승계·완결한다. 새로 발견한 것은 target 이 편집하는 `1-workflow-list.md` frontmatter `pending_plans` 배열에 이미 존재하는 dangling 항목(`plan/complete/`로 이동한 plan 을 계속 가리킴) 하나뿐이며, 이는 target 의 결정과 무관한 선재 결함이고 정확히 열려 있는 harness 백로그 항목이 지목한 클래스의 사례라 병합을 막을 사유는 아니다.

## 위험도

LOW
