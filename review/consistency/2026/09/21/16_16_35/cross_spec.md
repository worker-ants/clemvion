# Cross-Spec 일관성 검토 — `spec/2-navigation` (impl-prep, `modelconfig-dup-delete`)

## 컨텍스트 보정

번들 프롬프트는 예산 초과로 `spec/2-navigation` 15개 파일 중 3개(`1-workflow-list.md`·
`2-trigger-list.md`·`3-schedule.md`)만 전문이 실렸고, 이번 impl-prep 이 실제로 걸리는
**`6-config.md`(Part B: Model Config)** 와 관련 spec 본문(`5-system/8-embedding-pipeline.md`
등) 94개는 전부 절단됐다. plan(`plan/in-progress/modelconfig-dup-delete.md`) 자체가 "6-config.md 는
손으로 읽는다" 고 적어 둔 지점이라, 아래 판단은 절단된 파일들을 저장소에서 직접 `Read`/`grep` 한
결과다 (번들 부재를 "내용 없음" 으로 취급하지 않았다).

## 대상 변경 범위

이번 작업은 `ModelConfigService.remove()` 의 동시 DELETE 중복 감사 로그 결함 수정이다
(`plan/in-progress/modelconfig-dup-delete.md`) — `auth-configs`(#1374)·`workspaces`(#1373)·
`integrations`(#1372)·`schedules`(#1371) 와 같은 결함 클래스의 여덟 번째 자리이며, **spec 본문
변경은 없다**(`spec_impact: none`, 코드 전용 수정). 따라서 검토 대상은 "새 draft 텍스트" 가 아니라
"이 코드 변경이 기존 `spec/2-navigation` 및 인접 영역의 계약과 어긋나지 않는가" 다.

## 발견사항

교차 검증한 항목 — 전부 정합, 충돌 없음:

- **감사 액션 이름** — plan 이 가정하는 `model_config.delete` 는 `spec/data-flow/1-audit.md:103`
  과 `spec/5-system/1-auth.md:433` 에 이미 등재된 이름과 일치한다. 사족: 두 파일 모두 "2026-08-01
  구현됨" 으로 이미 과거형 사실로 기록돼 있어, 이번 수정(중복 건 제거)이 액션 이름 자체를 바꾸지
  않는 한 갱신할 문장이 없다.
- **404 에러 코드** — plan 은 진 쪽(레이스 패자)이 기존 `notFound()` 헬퍼(`MODEL_CONFIG_NOT_FOUND`)
  를 그대로 반환한다고 명시한다. `spec/5-system/3-error-handling.md:85` 가 이 코드를 "지정 id 의
  ModelConfig 부재" 로 정의하고 있어 레이스 패자 케이스(부재가 된 시점의 재조회 실패)와 의미가
  부합한다 — 형제 수정들이 그대로 재사용한 `RESOURCE_NOT_FOUND` 대신 `MODEL_CONFIG_NOT_FOUND` 를
  쓰겠다는 plan §C 의 판단이 spec 정의와 맞다.
- **RBAC** — `spec/5-system/1-auth.md:387,407` 의 Model Config 행은 `Owner/Admin/Editor=CRUD,
  Viewer=R` 이고, `spec/2-navigation/6-config.md` 의 "mutation(POST/PATCH/DELETE)은 Editor+" 서술과
  일치한다. 이번 수정은 권한 게이트를 건드리지 않으므로 충돌 표면이 없다.
- **FK cascade 방향** — plan §C 는 `knowledge_base.rerank_config_id`(V090)·KB embedding 참조
  (V091) 가 둘 다 `ON DELETE SET NULL` 이라고 명시한다. `spec/1-data-model.md:392,407` 이 동일하게
  `SET NULL` 로 문서화하고 있어 일치한다 — CASCADE 로 오인해 "이긴 쪽 delete 의 affected 가 0이
  될 수 있다" 는 형태의 오판(스케줄/트리거 자리에서 실제로 있었던 함정, `fc5ea6b76`)이 model-config
  자리에는 적용되지 않는다는 plan 의 결론과 데이터 모델이 일치한다.
- **락/동시성 설계 부재 확인** — `spec/2-navigation/6-config.md` 전체에 Model Config Part B 에
  대한 advisory lock·트랜잭션 직렬화 서술이 없다(트리거 축의 §3 "동시 쓰기 직렬화" 같은 절이
  존재하지 않음). `spec/5-system/8-embedding-pipeline.md` 도 삭제 동시성에 대해 침묵한다. plan 이
  "락을 새로 들이지 않고 단일 원자적 DELETE 의 affected 로 가른다" 는 처방(형제 자리 `integrations`
  `4d9064740` 이 채택한 것과 동일)을 쓰는 것은 기존에 문서화된 락 설계와 모순되지 않는다 — 애초에
  그런 설계가 spec 에 없다.
- **캐시 무효화 관측점** — `spec/5-system/7-llm-client.md:478` 은 `ModelConfigService.onConfigInvalidated`
  옵저버 패턴(단방향 `LlmModule → ModelConfigModule`)을 문서화한다. plan §B 가 "진 쪽은
  `notifyInvalidated` 를 부르지 않는다" 고 정정한 부분은 이 옵저버 계약 자체를 바꾸지 않는다 —
  캐시 축출이 멱등이라는 전제와 무관하게, 삭제에 **실패한** 요청이 무효화를 안 부르는 것은 이
  spec 문서의 어떤 서술과도 충돌하지 않는다.

위 항목 모두 CRITICAL/WARNING 없음. 아래는 참고용 INFO.

- **[INFO]** 반복되는 "무락 삭제 + 원자적 DELETE affected 판정" 패턴의 spec 화 부재
  - target 위치: 없음 (이번 target 문서에 해당 패턴에 대한 서술 자체가 없음)
  - 충돌 대상: 없음 — 충돌이 아니라 부재
  - 상세: 같은 결함 클래스가 이번까지 8번째(workflow/workspace #1369, trigger #1370, schedule
    #1371, integration #1372, workspace-member #1373, auth-config #1374, 이번 model-config)
    반복되고 있는데, `spec/conventions/` 어디에도 "동시 DELETE 는 advisory lock 대신 원자적 DELETE
    의 `affected` 로 판정한다" 는 패턴을 명문화한 문서가 없다. 매 PR 이 커밋 메시지로만 이유를
    남기고 spec 은 그대로다(`spec_impact: none` 이 전부 정당함 — 코드 세부사항이지 계약 변경이
    아니므로 CRITICAL/WARNING 감은 아니다).
  - 제안: 지금 당장은 아니지만, 아홉 번째(WebAuthn credential, plan 이 이미 "별 PR" 로 명시 예고)
    까지 끝나면 `spec/conventions/` 에 짧은 패턴 문서를 만들어 향후 신규 삭제 엔드포인트 작성 시
    개발자가 이 패턴을 처음부터 채택하도록 유도하는 편이 반복 결함 재발을 줄인다. 이번 PR 의
    범위는 아니다.

## 요약

이번 impl-prep 대상은 spec 본문을 바꾸지 않는 코드 전용 수정(`ModelConfigService.remove()` 동시
삭제 감사 중복 제거)이며, 번들이 절단한 `6-config.md`·`5-system/8-embedding-pipeline.md`·
`1-data-model.md`·`5-system/1-auth.md`·`5-system/3-error-handling.md`·`data-flow/1-audit.md` 를
직접 읽어 감사 액션명·404 에러 코드·RBAC·FK cascade 방향·락 설계 부재·캐시 무효화 계약을 교차
검증한 결과 어느 것도 충돌하지 않는다. 전문이 포함된 `1-workflow-list.md`·`2-trigger-list.md`·
`3-schedule.md` 내부에도 이 변경과 접점이 되는 모순은 없다. 유일한 관찰은 반복되는 삭제-동시성
패턴이 아직 convention 문서로 승격되지 않았다는 INFO 수준 사항으로, 이번 PR 을 막을 사유가 아니다.

## 위험도

NONE
