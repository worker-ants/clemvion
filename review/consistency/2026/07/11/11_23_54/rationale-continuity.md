# Rationale 연속성 검토 — LlmUsageLog §2.16.1 → §2.24 재배치

> 검토 대상: `spec/1-data-model.md`(§2.16.1 삭제·§2.24 신설·ERD 각주·§2.16 정합각주) +
> `spec/data-flow/7-llm-usage.md:133`(역참조 앵커 갱신).
> **주의**: 지시받은 `origin/main (1682777fe)` 대신 `git diff origin/main`으로 바로 비교하면
> 이후 병합된 무관 커밋(`c96a61825` #910, `spec/5-system/4-execution-engine.md` 8줄 추가분)이
> 섞여 잘못된 "기각된 대안 삭제"로 오인될 수 있었다 — `git diff 1682777fe -- spec/`(pinned base)로
> 재확인해 대상은 정확히 `spec/1-data-model.md` + `spec/data-flow/7-llm-usage.md` 2파일뿐임을 확정했다.

## 검증 절차 요약

1. `codebase/backend/migrations/V014__llm_usage_logs.sql` 확인: `workspace_id ... ON DELETE CASCADE`,
   `llm_config_id ... ON DELETE SET NULL`. target 의 소유권 주장과 정확히 일치.
2. `spec/1-data-model.md:320` `IntegrationUsageLog.integration_id | FK → Integration (CASCADE)` 확인,
   §2.10.1 이 그 CASCADE 부모(§2.10 Integration) 의 자식 번호로 놓여 있음을 확인.
3. `plan/complete/spec-llm-usage-adjacent-docs.md`(#906 의 원 plan, A3 절)를 읽고 #906 이 실제로
   "자매 로그 IntegrationUsageLog(§2.10.1) 와 동형" 이라는 analogy 를 §2.16.1 배치 근거로 명시했음을 확인.
4. `git diff 1682777fe -- spec/1-data-model.md` 로 #906 이 신설했던 구 `### 2.16.1 LlmUsageLog` 원문을
   확인 — 그 문단 자체가 "CASCADE 소유 부모는 **Workspace**(`workspace_id`)이며 ... `llm_config_id`
   는 ... `ON DELETE SET NULL`" 이라고 **명시**하고 있었음(즉 자신이 인용한 analogy 의 소유 기준을
   스스로 어기는 배치였음을 원문에서 직접 확인).
5. `plan/complete/*.md` grep: `rag-rerank-impl.md:12`, `rag-rerank-followup-v2.md:14`,
   `spec-draft-rag-reranking.md:190`, `unified-model-management.md:125,132` 등 다수가 `§2.16.1` 을
   (unified-model-management 이전) **RerankConfig** 의미로 서술/링크하고 있음을 확인. 해당 섹션은
   `spec-draft-unified-model-management.md:87` "### §2.16.1 (삭제) RerankConfig" 로 이미 폐기된
   번호였다 — #906 이 그 빈 번호를 재사용하면서 "조용히 틀린 링크" 리스크를 만들었다.
6. `spec/1-data-model.md` 전체 섹션 목록(§2.1~§2.24) 대조: Workspace(§2.2) 소유 다른 1:N 엔티티들
   (ModelConfig §2.16, AuthConfig §2.17, AuditLog §2.18, Notification §2.19, AgentMemory §2.23)은
   모두 top-level 번호이며 어떤 하위 섹션에도 종속되지 않음 — target 의 §2.24 배치가 이 기존 패턴과
   일치.
   (참고: §2.18.1/§2.18.2 RefreshToken·LoginHistory, §2.21.1 SecretStore 는 CASCADE FK 상 실제로는
   User/Workspace 소유이면서도 주제 인접성만으로 하위 번호를 쓴 예외 사례라, "X.Y.Z = X.Y 가 CASCADE
   로 소유"가 문서 전체의 절대 불변식은 아니다. 그러나 **#906 이 스스로 인용한 analogy(§2.10.1)는
   정확히 이 CASCADE 패턴 사례**였으므로, #906 이 그 analogy 를 인용하고도 다른 소유 관계(Workspace)를
   ModelConfig 자식 번호에 배치한 것은 자기모순이다.)

## 발견사항

- **[INFO] target 은 #906 자신의 내부 모순을 정정한 것 — 근거 있는 번복**
  - target 위치: `spec/1-data-model.md:608`(§2.16 말미 정합 각주), `spec/1-data-model.md:826-832`
    (§2.24 신설 + "넘버링 주의" 블록쿼트), `spec/data-flow/7-llm-usage.md:133`(역참조 앵커)
  - 과거 결정 출처: `cbc07955a`(#906) 이 신설한 구 `spec/1-data-model.md ### 2.16.1 LlmUsageLog` 본문
    (`git diff 1682777fe` 의 삭제분으로 확인) — "CASCADE 소유 부모는 **Workspace**(`workspace_id`)이며
    ... `llm_config_id` 는 ... `SET NULL`" 이라고 명시하면서도 그 섹션 자체를 §2.16 ModelConfig 의 자식
    번호(§2.16.1)로 배치했다. 그 배치 근거는 `plan/complete/spec-llm-usage-adjacent-docs.md:59-61`
    ("§2.10.1 IntegrationUsageLog 와 동형")의 analogy 였는데, IntegrationUsageLog 는 실제로
    `integration_id`가 Integration 에 대한 CASCADE FK 라(`spec/1-data-model.md:320`) 그 부모 섹션의
    자식으로 놓인 것이었다. 즉 #906 은 자신이 인용한 analogy 의 소유-기준을 자신의 배치에 적용하지
    않는 자기모순을 범했다.
  - 상세: target 은 이 모순을 (a) top-level `§2.24` 재배치, (b) "CASCADE 소유 부모가 ModelConfig 가
    아닌 Workspace" 라는 명시적 재확인, (c) 구 `§2.16.1`(RerankConfig, `unified-model-management`
    시절 삭제됨 — `plan/complete/spec-draft-unified-model-management.md:87`)의 번호 재사용으로 인한
    `plan/complete/*` 히스토리 문서와의 "조용히 틀린 링크" 리스크까지 각주로 명시해 해소했다. 세
    근거 모두 독립 검증(마이그레이션 DDL·기존 섹션 넘버링 패턴·plan 히스토리 grep) 결과와 일치한다.
    이는 "기각된 대안의 재도입"도 "무근거 번복"도 아니며, 오히려 **새 Rationale(넘버링 주의 각주)을
    동반한 정당한 정정**이다(본 검토 기준 3의 반대 사례 — 새 근거가 명시돼 있어 위반 아님).
  - 제안: 조치 불요. 다만 커밋 메시지나 PR 설명에 "#906 §2.16.1 배치가 스스로 명시한 CASCADE 소유
    사실(Workspace)과 모순돼 §2.24 top-level 로 정정" 이라는 한 줄을 남겨 두면, 이 결정의 근거가
    git blame/PR 이력만으로도 추적 가능해진다(현재도 spec 본문 각주로 충분히 자기완결적이라 필수는
    아님).

- **[INFO] `plan/complete/spec-llm-usage-adjacent-docs.md` 가 옛 §2.16.1 배치를 완료 상태로 계속 서술**
  - target 위치: (target 자체는 이 파일을 건드리지 않음 — 잔여 상태 확인용 항목)
  - 과거 결정 출처: `plan/complete/spec-llm-usage-adjacent-docs.md:59-70,94` — "A3 —
    `spec/1-data-model.md` §2.16.1 LlmUsageLog (신규, full 표)" / "[x] A3 §2.16.1 LlmUsageLog full
    표 + ERD 트리 + §3 인덱스 표 + 7-llm-usage 역링크"
  - 상세: 완료된 plan 문서는 결정 시점의 append-only 스냅샷이 원칙(plan-lifecycle 관행)이라 매 후속
    spec 변경마다 소급 갱신할 의무는 없다. 다만 이 문서가 `§2.16.1` 을 "최종 anchor" 로 서술한 채
    남아 있어, 향후 이 plan 을 참고자료(analogy)로 재사용하는 사람이 다시 한번 폐기된 번호를 근거로
    삼을 위험이 있다 — 이번 사고(구 RerankConfig `§2.16.1` 번호 재사용)와 같은 유형의 반복 가능성.
    `spec-link-integrity` 가드는 `plan/` 발 링크를 검증 대상에서 명시적으로 제외하므로
    (`spec/conventions/spec-impl-evidence.md:128`) 자동 탐지도 안 된다.
  - 제안: 필수는 아니나, 해당 plan 문서 상단에 "(2026-07-11 이후 §2.24 로 재배치됨 — 현재 위치는
    `spec/1-data-model.md` 참고)" 1줄 addendum을 남기면 향후 동일 함정을 예방할 수 있다. 이번 target
    커밋을 차단할 사유는 아님.

