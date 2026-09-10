# 정식 규약 준수 검토 — `spec-draft-trigger-canary-nav.md`

## 검토 방법

프롬프트 번들의 `spec/conventions/**` 첨부 중 다수(특히 `spec-impl-evidence.md`, `review-citations.md`)가
"컨텍스트 예산 초과"로 절단돼 있어, 해당 파일은 실제 worktree 경로에서 직접 Read 했다
(`spec/conventions/spec-impl-evidence.md`, `spec/conventions/review-citations.md`). 또한 orchestrator 가
특히 지목한 4개 쟁점은 모두 "실측으로 판정해 달라"는 요청이므로, 인용된 SKILL.md 2개·타깃 spec 파일
2개(`2-trigger-list.md`, `3-schedule.md`)·관련 git 이력을 직접 열어 대조했다.

---

## 발견사항

### [WARNING] "취소선 보존 = 자기-반증형 소정정 전용"이라는 draft 의 일반화가 같은 문서의 최근 선례로 반증된다

- **target 위치**: draft `## 변경안 A` 도입부("**옛 문단을 취소선으로 남기지 않고 교체한다.** … 취소선
  보존은 **자기-반증형 소정정 조건 4** 의 요구인데 이 턴은 그 예외를 쓰지 않는(쓸 수 없는) 정규
  planner 편집이다") 및 `## Rationale > ### 왜 §3 註의 이력을 본문에 안 남기고 Rationale 로 보내나`
- **위반 규약**: `CLAUDE.md §자기-반증형 소정정` 조건 4(취소선 요구) — draft 는 이 조항을 "취소선은
  이 예외에서만 쓴다"로 **역방향으로 읽었다.** CLAUDE.md 원문은 "이 예외를 쓸 때는 취소선을 써야
  한다"만 규정할 뿐 "이 예외가 아니면 취소선을 쓸 수 없다"를 규정하지 않는다.
- **상세**: 바로 이 target 파일(`spec/2-navigation/2-trigger-list.md`)의 **R-2**(§3 註 바로 아래 위치,
  1번·4번 항목이 손대는 절과 인접) 가 이미 실제 반례다. R-2 는 `ee96a90de`(#1299, 커밋 메시지
  "전부 `spec/` + 거버넌스 문서 쓰기라 `codebase/**` 변경은 0줄이다" — **순수 planner 턴**, 자기-반증형
  소정정 아님)에서 취소선으로 옛 본문을 보존했다. 그 커밋이 명시한 보존 사유는 자기-반증형 소정정과
  무관하다: *"본 절을 지우지 않는 이유: [Chat Channel R-CC-10] 이 '우리가 보유한 secret ↔ 외부
  provider 에 등록된 token' 대조군으로 이 절을 인용한다. 그 대조는 자원 성격의 대조라 설계가 폐기돼도
  유효하다."* 즉 이 저장소가 실제로 쓰는 판정축은 **"다른 문서가 옛 텍스트를 참조/대조군으로 인용하는가"**
  이지 "자기-반증형 소정정인가"가 아니다.
  - 확인을 위해 `grep -rn "2-trigger-list.md#3" spec/`로 §3 인용처를 전수 확인했다 —
    `3-schedule.md:161`·`3-error-handling.md:234,238`·`15-chat-channel.md:380` 4곳 모두 §3 전체
    또는 PATCH 설명을 가리킬 뿐, "이 축에는 캐너리가 아직 없다"는 **특정 문장을 대조군으로 인용하는
    곳은 없다.** 따라서 이번 건은 R-2 와 달리 취소선 보존을 강제할 교차문서 의존이 없어 보이고,
    "교체" 라는 **결론 자체**는 이 축(R-2 가 실제로 쓰는 판정축)으로 봐도 방어 가능하다.
  - 문제는 결론이 아니라 **draft 가 적은 근거**다. "취소선 보존은 자기-반증형 소정정 전용" 이라는
    문장이 그대로 `## Rationale`에 실리면, 방금 예시로 든 실제 반례(R-2, 같은 문서)와 정면으로
    모순되는 규칙을 spec 문서 스스로 주장하게 된다. 다음 편집자가 이 문장을 읽고 "정규 planner
    턴에서는 취소선을 쓸 수 없다"로 일반화하면, 교차문서 의존이 있는 다음 케이스에서도 잘못 전체
    교체를 선택할 위험이 생긴다.
- **제안**: 근거 문장을 "이 턴은 자기-반증형 소정정 예외가 아니라서 취소선을 안 쓴다"가 아니라,
  "본 문서 R-2 의 선례가 보여주듯 취소선 보존은 **다른 문서가 옛 텍스트를 대조군/참조로 인용할 때만**
  필요하다 — §3 註의 캐너리 비대칭 문장을 인용하는 타 문서는 없음을 확인했으므로(전수 grep 결과) 전체
  교체 + Rationale 이관을 택한다"로 정정할 것을 제안한다. 이렇게 고치면 결론은 그대로 유지하면서
  R-2 와 모순되지 않는다.

### [WARNING] `2-trigger-list.md` Rationale 절의 로컬 명명 관례(`### R-N. <제목>`)와 draft 가 인용한 선례(`2-api-convention.md §10.4`)의 헤딩 스타일이 다르다 — 그대로 옮기면 로컬 일관성이 깨진다

- **target 위치**: draft `## Rationale`의 `### 왜 §3 註의 이력을 본문에 안 남기고 Rationale 로
  보내나` / `### 신설 R-17 — …` / `### 기각한 대안 — …` 세 헤딩
- **위반 규약**: CLAUDE.md 의 "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`" 자체는 헤딩
  포맷을 강제하지 않지만, **대상 문서(`2-trigger-list.md`) 자신의 기존 16개 Rationale 항목 전부**가
  예외 없이 `### R-N. <제목>` 패턴을 쓴다(`grep -n "^### R-" spec/2-navigation/2-trigger-list.md` 로
  R-1~R-16 전수 확인, R-N 이 아닌 헤딩 0건).
- **상세**: draft 는 근거로 `2-api-convention.md §10.4`(#1307) 를 든다 — 그 문서는 실제로
  `### §10.4 재연결 요약에 예외를 "복제" 하지 않고 "위임" 한 이유` 같은 **자유 서술형 헤딩**을 쓴다.
  하지만 이는 `2-api-convention.md` **자신의 로컬 관례**이고, `2-trigger-list.md` 는 정반대로 전
  항목을 번호로 통일해 왔다(폐기된 R-2 도 번호를 유지하고 취소선만 씀, R-7/R-8 순서가 뒤섞여도
  번호 자체는 유지). draft 가 "신설 R-17" 은 번호를 붙이면서 그 앞뒤 두 헤딩("왜 …보내나", "기각한
  대안 …")은 자유 서술형으로 적었는데, 이 세 개가 **그대로** `2-trigger-list.md`에 옮겨지면 그
  문서에서 유일하게 번호 없는 Rationale 헤딩이 된다.
- **제안**: 세 헤딩을 별도 항목으로 두지 말고, R-2 가 보여준 로컬 관례(하나의 `### R-N. <제목>` 아래
  여러 단락·불릿으로 "왜"·"기각한 대안"까지 함께 서술)를 따라 **R-17 하나의 본문 안에** 통합
  서술할 것을 제안한다. 자유 서술형 다중 헤딩을 쓰고 싶다면 그것이 `2-trigger-list.md`의 로컬
  관례 자체를 바꾸는 결정임을 `## Rationale`에 명시해야 한다(그렇지 않으면 이 문서만 이례적으로
  두 스타일이 혼재하게 된다).

### [INFO] EIA §7.1 정정 헤딩에 두 날짜를 `·`로 합치는 표기는 이 문서의 기존 "후속 정정" 패턴과 다르다

- **target 위치**: draft `## 변경안 D` — `> **정정 (2026-09-08 · 2026-09-10 보강)**: …`
- **위반 규약**: 확정된 정식 규약 위반은 아님(`spec/conventions/review-citations.md` 는 세션 경로
  인용 형식만 규율하고 이런 산문 날짜 표기는 대상 밖). 다만 같은 문서·인접 문서의 기존 관행과의
  형식 일관성 문제.
- **상세**: `14-external-interaction-api.md` 자신은 바로 위에서 "정정 이력 (2026-09-05)" 을 별도
  블록쿼트로 추가하는 방식을 이미 썼고, `2-api-convention.md §10.4` Rationale 도 "(2026-09-10
  갱신 — 위 진단이 한 칸 좁았다)" 를 **중첩 블록쿼트**로 추가했다(원 날짜 문단은 그대로 두고). 두
  선례 모두 "원래 날짜 문단 + 별도 후속 날짜 문단"이지, 하나의 괄호 안에 두 날짜를 `·`로 합치는
  형태는 저장소 전체에서 정규식으로 찾아도 선례가 없다(`grep -rn "[0-9]{4}-[0-9]{2}-[0-9]{2} · [0-9]{4}-[0-9]{2}-[0-9]{2}" spec/` 0건).
- **제안**: `> **정정 (2026-09-08)**: …` 원문을 그대로 두고, 그 아래 `> **(2026-09-10 보강)**: …` 를
  중첩 블록쿼트로 추가하는 기존 패턴을 따르면 두 선례와 일관된다. 필수 수정은 아니다.

---

## 확인됨 — draft 의 판정이 옳음 (요청된 4쟁점 중 나머지)

1. **`PROJECT.md` 소유권 (developer vs planner)** — `.claude/skills/developer/SKILL.md:33`
   (`| README.md, PROJECT.md | Read/Write |`)와 `.claude/skills/project-planner/SKILL.md`
   경로 표(줄 20-26, `spec/**`·`plan/**`·`codebase/**`(read only)·`review/**`(read)·거버넌스 문서
   셋)를 직접 대조 — **`PROJECT.md` 항목이 planner 표에 없다.** `CLAUDE.md §Skill 체계`도 planner
   거버넌스 범위를 `CLAUDE.md`·`.claude/skills/**/SKILL.md`·`.claude/docs/**` 세 가지로만 열거하고
   `PROJECT.md`를 포함하지 않는다. 트래커 원문(`spec-draft-nullable-notation-followups.md:1798`
   부근)도 항목 3을 원래 planner 배정으로 등재했던 사실을 확인했다 — draft 의 재배정(developer
   후속 분리)이 실측과 일치한다. **`--impl-done 15_23_41` convention_compliance 의 "PROJECT.md
   갱신은 planner 턴 권고" 는 이 실측 앞에서 틀렸다고 보는 것이 맞다.**
2. **`code:` glob 등재 형식** — `spec/conventions/spec-impl-evidence.md` R-1이 glob 허용을 명시
   규정하고, 같은 target 파일(`2-trigger-list.md`) frontmatter 에 이미 동일 패턴
   (`endpoint-path-conflict-wrap*.ts`, `endpoint-path-save*.ts` — 주석 + `<name>*.ts` 접두 glob)이
   존재한다. `3-schedule.md:12`(`import { expectNarrowedScheduleTriggerRef } from
   '../src/shared/testing/schedule-trigger-ref'`)도 실측 확인 — draft C 절의 "code: 에 e2e 만 있고
   헬퍼가 빠졌다"는 지적이 정확하다. `trigger-workflow-ref*.ts`/`schedule-trigger-ref*.ts` glob 은
   실제 파일(`*.ts`+`*.spec.ts` 쌍)과 모두 매치하는 것도 확인했다. **위반 없음.**
3. **Rationale 번호 `R-17`** — `2-trigger-list.md`의 기존 Rationale 항목은 R-1~R-16 이며 R-16 이
   파일의 마지막 줄(365줄)에서 끝난다. R-2 가 폐기됐어도 번호를 재사용하지 않고 그대로 두는 것,
   R-7/R-8 이 순서가 뒤섞여도 번호를 유지하는 것 모두 "번호는 발급 시점 순서로 영구 증가, 재배열
   안 함"이라는 이 문서의 실제 관례를 보여준다. 다음 신규 번호가 **R-17**인 것은 이 관례와 정확히
   일치한다. **위반 없음.** (단, 위 두 번째 WARNING 에서 지적한 헤딩 *형식*은 별개 문제.)

---

## 요약

`spec-draft-trigger-canary-nav.md`는 앞선 라운드의 `convention_compliance` 지적(W2, `PROJECT.md`
갱신은 planner 권고)을 실측으로 뒤집는데, 이번 검토에서 그 뒤집기 자체는 두 SKILL.md 경로 표와
`CLAUDE.md §Skill 체계`를 직접 대조한 결과 옳다고 확인했다. `code:` glob 등재(B/C 절)와 Rationale
번호 `R-17`도 `spec-impl-evidence.md` R-1 및 대상 문서 자신의 기존 패턴과 일치해 위반이 없다. 다만
가장 주의 깊게 봐 달라고 요청받은 "취소선 없이 교체" 판단은, **결론(교체)은 방어 가능하지만 그
근거로 든 "취소선 보존은 자기-반증형 소정정 전용"이라는 일반화가 같은 대상 문서의 매우 최근 순수
planner 커밋(R-2, `#1299`)과 정면으로 모순된다** — 그 커밋은 교차 문서 인용 의존을 근거로 취소선을
보존했을 뿐, 자기-반증형 소정정과 무관했다. 이 근거 문장을 정정하지 않고 그대로 spec 에 실으면
저장소가 실제로 지키는 규칙과 다른 규칙을 spec 문서가 스스로 주장하게 된다. 아울러 draft 가 인용한
`2-api-convention.md §10.4`의 자유 서술형 Rationale 헤딩 스타일을 그대로 `2-trigger-list.md`에
옮기면, 그 문서가 16개 항목 전부에서 예외 없이 지켜온 `### R-N. <제목>` 로컬 명명 관례가 깨진다.
두 사항 모두 WARNING 수준이며, spec 반영 전 문장/헤딩 구조를 다듬으면 해소되는 수준이다.

## 위험도

MEDIUM
