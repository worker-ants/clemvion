# 정식 규약 준수 검토 — `2-api-convention.md §10.4` 재연결 정정 draft

- target: `plan/in-progress/spec-draft-api-convention-104-reconnect.md` (§10.4 교체안, E-1)
- 대조: `spec/5-system/2-api-convention.md` §10(§10.1~§10.4, Rationale), `spec/5-system/6-websocket-protocol.md` §1.2·§4.7·§6.1·§6.2, `spec/conventions/**`, `CLAUDE.md`

## 발견사항

- **[INFO] 신규 앵커 3건 — github-slugger 실측으로 전부 유효·유일함을 확인**
  - target 위치: E-1 교체 블록의 세 링크 (`#61-클라이언트-재연결-socketio-내장`, `#62-놓친-이벤트-복구`, `#47-외부-표면-매핑-external-interaction-api`)
  - 위반 규약: 해당 없음 (검증 결과 — 준수)
  - 상세: 저장소가 실제로 쓰는 앵커 검증 라이브러리(`codebase/frontend/package.json` 의 `github-slugger@2.0.0`, `spec-link-integrity.test.ts`/`spec-links.ts` 가 이 라이브러리로 heading→slug 를 계산해 `spec/**` 상대링크를 build-time 에 검증)를 직접 실행해 세 heading 텍스트를 슬러그화했다.
    - `### 6.1 클라이언트 재연결 (Socket.IO 내장)` → `61-클라이언트-재연결-socketio-내장` (일치)
    - `### 6.2 놓친 이벤트 복구` → `62-놓친-이벤트-복구` (일치)
    - `### 4.7 외부 표면 매핑 (External Interaction API)` → `47-외부-표면-매핑-external-interaction-api` (일치)
    - `6-websocket-protocol.md` 전체 heading 을 순서대로 슬러그화해도 동일 슬러그를 만드는 다른 heading 은 없다 — dedup 접미사(`-1` 등) 위험 없음.
  - `#61-...` 앵커는 실측대로 저장소 어디에도 기존 인용이 없어(`grep` 0건) 이번이 최초 피인용이며, 지금까지 링크 가드가 이 특정 슬러그 계산을 검증한 적이 없었다는 draft 의 주장도 사실과 일치한다. 반면 `#62-...`·`#47-...` 은 이미 `14-external-interaction-api.md` 두 곳에서 인용 중이라(442행, 1148행) 가드가 이미 통과시킨 형태다 — draft 의 서술과 정확히 일치.
  - 제안: 없음 (그대로 반영 가능). `codebase/frontend`(vitest `spec-link-integrity`)를 `--impl-done`/CI 에서 반드시 재확인해 `#61-...` 최초 피인용이 실제로 가드를 통과하는지 기계적으로도 못박을 것.

