# Rationale 연속성 검토 — spec-draft-deletion-release-current-tense (2회차)

## 발견사항

- **[WARNING]** C10(공유 트래커 승격 규약)이 정의되는 시점과 그 규약이 적용되는 시점이 같은 PR — 자동 가드가 아니라 수기 판정으로 승격 원칙을 대체한다
  - target 위치: `### C10. spec/conventions/spec-impl-evidence.md §3.1` + `## Rationale` → `### C7. spec/conventions/secret-store.md frontmatter`
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md §3` 표(`partial` 행: *"모든 `pending_plans` 가 `complete/` 로 이동하면 `implemented` 로 승격 의무 (가드)"*) + `§3.1`(*"`partial` → `implemented`: 마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)"*) + `## Rationale` → `### R-5`(*"spec 가 자기를 책임지는 plan 을 가리킨다... 역방향 링크가 있었으면 plan 추적이 자연스럽게 발견했을 것. 가드(`spec-pending-plan-existence.test.ts`)가 spec → plan 링크 유효성 강제"*)
  - 상세: 확립된 원칙은 "승격 시점 = pending_plans 가 전부 `complete/` 로 이동한 commit" 이고, 이는 `spec-status-lifecycle.test.ts` (c) 가 **기계적으로** 강제하도록 설계됐다(R-5 의 "가드가 자연스럽게 발견" 이라는 목적 그대로). target 의 C7 은 `secret-store.md` 의 유일한 `pending_plans` 항목(`spec-draft-nullable-notation-followups.md`)이 여전히 `plan/in-progress/` 에 남은 채로 `status: implemented` 승격 + `pending_plans` 삭제를 한다 — 이는 §3.1 문언을 문자 그대로 어긴다. target 은 이를 인지하고(C10) **바로 그 PR 안에서** §3.1 에 "공유 트래커일 때는 파일 이동이 아니라 그 문서 몫의 미구현 surface 감사로 승격 시점을 정한다" 는 새 하위 규칙을 신설하며, 그 신설된 규칙을 즉시 자기 자신(`secret-store.md`)에 적용해 승격을 정당화한다. 새 Rationale 문단(R-5 말미 "공유 트래커 (2026-09-18)")이 함께 작성되므로 리뷰 기준 #3("결정의 무근거 번복")의 문자 그대로의 위반은 아니지만, **가드가 기계적으로 강제하던 안전장치를 "그 순간 필요해서 만든" 수기 판정으로 대체**하는 것이며, 그 판정의 첫 수혜자가 바로 그 판정을 신설한 문서 자신이다. `spec-status-lifecycle.test.ts` 는 이 방향(조기 승격)을 검사하지 않으므로(target 스스로 인정) 이후 다른 문서가 같은 근거로 조기 승격을 주장할 때 이번 판정이 유일한 선례가 된다 — 그 선례가 "감사 근거를 승격 commit 에 남긴다" 는 문서화 의무만으로 R-5 가 막으려던 "빈 약속" 재발을 충분히 막는지는 **이번 사례의 감사 품질에 전적으로 의존**한다(다행히 실측 확인 결과 그 감사 자체는 트래커 열린 6개 항목을 전수로 읽고 각각의 승격 무관성을 정확히 판정했다 — 아래 요약 참조).
  - 제안: (a) C10 의 §3.1 신설 문구와 C7 의 `secret-store.md` 승격 적용을 커밋 상에서라도 논리적으로 분리해 "일반 규칙 신설" 과 "그 규칙의 첫 적용" 이 각각 독립적으로 재검토 가능하게 하거나, (b) 최소한 C10 Rationale 에 "이 규칙의 첫 적용 대상이 이 규칙을 신설한 문서 자신이다" 라는 이해상충 성격을 한 문장으로 명시해 다음 사람이 선례를 인용할 때 그 한계를 알게 한다.

- **[INFO]** 공유 트래커 열거에서 `chat-channel-adapter.md` 누락
  - target 위치: `## Rationale` → `### C10` 하위 `## Rationale` R-5 추가 문단(*"spec/ 3개 문서의 `pending_plans` 가 같은 트래커를 가리켰다"*)
  - 과거 결정 출처: 해당 없음(target 자신의 새 Rationale 문장의 정확성 문제)
  - 상세: 저장소 실측 — `spec-draft-nullable-notation-followups.md` 를 `pending_plans:` 에 실제로 등재한 spec 은 `2-trigger-list.md`·`1-workflow-list.md`·`secret-store.md`·`chat-channel-adapter.md` **4개**다. target 문장이 `secret-store.md`(승격 대상 자신)를 제외하고 "3개" 라 센 것이라면 산수는 맞지만, 뒤이어 "이 PR 뒤에도 `2-trigger-list.md` 가 남는다" 라고만 적어 같은 트래커를 공유하는 `chat-channel-adapter.md`(§1.1.2 fallback 제거 판정이라는 무관 항목으로 열려 있음)를 언급하지 않는다. C10 이 세우는 일반 규칙("공유 트래커는 문서마다 개별 감사")의 근거를 강화하려면 이번에 실제로 존재하는 공유 사례를 빠짐없이 적는 편이 다음 사람이 그 문서를 승격할 때 이번 판정을 온전한 선례로 참고할 수 있게 한다.
  - 제안: C10 Rationale 문단에 `chat-channel-adapter.md` 도 같은 트래커를 가리키는 문서로 한 줄 추가.

