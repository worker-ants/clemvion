# Rationale 연속성 검토 — guide-error-code-truth (impl-done, scope=spec/5-system/)

## 조사 방법

`spec/5-system/**` 파일 델타는 이번 라운드도 0(코드·문서 전용 PR). 프롬프트 번들이 예산
초과로 `3-error-handling.md`·`7-llm-client.md` 등 17개 spec 파일 본문과 `<git diff
origin/main...HEAD -- code_areas>` 자체를 절단했으므로, 워킹트리에서 직접
`git diff origin/main...HEAD`(21파일)를 확인하고, diff 가 인용하는 spec 문서
(`3-error-handling.md §1.4`, `2-navigation/4-integration.md` Rationale §9.1 항,
`5-system/7-llm-client.md §8.3/§8.4`, `conventions/error-codes.md`)를 절대경로로 직접
Read 해 원문과 대조했다. 또한 같은 세션의 선행 rationale_continuity 라운드
(`10_12_54`·`10_41_13`·`11_08_03`·`11_33_51`, 전부 CRITICAL/WARNING 0)와
`plan/in-progress/guide-error-code-truth.md`·`spec-draft-nullable-notation-followups.md`
의 처분 이력을 대조해, `11_33_51` 이후 유일하게 추가된 코드 변경분(커밋 `42680d5f9`,
`MAKESHOP_UNRESOLVED_PATH_PARAM` 가이드 정정 — `naming_collision` CRITICAL 해소)까지
포함해 신규 회귀가 있는지 확인했다. `42680d5f9` 이후 최신 커밋(`171627852`)은
`.claude/tools/run-test-all.sh` 등 harness 전용 변경이라 본 스코프(spec/5-system 관련
codebase 변경) 밖이다.

## 발견사항

없음 — CRITICAL/WARNING 대상 없음.

### [INFO] "결과 객체 필드명은 에러 봉투와 겹치면 안 된다" 원칙이 여전히 spec Rationale 부재 (선행 INFO 승계 확인)

- target 위치: `codebase/backend/src/modules/llm/llm.service.ts` `testConnection` JSDoc.
  이번 라운드 diff 로 이 지점 자체는 변화 없음(선행 `11_08_03`·`11_33_51` 라운드와 동일 지점).
- 과거 결정 출처: `spec/2-navigation/4-integration.md` `## Rationale`의 "연결 테스트
  endpoint 의 `pending_install` 가드 — 응답 형식" 항 — *"`:id/test` 는 '검증'이 아니라
  '테스트를 수행하고 결과를 반환'하는 endpoint. 결과 body 형식이 이미 `{ success, code,
  message }` 의 success/false 패턴이라 가드 결과도 같은 shape 으로 표현하는 게 자연스럽다"*
  (원문 대조 확인, 정확히 일치).
- 상세: `llm.service.ts` 는 `POST /api/model-configs/:id/test` 의 실패 필드를 `error` →
  `message` 로 고치며 JSDoc 에 *"에러 봉투(`{ error: { code, message } }`)와 이름이 겹치면
  안 된다"* 는 근거를 남겼다. 이 근거 자체는 타당하고 형제 엔드포인트(`/integrations/:id/test`)
  와의 의도적 차이(코드 有 vs 8갈래 고정 문장만·코드 無)도 diff 주석·plan 양쪽에서 정합하게
  설명된다. 다만 이 원칙이 아직 **spec Rationale 에는 없고 JSDoc 한 곳에만** 존재한다 —
  다음 사람이 유사 엔드포인트를 설계할 때 같은 판단을 반복해야 한다.
- 이미 처리됨: 이 INFO 는 신규가 아니라 **승계 상태 확인**이다.
  `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `testConnection 실패 응답
  shape 이 어느 spec 표에도 없다` 항목(3227~3236행)이 정확히 이 라운드 인용
  (`--impl-done 11_08_03 rationale_continuity INFO#2`)을 그대로 담아 planner 백로그에 편입
  돼 있음을 diff 로 확인 — 유실 없음. spec 본문 자체는 아직 미반영이므로 동일 INFO 를 유지한다.
- 제안: 변경 불요, BLOCK 대상 아님. 해당 planner 백로그 항목 처리 시
  `7-llm-client.md §8.3` 또는 `2-api-convention.md` Rationale 에 이 원칙과, 형제 엔드포인트와
  다른 이유("이쪽은 코드가 없다")를 함께 명문화할 것.