- **[WARNING] §10.4 값 삭제·SoT 위임이 정당해도, `## Rationale` 갱신이 빠져 있다**
  - target 위치: `plan/in-progress/spec-draft-api-convention-104-reconnect.md` §변경안(E-1)·§체크리스트 — `2-api-convention.md` 본문(§10.4)만 교체 대상이고 `## Rationale` 추가/갱신 항목이 없음
  - 위반 규약: `CLAUDE.md` §정보 저장 위치(단일 진실 원칙) 표 — "결정의 배경·근거 | 해당 spec 문서 끝의 `## Rationale`" / `.claude/skills/project-planner/SKILL.md` "각 spec 문서는 3섹션 (Overview / 본문 / Rationale)"
  - 상세: `2-api-convention.md` 는 이미 §10.4 자체를 대상으로 한 Rationale 항목("§10.4 재연결 요약에 예외를 '복제' 하지 않고 '위임' 한 이유", 2026-09-02)을 갖고 있다. 그 항목은 **현재(교체 전) 본문**을 전제로 "§10.4 는 재연결을 두 줄로 요약하는데, 그 둘 다 서버가 스스로 끊은 경우에는 틀리다" 라고 서술한다. draft 가 본문만 바꾸고 이 Rationale 항목을 그대로 두면, Rationale 이 **이제는 존재하지 않는 옛 두 불릿(1s/2s/4s.../마지막 이벤트 ID 재전송)** 을 현재형으로 서술하는 채로 남는다 — 이 저장소가 반복적으로 지적해 온 "문서가 스스로 만든 drift" 와 같은 모양이다(§5.3/§10.4/§11 세 개 모두 Rationale 항목을 갖고 있는 것이 이 문서의 확립된 패턴). 실제로 이 문서 안의 다른 모든 유사 정정(§5.3 410 코드, §11 webhook 위임·정합화)은 전부 별도 Rationale 서브섹션을 동반한다.
  - 제안: E-1 과 함께 `## Rationale` 에 새 서브섹션(예: "§10.4 재연결 수치·복구 메커니즘 정정 — SoT 재확인 (2026-09-10)")을 추가해 ①숫자를 지운 이유(SoT 가 스스로 초안 값이라 명시), ②last-event-ID 재전송 문장을 뺀 이유(§6.2 가 이미 철회한 전제), ③예외 註 구분축 교정 이유를 적고, 기존 2026-09-02 항목 끝에 한 줄로 "본문은 20XX-09-10 정정됨 — 아래 신규 항목 참조" 식 상호 참조를 남길 것. (등재 draft 자체의 "무엇을 하지 않나" 절에 이미 이런 취지의 서술이 있으니 그 문단을 거의 그대로 Rationale 로 옮기면 된다 — 새로 조사할 내용은 없다.)

- **[INFO] §10 구조 특성화("짧은 인라인 요약 + 말미 위임")는 실측과 일치**
  - target 위치: draft "① '§10 의 나머지 소절은 이미 전면 위임 구조' — 거짓" 절의 표
  - 위반 규약: 해당 없음 (검증 결과 — 정확)
  - 상세: 디스크의 `2-api-convention.md` §10 을 직접 읽어 대조했다. §10.1(엔드포인트 URL 인라인 코드블록)·§10.2(JSON 프레임 인라인 예시)·§10.3(용도 표 인라인, "실행 제어" 행만 `§4.2` 링크)·§10 말미의 "상세 프로토콜: … 참조" 위임 문장 — draft 의 표가 서술한 그대로다. 따라서 "§10.4 만 서술을 비우면 그 소절이 §10 안에서 혼자 빈다" 는 근거는 성립하고, (a)(서술 유지 + 사실 정정 + SoT 인용) 선택은 §10 의 실제 구조와 정합한다.

- **[INFO] 불릿·blockquote·상대링크 형식은 두 문서의 기존 관용구와 일치**
  - target 위치: E-1 교체 블록 전체
  - 위반 규약: 해당 없음 (검증 결과 — 준수). 참고 규약: `spec/conventions/swagger.md` §3 "상세 근거는 spec 본문에 두고 여기서는 요약 1~2문장 + SoT 링크로 적는다"(다른 문서지만 이 저장소가 반복 채택하는 "짧은 요약 + SoT 링크" 패턴과 동형), `spec/conventions/cafe24-api-metadata.md`:399 의 "한 줄 요약… §2 가 SoT" 서술도 같은 패턴.
  - 상세: `- **레이블**: 설명` 형태의 bold-lead-in 불릿은 `6-websocket-protocol.md` 전역에서 이미 관용구다(§4.2 486~490행, §4.7 "핵심 규약" 956~959행 등). `> **레이블:** 설명` 형태의 blockquote 역시 같은 문서·`2-api-convention.md` 양쪽에서 반복 사용된다(예: `1-2` 절의 "비채택 (won't-do)" 註, 기존 §10.4 의 "예외 — 서버가 끊은 경우" 註). 상대경로 링크 `./6-websocket-protocol.md#...` 도 같은 절 §10.3 의 기존 링크(`./6-websocket-protocol.md#42-...`)와 동일 패턴이다. `plan/in-progress/spec-draft-api-convention-104-reconnect.md` 자체 frontmatter(`worktree`/`started: 2026-09-10`/`owner: planner`, `spec_impact` 를 리스트로 선언)도 `plan-lifecycle.md` §4 스키마와 일치한다.
  - 이 항목은 위반이 아니라 확인 결과이며, 별도 조치 불요.

