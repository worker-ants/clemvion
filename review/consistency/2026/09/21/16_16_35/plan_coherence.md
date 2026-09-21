# Plan 정합성 검토 — spec/2-navigation (--impl-prep, modelconfig-dup-delete)

## 발견사항

- **[WARNING]** 옴니버스 추적 항목("삭제 엔드포인트 spec 서술 누락")의 위치 열거가 이 fix 착지 뒤 stale 해진다
  - target 위치: `spec/2-navigation/6-config.md` — Model Config API 표의 `DELETE /api/model-configs/:id` 행 (본문 §Model Config API, `code:` 가 `codebase/backend/src/modules/model-config/**` 를 문다)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미해결 항목 "삭제 엔드포인트를 적는 spec 들에 «동시 삭제 → 두 번째 404» 서술이 없다" (2026-09-21 기준 열거: `1-workflow-list.md §2.6` · `data-flow/12-workspace.md §1.10`·`§1.6` · `3-schedule.md §4` · `4-integration.md §9` · `9-user-profile.md §6.1` · **`6-config.md §A(DELETE /api/auth-configs/:id)`**)
  - 상세: 이 옴니버스 항목은 스스로 "다섯 번 확장됐다"고 적으며, 형제 dup-delete PR(스케줄→통합→api-convention→멤버→인증설정)이 착지할 때마다 그 PR 이 새로 만든 "코드는 두 번째 요청에 404 를 준다"는 사실을 반영해 위치 열거가 재확장되어 왔다(마지막 확장이 바로 `6-config.md §A`). `modelconfig-dup-delete.md` 가 `ModelConfigService.remove()` 를 원자적 `delete`+`affected===0` 판정으로 고치면, 같은 `6-config.md` 문서의 **다른 절**(§Model Config API, `DELETE /api/model-configs/:id`)이 새로 이 계약("동시 요청 중 진 쪽은 404")을 만족하게 되는데, 이 항목의 현재 열거에는 그 위치가 없다. 형제 PR 들의 패턴을 그대로 따르면, 이 PR 의 `--impl-prep`/`--impl-done` consistency-check 가 정확히 이 gap 을 다시 잡아낼 자리다(선례: `authconfig-dup-delete.md` 의 `--impl-prep` W1~W5, `update-returning-tuple-shape.md` 의 소급 각주 다섯 곳 등, 매 PR 마다 트래커 열거를 재확장한 이력).
  - 제안: `modelconfig-dup-delete.md` 의 체크리스트("트래커 항목 해소") 실행 시, `spec-draft-nullable-notation-followups.md` 의 이 옴니버스 항목 열거에 `6-config.md §Model Config API(DELETE /api/model-configs/:id)`를 추가할 것(스스로 명시한 재열거 규칙: "집행 시 그 시점의 해소된 코드 경로를 기준으로 재열거할 것"). 문서 본문(`6-config.md`)에 캐비어트 문장을 즉시 추가할지, 아니면 형제 축들과 마찬가지로 "비차단 저우선"으로 계속 유예할지는 이 PR 이 새로 결정할 필요 없이 트래커 항목이 이미 결정해 둔 정책(각 축을 열거만 하고 실제 문서 갱신은 별도 집행 시점으로 미룸)을 그대로 따르면 된다 — 다만 **열거 자체**는 누락하면 트래커가 실제보다 좁은 그림을 준다.

- **[INFO]** `5-system/8-embedding-pipeline.md` 의 `pending_plans` 는 같은 `model-config.service.ts` 를 지목하지만 무관한 축이다
  - target 위치: `spec/5-system/8-embedding-pipeline.md` frontmatter (`code: codebase/backend/src/modules/model-config/model-config.service.ts` 포함, `pending_plans: plan/in-progress/update-returning-tuple-shape.md`) — 본 체크의 target 번들(spec/2-navigation)에는 없으나, `modelconfig-dup-delete.md` 체크리스트가 "이 서비스 파일을 직접 지목하므로 손으로 읽는다"고 명시한 파일
  - 관련 plan: `plan/in-progress/update-returning-tuple-shape.md`
  - 상세: 이 in-progress plan 은 raw `.query()` 의 `UPDATE/DELETE … RETURNING` **튜플**(`[rows, rowCount]`) 오독 결함 계열을 다루며, KB 재추출/재임베딩 CAS 락 등에서 `model-config.service.ts` 와 인접한 임베딩 파이프라인 코드를 건드린다. 그러나 이 plan 은 스스로 "QueryBuilder `.execute()`(반환 `UpdateResult{raw, affected}`)는 `.query()` 만 보는 이 가드에 구조적으로 안 걸린다"고 명시해, Repository `.delete()` 의 `DeleteResult.affected` 경로(이번 modelconfig-dup-delete 수정이 쓰는 바로 그 API)는 이 plan 의 결함 클래스와 **구조적으로 무관**함을 이미 확인해 뒀다. 따라서 두 plan 이 같은 서비스 파일 근처를 만지지만 겹치는 코드 경로는 없다.
  - 제안: 조치 불요 — 다만 `model-config.service.ts` 를 손으로 읽을 때 두 결함 클래스(raw 튜플 오독 vs 무락 `remove()`)를 혼동하지 않도록, 이번 PR 의 실측 기록에 "이 fix 는 Repository API(`DeleteResult.affected`)를 쓰며 `update-returning-tuple-shape.md` 의 raw `.query()` 튜플 문제와 무관"이라는 한 줄을 남기면 향후 재확인 비용이 준다.

## 요약

`modelconfig-dup-delete.md` 는 spec 변경 없이(`spec_impact: none`) 형제 일곱 자리와 동일한 무락 `remove()` → 원자적 `delete()+affected` 패턴을 따르는 순수 코드 수정이며, target(`spec/2-navigation`)이 plan 의 미해결 결정을 침해하거나 이 plan 의 선행 조건이 막혀 있는 지점은 발견되지 않았다(같은 결함 클래스를 이중 추적하던 `spec-sync-auth-gaps.md:215` 는 이미 소유권을 이 트래커로 명시적으로 이관해 뒀다). 유일한 실질적 gap 은 이 fix 가 착지하면 `6-config.md` 의 Model Config DELETE 엔드포인트가 새로 "동시 삭제 → 두 번째 404" 계약을 만족하게 되는데, 그 사실이 옴니버스 spec-doc-gap 트래커 항목의 위치 열거에 아직 반영될 계획이 plan 체크리스트에 명시돼 있지 않다는 점이다 — 형제 PR 다섯 건이 매번 이 열거를 재확장해 온 패턴을 따르지 않으면 트래커가 실제보다 좁은 그림을 남긴다.

## 위험도
LOW
