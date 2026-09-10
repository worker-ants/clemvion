# 정식 규약 준수 검토 — `spec-draft-ws-protocol-intro.md` (target: `spec/5-system/6-websocket-protocol.md` 에 도입할 `## Overview`)

## 발견사항

- **[CRITICAL] 도입 산문 1단락이 §6.2 에서 이미 정정·철회된 주장을 되살린다**
  - target 위치: 초안 "### 본문" 코드펜스, 1문단 마지막 문장 — "구독 단위는 execution·workflow·notifications·kb 채널이며(§3), **놓친 이벤트는 `seq` 기반으로 복구한다(§6.2)**."
  - 위반 규약: 명시적 `spec/conventions/*` 항목은 아니지만, CLAUDE.md 의 "spec/ = 제품의 단일 진실" 원칙과, 같은 문서 안에서 이미 성립한 SoT(§6.2 본문 + §Rationale) 를 Overview 가 스스로 뒤엎는 구조적 결함.
  - 상세: `spec/5-system/6-websocket-protocol.md` §6.2 는 두 갈래를 명시적으로 구분한다 — "**native WebSocket 복구 모델 — `execution.snapshot`**"(재구독 시 현재 전체 상태 1회 발행) vs "**seq 기반 정밀 재전송은 SSE 전송 표면의 메커니즘이다**"(native WS subscribe 명령이 아니라 SSE 어댑터가 `Last-Event-Id` 로 제공). 게다가 같은 문서의 `## Rationale` 에는 정확히 이 혼동을 다루는 항목이 이미 존재한다 — `### 재연결 복구 — native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송 (§6.2)`(1159행): "초기 §6.2 초안은 native WS `subscribe.lastSeq` → 5분 버퍼에서 `seq > lastSeq` 재전송... 을 약속했으나, 구현은 native WS 에 버퍼를 두지 않고 재구독 시 `execution.snapshot`... 으로 수렴했다. 본 spec 을 구현에 맞춰 정정한다." 즉 "WS 는 seq 기반으로 복구한다" 는 문장은 **이 문서가 이미 한 번 쓰고 반증하여 철회한 문장과 사실상 동일**하다. 초안의 Overview 1문단은 이를 재도입한다. 더 아이러니한 것은, 바로 다음 문단(2문단)이 "이벤트나 명령의 형태를 고칠 때 한 표면만 보고 고치면 두 표면의 의미가 갈린다" 고 독자에게 경고하는데, **그 경고를 쓰는 문단의 바로 앞 문장이 그 경고가 지목하는 종류의 오류(WS ≠ SSE 표면 혼동)를 범한다.**
  - 제안: 1문단 마지막 절을 native WS/SSE 구분을 보존하는 표현으로 교체한다. 예: "재연결 시 상태는 native WS 에서는 `execution.snapshot` 재동기화로, 외부 SSE 표면에서는 `seq` 기반 재전송으로 복구한다(§6.2)." 또는 Overview 의 "가리키기만 한다" 원칙에 맞춰 메커니즘을 아예 명시하지 않고 "재연결 시 상태는 §6.2 의 복구 전략으로 재동기화한다" 로 중립화한다. 어느 쪽이든 §6.2/§Rationale 과 상충하는 "seq 기반" 단정은 제거해야 한다.

