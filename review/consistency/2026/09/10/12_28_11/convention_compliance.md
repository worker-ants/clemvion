# 정식 규약 준수 검토 (Round 2 — 재검증) — `spec-draft-ws-protocol-intro.md`

target: `plan/in-progress/spec-draft-ws-protocol-intro.md` 의 두 코드펜스
(`### 본문` / `### 추가 변경 — ## Rationale 에 헤딩 선택 근거 한 항목`),
`spec/5-system/6-websocket-protocol.md` 에 삽입될 예정.

Round 1(`review/consistency/2026/09/10/12_11_41`)이 낸 CRITICAL 1건·WARNING 1건의 정정 여부를 확인한다.

## 발견사항

- **[WARNING] "내용 기반 판별 기준"이 3개 문서는 구제하지만 9개 쪽으로 되짚으면 대칭이 깨진다**
  - target 위치: "### 접미사를 안 붙이는 근거를 갈았다" 절 + 신규 Rationale 펜스 두 번째 문단
  - 위반 규약: 직접적인 `spec/conventions/*` 항목은 없음 — `project-planner/SKILL.md:44`
    (`## Overview (제품 정의)` = "영역의 사용자 가치·요구사항·목표") 를 target 스스로 규약 근거로
    인용했으므로, 그 규약을 반대 방향(접미사가 붙은 9개)으로도 적용했을 때 성립해야 논증이 완결된다.
  - 상세: `1-auth.md`·`3-error-handling.md`·`4-execution-engine.md` 세 문서를 직접 열어 확인한 결과,
    셋 다 "정의한다" + 섹션 맵/SoT 경계로만 구성돼 있고 "사용자 가치·요구사항·목표" 류 문장은
    실제로 0건이다 — `4-execution-engine.md` 는 스스로 "본 문서는 그 **내부 계약**을 정의한다"
    라고까지 말한다. 즉 round 1 이 반증으로 지목한 `1-auth.md` 는 새 기준(주제가 아니라 절의
    **내용**) 아래에서 확실히 구제된다 — 판단은 유지된다.
    다만 반대 방향(접미사가 **있는** 9개가 정말 "사용자 가치·요구사항·목표"를 담는가)으로 표본
    하나를 대조하면 대칭이 깨진다. `2-api-convention.md`(`## Overview (제품 정의)`, 32~40행)의
    본문은 "본 문서는 HTTP API 가 밖에서 어떻게 보이는가를 정하는 단일 진실이다 — URL 구조,
    요청/응답 봉투, 에러 형식, 페이지네이션... 그리고 값이 없음을 어떻게 표현하는가" 로,
    `1-auth.md`(접미사 없음)의 "플랫폼의 인증·인가·감사 기반을 정의한다... 사용자 신원과 권한의
    단일 진실이다" 와 **문형·추상도가 사실상 동일**하다 — 둘 다 "정의한다/단일 진실이다" 로
    시작하는 스코프 선언이지 "사용자가 무엇을 얻는가"를 서술하는 PRD 문장이 아니다. `2-api-convention.md`
    쪽이 조금 더 "왜 중요한가"(외부 소비자에게 전파되는 위험)를 곁들이지만, 그 위험 서술은
    `1-auth.md` 의 SoT 경계 각주(AuthConfig 권한 분리)와 결이 다르지 않다.
  - 제안: target 문서 자신의 선택(순수 `## Overview`, PRD 문장 0건)은 이 재검증으로도 유효하다 —
    가장 근접한 두 자매(`3-error-handling.md`·`4-execution-engine.md`)와 구조·밀도가 일치하기
    때문이다. 다만 "판별이 주제가 아니라 절의 내용"이라는 **일반 법칙**으로 9곳 전체를 정당화하는
    문장은 과장이다. Rationale 항목의 마지막 문장("판별이 주제가 아니라 내용임을 보이는 사례")을
    "이 문서 자신의 선택이 유효함을 보이는 사례"로 좁히거나, 9곳 전수 대조 없이 일반화하지 않는
    것이 좋다. target 의 실제 채택 결정을 뒤집을 필요는 없다.

- **[INFO] `## Rationale` 항목 삽입 위치가 명시되지 않았고, 이 문서에 강제 순서 규약은 없다**
  - target 위치: "추가 변경 — `## Rationale` 에 헤딩 선택 근거 한 항목" 절 + 체크리스트
    "`## Rationale` 에 헤딩 선택 근거 항목 1개 추가"
  - 위반 규약: 없음 — `spec/conventions/*.md`, `project-planner/SKILL.md`, `.claude/docs/*.md` 를
    확인했으나 `## Rationale` 항목의 배치 순서(시간순/주제순/append-only)를 강제하는 규약은
    존재하지 않는다. `chat-channel-adapter.md`/`15-chat-channel.md` 의 `R-CC(A)-N` ID 컨벤션은
    그 두 파일 국지적 규칙이고 본 문서에는 적용되지 않는다.
  - 상세: 대상 문서의 실제 `## Rationale` 은 엄밀한 시간순이 아니다(예: "전송 계층 정정" 항목의
    본문 제목은 2026-06-03 이지만 그보다 늦은 2026-07-14 항목 뒤에 위치) — 그러나 대체로 최근에
    추가된 항목이 뒤쪽에 쌓이는 관행이며, 현재 마지막 항목은 `WS 이벤트 enum 명명 (2026-08-30)`
    이다. target 은 새 항목을 "어디에" 넣을지(맨 끝 vs 관련 항목 옆) 명시하지 않았다.
  - 제안: 강제 규약이 없으므로 차단 사유는 아니다. 다만 관행과 맞추려면 최신 항목(`WS 이벤트
    enum 명명`) 뒤, `## Rationale` 절 맨 끝에 추가할 것을 권장 — 체크리스트에 "맨 끝에" 한 마디를
    추가하면 다음 사람이 재확인할 필요가 없다.

