# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md`

## 검토 대상 및 방법

target 은 `spec/5-system/6-websocket-protocol.md` 개정을 위한 spec draft (`--spec` 모드) 이다.
번들에는 `spec/conventions/**` 다수가 컨텍스트 예산 초과로 절단되어 있었으므로, 관련성이 높은
아래 원본을 저장소에서 직접 열어 대조했다.

- `spec/conventions/spec-impl-evidence.md` (frontmatter/status 라이프사이클 — 전문)
- `.claude/skills/project-planner/SKILL.md` (spec draft 작성 규약 — 명명·구조)
- `.claude/docs/plan-lifecycle.md` (plan frontmatter 스키마 · Gate C)
- `spec/5-system/6-websocket-protocol.md` (target 이 실제로 손대는 spec 원문, `:28`/`:872`/`:945`/`:1086`/`:1089`/`:1104`/`:1093`~`:1113`/`:1154` 등 target 이 인용한 모든 라인)
- 저장소 전역 `### R-` 패턴 grep (`spec/5-system/*.md`)

## 발견사항

이번 검토에서 **CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.** 아래는 확인한 준수
근거와 INFO 1건이다.

- **[INFO] `R-<slug>` Rationale 명명·`_(비채택 won't-do)_` 인라인 표기가 `spec/conventions/**` 에 명문화돼 있지 않음**
  - target 위치: `## 변경안` 표 #2·#3·#8, 신설 Rationale 헤딩 `### R-wontdo-maintenance-appping. ...`
  - 위반 규약: 없음 (해당 사안을 다루는 정식 규약 문서 자체가 부재)
  - 상세: target 이 채택한 두 패턴 — ① Rationale 항목을 `R-N` 순번이 아니라 `R-<slug>` 로 명명, ② spec 본문에서 항목을 삭제하지 않고 `_(비채택 won't-do)_` 로 표기만 바꾸는 것 — 은 **같은 파일의 기존 선례**(`R-wontdo-rawws-rest`, §8 `## 8. WebSocket Close 코드 — _비채택 (won't-do)_`)와 **저장소 전역 선례**(`spec/5-system/11-mcp-client.md:590` `R-wontdo-cached-capabilities`, `15-chat-channel.md` 의 `R-CC-N`)를 정확히 따른다 — 위반이 아니다. 다만 `audit-actions.md`/`error-codes.md`/`spec-impl-evidence.md` 같은 정식 `spec/conventions/` 문서들은 `R-1, R-2 …` 순번 스킴을 쓰는 반면, `spec/5-system/` 개별 파일들은 각자 `R-<slug>` 또는 `R-<도메인>-<N>` 을 자유롭게 채택하고 있어 **레포 전체에 통일된 Rationale 명명 규약이 없다.** target 은 이 이질성을 늘리지 않고 자기 파일의 기존 스킴을 그대로 따랐다.
  - 제안: target 수정 불필요. 다만 이 패턴이 5개 이상 spec 파일에서 반복되므로(`6-`/`11-`/`14-`/`15-`/`16-system-status-api.md`), 추후 `spec/conventions/` 에 "Rationale 항목 명명 + won't-do 인라인 표기" 를 formalize 하는 별도 convention 문서를 고려할 만하다 — 이는 규약 갱신 제안이지 target 의 결함이 아니다.

## 확인한 준수 사항 (근거 기록)

