# Rationale 연속성 검토 — spec/3-workflow-editor/ (--impl-prep)

## 검토 배경

이번 --impl-prep 대상 작업은 `plan/in-progress/entity-schema-declaration-drift.md`
(`spec_impact: none`) — TypeORM 엔티티의 `@Index`/`@Unique`/`@Check`/FK `onDelete` 선언
8곳이 실제 DB(V001~V132)와 다르다는 것을 정정하는 순수 엔티티-메타데이터 교정이다.
`synchronize: false` 라 DB 동작은 바뀌지 않는다고 plan 자신이 명시한다. bundle 에 포함된
`spec/3-workflow-editor/{0-canvas,2-edge,3-execution}.md` 본문·Rationale 전체와, 관련
Rationale 발췌(`spec/1-data-model.md` 전체 Rationale, `spec/0-overview.md`,
`spec/2-navigation/{1-workflow-list,2-trigger-list,3-schedule}.md`)를 대조했다.

## 발견사항

### [INFO] Workspace→User FK 정정이 "user 참조 FK 13개" 게이트와 같은 대상을 건드린다

- target 위치: `plan/in-progress/entity-schema-declaration-drift.md` 표 항목 #8
  (`workspaces/entities/workspace.entity.ts` `@ManyToOne(() => User)` → `{ onDelete: 'CASCADE' }`)
- 과거 결정 출처: `spec/1-data-model.md` `## Rationale` → "쓸 인덱스가 없는 FK 서른하나의 처분"
  절, "두지 않는다 — **라.**" 항목 — *"부모를 지우는 앱 경로가 없다: `user` 를 가리키는 13개
  (그중 NO ACTION 여섯은 참조 행이 있는 사용자의 삭제를 거부한다 — 사용자 삭제는 지금 스키마가
  받아 주지 않는 동작이다. **사용자 삭제를 더하는 변경은 이 13개의 처분부터 다시 정해야 한다**)."*
- 상세: 이 Rationale 은 "`user` 를 가리키는 FK 13개 중 인덱스를 안 두기로 한 결정은, 유저 삭제를
  받는 앱 경로가 없다는 전제 위에 있고, 그 전제를 깨는 변경(= 유저 삭제 기능 추가)은 이 13개 FK
  전체의 처분(인덱스·onDelete 포함)을 다시 검토해야 한다"는 **재검토 게이트**를 명시적으로 걸어
  두었다. `workspace.owner_id → user.id` FK 는 바로 그 13개 중 하나다. 이번 plan 항목 #8 은
  이 FK 의 **entity 선언**(암묵적 `NO ACTION`)을 **실제 DB(V001 `ON DELETE CASCADE`)에 맞게
  고치는 것**이지 "유저 삭제 기능을 추가"하는 변경이 아니므로, 위 게이트 문구가 요구하는
  "13개 재처분"을 촉발하는 사건은 아니다 — 결정 번복이 아니라 선언-실재 정합화다. 다만 이
  FK 가 CASCADE 라는 사실 자체(유저 삭제 시 소유 워크스페이스 전체가 연쇄 삭제된다)가 이번
  발견으로 코드에 처음 명문화되므로, 이 정정이 커밋되고 나면 "13개 중 CASCADE 인 것과 NO
  ACTION 인 것의 실제 구성"이 이전보다 한 항목 더 명확해진다.
- 제안: plan 체크리스트 수행 시 커밋 메시지나 PR 본문에 "이 정정은 DB CASCADE 동작을
  바꾸지 않으며 §Rationale '13개 재처분' 게이트를 발동시키지 않는다"는 한 줄을 남겨, 다음에
  실제로 유저 삭제 기능을 검토하는 사람이 이 커밋을 "13개 중 하나가 이미 결정됐다"고 오독하지
  않게 한다. 강제 사항은 아님(INFO).

## 확인된 정합 사항 (충돌 없음)

- **spec/3-workflow-editor/0-canvas.md**: R-1(Recent 구현·Installed backlog), R-2(팔레트→캔버스
  브리지), R-3(§8 저장 모델 — 타이머 자동저장 없음), R-4(컨테이너 중첩 깊이 제한·배경 틴트
  파기 확정) 모두 본문(§4.1, §4.2, §8, §11.4)과 정확히 일치하며, 이번 plan 은 이 문서가 다루는
  프런트엔드 캔버스 UX 결정을 전혀 건드리지 않는다.
- **spec/3-workflow-editor/2-edge.md**: plan 항목 #6(`edge.entity.ts` `@Check` 따옴표 결함
  정정)은 §2.2 의 "자기연결·동일 연결 중복은 DB 레벨 제약과 동일한 invariant 를 캔버스가
  선제 차단하는 이중 방어다 — `source_node_id != target_node_id` 가 최종 안전망"이라는 서술과
  **충돌하지 않고 오히려 강화**한다 — 정정 전 entity 선언은 SQL 로 만들 수조차 없는 깨진 CHECK
  였고(plan 실측: `ERROR: column "source_node_id != target_node_id" does not exist`),
  `synchronize: false` 라 DB 의 실제 `chk_no_self_loop`(V001)는 항상 살아 있었다. 즉 이 정정은
  "이중 방어의 두 번째 층이 문서상으로도 정확히 서술되게" 만드는 교정이며, R-1/R-2/R-3 어느
  것과도 상충하지 않는다.
