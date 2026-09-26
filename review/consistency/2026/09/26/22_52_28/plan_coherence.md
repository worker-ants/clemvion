# Plan 정합성 검토 — spec/2-navigation/ (--impl-prep, export-workflow-typed)

## 발견사항

- **[INFO]** 프런트엔드 `ExportedNode.description?: string` 의 nullable 미표기가 트래커에 등재되지 않음
  - target 위치: `plan/in-progress/export-workflow-typed.md` §"관찰 (이 PR 밖)" — `codebase/frontend/src/lib/api/workflows.ts` 의 `ExportedNode.description?: string`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (nullable 표기 불일치를 전담 수집하는 바로 그 트래커)
  - 상세: 이 plan 은 백엔드 `ExportedNodeDto.description` 을 `nullable: true` 로 정확히 선언하면서, 프런트엔드 대응 타입이 실제로 오는 `null` 을 반영하지 않는다는 사실을 스스로 관찰·기록했다. 동작 결함은 아니라고 명시했지만(소비처가 falsy 로만 다룸), 이 관찰이 향후 추적될 자리가 plan 안에도 트래커 안에도 없다 — "이 PR 밖" 이라고만 적혀 있어 다음 세션이 이 사실을 재발견해야 한다.
  - 제안: `spec-draft-nullable-notation-followups.md` 에 신규 항목으로 등재(마무리 커밋 단계, canvas-save-typed 선례가 "조사 중 발견한 항목을 트래커에 새로 등재" 한 것과 동일 패턴). 차단 사유는 아니므로 `--impl-prep` 진행에는 영향 없음.

- **[INFO]** `GET /api/triggers/:id/history` 형태·상한 미표기는 스코프 밖 — 재등재 불필요
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표
  - 관련 plan: `spec-draft-nullable-notation-followups.md` (이미 등재됨, "`GET /api/triggers/:id/history` 행이 형태·상한을 적지 않는다")
  - 상세: `spec/2-navigation/` 디렉터리 전체를 스코프로 잡는 `--impl-prep` 번들 특성상 이 plan 과 무관한 트리거 문서의 기존 갭이 함께 딸려 들어온다. 직전 동일 패턴 plan `canvas-save-typed` 의 `--impl-prep`(`review/consistency/2026/09/26/21_38_44`)이 이미 같은 결론(무관·트래커 기존 등재)을 냈다.
  - 제안: 조치 불요. 재등재하지 말 것.

## 요약

`export-workflow-typed.md` 는 트래커 `spec-draft-nullable-notation-followups.md` 가 명시적으로 "선행" 으로 남겨둔 미해결 결정(export 응답에 import 요청 DTO 를 재사용할지 vs 응답 전용 DTO 를 신설할지)을 실측(키 존재성·nullable·enum 범위 대조)으로 정확히 그 트래커가 요구한 절차대로 해소한다 — 미해결 결정을 우회하거나 일방적으로 덮어쓰는 사례가 아니라 결정 그 자체를 이행하는 사례다. `spec_impact: none` 은 대상 spec(`1-workflow-list.md` §3.2)이 이미 원소 타입을 규정하지 않고 SoT 를 DTO 파일로 넘겨둔 서술과 정합하며, 직전 완료 plan `canvas-save-typed` 가 세운 동일 패턴(응답 전용 DTO·`allowMissing`·선언 캐너리·트래커 항목 갱신)을 그대로 계승한다. `marketplace-and-plugin-sdk.md` 가 미래에 export/import 흐름을 재사용할 계획이 있으나 이 PR 은 wire 포맷을 바꾸지 않고 선언만 정교화하므로 그 계획과 충돌하지 않는다. 유일한 남은 항목은 이 plan 이 스스로 관찰한 프런트엔드 타입 갭을 트래커에 아직 등재하지 않은 절차적 누락(INFO)이며, 차단 사유는 아니다.

## 위험도
NONE
