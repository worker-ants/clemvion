### 발견사항

- **[INFO]** target spec 의 file 검증 기술이 `impl-form-file-validation.md` 설계 결정과 일치
  - target 위치: `spec/4-nodes/6-presentation/4-form.md` §6.2 검증 지점 주석 (line 333), §Rationale (line 357–361), §1.5 (line 104–109)
  - 관련 plan: `plan/in-progress/impl-form-file-validation.md` §"설계 결정 (확정)"
  - 상세: target spec 은 file 검증(MIME/크기/개수)을 "Planned" 로 명시하고, 검증 위치는 `assertFormSubmissionValid`(execution-engine chokepoint), 검증 대상은 metadata 필드(`size`/`type`/개수), 공유 기본값(13종 MIME / 10MB / 50MB / 5개)을 기술 중이다. `impl-form-file-validation.md` 가 동일 설계를 확정 사항으로 채택하고 있어 충돌 없음. spec 의 Planned 표기는 구현 착수 전 현황을 정확히 반영.
  - 제안: 추적 정보로 기록. 구현 완료 시 spec Planned 주석을 제거하고 `spec-sync-form-gaps.md` 체크박스를 완료 처리하는 것이 이 plan 의 체크리스트(step 4)에 이미 포함돼 있으므로 별도 조치 불필요.

- **[INFO]** `spec-sync-form-gaps.md` INFO 후속 항목(`execution-engine.service.spec` min/max·pattern 통합 케이스) 미완료 상태와 target spec 관계
  - target 위치: `spec/4-nodes/6-presentation/4-form.md` §6.2 "검증 지점" 주석 (line 333)
  - 관련 plan: `plan/in-progress/spec-sync-form-gaps.md` INFO 후속 — "execution-engine.service.spec 에 min/max·pattern 위반 시 FormValidationError throw 통합 케이스 1건씩 추가" (미체크)
  - 상세: target spec 이 이 테스트 추가를 전제로 하거나 차단하지는 않는다. 비차단 INFO 후속으로 분류돼 있고, `impl-form-file-validation.md` 의 step 5~7 테스트 체크리스트(line 48)에 "execution-engine.service.spec(file 통합 + D 후속 min/max·pattern 통합 1건씩)" 가 이미 포함돼 있어, 현재 구현 PR 에서 함께 처리 예정이다. spec 본문과는 충돌 없음.
  - 제안: 현 plan 에서 자연스럽게 처리될 예정이므로 별도 조치 불필요.

- **[INFO]** `node-output-redesign/form.md` 의 잔여 개선안 중 "(impl) file 타입 필드의 size/mime/count 검증 시점 책임 경계 명시" 항목과 target spec 의 정합
  - target 위치: `spec/4-nodes/6-presentation/4-form.md` §6.2 검증 지점 주석 (line 333), §Rationale (line 357–361)
  - 관련 plan: `plan/in-progress/node-output-redesign/form.md` §"종합 개선안" 세 번째 항목 (미체크)
  - 상세: target spec 은 이미 file 검증의 책임 경계를 `assertFormSubmissionValid`(execution-engine chokepoint) 로 명시하고 있어 해당 개선안의 요구 사항을 충족했다고 볼 수 있다. spec §Rationale(line 357–361) 이 "file 검증은 execution-engine 경로 전용"을 Rationale 로 명시하므로 spec 과 impl plan 의 결정이 정합.
  - 제안: `node-output-redesign/form.md` 의 해당 항목은 spec 에 이미 반영된 것으로 볼 수 있어 추적 기록 업데이트를 고려할 수 있으나 비차단이다.

### 요약

`spec/4-nodes/6-presentation/4-form.md` 는 현재 진행 중인 plan 들(`impl-form-file-validation.md`, `spec-sync-form-gaps.md`)과 완전히 정합한다. 미해결 결정 우회 사례 없음 — file 검증 설계(위치·대상·기본값·검증 순서)는 `impl-form-file-validation.md §"설계 결정 (확정)"` 에서 명시적으로 확정됐고, target spec 은 해당 결정과 일치하는 Planned 표기 및 설계 기술을 포함하고 있다. 선행 plan 미해소 조건도 없다 — `spec-sync-form-gaps.md` 의 체크된 선행 구현(field-level 검증, min/max·pattern)이 이미 완료 상태로 기록돼 있으며 target spec 은 이를 구현된 것으로 서술하고 있다. 후속 항목 누락도 없다 — file 검증 완료 시 수반돼야 하는 spec Planned 주석 제거·체크박스 갱신·인접 spec 동기화(EIA/WS/chat-channel) 항목이 `impl-form-file-validation.md` step 4 와 step 9(impl-done 검출 시 반영) 체크리스트에 모두 포함돼 있다.

### 위험도

NONE
