# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 미갱신 — 이 PR 과 동일 계열의 직전 6개 커밋 전부가 지킨 관행이 이번만 깨짐
  - 위치: `CHANGELOG.md` (이번 diff 에 포함되지 않음 — 54개 변경 파일 목록에 없음)
  - 상세: 이 저장소는 `git log --oneline -- CHANGELOG.md` 기준 최근 EIA/종결-emit 계열 커밋
    (#1171~#1177, 예: `107c8038f fix(eia): 종결 error.message 가 마스킹 없이 외부 제3자에게
    나가고 있었다`) 전부가 "## Unreleased — …" 섹션을 추가해 **wire 변화**(응답 바이트가
    바뀐다)를 명시해 왔다. 이번 변경은 정확히 같은 범주다 — `GET /api/executions/:id` 외
    내부 REST 4표면 + WS `execution.snapshot` 의 `Execution.error`/`nodeExecutions[].error`
    응답 바이트가 이제 마스킹된 값으로 바뀐다(자격증명 형태 부분문자열 → `***`). plan
    (`plan/in-progress/eia-internal-rest-error-masking.md:43`)도 "프런트가 실패 배너에
    `error.message` 를 그대로 렌더한다" 고 스스로 적어, 이 값이 사용자에게 보이는 문자열임을
    인지하고 있다. 그런데도 `CHANGELOG.md` 는 이번 diff 에서 전혀 건드리지 않았다 — 직전
    6개 커밋이 세운 관행과 어긋난다.
  - 제안: 기존 "종결 이벤트 `error` 가 자격증명 마스킹 없이 외부로 나가고 있었다" 항목과
    같은 형식으로 "## Unreleased — 내부 REST/WS 읽기 경로의 `Execution.error` 도 마스킹"
    항목을 추가하고, 영향받는 표면(4개 REST + WS snapshot) · wire 변화 예시 · 잔여 갭(자격증명
    없는 연결 문자열 등 통과)을 기존 항목과 동일한 톤으로 기록할 것. push 게이트 전에
    반영하면 됨(현재 plan 체크리스트도 아직 `--spec`/`/ai-review`/`--impl-done`/push 가
    모두 미완료 상태라 진행 중 시점의 지적임).

- **[WARNING]** `eia-internal-rest-error-masking.md` 자체 체크리스트가 같은 diff 안에서 이미
  완료된 항목을 미완료로 표기
  - 위치: `plan/in-progress/eia-internal-rest-error-masking.md:264`
    (`- [ ] 정본 트래커 **I1·D 닫기**`)
  - 상세: 이 항목이 가리키는 실제 작업물인 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    는 같은 diff 안에서 I1 항목(gate 180, `- [x] **내부 REST 와 WS 가 같은 \`Execution.error\`
    에 다른 값을 말한다**`)과 D 항목(gate 193, `- [x] \`interaction.triggerToken\` 이
    \`SecretResolver\` 미경유 …`)이 이미 `[x]` 로 닫혀 있다. 즉 "I1·D 닫기" 라는 조치는 실제로
    완료됐는데, 그 완료를 추적하는 상위 plan 의 체크박스만 갱신되지 않았다. 프로젝트가 이미
    반복적으로 겪은 "plan 체크박스가 실제 상태를 반영하지 않는다" 패턴과 정확히 같은 형태이며,
    바로 아래 gate 265 의 "정본 트래커 **신규 잔여 등재**" 항목은 `[x]` 로 정확히 갱신돼 있어
    한 항목만 누락된 것이 더 눈에 띈다.
  - 제안: gate 264 를 `[x]` 로 갱신. (사소하지만 이 plan 문서가 아직 `plan/in-progress/` 에
    있고 뒤이은 체크리스트 항목들도 미완료 상태이므로, push 전 마무리 단계에서 함께 정리하면
    충분함.)

