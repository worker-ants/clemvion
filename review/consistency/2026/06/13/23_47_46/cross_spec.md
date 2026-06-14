# Cross-Spec 일관성 검토 결과

대상 draft: `spec-sync-s-batch-draft` (변경 1~3 + 부수 I3)
검토 기준 문서: `spec/data-flow/7-llm-usage.md`, `spec/conventions/interaction-type-registry.md`, `spec/data-flow/15-external-interaction.md`

---

## 발견사항

### [INFO] 변경 3 — SSE single-instance Rationale 가 EIA §R10 과 내용 중복
- target 위치: `spec/data-flow/15-external-interaction.md` Rationale 신설 블록 (SSE 버퍼 single-instance 한정 이유와 이관 방향)
- 충돌 대상: `spec/5-system/14-external-interaction-api.md §R10` ("R10. WebsocketService 단일 sink 정책의 확장", lines 947–948) 및 `§R3` (SSE 채택 vs WebSocket 외부용 신설)
- 상세: EIA spec §R10 은 이미 SSE 어댑터가 현재 in-process(in-memory) 직접 구독이고 Redis pub/sub 경유 구독은 미구현(Planned)임을 명기하며, "코드 주석 'v1 은 single-instance in-memory — 분산 SSE fan-out 은 follow-up'" 을 인용한다. draft 가 data-flow Rationale 에 추가하려는 지연/신뢰성 트레이드오프·단일 엔트리포인트 가정·다중 인스턴스 잔여 위험·Redis Pub/Sub 이관 방향은 모두 EIA §R10 에서 이미 설명된 동일 사안의 data-flow 관점 재서술이다. 두 문서가 충돌하지는 않으나 **근거 서술이 두 파일에 분산**되어 단일 진실 원칙 관점에서 이중 기재 우려가 있다.
- 제안: 신설 블록에 "상세 근거는 [Spec EIA §R10](../5-system/14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장)" 를 명시적으로 cross-ref 해 data-flow 문서가 EIA Rationale 의 파생 요약임을 표시하거나, 블록 내용을 "v1 은 single-instance — 분산 fan-out 은 follow-up (§R10)" 수준으로 축약해 이중 기재 면적을 최소화한다. 어느 쪽이든 모순은 아니므로 INFO 등급.

### [INFO] 부수 I3 — JSDoc `§6.2(중첩 재개)` 표현의 오해 가능성 (코드 주석 정합)
- target 위치: `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` line 24 JSDoc
- 충돌 대상: `spec/5-system/4-execution-engine.md §6.2` ("6.2 저장 전략") 및 `§7.5` ("7.5 Resume after Restart (rehydration)")
- 상세: 현재 JSDoc 은 `spec: 5-system/4-execution-engine.md §7.5(rehydration) · §6.2(중첩 재개)` 로 기재돼 있다. 실제로 §6.2 는 "저장 전략" (영속화 정책) 이고 "중첩 재개" 는 §7.5 의 하위 내용(`driveCallStackResume`/`driveResumeFrame` — exec-park D6)이다. 따라서 `§6.2(중첩 재개)` 표기는 §7.5 내용을 §6.2 에 귀속시키는 오인을 유발한다. draft 가 이를 `§7.5(rehydration · 중첩 sub-workflow 재개) · §6.2(영속화 정책)` 로 교정하는 것은 기존 spec 명칭과 정확히 일치한다. 동작 불변 코드 주석 정합이므로 INFO 등급.
- 제안: draft 교정안 그대로 적용. 추가로 execution engine spec §7.5 의 "Rationale 1336" 주석(`#507 추출` 참고)도 동일 파일(resume-turn-dispatch.ts)을 SoT 로 언급하고 있어 정합 완료.

---

## 모순·충돌 없음 확인 (검토 통과 항목)

1. **변경 1 — `spec/data-flow/7-llm-usage.md §1.3` attribution 갭 note 압축**
   - §1.3 본문의 attribution 갭 note 와 Rationale "llm_usage_log 의 nullable context 컬럼들" 간 중복 압축. 갭이 해소됐다고 주장하지 않으며 결정 대기 상태를 보존한다는 점이 명시돼 있다.
   - `spec/1-data-model.md §2.* llm_usage_log` 컬럼 정의 (`workflow_id?`, `execution_id?`, `node_execution_id?` nullable), `spec/data-flow/7-llm-usage.md §2.1` schema 매핑과 충돌 없음.
   - Statistics/Alerts downstream 의존 기술(§4)과 모순 없음.

2. **변경 2 — `spec/conventions/interaction-type-registry.md` §1.2 재개 turn 라우팅 진입점 등재**
   - WaitingInteractionType 4값(form/buttons/ai_conversation/ai_form_render) 불변 — enum 값 추가 아님.
   - 매트릭스에 "재개(resume) turn 라우팅 진입점" note 추가 및 frontmatter `code:` 에 `resume-turn-dispatch.ts` 추가.
   - `spec/5-system/4-execution-engine.md §7.5` / Rationale 1336의 `dispatchResumeTurn(ordered resumeTurnRegistry, resume-turn-dispatch.ts)` 서술과 정합.
   - interaction-type-registry.md §1.2 의 기존 "Backend emit 위치" 열은 *최초 waiting 진입* 기준이라는 주석과, draft 가 추가하는 *재개(resume)* 기준 note 는 관점이 명확히 분리돼 모순 없음.
   - EIA §6.2 페이로드 (4→3 통합 매핑) 및 exhaustiveness test 목록과 충돌 없음.

3. **변경 3 — `spec/data-flow/15-external-interaction.md` Rationale SSE single-instance 블록 신설**
   - 신규 정책 주장 아님 — 기존 §1.3 본문 + in-memory 표(L250) 의 "single-instance 한정 · 분산 fan-out 은 follow-up" 서술의 근거를 Rationale 에 명문화.
   - EIA §R10 과 동일 사안의 data-flow 관점 재서술이지만 직접 모순은 없음 (INFO 수준 중복만 존재 — 위 발견사항 참조).
   - 데이터 모델(`execution_token`, Redis 키 패턴), API 계약(SSE endpoint, 토큰 검증), 상태 전이(iext/itk/notification secret), RBAC 와 무관한 pure Rationale 추가이므로 타 영역 충돌 없음.

---

## 요약

본 draft 의 3건 변경은 모두 코드가 SoT 인 doc-sync 범위이며, 신규 엔티티·API 계약·요구사항 ID·상태 머신·RBAC 추가가 없다. 기존 spec 과의 직접 모순은 발견되지 않았다. INFO 2건은 각각 (i) EIA §R10 과의 SSE Rationale 이중 기재 우려(cross-ref 추가로 해소 권장), (ii) 코드 JSDoc 의 섹션 번호 오표기 교정(draft 교정안이 spec 현행 명칭과 정합)으로, 채택 차단 사유가 없다.

---

## 위험도

NONE
