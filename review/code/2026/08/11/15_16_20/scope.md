# 변경 범위(Scope) Review — 커밋 `3f1169ab5`

## 점검 배경

plan(`plan/complete/webchat-boot-apibase-scheme-validation.md`, 구 `plan/in-progress/...`)이
정의한 범위는 체크리스트 3항목뿐이다: (1) `wc:boot` 경로에도 스킴 검증을 적용할지 판정,
(2) 적용하기로 하면 구현+회귀 테스트, (3) 미적용 시 근거만 주석에 고정. 커밋은 "적용"으로
판정하고 구현+테스트를 실었다. 이 틀 안에서 코드 diff(`use-widget.ts`/`use-widget.test.ts`)
자체는 대체로 타이트하다. 문제는 **spec 변경을 누가/어떤 경로로 했는가**에 있다.

## 발견사항

- **[CRITICAL] `developer` 가 `spec/` 을 직접 편집 — role 경계 위반, 정해진 우회 경로 미사용**
  - 위치: `spec/7-channel-web-chat/4-security.md:39`(입력검증 표 행 수정), `spec/7-channel-web-chat/4-security.md:177-204`(§R0 신설) / 근거: `plan/complete/webchat-boot-apibase-scheme-validation.md:5`(`owner: developer`), `:8-9`(`spec_impact:`)
  - 상세: `.claude/skills/developer/SKILL.md:28` 은 명시적으로 `spec/` 을 **Read only** 로 규정하고 "수정 시 `project-planner` 위임. 갱신 제안은 `plan/in-progress/spec-update-<name>.md`" 라고 정한 정식 경로가 있다. `PROJECT.md` §변경유형→갱신위치 매핑의 마지막 행("spec 자체에 누락·오류가 있다고 판단됨 → `plan/in-progress/spec-update-<name>.md` 에 제안 노트 작성 후 `project-planner` 위임")도 동일하다. `CLAUDE.md` 본문도 "구현 중 spec 변경 필요 시 `developer` 는 멈추고 `project-planner` 위임" 이라고 명시한다. 이 커밋은 `owner: developer` 인 plan 이 코드 변경·plan 완료 이동과 **같은 커밋**에서 `spec/7-channel-web-chat/4-security.md` 를 직접 고쳤다 — `spec-update-<name>.md` 제안 문서도, `project-planner` 위임·`/consistency-check --spec` 실행 흔적도 없다.
  - 다만 **내용 자체는 "새 제품 정의" 가 아니라 "동작을 바꿨으니 서술을 맞춘 것"** 이다: 표 행은 실제로 구현된 이중 경로 검증을 정확히 반영하고, §R0 은 이 파일의 기존 `## Rationale` 컨벤션(R1~R6 와 동일 형식 — 채택/기각 대안 명시)을 그대로 따른다. plan frontmatter 에도 애초에 `spec_impact: [spec/7-channel-web-chat/4-security.md]` 가 선언돼 있어 이 spec 변경 자체는 **plan 이 처음부터 의도한 범위**다. 즉 "무엇을" 바꿨는지는 범위 내이지만 "누가 어떤 절차로" 바꿨는지가 정해진 워크플로를 우회했다.
  - 제안: 두 가지 중 하나로 정합화. (a) 이 spec diff 를 별도 `plan/in-progress/spec-update-webchat-apibase-scheme.md` 제안으로 떼어 `project-planner` 가 `/consistency-check --spec` 통과 후 반영(내용은 이미 작성돼 있으므로 재작업 비용은 작다), 또는 (b) 사용자/`project-planner` 가 이 커밋의 spec 변경을 사후 승인했다는 근거를 plan 에 남긴다. 현재 상태로는 governance 상 정당성 근거가 diff 안에 없다.