- **[INFO] 보조 표의 review/-스코프 수치(96/총 192)는 라이브 펜스 밖에 있고, 이미 그 시점에도 재현되지 않는다**
  - target 위치: "## 제목 표기 — 두 번 세고 한 번 기준을 갈았다" 절의 인용 건수 표
    (`review/` 96, 합계 192) — **두 코드펜스 밖**, 즉 spec 에 실제로 들어가는 문장이 아니다
  - 위반 규약: 없음(spec 미삽입 텍스트에 대한 정확도 메모)
  - 상세: 라이브 펜스에 실제로 들어가는 수치 — `96건` (`spec/` 89 · `plan/` 7 · `codebase/` 0,
    서로 다른 앵커 **13종**) — 는 직접 재측정 결과 **정확히 일치**한다(아래 "확인 완료" 참고).
    반면 펜스 밖 보조 표의 "`review/` 96 (전체 192)"는 지금 다시 세면 맞지 않는다 — `review/`
    만 독립 재측정하면 **132건**(오늘 시점, 이 라운드의 `_prompts` 번들 34건 포함)이라 합계는
    192 가 아니라 **228**이다. `review/`를 뺀 과거 스냅샷(라운드 1 폴더까지만 포함)으로 다시
    잘라도 98건이라 96과도 정확히 맞지 않는다. 이는 target 의 오기라기보다 `review/` 자체가
    **매 consistency-check 라운드마다 자신의 산출물에 target 앵커 인용을 새로 얹는 구조**이기
    때문에 어떤 스냅샷에서 재도 몇 분 안에 stale 해지는 값이다 — 그래서 target 이 "review/ 는
    과거 산출물, 유지 대상 아님"이라며 계산에서 제외한 판단 자체는 옳다.
  - 제안: 이 보조 표는 spec 에 들어가지 않으므로 차단 사유는 아니다. 다만 plan 문서에 "review/
    96 (전체 192)"처럼 구체적 정수를 박아두면 다음 사람이 그 숫자를 재현하려다 시간을 쓴다 —
    바로 이전 문단이 "116건"에 대해 지적한 것과 같은 함정이다. "review/ 는 라운드마다 값이
    바뀌므로 카운트하지 않는다"로 서술을 바꾸는 편이 더 안전하다.

## 확인 완료 항목

- **헤딩 표기 카운트 9/3**: `grep -n "^## Overview" spec/5-system/*.md` 전수 재실행 결과
  `## Overview (제품 정의)` **9개**(`10-graph-rag`·`12-webhook`·`13-replay-rerun`·
  `14-external-interaction-api`·`15-chat-channel`·`17-agent-memory`·`2-api-convention`·
  `8-embedding-pipeline`·`9-rag-search`), 순수 `## Overview` **3개**(`1-auth`·`3-error-handling`·
  `4-execution-engine`) — target 의 정정치와 정확히 일치. Round 1 WARNING 해소 확인.
- **CRITICAL(§6.2 재도입) 해소**: 라이브 펜스 1문단이 이제 "재구독 시 1회성 `execution.snapshot`
  으로 재동기화한다(§6.2) — `seq` 기반 replay 버퍼는 native WS 에 없다(SSE 어댑터 소유, §4.7)"로
  바뀌어, `## Rationale`"재연결 복구 — native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송" 항목이
  철회한 주장을 더 이상 재도입하지 않는다. §6.2 본문(969~991행)과도 정합. Round 1 CRITICAL 해소
  확인 — 이 재검증에서 이 항목을 다시 CRITICAL 로 올릴 근거 없음.
- **96건·13종 앵커 재현**: `6-websocket-protocol.md#<anchor>` 패턴을 `spec/`+`plan/`+`codebase/`
  전수로 직접 재측정 — occurrence 기준 정확히 **96건**(spec 89 / plan 7 / codebase 0), 앵커
  slug 로 grouping 하면 정확히 **13종**(`#42-...`29 · `#44-...`28 · `#446-...`7 · `#41-...`7 ·
  `#71-...`5 · `#22-...`5 · `#45-...`4 · `#445-...`3 · `#rationale`2 · `#62-...`2 ·
  `#44-실행-진행-이벤트`2(archive 내 stale citation, target 이 이미 별도 처분) · `#47-...`1 ·
  `#4-...`1, 합 96). target 의 Rationale 펜스 문장("96건... 서로 다른 앵커 13종")과 **정확히
  일치**한다.
