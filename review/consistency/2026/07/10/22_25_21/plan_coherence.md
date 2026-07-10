# Plan 정합성 검토 — EIA getStatus() 2단계 컬럼 projection

모드: `--impl-prep`
대상 plan: `plan/in-progress/eia-getstatus-column-projection.md`
대상 변경: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()` (아직 미구현)

## 발견사항

- **[WARNING]** `spec-sync-external-interaction-api-gaps.md` line 17 의 line-range 증거 인용이 구현 후 stale 화됨
  - target 위치: `plan/in-progress/eia-getstatus-column-projection.md` 범위 절 (`getStatus()` 를 2단계 조회로 전환, base projection + 조건부 `conversationThread` 재조회)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` line 17, `[x] GET /api/external/executions/:id 의 currentNode / context 실값` 항목
  - 상세: line 17 은 "완료/정합 확인" 근거로 `interaction.service.ts:247-296` 을 정확한 line-range 로 인용한다. 현재 코드 확인 결과 그 범위는 `getStatus()` 본문 중 `NotFoundException` 후반부 → `waiting_for_input` 분기의 `conversationThread` redact(264-266) → 대기 `NodeExecution` 조회(267-274) → `currentNode`/`context` 조립 시작부(275-296)에 정확히 대응한다. 신규 plan 이 계획한 2단계 조회(얇은 base projection 선행 → `waiting_for_input` 일 때만 `conversationThread` 재조회를 `NodeExecution` 조회와 `Promise.all` 병렬 실행)는 이 블록의 코드 구조를 재배치한다 — 특히 `execution.conversationThread` 를 최초 `execution` 객체에서 바로 읽던 264행 구조가, 두 번째 얇은 재조회 결과에서 읽는 형태로 바뀔 가능성이 높다. 그 결과 line-range 246-296 인용이 실제 코드와 어긋나게 된다.
  - 판단: 이는 미해결 결정 우회가 아니고, "currentNode/context 가 대기 NodeExecution 으로부터 SSE 와 동일 형식으로 복원된다"는 **실질 주장 자체는 계속 참**이다(신규 plan 도 "wire 형식 무변경" 을 명시). 다만 line-range 는 build-time 가드 대상이 아닌 **prose 인용**(spec-impl-evidence 의 `code:`/`pending_plans:` 프론트매터 가드는 파일 경로만 검증, line-range 는 미검증)이라 즉시 실패로 이어지지는 않지만, 추후 audit·재검증 시 잘못된 코드 위치를 가리켜 추적성이 훼손된다.
  - 제안: 신규 plan 의 체크리스트 4번(DOCUMENTATION) 또는 9번(REVIEW WORKFLOW) 수행 시, 같은 PR 안에서 `spec-sync-external-interaction-api-gaps.md` line 17 의 `interaction.service.ts:247-296` line-range 를 구현 후 실제 위치로 갱신한다. (해당 체크박스 자체는 이미 `[x]` 완료 처리돼 있으므로 내용을 뒤집는 것이 아니라 인용 위치만 정정 — 결정 재개 아님.)

- **[INFO]** `pending_plans:` 등재 불필요함을 확인 (Q5 검증 결과)
  - target 위치: `spec/5-system/14-external-interaction-api.md` frontmatter (`status: partial`, `pending_plans: [spec-sync-external-interaction-api-gaps.md]`)
  - 관련 plan: `plan/in-progress/eia-getstatus-column-projection.md`
  - 상세: `spec/conventions/spec-impl-evidence.md` §3 기준 `pending_plans:` 는 "**미구현** surface 를 책임지는 plan" 만 등재 대상이다. 신규 plan 은 명시적으로 "wire 형식 무변경 — 순수 내부 조회 최적화"(§범위)이며 spec §5.3/§R17 이 약속한 어떤 응답 필드도 새로 남겨두거나 되돌리지 않는다. 따라서 `pending_plans` 에 추가할 필요가 **없다** — 현재 상태가 맞다.
  - 제안: 없음 (확인용 기록).

