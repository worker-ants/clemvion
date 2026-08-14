# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 발견 (서로 다른 근본 원인, 서로 다른 target)

## 전체 위험도
**CRITICAL** — ① `GET /api/external/executions/:id`(REST `getStatus`)가 이번 PR 이 SSE/webhook/chat-channel fanout 에서 막은 것과 동일한 `llmCalls`(raw LLM 프롬프트/응답) 누출을 여전히 허용한다(사전 존재 결함, 이번 diff 범위 밖 표면). ② project-planner 몫의 spec 초안이 `spec/5-system/6-websocket-protocol.md` Rationale 이 이름까지 지목해 기각·재확인한 "§6.2 직접 재작성" 대안을 근거 없이 되살린다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `GET /api/external/executions/:id`(`interaction.service.ts` `getStatus()`)가 fanout strip 파이프라인(`stripDeep`)을 전혀 거치지 않고, `nodeOutput.meta.turnDebug[].llmCalls`(raw LLM `requestPayload`/`responsePayload`)를 `deepRedactSecrets`(값-레벨, 필드 제거 아님)만 거쳐 그대로 반환. 같은 `iext_*`/`itk_*` 토큰으로 접근 가능한 저신뢰 표면 | `codebase/backend/src/modules/external-interaction/interaction.service.ts:337-386` (특히 `:341`, `:385`) | `spec/5-system/6-websocket-protocol.md:519` §4.4("모든 외부 fanout 수신자에서 strip") + `spec/5-system/14-external-interaction-api.md` §R17("getStatus·SSE fanout 모두 공개 EIA 표면") | `getStatus()` 조립 지점에 `stripDeep`/`EXTERNAL_STRIPPED_FIELDS` 와 동등한 strip 적용(공유 유틸로 승격 권장) + EIA §R17 에 `llmCalls` 명시 + `websocket.service.ts` JSDoc 문구("never receive it") 정정 |
| 2 | rationale_continuity | spec 초안의 "변경 제안 (1)+(3)"이 §6.2 예시를 실측 wire shape 으로 **직접 재작성**하자고 제안 — WS Rationale 이 2026-07-14(PR #945) §6.2 를 실례로 들어 명시 기각하고 2026-08-13(착수 하루 전) `waiting_for_input` 범위로 재확인한 caveat 패턴을 근거 제시 없이 번복 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"변경 제안 (1)"(L52-56)·(3)(L67-73) | `spec/5-system/6-websocket-protocol.md` `## Rationale` → "§4.4 wire 필드 caveat"(967-980행) + 2026-08-13 갱신 blockquote | 둘 중 하나 명시 선택: (a) caveat 패턴 유지 — `payload:` 래퍼만 추가, 안쪽 JSON·blockquote 구조는 보존 (권장) / (b) 의도적 번복 — WS Rationale 에 addendum 으로 "왜 이제 직접 재작성이 나은가" 명문화 + target 자체 Rationale 에도 이 결정 항목 추가 |

## planner 인계 (권한 밖 Critical)

(없음) — 두 Critical 모두 현재 세션 쓰기 권한(`codebase/**`, `plan/**`) 안에서 직접 수정 가능한 target 을 가리킨다. #1 은 `interaction.service.ts`(codebase) 수정, #2 는 아직 `spec/`에 반영되지 않은 `plan/in-progress/` 초안 자체의 제안 내용 수정으로 해소된다 — `spec/**` 직접 쓰기가 필요하지 않다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | "`llmCalls` strip-only" 계약의 SoT 가 실제 누출 지점(`waiting_for_input`, EIA §6.2)을 여전히 다루지 않음 — WS §4.4 Rationale 은 `ai_message.llmCalls[]` 로만 스코프가 좁고, EIA §6.2 jsonc 예시는 `nodeOutput.meta.turnDebug` 자체를 언급 안 함 | `spec/5-system/6-websocket-protocol.md` §4.4 Rationale(L1056-1064) + `spec/5-system/14-external-interaction-api.md` §6.2(L645-699)·§R17(L1344,1349) | EIA §6 도입부 자체 SoT 원칙("같은 필드 여러 문서 나열 = 두 번째 SoT") | WS §4.4 Rationale 제목·본문을 "`llmCalls` 필드(위치 무관, depth-무관)"로 확장 + EIA §6.2 에 §6.5 와 동형 strip 문장 추가 + §R17 역참조. Critical #1 해소 시 함께 정리 권장 |
| 2 | cross_spec | `plan/complete/eia-secret-masking-residuals.md` P1-2("sanitizePayloadForWs+deepRedactSecrets 로 충분")가 이후 성립한 `llmCalls` strip-only 결정과 충돌한 채 완료 종결 | (해당 없음, 배경 문서) | `spec/5-system/6-websocket-protocol.md` Rationale "strip-only 결정" | `plan/complete/` 소급 수정 대신 위 Critical #1 해소(§R17 갱신)로 대체하고 참조만 남김 |
| 3 | rationale_continuity | Critical #2 의 어느 선택지를 따르든 `6-websocket-protocol.md` 도 함께 편집해야 하는데 draft frontmatter `spec_impact` 에 이 파일이 빠져 있음 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` frontmatter `spec_impact`(8-10행) | WS §4.4 Rationale "2026-08-13 갱신" 서술("§6.2 blockquote 에는 필드명 매핑만 남았다")과의 stale 화 위험 | `spec_impact` 에 `spec/5-system/6-websocket-protocol.md` 추가, (3) 채택 시 WS Rationale 대응 문단도 같은 턴에 갱신 |
| 4 | plan_coherence | frontmatter `spec_impact` 2번째 항목 경로 오류 — 실재 경로는 `spec/1-data-model.md`(루트) 인데 `spec/5-system/1-data-model.md`(부재) 로 표기. 3커밋(`a9574f823`·`5df89cda6`·`b49ee4310`) 거치도록 미수정, `09_38_17` 라운드부터 재지적 지속 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` frontmatter `spec_impact` | Gate C(`spec-plan-completion.test.ts`)/후속 consistency 라운드 번들링 대상 탐색 | `spec/1-data-model.md` 로 정정 |
| 5 | plan_coherence | target 의 "SSE 필드명 매핑 정정" 제안이 어제 완료 처리된 형제 plan(`spec-draft-eia-notification-payload-contract.md`)의 "필드명까지 다르다" 전제를 실측으로 뒤집는데, 형제 plan 에 대한 교차 참조가 전혀 없음 | `plan/in-progress/spec-draft-eia-62-waiting-payload.md` "변경 제안 (3)" | `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 완료 체크리스트("§6.2 blockquote 필드명 매핑만 남음") | (3)에 형제 plan 명시 인용 + 형제 plan 체크 항목 아래 반증 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `stripDeep`(websocket.service.ts) / `deepRedactSecrets`(shared/utils) / `sanitizeInner`(같은 파일) 세 곳이 유사 순회(lazy clone-on-write, depth cap, `__proto__` 안전) 로직을 각자 재구현 | `websocket.service.ts` `stripDeep` vs `sanitize-error-message.ts` `deepRedactSecrets` | Critical #1 해소 시 공유 순회 프리미티브로 통합 고려(급하지 않음) |
| 2 | rationale_continuity | 코드 diff(`stripDeep` 깊이 무관 strip) 자체는 Rationale 연속성 위반 아님 — 오히려 기존 WS §4.4 "모든 외부 수신자 strip" 선언을 실제로 충족시키는 정당한 수정 | `websocket.service.ts` `stripDeep`/`stripExternalOnlyFields` | 조치 불필요 |
| 3 | plan_coherence | `eia-terminal-payload.md` "함께 넘기는 spec 항목" 표(4항목)가 `spec-draft-eia-62-waiting-payload.md` 의 실질 6항목 확장을 반영 안 함. 기능적으로 막지는 않음 | `plan/in-progress/eia-terminal-payload.md` "### 함께 넘기는 spec 항목" | 저비용, 다음에 표 열 때 함께 갱신 |
| 4 | naming_collision | 이번 diff·직전 라운드(11_02_18) 이후 증분 모두 신규 식별자 도입 없음(`stripDeep` 경계 연산자 통일 + 회귀테스트만) | 전역 | 조치 불필요, NONE 판정 유지 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | REST `getStatus` 가 fanout strip 을 우회해 `llmCalls` 유출 |
| rationale_continuity | HIGH | spec 초안이 명시 기각된 "§6.2 직접 재작성" 대안을 근거 없이 재도입 |
| convention_compliance | LOW | `llmCalls` strip-only SoT 가 실제 누출 지점(`waiting_for_input`)을 안 덮음(문서 갭, 즉시 위험 아님) |
| plan_coherence | LOW | `spec_impact` 경로 오류 + 형제 plan 교차 참조 누락, 둘 다 이전 라운드부터 미해소 |
| naming_collision | NONE | 신규 식별자 없음, 충돌 없음 |

## 권장 조치사항
1. (BLOCK 해소, Critical #1) `interaction.service.ts` `getStatus()` 에 `stripDeep`/`EXTERNAL_STRIPPED_FIELDS` 와 동등한 필드 strip 을 `deepRedactSecrets` 와 함께 적용 — REST 스냅샷 표면의 `llmCalls` 누출을 fanout 과 동일 수준으로 닫는다. 공유 유틸(`shared/utils`)로 승격해 세 번째 드리프트 재발을 구조적으로 막는 것을 권장.
2. (BLOCK 해소, Critical #2) `spec-draft-eia-62-waiting-payload.md` 의 "변경 제안 (1)/(3)" 에 대해 caveat 유지(권장) 또는 명시적 번복(WS Rationale addendum 동반) 중 하나를 선택해 draft 를 수정 — 결정을 내리지 않은 채로 두면 이 draft 가 다음 planner 턴에 그대로 spec 에 반영될 위험이 있다.
3. Critical #1 해소 시 WARNING #1(convention_compliance) 의 SoT 문서 갭도 함께 정리(EIA §6.2/§R17 에 `llmCalls` strip 명문화).
4. Critical #2 의 선택 결과에 맞춰 WARNING #3(spec_impact 에 `6-websocket-protocol.md` 추가)·WARNING #5(형제 plan 교차 참조) 를 같은 턴에 처리.
5. WARNING #4(`spec_impact` 잘못된 경로 `spec/5-system/1-data-model.md` → `spec/1-data-model.md`) 는 저비용이므로 위 항목들과 함께 정정.
6. INFO 항목들은 급하지 않음 — Critical/WARNING 정리 후 여력이 있을 때 반영.