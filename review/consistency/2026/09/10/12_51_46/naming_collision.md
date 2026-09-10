# 신규 식별자 충돌 검토 — `2-api-convention.md §10.4` 정정

대상: `plan/in-progress/spec-draft-api-convention-104-reconnect.md` (E-1, §10.4 전체 교체)

## 발견사항

이번 target 은 신규 요구사항 ID·엔티티·DTO·endpoint·이벤트명·ENV/설정키·spec 파일을 도입하지 않는다. `2-api-convention.md §10.4` 의 기존 서술(백오프 수치·last-event-ID 재전송 문구)을 삭제하고 이미 `6-websocket-protocol.md` 에 존재하는 세 절로 위임하는 정정이다. 충돌 표면은 사실상 "새로 그은 앵커 링크 3개가 실제 헤딩과 정확히 일치하는가" 와 "재사용한 wire 식별자(`Last-Event-Id`/`seq`/`execution.snapshot`)의 의미가 SoT 와 같은가" 로 좁혀진다. 두 축 모두 검증했고 결함을 찾지 못했다.

- **[INFO] 신규 앵커 3건 — 계산 결과 전부 일치, 충돌 없음**
  - target 신규 식별자: `#61-클라이언트-재연결-socketio-내장` · `#62-놓친-이벤트-복구` · `#47-외부-표면-매핑-external-interaction-api` (모두 `2-api-convention.md §10.4` → `6-websocket-protocol.md` 링크)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md` — `### 6.1 클라이언트 재연결 (Socket.IO 내장)`(L1735/973), `### 6.2 놓친 이벤트 복구`(L1750/988), `### 4.7 외부 표면 매핑 (External Interaction API)`(L1659/897)
  - 상세: docs guard(`codebase/frontend/src/lib/docs/__tests__/spec-links.ts`)가 쓰는 실제 파이프라인(remark `fromMarkdown` 파싱 → `mdast-util-to-string` → `github-slugger`)을 그대로 재현해(`github-slugger`/`mdast-util-from-markdown`/`mdast-util-to-string` 로컬 설치 후 실행) 세 헤딩을 슬러그화했다.
    ```
    "6.1 클라이언트 재연결 (Socket.IO 내장)"          => 61-클라이언트-재연결-socketio-내장
    "6.2 놓친 이벤트 복구"                            => 62-놓친-이벤트-복구
    "4.7 외부 표면 매핑 (External Interaction API)"   => 47-외부-표면-매핑-external-interaction-api
    ```
    세 값 모두 target 이 쓴 문자열과 **바이트 단위로 일치**한다 (`Socket.IO` 의 `.`, 괄호, 화살표는 github-slugger 가 제거하는 문자이며 어긋나지 않았다). `6-websocket-protocol.md` 전체 헤딩(§1~§9 + Rationale, 43개)을 전수 열거해 동일 텍스트 중복이 없음을 확인했다 — 세 앵커 모두 `-1` 접미사가 붙을 이유가 없다.
    `#62`·`#47` 은 이미 `spec/5-system/14-external-interaction-api.md` L442/L1917(§62)·L1148(§47)이 인용 중인 **기존에 검증된 앵커**이고, `#61` 만 이번 target 이 도입하는 **최초 인용**이다(target 프롬프트가 명시한 대로 리포에 기존 인용 0건이었음을 grep 으로 재확인). 셋 다 이미 존재하는 SoT 헤딩을 가리킬 뿐 새 헤딩을 만들지 않으므로 "충돌"은 발생하지 않는다.
  - 제안: 없음 (통과). 다만 이 계산은 로컬에 임시 설치한 패키지로 재현한 것이라, 실제 CI 가드(`spec-link-integrity.test.ts`)로 한 번 더 통과를 확인하는 것을 권장한다(별도 라운드에서 `--impl-done`/CI 가 커버).