- **[WARNING] 헤딩 선택 표를 뒷받침하는 실측 카운트가 두 군데 다 틀렸고, 반례 하나가 판별 기준을 직접 약화시킨다**
  - target 위치: "## 제목 표기를 실측으로 골랐다" 섹션의 후보 비교 표
  - 위반 규약: 직접적인 `spec/conventions/*` 위반은 아니나, `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" 표가 `## Overview (제품 정의)` 를 유일한 표기로 명시하는 것과, 초안이 스스로 세운 "내부 계약 vs 제품 표면" 판별 기준을 실측으로 재검증한 결과가 어긋난다.
  - 상세: 재검증 결과, `spec/5-system/` 에서 `## Overview (제품 정의)` 를 쓰는 파일은 8개가 아니라 **9개**(`8-embedding-pipeline.md` 누락)이고, 순수 `## Overview` 를 쓰는 파일은 2개가 아니라 **3개**(`1-auth.md` 누락)다. 실측:
    ```
    ## Overview (제품 정의) — 9개
    10-graph-rag, 12-webhook, 13-replay-rerun, 14-external-interaction-api,
    15-chat-channel, 17-agent-memory, 2-api-convention, 8-embedding-pipeline, 9-rag-search

    ## Overview (순수) — 3개
    1-auth, 3-error-handling, 4-execution-engine
    ```
    누락된 `1-auth.md` 는 초안이 세운 판별 기준("2개는 내부 계약·정책 문서, 8개는 사용자 인지 제품 표면") 을 정면으로 반증하는 반례다 — `1-auth.md` 의 Overview 는 "플랫폼의 인증·인가·감사 기반을 정의한다... 사용자 신원(로그인·2FA·세션)" 이라고 스스로 밝히고, `> 관련 문서:` 도 `_product-overview.md#2-보안`(PRD) 를 직접 인용한다. 로그인·2FA·OAuth 는 그 무엇보다 사용자가 인지하는 **제품 표면**인데도 `(제품 정의)` 접미사가 없다. 즉 "접미사 유무 = 내부 계약 vs 제품 표면" 이라는 이분법은 이 저장소의 실제 관행에서 깨끗하게 성립하지 않는다 — 두 문서군의 분열은 판별 원리라기보다 **역사적 비일관성**에 더 가까워 보인다.
    한편 `project-planner/SKILL.md`(44행) 의 "Spec 문서 구조 (3섹션 권장)" 표는 `## Overview (제품 정의)` 한 형태만 적어 두었고 "내부 계약 문서는 접미사를 뺀다" 는 예외를 문서화하지 않는다(반대로 `CLAUDE.md` 36행은 "진입 문서의 `## Overview`" 로 접미사 없이 지칭해, 두 거버넌스 문서 사이에도 표기가 갈린다). 이 지점에서 "정식 규약이 정한다" 고 단정하기는 어렵다 — 두 거버넌스 문서 자체가 서로 다른 표기를 쓰고 있고, `.claude/tests/`·hook 어디에도 `(제품 정의)` 접미사를 강제로 파싱·검사하는 게이트가 없다(확인함). 다만 "3섹션 권장" 표의 유일한 리터럴 예시가 `(제품 정의)` 쪽이라는 점은, 초안이 소수파를 택하면서 그 표를 전혀 인용·대조하지 않았다는 뜻이기도 하다.
  - 제안: 표의 8/2 카운트를 9/3 으로 정정하고, `1-auth.md` 를 판별 기준에 대한 알려진 반례로 명시(무시가 아니라 "그럼에도 왜 최종 선택이 유지되는가"를 한 문장 추가). 최종 선택(순수 `## Overview`) 자체를 바꿀 필요는 없어 보이지만 — `4-execution-engine.md` 가 "내부 계약" 자기 서술을 갖고 이미 이 문서를 §4.2 SoT 로 상호 인용하는 자매 관계라는 점은 여전히 유효한 근거이므로 — 근거 문장의 실측치는 고쳐야 다음 사람이 같은 표를 다시 세지 않는다.

