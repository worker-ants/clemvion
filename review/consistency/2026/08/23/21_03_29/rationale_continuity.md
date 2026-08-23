### 발견사항

- **[WARNING] 브랜치가 origin/main 의 R17 해소(#1205)를 반영하지 않은 채 정지 — 병합 시 fail-closed allowlist 를 되돌릴 위험**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §Rationale R17 (`- \`nodeOutput\` 일반 키 allowlist (미구현·잔여)`, 현재 워크트리 기준 line 1734 부근), `spec/conventions/conversation-thread.md` §8.4 소비처 갱신 문단, `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`allowlistNodeOutputKeys` import·호출 부재), `codebase/backend/src/shared/utils/node-output-allowlist.ts`(이 워크트리에 파일 자체가 없음)
  - 과거 결정 출처: `origin/main` HEAD 커밋 `16f3e3625` — "`nodeOutput` 을 fail-open deny-list 에서 fail-closed allowlist 로 (EIA §R17) (#1205)". 이 커밋이 `spec/5-system/14-external-interaction-api.md` §Rationale R17 을 "~~`nodeOutput` 일반 키 allowlist (미구현·잔여)~~ 해소 (2026-08-23) — 단 \`getStatus\` 한 출구에 한정" 으로 갱신하고, 런타임 fail-closed allowlist(`allowlistNodeOutputKeys`, `codebase/backend/src/shared/utils/node-output-allowlist.ts`)를 도입했다. Rationale 원문은 종전 deny-list(`EXTERNAL_STRIPPED_FIELDS=['llmCalls']`)가 "새 핸들러 키가 기본값으로 통과"해 엔진 내부 `_retryState` 가 실제로 새고 있었다고 명시한다.
  - 상세: `git -C <worktree> log --oneline HEAD ^origin/main` 로 확인한 결과, 이 태스크(`rerun-dto-shorthand`)의 실제 커밋(`33b4c8dbb`, `236ea668a`, `b7805c70c`)은 `re-run.dto.ts`/`re-run.dto.spec.ts` 만 건드리며 `node-output-allowlist.ts`·`interaction.service.ts`·`14-external-interaction-api.md`·`conversation-thread.md` 는 **일절 건드리지 않는다**. `git diff origin/main`(HEAD 대비)에서 이 4개 파일이 "되돌려진 것처럼" 보이는 이유는 이 브랜치가 `04fe5962f8`(#1205 병합 직전 커밋)에서 분기했고, `origin/main` 은 그 뒤 `16f3e3625`(#1205, R17 해소 + allowlist 도입)로 앞서갔기 때문이다 — 즉 이 태스크가 결정을 되돌린 게 아니라 **브랜치가 병렬 세션의 머지를 아직 흡수하지 못한 상태**다(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 도 이 워크트리 사본은 line 72 항목이 아직 `[ ]` 로 열려 있는 반면, `git show origin/main:<같은 경로>` 는 이미 그 항목이 닫히고 SSE/fanout 잔여 항목으로 갱신돼 있어 동일 결론). 두 갈래가 겹치는 파일이 없어 정상적인 3-way merge/PR 머지라면 자동으로 양쪽이 합쳐지지만, 이 상태를 인지하지 못한 채 **리베이스 없이** stale 스냅샷을 기준으로 추가 편집·강제 push·squash 등을 하면 보안에 민감한 R17 해소(fail-closed allowlist)가 조용히 소실될 수 있다.
  - 제안: 병합/PR 올리기 전에 `git -C <worktree> fetch && git -C <worktree> rebase origin/main`(또는 동등한 머지)으로 `#1205` 를 흡수하고, 리베이스 후 `spec/5-system/14-external-interaction-api.md` §R17 이 "해소(2026-08-23)" 문구와 표를 유지하는지, `node-output-allowlist.ts`/`allowlistNodeOutputKeys` 사용이 살아있는지, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 해당 항목이 닫힌 상태로 남는지 재확인할 것. 이 태스크 자체의 diff(re-run DTO 축약형)는 해당 파일들과 접점이 없으므로 리베이스로 인한 충돌은 예상되지 않는다.

- **[INFO] 이 태스크 자체의 변경(`re-run.dto.ts` shorthand → 명시형)은 Rationale 연속성 문제 없음**
  - target 위치: `codebase/backend/src/modules/executions/dto/re-run.dto.ts`(`type: Object` → `type: 'object', additionalProperties: true`), 신규 `re-run.dto.spec.ts`
  - 과거 결정 출처: 없음 (신규 스타일 정합 수정). `spec/5-system/13-replay-rerun.md §8`/`§Rationale`, `spec/5-system/2-api-convention.md §Rationale` 어디에도 `inputOverride` 의 OpenAPI 표현 형태(축약형 vs 명시형)에 대한 기존 결정이 없다.
  - 상세: `plan/complete/rerun-dto-shorthand.md` 가 실측 근거(생성 문서 비교, `additionalProperties` 유무 차이)를 명시하고, `/ai-review`(`20_36_01`, CRITICAL 0·WARNING 3 전부 반영)까지 거쳤다. 저장소 다수 패턴(40 파일)과의 정렬이며 기각된 대안 재도입도, 원칙 위반도 없다.
  - 제안: 없음 (참고용 기록).

### 요약
이 태스크(`re-run.dto.ts` 의 `type: Object` 축약형 → `type: 'object' + additionalProperties: true`) 자체는 Rationale 연속성 관점에서 깨끗하다 — 신규 결정이고 기존 Rationale 과 충돌하지 않으며 실측·리뷰를 거쳤다. 다만 `git diff origin/main` 로 spec/코드를 살펴보면 `spec/5-system/14-external-interaction-api.md` §Rationale R17(`nodeOutput` 키 allowlist, `getStatus` 출구 fail-closed 해소, 2026-08-23)이 "미구현·잔여" 상태로 되돌아간 것처럼 보인다. 원인을 추적한 결과 이는 이 태스크의 커밋이 만든 변경이 아니라, 이 브랜치가 `#1205`(해당 R17 해소 + `allowlistNodeOutputKeys` 도입) 병합 **이전** 지점에서 분기된 뒤 리베이스되지 않았기 때문이다(병렬 세션 머지 지연). 파일 접점이 겹치지 않아 정상 머지라면 자동 해소되지만, 리베이스 없이 이 상태로 병합·강제 push 되면 보안에 민감한 해소된 결정이 실제로 소실될 수 있어 병합 전 확인이 필요하다.

### 위험도
LOW