## `11_33_51` 이후 추가된 코드 변경분(`42680d5f9`)에 대한 확인

- **`MAKESHOP_UNRESOLVED_PATH_PARAM` 인용 제거 + `<Callout>` 대체**: 직전 라운드(`11_33_51`)가
  아직 못 잡았던 오귀속(`INTEGRATION_CALL_FAILED` 가 실제 방출 코드이고
  `MAKESHOP_UNRESOLVED_PATH_PARAM` 은 `Error` 메시지 접두일 뿐)을 `--impl-done`
  naming_collision 이 CRITICAL 로 잡은 뒤 정정한 것. 실제 코드(`makeshop.handler.ts:359,435`)
  와 대조해 서술이 정확하다. **은퇴 코드 재도입이 아니라 오귀속 정정**이며, "핸들러가
  `IntegrationError` 를 던지도록 바꾸는 안(동작 변경)은 채택하지 않는다 — 가이드는 *현재 동작*
  을 서술하는 문서"라는 판단은 `spec/conventions/user-guide-evidence.md` 의 가이드-코드
  정합 취지(가이드는 실제 코드 상태를 서술해야 한다)와 방향이 같다. spec 변경 없이 developer
  권한 안에서 처리 가능한 범위다.
- **가드(`guide-error-code-scan.ts`) 자체 한계 주석 추가**: "존재 검사이지 방출 검사가 아니다"
  를 실측(같은 PR 이 그 구멍으로 오귀속을 통과시켰다는 사실)과 함께 적었고, 기각한 대안
  (술어를 리터럴/enum 키로 좁히는 안)도 프로브 결과(101종 중 8종 RED, 6종 오탐)를 근거로
  적었다 — "Rationale '기각된 대안'은 실제 이력 필수" 원칙에 부합하는 형태다.
- 이 두 변경 모두 기존 spec Rationale 과 충돌하지 않으며, 새 Rationale 이 필요한 성격의
  결정 번복도 아니다(오류 정정).

## 교차 검증한 항목 (선행 라운드부터 유지, 회귀 없음)

- 은퇴 코드(`NODE_EXECUTION_FAILED`/`INTEGRATION_ERROR`/`LLM_ERROR`) 재도입 없음 —
  `error-handling.mdx`/`run-results{,.en}.mdx` 는 `spec/5-system/3-error-handling.md §1.4`
  의 "더 이상 사용하지 않는다" 서술을 그대로 따른다.
- CWE-209 원문 미노출 원칙(`2-api-convention.md §5.3`): `sanitizeLlmErrorMessage` 8갈래
  고정 문장 + `guide-sanitized-message-parity.test.ts` 양방향 대조로 유지·강화.
- `nodeName` → `nodeLabel`: `3-error-handling.md` 자신의 2026-08-17 정정을 문서가 뒤늦게
  따라간 것 — 신규 번복 아님.
- `IntegrationTestResult`(`code`/`meta`) DTO 변경: `2-navigation/4-integration.md` Rationale
  이 이미 문서화한 `{success, code, message}` shape 에 DTO 를 맞춘 것 — 대안 재도입 아니라
  낡은 DTO 를 기존 결정에 정합화.
- Planned 로드맵 코드(`LLM_AUTH_ERROR`/`LLM_MODEL_NOT_FOUND`) 가드 배제: `7-llm-client.md
  §6` "미구현(Planned)" 표기와 정합.

## 요약

이번 라운드는 `spec/5-system` 델타 0 상태에서 `11_33_51` 이후 추가된 유일한 코드 변경분
(`42680d5f9`, MakeShop 오귀속 정정 + 가드 한계 주석)까지 포함해 diff 전체를 재확인했다.
은퇴된 결정(구 에러 코드 3종)은 재도입되지 않았고, 합의된 설계 원칙(§9.1 결과-객체 패턴,
CWE-209 비노출, `nodeLabel` 정정 승계, 가이드는 현재 동작을 서술)이 모두 spec 원문과
대조해 지켜지고 있다. 유일하게 남은 항목은 4라운드 연속 승계돼 온 INFO 하나
("결과 객체 필드명은 에러 봉투와 겹치면 안 된다" 원칙이 JSDoc 에만 있고 spec Rationale
에는 아직 없음)이며, 이는 이미 `spec-draft-nullable-notation-followups.md` 에 정확히
인용·편입돼 유실 위험이 없다. Rationale 연속성 관점에서 이 PR 을 막을 사유는 없다.

## 위험도

NONE
