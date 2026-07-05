# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-cross-audit-doc-batch.md`
검토 초점: 직전 라운드 WARNING 2건 재검증 — (1) V-13 하향 변경 3b(canvas.md §5.3 미러), (2) dry-run §7.4/§9.2 동반 갱신(변경 6b)

## 발견사항

- **[WARNING]** V-13 변경 3b 가 canvas.md §5.3 내 두 번째 stale 미러(§5.3.4 표)를 놓쳐 동일 절 안에서 불일치 재생산
  - target 위치: `plan/in-progress/spec-draft-cross-audit-doc-batch.md` "변경 3b" 항목 (V-13 섹션)
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md §5.3.1`(시각 예시, line 306) 및 §5.3.4(노드별 요약 포맷 표, line 398) — 두 곳 모두 AI Agent 캔버스 요약이 `summaryTemplate` 로 렌더된다는 전제(`0-common.md §8` 인용, line 381: "포맷 SoT 는 각 노드 spec 의 `summaryTemplate`") 를 공유
  - 상세: draft 변경 3b 는 "`(gpt-4o · 2 tools · 1 KB, line 306)`" 만 특정해 `· 2 tools` 세그먼트 삭제 + Planned 주석을 추가하겠다고 명시했다. 그러나 실제 파일을 확인하면 같은 §5.3 절 안, §5.3.4 "노드별 요약 포맷" 표(line 398)에도 `AI Agent | {모델} · {N} tools · {N} KB | gpt-4o · 2 tools · 1 KB` 행이 동일하게 존재한다. 이 표는 "각 노드 유형의 요약 포맷은 해당 노드 스펙 문서에 캔버스 요약 항목으로 정의" (line 381) 라는 서술과 직결되는 SoT 미러 표인데, V-13 이 `0-common.md §8` / `1-ai-agent.md §11` / `3-information-extractor.md §8` 을 전부 하향시키는 동안 이 표의 AI Agent·Info Extractor 행은 갱신 대상에서 빠져 있다. 결과적으로 draft 가 적용될 경우 canvas.md 내부에서 §5.3.1 은 "미표시(Planned)" 로 정정되지만 §5.3.4 표는 여전히 `{N} tools · {N} KB` 가 정상 렌더되는 것처럼 서술 — 같은 문서, 같은 절 안에서 즉시 모순이 재생산된다. 이는 직전 라운드가 지적한 "두 문서 동시 하향" 요구를 부분적으로만 충족한 것으로, 미러 갱신의 범위(scope) 산정이 불완전하다.
  - 제안: 변경 3b 를 확장해 §5.3.4 표의 `AI Agent` 행(`{모델} · {N} tools · {N} KB` → 예: `(구현 예정 — 미표시)` 또는 §5.3.1 과 동일한 참조 각주로 정정)과 `Info Extractor` 행은 그대로 두되 AI Agent 행만 정정. line 412 각주("포맷 SoT 는 각 노드 spec 의 summaryTemplate")도 AI Agent/Info Extractor 가 예외(Planned)임을 표 하단에 명시하면 §5.3 절 전체가 일관되게 하향된다.

- **[INFO]** V-13 변경 3b 범위 언급이 "line 306" 으로 구체적 라인 넘버를 명시해 놓쳤을 가능성을 스스로 시사
  - target 위치: 변경 3b 서술문 ("line 306")
  - 과거 결정 출처: 해당 없음 (target 자체의 서술 정밀도 문제)
  - 상세: draft 작성자가 라인 넘버까지 특정한 것은 검색 스코프를 좁혀 놓친 결과로 보인다. §5.3 안에 동일 패턴(`{N} tools`)이 표 형태로 반복되는 문서 구조상, "예시 하나만 고쳐도 절 전체가 정합된다"는 암묵적 가정이 작동한 것으로 추정된다.
  - 제안: 향후 유사 하향 작업 시 `grep -n "{N} tools\|2 tools"` 류로 대상 절 전체의 중복 서술을 먼저 스캔하는 절차를 권장(경미하므로 INFO).

## dry-run §7.4/§9.2 (변경 6a/6b) 재검증 — 문제 없음

- **재검증 결과**: 문면 충돌 해소됨 확인.
  - `spec/5-system/13-replay-rerun.md §9.2`(line 287-296) 는 "NodeExecution `_dryRun`=표시용(결과 UI 식별) / Execution `dry_run`=제어용(엔진 주입·복원)" 이분법을 명시한다.
  - `§7.2`(line 159-176)·`§7.1`(line 142-155) 은 `_dryRun` 마커가 **외부 부수효과(effect) 카테고리 노드가 skip 될 때만** output 에 심긴다고 규정 — Logic/Flow/Data/AI 등 비-effect 노드는 dry-run 실행 중에도 정상 실행되며 `_dryRun` 마커를 갖지 않는다.
  - 변경 6a(§7.4 노트 추가)·6b(§9.2 단서 추가)는 "실행 상세 페이지 배지는 표시 목적으로도 Execution.dry_run 을 함께 참조"함을 명시해, "제어용" 으로만 규정됐던 `dry_run` 컬럼이 표시 목적으로도 쓰이는 사실을 §9.2 이분법에 편입시킨다.
  - 실제 코드(`codebase/frontend/src/components/editor/run-results/result-detail.tsx` line 56-70, 828-838)를 확인한 결과, `isDryRunOutput()`(마커 기반, 에디터 drawer 전용) 과 별도로 `executionDryRun?: boolean` prop 이 존재하며, 그 JSDoc 이 정확히 "node output 의 `_dryRun` 마커는 effect 노드에만 심기므로(spec/5-system/13-replay-rerun §7.2/§7.3), dry-run 실행 중 정상 실행된 비-effect 노드에도 dry-run 배지를 표시하려면 이 execution-level 플래그가 필요"라고 기술 — draft 의 6a/6b 서술과 정확히 일치한다. 즉 이번 변경은 이미 구현된 코드 현실을 spec 에 소급 반영하는 정직화이며, 새로운 결정 번복이 아니라 §9.2 기존 이분법의 "결이 다른 예외" 를 문서화하는 보강이다. 별도 신규 Rationale 항목 추가는 필수는 아니나(코드-스펙 동기화 성격), §9.2 문면 자체에 단서를 추가하는 방식은 적절하다.
  - 결론: 이 항목은 CRITICAL/WARNING 대상 아님 (직전 라운드 WARNING 해소로 판단).

## 그 외 배치 전반 스캔 (경미)

- **[INFO]** V-05 변경 5(`14-execution-history.md ## Rationale` 신규 항목: config echo masking)는 기존 `1-data-model.md`·`4-integration.md` 의 masking 관련 Rationale 원칙(민감정보 서버 경계 마스킹)과 결이 일치하며 재도입·번복 없음.
- **[INFO]** V-14 변경 7/8(new-tab vs same-tab 상호 각주)은 기존 결정을 뒤집는 것이 아니라 이미 존재하는 두 UX 의도를 상호 참조로 명문화하는 것으로, Rationale 원칙과 충돌 없음.

## 요약

두 재검증 항목 중 dry-run(§7.4/§9.2, 변경 6a/6b)은 실제 코드 주석이 이미 동일 내용을 인용하고 있어 문면 충돌이 완전히 해소됐다고 판단된다(문제 없음). 반면 V-13 하향(변경 3b)은 방향 자체(Planned 하향, `{N} tools` 삭제)는 올바르나 적용 범위가 canvas.md §5.3 안의 두 미러 지점(§5.3.1 시각 예시, §5.3.4 요약 포맷 표) 중 하나만 커버해, draft 를 그대로 적용하면 같은 문서 같은 절 안에서 즉시 새로운 불일치가 생긴다. 이는 과거 Rationale 을 위반하거나 기각된 결정을 재도입하는 CRITICAL 성격은 아니지만, "하향은 두 문서 동시" 라는 직전 라운드 지적의 정신(정합 완결성)을 완전히 충족하지 못한 채로 남아 있어 WARNING 으로 판단한다. plan 을 실제 spec 변경으로 옮기기 전에 §5.3.4 표의 AI Agent 행도 함께 정정하도록 변경 3b 범위를 넓힐 것을 권고한다.

## 위험도

LOW
