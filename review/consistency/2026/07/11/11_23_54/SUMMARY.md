# Consistency Check SUMMARY — `--spec` (LlmUsageLog §2.16.1 → §2.24 재배치)

- **일시**: 2026-07-11 11:23:54
- **모드**: `--spec` (project-planner spec 쓰기 직전 의무)
- **base**: `origin/main` @ `1682777fe` (#908) — 검토 중 `c96a61825`(#910)로 전진
- **checker**: 3종 focused (rationale-continuity · cross-spec · naming-collision) — 순수 relocation 이라 convention/plan 은 near-vacuous 로 제외

## BLOCK: NO

Critical 0 · Warning 0 · 조치 필요 Info 0. **세 checker 모두 위험도 NONE.**

| checker | Critical | Warning | Info |
| --- | --- | --- | --- |
| rationale-continuity | 0 | 0 | 2 (조치 불요) |
| cross-spec | 0 | 0 | 0 |
| naming-collision | 0 | 0 | 0 |

## 변경 내용

merged PR #906 이 `LlmUsageLog` 데이터모델 서브섹션을 `§2.16.1`(§2.16 ModelConfig 의 자식)에 뒀는데,
이를 top-level **`§2.24`**(§2.23 AgentMemory 뒤)로 **재배치**한다. 필드 표 내용은 무변경 — 위치·번호·
넘버링 주의 노트만. `spec/data-flow/7-llm-usage.md:133` 앵커도 `#2161-llmusagelog` → `#224-llmusagelog`.

## 이 변경이 #906 결정의 부당한 번복이 아님 (rationale-continuity 검증)

- #906 은 §2.10.1 IntegrationUsageLog 와의 analogy 로 §2.16.1 을 정당화했으나, **analogy 가 잘못 적용됐다**:
  IntegrationUsageLog §2.10.1 이 §2.10 Integration 의 자식인 이유는 `integration_id` 가 Integration 에 대한
  **CASCADE** FK 이기 때문이다. 반면 `llm_usage_log` 는 (`V014__llm_usage_logs.sql` 확인) `llm_config_id` =
  `SET NULL`, `workspace_id` = **CASCADE** — 즉 소유 부모는 Workspace 다. 같은 ownership 논리를 적용하면
  Workspace 소유 = top-level 이 맞고, ModelConfig 자식(§2.16.1)은 오적용이다.
- **#906 자신의 §2.16.1 본문**이 "CASCADE 소유 부모는 **Workspace**" 라 적어, 자기 placement 와 모순됐다.
  본 정정이 그 내부 불일치를 해소한다.
- 구 `§2.16.1` 은 `unified-model-management` 이전 **RerankConfig** 의 번호이고, `plan/complete/rag-rerank-impl.md`
  등 다수가 그 의미로 링크 중이라 재사용은 "조용히 틀린 링크" 를 만들었다. §2.24 로 이동해 해소.
→ 근거 있는 **정정**, 재litigation 아님.

## cross-spec / naming 검증

- **dangling anchor 0**: `#2161-llmusagelog` 로의 살아있는 spec 링크 전무(grep), 유일 소비처 `7-llm-usage.md:133`
  갱신 확인. 신 앵커 `#224-llmusagelog` 는 `1-data-model.md` 내 유일 매칭.
- **필드 표 무손실**: 신/구 섹션 14행 + 인덱스 3종 byte 동일 — `V014`/`V018` 마이그레이션·entity 와 완전 일치.
- **§2.16 well-formed**: 자식 제거 후 `#### Rationale (ModelConfig 통합)` → 신설 포인터 → `### 2.17 AuthConfig`
  헤딩 계층 정상. `§2.24` 는 §2.23 뒤 미사용 번호.
- **신규 요구사항 ID/엔티티/API 0** (순수 relocation).

## Info (조치 불요)

- `plan/complete/*`(rag-rerank-impl.md 등 6건) + `plan/complete/resume-llm-usage-attribution.md:70`(#910 이 이동)이
  아직 텍스트로 `§2.16.1` 을 참조하나, **완료·역사적 서술**이고 링크는 파일(앵커 없음)을 가리켜 non-blocking.
  신설 §2.24 의 "넘버링 주의" 노트가 이 배경을 스스로 설명한다.

## 재검증

frontend doc guard(spec-link-integrity·spec-frontmatter·spec-area-index) 3 suites / 553 tests 통과 —
`#224-llmusagelog` 앵커 해소·헤딩 구조 정상 확인. 코드 변경 0.

## 결론

BLOCK: NO. 사운드한 정정, 위험도 NONE.
