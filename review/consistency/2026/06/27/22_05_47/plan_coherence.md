# Plan 정합성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`107b7617c`
검토 대상 변경 파일:
- `spec/5-system/17-agent-memory.md` (commit `107b7617c` — AGM-08 watermark 경로 sub-namespace 정합)
- `spec/5-system/12-webhook.md` (HEAD — "POST 전용" 스코프 한정 명문화)
- `spec/5-system/2-api-convention.md` (HEAD — 목록 페이지네이션 응답 구조 주석 추가)

---

## 발견사항

### [INFO] `spec/5-system/17-agent-memory.md` — I12 정합 완료, 후속 별건 spec PR 2건 미착수

- **target 위치**: `17-agent-memory.md` §3 AGM-08 watermark 서술, §7 실현됨 목록, Rationale AGM-08 결정 단락
- **관련 plan**: `plan/in-progress/ai-context-memory-followup-v2.md` — "Batch 2 (백엔드 리팩터) 후속 — 별건 spec PR (impl-done consistency 도출, 2026-06-27)" 섹션의 미완료 항목 2건
- **상세**: commit `107b7617c`("SPEC-DRIFT spec 정합")가 `17-agent-memory.md` 의 AGM-08 watermark 키를 `_resumeState.lastExtractionTurnSeq`(구 평면)에서 `_resumeState.memoryState.lastExtractionTurnSeq`(I12 sub-namespace)로 갱신해 I12 코드 결정과 정합했다. 계획의 표현: "canonical AGM-08(`17-agent-memory.md`)은 Batch 2 에서 갱신 완료". 이 갱신 자체는 플랜과 일치한다. 단, 동 plan 섹션에는 현재 브랜치 범위 밖으로 의도적으로 분리된 미착수 항목 2건이 있다:
  - `node-output.md` Principle 2 `meta.memory` 행: `ai_agent / information_extractor` → `ai_agent` 단독 정정 (Batch 1 #726 오류 정정)
  - `3-information-extractor.md` l.163·l.684: watermark 참조 `lastExtractionTurnSeq` → `memoryState.lastExtractionTurnSeq` (I12 정합, 하위호환 폴백 병기)
  
  두 항목 모두 plan 에 "현재 main 기준 별도 spec PR 로 처리 (Batch 2 branch behind-base 충돌 회피)"로 명기되어 있어 의도적 분리다. 충돌은 없으나, 이 브랜치 머지 후 별도 spec PR 착수 여부 추적이 필요하다.
- **제안**: target 변경 자체는 수정 불필요. 이 브랜치가 main 에 머지된 후 `node-output.md` + `3-information-extractor.md` 를 갱신하는 별도 spec PR 을 착수해야 plan 의 `[ ]` 항목이 해소된다.

---

### [INFO] `spec-sync-webhook-gaps.md` WH-NF-02 — 본문 크기 임계 결정 미확정 유지

- **target 위치**: `spec/5-system/12-webhook.md` Rationale 섹션 "스코프 한정" 추가 단락
- **관련 plan**: `plan/in-progress/spec-sync-webhook-gaps.md` — 미구현 항목 WH-NF-02 (§3.1 / §8 1MB 본문 크기 통일 임계), "결정 옵션 (2026-06-13)" 섹션
- **상세**: `12-webhook.md` 의 변경은 "POST 전용" 규칙이 트리거 진입 엔드포인트(`/api/hooks/:endpointPath`)에 한정되고 그 하위 서브경로는 별도 spec 이 정의할 수 있다는 스코프 명문화다. 이 변경은 WH-NF-02(본문 크기 임계: spec "1MB" vs 코드 현행 32KB/100KB)의 미결 결정과는 완전히 직교하며 충돌하지 않는다. 단, plan 의 WH-NF-02 는 여전히 옵션 A/B/C 중 사용자 결정이 기록되지 않은 상태(`[ ]`)로 유지된다.
- **제안**: 현재 target 변경은 수정 불필요. WH-NF-02 는 기존 plan 에 따라 별도 결정·구현 트랙으로 처리한다.

---

## 요약

`spec/5-system/` 의 세 가지 변경(17-agent-memory 워터마크 키 sub-namespace 정합, 12-webhook POST 전용 스코프 한정 명문화, 2-api-convention 페이지네이션 응답 구조 주석)은 모두 `plan/in-progress/` 의 미해결 결정을 일방적으로 우회하거나 충돌하지 않는다. `17-agent-memory.md` 의 I12 갱신은 plan 이 "Batch 2 에서 완료"로 명기한 항목이며, 나머지 두 spec 변경은 미결 결정과 직교한다. 유일한 추적 사항은 plan 이 의도적으로 "별건 spec PR"로 분리한 `node-output.md`·`3-information-extractor.md` 2건의 미착수인데, 이는 브랜치 behind-base 충돌 회피를 위한 계획적 분리이므로 이 브랜치 머지 후 별도 PR 착수를 확인하면 된다.

## 위험도

LOW