- **[INFO] §10.1/§10.2 미변경 판단 — 결론은 타당하나 §10.1 에 붙인 근거 라벨이 살짝 헐겁다**
  - target 위치: draft "무엇을 하지 않나" 절 첫 항목
  - 위반 규약: 해당 사항 아님 — 이 항목은 규약 위반이 아니라 draft 자체 서술의 정밀도 문제
  - 상세: `6-websocket-protocol.md §1` 註가 "논리적 메시지 형태를 보이기 위한 추상화" 라고 명시한 대상은 정확히 `{ type, id, payload }` **메시지 프레임 표기** — 즉 §10.2 — 다. §10.1 의 `ws(s)://{base_url}/ws?token={access_token}` 은 그 주석이 다루는 대상이 아니다: 이는 §1.1 의 엔드포인트(`wss://{base_url}/ws`)와 §1.2 의 인증 방식 (1) "쿼리 파라미터 `?token={access_token}`"(우선순위 1위, 실제 채택된 경로)을 합쳐 쓴 **정확하고 실재하는** 요약이지, "논리적 추상화로 처리된, 사실은 다른 표기" 가 아니다. §1 註가 raw-WS 전제로 명시 지목하는 항목은 §1.2 의 **서브프로토콜 인증**(`Sec-WebSocket-Protocol`, 비채택)이지 쿼리 파라미터 경로가 아니다. 다만 이 오차는 결론(§10.1 을 건드리지 않는다)을 뒤집지 않는다 — §10.1 은 애초에 실재하는 메커니즘을 적고 있어 §10.4 가 겪은 문제("존재하지 않는 메커니즘을 사실로 적음")와 성격이 다르기 때문이다. 즉 "같은 §1 註 하나가 §10.1·§10.2 를 함께 커버한다" 는 근거 진술만 부정확하고, "§10.1 은 그대로 둬도 된다" 는 실질적 결론은 옳다.
  - 제안: draft/최종 spec 본문 어디에도 이 근거를 그대로 옮기지 않는다면 무해하지만, 만약 이 문단을 spec 의 Rationale 로 옮길 계획이라면(위 WARNING 항목 참고) §10.1 부분은 "§1.2 옵션 (1) 과 일치하는 실재 경로라 정정 대상이 아니다" 로, §10.2 부분만 "§1 註가 논리적 추상화로 명시 처리" 로 갈라 적을 것.

## 요약

핵심 절차 준수 항목(신규 앵커 3건의 github-slugger 유효성·유일성, §10 구조 특성화, 불릿/blockquote/상대링크 형식, plan frontmatter 스키마)은 모두 실측으로 확인했고 전부 규약과 일치한다 — CRITICAL 급 위반은 없다. 유일한 실질 공백은 이 정도 규모의 사실 정정(SoT 가 스스로 부인한 초안 수치 삭제, 존재하지 않는 재전송 메커니즘 삭제, 예외 구분축 교정)임에도 `2-api-convention.md` 자신의 `## Rationale` 을 갱신하지 않는다는 점이다 — 같은 문서 안에 이미 있는 2026-09-02 §10.4 Rationale 항목이 정정 후에도 옛 본문을 현재형으로 서술한 채 남아, "SoT 에 맞춰 요약을 고친다" 는 이 draft 의 취지와 어긋나는 잔여 drift 를 문서 자신의 Rationale 섹션에 새로 만든다. §10.1 에 붙인 "§1 註가 이미 추상화로 처리했다" 는 근거 라벨도 §10.2 에만 정확히 들어맞고 §10.1 에는 다소 헐겁게 적용됐지만, 결론 자체(§10.1 미변경)는 바르다.

## 위험도
LOW
