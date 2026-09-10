# Rationale 연속성 검토 — `spec-draft-trigger-canary-nav` (--spec)

대상: `plan/in-progress/spec-draft-trigger-canary-nav.md`
스코프: `spec/2-navigation/2-trigger-list.md` · `spec/2-navigation/3-schedule.md` · `spec/5-system/14-external-interaction-api.md`

## 발견사항

### [WARNING] 「기각한 대안」 문단의 케이스 수가 자기모순이다 — "셋" vs "다섯"

- **target 위치**: `plan/in-progress/spec-draft-trigger-canary-nav.md` `## Rationale` > `### 기각한 대안 — 캐너리의 생성 음성 케이스를 지우는 것` (해당 문단 4번째 문장)
- **과거 결정 출처**: 없음 (target 자체의 내부 정합성 문제)
- **상세**: 해당 문단은 *"음성 케이스는 **양성 4건**의 대조군이라 **셋 다** 있어야 '이 축은 **다섯 형태**로 고정된다' 가 성립한다"* 라고 적는다. 같은 문장 안에서 "양성 4건"·"다섯 형태"라고 말하면서 정작 "다 있어야" 할 개수는 "셋"이라고 썼다 — 4(양성)+1(음성)=5 이지 3이 아니다. `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` 실측(`it(` 5개: A~E, A만 음성)도 5건을 확인한다. 이 자리는 정확히 "몇 개가 있어야 계약이 성립하는가"를 주장하는 문장이라 숫자 오류가 그 주장 자체의 신뢰도를 깎는다 — Rationale 항목은 나중에 그대로 인용될 자리라 이 오탈은 다음 사람에게 잘못된 수치를 전파한다.
- **제안**: "셋 다"를 "다섯 다"(또는 "양성 4건 + 음성 1건 다")로 정정. spec 반영 전에 고칠 것.

### [WARNING] W4 재발 인과가 실제로 그 회귀를 막은 캐너리 케이스를 지목하지 않는다

