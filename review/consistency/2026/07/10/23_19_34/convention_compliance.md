# 정식 규약 준수 검토 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드 (impl-prep)

검토 대상: `plan/in-progress/eia-command-waiting-surface-guard.md` 에 기술된 착수 예정 구현
(publisher chokepoint `resolveWaitingNodeExecutionId` 확장 + `hooks.service.ts` graceful catch).
target spec 은 `spec/5-system/14-external-interaction-api.md`(status: partial). 대조한 정식 규약:
`spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`,
`spec/conventions/interaction-type-registry.md`, 및 규약 SoT 로 참조되는
`spec/5-system/3-error-handling.md` §1.3/§1.5/§1.6, `spec/5-system/2-api-convention.md` §5.3,
`spec/5-system/4-execution-engine.md` §7.5.1/§7.5.2.

> 참고: `prompt_file` 의 "정식 규약 모음" 절에는 `audit-actions.md`·`cafe24-api-catalog/*` 만
> 포함되어 있고 (아마 payload 생성 스크립트가 앞부분 4개 conventions 파일만 슬라이스한 것으로
> 보임) 이번 작업에 실제로 관련된 `error-codes.md`/`spec-impl-evidence.md`/
> `interaction-type-registry.md` 는 빠져 있었다. 직접 `Read` 로 해당 파일들과 target spec·plan·
> 코드를 조회해 검토했다.

## 발견사항

- **[WARNING] 신규 거부 조건이 error-handling 카탈로그·EIA 에러 표에 아직 명시 열거되지 않음**
  - target 위치: `spec/5-system/14-external-interaction-api.md` §5.1 에러 표 `409 STATE_MISMATCH` 행,
    `spec/5-system/3-error-handling.md` §1.3(`INVALID_STATE`)·§1.5(`INVALID_EXECUTION_STATE`)·
    §1.6(`STATE_MISMATCH`), `spec/5-system/4-execution-engine.md` §7.5.1 케이스 표
  - 위반 규약: 엄밀히는 "정식 규약(`spec/conventions/**`)" 자체 위반은 아니지만, `conventions/error-codes.md`
    §2("의미가 분기되거나 새 조건이 생기면 새 코드를 신설한다")의 판단 근거가 되는 카탈로그
    (`3-error-handling.md §1`, error-codes.md 가 SoT 로 지정)의 완결성 문제
  - 상세: 계획 문서(`plan/in-progress/eia-command-waiting-surface-guard.md`)는 이 신규 거부를
    "이미 약속된 계약의 구현"으로 규정하며 근거로 EIA-IN-13("현재 노드 상태와 명령이 맞지 않으면
    409 Conflict")과 §5.1 body 표의 "적용 노드" 컬럼(Form→submit_form, Carousel/Table/Chart/
    Template(button)→click_button 등)을 든다. 그러나 실제로 §5.1 에러 표의 `STATE_MISMATCH` 행
    예시는 `"completed 상태에서 submit_message, 또는 다른 nodeId"` 뿐이고, §1.3/§1.5/§1.6 의
    설명도 execution/노드 상태(=`waiting_for_input` 여부, execution status) 불일치만 언급한다.
    "대기 노드의 `interactionType` 이 기대하는 명령과 다른 명령이 도착"이라는 **세 번째 트리거
    조건**은 `4-execution-engine.md §7.5.1` 표(0건/다중row 2케이스만 등재)에도, 다른 어떤 카탈로그
    에도 명시적으로 열거되어 있지 않다 (검색 확인 — `interactionType` 관련 매칭 텍스트 없음).
    EIA-IN-13 의 일반적 문구가 사후적으로 이 조건을 포괄한다고 해석할 수는 있으나, "명시적으로
    이미 카탈로그화된 조건"은 아니다.
  - 제안: plan 체크리스트에 이미 있는 `spec 동기 (필요 시 project-planner 위임)` 항목을
    `--impl-done` 이전에 반드시 수행 — (a) EIA §5.1 에러 표 `STATE_MISMATCH` 조건 예시에
    "대기 노드의 interactionType 과 명령 불일치(예: buttons 대기 중 submit_form)" 추가, (b)
    `3-error-handling.md §1.3/§1.5/§1.6` 세 코드 설명에 동일 조건 한 문구 추가, (c)
    `4-execution-engine.md §7.5.1` 케이스 표에 세 번째 행(interactionType 불일치) 추가. 코드
    재사용 자체(신규 코드 미신설)는 유지해도 무방 — 아래 다음 항목 참조.