- **[INFO] `#104-재연결` 인바운드 인용 — 없음, orphan 위험 자체가 성립하지 않음**
  - target 신규 식별자: 해당 없음 (기존 헤딩 유지 확인)
  - 기존 사용처: 저장소 전체에서 `2-api-convention.md#10x` 형태 인용은 `spec/5-system/6-websocket-protocol.md:20` 의 `#10-websocket` (§10 최상위) 하나뿐이며, `#104-재연결` 을 직접 가리키는 인용은 **0건**이다(spec/+plan/ 전수 grep, `check_inbound` 스크립트로 헤딩-슬러그 대조까지 재확인).
  - 상세: target 은 애초에 `### 10.4 재연결` 헤딩 문자열을 바이트 단위로 그대로 유지한다(E-1 은 헤딩 아래 본문만 교체) — 슬러그는 계속 `104-재연결` 로 고정된다. 설사 인용이 있었어도 깨지지 않는 설계이고, 실측 결과 애초에 그 앵커를 쓰는 인용이 없다.
  - 제안: 없음.

- **[INFO] `Last-Event-Id` / `seq` / `execution.snapshot` — SoT 와 표기·의미 모두 일치**
  - target 신규 식별자: 해당 없음 (재사용)
  - 기존 사용처: `Last-Event-Id` — `spec/5-system/14-external-interaction-api.md` §5.2(L377 raw header 예시, L441 규약 문장), `6-websocket-protocol.md` §4.7(L~1725)·§6.2(L~1758); `seq` — `6-websocket-protocol.md §2.2`(L875-888, Redis `INCR exec:seq:<id>` monotonic counter), `14-external-interaction-api.md §R7`(L1260-1271, "SSE id / notification seq / WS seq 는 같은 monotonic counter"); `execution.snapshot` — `6-websocket-protocol.md §6.2`(`ExecutionEventType.EXECUTION_SNAPSHOT`, `emitExecutionSnapshot`).
  - 상세: 저장소 전수 grep(`spec/`+`codebase/`, 43건)에서 `Last-Event-Id` 표기는 예외 없이 이 대소문자(`L`/`E`/`I` 대문자, 나머지 소문자)로 통일돼 있고 target 의 표기도 동일하다. 근접 오탈자(`Last-EventID`, `LastEventId`, `X-Last-Event-Id` 등)는 발견되지 않았다. `seq`/`execution.snapshot` 의미도 target 문장("두 전송은 같은 `seq` 공간만 공유하고 버퍼는 공유하지 않는다")이 §4.7 「5분 버퍼는 SSE 어댑터 소유」 불릿·§R7 문언과 표현까지 거의 동형이다 — 새 의미를 만들지 않고 SoT 서술을 요약 인용한 정도다.
  - 제안: 없음.

- **[INFO] 인접 구역 앵커 전수 점검 — 깨진 앵커 없음**
  - 상세: `2-api-convention.md`(70개 링크) · `6-websocket-protocol.md`(111개 링크) · `14-external-interaction-api.md`(160개 링크)에서 나가는 모든 상대경로 `.md` 링크(자기참조 앵커 포함)를 실제 헤딩-슬러그와 대조했고, 또한 `spec/`+`plan/` 전체에서 이 세 파일을 향한 인바운드 `#anchor` 링크도 대조했다. 두 방향 모두 **깨진 앵커 0건** — target 변경과 무관하게 이 구역에 선재하는 broken anchor 는 없었다.
  - 제안: 없음 (보고 요청 항목이었으나 발견사항 없음).

## 요약

target 은 새 ID·엔티티·endpoint·이벤트·ENV·spec 파일을 하나도 만들지 않고, `2-api-convention.md §10.4` 본문을 `6-websocket-protocol.md` 의 기존 절(§6.1/§6.2/§4.7)로 위임하는 정정이다. 새로 도입하는 유일한 신규 표면은 앵커 링크 3개이며, docs guard 와 동일한 remark+github-slugger 파이프라인으로 재현 계산한 결과 세 슬러그(`#61-클라이언트-재연결-socketio-내장`·`#62-놓친-이벤트-복구`·`#47-외부-표면-매핑-external-interaction-api`) 모두 대상 헤딩과 정확히 일치했고 중복 헤딩에 의한 `-1` 접미사 위험도 없었다. `#10.4` 헤딩 문자열이 그대로 유지되므로 인바운드 인용 orphan 위험도 없으며(애초에 그 앵커를 쓰는 인용도 0건), `Last-Event-Id`/`seq`/`execution.snapshot` 재사용 식별자도 표기·의미 모두 SoT 와 어긋나지 않는다. 인접 구역(3개 파일, 341개 링크)의 기존 앵커도 전수 대조했으나 선재 결함은 없었다. 신규 식별자 충돌 관점에서 이 target 은 위험이 없다.

## 위험도

NONE
