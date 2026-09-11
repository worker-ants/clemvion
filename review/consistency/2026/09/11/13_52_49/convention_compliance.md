# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-details-code-landed.md`

## 발견사항

- **[WARNING] `AUTH_CONFIG_NOT_FOUND` 카탈로그 등재가 이 저장소의 `*_NOT_FOUND` 명명 관례(8/8, 항상 404)에서 이탈하는데 그 이탈을 문서화하지 않는다**
  - target 위치: "(b) `authConfigId`" 절 · "결정 3" · "변경안 3" (`3-error-handling.md` 신규 `§1.11`)
  - 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명) 의 실무 적용 — `spec/5-system/3-error-handling.md` 자체가 이미 세운 로컬 선례(§1 §1.9 및 Rationale)
  - 상세: `3-error-handling.md` 를 전수 확인하면 `RESOURCE_NOT_FOUND`·`ALERT_RULE_NOT_FOUND`·`MODEL_CONFIG_NOT_FOUND`·`VARIABLE_NOT_FOUND`·`SUB_WORKFLOW_NOT_FOUND`·`EXECUTION_NOT_FOUND`·`USER_NOT_FOUND`·`WORKSPACE_NOT_FOUND` **8개 전부가 404** 다. 그런데 실측 코드(`triggers.service.ts assertAuthConfigInWorkspace`)는 `AUTH_CONFIG_NOT_FOUND` 를 `BadRequestException`(400)으로 던진다 — 이 저장소에서 `_NOT_FOUND` 접미사가 400 과 짝지어지는 **유일한 사례**가 된다. 더 결정적으로, 이 문서는 이미 정확히 이 혼란을 겪고 고친 이력이 있다 — `MODEL_CONFIG_NOT_FOUND`(404)/`MODEL_CONFIG_DEFAULT_MISSING`(400) 분리 Rationale 이 *"동일 코드가 404/400 두 status 를 갖는 모호성이 있었다"* 며 **400 인 조건에는 아예 다른 이름**(`_DEFAULT_MISSING`)을 붙였다. `AUTH_CONFIG_NOT_FOUND` 는 그 반대 선택을 하면서도 그 편차를 언급하지 않는다. 결정 3 은 코드 변경("이미 머지됐고 되돌릴 결함이 아니다")을 명시적으로 기각했으므로 상태 코드 자체를 바꾸라는 뜻이 아니다 — 다만 **카탈로그에 등재하는 시점에 이 편차를 침묵시키면** 독자가 §1.9/§1.10 의 표 형식(코드 | status | 설명 | 도메인 SoT)만 보고 "NOT_FOUND 니까 404" 로 오판할 위험이 남는다.
  - 제안: 신설 `§1.11` 행에 `status: 400` 을 명시하는 것에 더해, `MODEL_CONFIG_NOT_FOUND`/`ALERT_RULE_NOT_FOUND` 옆에 붙은 것과 같은 캡션 한 줄(예: *"cross-workspace 참조 검증은 body 필드 유효성 문제로 취급해 400 — 이름은 NOT_FOUND 이나 다른 `*_NOT_FOUND` 코드와 달리 404 가 아니다"*)을 함께 적어 미래 독자의 오판을 막는다. 이번 planner 턴 범위 내에서 결정 3 문면에 이 캡션 요구를 추가하는 것으로 충분하다.

- **[WARNING] 결정 라벨 네임스페이스 충돌이 "세 번째" 재발이라고 스스로 적으면서도 정식 규약으로 승격하지 않는다**
  - target 위치: "결정" 섹션 상단 메타 코멘트 (*"이번에도 후보를 grep 으로 먼저 쟀다… 세 번째 재발이면 산문 규율 말고 구조를 바꾸는 것이 맞다"*)
  - 위반 규약: 직접 위반은 없음 — CLAUDE.md "정보 저장 위치" 표의 "정식 규약은 `spec/conventions/<name>.md`" 원칙의 정신에 대한 갭
  - 상세: 이 문서는 `D-*`(15-chat-channel.md 의 `R-CC-21`/`D-1`/`D-2` 와 충돌) → `CV-*`(`CCH-CV-0N` 요구사항 ID 계열과 토큰 공유) → 이번엔 `DEC-*` 도 `#1316` plan 이 이미 쓴다는 이유로 **셋째 회피**로 넘어간다. 스스로 *"산문 규율 말고 구조를 바꾸는 것이 맞다"* 고 진단했지만 실제 조치는 이번에도 "라벨을 안 쓴다"는 국소 회피이고, 이 패턴을 막을 정식 규약(예: 파일별/문서별 예약 접두사 레지스트리)도, 후속 트래커 항목도 남기지 않는다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 를 grep 해도 이 메타 이슈는 등재돼 있지 않다 — 네 번째 재발을 막을 장치가 이 PR 종료 시점에 전혀 남지 않는다.
  - 제안: 최소한 트래커에 *"결정 라벨 네임스페이스가 3회 충돌 — `spec/conventions/` 에 예약 접두사 레지스트리(또는 review-citations.md 처럼 짧은 규약 문서) 신설 검토"* 항목을 추가한다. 이번 PR 범위에서 규약 문서를 새로 만들 필요까진 없더라도, "구조를 바꾸는 것이 맞다" 는 자체 진단이 다음 세션에서 사라지지 않도록 흔적을 남겨야 한다.