- **[INFO]** 동시 작업 plan 표면 충돌 없음 (Q2 검증 결과)
  - target 위치: `interaction.service.ts` `getStatus()`
  - 관련 plan: `node-output-redesign/information-extractor.md`, `execution-engine-residual-gaps.md`, `resume-llm-usage-attribution.md`
  - 상세: `information-extractor.md` 의 `interaction.service.ts` 유사 문자열 매치는 실제로는 `form-interaction.service.ts`/`button-interaction.service.ts`(멀티턴 AI `resumed` status emit 논의, 별개 파일)에 대한 참조이며 대상 파일과 무관하다. `execution-engine-residual-gaps.md`/`resume-llm-usage-attribution.md` 는 `getStatus`/`conversation_thread`/`interaction.service.ts` 언급이 전혀 없다. `ai-agent-tool-connection-rewrite.md`(SSE `tool_call_started` payload namespace), `merge-p2-async-fanin.md`(SSE seq monotonic 보장), `self-hosting-deployment.md`(SSRF allowlist 설정 가이드)는 EIA cross-ref 이지만 모두 `getStatus()` 조회 메커니즘과 무관한 다른 표면(SSE payload 네이밍/seq/배포 문서)이다. 충돌 없음.
  - 제안: 없음 (확인용 기록).

## 부가 확인 사항

- **frontmatter 스키마(Q3)**: `worktree: optimize-getstatus-projection-78853c` (현재 worktree 디렉토리명·branch 접미사와 일치), `started: 2026-07-10`, `owner: developer` 모두 존재 — `.claude/docs/plan-lifecycle.md` §4 필수 3필드 충족. `title`/`status`/`spec_area` 추가 필드도 허용 범위. 위반 없음.
- **선행 조건 충족 여부(Q4)**: 신규 plan 이 전제하는 PR #874(EIA §R17 재조정, `Execution.conversation_thread` → `context.conversationThread` 노출)는 git log 상 이미 merge 됨(`f7c708842`). 이후 `#876`/`#881`/`#883`/`#886` 커밋으로 secret 마스킹 하드닝까지 완결. 본 변경을 가로막는 미해결 선행 plan 결정은 발견되지 않았다. `spec-sync-external-interaction-api-gaps.md` 내 유일한 미체크 항목(§R10 분산 SSE fan-out, line 14)은 DB projection 최적화와 무관한 별개 표면.
- **결정 충돌 여부(Q1 종합)**: 신규 plan 은 spec-sync 트래커의 "결정 필요" 항목을 우회하지 않는다 — 해당 트래커에 남은 유일한 미결 항목(분산 fan-out)과 본 변경은 무관. line 17 인용은 위 WARNING 대로 사후 정정 필요하나, 이는 결정 자체의 번복이 아니라 코드 위치 포인터 갱신 수준이다.

## 요약

신규 plan(`eia-getstatus-column-projection.md`)은 EIA `getStatus()` 의 순수 내부 조회 최적화로, spec §5.3/§R17 이 약속한 wire 계약을 바꾸지 않고 다른 in-progress plan 의 표면과도 충돌하지 않는다. `pending_plans` 등재도 필요 없음을 확인했다. 유일한 지적 사항은 `spec-sync-external-interaction-api-gaps.md` line 17 이 인용하는 정확한 line-range(`interaction.service.ts:247-296`)가 2단계 조회 리팩터로 구현 후 stale 화될 가능성이 높다는 점 — 실질 주장(waiting 상태 currentNode/context 복원)은 유지되므로 결정 충돌은 아니며, 구현 PR 안에서 인용을 갱신하는 후속 작업으로 충분하다. frontmatter 스키마, 선행 PR 조건(#874 merge 완료), 동시 작업 plan 표면 모두 문제 없음.

## 위험도

LOW

STATUS: OK