- **[INFO]** 그 외 문서화 품질은 이 PR 전체에서 이례적으로 높음 — 아래 항목은 조치 불요, 확인만
  기록
  - `codebase/backend/src/shared/utils/redact-stored-error.ts` 의 함수 JSDoc(gate 6~56)이
    "왜 필요한가"·"왜 `toTerminalErrorPayload` 를 안 쓰나"·"보장의 경계"·`@param`/`@returns`
    까지 상세히 기술하고, 그 안의 사실 주장(`GET /api/executions/:id` 에 `@Roles` 게이트
    없음 · viewer 포함 전원 조회)을 실제 컨트롤러(`executions.controller.ts:63`,
    `background-runs.controller.ts:24`)로 직접 대조했고 정확했다.
  - `executions.service.ts` 의 `toResponseExecution`/`stopInternal`/`stop` 독스트링(gate
    758~921 부근)이 "함수를 왜 나눴는지"(반환 지점이 4개인 함수를 관문 하나로 좁힘)를
    구체적으로 설명하고, 실제 코드 구조(`stop` → `stopInternal` 위임)와 정확히 일치했다.
  - `spec/5-system/14-external-interaction-api.md`(gate 1483~1512) · `spec/2-navigation/14-execution-history.md`(gate 467)
    · `spec/5-system/6-websocket-protocol.md`(gate 182) · `spec/4-nodes/1-logic/12-background.md`(gate 245)
    · `spec/conventions/secret-store.md`(gate 42~48) 5개 spec 문서가 이번 코드 변경과 정확히
    같은 턴에 동기화됐고, 상호 상대경로 링크(`../conventions/secret-store.md`,
    `../../5-system/14-external-interaction-api.md` 등)를 직접 파일시스템 경로로 검증한
    결과 전부 유효했다.
  - `plan/complete/` 로 이동한 5개 plan(`eia-stalled-atomicity.md` 등)을 가리키던
    `plan/in-progress/*.md` 내부의 `./old-name.md` 상대링크가 이번 diff 에서 전부
    `../complete/old-name.md` 로 정확히 갱신됐다(파일 8·14·19·21·24). 저장소 전체를 grep 한
    결과 갱신 누락된 stale 링크는 발견되지 않았다.
  - `spec/5-system/14-external-interaction-api.md`·`spec/2-navigation/14-execution-history.md`
    frontmatter `code:` 목록에 신규 파일 `redact-stored-error.ts` 가 추가됐고,
    `background-runs.service.ts` 는 이미 `spec/4-nodes/1-logic/12-background.md` 의 glob
    (`background-runs/**`)에 포함돼 있어 별도 추가가 불필요함을 확인했다.
  - `executions.service.spec.ts`/`background-runs.service.spec.ts`/`redact-stored-error.spec.ts`
    의 신규 테스트마다 "왜 표면별로 따로 단언하는지"·"캐시 안쪽에 마스킹을 둔 이유"·"형제
    필드 우회를 막는 이유" 를 설명하는 블록 주석이 붙어 있어 인라인 주석 관점에서도 충분함.

## 요약

이번 PR 은 `Execution.error` 응답 마스킹을 신규 유틸(`redactStoredErrorForResponse`)로
도입하며 코드 JSDoc·테스트 주석·5개 spec 문서·plan 문서를 같은 턴에 촘촘히 동기화했고,
직접 대조한 사실 주장(권한 게이트 부재, 링크 경로, frontmatter `code:` 목록, 옛 이름
잔존 여부)은 전부 정확했다. 유일한 실질적 갭은 두 가지다 — (1) 같은 계열의 직전 6개
커밋이 전부 지킨 `CHANGELOG.md` "wire 변화" 기록 관행이 이번엔 비어 있고, (2) 작업을
추적하는 plan 자체 체크리스트 한 줄(`정본 트래커 I1·D 닫기`)이 같은 diff 안에서 이미
완료된 실제 상태를 반영하지 못했다. 둘 다 push 전에 한 줄씩 고치면 해소되는 수준이다.

## 위험도

LOW
