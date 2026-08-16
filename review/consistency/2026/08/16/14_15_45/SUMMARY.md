# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5개 checker 전원 CRITICAL 0건)

## 전체 위험도
**LOW** — target(`spec-draft-eia-error-masking-catalog.md`, §R17 5번째 불릿 신설 + §6.4 캐비엇 추가)은 기존 spec/코드와 모순되지 않으나, `error`/`error.message` 필드명이 `execution.failed`(마스킹 대상)와 `execution.cancelled`(마스킹 비대상)에 걸쳐 재사용되는 비대칭이 필드-집합 표에 문서화되지 않은 WARNING 1건이 남아 있음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `error`/`error.message` 필드명이 `execution.failed`(이번에 마스킹 대상으로 명시)와 `execution.cancelled`(시스템-취소, `toTerminalErrorPayload` 미경유 hand-built 경로라 마스킹 미적용)에 걸쳐 재사용되는데, 이 비대칭이 §6 "종결 이벤트의 필드 집합(normative)" 표(`error` 행이 두 이벤트를 한 행에 묶음, L573-579)에 반영되지 않음. target 자신이 경계한 "이름이 같은 두 `error`" 함정이 세 번째 지점에서 재발할 소지 | §R17 5번째 불릿 / §6.4 캐비엇 | `spec/5-system/14-external-interaction-api.md:573-579` §6 필드-집합 표 `error` 행 + 실제 코드(`execution-engine.service.ts` `emitCancellationEvent` 등)의 hand-built `cancelled.error` 경로 | §R17 5번째 불릿 또는 §6.4 캐비엇에 "`execution.cancelled`의 시스템-취소 `error.message`는 이 마스킹 대상이 아니다(별도 hand-built 경로, `toTerminalErrorPayload` 미경유)" 한 줄 명시, 또는 §6 필드-집합 표 `error` 행에 각주 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | R17 "표면 제약(보안)" preamble 이 `outputData`/`conversationThread` 두 표면만 명시 선언하는데, 신설 불릿은 `Execution.error`(DB 컬럼, 세 번째 데이터 소스)를 다뤄 preamble 범위와 살짝 어긋남 | R17 preamble + 신설 5번째 불릿 | preamble 에 "EIA 가 외부로 노출하는 보안 마스킹 전수를 카탈로그한다" 류 한 문장 보강(선택) |
| 2 | rationale_continuity | "위 `conversationThread` 불릿이 기각한 것과 같은 이유" 인용이 근사 유비 — 원 근거(LLM 컨텍스트 오염 위험)는 이 필드(서버 로그·디버깅 텍스트)에 그대로 적용되지 않음. 결론(egress-only)은 정합 | 신설 불릿 `egress-only(§R17 원칙 준수)` 서브 불릿 | "같은 원칙(내부 소비처 faithful 보존) — 다만 구체 근거는 서버 로그·디버깅 가치 보존"으로 정밀화(선택) |
| 3 | convention_compliance | "위 3번째 불릿의 `outputData` 기반 `error`" 식 서수(ordinal) 기반 상호참조 — 문서 관행상 앵커/링크가 아닌 손으로 센 서수라 향후 재배열 시 stale 위험 | 신설 불릿 본문 (2회) | 서수 대신 불릿 텍스트로 직접 인용(예: "`nodeOutput.conversationConfig` 불릿의 `error`")(선택) |
| 4 | convention_compliance | 신설 불릿 제목만 3줄에 걸친 굵게 처리 — 형제 불릿들은 모두 한 줄 | 신설 불릿 제목 | 컬럼 구분 캐비엇을 굵게 제목 밖 본문 첫 문장으로 이동(선택) |
| 5 | plan_coherence | target 이 전제로 삼는 선행 plan `eia-terminal-error-sanitize.md`(#1177)가 이미 origin/main 에 머지됐는데(커밋 `107c8038f`), 그 plan 파일 자체는 여전히 `plan/in-progress/`에 있고 마지막 체크박스(`push 게이트 통과 → PR`)가 미체크 상태로 stale | frontmatter `pending_plans` / Overview | `eia-terminal-error-sanitize.md` 마지막 체크박스 `[x]` 갱신 + `plan/complete/` 이동(같은 세션에서 함께 처리 권장, target 필수 작업은 아님) |
| 6 | plan_coherence | §R17 신설 불릿의 R-5(`14-execution-history.md`) 인용이 "결정하지 않는다"는 선언 바로 옆에서 I1(내부 REST 비대칭 미결)의 "의도된 비대칭" 선택지를 사실상 미리 배제하는 논증으로 읽힐 소지. 인용 자체는 정확(허위 아님) | 신설 불릿 "내부 REST 와의 비대칭은 아직 미결이다" 하위 항목 | `--spec` 재검토 시 "이 논증도 I1 결정 시 함께 검토할 재료" 정도로 톤 완화 검토(선택) |
| 7 | naming_collision | R17 3번째 불릿(`nodeOutput.conversationConfig`+terminal)에는 새 5번째 불릿을 가리키는 정방향(역) 참조가 없음 — 5번째→3번째만 있음 | R17 3번째 불릿 | 3번째 불릿 끝에 "관련: 아래 5번째 불릿(`execution.failed`의 `error` 마스킹)" 한 줄 추가(선택) |
| 8 | naming_collision | "5번째 불릿 신설"이라는 서수 표현이 실제 삽입 결과와 어긋남 — 현재 R17 절은 불릿 4개뿐이라 3번째 뒤 삽입 시 신설 불릿은 실제로는 4번째이고 기존 4번째(`nodeOutput` allowlist)가 5번째로 밀림 | "① §R17 — 5번째 불릿 신설" 표제 | 반영 시 서수를 실제 삽입 위치 기준으로 정정(또는 불릿 텍스트로 지칭) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | R17/§6.4 신설 내용이 실제 코드(`interaction.service.ts`, `terminal-error-payload.ts`)·기존 spec(1-data-model §2.14, 2-navigation R-5, chat-channel-adapter §1.2)과 모두 정합. preamble 범위 관련 INFO 1건뿐 |
| rationale_continuity | LOW | 기각된 대안 재도입·원칙 위반·무근거 번복 없음. 오히려 직전 라운드(14_04_55)의 실제 CRITICAL(미결 항목 조용히 확정)을 스스로 지목·정정한 이력이 모범적. "같은 이유" 인용의 근사 유비만 INFO |
| convention_compliance | NONE | 명명·포맷·문서구조·API문서·금지항목 규약 위반 없음. 함수명·경로 전부 실제 코드와 1:1 대조 확인. 서수 참조·굵게 줄수는 INFO |
| plan_coherence | LOW | 14_04_55 CRITICAL 2건 + WARNING 2건 전부 실측 가능한 형태로 해소 확인. 선행 plan(#1177) 체크리스트 stale, R-5 인용 톤 재확인 필요성만 INFO |
| naming_collision | LOW | 신규 식별자(ID/엔티티/endpoint/이벤트/ENV) 도입 없음. `error`/`error.message`가 `failed`/`cancelled`에 걸쳐 재사용되며 마스킹 비대칭이 필드-집합 표에 미반영된 것이 WARNING 1건, 서수·역참조 관련 INFO 2건 |

## 권장 조치사항
1. (WARNING 해소) §R17 5번째 불릿 또는 §6.4 캐비엇에 "`execution.cancelled`의 시스템-취소 `error.message`는 이 마스킹 대상이 아니다" 한 줄 명시 — 또는 §6 필드-집합 표 `error` 행에 각주 추가.
2. "5번째 불릿 신설" 서수 표현을 실제 삽입 위치(4번째, 기존 4번째는 5번째로 밀림) 기준으로 정정.
3. (선택, 값싼 동반 정리) 선행 plan `eia-terminal-error-sanitize.md` 마지막 체크박스 갱신 + `plan/complete/` 이동.
4. (선택) R17 preamble 범위 문구 보강, "같은 이유"→"같은 원칙(근거는 다름)" 정밀화, 서수 대신 불릿 텍스트 인용, 3번째 불릿에 5번째 불릿 역참조 추가, R-5 인용 톤 완화 — 모두 병합을 막지 않는 표현 개선.