- **[WARNING] `STATE_MISMATCH`/`INVALID_EXECUTION_STATE` 재사용 결정의 규약상 근거가 문서화돼 있지 않음**
  - target 위치: plan `eia-command-waiting-surface-guard.md` §결정 ("신규 에러 코드 없음")
  - 위반 규약: `spec/conventions/error-codes.md` §2 ("이름 정확성 향상만을 위한 rename 은 하지
    않는다. 의미가 분기되거나 새 조건이 생기면 새 코드를 신설한다.")
  - 상세: 문언만 보면 "새 조건이 생기면 새 코드를 신설한다"고 읽힐 여지가 있어, 이번처럼 기존
    코드 밑에 새 트리거를 추가하는 결정이 §2 위반처럼 보일 수 있다. 다만 실제로는: (a)
    `STATE_MISMATCH` 는 이미 "completed 상태에서 submit_message"·"다른 nodeId" 두 개의 이질적
    트리거를 한 코드 아래 묶어온 선례가 있고 (§1.6 표), (b) `error-codes.md` §1 의 명명 원칙
    ("이름은 조건의 의미를 기술")에서 "state mismatch"(노드/실행 상태와 명령의 불일치)라는
    이름의 의미역은 "대기 노드가 기대하는 표면과 다른 명령이 옴"도 자연스럽게 포괄한다 — 즉
    "의미가 분기"된 것이 아니라 **같은 의미 범주 내의 새 sub-trigger**로 보는 편이 §1 원칙과
    더 정합적이다. 따라서 재사용 결정 자체는 방어 가능하나, 이 판단 근거가 어디에도 명문화돼
    있지 않다 (plan 문서는 "결정"만 적혀 있고 "왜 §2 의 새 코드 신설 요건에 해당하지 않는가"의
    논증은 없음).
  - 제안: 위 항목의 spec 동기화 시, `14-external-interaction-api.md`(또는 `error-codes.md` §3
    historical/near-registry 성격은 아니므로 EIA 쪽이 적합) 에 짧은 Rationale 한 단락으로 "왜
    새 코드를 신설하지 않고 기존 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE`/`INVALID_STATE` 를
    재사용하는가"(= 이미 다중 트리거를 묶어온 선례 + 의미역이 그대로 포괄)를 남길 것. 이렇게
    해두면 향후 유사 판단에서 §2 문언의 재해석 리스크(예: 다음 리뷰어가 "새 조건이니 새 코드가
    필요하다"고 오판)를 차단한다.

- **[INFO] `interaction-type-registry.md` §1.2 매트릭스에 신규 인바운드 소비처가 등재돼 있지 않음**
  - target 위치: `spec/conventions/interaction-type-registry.md` §1.2 값→처리 분기 매트릭스
  - 위반 규약: 강제 위반은 아님 — 해당 컨벤션은 "enum **값** 추가 시" N-위치 동시 갱신을 강제하는
    것이지, 기존 값에 대한 새 소비처 추가를 강제 등재 대상으로 하지 않는다 (`REGISTRY_SITES`
    AST 가드도 grep 대상 3개 파일 한정이라 이번 백엔드 chokepoint 는 대상 밖)
  - 상세: 그럼에도 이번에 추가되는 "대기 노드 `interactionType`(form/buttons/ai_conversation/
    ai_form_render) → 허용 명령 매트릭스" 판정 로직은 정확히 이 컨벤션이 카탈로그화하려는 패턴
    ("하나의 enum 값 소비처가 늘어나는데 매트릭스에 반영 안 됨")과 형태가 같다. `ai_form_render`
    를 `ai_conversation` 과 동일 그룹으로 묶는 결정도 기존 §1.2 의 "resume turn 라우팅은
    ai_form_render 가 ai_conversation 경로를 공유" 선례와 일치해 설계 자체는 건전하다.
  - 제안: 필수는 아니나, §1.2 매트릭스에 "Backend 인바운드 command 검증 (publisher chokepoint,
    §7.5.1)" 행/열을 추가해두면 향후 5번째 interactionType 값이 추가될 때 이 가드도 자연히
    검토 대상에 걸린다 (현재는 누락돼도 컴파일러/AST 가드가 잡아주지 못함 — 사람이 인지해야
    하는 유일한 지점이 될 수 있음).

- **[INFO] `InvalidExecutionStateError` 고정 메시지의 조건별 정확성**
  - target 위치: `codebase/backend/src/modules/execution-engine/workflow-errors.ts:113-125`
    (`InvalidExecutionStateError`), `spec/5-system/4-execution-engine.md` §7.5.2
  - 위반 규약: 없음 — §7.5.2 계약(고정 client-safe `message` + `serverDetail` 분리)은 이미
    올바르게 구현돼 있다. `constructor(detail?: string)` 이 `message` 를 항상 고정 문자열
    `'Execution is not waiting for input.'` 로, 전달된 진단 문자열은 `serverDetail` 로만
    보존한다 — 신규 조건도 이 클래스를 그대로 재사용하면 client 노출 정보는 자동으로 안전하다
    (내부 executionId·row 수 등은 서버 로그 전용, §7.5.2/§CWE-209 원칙 준수).
  - 상세: 다만 신규 조건("대기 중이나 명령 종류가 다름")에는 고정 문구 `"Execution is not
    waiting for input."` 이 문자 그대로는 다소 부정확하다 — execution 은 실제로
    waiting_for_input 상태이고, 명령 종류만 안 맞는 것이기 때문. 정보 노출 문제는 아니고 순수
    사용자 경험/정확성 이슈.
  - 제안: 반드시 고칠 필요는 없음(공용 클래스라 변경 범위가 넓어짐) — 다만 spec 동기화 시 §5.1
    표에 "메시지 문구는 기존 `STATE_MISMATCH` 공통 문구를 그대로 씀(신규 문구 미도입)"이라고
    명시해두면 프론트/외부 클라이언트가 `message` 로 조건을 세분 판정하려는 오용을 예방할 수
    있다 (클라이언트는 `code` 로만 분기해야 한다는 `error-codes.md` §1 계약과도 정합).

- **[정보/규약 준수 확인 — 발견사항 아님] §5.3 에러 응답 shape**
  - `hooks.service.ts` graceful catch 대상인 `interaction.service.ts` 의 기존
    `dispatchContinuation`(`ConflictException({ error: { code: 'STATE_MISMATCH', message:
    err.message } } })`)은 이미 `2-api-convention.md §5.3` (`{error:{code,message,details?}}`)
    shape 를 정확히 따른다. 신규 조건도 같은 throw 경로(`InvalidExecutionStateError` →
    `dispatchContinuation`)를 타므로 별도 조치 불요.

- **[정보/규약 준수 확인 — 발견사항 아님] `spec-impl-evidence.md` frontmatter 의무**
  - 이번 변경이 건드리는 두 파일 모두 이미 `code:` glob 에 포함돼 있다 —
    `execution-engine.service.ts` 는 `4-execution-engine.md` 의
    `codebase/backend/src/modules/execution-engine/**`, `hooks.service.ts` 는
    `14-external-interaction-api.md` 의 명시적 리스트 항목. 두 spec 모두 이미
    `status: partial` + `pending_plans:` 보유 상태라 이번 변경만으로 `implemented` 승격
    의무나 신규 `pending_plans` 등재 의무가 발생하지 않는다 (§3 라이프사이클 기준 미충족 —
    두 spec 의 다른 pending plan 들이 남아 있음). frontmatter 갱신 불요.

## 요약

착수 예정 구현은 기존 `resolveWaitingNodeExecutionId` 단일 publisher chokepoint를 확장해
"대기 노드 interactionType ↔ 도착 명령" 불일치를 새 트리거로 추가하고, 기존
`InvalidExecutionStateError` → `STATE_MISMATCH`/`INVALID_EXECUTION_STATE`/`INVALID_STATE`
매핑을 그대로 재사용하는 설계다. 클라이언트 노출 메시지 안전성(§7.5.2 client-safe +
serverDetail)과 에러 응답 envelope(§5.3)은 기존 코드 경로를 그대로 타므로 이미 규약을
준수하고, 코드 재사용 결정도 `STATE_MISMATCH` 의 기존 다중-트리거 선례·명명 의미역과
정합해 방어 가능하다. 다만 이 신규 거부 조건이 `error-handling.md §1.3/§1.5/§1.6` 카탈로그와
`EIA §5.1`/`4-execution-engine.md §7.5.1` 표에 아직 명시 열거돼 있지 않다는 문서 완결성
갭이 있고, "새 코드를 신설하지 않는다"는 결정의 규약상 근거(§2 문언과의 정합)도 문서화돼
있지 않다 — 둘 다 plan 체크리스트의 `spec 동기 (필요 시 project-planner 위임)` 단계에서
반드시 닫아야 한다(구현 자체를 막는 CRITICAL은 아님). 부수적으로
`interaction-type-registry.md` 매트릭스 등재는 강제 대상은 아니지만 완결성 차원에서 권장된다.

## 위험도

LOW — CRITICAL 발견 없음(구현 착수를 차단할 사유 없음). WARNING 2건은 `--impl-done` 이전
spec 동기화 단계에서 해소가 필요하다.
