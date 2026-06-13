# 정식 규약 준수 검토 결과

**검토 대상**: `/Users/gehrig/.claude/jobs/e80b8a6a/tmp/spec-sync-s-batch-draft.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-13

---

## 발견사항

### [INFO] draft 자체는 spec/conventions/ 적용 대상 파일 아님 — 파생 spec 3건에 대해 평가

- target 위치: draft 전체
- 위반 규약: 해당 없음
- 상세: 본 draft 는 `/Users/gehrig/.claude/jobs/` 경로의 작업용 합성 문서이며, `spec/conventions/spec-impl-evidence.md §1` 의 frontmatter 의무 대상(inclusive list: `spec/2-navigation`, `spec/3-workflow-editor`, `spec/4-nodes`, `spec/5-system`, `spec/7-channel-web-chat`, `spec/conventions/**.md`)에 속하지 않는다. 따라서 본 draft 자체에 `id`/`status`/`code:` frontmatter 미보유가 규약 위반은 아니다. 이하 평가는 draft 가 편집 대상으로 특정한 3개 spec 파일에 제안하는 변경 내용의 규약 준수 여부다.

---

### [INFO] 변경 1 — `spec/data-flow/7-llm-usage.md §1.3` attribution 갭 note 압축

- target 위치: 변경 1 (draft 36~42행)
- 위반 규약: 해당 없음
- 상세: `spec/data-flow/` 는 frontmatter 의무 대상에서 제외된 경로다 (spec-impl-evidence §1 inclusive list에 미포함). 해당 변경은 §1.3 의 attribution 갭 note를 Rationale 위임 형식으로 압축하고 Rationale 에 단일 진실을 집중시키는 것으로, 이중 서술 제거 + Rationale 역할 강화는 CLAUDE.md의 "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙과 정합된다. 현재 `spec/data-flow/7-llm-usage.md` Rationale 에 이미 "llm_usage_log 의 nullable context 컬럼들" 항이 존재하며(offset 170~ 확인), 압축 후 §1.3 note 가 Rationale 로 연결 링크를 보유하는 구조는 단일 진실 원칙에 부합한다. 갭 상태가 "여전히 결정 대기"임을 보존한다는 불변 유지 명시는 적절하다.
- 제안: 없음. 규약 준수.

---

### [INFO] 변경 2 — `spec/conventions/interaction-type-registry.md` §1.2 재개 turn 라우팅 note 추가 + frontmatter `code:` 갱신

- target 위치: 변경 2 (draft 44~48행)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2` frontmatter 스키마 / `spec/conventions/interaction-type-registry.md §1.1` 단일 진실
- 상세:
  1. **frontmatter code: 갱신 — 규약 준수**: `interaction-type-registry.md` 는 `spec/conventions/**.md` 로 frontmatter 의무 대상이다. draft 는 frontmatter `code:` 에 `resume-turn-dispatch.ts` 를 추가한다고 명시한다. 현재 interaction-type-registry.md frontmatter 에는 `resume-turn-dispatch.ts` 가 부재(실측 확인)하므로 추가는 spec-impl-evidence §2 `code:` 의무("본 spec 이 약속한 surface 의 구현 경로")와 정합된다.
  2. **§1.2 매트릭스 note 내용 — enum 신규 값 미추가, 규약 준수**: draft 는 "enum 신규 값 추가 아님 — WaitingInteractionType 4값 불변"을 명시한다. `interaction-type-registry.md §1.2 규칙 1`("표의 모든 위치를 한 PR 안에서 동시 갱신")은 enum 값 변경 시 적용되는 것으로, note 보강만이라면 이 규칙의 대상이 아니다. 적절하다.
  3. **섹션 참조 정합**: note 에 "SoT: execution-engine §7.5"를 기재하는 것은 단일 진실 원칙을 지킨다.
- 제안: 없음. 규약 준수.

---

### [INFO] 변경 3 — `spec/data-flow/15-external-interaction.md` Rationale SSE single-instance 블록 추가

- target 위치: 변경 3 (draft 50~52행)
- 위반 규약: 해당 없음
- 상세: `spec/data-flow/15-external-interaction.md` 는 frontmatter 의무 대상 외 경로다(data-flow/). Rationale 에 "SSE 버퍼 single-instance 한정 이유와 이관 방향" 블록을 신설하는 것은 CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`" 원칙에 정합된다. 현행 §1.3 본문 및 in-memory 표(L250 `SseAdapter.buffers` 행)에 "single-instance 한정" 사실이 기술돼 있고, Rationale 에 근거를 명문화하는 것은 doc-sync 범주의 정당한 변경이다. 신규 정책 추가가 아니라 근거 기록임을 draft 가 명시하므로 invariant 훼손 위험 없음.
- 제안: 없음. 규약 준수.

---

### [INFO] 부수 — `resume-turn-dispatch.ts` JSDoc 교정 (I3)

- target 위치: draft 54~56행
- 위반 규약: 해당 없음
- 상세: 코드 주석 내 섹션 레이블(`§6.2` → `§7.5`) 교정은 spec 규약 영역 밖 사안이다. 동작 불변, spec 구조 변경 없음.
- 제안: 없음.

---

### [WARNING] draft frontmatter 의 `id:` — 운영용 합성 문서 식별자 혼동 가능성

- target 위치: draft 2행 `id: spec-sync-s-batch-draft`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `id` 는 "spec 식별자, 파일 basename 기반 권장"
- 상세: 본 draft 의 frontmatter `id: spec-sync-s-batch-draft` 는 spec 문서 식별자처럼 보이나, 파일 자체가 `/Users/gehrig/.claude/jobs/` 경로의 작업용 합성 문서이며 spec 파일이 아니다. `status: draft` 값은 spec-impl-evidence §3 라이프사이클 enum 에 없는 비표준 값이다(표준 5값: `implemented`, `partial`, `planned`, `deprecated`, `archived`). 다만 이 문서는 `spec/` 경로에 저장되지 않으므로 실제 frontmatter 가드 검사 대상이 아니며, orchestrator 가 작업용 내부 포맷으로 쓴 것으로 보인다. 규약 위반은 아니나, 향후 동일 패턴 draft 가 실수로 `spec/` 에 놓일 경우 가드 fail 위험이 있다.
- 제안: 작업용 합성 draft 에는 `spec-impl-evidence` frontmatter 스키마를 사용하지 않거나, `status: draft` 대신 plan frontmatter 스키마(`.claude/docs/plan-lifecycle.md`)를 사용하도록 orchestrator 패턴 정비 권장. 당장의 위반은 아님.

---

## 요약

target draft 가 편집 대상으로 제안하는 3개 spec 파일 변경(`spec/data-flow/7-llm-usage.md §1.3`, `spec/conventions/interaction-type-registry.md §1.2+frontmatter`, `spec/data-flow/15-external-interaction.md Rationale`) 은 모두 정식 규약 위반 없이 채택 가능하다. 변경 1·3은 CLAUDE.md 단일 진실 원칙(Rationale 에 근거 집중)과 정합되며, 변경 2는 spec-impl-evidence §2 frontmatter 의무 및 interaction-type-registry 규칙과 정합된다. enum 불변 유지 명시도 §1.2 규칙 1과 충돌하지 않는다. 부수 I3(JSDoc 교정)는 규약 영역 외 사안이다. WARNING 1건은 draft 자체의 frontmatter 패턴이 spec 라이프사이클 스키마와 어긋난다는 메타 수준 지적으로, 운영 영향은 없다.

## 위험도

LOW
