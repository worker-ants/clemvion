# Rationale 연속성 검토 결과

검토 범위: `spec/5-system` + 관련 Rationale 발췌 (spec/0-overview.md · spec/1-data-model.md · spec/data-flow/1-audit.md 등)
검토 기준: 구현 완료 후 검토 (--impl-done, scope=spec/5-system, diff-base=origin/main)

---

## 발견사항

### [WARNING] `auth_config` 동사 시제 불일치 — spec Rationale 미갱신

- **target 위치**: `spec/5-system/1-auth.md §4.1 "Action naming 규약"` 및 현재 구현됨 표
- **과거 결정 출처**: `spec/5-system/1-auth.md §4.1` 원문 "verb 는 도메인 관례를 따른다: audit 는 '일어난 일' 의 기록이므로 integration 은 과거분사(`created`/`updated`/`deleted`)를, execution 은 `re_run` 을 쓴다"
- **상세**: spec §4.1 의 naming 규약 설명은 integration(과거분사)과 execution(re_run)만 예시로 들며, `auth_config` 계열이 현재형(`create`/`update`/`delete`/`regenerate`/`reveal`)을 쓰는 이유를 spec Rationale 에서 설명하지 않는다. 구현 파일 `audit-action.const.ts` 의 JSDoc 에 "auth_config 은 CRUD 동사 현재형"이라고 명시돼 있으나, spec 본문에서는 "audit 는 일어난 일의 기록이므로 integration 은 과거분사"라는 원칙과 auth_config 이 왜 다른지 설명이 없다. 새 contributor 가 향후 planned action(예: `model_config.*`, `workflow.*`) 동사 시제를 결정할 때 기준이 불명확하다.
- **제안**: `spec/5-system/1-auth.md §4.1` "Action naming 규약" 단락에 auth_config 현재형 채택 이유를 한 문장 추가하거나, `spec/data-flow/1-audit.md §Rationale "Action 은 application union 으로 강제"` 항에 인라인 보강. 예: "auth_config 계열은 'reveal·regenerate' 같이 과거분사가 부자연스러운 동사가 섞여 도메인 내 일관성을 위해 현재형으로 통일한다." 코드 JSDoc 에만 근거가 있고 spec에 없는 상태를 해소.

---

### [INFO] `re_run_initiated` 레거시 row 보존 정책 — Rationale 내 양쪽 문서 표기 확인 필요

- **target 위치**: `spec/5-system/1-auth.md §4.1` 및 `spec/data-flow/1-audit.md §Rationale "Action 은 application union…"` 인용 블록
- **과거 결정 출처**: `spec/data-flow/1-audit.md §Rationale` — "과거 `re_run_initiated` … cross-audit G-02 에서 `execution.re_run` 으로 정정됐다 (신규 row 부터 적용; 기존 레거시 row 는 audit 불변 원칙상 그대로 둔다)"
- **상세**: 변경 자체는 정상적이며 Rationale 도 갱신됐다. 다만 `spec/5-system/1-auth.md §4.1` 의 action naming 규약 텍스트는 `execution.re_run` 의 이름만 명시하고, 과거 DB에 `re_run_initiated` 로 적재된 row 가 존재함을 언급하지 않는다. 쿼리 작성 시 OR 조건 필요성을 1-auth.md §4.1 에서는 알 수 없다. data-flow Rationale 에는 명시돼 있어 SoT 불일치는 아니지만, 1-auth.md 를 주로 보는 독자에게 cross-reference 부재.
- **제안**: `spec/5-system/1-auth.md §4.1` "현재 구현된 액션" 표 `execution.re_run` 행에 footnote 또는 note 를 추가해 "레거시 row 조회 시 `re_run_initiated` OR 조건 필요 — 상세는 data-flow/1-audit.md §Rationale" 라고 링크 보강. 필수 수정 아님 — INFO 수준.

---

