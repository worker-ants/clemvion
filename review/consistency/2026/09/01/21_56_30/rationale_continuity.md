# Rationale 연속성 검토 — `spec-draft-error-code-two-surfaces.md`

## 검토 범위

target: `plan/in-progress/spec-draft-error-code-two-surfaces.md` (spec draft, `--spec` 모드).
대조: `spec/conventions/error-codes.md`(수정 대상 본체, 직접 열람) · `spec/5-system/4-execution-engine.md`
§Rationale(2026-06-14 결정) · `plan/complete/exec-intake-followups.md` ARCH#5(자매 const 신설
경위) · `spec/1-data-model.md`/`spec/5-system/3-error-handling.md` §1.4(인접 drift 실측) ·
`spec/5-system/6-websocket-protocol.md` §7.1(`WsErrorCode` 실측) · 착수 근거 plan
`plan/in-progress/spec-conventions-engine-error-code-surface.md`.

번들이 컨텍스트 예산 초과로 `6-websocket-protocol.md`·`2-api-convention.md` 등 다수 파일의
Rationale 본문을 절단했으므로(`⚠️ 본문 생략됨`), 이번 검토는 해당 파일들을 저장소에서 직접
열어 대조했다.

## 발견사항

- **[INFO]** 세 차례 기각한 대안이 "**기각한 대안**" 라벨 형식으로 명문화돼 있지 않다
  - target 위치: `## Rationale` → "### 왜 자매 const 인가" 및 그 위 "### 세 번 고쳤다" 절
  - 과거 결정 출처: `spec/1-data-model.md` §Rationale "`**기각한 대안 — 9-observability.md
    존치**:`" · `spec/5-system/3-error-handling.md` §Rationale "`**기각한 대안 — 구현을 423
    으로 바꾸기**:`" 등 — 저장소 spec Rationale 전반에서 반복되는 하우스 스타일(6건 이상
    확인: `4-execution-engine.md` "기각 대안"·"기각된 대안 — 재개 식별 필드 hydration 전용
    헬퍼" 포함)
  - 상세: target 은 초판("노출 경계가 다르기 때문" 목적지 필드 매핑)·2판(같은 매핑 유지)·
    3판(층 기반 이분법)이 실측으로 반증돼 기각된 경위를 프로즈("초판은…", "2판은…", "3판은…")
    로 정확하게 서술하고 있고 내용은 진짜다(각주로 실측 근거까지 인용) — 지어낸 이력이
    아니다. 다만 저장소 관례인 굵은 "**기각한 대안 — X**:" 라벨을 쓰지 않아, 향후 rationale
    grep/자동 스캔이나 빠른 훑어보기로는 "여기 기각된 대안이 있다"는 사실이 즉시 드러나지
    않는다.
  - 제안: 최종 `## Rationale` 에 "**기각한 대안 — §Overview 에 목적지 필드 매핑 명시**:
    `EXECUTION_TIME_LIMIT_EXCEEDED`(`ErrorCode` 소속)를 엔진이 `Execution.error.code` 로
    싣는 실측이 반증(1차 `cross_spec`)." 및 "**기각한 대안 — 층(layer) 기반 이분법**:
    같은 실측이 '엔진이 발행하는 `ErrorCode`' 존재를 보여 층 분류도 반증(4차)." 두 bullet 을
    프로즈 절 앞에 덧붙이면 하우스 스타일과 정합하고 발견 가능성이 높아진다. 내용을 새로
    쓸 필요는 없다 — 이미 있는 서술을 라벨만 앞세우면 된다.

