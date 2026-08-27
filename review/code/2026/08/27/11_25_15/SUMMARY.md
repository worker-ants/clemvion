# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 코드 변경(config echo 마스킹을 어댑터→egress 로 이동)은 4개 reviewer 전원이 기능·보안 회귀 없음으로 확인했고 직전 라운드(`10_53_52`) CRITICAL(포함관계 캐너리 미파생)도 실측 재현으로 해소가 검증됐다. 다만 그 수정이 "boundary 참조 4곳 전부 정정했다"고 `RESOLUTION.md`/plan 에 선언한 것과 달리, `spec/conventions/node-output.md:256` 이 폐기된 메커니즘을 여전히 근거로 인용하며(같은 파일 내 자기모순), `4-execution-engine.md:193` 도 형제 문단만 누락, `ai-agent.md` 의 정정문 자체가 논리적으로 틀린 다른 오류로 대체됐다 — 이 저장소가 반복 겪어 온 "미러 스윕이 몇 곳을 놓친다" 클래스가, 그것을 닫았다고 주장하는 바로 그 커밋에서 재발했다. CRITICAL 발견 없음, forced reviewer 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서(spec 미러 스윕) | `RESOLUTION.md`/plan 이 "boundary 참조 4곳 전부 정정했다"고 선언했으나 `node-output.md:256` 은 실제로 손대지 않았다 — 여전히 "credential 제거 정책은 `_resumeState` 와 동일 (`maskSensitiveFields` 가 boundary 에서 strip)" 이라 서술, 같은 파일에 새로 추가된 블록(339~350행, "마스킹은 egress 에서만")과 정면 모순 | `spec/conventions/node-output.md:256` | 다른 4곳과 동일 톤(취소선 + "→ egress 마스킹" 또는 "allow-list 로 애초에 배제", 2026-08-24 정정)으로 정정. `RESOLUTION.md`/plan 소급 수정은 불요, 이번 라운드에서 실제 정정으로 "네 곳"을 완성 |
| 2 | 문서(spec 미러 스윕) | 같은 파일 안에서 `_retryState` 서술(`:203`)은 올바르게 취소선+"allow-list 배제"로 정정됐으나, 바로 위 자매 필드 `_resumeCheckpoint` 서술(`:193`, "동일 masking 정책"으로 명시적으로 짝지어짐)은 취소선 없이 폐기된 boundary 를 그대로 인용 | `spec/5-system/4-execution-engine.md:193` (대조: `:203`) | `:193` 도 `:203` 과 동일한 정정 패턴(`~~maskSensitiveFields~~` → **allow-list 배제**)으로 맞춘다 |
| 3 | 문서(정정 자체의 오류) | `ai-agent.md` 두 곳의 "정정"이 논리적으로 틀렸다 — 해당 필드(`llmConfigId` 등)는 allow-list 로 **애초에 미동봉**되는데(코드 주석·`buildRetryState`/`buildResumeState` 구현으로 확인), 정정문은 "미동봉이며 → **egress 마스킹**" 이라 써서 "존재하지 않는 값에 마스킹이 적용된다"는 자기모순을 만든다. 형제 문서(`4-execution-engine.md:203`)가 쓴 올바른 "allow-list 배제" 표현과 대조하면 불일치가 바로 드러남 | `spec/4-nodes/3-ai/1-ai-agent.md:755`, `:979` | "미동봉이며 (~~`maskSensitiveFields` boundary strip`~~ → **allow-list 로 애초에 배제** — boundary 는 2026-08-24 제거, 이 배제는 그것과 무관)" 형태로 재정정. (`:1114` 의 `requestPayload` egress 마스킹 서술은 별개 필드라 무관, 정확함) |
| 4 | 보안(재확인, 기지 사안) | config echo 안전성이 "safe-by-construction" 에서 "safe-by-convention"(egress 마스킹 단독 의존)으로 이동 — 워크플로우 표현식(`$node["X"].config.<field>`)을 통한 크로스-노드 자격증명 릴레이는 egress 초크포인트를 지나지 않아 구조적으로 열려 있음. 단, spec R-5 정정 블록과 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이미 "미판정" 백로그로 명시 등재됨 — 신규 미문서화 결함 아님 | `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53`, `spec/2-navigation/14-execution-history.md:479-484` | 기존 백로그(자격증명 참조 간접화, 예: `llmConfigId` 패턴 확산) 우선순위 유지, 이 PR 은 비차단 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 직전 라운드 CRITICAL(포함관계 캐너리 미파생)이 실제로 고쳐졌음을 독립 검증 — `DEFAULT_SENSITIVE_KEYS` export + `[...DEFAULT_SENSITIVE_KEYS]` 직접 spread, 22개 키 전부 `CREDENTIAL_KEY_PATTERN` 매칭 확인 | `mask-sensitive-fields.util.ts:10`, `.spec.ts:139` | 없음(양호) |
| 2 | 테스트 | 동일 CRITICAL 수정을 M4 뮤턴트(`oauthCredXYZ` 추가) 독립 재현으로 재검증 — 42 total/1 failed 관측, RESOLUTION.md 주장과 일치 | `mask-sensitive-fields.util.spec.ts` | 없음(양호) |
| 3 | WS 정규식 비대칭(기지 사안, 별건 추적 중) | WS 전용 로컬 `CREDENTIAL_KEY_PATTERN` 사본이 공유본보다 좁음(`x-api-key` 미포함). 단 config echo 경로(`maskWireEnvelope`)는 이 로컬 정규식이 아니라 공유 `deepRedactSecretsPreserving` 사용 확인 — 이 PR 영향 없음 | `websocket.service.ts:78-79` vs `sanitize-error-message.ts:113` | 이 PR 범위 아님. 통합 시 넓은 쪽(REST)으로 합칠 것 |
| 4 | 테스트 | 빈 문자열(`''`) 자격증명 값이 어느 캐너리에도 없음 — 이 PR 로 실제 동작이 바뀐 지점(어댑터 마스킹 제거로 빈 값도 egress 까지 원문 통과, 단 값이 비어 있어 실질 유출 없음)인데 미고정 | `mask-sensitive-fields.util.spec.ts:145-153`, `sanitize-error-message.ts` `deepRedactObject` 가드 | `[대조군]` 캐너리 1건 추가해 사각을 의도로 명시 |
| 5 | 테스트 | 안전 주장 캐너리들이 실제 egress 진입점(`redactStoredDataForResponse`/`maskWireEnvelope`)이 아니라 공유 저수준 함수 `deepRedactSecrets` 를 직접 호출 (기존 갭, 다른 리뷰어도 동일 지적) | `handler-output.adapter.spec.ts:179-215` | 진입점 자체를 검증하는 통합 테스트 존재 여부 별도 확인 권장(존재 시 종결) |
| 6 | 문서 | 취소선 정정이 남긴 문법적으로 끊어진 문장(주어 없는 잔여 절) — 이전 라운드(`10_53_52`)가 이미 지적했으나 미수정 상태 지속 | `mask-sensitive-fields.util.ts:26-28` (인라인 주석) | 잔여 절을 유일한 남은 소비처(`explore-tools.service.ts`)를 주어로 재연결하거나 전체 취소선 처리 |
| 7 | 문서/요구사항 (영향 범위) | 위 WARNING 1~3(spec 정정 관련)은 전부 문서 전용 결함이며 런타임 동작에는 영향 없음 — `buildRetryState`/`buildResumeState` 의 allow-list 구현 자체는 diff 전후 불변, 정확함 | `ai-turn-executor.ts` | 기능 회귀 아님. 다만 "완결된 mirror sweep" 이라는 이 PR 자신의 주장과의 괴리는 신뢰도 문제로 남음 |
| 8 | 회귀/일반 | 회귀 스위트(ai-agent·execution-engine·workflow-assistant, 1780 tests) 및 핵심 유닛(83 tests, 2 suites) 재실행 전체 GREEN. 하드코딩 시크릿 없음(테스트 픽스처는 합성값). 리뷰 도중 관측된 공유 worktree 뮤테이션 오염(`oauthCredXYZ`)은 HEAD/작업트리 재확인 결과 일시적 현상, 실결함 아님 | 다수 | 없음(확인 완료). CHANGELOG·plan 체크리스트는 정확히 갱신됨(잘된 점) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 직전 CRITICAL 해소 재검증, config echo safe-by-convention 트레이드오프는 기지 사안(백로그 등재), WS 정규식 비대칭은 이 경로 영향 없음 |
| testing | LOW | CRITICAL 수정 M4 뮤턴트 독립 재현 성공, 빈 문자열 값·저수준-vs-egress 진입점 갭은 저우선 INFO |
| requirement | LOW | 핵심 코드 정확, 단 spec 미러 스윕 3곳 불완전(WARNING) — 문서 전용, 런타임 영향 없음 |
| documentation | MEDIUM | `node-output.md:256` 자기모순 stale 인용이 "네 곳 전부 정정" 주장과 배치, 문법 끊긴 문장 잔존 |

## 발견 없는 에이전트

없음 (4개 reviewer 전원 발견사항 보고).

## 권장 조치사항
1. `spec/conventions/node-output.md:256` 을 다른 4곳과 동일한 취소선+정정 패턴으로 고친다 (WARNING 1) — "네 곳 전부 정정" 을 실제로 완성.
2. `spec/5-system/4-execution-engine.md:193` (`_resumeCheckpoint`) 를 `:203` 과 동일하게 정정한다 (WARNING 2).
3. `spec/4-nodes/3-ai/1-ai-agent.md:755`,`:979` 의 정정문 자체를 "allow-list 로 애초에 배제" 로 재정정한다 — 현재 "egress 마스킹" 귀속은 논리적으로 성립하지 않는다 (WARNING 3).
4. (선택, 저우선) 빈 문자열 자격증명 값 대조군 캐너리 추가, 취소선 잔여 문장 정리(INFO 4, 6).
5. config echo → 표현식 크로스-노드 릴레이 백로그(자격증명 참조 간접화)는 기존 우선순위 유지, 이 PR 비차단 (WARNING 4).

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(security, testing, requirement, documentation) 실행. 제외/강제 없음, forced 전원 결과 확보됨.