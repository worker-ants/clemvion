### 발견사항

- **[INFO]** 이 diff 의 실질 범위는 `llmCalls` 깊이 무관 strip(fanout + REST `getStatus`) 보안 수정 하나이며, 브랜치/plan 제목이 가리키는 "종결(terminal) payload 정리"(`error` 객체화·`durationMs`·`result.outputs`)는 아직 미착수 상태다
  - 위치: `plan/in-progress/eia-terminal-payload.md` 체크리스트 (`- [ ] --impl-prep 재실행 BLOCK: NO` / `- [ ] 구현 + 테스트`) — 둘 다 미완료
  - 상세: `plan/in-progress/eia-terminal-payload.md`(정본 종결 payload 작업)는 planner 턴(`4b13ca5ae`)으로 `--impl-prep` 차단만 풀렸을 뿐, 실제 `error` 객체화/`durationMs`/`result.outputs` 구현은 이 diff 에 전혀 없다. 대신 실린 코드(`interaction.service.ts`/`websocket.service.ts`/`strip-external-only-fields.ts`)는 조사 중 발견된 별개의 심각한 보안 결함(`llmCalls` raw 프롬프트 외부 노출)을 막는다. `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 가 이 우선순위 반전을 명시적으로 기록하고 있어(`## 🔴 조사 중 발견` 절 + 처분 체크리스트), 문서와 코드가 일치한다 — 스코프 이탈이 아니라 문서화된 의도적 순서 변경이다.
  - 제안: 조치 불필요. 참고용 기록. 다음 세션에서 `eia-terminal-payload.md` 를 재개할 때 `spec-draft-eia-62-waiting-payload.md` 의 잔여 체크리스트(`stripDeep` identity 캐시, 대용량 non-AI A/B, 배열 부분 clone-on-write 다원소 fixture, 유출 사후 대응)가 별건으로 여전히 열려 있음을 확인할 것.

- **[INFO]** `interaction.service.spec.ts` / `websocket.service.spec.ts` 의 이 diff 로 건드리지 않은 기존(pre-existing) 라인에서 `npx tsc --noEmit` 이 4~5건의 타입 에러를 낸다 — 이 PR 이 만든 것이 아니다
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.spec.ts:580,607,823,1081` (blame 상 2026-07-11, 이 브랜치 이전), `codebase/backend/src/modules/websocket/websocket.service.spec.ts:547`
  - 상세: `tsc --noEmit -p tsconfig.json` 을 전체 프로젝트에 대해 돌리면 위 줄에서 `TS2352`(과도한 캐스팅)·`TS2739`(필드 누락) 에러가 난다. `git blame` 으로 확인하면 전부 이 브랜치가 시작되기 훨씬 전(2026-07-11 등)에 작성된, 이 diff 가 손대지 않은 줄이다. `tsconfig.build.json` 이 `**/*spec.ts` 를 build 대상에서 제외하고(`nest build` 는 영향 없음), `jest`(ts-jest/babel 경유) 는 이 diff 대상 테스트 5개 스위트·147개 케이스 전부 GREEN 이었다(직접 실행 확인). 즉 이 diff 의 신규/수정 라인과 무관한 pre-existing 잡음이라 이번 PR 의 결함으로 세지 않는다.
  - 제안: 조치 불필요(이 PR 범위 밖). 향후 별도로 `tsc --noEmit` 전체 게이트를 CI 에 추가할 계획이 있다면 그때 별건으로 정리.

- **[INFO]** spec fidelity 확인 — `stripExternalOnlyFields`/`stripAndRedact` 구현이 같은 커밋 세트에서 갱신된 spec 본문과 line-level 로 일치한다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` (`export function stripExternalOnlyFields`, `EXTERNAL_STRIPPED_FIELDS`) ↔ `spec/5-system/6-websocket-protocol.md` §4.4 "`llmCalls` 외부 수신자 strip — 위치·이벤트·표면 무관" 및 `spec/5-system/14-external-interaction-api.md` §R17/§WS 인용 blockquote
  - 상세: (1) strip 대상이 "WS fanout + EIA REST `getStatus()` 양쪽" 이라는 spec 서술이 실제로 `interaction.service.ts` 세 출구(`nodeOutput`/`result`/`error`) + `websocket.service.ts` 두 emit 지점(`emitExecutionEvent`/node 이벤트) 모두를 커버한다(직접 grep 으로 5개 호출 지점 전수 확인, 그 외 `interact()`/`cancel()` 은 `outputData` 를 반환하지 않음을 확인). (2) "필드명 기준 깊이 무관" 서술이 `stripDeep` 의 재귀 구현과 일치(테스트로 depth 0~MAX+2 sweep, 뮤테이션 판별력까지 실측됨 — `11_02_16` RESOLUTION 참조). (3) 경계 연산자 비대칭(`stripDeep` `>` vs `deepRedactSecrets` `>=`)에 대한 JSDoc 설명("어느 순서든 그 깊이의 raw 내용은 안 나간다")이 `strip-external-only-fields.spec.ts` 의 "순서를 바꿔도 결과가 같다" 테스트 + REST 순서(strip→redact) 깊이 sweep 테스트로 실증됨. 불일치 발견 없음.
  - 제안: 없음(정보성 확인).

### 요약
핵심 변경(`strip-external-only-fields.ts` 신설 + `interaction.service.ts`/`websocket.service.ts` 배선)은 `llmCalls` raw LLM 프롬프트가 fanout(SSE/webhook/chat-channel)뿐 아니라 REST 스냅샷(`GET /api/external/executions/:id`)의 세 출구(waiting `nodeOutput`, terminal `result`/`error`) 전부에서 새고 있던 것을 필드명 기반 깊이 무관 strip 으로 닫는다. `getStatus()` 의 세 출구가 공용 헬퍼(`stripAndRedact`)를 통해 한 번에 조립되므로 "한쪽만 고치는" 재발 패턴이 구조적으로 막혔고, `interact()`/`cancel()` 등 다른 외부 노출 경로에는 `outputData` 파생 데이터가 없음을 직접 확인했다. null/undefined/원시값/`__proto__`/배열 부분-clone/깊이 경계 등 엣지 케이스가 전용 유닛 테스트(`strip-external-only-fields.spec.ts`)와 소비처 테스트(`websocket.service.spec.ts`, `interaction.service.spec.ts`) 양쪽에서 뮤테이션 판별력까지 실측돼 있고, 대상 5개 스위트 147개 케이스 전부 GREEN, lint(`--max-warnings 0`) 클린을 직접 재현했다. 관련 spec 문서(`spec/5-system/6-websocket-protocol.md` §4.4, `spec/5-system/14-external-interaction-api.md` §R17/§6, `spec/1-data-model.md` §2.14)가 이 diff 와 함께 line-level 로 갱신돼 구현과 어긋남이 없다. TODO/FIXME 류 미완성 마커 없음, 반환값 타입(`ExecutionStatusDto.result`/`error: Record<string, unknown> | null`) 일치. 발견된 사항은 전부 INFO — 실질 기능 결함이나 spec 불일치는 없다. 다만 이 diff 는 plan 제목이 가리키는 "종결 payload 정리" 자체는 구현하지 않은 채 별개의 긴급 보안 수정만 담고 있는데, 이는 관련 plan 문서에 명시적으로 기록돼 있어 스코프 이탈이 아니라 문서화된 우선순위 변경이다.

### 위험도
LOW
