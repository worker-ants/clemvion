# Consistency Check 통합 보고서

**BLOCK: NO** (Critical 1건 — 반영 완료. 아래 처분 참조)

> 이 파일은 호출자(main)가 썼다 — `SUMMARY.md` basename 은 sub-agent Write 가 훅으로 차단된다.

**대상**: `plan/in-progress/spec-draft-api-convention-104-reconnect.md` —
`spec/5-system/2-api-convention.md` §10.4 「재연결」 교체.

## 집계

| Checker | 위험도 | Critical | Warning | INFO |
|---|---|---|---|---|
| `rationale_continuity` | MEDIUM | **1** | 1 | 2 |
| `cross_spec` | MEDIUM | 0 | 1 | 6 |
| `convention_compliance` | LOW | 0 | 1 | 3 |
| `plan_coherence` | LOW | 0 | 1 | 3 |
| `naming_collision` | NONE | 0 | 0 | 4 |
| **합계** | — | **1** | **4** | **18** |

Critical 은 **기술 변경안(E-1)이 아니라 초안의 이력 서술**을 겨냥했고, 지적 자체가
*"E-1 은 이 문제를 올바르게 해소하므로 기술적 변경안은 유지"* 라고 명시한다. 서술을 정정하고
E-2 를 신설해 반영했다.

## Critical — 세 결함의 출처를 하나로 뭉갰다 (`rationale_continuity`)

초안은 세 결함을 모두 "2026-03-26 초안 잔존물" 로 다뤘다. `git log -S` 실측이 갈랐다:

