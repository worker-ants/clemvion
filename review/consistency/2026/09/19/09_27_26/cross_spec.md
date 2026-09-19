# Cross-Spec 일관성 검토 — entity-index-drift-4c8e21 (--impl-done, scope=spec/2-navigation/)

## 검토 방법 메모

이번 라운드의 `scope`(`spec/2-navigation/`) 델타는 0개 파일이다(정상 — 이 브랜치는 spec 을 고치지 않았다). 실제 diff 는
엔티티 여섯 파일 + 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)이며, 그중 `workspace.entity.ts` ·
`integration-expiry-dispatch.entity.ts` 는 `spec/2-navigation/9-user-profile.md` · `4-integration.md` 가
화면 소유 spec 이다. 프롬프트 번들이 예산으로 절단해 해당 diff·본문을 대부분 못 실었으므로, 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/entity-index-drift-4c8e21`)를 절대경로로 직접 읽어
diff·엔티티·연관 spec(`1-data-model.md` §2/§3 · `data-flow/12-workspace.md` · `data-flow/5-integration.md` ·
`data-flow/8-notifications.md` · `5-system/5-expression-language.md §8.3.2` · `2-navigation/9-user-profile.md` ·
`2-navigation/4-integration.md`)을 전수 대조했다.

## 발견사항

- **[WARNING]** `spec/2-navigation/4-integration.md` §11.2 의 `integration_expiry_dispatch` 유니크 키 서술이 다른 spec 영역·실제 DB와 다르다
  - target 위치: `spec/2-navigation/4-integration.md` §11.2 "중복 방지" (1006행) — `(integration_id, threshold_key)` 로 유니크 판정
  - 충돌 대상: `spec/data-flow/5-integration.md` (341행) · `spec/data-flow/8-notifications.md` (90행) — 둘 다
    `(integration_id, threshold, token_expires_at)` UNIQUE 로 적는다. 그리고 본 PR 이 손대는
    `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts` 의
    `@Unique(['integrationId', 'threshold', 'tokenExpiresAt'])`(V009 그대로) — 3컬럼, 컬럼명은 `threshold` 다
  - 상세: `threshold_key` 라는 컬럼은 엔티티·마이그레이션(V009)·다른 두 spec 어디에도 없다(전수 grep 1건, 그 자리뿐). 2컬럼
    (`integration_id, threshold_key`)으로 서술한 것도 실제(3컬럼: `integration_id, threshold, token_expires_at`)와 다르다.
    같은 표의 "재인증으로 `token_expires_at` 이 바뀌면 새 키로 재발사 가능"(data-flow 쪽 서술)이라는 동작이, 2컬럼
    유니크만 보고 이 화면 spec 을 구현하면 재현되지 않는다 — `token_expires_at` 이 유니크 키에서 빠지기 때문이다.
    이 결함은 본 PR 이 만든 것은 아니다(엔티티 diff 는 `@Unique` 데코레이터의 **이름**만 제거했을 뿐 컬럼은 그대로다).
    다만 이번 PR 이 바로 그 엔티티(`IntegrationExpiryDispatch`)의 선언을 실제 DB 에 맞추는 작업이라, 같은 엔티티를
    설명하는 `spec/2-navigation/4-integration.md` 의 이 문장을 그대로 두면 "엔티티 선언은 고쳤는데 그 엔티티를 설명하는
    또 다른 spec 문장은 여전히 틀린" 상태가 남는다.
  - 제안: `spec/2-navigation/4-integration.md` §11.2 를 `(integration_id, threshold, token_expires_at)` 로 정정
    (planner 턴, `spec/` 쓰기 권한 필요). 이 PR 자체를 막을 사유는 아니다 — pre-existing drift 이고 이 PR 의 diff 범위 밖이다.

- **[WARNING]** (이미 트래커에 등재됨 — 재확인 목적으로 병기) `spec/1-data-model.md` §2 Workspace 표가 `owner_id` FK 의 `ON DELETE CASCADE` 를 적지 않는다
  - target 위치: 이번 PR 의 `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts` — `@ManyToOne(() => User)` 에
    `{ onDelete: 'CASCADE' }` 를 새로 명시(실제 DB 동작은 V001 부터 CASCADE 였고, 코드가 이제 그것을 정확히 선언)
  - 충돌 대상: `spec/1-data-model.md` §2 Workspace 표(`owner_id | UUID | FK → User`, 삭제 동작 미기재) — 같은 문서
    "쓸 인덱스가 없는 FK 서른하나의 처분" Rationale 은 "`user` — 없다 — «탈퇴» 는 워크스페이스 멤버십 삭제다 …
    부모를 지우는 앱 경로가 없다: `user` 를 가리키는 13개" 라고 적어, CASCADE 가 (지금은) 도달 불가능한 선언임을
    시사하면서도 §2 표 자체는 삭제 동작을 아예 언급하지 않는다
  - 상세: 코드가 이제 명시(선언)하는 사실을 spec 표가 침묵한다 — 모순은 아니지만 "코드는 명시, spec 은 침묵" 비대칭.
    동작 변화는 없다(V001 이래 DB 는 항상 CASCADE 였다)
  - 제안: 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:4680-4683` 에 planner 항목으로 등재되어
    있다(우선순위 "낮음", 2026-09-19 등재, 제안 문구까지 적혀 있음: `FK → User (ON DELETE CASCADE)`). 신규 조치 불필요 —
    본 라운드는 이 항목이 여전히 살아 있고 정확히 이 PR 이 원인임을 재확인했다.