CRITICAL/WARNING 항목 없음.

## 요약

target 의 §2.16.1 → §2.24 재배치는 과거 결정(#906, PR `cbc07955a`)의 "재기각된 대안 재도입"이나
"무근거 번복"이 아니라, #906 자신이 §2.16.1 본문에 명시했던 CASCADE 소유 사실(Workspace)과 실제
배치(§2.16 ModelConfig 의 자식 번호) 사이의 내부 모순을 바로잡는 근거 있는 정정이다.
`codebase/backend/migrations/V014__llm_usage_logs.sql` 로 `workspace_id`=CASCADE ·
`llm_config_id`=SET NULL 을 직접 확인했고, #906 이 인용한 analogy 대상인 IntegrationUsageLog(§2.10.1)
가 실제로 CASCADE 부모(Integration) 의 자식으로 놓인 사례임도 확인했다 — 즉 target 이 재적용한 원칙은
#906 이 스스로 채택했던 원칙과 동일하며, target 은 그 원칙을 올바르게 완성했을 뿐이다. 부수적으로
구 §2.16.1(RerankConfig, `unified-model-management` 시절 삭제)의 번호를 재사용해 여러
`plan/complete/*` 히스토리 문서와 충돌할 뻔한 리스크까지 명시적으로 해소했다. 남은 것은
`plan/complete/spec-llm-usage-adjacent-docs.md` 가 옛 배치를 그대로 서술하고 있다는 정보성 잔여
사항뿐이며, 이는 이번 target 의 결함이 아니다.

## 위험도

NONE

STATUS: DONE