- **target 위치**: 같은 문단, *"그 케이스가 없으면 「생성 응답에만 부재」가 실제로 그러한지 아무도 안 묻게 되고, 그러면 `#1308` 이 닫은 W4 회귀(chatChannel PATCH 에서만 사라짐)가 다시 조용히 새는 자리로 돌아간다"* 부분
- **과거 결정 출처**: `review/code/2026/09/06/01_13_50/RESOLUTION.md` `## W4` — *"`chatChannel` 을 포함한 `PATCH` 는 `setupChatChannel` 뒤 `relations` 없는 재조회로 `result` 를 통째로 갈아치워 그 응답에서도 `workflow` 가 빠졌다"* + 커밋 `5b458b1ec` 본문의 뮤테이션 표(*"뮤턴트 후 #5 RED"*, #5=case E)
- **상세**: W4 는 실재하고 서술도 정확하지만(교차 확인 완료), "기각한 대안"이 실제로 지우자는 케이스는 **생성 음성 케이스(case A)** 다. `#1308` 뮤테이션 실측은 W4 를 잡아낸 것이 **case E**(`chatChannel` 포함 PATCH, 양성)임을 명시한다(예측=RED, 실측=RED, 표의 세 번째 줄). case A(음성)를 지워도 case B/C/D/E(양성 4건)는 그대로 남아 W4 류의 재발을 여전히 잡는다 — 즉 "그 케이스[A]가 없으면 … W4 회귀가 다시 새는 자리로 돌아간다"는 인과가 문면 그대로는 성립하지 않는다. 문단의 더 넓은 취지(음성 케이스가 없으면 "부재는 생성에만 있다"는 경계 서술 자체를 아무도 검증하지 않게 된다)는 타당하지만, 그 취지와 "W4 재발"을 직접 연결하는 것은 뮤테이션 실측이 지목한 케이스(E)와 기각 대상 케이스(A)가 다르다는 사실을 가린다.
- **제안**: W4 재발 언급을 case A 삭제의 직접 결과로 쓰지 말고, "case A 를 지우면 '부재=생성 전용'이라는 경계 주장 자체가 무근거로 남는다"는 더 정확한 문장으로 좁히거나, W4 방지 근거는 case E(양성, 이 대안에서도 유지됨)에 있다는 점을 명시해 구분할 것.

### [INFO] 신설 `R-17` 은 `R-1`(workflowId v1 read-only)과 충돌하지 않음 — 확인 완료

- **target 위치**: `plan/in-progress/spec-draft-trigger-canary-nav.md` `### 신설 R-17 — 캐너리가 고정하는 것은 구현이지 계약이 아니다`
- **과거 결정 출처**: `spec/2-navigation/2-trigger-list.md` `### R-1. workflowId 를 v1 read-only 로 잠근 이유`
- **상세**: R-1 은 `Trigger.workflowId`(FK, 어느 workflow 에 연결되는가) 편집을 v1 에서 잠그는 결정이고, 신설 `R-17` 은 `TriggerDto.workflow`(그 workflow 를 가리키는 `{id,name}` 참조 객체)가 응답 경로별로 존재/부재하는 형태를 캐너리로 고정하는 결정이다. 하나는 "FK 값을 바꿀 수 있는가", 다른 하나는 "이미 정해진 FK 로 조인한 표시용 객체가 언제 응답에 실리는가"로 서로 다른 축이라 재도입·번복 관계가 없다. `2-trigger-list.md` Rationale 전체(R-1~R-16)를 훑었을 때 이 외에도 target 변경안이 재개봉하는 항목은 없다.
- **제안**: 없음.

### [INFO] `R-17` 을 `## Rationale`로 보내는 것과 `3-schedule.md §4` 가 같은 내용을 본문에 남기는 것 사이의 구조 비대칭

- **target 위치**: `### 왜 §3 註의 이력을 본문에 안 남기고 Rationale 로 보내나` + `### 신설 R-17`
- **과거 결정 출처**: `spec/2-navigation/3-schedule.md` §4 본문의 *"**보강** — 지금은 그 폴백에 닿지도 않는다"* 블록쿼트(파일 145~159행 부근) — 이것이 트리거 축 `R-17`이 미러링하겠다고 밝힌 "재검토 신호"의 원본이다.
- **상세**: target 은 *"자매 축은 이 재검토 신호를 이미 갖고 있다(`3-schedule.md §4`)"*고 정확히 인용하는데(실측: 스케줄 문서에 해당 문장 실재, 인용 정확), 정작 스케줄 축은 이 내용을 `## Rationale`이 아니라 **§4 본문 blockquote** 안에 살아 있는 서술로 유지하고, 트리거 축은 같은 성격의 내용을 `## Rationale`의 새 번호 항목(`R-17`)으로 분리해 보낸다. 두 문서가 "쌍둥이 서술"이라고 스스로 표방하면서 하나는 본문에, 하나는 Rationale 에 두면 다음 사람이 "왜 위치가 다른가"를 또 조사해야 한다. target 이 인용한 `#1307`(`2-api-convention.md §10.4`) 선례는 "본문은 교체, 이력은 Rationale"인 경우이지 "본문 그대로 유지 vs Rationale 신설"의 비대칭 정당화 근거는 아니다.
- **제안**: 필수 수정은 아니나, `R-17` 본문 또는 스케줄 §4 blockquote 중 한쪽에 "자매 축은 같은 논지를 본문/Rationale 중 다른 자리에 둔다"는 한 줄 상호 참조를 남기면 다음 검토에서 "위치가 왜 다른가"라는 재질문을 막을 수 있다.

### [정보 — 확인 완료] 조건 2/조건 4 경계 판정은 조항 문면과 정합하고, 조건 1 실측(planner 작성)과도 일치한다

- **target 위치**: `## 조건 2 경계 판정 (rationale_continuity 요구)`
- **과거 결정 출처**: `CLAUDE.md` §자기-반증형 소정정 조건 2·4, `review/consistency/2026/09/10/13_48_39/rationale_continuity.md`의 WARNING(*"'아직 없다'가 예고·트리거인지 모호"*)
- **확인 결과**:
  - `git log --follow -p -- spec/2-navigation/2-trigger-list.md` 로 해당 문장(*"자매 스케줄 축과 달리 이 축에는 캐너리가 아직 없다"*)의 도입 커밋을 특정하면 `dc77317cd`(`docs(spec): §5.4 가 요구한 키-생략 사유를 nav-spec 으로 — …(#1304)`)이며, 이 커밋은 diff 전체가 `spec/` 뿐이고 게이트도 `--spec`(`11_13_14`, BLOCK:NO)이다 — `13_48_39` 리포트가 이미 CRITICAL 로 지목한 "조건 1(devloper 자신이 썼다) 위반" 판정과 정확히 일치한다. target 이 "깨진 것은 조건 1 뿐"이라고 쓴 전제는 실측과 맞는다.
  - 조건 2("그 문장이 예고·트리거다 — 제품 정의·요구사항·API 계약은 해당 없음")는 문장 자체의 **성격**을 묻고, 조건 4("정정은 그 문장에 국한 — 원문은 취소선으로, 인접 서술은 불변")는 정정 **행위의 범위**를 묻는다. `13_48_39`의 WARNING 이 지적한 "문단이 섞여 있어 애매하다"는 우려는 실제로는 "이 문장만 골라 고칠 수 있는가"(=조건 4의 관할)이지 "이 문장이 예고인가 계약인가"(=조건 2의 관할)를 흔들지 않는다 — target 의 재구분은 조항의 문면 그대로다.
  - 다만 이 판정은 **이 턴에는 적용 대상이 없는 이론적 정리**다(이 PR 자체는 자기-반증형 소정정을 쓰지 않는 일반 planner 편집이라고 target 이 이미 명시). 향후 developer 가 유사하게 "계약 문단에 섞인 예고 한 문장"을 조건 1이 성립하는 상태로 만났을 때 참조할 선례로서만 값이 있다 — target 이 이 판정을 `plan/`(휘발성이 상대적으로 낮은 위치)에만 남기고 `.claude/docs/subagent-call-contract.md` 류의 영구 문서로 승격하지 않는 것은 이번 스코프에서는 지적 대상이 아니다(과잉 요구).
- **제안**: 없음 (확인 목적의 기록).

### [정보 — 확인 완료] `PROJECT.md` 를 developer 후속으로 재배정한 판단은 SKILL.md 경로 표 문면과 정확히 일치한다

- **target 위치**: `## 3번은 이 턴에서 못 한다 — PROJECT.md 는 developer 소유다`
- **과거 결정 출처**: `review/consistency/2026/09/10/15_23_41/convention_compliance.md` (`PROJECT.md 도 거버넌스 문서라 developer 가 직접 쓸 수 없다`고 적은 원 근거)
- **확인 결과**:
  - `.claude/skills/developer/SKILL.md:33` — `| README.md, PROJECT.md | Read/Write |` (명시적 developer 소유, 실측 그대로).
  - `.claude/skills/project-planner/SKILL.md` 의 경로 표 — `spec/**`·`plan/**`·`codebase/**`(read-only)·`review/**`(read)·`.claude/docs/**`+`.claude/skills/**/SKILL.md`+`CLAUDE.md`(거버넌스) 뿐이며 `PROJECT.md` 항목 자체가 없다.
  - `CLAUDE.md` §Skill 체계 표도 planner 의 "거버넌스 문서"를 `CLAUDE.md`·`.claude/skills/**/SKILL.md`·`.claude/docs/**` 셋으로만 한정한다 — `PROJECT.md`는 포함되지 않는다.
  - 따라서 target 이 "`15_23_41`의 `convention_compliance` 문장이 틀렸고 내가 그것을 실측 없이 트래커로 옮겼다"고 자기 정정한 것은 **정확한 역방향 정정**이다. 세 SoT(두 SKILL.md 경로 표 + CLAUDE.md 표)가 모두 같은 방향을 가리킨다.
- **제안**: 없음 (확인 목적의 기록).

## 요약

CRITICAL 급 발견은 없다 — 신설 `R-17`은 `2-trigger-list.md`의 기존 R-1~R-16 중 어느 것도 재도입·번복하지 않고, `조건 2/조건 4` 경계 판정은 `CLAUDE.md` §자기-반증형 소정정 조항의 문면과 `13_48_39` 리포트가 실제로 지적한 조건 1 위반(`dc77317cd`가 `docs(spec)`/`--spec` 게이트로 도입한 planner 문장) 실측 둘 다와 정합하며, `PROJECT.md` 재배정도 두 SKILL.md 경로 표와 `CLAUDE.md` §Skill 체계 문면을 그대로 따른 올바른 자기 정정이다. 다만 신설 `### 기각한 대안` 문단 자체에 두 가지 정밀도 결함이 있다 — (1) "양성 4건"·"다섯 형태"와 모순되는 "셋 다 있어야" 라는 숫자 오기, (2) `#1308` 뮤테이션 실측이 W4 를 실제로 잡아낸 것은 양성 case E 인데, 이 문단은 그 보호를 삭제 대상인 음성 case A 의 존재 탓으로 돌리는 인과 과장. 둘 다 spec 에 반영되기 전 정정이 필요하지만, 성격상 "기존 결정의 재도입/번복"이 아니라 새로 쓰는 Rationale 항목 자체의 내부 정합성 문제라 등급은 WARNING 에 그친다. 부수적으로 `R-17`을 Rationale 로, 스케줄 축 동등 서술을 본문에 남기는 구조적 비대칭은 결정이 갈린 것이 아니라 위치가 갈린 것이라 INFO 로 남긴다.

## 위험도

LOW