- **[INFO] 결정 5(botToken 형식 서술 정정)가 같은 spec_impact 파일(`15-chat-channel.md`) 안의 유사 서술은 건드리지 않는다**
  - target 위치: "결정 5" / "변경안 5" (`2-trigger-list.md §2.3.1` botToken 행) vs `15-chat-channel.md §4.1` (`Trigger.config.chatChannel` JSON 예시, `botToken` 필드 인라인 주석)
  - 위반 규약: 명시적 규약 위반은 아님 — CLAUDE.md "정보 저장 위치 단일 진실 원칙" 의 정신
  - 상세: `15-chat-channel.md` 의 `botToken` 필드 인라인 주석은 `telegram=BotFather `\d+:[A-Za-z0-9_-]+`` 라는, `2-trigger-list.md` 가 인용하던 것보다 느슨하지만 유사한 형식 힌트를 담고 있다(실측: 하한 없는 `\d+`, 상한 없는 `[A-Za-z0-9_-]+` — `^\d{6,}:[A-Za-z0-9_-]{30,}$` 와 다른 bound). 이 주석은 "서버가 검증한다" 를 주장하지 않아 (d) 가 지적한 세 가지 결함(인용 부재·provider 무자격·구현 부재) 중 첫 번째만큼 심각하지 않지만, 같은 PR 이 `15-chat-channel.md` 를 이미 편집 대상으로 열어 두고도(결정 1a/1b/1c) 이 자리는 "이 턴에 하지 않는 것" 목록에도 오르지 않아 누락처럼 보인다.
  - 제안: "이 턴에 하지 않는 것" 목록에 이 위치를 명시적으로 추가하거나(의도적 비대상임을 밝히거나), 가벼운 캡션(예: "형식은 provider 발급 관례를 적은 것이며 서버가 검증하지 않는다")을 함께 정정한다.

- **[INFO] 변경안 표의 편집 순서(1a→1b→1c)가 `15-chat-channel.md` 실제 물리적 섹션 순서와 반대다**
  - target 위치: "변경안" 표 1a/1b/1c 행 vs `15-chat-channel.md` 실제 라인 순서
  - 위반 규약: 없음 — 순수 편집 편의성 이슈
  - 상세: 실측: 문서 안에서 `#### 5.4.1.2 …` 가 391행, `#### 5.4.1.1 …` 가 418행으로, **번호와 반대 순서**로 배치돼 있다. 변경안 표는 1a(§5.4.1)→1b(§5.4.1.1)→1c(§5.4.1.2) 순으로 나열해, 표를 그대로 따라가며 편집하면 문서를 두 번 오가게 된다.
  - 제안: 표 순서를 실제 문서 순서(§5.4.1 → §5.4.1.2 → §5.4.1.1)로 재배열하거나, 실행 시 순서에 유의하라는 각주를 단다. (이 섹션 역순 배치 자체는 이 PR 이 만든 것이 아니라 선행 PR 의 산물이므로 근본 수정은 범위 밖.)

## 요약

이 draft 는 대부분 실측(grep·코드 대조)으로 뒷받침되어 있고, `spec_impact` 6개 경로 전부 실존, plan frontmatter 3필드(`worktree`/`started`/`owner`) 충족, 트래커 항목 4건 모두 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 실존하는 등 plan-lifecycle·Gate C 규약은 준수한다. `details[].code` 명명(`INVALID_FIELD`, UPPER_SNAKE)과 에러 카탈로그 표 형식(§1.9/§1.10 패턴 계승)도 기존 규약을 그대로 따른다. 다만 신규 등재하는 `AUTH_CONFIG_NOT_FOUND` 가 이 저장소의 `*_NOT_FOUND`→404 불문율(8/8, 그리고 `MODEL_CONFIG` 분리로 이미 한 번 명문화된 회피 패턴)에서 벗어나는데 그 이탈을 캡션으로 남기지 않는 점, 그리고 "세 번째 재발" 이라고 스스로 인정한 결정 라벨 충돌 문제를 구조적으로 예방하지 않고 다시 회피만 하는 점이 눈에 띈다. 둘 다 채택을 막을 CRITICAL 은 아니며, 문서화 보강으로 해소 가능한 WARNING 이다.

## 위험도

LOW