- **116건 재현 불가**: round 1 `convention_compliance` 가 보고한 "정확히 116건"을 여러 스코프로
  재시도했으나 어느 것도 116 이 나오지 않았다 — `spec+plan+codebase`=96, `review/` 만 오늘
  시점=132(합계 228), round 1 폴더까지만 포함한 `review/`=98(합계 194), `.md` 확장자 제한 없이
  저장소 전체(.git 제외)=228. `naming_collision`(round 1) 이 이미 같은 시도(96/93/94)로 116을
  반증했었고, 이번 재확인도 같은 결론이다 — **116 은 재현 가능한 스코프를 찾지 못했다.** 다만
  이것이 "단순 덧셈 오류"인지 "라운드 진행 중 형제 checker 들이 같은 `review/` 디렉터리에 동시에
  쓰던 산출물을 함께 grep 한 타이밍 아티팩트"인지는 사후에 판별 불가 — 어느 쪽이든 결론(라이브
  96건 인용은 번호 밖 헤딩 선택으로 하나도 안 깨진다)에는 영향이 없다는 target 의 판단은 유지된다.
- **SKILL.md 인용 정확성**: `project-planner/SKILL.md:44` 원문 — "`## Overview (제품 정의)` |
  영역의 사용자 가치·요구사항·목표 (옛 PRD 자리)." — target 의 Rationale 펜스 인용문과 축자
  일치.
- **§7.1 WsErrorCode 스코프 구분**: 라이브 펜스 4문단의 "본 문서 §7.1 은 그중 transport 계층의
  `WsErrorCode` 를 다룬다"는 실제 §7.1(992~1008행) 서술 — `WsErrorCode` 는 `INTERNAL_ERROR`
  주석에서 "continuation 평면 ack 의 `EXECUTION_INTERNAL_ERROR`(`ErrorCode` enum)와 별개
  scope" 라고 스스로 명시 — 와 정확히 정합한다.
- **삽입 위치·링크 4건·헤딩 깊이**: `---` / `## 1. 연결` 사이 삽입 위치, `H2`(`## Overview`)·
  `H3`(신규 Rationale 항목) 깊이 모두 자매 문서(`2-api-convention.md`·`4-execution-engine.md`)
  뼈대와 일치. 4개 링크(`./4-execution-engine.md`·`../conventions/error-codes.md`·
  `./14-external-interaction-api.md`·`./3-error-handling.md`) 모두 실재 파일, 앵커 없는 형태도
  기존 `> 관련 문서:` 줄 관행과 일치 — 강제 게이트 없음 재확인.
- **Rationale 항목 형식**: 이 문서의 기존 `## Rationale` 항목은 `R-` ID 를 쓰는 것과 안 쓰는 것이
  섞여 있고(`R-wontdo-*`·`R-ws-*` vs 서술형 제목 다수), 후자가 더 많다 — 신규 항목이 서술형
  제목(ID 없음)을 쓴 것은 이 문서 관행에서 이례적이지 않다.

## 요약

Round 1 CRITICAL(§6.2 에서 이미 철회된 "seq 기반 복구" 주장 재도입)은 라이브 펜스에서 완전히
해소됐고, WARNING(헤딩 표기 카운트 8/2 → 9/3)도 재실측과 정확히 일치한다. 가장 중요한 실질
질문 — `1-auth.md` 반증을 무력화하는 새 판별 기준("주제가 아니라 절의 내용")이 실제로 성립하는가
— 은 이 문서의 최종 선택에 관한 한 **성립**한다: `1-auth.md`·`3-error-handling.md`·
`4-execution-engine.md` 세 자매 모두 PRD 문장 없이 스코프+섹션맵+SoT 경계만 담고, target 자신의
Overview 초안도 정확히 같은 형태다. 다만 그 기준을 "9개 vs 3개"를 가르는 **일반 법칙**으로
확장하면 대칭이 깨진다 — `2-api-convention.md`(접미사 있음)의 실제 문장도 `1-auth.md`(접미사
없음)와 추상도·문형이 크게 다르지 않아, 저장소 전체의 9/3 분열은 여전히 (round 1 이 짚었듯)
역사적 비일관성에 더 가까워 보인다. `## Rationale` 신규 항목의 수치(96건, 13종 앵커, SKILL.md
인용)는 모두 축자 재현됐고, 116 은 어떤 스코프로도 재현되지 않아 target 이 그 숫자를 폐기한
판단은 옳다. `## Rationale` 배치 순서를 강제하는 규약은 없으므로 위치 미명시는 위반이 아니다.
전반적으로 이 재검증에서 새로 올릴 CRITICAL 은 없고, 2건의 저강도 서술 정확도 문제(9/3 논증의
일반화 과잉, review/-스코프 수치의 stale 화)만 남는다.

## 위험도

LOW — CRITICAL·WARNING 모두 해소 확인. 남은 발견사항은 서술의 일반화 범위·보조 수치 정확도에
관한 것으로, spec 에 실제로 삽입되는 두 코드펜스의 내용을 뒤집을 사안이 아니다.