- **파일 명명**: `plan/in-progress/spec-draft-ws-wontdo-maintenance-appping.md` — `project-planner/SKILL.md` §작업 워크플로 3 "`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성" 과 정확히 일치.
- **draft 구조**: 본문 끝 `## Rationale (본 draft 의 결정 근거)` 섹션 보유 — 동 SKILL.md "본문 끝에 `## Rationale` 로 결정 근거 명시" 의무 충족.
- **plan frontmatter**: `worktree`/`started`/`owner` 3필드 모두 존재 — `.claude/docs/plan-lifecycle.md` §4 (`plan-frontmatter.test.ts` 강제 스키마) 충족.
- **`spec_impact` 필드**: `- spec/5-system/6-websocket-protocol.md` YAML **리스트**로 선언 — bare string 이 아님. `feedback_plan_checkbox_actual_state`/plan-lifecycle §5 Gate C 의 "bare string·빈 배열 금지, 반드시 리스트" 규칙에 부합 (in-progress 단계라 아직 강제 대상은 아니나 선제 준수).
- **spec frontmatter 불변 원칙**: 변경안 #9 "frontmatter 변경 없음 — `status: partial` 유지" 는 `spec-impl-evidence.md` §3 라이프사이클과 정합 — `auth.token_expired` 가 여전히 Planned(미구현)로 남아 `code:` 글로브 매치·`pending_plans:` 요건이 그대로 유효하며, 세 항목 중 일부만 won't-do 로 종결한다고 문서 전체를 `archived` 로 격상하는 것은 §3의 "`archived`=spec 문서 자체의 폐기" 정의를 오용하는 것이 됐을 텐데 target 은 이를 정확히 피했다.
- **삭제 대신 표기 전환**: target 의 "spec 본문에서 지우지 않고 `_(비채택 won't-do)_` 로 남긴다" 결정은 `R-wontdo-rawws-rest`(2026-07-08)가 이미 확립한 동일 파일 내 선례를 그대로 계승 — 규약 일관성 유지.
- **원문 비가역 편집 회피**: target 이 `:1104` `R-wontdo-rawws-rest` 의 "범위 밖" 원문을 고치지 않고 "후속 갱신 주석" 만 추가하기로 한 결정은, 인용한 선례(`### llmCalls 외부 수신자 strip` 의 "(2026-08-14 갱신)" 블록쿼트, `6-websocket-protocol.md:1154`)가 **실제로 존재**함을 확인했다 — 근거 없는 소급 정당화(과거 지적된 반복 결함 패턴)가 아니다.
- **실측값 검증**: target `## 실측` 표의 `system.maintenance` "`spec/` 5곳 / `codebase/backend/src` 0건" 을 `grep -rn` 으로 재현 — 정확히 일치(spec 5건: `:28`,`:872`,`:1086`,`:1089`,`:1104`, backend 0건). frontmatter·명명 결정의 근거가 된 실측 자체가 정확하므로 그 위에 놓인 규약 판단(문서 상태를 archived 아닌 partial 유지 등)도 흔들리지 않는다.
- **API 문서·출력 포맷 규약**: target 은 OpenAPI/Swagger 데코레이터·DTO·REST 응답 포맷을 전혀 건드리지 않으며, WS 이벤트 payload 형태(`{ message, scheduledAt }`)도 그대로 보존한다 — `spec/conventions/swagger.md`·`error-codes.md` 관련 규약과 충돌 소지 없음 (해당 영역은 이번 변경 범위 밖).

## 요약

target 은 `plan/in-progress/` 명명 규약·plan frontmatter 스키마·`spec_impact` 리스트 형식·spec `status` 라이프사이클(§3)·"삭제 대신 표기 전환" 하우스 스타일·"원문 보존 + 후속 주석" 하우스 스타일을 모두 기존 정식 규약 및 동일 파일/동일 저장소 선례와 정확히 일치시켜 작성됐다. 인용한 선례(`R-wontdo-rawws-rest`, `llmCalls` 갱신 주석)와 실측값(spec 5곳/backend 0건)도 직접 대조해 사실과 부합함을 확인했다. 유일한 관찰은 INFO 수준으로, "Rationale `R-<slug>` 명명 + `_(비채택 won't-do)_` 인라인 표기" 패턴 자체가 아직 `spec/conventions/` 에 정식 문서화되어 있지 않다는 점이나, 이는 target 의 결함이 아니라 규약 문서 쪽의 향후 formalize 기회다.

## 위험도

NONE
