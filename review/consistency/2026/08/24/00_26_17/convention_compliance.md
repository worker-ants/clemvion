# 정식 규약 준수 검토 — `spec/conventions/conversation-thread.md` (diff: origin/main...HEAD)

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`.
diff 범위 내 `spec/conventions/**` 실제 변경 파일은 `conversation-thread.md` 1개뿐이다
(§8.4 "소비처 갱신 (2026-07-09)" 문단에 5줄 정정 blockquote 추가). 이 검토는 그 변경과,
같은 diff 에 포함된 `spec/5-system/14-external-interaction-api.md` §R17,
`spec/5-system/6-websocket-protocol.md` §4.4, `CHANGELOG.md` 의 병렬 정정, 그리고 근거
코드(`node-output-allowlist.ts` / `websocket.service.ts` / `interaction.service.ts`)를
대조해 규약 준수 여부를 판정한다.

## 발견사항

- **[INFO]** `code:` frontmatter 가 정정문이 인용하는 새 구현 심볼을 포함하지 않는다
  - target 위치: `spec/conventions/conversation-thread.md` frontmatter `code:` (44-66행) vs §8.4 정정 blockquote (390-391행)
  - 관련 규약: `spec/conventions/spec-impl-evidence.md` R-1 (`code:` 글로브는 "영역 단위 책임"을 표현), `spec-code-paths.test.ts` (최소 1개 매치만 강제 — exhaustive 아님)
  - 상세: 새로 추가된 정정 blockquote 는 `WebsocketService.toFanoutEnvelope` / `emitExecutionEvent` / `emitNodeEvent` (전부 `codebase/backend/src/modules/websocket/websocket.service.ts` 소재) 를 근거 심볼로 인용하지만, frontmatter `code:` 목록에는 이 파일이 없다 (`interaction.service.ts` 는 이미 등재돼 있음). R-1 은 glob 기반 "영역 책임" 표기라 이 gap 자체가 가드 위반은 아니며 fail 도 안 난다 — 다만 이 문서가 웹소켓 fanout 배선을 근거로 삼는 주장을 이번 정정에서 새로 늘렸으므로, 추적성 관점에서 `websocket.service.ts` 를 code: 에 더하는 편이 §8.4 의 다른 근거(§4 영속화 표의 `redactThreadForPublic` 은 `shared/conversation-thread/**` glob 으로 이미 커버됨)와 대칭이다.
  - 제안: (필수 아님) 다음 이 문서를 편집할 때 `code:` 에 `codebase/backend/src/modules/websocket/websocket.service.ts` 추가. 급하지 않음 — 가드 위반 없음.

- **[INFO]** 문서 최상단에 명시적 `## Overview` 섹션이 없음 (diff 로 도입된 문제 아님, 기존 구조)
  - target 위치: `spec/conventions/conversation-thread.md` 1-75행 (제목 → 관련 문서 링크 → 서문 단락 → `---` → 바로 `## 1. 자료구조`)
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 각주 — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장"
  - 상세: 같은 diff 에서 함께 번들된 `spec/conventions/audit-actions.md`(801행) · `spec/conventions/egress-masking.md`(912행) 는 둘 다 명시적 `## Overview` 헤딩을 갖는데, `conversation-thread.md` 는 서문 단락만 있고 `## Overview` 헤딩이 없다. `## 8. Rationale` 섹션은 존재하므로 3섹션 중 마지막만 구조적으로 갖춰져 있다.
  - 제안: 이번 PR 의 diff 범위(§8.4 5줄 정정) 밖의 사전 존재 구조라 이번 PR 을 막을 사유는 아니다. 차후 이 문서를 구조적으로 개정할 기회가 있으면 서문 단락 앞에 `## Overview` 헤딩을 붙이는 것을 권장.

- **[INFO]** 자기-반증형 소정정의 조건 ②("예고·트리거" vs "API 계약") 경계가 살짝 미묘함 — 판단 근거만 기록
  - target 위치: `spec/conventions/conversation-thread.md` 388-391행 (§8.4 취소선+정정), 대응하는 `spec/5-system/14-external-interaction-api.md` 1736-1750행, `CHANGELOG.md` 21-38행
  - 관련 규약: CLAUDE.md "자기-반증형 소정정" 5조건 중 조건 2 — "그 문장이 예고·트리거다 — 제품 정의·요구사항·**API 계약은 해당 없음**"
  - 상세: 취소선 처리된 원 문장("SSE·fanout 이 잔여다")은 REST vs SSE 의 `nodeOutput` 노출 필터 강도 차이 — 즉 외부에 어떤 키가 나가는지를 서술하는 문장이라, "API 계약 서술"로도 읽힐 여지가 있다. 다만 문맥상 이 문장은 "잔여(TODO) — 정본 트래커에 별도 항목으로 등재돼 있다"는 **미완료 작업 상태 고지**이지, allowlist 자체의 키 목록(그건 §R17 표·`NODE_OUTPUT_ALLOWED_KEYS` 가 정의)을 정의하는 문장이 아니어서 "예고·트리거" 쪽으로 더 가깝게 읽힌다. 5조건 중 나머지(①blame 확인 가능·③실측 포함·④원문 취소선 보존·⑤`plan/complete/sse-nodeoutput-allowlist.md` frontmatter `spec_impact` 명시 + 커밋 본문(`fe4d58de7`) 실측 기록)는 전부 실측 확인됨. 게이트 요건("`--impl-done` 을 그 spec 파일이 포함되는 scope 로 반드시 돌린다")도 본 검토 자체가 그 게이트다.
  - 제안: 조치 불요 — 판단 근거를 남기는 차원의 기록. 향후 유사 사례에서 "잔여/TODO 성격의 서술"과 "현재 API 표면의 정의"가 한 문장에 섞이면 조건 ②판정이 더 어려워지므로, 정정 대상 문장을 고를 때 되도록 순수한 상태-고지 문장으로 좁히는 관행을 유지할 것.

- **[INFO]** 프롬프트 번들이 예산 초과로 `node-output.md`/`swagger.md`/`error-codes.md`/`secret-store.md`/`node-cancellation.md` 및 `<git diff origin/main...HEAD -- code_areas>` 원문을 절단함
  - target 위치: `_prompts/convention_compliance.md` 1022-1051행 (각 파일 "본문 생략됨 — 컨텍스트 예산 초과" 안내)
  - 관련 이슈: 기존 알려진 harness 갭 (`feedback_consistency_spec_mode_budget.md`) — "consistency `--spec` 기본 예산이 conventions 를 통째로 떨군다"와 동일 계열 증상(이번엔 `--impl-done` 번들에서 발생)
  - 상세: `node-output.md`(Principle 0 5필드 규약 — 이번 diff 의 `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 명명이 그 규약을 따르는지 판정하는 데 필요) 와 실제 git diff 원문(코드 영역)이 번들에서 통째로 빠졌다. 이 checker 는 우회로 워크트리(`Bash`/`Read`, 절대경로)에서 `spec/conventions/node-output.md`, `node-output-allowlist.ts`, `websocket.service.ts`, `interaction.service.ts` 를 직접 열어 대조했고, 명명·5필드 준수를 확인했다(§9.1 `NODE_OUTPUT_ALLOWED_KEYS` 의 5개 핸들러 공개키가 Principle 0 의 `{config, output, meta, port, status}` 와 정확히 일치, `allowlistNodeOutputKeys`/`toFanoutEnvelope`/`emitExecutionEvent`/`emitNodeEvent` 함수명이 spec 인용과 1:1 일치). 그러나 이 우회가 없었다면 이번 판정이 거짓 음성(node-output.md 위반 미검출)이 될 뻔했다.
  - 제안: 이번 검토 결과에는 영향 없음(우회 확인 완료). orchestrator 쪽에서 `--impl-done` 번들 조립 시 diff 원문이 예산에 밀려 절단되는 경우가 있다는 점은 별도 harness 이슈로 트래킹 가치가 있다(이 세션의 범위 밖이라 여기서는 기록만).

## 요약

diff 범위에서 `spec/conventions/**` 실제 변경은 `conversation-thread.md` §8.4 의 5줄 정정
blockquote 하나이며, 이는 CLAUDE.md 의 "자기-반증형 소정정" 예외 절차(블레임 확인·실측 동봉·
취소선 보존·`spec_impact` 명시·`--impl-done` 게이트)를 실질적으로 충실히 따른다 — 5조건을
코드/커밋/plan 대조로 직접 검증했고 CRITICAL 급 이탈은 발견되지 않았다. 같은 diff 에 함께
포함된 `EIA §R17`·`WS §4.4`·`CHANGELOG.md` 의 병렬 정정도 동일한 취소선+블록쿼트 패턴을
일관되게 쓰고, 인용하는 함수명(`allowlistNodeOutputKeys`, `NODE_OUTPUT_ALLOWED_KEYS`,
`WebsocketService.toFanoutEnvelope`)은 실제 코드 심볼과 정확히 일치해 명명 규약·문서-코드
정합성이 잘 지켜졌다. 발견된 이슈는 전부 INFO 등급의 완결성/추적성 제안(코드 frontmatter
확장 여지, 사전 존재하던 Overview 섹션 누락, 조건②의 미묘한 판단 근거 기록, 번들 절단으로
인한 검토 가시성 갭)이며 이번 PR 을 막을 CRITICAL/WARNING 은 없다.

## 위험도

LOW
