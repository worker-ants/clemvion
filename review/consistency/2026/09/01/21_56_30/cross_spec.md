# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 사전 확인

prompt 번들의 "관련 spec 본문"은 이번에도 컨텍스트 예산 초과로 이 draft 와 가장 밀접한
`spec/5-system/3-error-handling.md`·`spec/5-system/4-execution-engine.md` 가 절단됐고
`spec/conventions/**` 자체는 번들에 포함되지 않았다(`feedback_consistency_spec_mode_budget.md`
와 동일 패턴). 번들 대신 로컬 파일시스템에서 대상 파일들을 직접 읽어 대조했다:
`spec/conventions/error-codes.md`, `spec/1-data-model.md`(§Execution `error` 필드·§"Execution.error
↔ NodeExecution.error 관계"), `spec/5-system/3-error-handling.md`§1.4, `spec/5-system/4-execution-engine.md`
§Rationale, `codebase/backend/src/nodes/core/error-codes.ts`(+`.spec.ts`), 그리고 착수 근거·선행
5라운드 검토(`21_30_10`/`21_36_28`/`21_39_47`/`21_46_05`/`21_49_21`).

**중요**: 검토 중 target 파일이 실시간으로 계속 수정되고 있었다(6판째로 추정). 아래는 가장 마지막에
읽은 안정 상태(`## 변경 제안` 3번째 불릿이 "경계는 **비대칭**이다 — `EngineErrorCode` 는 **엔진만**
발행하고, `ErrorCode` 는 노드 핸들러가 주로 쓰되 **엔진도 쓴다**" 로 되어 있는 버전) 기준이다.

이 draft 는 이미 cross_spec 3회(`21_30_10`, `21_39_47`, `21_49_21`)·convention_compliance 1회
(`21_36_28`)의 검토를 거쳤다. 직전 라운드(`21_49_21`)가 낸 유일한 WARNING — "카탈로그
SoT(`3-error-handling.md §1`)에 맡긴다"는 위임 문장이 가리키는 문서에 실제로 그 정보(필드
목적지)가 없다 — 는 이번 판에서 **그 위임 문장 자체를 삭제**하는 방식으로 해소했다
(`## 변경 제안` 문단 "목적지 필드(...)는 아무 말도 하지 않는다"). 잘못 가리키는 포인터를 고치는
대신 통째로 없애는 접근이며, 실측 확인 결과 이 삭제로 §Overview 는 더 이상 `1-data-model.md` 쪽
정보를 위임한다고 (잘못) 주장하지 않는다 — WARNING 해소 확인.

## 발견사항

- **[INFO]** "경계는 비대칭이다" 서술이 코드 자신의 JSDoc "레이어" 프레이밍과 여전히 어긋난 채
  남는다 — draft 는 이 어긋남을 이미 3~4판에 걸쳐 스스로 반증했으나, `code:` SoT 인 소스 파일
  쪽은 고쳐지지 않았다
  - target 위치: `## 변경 제안` 3번째 불릿("경계는 **비대칭**이다 — `EngineErrorCode` 는
    **엔진만** 발행하고, `ErrorCode` 는 노드 핸들러가 주로 쓰되 **엔진도 쓴다**") 및
    `### 세 번 고쳤다` 문단(4차 `21_46_05` 가 "층 이분법" 을 반박했다는 서술)
  - 충돌 대상: `codebase/backend/src/nodes/core/error-codes.ts:114-115` — `EngineErrorCode` JSDoc
    이 스스로 이렇게 적는다: *"**엔진 레이어** 에러 코드 — **노드 핸들러가 아니라 엔진 자신이**
    `Execution.error` / `NodeExecution.error` 봉투에 싣는 값"*. `error-codes.md` §Overview 의
    `code:` frontmatter 가 정확히 이 파일을 SoT 로 지목한다
  - 상세: draft 의 §실측 이 이미 정확히 반증한 문장("`ErrorCode` = 노드 핸들러 층"은 성립하지
    않는다 — `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `ErrorCode` 소속인데 엔진이 싣는다)과 **같은
    구조의 이분법**이 소스 코드 JSDoc 헤더(`왜 별 const 인가` 절 바로 위, `EngineErrorCode` 선언
    직전)에 여전히 살아 있다. 소스 코드 주석은 spec 이 아니므로 이 checker 의 1차 대상은 아니지만,
    `error-codes.md` §Overview `code:` 필드가 독자를 정확히 이 파일로 보내고, 이 draft 가 §Overview
    에서 "층(layer)" 언어를 의도적으로 뺀 이유가 바로 이 JSDoc 과 같은 이분법이 §실측으로 반증됐기
    때문이다. 결과적으로 규약 문서는 정확해졌지만 규약이 가리키는 1차 소스(코드)는 여전히 같은
    부정확한 주장을 반복한다 — 다음에 코드를 직접 읽는 사람은 spec 이 아니라 이 JSDoc 을 먼저
    만나 다시 같은 오분류로 되돌아갈 수 있다. **cross-spec CRITICAL/WARNING 은 아니다** —
    spec-대-spec 충돌이 아니라 spec-대-code-comment 드리프트이고, 시스템 동작에는 영향이 없다.
  - 제안: 이 draft 의 필수 조치는 아니다(범위가 §Overview 한 문단으로 이미 명시적으로 한정돼
    있고, "다른 문서의 선재 drift 는 여기서 안 고친다" 원칙과 같은 논리가 적용된다). 다만 착수
    근거 plan(`spec-conventions-engine-error-code-surface.md`) "## 할 일" 의 "후속 (별도 planner
    턴)" 항목에 세 번째 줄로 — *"`error-codes.ts` `EngineErrorCode` JSDoc 의 '엔진 레이어 —
    노드 핸들러가 아니라' 프레이밍이 draft 가 반증한 것과 같은 이분법이다. `code:` SoT 인
    만큼 정정 검토"* — 를 등재해 두면, 이번 라운드가 spec 쪽에서 없앤 오분류가 코드 쪽에서
    재유입되는 것을 막을 수 있다.

## 그 외 확인한 관점 (충돌 없음)

- **데이터 모델**: `1-data-model.md` 는 이번 판에서 더 이상 편집 대상이 아니고(spec_impact
  철회), draft 도 필드 목적지 주장을 완전히 뺐다 — 최근 두 라운드가 지적한 잘못된 SoT 포인터
  문제가 재발하지 않는다. `1-data-model.md:474`·`:557-563` 실측 결과도 draft 의 남은 서술과
  모순되지 않는다.
- **API 계약**: endpoint·request/response shape 변경 없음.
- **요구사항 ID**: 신규 ID 부여 없음.
- **상태 전이**: Execution/NodeExecution 상태 머신 서술 변경 없음.
- **RBAC**: 권한 구조 변경 없음.
- **명명 충돌**: `EngineErrorCode` 를 참조하는 다른 spec 문서 없음(재확인, 0건). `WsErrorCode`
  는 `nodes/core/error-codes.ts` 와 **다른 파일**(`modules/websocket/ws-error-codes.ts`)이라
  bullet 2("같은 파일의 자매 const")·bullet 1("대표 surface 는 둘")의 범위(이 파일 `code:`
  frontmatter 한정) 밖이다 — 병기 대상에서 빠진 것이 모순이 아니다. 재개 신호 관련 모호성은
  착수 근거 plan 에 이미 별도로 기록돼 있다(중복 등재 불필요).
- **신규 3번째 불릿("경계는 비대칭") 사실 검증**: `grep` 결과 `EngineErrorCode.*` 참조는
  `execution-engine.service.ts`·`shutdown-state.service.ts`(+ anchor guard) 뿐 — "엔진만
  발행" 확인. `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 는 `workflow-errors.ts`(엔진 모듈)의
  `readonly code` 로 바인딩 — "엔진도 쓴다" 예시 확인. `execution-engine.service.ts` 자체에는
  `ErrorCode.` 직접 참조가 없어(간접적으로 `workflow-errors.ts` 경유) 문면과 실측이 정합.
  카탈로그 §1.4 10종 중 named const 등재 2종(`EXECUTION_TIME_LIMIT_EXCEEDED`·
  `WORKER_HEARTBEAT_TIMEOUT`)이라는 재확인도 유효 — "1:1 대응하지 않는다" 주장 성립.
- **레지스트리 정합**: `error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행 각주가 여전히 유효.

## 요약

6판째(추정)인 이 draft 는 앞선 다섯 라운드가 순차로 지적한 "목적지-필드 오분류(1·2차)" →
"층 이분법 오류(3·4차)" → "잘못 가리키는 위임 포인터(5차)"를 모두 실질적으로 해소했다 — 마지막
수정은 위임 문장을 고치는 대신 아예 삭제하는 방식을 택했고, 이는 검증 결과 안전하다(§Overview 가
더 이상 없는 답을 가리키지 않는다). 새로 추가된 "비대칭 경계" 서술(엔진만 발행 vs 엔진도 겸용)은
직접 실측(grep)으로 정확함을 확인했다. 이번 라운드에서 새로 찾은 유일한 지점은 CRITICAL/WARNING
급이 아니라, spec 이 가리키는 소스 코드(`error-codes.ts`)의 JSDoc 자체가 draft 가 반증한 것과
같은 "레이어" 이분법을 여전히 담고 있어 spec-대-code 프레이밍 드리프트가 남는다는 것이다 — 시스템
동작·다른 spec 문서와는 충돌하지 않으므로 INFO 로 기록하고 후속 planner 턴 후보로만 제안한다.

## 위험도

LOW