### [INFO] `auth_config.reveal` 구현됨 목록 진입 근거 — Rationale 언급 없음

- **target 위치**: `spec/5-system/1-auth.md §4.1` "현재 구현된 액션" 표 설정 행 (`auth_config.create`, ..., `auth_config.reveal`)
- **과거 결정 출처**: 이전 버전(commit d1cf5cdc 직전)의 §4.1 에서 `auth_config.reveal` 은 "구현됨" 에, `create/update/delete/regenerate` 는 "Planned" 에 분리돼 있었다.
- **상세**: commit ededbd9d 에서 4종을 구현됨으로 이동하면서 reveal 과 같은 행(`설정 | auth_config.create … auth_config.reveal`)에 병합됐다. 이 이동 자체는 정당한 구현 반영이며 Rationale 갱신이 필요한 "결정 번복"은 아니다. 그러나 reveal 이 먼저 구현됐고 나머지 4종이 나중에 합류하는 순서에 대한 설명이 spec 본문에 없어, 열거 순서가 구현 순서가 아닌 논리 그룹임을 알기 어렵다. 실제 운영에 영향 없음.
- **제안**: 선택적 개선 — §4.1 표 밑에 "(순서는 구현 시점과 무관하며 resource 도메인 기준)" 같은 짧은 note 추가. 필수 아님.

---

### [INFO] Graph RAG Rationale — "mode 3개 불필요" 기각 대안 표기 적절

- **target 위치**: `spec/5-system/10-graph-rag.md §Rationale "Graph RAG 기획 결정"` 결정 근거 #2
- **과거 결정 출처**: 동일 Rationale — "mode 2종: graph 안에 vector seed 가 이미 포함된 Hybrid 형태라 mode 3개로 쪼갤 가치 작음"
- **상세**: 현재 spec 본문 §2.1 에서 `rag_mode = 'vector'` / `rag_mode = 'graph'` 두 모드를 그대로 유지하며 Hybrid 를 별도 mode 로 분리하지 않았다. Rationale 의 기각 대안(mode 3개)과 본문 설계가 일치한다. 추가 이슈 없음.
- **제안**: 없음. 정합 확인.

---

### [INFO] MCP `stdio` 미지원 — Rationale 기각 근거 유지 확인

- **target 위치**: `spec/5-system/11-mcp-client.md §2.2 stdio 미지원 사유`
- **과거 결정 출처**: 동일 spec §2.2 Rationale — "멀티테넌트 백엔드에서 사용자별 subprocess spawn 비용·보안 격리 부담, 임의 명령 실행 권한 노출 위험"
- **상세**: 현재 spec 본문에서 `stdio` 를 지원하는 transport 가 도입된 흔적 없음. Rationale 의 기각 근거와 본문 설계가 일치한다. `Internal Bridge (§2.3)` 는 외부 MCP server 없이 in-process 로 동작하는 별개 경로이며 stdio 재도입이 아니다.
- **제안**: 없음. 정합 확인.

---

## 요약

`spec/5-system` 영역 전체에서 Rationale 의 기각 대안이 재도입되거나 합의된 invariant 가 직접 위반된 사례는 발견되지 않았다. 유일한 실질적 발견은 `auth_config` 동사 시제(현재형 vs 과거분사) 불일치에 대한 spec Rationale 미갱신(WARNING) 으로, 코드 JSDoc 에는 근거가 기록돼 있으나 spec 본문 Rationale 에는 누락되어 있다. `re_run_initiated` → `execution.re_run` 개명은 data-flow Rationale 에 정확히 기록됐으나 1-auth.md 에 cross-reference 가 없어 독자 친화도가 낮다(INFO). 나머지 결정들(Graph RAG mode 2종·MCP stdio 미지원·WebAuthn suspend 대신 삭제·production fail-closed 가드 응집 등)은 모두 기존 Rationale 와 정합하며 번복 없이 유지되고 있다.

## 위험도

LOW
