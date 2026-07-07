# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — 실행 코드 변경은 사실상 없음(`links.ts` 정적 라우트 상수 추가/rename 1건뿐, 나머지 33개는 사용자 가이드 MDX 문서 + spec 링크 동기화)이나, 이번 PR이 신규 작성한 `containers-and-tools.mdx`와 같은 PR이 직접 편집한 `ai.mdx`/`ai.en.mdx`/`faq.mdx`/`faq.en.mdx`가 캔버스 "Tool Area" 존재 여부를 놓고 서로 정반대로 서술하는 모순을 방치한 채 배포된다(requirement-reviewer·documentation-reviewer 공통 지적). 또한 `scope`/`side_effect`/`testing` 3개 reviewer 가 "success" 로 보고됐으나 실제 `output_file` 이 디스크에 생성되지 않아 내용을 검증할 수 없다 — 재실행 필요.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합성 | 캔버스 "Tool Area"가 이미 spec 상 제거됐음에도(`spec/4-nodes/3-ai/1-ai-agent.md:72,234,236` "재작성 예정 — 현재 제거됨") 이번 PR이 신규 작성한 `containers-and-tools.mdx`("지금은 캔버스에 AI Agent 전용 도구 영역이 따로 표시되지 않아요")와, 같은 PR이 링크 수정 목적으로 직접 건드린 `ai.mdx`/`ai.en.mdx`/`faq.mdx`/`faq.en.mdx`("캔버스의 Tool Area에 노드를 끌어다 놓으면 도구로 등록")가 서로 링크로 연결된 채 정반대 사실을 말함. 커밋 메시지 자체가 "후속 작업으로 분리"라 인지했으나 `plan/in-progress/`에 정식 추적 항목 없이 방치. 사용자가 존재하지 않는 UI로 안내받게 됨 | `codebase/frontend/src/content/docs/02-nodes/ai.mdx:40,326` / `ai.en.mdx:29,315`, `codebase/frontend/src/content/docs/99-faq/faq.mdx:88` / `faq.en.mdx:77` (vs `03-workflow-editor/containers-and-tools.mdx`/`.en.mdx`) | 이번 PR 범위에서 Tool Area 서술을 containers-and-tools.mdx 내용(설정 패널에서 도구 등록)에 맞춰 정정. 최소한 후속 작업을 `plan/in-progress/`에 정식 항목으로 등록 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합성 | 이번 diff 로 신규 추가된 IA 트리 설명 줄이 "AI Agent Tool Area" 표현을 그대로 사용하는데, 정작 이 페이지(`containers-and-tools.mdx`) 본문은 Tool Area 부재를 설명 — Critical #1과 별개로 이번 PR이 새로 도입한 신규 불일치 | `spec/2-navigation/13-user-guide.md` (containers-and-tools 행) | "AI Agent Tool Area" 대신 "AI Agent 도구 연결(설정 패널)" 등 실제 내용에 맞는 문구로 수정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합성 | Critical #1과 동일 근본 원인의 Tool Area 잔여 서술이 이번 diff 밖 인접 문서에도 남아있음 | `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:16,100`, `.en.mdx:5,89` | 후속 정합 작업 시 이 파일들도 스코프에 포함해 plan 항목으로 명시 등록 |
| 2 | 유지보수성 | 영문(`.en.mdx`) 페이지 말미 "Tips" 섹션 제목이 `Tips & notes`/`Tips & references`/`Tips and related pages` 3갈래로 갈라짐. 대응 한국어 원문은 전부 `## 팁 & 참고`로 통일됨 | `codebase/frontend/src/content/docs/03-workflow-editor/*.en.mdx` 말미 섹션 헤딩 | 영문 쪽도 한 가지 문구로 통일 |
| 3 | 유지보수성 | `links.ts`에 신규 추가된 `workflowEditor.*` 9개 키가 애플리케이션 코드(`.tsx`/`.ts`)에서 아직 미사용(기존 `overview` 키도 동일 패턴). MDX 본문 내부 링크는 상수 대신 하드코딩 경로 문자열 직접 사용 | `codebase/frontend/src/lib/docs/links.ts:28-37` | 이번 diff 의 회귀는 아니므로 차단 사유 아님 |
| 4 | 유지보수성 | `plan/in-progress/ai-agent-tool-connection-rewrite.md`(diff 밖)가 이번 PR로 개명 전 경로(`03-workflow-editor/walkthrough.mdx`)를 여전히 TODO 로 참조 | `plan/in-progress/ai-agent-tool-connection-rewrite.md:91` | 해당 plan 항목의 파일 경로를 `ai-assistant-walkthrough.mdx`로 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음(문서 + 정적 라우트 상수 리네이밍뿐) |
| requirement | MEDIUM | Tool Area 문서 모순(Critical), IA 트리 라벨 불일치(Warning). 검증한 핵심 동작 claim(저장 버튼, 미저장 편집 소실, 자동 저장, 줌 범위, Recent 노드 5개, 세션 50개, AI 어시스턴트 3단계 루프)은 모두 코드/spec 과 일치 |
| documentation | MEDIUM | Tool Area 문서 모순(동일 이슈), 인접 diff-외 문서 잔여 서술(Info). 링크·프런트매터·수치 스팟체크는 전수 통과 |
| maintainability | LOW | 영문 Tips 섹션 제목 3갈래, links.ts 신규 키 미사용, plan 문서 잔여 경로 — 모두 Info 수준 |
| scope | 재시도 필요 | `output_file` 미생성 |
| side_effect | 재시도 필요 | `output_file` 미생성 |
| testing | 재시도 필요 | `output_file` 미생성 |

## 권장 조치사항

1. `ai.mdx`/`ai.en.mdx`/`faq.mdx`/`faq.en.mdx`의 캔버스 "Tool Area" 서술을 `containers-and-tools.mdx` 내용(설정 패널에서 도구 등록)에 맞춰 정정 (Critical)
2. `spec/2-navigation/13-user-guide.md`의 "AI Agent Tool Area" 표현을 실제 내용에 맞는 문구로 수정 (Warning)
3. `scope`/`side_effect`/`testing` reviewer 재실행 — FS flakiness 로 output 미확보
4. (선택) 영문 "Tips" 섹션 제목 통일, `plan/in-progress/ai-agent-tool-connection-rewrite.md`의 잔여 경로 갱신, `mcp-servers.mdx` 등 인접 문서의 Tool Area 잔여 서술 정합

## 라우터 결정

- `routing_status=done`. 실행: security, requirement, scope, side_effect, maintainability, testing, documentation (7명, 전원 router_safety 강제 포함). 제외: performance, architecture, dependency, database, concurrency, api_contract, user_guide_sync.
