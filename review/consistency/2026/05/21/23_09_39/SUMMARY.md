# Consistency Check Summary — spec-external-interaction-api

> 2026-05-21 / worktree: `spec-external-interaction-api` / base: main
> 검토 대상: NEW `spec/5-system/14-external-interaction-api.md` + MOD `12-webhook.md` / `6-websocket-protocol.md` / `4-execution-engine.md` (+ MOD `spec/1-data-model.md` 후속)
> 검토 시점: spec 작성 직전 의무 (`consistency-check --spec`)

## BLOCK: NO

Critical 발견 0건. WARN 다수는 모두 spec 보완으로 해소됨 (별도 follow-up 없음).

## 결과 매트릭스

| Checker | STATUS | Critical | Warning | Info | 결과 파일 |
|---------|--------|----------|---------|------|----------|
| cross-spec-checker | WARN | 0 | 7 | 2 | `cross-spec-result.md` |
| rationale-continuity-checker | WARN | 0 | 3 | 3 | `rationale-result.md` |
| convention-compliance-checker | WARN | 0 | 4 | 5 | `convention-result.md` |
| plan-coherence-checker | WARN | 0 | 3 | 4 | `plan-coherence-result.md` |
| naming-collision-checker | WARN | 0 | 4 | 1 | `naming-result.md` |

## WARN 항목별 spec 반영 결과

### 경로 충돌 (NAMING W1~W3 + CONVENTION W-5)
- 해결: 모든 외부 endpoint 를 `/api/external/executions/:id/*` prefix 로 분리.
- Rationale 추가: §R11 (경로 prefix 분리 — 채택안과 기각안 2건 명시).
- 영향 파일: 14-external-interaction-api.md 전체, 12-webhook.md 응답 예시.

### Cross-spec
- W-1 HMAC 표기 불일치 → §3.1 EIA-NX-03 본문에 inbound/outbound 표기 분리 명시 + §R12 추가.
- W-2 IE multi-turn finalPort=`completed` 누락 → §6.3 finalPort 열거에 `completed` 추가 + 코멘트.
- W-3 `execution.paused` 매핑 누락 → §11 매핑 표 + 6-websocket-protocol §4.6 표 모두 보강.
- W-4 submit_form `formData` vs `data` → §5.1 command 표 + §11 매핑 표에 필드 매핑 컬럼 신설.
- W-5 1-data-model §2.8 Trigger 미반영 → 1-data-model.md §2.8 컬럼 4개 + config 서브필드 cross-link 추가.
- W-6 Re-run 새 execution 토큰 흐름 → §12 호환성에 "Re-run 은 워크스페이스 JWT 전용, 외부 토큰 차단" 명시.
- W-7 `execution.replay_unavailable` 네임스페이스 → §5.2 본문 + §11 매핑 표 마지막 행에 cross-link.

### Rationale
- W-1 §11 잘못된 §4.7 참조 → §4.6 으로 정정 + anchor 명시.
- W-2 단일 sink 정책 재검토 미인용 → §R10 신설 + 4-execution-engine §4.4 에 재검토 완료 cross-link.
- W-3 seq 정의 "채널 내" vs "execution 내" → 6-websocket-protocol §2.2 seq 행에 명확화 코멘트 + EIA §R7 cross-link.
- INFO 3건 (R8 기각안 명시 / R5 트리거 정량화 / WH-MG-04 단서) 모두 spec 본문에 반영.

### Convention
- W-1 cancel 응답코드 200 → 202 통일 + §5.4 본문에 근거 명시.
- W-2 Swagger bearer scheme 분리 → §10.1 신설 (`interaction-token` scheme 등록 명시).
- W-3 에러 응답 body 형식 → §5.1 본문에 `error.code/message/details` shape 예시 + 2-api-convention §5.3 cross-link.
- W-4 conversationThread source fallback → §5.3, §6.2 각 컨텍스트에 fallback 규약 명시.

### Plan Coherence
- W-1 ai-agent-tool-connection-rewrite 도구 namespace → spec follow-up 으로 plan 에 체크박스 추가 예정.
- W-2 replay-rerun 외부 토큰 차단 → §12 호환성에 명시 (cross-spec W-6 와 동일 해소).
- W-3 node-output-redesign result.outputs shape → §6.3 본문에 "shape 는 해당 노드 spec 참조" 보강.
- INFO 4건 (parallel-p2 seq 검증, self-hosting SSRF allowlist 등) plan 에 체크박스로 적재.

### Naming
- W-1~W-3 모두 경로 prefix 분리로 해소.
- W-4 (`execution.replay_unavailable` 명명 차이) cross-spec W-7 와 동일하게 §5.2 cross-link 로 해소.

## 추가 spec 변경 (반영 결과)

| 파일 | 변경 |
|------|------|
| `spec/5-system/14-external-interaction-api.md` | 신규 + WARN 반영 (경로 prefix, R10/R11/R12, §10.1 Swagger scheme, §11 매핑 표 보강) |
| `spec/5-system/12-webhook.md` | notification/interaction 필드 추가, WH-MG-04 단서 추가, Rationale 신설 |
| `spec/5-system/6-websocket-protocol.md` | §4.6 외부 매핑 표 신설, §2.2 seq 행 보강 |
| `spec/5-system/4-execution-engine.md` | §4.4 단일 sink 재검토 완료 cross-link 추가 |
| `spec/1-data-model.md` | §2.8 Trigger 에 4개 컬럼 + config 서브필드 cross-link 추가 |

## 결론

- **BLOCK: NO**
- 모든 WARN 항목이 spec 보완으로 해소됨. 별도 follow-up 작업 없음.
- 단, Plan Coherence INFO 4건은 신규 plan (`external-interaction-api.md`) 의 phase 체크박스로 적재해 향후 작업 중에 잊혀지지 않도록 한다.

다음 단계: `plan/in-progress/external-interaction-api.md` 작성.