- **[WARNING] 선재 결함(`boot.apiBase === undefined` 가 검증된 쿼리 값을 덮던 것) 수정이 같은 PR 에 실림 — 별 트랙 후보였으나 기계적으로 분리 불가능**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:236-247`(`mergeBootConfig`, 특히 `241-244`의 주석과 `merged.apiBase = (safeApiBase(...) ?? fromQuery.apiBase)` 계산)
  - 상세: 이 결함은 "boot 경로에 스킴 검증이 없다"(plan 이 판정하려던 문제)와 **다른 축**이다 — 스킴이 유효하더라도 `boot.apiBase` 가 명시적으로 `undefined` 면 spread(`{ ...fromQuery, ...boot }`)가 검증된 쿼리 값을 지운다. 스킴 검증이 전혀 없던 종전에도 존재하던 선재 버그다. 다만 수정이 **거절(reject)과 부재(absent) 두 갈래를 하나의 `??` 표현식**으로 처리하는 형태라, "거절만 폴백시키고 부재는 spread 에 맡긴다" 로 쪼개 쓰면 오히려 부자연스럽고(같은 결함의 절반만 고치는 셈), 커밋 메시지·plan·테스트(`"쿼리도 없고 boot 도 거절되면 undefined"`·`"boot 이 apiBase 를 아예 안 보내면 쿼리 값이 그대로 산다"`) 전부가 이 사실을 투명하게 기록해 뒀다. plan 자신의 Overview 가 "형제 티켓 분리" 관행을 명시적으로 알고 있는 계열(webchat)인데도 이번엔 분리하지 않았다 — 근거(기계적 비분리성)는 타당해 보이나, 이 판단이 문서화된 원칙(형제 티켓 분리)에 대한 의도적 예외라는 점은 리뷰어가 확인할 가치가 있다.
  - 제안: 액션 불요(사후 확인용 기록). 다음에 유사 상황이면 plan 체크리스트나 커밋 본문에 "왜 분리하지 않았는가" 한 줄을 명시하면 이 질문이 재발하지 않는다.

- **[INFO] `safeApiBaseFromQuery` → `safeApiBase(raw, source)` 일반화는 정당한 최소 변경**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:197-218`
  - 상세: 검증 로직을 쿼리·`wc:boot` 두 경로에 걸려면 `console.warn` 문구의 출처 구분(`source` 파라미터)이 필요하고, 이는 로직 복제보다 낫다. 기존 이름은 `@deprecated` 얇은 위임으로 보존돼 하위 호환(`use-widget.test.ts` 의 기존 `describe("safeApiBaseFromQuery", ...)` 블록 무변경 유지)도 지킨다. "불필요한 리팩터"로 볼 근거는 없다 — 새 요구(2경로 공용)가 직접 요구하는 최소 일반화다.

- **[INFO] `use-widget.test.ts`/`use-widget.ts` 나머지 diff 는 plan 체크리스트와 1:1 대응**
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.test.ts:51-114`(신규 `mergeBootConfig` describe 블록 6건), `codebase/channel-web-chat/src/widget/use-widget.ts:1344`(`onBoot` 콜백이 `mergeBootConfig` 사용)
  - 상세: 추가된 임포트(`mergeBootConfig`)·테스트 6건·JSDoc 확장 전부 이번 스킴 검증 확장을 직접 겨냥한다. 포맷팅/주석/임포트 정리 등 무관한 변경은 발견되지 않았다. `plan/complete/...`↔`plan/in-progress/...` 파일 이동(신규+삭제 쌍)은 정상적인 plan lifecycle 완료 처리다.

## 요약

코드 diff(위젯 스킴 검증 확장)는 plan 체크리스트가 정의한 범위와 정확히 일치하며, 함수 개명·헬퍼
추출·번들된 선재 버그 수정 모두 "이 기능을 올바르게 구현하려면 필연적으로 같이 건드려야 하는"
최소 변경으로 판단된다(개명은 필수 일반화, 버그 수정은 같은 `??` 식으로 기계적으로 묶여 있어
분리 비용이 실익보다 큼). 반면 spec 변경(`4-security.md` 표 행 + §R0)은 **내용은 정당**(구현과
합치·기존 Rationale 컨벤션 준수·plan 이 애초에 `spec_impact` 로 선언)하지만, **`developer` 가
`project-planner` 위임 없이 직접 `spec/` 을 커밋**했다는 점에서 이 저장소가 명시적으로 정한
role 경계(`developer/SKILL.md:28`, `PROJECT.md` 매핑 마지막 행, `CLAUDE.md`)를 벗어난다. 이는
"범위가 벗어났다"기보다 "옳은 내용을 잘못된 채널로 반영했다"는 governance 위반이다.

**머지 가능 여부**: 코드 부분만 보면 머지 가능하지만, spec 변경의 절차적 정당성이 diff 안에서
확인되지 않아 **그대로는 머지를 권하지 않는다**. `project-planner` 경유(사후라도 `spec-update-*`
제안 + `/consistency-check --spec` 통과 근거)를 남기거나, 최소한 이 절차 예외가 왜 허용됐는지
plan/커밋에 기록해야 수렴한다.

**수렴 여부**: 기능 범위(스킴 검증 자체)는 수렴했다 — 추가 라운드가 필요한 기능적 미비는 보이지
않는다. 다만 role 경계 CRITICAL 1건은 이번 리뷰에서 처음 제기되는 새 발견이라, 다음 라운드에서
(a) spec 변경 채널 문제 해소 여부 재확인이 필요하다.

## 위험도

HIGH — 구현 자체의 위험은 낮으나(선재 버그 수정도 투명하게 처리됨), 정식 워크플로가 명시적으로
막아 둔 경로(`developer` → `spec/` 직접 쓰기)를 우회한 governance 위반이 있어 머지 전 조치가
필요하다.

STATUS: OK