- **[INFO]** `WsErrorCode` "세 번째 자매 const" 판정 보류의 전체 맥락이 draft 본문에는
  1줄로 압축돼 있다
  - target 위치: `## Rationale` → "### 판단 기준은 이번에 안 쓴다" 절 말미 "(`WsErrorCode`
    가 그 세 번째인지는 재개 시점에 함께 판정한다.)"
  - 과거 결정 출처: 착수 근거 plan `spec-conventions-engine-error-code-surface.md` §"판단
    기준" 체크리스트 하단 인용문 — "그 신호는 이미 모호하다(`--spec` `21_49_21`
    plan_coherence W3). `WsErrorCode` 가 `EngineErrorCode` 보다 먼저(2026-07-07,
    `daaae64c2`, #843) 별도 const 로 신설돼 있다. … '세 번째' 를 *같은 파일 안의* 자매로
    세는지 저장소 전체 별도 const 로 세는지에 따라 이미 충족일 수도 있다"
  - 상세: 실측 확인 결과 `WsErrorCode` 는 `codebase/backend/src/modules/websocket/
    ws-error-codes.ts` 라는 **다른 모듈**에 있고, `spec/5-system/6-websocket-protocol.md`
    §7.1 이 이를 "WS transport/auth/rate-limit 코드" 로 이미 명시적 별개 계층 서술해 뒀다
    (`ErrorCode`/`EngineErrorCode` 와 나란히, 충돌 없이). ARCH#5 ⑤ 의 "형태의 의식적 이탈"
    논쟁은 **같은 파일**(`error-codes.ts`) 안에서 SoT 를 쪼갤지의 문제였으므로, 엄밀히는
    `WsErrorCode` 는 그 논쟁의 대상이 아니었을 가능성이 크다 — 그런데 target 은 이 구분을
    적지 않고 "재개 시점에 함께 판정" 이라고만 미룬다. 판단을 지금 내리지 않는 것 자체는
    (착수 근거 plan 의 §"판단 기준은 이번에 안 쓴다" 결정과) 일관되므로 문제는 아니다.
  - 제안: 이대로 두어도 SoT(착수 근거 plan)가 전체 맥락을 보유하고 있어 정보 유실은 없다.
    다만 이 draft 가 `complete/` 로 옮겨진 뒤 이 한 줄만 남으면 "왜 모호한지" 가 사라지므로,
    괄호 안에 "— 같은 파일 기준인지 저장소 전체 기준인지부터 정할 것" 한 구절만 보태 두면
    재개 시점에 착수 근거 plan 을 다시 열지 않아도 판정 축이 바로 보인다.

## 정합성 확인 (문제 없음, 참고용)

- **2026-06-14 결정과의 관계**: `4-execution-engine.md` §Rationale "Continuation ack
  client-safe typed error" 항의 실제 문구("신규 `EXEC_*` prefix 를 만들지 않고 중앙
  `ErrorCode` enum 의 기존 `EXECUTION_*` 확장. `EXEC_*` 는 기존 `EXECUTION_*` 과 이중
  표기라 기각")를 직접 대조한 결과 target 의 인용이 정확하고, target 은 이 결정을
  "값 레벨 prefix 기각" 으로 정확히 좁혀 재해석해 자신의 병기(존재 서술)와 경쟁하지 않는다고
  명시한다 — 결정 재도입도 무근거 번복도 아니다.
- **ARCH#5 ⑤ 유보와의 정합**: `exec-intake-followups.md` ARCH#5 ⑤ 의 인용("이 논리는
  `RETRY_*` 에도 똑같이 적용될 수 있었고 그때는 채택되지 않았다… 해석의 여지가 있다는
  사실 자체를 여기 남긴다")을 원문과 대조 — 정확히 일치. target 은 이 유보를 규약 문서의
  확정 원칙으로 승격시키지 않고 "존재·자매 관계·키 disjoint" 만 적어 유보를 존중한다.
- **실측 근거 검증**: `ErrorCode`/`EngineErrorCode` 가 `error-codes.ts` 같은 파일(각각
  line 73 부근·147행)에 있다는 것, `error-codes.spec.ts` 의 `overlap` 단언, `SERVER_
  INTERRUPTED`(양쪽 봉투)·`EXECUTION_QUEUE_WAIT_TIMEOUT`(NodeExecution 미생성) JSDoc,
  `EXECUTION_TIME_LIMIT_EXCEEDED` 가 `ErrorCode` 소속이면서 엔진이 `Execution.error.code`
  로 싣는다는 것(`execution-engine.service.ts` PR2a 주석), `1-data-model.md:474` 의 6종
  무구분 나열, `3-error-handling.md` §1.4 "엔진 수준 에러" 10행 중 named const 등재
  2종(EXECUTION_TIME_LIMIT_EXCEEDED·WORKER_HEARTBEAT_TIMEOUT)뿐이라는 카운트까지 전부
  코드/spec 원문과 대조해 정확함을 확인했다. 지어낸 실측이나 과장된 인용이 없다.
- **인접 drift 이연 처리**: `1-data-model.md`/`3-error-handling.md` 의 선재 drift 를 이
  draft 범위에서 고치지 않고 별도 planner 턴으로 미룬 것은 이 저장소의 반복 관례(cross-cutting
  이슈를 별도 트랙으로 분리)와 일치하며, 착수 근거 plan 체크리스트에도 동일 항목이 등재돼
  있어 유실 위험이 없다.
- **결정 SoT 단일화**: "판단 기준" 미채택 결정을 draft 본문에 재서술하지 않고 착수 근거
  plan 을 SoT 로 가리키는 선택은, target 자신이 §"판단 기준은 이번에 안 쓴다" 절에서 명시한
  "같은 결정을 두 문서에 나란히 적으면 한쪽만 갱신되는 자리가 생긴다" 원칙과 자기 일관적이다.

## 요약

target 은 `error-codes.md` §Overview 에 `EngineErrorCode` 를 두 번째 대표 surface 로
병기하는 spec draft로, 관련된 기존 Rationale(2026-06-14 "중앙 `ErrorCode` 확장" 결정,
ARCH#5 ⑤ 의 "자매 const 는 의식적 이탈이며 유보" 서술)을 정확히 인용하며 그 결정들과
경쟁하지 않도록 스스로 범위를 좁혔다(존재·자매 관계·키 disjoint 서술만, 목적지 필드·판단
기준은 각각 카탈로그 SoT·별도 planner 항목으로 위임). 세 번의 초안 반증 과정도 실제 실측
근거와 함께 정직하게 기록돼 있어 "기각된 대안을 지어내지 않는다"는 이 저장소의 원칙에
부합한다. 발견된 것은 CRITICAL/WARNING 급 재도입·원칙 위반이 아니라, 이미 정확한 내용을
저장소 하우스 스타일("**기각한 대안**" 라벨)로 더 발견 가능하게 만들 수 있다는 정도의
INFO 2건뿐이다.

## 위험도

LOW