- **[INFO] Overview 1문단의 채널 목록이 §3.2 의 채널 하나를 누락한다**
  - target 위치: 1문단 — "구독 단위는 execution·workflow·notifications·kb 채널이며(§3)"
  - 위반 규약: 없음(정식 규약 위반이 아니라 정확성 메모)
  - 상세: `## 3. 채널 구독 → ### 3.2 채널 패턴` 표에는 `execution:{executionId}` · `workflow:{workflowId}` · `kb:{documentId}` · `notifications:{userId}` 외에 `background:run:{id}`(Background 노드 실행) 도 등재돼 있다. Overview 가 채널 목록을 exhaustive 하게 나열할 의무는 없지만, 나열하는 순간 하나만 빠지면 "완전한 목록처럼 보이는데 실은 아니다" 는 오해를 준다.
  - 제안: "등" 을 붙이거나(예: "execution·workflow·notifications·kb 등 채널") 5개를 전부 적는다.

## 검증 완료 항목 (문제 없음)

- **116건 인용·번호 앵커 회피 논리**: 저장소 전체(`.git` 제외)에서 `6-websocket-protocol.md#` 패턴을 `grep -o` 로 전수 카운트한 결과 **정확히 116건**(초안의 수치와 일치). 이 중 번호형 앵커(`#4-`·`#41`·`#42-`·`#44-`·`#45-`·`#446-`·`#22-`·`#71-`·`#62-`·`#47-`)가 약 107건으로 대다수이고, 나머지 9건은 `#rationale`/`#Rationale`/`#r-wontdo-rawws-rest` 등 번호와 무관한 앵커다. 인용은 `spec/5-system/*`·`spec/4-nodes/*`·`spec/conventions/*`·`spec/3-workflow-editor/*`·`spec/data-flow/*`·`plan/complete/*`·`review/consistency/**` 등 15개 이상의 서로 다른 spec 파일에 폭넓게 분산돼 있어 순환 집계가 아니다. `## 1.` 형태로 번호형 도입 섹션을 넣으면 §1~§9 가 한 칸씩 밀려 이 100건 이상의 앵커 슬러그(`42-...`, `44-...` 등 번호가 슬러그에 박혀 있음)가 전부 깨진다는 초안의 결론은 실측과 일치한다. `## Overview`(번호 밖)를 택하면 이 앵커 어느 것도 건드리지 않는다는 것도 확인됨(현재 문서 어디에도 `#overview` 앵커를 미리 인용하는 곳이 없음 — 116건 목록에 `#overview` 변형 0건).
- **구조적 삽입 지점**: `4-execution-engine.md`(20/22/34/36행)와 `2-api-convention.md`(30/32/42/44행) 모두 `---` → `## Overview[...]` → 본문 → `---` → `## 1. ...` 형태를 정확히 취하고 있음을 라인 단위로 확인했다. `6-websocket-protocol.md` 현재 구조는 18행 `# Spec:` → 20행 `> 관련 문서:` → 22행 `---` → 24행 `## 1. 연결` 로, 22/24행 사이에 삽입하고 그 뒤에 `---` 를 새로 추가하면(체크리스트의 "뒤에 `---` 유지") 두 자매 문서와 동일한 뼈대가 된다. 삽입 지점 판단은 정확하다.
- **세 링크의 경로 해석**: `spec/5-system/` 기준으로 `./4-execution-engine.md` → `spec/5-system/4-execution-engine.md`(존재), `../conventions/error-codes.md` → `spec/conventions/error-codes.md`(존재), `./14-external-interaction-api.md` → `spec/5-system/14-external-interaction-api.md`(존재) 세 경로 모두 실재 파일로 해석됨을 `os.path.normpath` 로 직접 검증했다. 앵커 없는 파일 링크는 이 저장소에서 이미 광범위하게 쓰이는 패턴이다 — 같은 문서의 기존 `> 관련 문서:` 줄부터가 `[Spec 실행 엔진](./4-execution-engine.md)`(앵커 없음)를 쓰고, `3-error-handling.md`·`8-embedding-pipeline.md` 등 다른 spec 문서의 관련 문서 줄도 마찬가지다. `.claude/hooks`·`.claude/tools` 어디에도 마크다운 링크에 앵커를 강제하는 가드가 없음을 확인했다(관련 grep 0건). 따라서 앵커 없는 파일 링크 3건은 이 저장소 관행상 문제 없다.
- **번호 섹션 미변경 원칙**: 초안이 "번호 섹션을 건드리지 않는다"·"§1 전송 계층 註를 옮기거나 줄이지 않는다"고 명시한 것은 위 116건 결과와 정합한다.
- **`비채택 (won't-do)` 용어 사용**: `spec/conventions/*` 에 이 표기를 강제하는 정식 규약 항목은 없지만(egress-masking.md 의 `won't-do(현상 유지)` 가 유사 관행), 대상 문서 자체가 이미 §8 제목("WebSocket Close 코드 — _비채택 (won't-do)_")과 `## Rationale` 의 `R-wontdo-rawws-rest`/`R-wontdo-maintenance-appping` 항목에서 정확히 이 표기를 쓰고 있다. 초안 2문단이 같은 용어("비채택")를 재사용하는 것은 문서 내부 일관성에 부합하며 새 용어를 도입하지 않는다.
- **3섹션 구조 완성**: 대상 문서는 이미 본문(§1~9)과 `## Rationale` 을 갖고 있어, `## Overview` 추가는 CLAUDE.md/`project-planner/SKILL.md` 가 권장하는 3섹션 구조를 오히려 완성시키는 방향이다. 헤딩 깊이도 `## Overview`(H2)로 형제 문서·본문 번호 섹션과 동일한 깊이이며 내부에 하위 헤딩을 신설하지 않는다(형제 문서들도 Overview 안에 H3 를 두지 않음).
- **선례(983fd0ade/#1289) 대조**: `2-api-convention.md` 의 `## Overview (제품 정의)` 는 2단락이며 그 문서 자신의 `## Rationale` 에는 "Overview 를 추가했다" 는 별도 항목이 없다 — 즉 이번 초안의 체크리스트가 대상 문서의 `## Rationale` 에 "Overview 신설" 항목을 별도로 추가하지 않는 것은 선례와 일치하는 관행이며 누락이 아니다.

## 요약

핵심 절차적 판단 3가지 — 번호 섹션 대신 `## Overview` 를 쓰는 이유(116건 앵커), 삽입 위치, 세 링크의 실재성/무앵커 허용 여부 — 는 모두 실측으로 재확인했고 초안의 결론과 정확히 일치한다. 다만 두 가지 결함이 있다. 첫째, `(제품 정의)` 접미사 유무를 가르는 "내부 계약 vs 제품 표면" 판별 기준은 그 근거로 든 카운트(8/2)가 실제로는 9/3 이며, 누락된 `1-auth.md` 가 그 판별 기준 자체를 흔드는 반례라 — 결론(순수 `## Overview` 채택)은 다른 근거(자매 문서 `4-execution-engine.md` 와의 §4.2 상호 인용 관계)로 여전히 버틸 수 있지만, 표에 적힌 실측치는 정정이 필요하다. 둘째이자 더 중요한 결함은, 제안된 산문 1문단이 대상 문서 §6.2 본문과 그 문서 자신의 `## Rationale`(1159행, "native WS 는 snapshot, seq 버퍼-replay 는 SSE 전송") 이 이미 명시적으로 정정·철회한 주장("WS 는 seq 기반으로 복구한다")을 되살린다는 점이다 — 이는 바로 다음 문단이 경계하라고 말하는 "한 표면만 보고 고치면 두 표면 의미가 갈린다" 오류를 Overview 스스로 저지르는 것이라 반영 전 반드시 수정돼야 한다.

## 위험도

MEDIUM — CRITICAL 항목 1건은 이 초안이 `spec/` 에 그대로 반영되면 대상 문서의 첫 진입 단락이 이미 정정된 오류를 재도입하는 실질적 결함이지만, 반영 전 산문 텍스트만 교체하면 해소되는 국소적 문제이고 코드/앵커/구조 판단은 모두 견고하다.
