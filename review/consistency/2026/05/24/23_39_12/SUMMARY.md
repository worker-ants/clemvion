# Consistency Check 통합 보고서 (rev 2)

**대상 draft**: `plan/in-progress/spec-draft-workflow-resumable-execution.md` (rev 2)
**검토 모드**: --spec
**검토 일자**: 2026-05-24
**세션**: `review/consistency/2026/05/24/23_39_12`
**이전 세션**: `review/consistency/2026/05/24/23_26_13` (rev 1, BLOCK: YES → 보정)

---

**BLOCK: NO** — Critical 위배 0건. spec 적용 단계 진행 가능.

## 전체 위험도

**LOW–MEDIUM** — 모든 checker 통과. 남은 WARNING 은 spec 적용 시 함께 처리할 갱신 범위 보강 (orphan 각주·동반 인프라 표기·앵커 점검) 및 다른 plan 과의 cross-link.

## Checker별 결과

| Checker | 결과 | 위험도 | 핵심 |
|---------|------|--------|------|
| Cross-Spec | OK | MEDIUM | WARNING 4건 — §9.2 각주 (line 828), §4.4 결정 블록 근거 불릿, presentation §10.9 인프라 표기 + 앵커 링크, data-flow line 20/165 추가 갱신 |
| Rationale Continuity | success / 1 issue | LOW | sticky fast-path 제거 및 옛 원칙 계승 명시로 rev 1 의 MEDIUM WARNING 해소 |
| Convention Compliance | success / 3 issues | LOW | frontmatter / RESUME_QUEUED 분리 해소. 남은 항목 INFO 수준 |
| Plan Coherence | OK | LOW | WARNING 3 — data-flow Rationale 역전, retry-handler-followup WARNING #2 채널명 갱신 action, 0-unimplemented 등재 시점 명시 |
| Naming Collision | success / 8 issues | LOW | 의미 경계 명문화 등 spec 적용 시 처리 |

## spec 적용 시 함께 처리할 WARNING 목록

본 SUMMARY 통과로 BLOCK 해소되었으나, spec 본문 적용 시 다음 8개 항목을 누락하면 stale 표기가 남는다 — 적용 단계에서 일괄 반영:

1. **§9.2 각주 (line 828)** — `execution:continuation` 언급 제거 (행 삭제와 동시에)
2. **§4.4 결정 블록 근거 불릿** — continuation bus 설명을 변경 1.8 의 본문 문장과 동일하게 갱신
3. **`spec/4-nodes/6-presentation/0-common.md §10.9`** — line 387 "Redis pub/sub" 표기, line 389/417 의 `#74-분산-실행-multi-instance` 앵커 유효성 점검
4. **`spec/data-flow/3-execution.md`** — line 20 파일 참조 (`continuation-bus.service.ts — ... (Redis pub/sub)`) + line 165 mermaid 라벨 + line 232–237 의 "Continuation bus = Redis pub/sub" Rationale 절 (역전 갱신 또는 본 결정 반영 노트)
5. **`spec/0-overview.md` line 83 + Rationale §trade-off** — 변경 5 갱신 대상에 추가
6. **WS ack `queued` 필드 SoT 명시** — `submit_form` / `submit_message` / `end_conversation` ack shape 공통 SoT 또는 각 명령별 예시
7. **§9.3 `task-queue` 행** — 실제 코드에 해당 큐 이름이 존재하는지 확인 후 spec §4.2 에 명시 추가 또는 §9.3 행 삭제
8. **`plan/in-progress/retry-handler-followup.md` WARNING #2 채널명** — `execution:continuation` → `BullMQ continuation-queue` 표기 갱신 action 을 본 plan "다음 단계" 에 명시

INFO 항목 (rehydration 후 `execution.resumed` 발행 여부, frontend status pill 등) 은 spec 적용 후속 또는 구현 단계 결정.
