# 신규 식별자 충돌 검토 결과

## 검토 대상 정리

target = `plan/in-progress/spec-update-catch-all-terminal-contract.md` — project-planner 위임용
spec 보강 draft (`--spec` 모드). 본 문서는 아래 4개 제안으로 구성된다.

- 제안 1: `spec/2-navigation/_layout.md` §2.2 각주(85행)에 문장 추가 (`(terminal)` 괄호 표기 포함)
- 제안 2: `spec/2-navigation/9-user-profile.md` §3 (155행) 문장 보정
- 제안 3(선택): `spec/2-navigation/11-error-empty-states.md` §1.3 표에 행 추가
- 제안 4: 위 3개 문서 + `10-auth-flow.md` frontmatter `code:` 글로브에 기존 코드 경로 2개 추가

먼저 확인할 것은 이 draft 가 실제로 **새 식별자를 몇 개나 도입하는가**다. 실측 결과:

- 신규 요구사항 ID 없음, 신규 엔티티/DTO/인터페이스명 없음, 신규 API endpoint 없음, 신규
  이벤트/메시지명 없음, 신규 ENV var/config key 없음, 신규 spec 파일도 없음(기존 3개 문서 본문
  수정 + frontmatter 보강뿐).
- 제안 4 가 추가하는 두 경로(`codebase/frontend/src/app/(main)/[...rest]/page.tsx`,
  `codebase/frontend/src/lib/workspace/href.ts`)는 **기존에 이미 존재하는 코드 파일**이며(실측
  `ls` 확인), 세 문서의 현재 `code:` 글로브에는 아직 포함돼 있지 않음(`grep` 확인) — 신규 파일
  생성이 아니라 기존 파일을 frontmatter 로 뒤늦게 가리키는 것뿐이라 경로 충돌 대상이 아니다.
- 유일하게 "새로 도입되는 어휘"는 제안 1의 괄호 표기 **`(terminal)`** 뿐이다. 이는 이미 이전
  세션(`review/consistency/2026/07/17/01_25_26/naming_collision.md`)이 동일 draft 를 대상으로
  심층 분석해 INFO 로 기록한 항목과 동일하다. 아래에서 --spec 관점으로 재확인한다.

## 점검 관점별 결과

### 1. 요구사항 ID 충돌 — 해당 없음
신규 요구사항 ID(`NAV-*` 등) 부여 없음. 세 문서 모두 기존 규정을 명문화·보정할 뿐이다.

### 2. 엔티티/타입명 충돌 — 해당 없음
신규 엔티티·DTO·인터페이스 도입 없음. 제안 3의 표 행이 언급하는 `(main)/[...rest]` catch-all,
`notFound()` 는 이미 존재하는 Next.js 개념/파일이며 새 이름을 만들지 않는다.

### 3. API endpoint 충돌 — 해당 없음
프론트엔드 라우팅 문서 보강뿐 — REST endpoint 신설 없음.

### 4. 이벤트/메시지명 충돌 — 해당 없음
webhook·queue·SSE 무관.

### 5. 환경변수·설정키 충돌 — 해당 없음
신규 ENV var/config key 없음.

### 6. 파일 경로 충돌 — 해당 없음 (실측)
- `plan/in-progress/` 내 동명/유사명 파일 없음(`ls plan/in-progress/ | grep -i "catch-all\|terminal\|routing"` → 본 파일 1건만).
- 제안 4의 두 코드 경로는 `spec/2-navigation/*.md` 어떤 문서의 기존 `code:` 글로브에도 아직
  등재돼 있지 않음(다른 문서가 이미 다른 의미로 점유 중인 경우 없음) — 그대로 추가해도 충돌 없음.
- 제안 3의 새 표 행은 `11-error-empty-states.md` §1.3 의 기존 "무효/비멤버 워크스페이스 slug" 행
  (line 70)과 인접 배치되지만 라벨이 다르고("`/w/<slug>` 하위 미지의 경로" vs "무효/비멤버
  워크스페이스 slug") 다루는 케이스도 다르다(라우트 부재 vs slug 해석 실패) — 표 항목 중복/충돌
  없음.

### INFO — "terminal" 용어의 도메인 교차 재사용 (신규 충돌 아님, 참고용 재확인)

- **target 신규 용법**: 제안 1이 `_layout.md` 에 추가하는 문구 — "catch-all 은 `/w/` 접두 경로를
  흡수하지 않는다(**terminal**)" (라우팅 도메인: "이 지점에서 매칭/forward 를 더 하지 않고
  종결한다"는 뜻).
- **기존 사용처**: `spec/5-system/4-execution-engine.md` 에서만 `terminal` 이 20회 등장하며
  Execution/NodeExecution 상태 라이프사이클의 formal 용어로 쓰인다(예: line 835 `terminal(재구동
  불가)`, line 1008/1016 `RESUME_* terminal`, line 1360 `terminal 경계`, line 1555 `terminal
  worker failure`). `spec/2-navigation/4-integration.md:1445-1446` 에도 "terminal refresh_token
  만료"(비가역 OAuth 상태)로 한 번 더 등장 — 이쪽은 이미 `2-navigation/` 영역 안에서 쓰이는
  기존 용례라, 이번 draft 가 처음으로 이 영역에 `terminal` 을 들여오는 것도 아니다.
- **상세**: 세 곳(실행엔진 상태 종료, 기존 integration 문서의 refresh_token 만료, 신규 draft 의
  라우팅 종결) 모두 "더 이상 전이/진행하지 않는다"는 영어 원의미를 그대로 따르는 자연스러운
  용법이며, 파일·섹션·문맥이 명확히 분리돼 있어 실질적 혼동 가능성은 낮다. 등급 상향 사유 없음
  (직전 impl-done 세션 01_25_26 의 결론과 동일 — 재확인만 하고 유지).
- **제안**: 필수 조치 아님. project-planner 가 반영 시 원하면 괄호에 "(catch-all 라우팅 종결,
  실행 상태의 terminal 과 무관)" 수준의 1회성 disambiguation 을 덧붙이는 선택지는 여전히 열려
  있으나, 두 세션에 걸쳐 반복 검토한 결과로도 실질 충돌이 아니므로 반영 여부는 project-planner
  재량에 맡긴다.

## 발견사항

CRITICAL/WARNING 없음. INFO 1건(용어 교차 재사용, 실질 충돌 아님 — 직전 세션과 동일 결론 재확인)만 기록.

## 요약

target draft 는 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV/config key·spec 또는
코드 파일 경로를 전혀 새로 도입하지 않는다 — 기존 세 문서(`_layout.md`·`9-user-profile.md`·
`11-error-empty-states.md`)의 본문 보강과 세 문서 + `10-auth-flow.md` 의 frontmatter `code:`
글로브에 이미 존재하는 코드 파일 2개를 뒤늦게 등재하는 것뿐이며, 두 경로 모두 실측 결과 다른
문서가 이미 다른 의미로 점유하고 있지 않다. 유일한 신규 어휘는 제안 1의 `(terminal)` 괄호
표기인데, 이는 직전 impl-done 세션(01_25_26)이 이미 상세 분석해 실행엔진 도메인의 formal
`terminal` 용어와 표면상 겹치지만 파일·문맥 분리 및 자연어 의미 일치로 실질 충돌이 아니라고
결론지은 바로 그 항목이며, 본 --spec 재검토에서도 같은 결론이 유지된다. 파일 경로·표 행 배치 등
추가로 점검한 항목에서도 충돌은 발견되지 않았다.

## 위험도

NONE