- **spec/3-workflow-editor/3-execution.md**: R-7, R-1.3, R-2.2, §6 브레이크포인트 v1 제외 등
  모두 본문과 일치. plan 은 이 문서의 실행/디버깅 표면을 전혀 건드리지 않는다.
- **spec/1-data-model.md 의 나머지 Rationale**(Webhook endpoint_path 전역 유일, FK 인덱스
  28/31/4/5개 처분, Trigger `(workflow_id)` 인덱스, `User` select:false 기각, Schedule 인덱스
  교체, `alert_rule` 등재, `WorkflowVersion.snapshot` 서술 정정, `Execution.execution_path`
  이관): 모두 이번 plan 이 다루는 8개 항목(§1~§3 노드/엣지/워크스페이스 인덱스·제약, 트리거 없음)과
  겹치는 컬럼·인덱스가 없다. plan 항목들은 이 문서가 반복적으로 정립해 온 "선언은 실재하는
  것만, 실재하면 그대로, 실재를 안 적는 것은 결함이 아니다"라는 패턴(예: `alert_rule` 등재,
  `WorkflowVersion.snapshot` 정정, FK 서른하나 처분에서의 "라/마/바" 비대상 분류)을 그대로
  잇는 연장선이며, 이 문서가 이미 기각한 대안(예: Schedule 절의 "부분 조건만 제거"·"DROP")을
  재도입하지 않는다.
- `spec/0-overview.md`, `spec/2-navigation/{1-workflow-list,2-trigger-list,3-schedule}.md`
  의 Rationale(S3 키 설계, Flyway 채택, 실행 엔진 큐 설계, 트리거/스케줄 UX 결정 등)은 이번
  plan 의 대상(엔티티 인덱스/제약 선언)과 접점이 없어 검토 대상에서 실질적 충돌이 없다 — 이
  문서들이 함께 번들된 것은 impl-prep 스코프의 related_specs 확장 때문으로 보이며, 참고 목적
  이상의 의미는 없다.
- **truncated 4개 파일** (`4-ai-assistant.md`, `_product-overview.md`, `1-node-common.md`,
  `5-version-history.md`)은 컨텍스트 예산 초과로 본문이 생략됐다. 이번 plan 이 건드리는 코드
  (엔티티의 인덱스·제약·FK 선언)는 이 네 문서가 다루는 AI Assistant·PRD·노드 공통 스펙·버전
  히스토리의 서술 대상과 직접 겹치지 않는 것으로 판단되나, 부재를 "내용 없음"의 근거로 삼지
  않는다는 원칙에 따라 확정적 결론은 유보한다. 필요시 별도로 `Read` 하여 재확인 가능.

## 요약

`entity-schema-declaration-drift` plan 은 TypeORM 엔티티 선언을 이미 존재하는 DB 마이그레이션
(V001~V132)의 실제 인덱스·제약·FK 에 맞추는 순수 메타데이터 교정이며 `synchronize: false` 로
DB 동작을 바꾸지 않는다. `spec/3-workflow-editor/{0-canvas,2-edge,3-execution}.md` 의 Rationale
(R-1~R-4, R-1~R-3, R-7/R-1.3/R-2.2 등)은 모두 현재 본문과 정합하며, plan 은 이 문서들이 다루는
프런트엔드 캔버스·엣지·실행 UX 결정을 전혀 건드리지 않는다. `spec/1-data-model.md` 의 인덱스/FK
Rationale 군과도 대상 컬럼이 겹치지 않고, 오히려 그 문서가 반복 정립해 온 "선언은 실재와 일치시킨다"
원칙의 연장이다. 유일하게 주의할 지점은 항목 #8(Workspace→User FK `onDelete` 정정)이 "user 참조
FK 13개는 유저 삭제 앱 경로가 없다는 전제 위에 인덱스를 안 둔다 — 유저 삭제를 추가하는 변경은 이
13개를 다시 처분해야 한다"는 게이트가 걸린 FK 집합의 일원이라는 점인데, 이번 정정은 그 게이트가
말하는 "유저 삭제 기능 추가"가 아니라 선언-실재 정합화이므로 게이트를 발동시키지 않는다 — INFO
수준으로 커밋 메시지에 한 줄 남기는 것을 제안한다. 그 외 기각된 대안의 재도입, 합의 원칙 위반,
무근거 번복, invariant 우회는 발견되지 않았다.

## 위험도

LOW
