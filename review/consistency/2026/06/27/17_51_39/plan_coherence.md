# Plan 정합성 검토 결과

> 검토 모드: --impl-done  
> Target 범위: `spec/5-system/`  
> 검토 일시: 2026-06-27

---

## 발견사항

### **[WARNING] security-backlog-invitation-token-hash.md — 미해결 결정이 target spec 에서 일방 답변**

- **target 위치**: `spec/5-system/1-auth.md §Rationale 1.5.D` — "워크스페이스 초대 토큰을 raw 로 저장하는 이유 (vs 이메일·재설정 토큰의 SHA-256 해시)"
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/security-backlog-invitation-token-hash.md` 작업 범위 항목 1 (unchecked)
- **상세**: 
  - plan 의 작업 #1 은 "`spec/5-system/1-auth.md §1.5.D` Rationale 검토 — 해시 저장 전환 결정 여부 명시" (체크 미완료). plan 주의사항에는 "기존 미만료 토큰 처리 전략 확정 없이 자동 수정 금지 (사용자 결정 필요)" 가 명시.
  - target spec §1.5.D 는 이미 전체 Rationale 로 작성되어 있고, 결론이 "해시 전환의 보안 이득이 위협 모델 대비 작아 **raw 저장을 유지한다**" 로 확정되어 있다.
  - plan 의 작업 #2~#4 (SHA-256 해시 저장 구현 · lookup 수정 · 마이그레이션 · 테스트 갱신) 은 spec 이 "해시 전환 안 함" 을 결정했으므로 모두 N/A 가 된다.
  - spec 이 언제 §1.5.D 를 작성했는지에 따라, plan 이 열린 결정으로 분류한 사안을 spec 이 plan 갱신 없이 답변한 상황이 된다.
- **제안**: 
  - plan 의 작업 #1 을 ✅ 처리하고 결정 내용("keep raw, Rationale §1.5.D 에 확정") 을 기록.
  - 작업 #2~#4 는 "N/A — spec 이 raw 저장 유지 결정" 으로 취소 처리.
  - plan 을 `plan/complete/` 로 이동하거나 frontmatter 상태를 갱신해야 한다.
  - target spec 자체는 변경 불요 (내용이 충실하고 일관됨).

---

### **[INFO] rag-rerank-followup.md — model-config 통합으로 체크된 항목이 사실상 대체됨**

- **target 위치**: `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 (Model Config 행), `spec/5-system/1-auth.md §4.1` Planned 감사 액션 (`model_config.*`)
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/rag-rerank-followup.md` — "Rerank Config RBAC 행 추가" (✅ 체크) / "§4.1 감사 로그에 `rerank_config.create/update/delete` 추가" (✅ 체크)
- **상세**: 
  - plan 이 추가한 `Rerank Config | CRUD | CRUD | R | R` 행은 target spec §3.2 에 존재하지 않는다. 현재 spec 은 `Model Config | CRUD | CRUD | CRUD | R` 만 있으며, 이는 rerank/llm/embedding config 통합 결과다.
  - plan 이 추가한 `rerank_config.create/update/delete` 감사 액션은 target spec §4.1 에서 `model_config.*` 로 통합 흡수됐다. spec 주석에 "통합 이전 `llm_config.*`/`rerank_config.*` 로 적재된 row 는 보존" 이라고 명기돼 있다.
  - plan 의 체크 항목은 작성 당시 기준으로는 완료였으나, 이후 model-config 통합(mc-cfg-polish 계열) 이 해당 행/액션을 대체했다.
  - 또한 RBAC 권한 수준도 달라졌다: plan 의 Editor=R(읽기만) vs 현재 spec 의 Editor=CRUD. 이 차이는 deliberate 설계 변경(`§3.2` 주석: "Model Config 는 워크플로우 구축의 일부로 Editor 가 직접 관리") 이지만, plan 이 이를 반영하지 않았다.
- **제안**: 
  - plan 의 해당 체크 항목에 "model-config 통합으로 대체됨 — `Model Config | CRUD | CRUD | CRUD | R` + `model_config.*` 감사" 노트 추가.
  - plan 을 `plan/complete/` 로 이동 검토 (나머지 항목도 전부 ✅ 체크 완료 상태).
  - target spec 자체는 변경 불요 (내용 정합).

---

### **[INFO] refactor/02-architecture.md C-2 cluster 4 spec-sync — 오늘 완료, target spec 과 정합**

- **target 위치**: `spec/5-system/7-llm-client.md §8` Rationale (L443, L476) — forwardRef 해소 내용
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/02-architecture.md` C-2 항목 4 (✅ 완료 표기)
- **상세**: 
  - plan C-2 cluster 4 (llm↔model-config forwardRef 순환 해소) 의 spec-sync 가 2026-06-27 완료 표기됨. target spec `7-llm-client.md §8` 의 L443·L476 Rationale 에 "forwardRef 순환 해소 (refactor-02 C-2 cluster 4; 엔드포인트 재배치 + observer 역전, 양측 forwardRef 제거)" 내용이 반영되어 있다.
  - plan 과 target spec 이 정합. 별도 조치 불요.

---

### **[INFO] spec-sync-structural-followups.md — spec/5-system/14 console.warn 처방 stale**

- **target 위치**: `spec/5-system/14-external-interaction-api.md` (≈L1108) — "HTTP 오류 시 console.warn 후 진행" 처방
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-structural-followups.md` §C console.warn 처방 정정 항목 (unchecked)
- **상세**: 
  - plan 은 `spec/5-system/14-external-interaction-api.md` 의 `console.warn(...)` 처방이 코드의 `logger.warn(...)` 전환 후 stale 가 됐다고 추적 중.
  - 이 항목은 현 target 범위(`spec/5-system/`)의 문서 중 하나에 해당하지만, 본 impl-done 검토의 대상 변경사항과 직교하는 기존 드리프트다. 본 target 변경이 이 드리프트를 악화시키거나 해소하지 않는다.
  - 별도 planner 후속 트랙에서 처리 예정이므로 INFO 로 분류.

---

## 요약

`spec/5-system/` 의 현재 내용은 전반적으로 진행 중 plan 들의 결정 방향과 정합하지만, `security-backlog-invitation-token-hash.md` 에서 WARNING 이 발견된다: 해당 plan 이 "사용자 결정 필요"로 열어둔 초대 토큰 해시 저장 전환 여부를 target spec §1.5.D 가 이미 "raw 유지"로 확정했음에도 plan 이 갱신되지 않았다. plan 을 닫거나 작업 항목을 "완료/N/A"로 처리해야 하며, spec 변경은 불요하다. `rag-rerank-followup.md` 는 model-config 통합으로 체크 항목이 사실상 대체됐으나 미완료 사항이 없고 plan 자체 완료 처리로 정리 가능하다. 그 외 주요 충돌·선행 미해소 항목은 없다.

## 위험도

LOW