- **[INFO]** `spec/2-navigation/9-user-profile.md` · `4-integration.md` 는 이번 PR 이 정정한 인덱스·제약 이름을 전혀 언급하지 않는다
  - target 위치: N/A (두 문서 전체)
  - 충돌 대상: 없음 — 직접 grep 결과 두 문서 모두 `owner_id` 삭제 동작이나 `uq_workspace_personal_owner` /
    `integration_expiry_dispatch` 인덱스 이름을 서술하는 곳이 없다(9-user-profile.md 209행의 "유일한 owner 는 차단"은
    멤버 나가기 규칙이지 FK 동작이 아니다)
  - 상세: 침묵일 뿐 모순은 아니다. `--impl-prep` 2차(`review/consistency/2026/09/19/08_33_13`)가 이미 같은 결론(WARNING 2)을
    냈고, 본 라운드(`--impl-done spec/2-navigation/`)가 독립적으로 재확인했다
  - 제안: 조치 불필요. 두 화면 spec 이 DB 레벨 인덱스·제약 이름까지 서술할 의무는 없다(그 층은 `1-data-model.md` 가 SoT)

## 검증 완료 — 충돌 없음으로 확인된 항목 (근거로 남김)

- `Edge` CHECK(`chk_no_self_loop`, `source_node_id != target_node_id`) ↔ `spec/3-workflow-editor/2-edge.md`(79행, 같은 식·같은
  UNIQUE 인용) ↔ `spec/1-data-model.md` §2.7 — 일치
- `Node` CHECK(`chk_node_placement`) ↔ `spec/1-data-model.md`(176행 "container_id 와 tool_owner_id 는 동시에 값을 가질 수 없음") — 일치
- `Node` 라벨 유니크 인덱스 제거(앱 레이어 전담) ↔ `spec/5-system/5-expression-language.md` §8.3.2(487행 "노드 라벨 유니크 정책") —
  일치. DB 제약을 요구하는 spec 문장 없음
- `Workspace` 부분 유니크 인덱스 `uq_workspace_personal_owner (owner_id) WHERE type='personal'` ↔
  `spec/data-flow/12-workspace.md`(199행·446~465행 "personal 워크스페이스 유일성") — 이름·컬럼·조건 전부 일치
- `IntegrationExpiryDispatch` `@Unique` 컬럼(`integrationId, threshold, tokenExpiresAt`, 이름 제거) ↔
  `spec/data-flow/5-integration.md`(341행) · `spec/data-flow/8-notifications.md`(90행) — 컬럼 일치(이름은 두 문서 모두
  언급하지 않아 비교 대상 아님). 단 `2-navigation/4-integration.md` 는 위 WARNING 참조
- `WorkflowAssistantSession` 두 인덱스 컬럼 정정 ↔ `spec/3-workflow-editor/4-ai-assistant.md`(같은 브랜치 커밋
  `ff530fc8a` 로 갱신된 §3.2/§5.3/§5.3.2/§13 i18n 표) — 인덱스 자체를 언급하는 문장은 없어 직접 충돌 없음. 부수로
  `ff530fc8a` 의 §13 표 변경분(13행 + `autoResumedHintShort` 신설 + divider 서술 넷)을
  `codebase/frontend/src/lib/i18n/dict/{ko,en}/assistant.ts` · `assistant-message.tsx` · `assistant-store.ts` 와
  전수 대조 — 전부 일치(코드 표현과 spec 표 값이 정확히 같다)
- 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)의 소유 spec 귀속 — `spec/1-data-model.md` 의 `code:` 는
  `codebase/backend/migrations/V*.sql` · `entities/*.entity.ts` 글롭만 걸어 이 e2e 파일을 잡지 못하지만, 본문 어디도
  "e2e 가 고정한다" 는 식으로 이 파일을 인용하지 않으므로 spec-impl-evidence 관례 위반은 아니다(cross-spec 층 밖의
  다른 checker 관할)

## 요약

이번 diff(엔티티 여섯 + e2e 가드)와 `spec/2-navigation/` 사이의 직접적 신규 모순은 없다. 코드가 손댄 `Workspace` ·
`IntegrationExpiryDispatch` 두 엔티티의 소유 화면 spec(`9-user-profile.md` · `4-integration.md`)은 인덱스·제약 세부를
서술하지 않아 이 PR 과 충돌하지 않는다. 다만 대조 과정에서 `4-integration.md` §11.2 의 유니크 키 서술이 실제
컬럼(`threshold`, 3컬럼)과 다르고 이름도 존재하지 않는 `threshold_key` 를 쓰는, `data-flow/5-integration.md` ·
`data-flow/8-notifications.md` 와 어긋나는 기존 데이터모델 drift 를 발견했다 — 이 PR 이 만든 결함은 아니지만 이 PR
이 바로 그 엔티티를 다루므로 지금 정정하는 것이 합리적이다. `1-data-model.md` §2 의 CASCADE 미기재는 이미
트래커에 planner 항목으로 등재돼 있어 재조치가 필요 없다. 두 WARNING 모두 이 PR(`developer` 권한)을 막을 사유는
아니다 — spec 정정은 `project-planner` 턴의 몫이다.

## 위험도

LOW