| 텍스트 | 커밋 | 날짜 | 성격 |
|---|---|---|---|
| §10.4 불릿 2개 | `05089d5a6` | 2026-03-26 | 미수정 — 순수 drift |
| WS §6.2 「native WS 버퍼 전제 폐기」 | `698bf30e2` | **2026-05-31** | *"폐기된 대안: native WS lastSeq 버퍼-replay 전면 구현"* 명문 기각 |
| §10.4 예외 blockquote + `2-api-convention.md` Rationale 항목 | `7e6a4bc3e` (#1267) | **2026-09-02** | 폐기 3개월 뒤, 그것을 인용하지 않은 **능동적 판단** |

즉 blockquote 는 잊힌 잔재가 아니라 **폐기된 설계의 조건부 재도입**이다 — *"전송 계층이 끊긴
경우에는 위 두 줄이 맞다"* 는 부분집합을 남겼다. 같은 날 커밋 메시지가 `#1265`·`#1266` 은
인용하면서 5월 폐기 항목은 한 번도 인용하지 않는다.

**처분**: 초안에 provenance 표를 넣고 교훈을 갈라 적었다 — drift 의 교훈은 "요약을 SoT 와
주기적으로 대조하라", 이쪽의 교훈은 **"예외를 만들기 전에 그 주제 Rationale 에 폐기 선언이
있는지 먼저 보라"**.

## Warning 4건 — 셋이 같은 곳으로 수렴했다

**`cross_spec` · `rationale_continuity` · `convention_compliance` 가 독립적으로** 같은 갭을
지적했다: `2-api-convention.md` **자기 자신의** Rationale 항목(2026-09-02)이 *"두 줄 다 서버가
스스로 끊은 경우에는 틀리다"* 로 시작해 **그 외에는 맞다**를 함의하는데, E-1 만 적용하면 같은
파일 안에서 본문과 Rationale 이 서로 다른 축을 말하는 상태가 남는다.

**처분 — E-2 신설.** 기존 항목을 지우지 않고 `> **(2026-09-10 갱신)**` 블록쿼트를 append 했다.
구조적 결정("복제 말고 위임")은 유효하고 틀린 것은 그 결정을 뒷받침하는 **진단 문장**이므로.
그 갱신문이 WS 프로토콜의 2026-05-31 폐기 항목을 **직접 인용**해 두 문서 Rationale 이 서로를
참조하게 만든 것이 3개월 모순의 재발을 막는 최소 장치다.

> **처방 세 갈래가 갈렸고 하나를 골랐다.** `cross_spec`=한 문장만 고쳐라 ·
> `rationale_continuity`=갱신 블록쿼트를 붙여라 · `convention_compliance`=새 서브섹션을 만들어라.
> **append 를 택했다** — 새 서브섹션은 §10.4 를 다루는 Rationale 을 두 개로 만들고, 그건 이 문서가
> §10 에서 피하려는 형태(같은 것을 두 자리에)다. 관례 실측: `> **(날짜 갱신)**` 패턴 **2건**,
> 둘 다 `6-websocket-protocol.md`. (`rationale_continuity` 는 "3건 이상" 이라 했는데 2건이다.)

**나머지 Warning 1건** (`plan_coherence`): 초안이 *"등재 항목은 두 번째 불릿만 지적했다"* 고
과대주장했다. 트래커는 이미 blockquote 축까지 지적하고 처방까지 달았고, **초안이 두 문단 뒤에서
스스로 인정하고 있었다** — 자기 문서 안에서 모순됐다. 실측 신규 발견은 **백오프 수치 한 곳**.
정정했다.

## INFO 중 실제로 반영한 것

| Checker | 지적 | 처분 |
|---|---|---|
| `cross_spec` | ① 백오프 수치가 `cfffc1355` 이전 §6.1 셀과 **리터럴 일치**(가운데만 `...` 로 줄인 동일 시퀀스) — `git log -p -S` 로 확증 | 초안에 그 증거를 인용 |
| `rationale_continuity` | 그 수치를 요약에 남기기로 한 **기록된 결정 없음** — "근사값"·"요약 문서는" 류 문구 0건 | 부재 확인을 근거로 명시 |
| `convention_compliance` | §10.1 에 붙인 근거가 헐겁다 — §1 註의 "논리적 추상화" 는 §10.2 의 프레임을 겨냥한 것이고, **§10.1 은 애초에 틀리지 않았다**(§1.1 + §1.2 가 채택한 쿼리 파라미터) | 세 소절의 근거를 **각각 분리**해 적었다 |
| `plan_coherence` | 선행 작업 `ws-token-expired-socket-lifetime-impl.md` 미인용 | 인용 추가 — **그 plan 도 5월 폐기 선언을 인용하지 않았다**는 점이 provenance 표의 요지다 |

## 검증 절차 기록 — 이번엔 번들이 깨끗했다

`cross_spec` 이 세 대상을 **전문 적재**했다(`2-api-convention.md` 29,955 · `6-websocket-protocol.md`
103,154 · `14-external-interaction-api.md` 133,936자). 예산은 1,200,000.

원인은 예산이 아니라 **순서**다. 이 브랜치는 `--spec` 준비를 **트래커 편집 전에** 했다 — 앞선
세 라운드에서 큰 트래커를 같은 브랜치에서 먼저 건드려 그 트래커가 거론하는 spec 이 전부 tier 1 로
올라오면서 대상이 밀려났었다(같은 트래커에 등재된 결함). **순서만 바꿔 회피됐다**는 것이
그 진단의 확인이다.

앵커 검증은 두 checker 가 **각각 독립적으로** `github-slugger` 를 실행해 세 슬러그가 대상 heading 과
바이트 단위 일치함을 확인했다 — `#61-클라이언트-재연결-socketio-내장` 은 저장소 최초 피인용이라
가드가 검증한 적 없던 형태였다. `naming_collision` 은 추가로 인접 3파일 **341개 링크**를 전수
대조해 선재 깨짐 0건을 확인했다.

## 적용 결과 (실측)

- **heading 47개 전부 무변경** (적용 전/후 목록 대조). `#104-재연결` 은 인바운드 인용 0건이지만
  heading 문자열도 그대로 유지했다.
- §10.4 의 앵커 링크 3건 — 적용본에서 파일 실재·슬러그 일치 재확인.
- `evaluate_review()` → `blocked=False` / *"no codebase/ changes on this branch — allowed"*.