- **[INFO]** 트리거 정리의 `ModuleRef.get(strict:false)` 채택 사유가 execution-engine.md §4.4 표의 두 기준(공동 인스턴스화 순환 vs 인스턴스화-순서 함정) 중 어느 쪽인지 target 이 직접 확인하지 않았다
  - target 위치: `## 비대상 — 트래커 6행을 하지 않는 이유` 표 1행
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §4.4` `## Rationale` 없음(본문 표 자체가 근거) — *"`ModuleRef.get(X, { strict: false })` (런타임 지연 해석) | 순환 그래프상 본 서비스가 상대 모듈보다 먼저 인스턴스화돼 생성자 `@Optional` 주입이 `undefined` 로 굳어버리는 경우"*
  - 상세: target 은 "트리거 정리의 지연 해석은... 이유(모듈 import 순환 회피)도 적용 기준(인스턴스화 순서 함정)과 다르다" 고 판정해 표에 추가하지 않기로 했다. 그러나 `trigger-resource-releaser.service.ts` JSDoc 은 "스케줄 삭제만 이 서비스를 쓰지 않는다: `TriggersModule` 이 `SchedulesModule` 을 import 하므로 반대 방향은 순환이다" 라고만 적어 스케줄 예외의 이유를 설명할 뿐, `resolveTriggerResourceReleaser`(워크플로·워크스페이스 쪽에서 `ModuleRef.get` 을 쓰는 이유) 자체의 순환 성격(모듈 그래프 순환인지, DI 인스턴스화 순서 함정인지)을 명시하지 않는다. target 의 "다르다" 판정이 실제 모듈 임포트 그래프 확인(예: `TriggersModule` ↔ `WorkflowsModule`/`WorkspacesModule` 상호 import 여부)에 근거했는지 불명확하다 — 이 자체가 execution-engine.md 표의 "인스턴스화-순서 함정" 케이스라면 비대상 판정의 근거가 흔들린다.
  - 제안: 실제 모듈 그래프(`TriggersModule`/`WorkflowsModule`/`WorkspacesModule` 의 `imports`)를 확인해 "모듈 import 순환" 인지 "인스턴스화 순서 함정" 인지 한 문장으로 target 실측 표에 덧붙이거나, 최소한 이번 비대상 판정이 이 구분에 의존한다는 점을 명시.

## 요약

target 문서는 #1345(D1~D7)가 세운 삭제 자원 정리 계약을 하나도 뒤집지 않는다 — C1·C2·C6 의 신규 서술(부모 잠금 상한 확장, 권한 선검사, 워크스페이스→멤버십 잠금 순서)은 실제 머지된 코드(`lockParentAndListTriggerIds`, `assertWorkspaceDeletable` 등)와 정확히 일치했고, D3/D4/D6/D7 이 이미 확립한 원칙(외부 자원은 트랜잭션 밖·행 삭제 전, 비밀은 커밋 뒤, `ON DELETE CASCADE` 미채택)과 방향이 같으며 새 Rationale 문단("권한 선검사 창을 잔여 목록에 넣는 이유")을 동반한다. 1회차 검토가 지적한 CRITICAL(`secret-store.md` 승격 시 트래커의 미해소 항목 미감사)은 이번 target 이 실측 표 "4(감사)" 에서 트래커의 열린 6개 항목을 전수로 직접 읽어 낸 결과와 대조했을 때 정확했다 — 1회차가 지목한 바로 그 항목(line 1091, "열린 `config` 맵 비밀의 e2e 동반 규칙 문장")은 실제로 "문서에 아직 없는 새 규칙 제안" 이지 "이미 약속된 동작의 구현 미완" 이 아니며, 나머지 5개 항목도 등재 질문·인용·harness 절단·자기참조로 확인돼 미구현 surface 는 실제로 0이다. WARNING1 이 지목한 거짓 선례(`aecf877c1`)도 실측(같은 PR 완전 구현, `pending_plans` 부재)으로 target 의 재판정이 맞았다. 다만 그 CRITICAL 을 닫기 위해 신설한 C10(공유 트래커의 조기 승격 규약)이 같은 PR 안에서 즉시 자기 자신에게 적용되는 구조는, 기존에 가드가 기계적으로 강제하던 승격 원칙(R-5)을 문서화된 수기 판정으로 대체하는 정도의 원칙 이동이라 — 근거 자체는 탄탄하지만 구조적으로 눈여겨볼 지점이다.

## 위험도

LOW
