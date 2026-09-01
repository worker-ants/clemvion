# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-error-code-two-surfaces.md`

## 사전 확인

prompt 번들의 "관련 spec 본문"은 컨텍스트 예산 초과로 이 draft 와 가장 밀접한 두 파일
(`spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`)이 모두 절단(`⚠️ 본문
생략됨`)돼 있었다(`spec/conventions/**` 도 번들에 없음 — `feedback_consistency_spec_mode_budget.md`
와 동일 패턴). 이번 검토는 번들 대신 로컬 파일시스템에서 `spec/conventions/error-codes.md`,
`spec/1-data-model.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`,
`codebase/backend/src/nodes/core/error-codes.ts`(+`.spec.ts`), 그리고 이 draft 의 착수 근거·선행
리뷰 3라운드(`21_30_10`/`21_36_28`/`21_39_47`)를 직접 읽어 대조했다.

이 draft 는 이미 cross_spec 2회(`21_30_10`, `21_39_47`)·convention_compliance 1회(`21_36_28`)의
검토를 거쳐 3판째다. 선행 라운드가 낸 WARNING(목적지-필드 매핑 오류, §Overview 의 카탈로그·분류
위임 재선언, central-enum-vs-자매-const 우선순위 미결)은 이번 판에서 "목적지 필드 서술을
아예 빼고 층(layer)으로만 병기 + 카탈로그 SoT 로 위임" + "범위 한정" 절 추가로 대응했다. 사실
인용(코드 위치·overlap 테스트·JSDoc 인용·2026-06-14 결정문 line 1143/1800·`exec-intake-followups.md`
ARCH#5 ⑤ 인용)은 실측과 정확히 일치한다 — 날조·오귀속 없음.

## 발견사항

- **[WARNING]** "목적지 필드는 카탈로그 SoT 에 맡긴다"는 위임 문장이 가리키는 SoT
  (`5-system/3-error-handling.md §1`)가 실제로 그 정보를 갖고 있지 않다 — 진짜 SoT 는
  `spec_impact` 에서 이번에 철회한 `spec/1-data-model.md` 다
  - target 위치: `## 변경 제안` 4번째 불릿 — "어느 코드가 어느 필드(`output.error.code` ·
    `Execution.error` · `NodeExecution.error`)에 실리는지는 **카탈로그 SoT**(`5-system/3-error-handling.md
    §1`)에 맡긴다 — §Overview 는 그 위임을 이미 선언해 두었다"
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1(§1.1~§1.4, "에러 분류") 및 §Overview 자체 서술
    ("에러 코드 분류 체계·응답 봉투·노드 레벨 정책·자동 재시도·클라이언트 처리·로깅·헬스체크") ·
    반대편 `spec/1-data-model.md:474`("에러 정보. 최초 failed NodeExecution의 에러를 참조/복사")와
    `:557-565`("Execution.error ↔ NodeExecution.error 관계" 표, "복사" 행)
  - 상세: 직접 대조한 결과 `3-error-handling.md`(§Overview·§1.1~§1.4)는 코드 이름·설명·HTTP
    상태·트리거 조건의 **카탈로그**만 다루며, 어떤 코드가 `Execution.error` 에 실리는지 vs
    `NodeExecution.error` 에 실리는지 **필드 단위 목적지**는 전혀 서술하지 않는다(전체 파일에서
    `Execution.error` 문자열 검색 결과 0건, `NodeExecution.error` 도 §3.2 각주 성격의 2건뿐 —
    필드 목적지 표는 없음). 그 정보의 실제 SoT 는 `spec/1-data-model.md`§Execution 컬럼 표
    (`:474`)와 "Execution.error ↔ NodeExecution.error 관계" 절(`:557-565`, "복사" 관계·마스킹 적용
    범위)이다. 즉 draft 가 "§Overview 는 그 위임을 이미 선언해 두었다"고 주장하는 근거 문장
    (기존 §Overview 의 "카탈로그·분류·트리거: `3-error-handling.md §1` (SoT)")은 **필드 목적지가
    아니라 코드 카탈로그·분류를 위임한 문장**이고, 필드 목적지를 실제로 위임할 수 있는 유일한
    문서(`1-data-model.md`)는 이 draft 가 `spec_impact` 에서 명시적으로 **철회**했다("목적지 필드
    서술을 §Overview 에서 빼면서 그 문서와 맞물리는 지점이 없어졌다"). 그런데 새 문장은 여전히
    "필드에 실리는지"를 언급하며 위임 대상을 지목하므로, 철회 근거("맞물리는 지점이 없어졌다")와
    실제로는 여전히 존재하는 겹침(필드 목적지 위임처가 어디인지) 사이에 모순이 남는다. 2차
    `convention_compliance`(`21_36_28`)가 제시한 대안 (b)는 정확히 "카탈로그 SoT(`3-error-handling.md
    §1`, **`1-data-model.md` "Execution.error ↔ NodeExecution.error 관계"**)로 링크를 단다"였는데,
    이번 판은 그중 `1-data-model.md` 쪽 링크를 누락한 채 `3-error-handling.md §1` 하나만 남겼다.
  - 제안: 위임 문장에서 `Execution.error`/`NodeExecution.error` 목적지 부분은 `spec/1-data-model.md`
    (§Execution 컬럼 `error` 행 + "Execution.error ↔ NodeExecution.error 관계" 절)를 함께 걸거나,
    그게 부담스러우면 "어느 필드에 실리는지"라는 표현 자체를 빼고 "`output.error.code` 로의 소속
    여부는 카탈로그 SoT" 정도로 좁혀 목적지-필드 클레임을 아예 하지 않는 편이 안전하다. 후자를
    택하면 `1-data-model.md` spec_impact 철회 근거("맞물리는 지점이 없어졌다")도 온전히 성립한다.

- **[INFO]** 3차 `--spec`(`21_39_47`) cross_spec 이 지적한 두 선재 drift(`1-data-model.md:474` 의
  엔진 인프라 코드 무차별 나열, `3-error-handling.md §1.4` 의 "엔진 수준 에러" 10종 단일 나열)는
  이번 판에서도 실측상 그대로 남아 있음을 재확인 — 다만 draft 가 "다른 문서의 선재 drift 는
  여기서 안 고친다"고 명시적으로 선언하고, 착수 근거 plan(`spec-conventions-engine-error-code-surface.md`
  "## 할 일" 마지막 미체크 항목)에 별도 planner 턴 후속으로 등재해 뒀다 — 추가 조치 불요, 확인용
  기록만 남긴다.
  - target 위치: `## Rationale` "다른 문서의 선재 drift는 여기서 안 고친다" 문단
  - 충돌 대상: `spec/1-data-model.md:474`, `spec/5-system/3-error-handling.md:106-125`(§1.4)
  - 상세: 두 파일 모두 실측 재확인 결과 이전 라운드가 기술한 상태 그대로다(§1.4 는 여전히
    `EXECUTION_TIMEOUT`·`RECURSION_DEPTH_EXCEEDED` 등 10종을 named-const 소속 구분 없이 단일 표로
    나열). 이 draft 의 층-기반 병기가 §1.4 근처에 새로운 모순 주장을 추가하지는 않는다.
  - 제안: 없음(추적 확인).

- **[INFO]** `4-execution-engine.md` §Rationale(line 1143·1796-1800)의 "신규 client-safe 코드는
  중앙 `ErrorCode` 확장" 결정문은 이번 판에서도 `EngineErrorCode`/`error-codes.md` 두-surface
  서술을 전혀 인지하지 못한 채 단방향으로 남는다 — draft 의 "범위 한정" 절이 이 병기가 그 결정과
  "경쟁하지 않는다"고 명시적으로 스코핑해 뒀고, 이는 1차 `--spec`(`21_30_10`) cross_spec WARNING
  #2 가 제시한 두 대안 중 (a)를 택한 것으로 볼 수 있다 — CRITICAL/WARNING 재상정 불요, 다만 두
  문서가 서로를 가리키지 않는(one-directional) 상태 자체는 남아 있다는 점만 기록.
  - target 위치: `### 범위 한정 — 일반 원칙 선언이 아니다`
  - 충돌 대상: `spec/5-system/4-execution-engine.md:1143`, `:1796-1800`
  - 상세: line 1800 의 결정은 문맥상(`### Continuation ack client-safe typed error`, §7.5.2) WS ack
    경계 코드에 한정된 2026-06-14 사용자 결정이다. draft 의 스코핑 문장("지금 존재하는
    `EngineErrorCode` 4종을 사후에 문서화할 뿐, 향후 신규 엔진 코드가 어느 쪽으로 가야 하는지는
    말하지 않는다")은 이 결정문과 직접 충돌하지 않으면서도 그 결정문 쪽에서 새 병기를 참조하는
    상호 링크는 추가하지 않는다 — draft 자신이 "판단 기준은 이번에 안 쓴다"로 이 비대칭을 의도적
    유보로 남긴다고 Rationale 에 이미 명시했으므로 새로 등재할 결함은 아니다.
  - 제안: 없음(추적 확인 — 재개 신호는 착수 plan 이 SoT).

## 그 외 확인한 관점 (충돌 없음)

- **API 계약**: endpoint·request/response shape 변경 없음 — 해당 없음.
- **요구사항 ID**: 신규 ID 부여 없음 — 해당 없음.
- **상태 전이**: Execution/NodeExecution 상태 머신 서술 변경 없음(§Overview 한 문단 편집).
- **RBAC**: 권한 구조 변경 없음.
- **명명 충돌**: `spec/` 전체에서 `EngineErrorCode` 를 이미 참조하는 다른 문서 없음(신규 검색 결과
  0건, `21_39_47` 확인과 동일) — 병기가 새로 발생시키는 명명 충돌 없음.
- **레지스트리 정합**: `error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 행의 "엔진 레벨 `error.code`"
  표기가 `EngineErrorCode.WORKER_HEARTBEAT_TIMEOUT` JSDoc(같은 SoT 상호 참조)과 일치 — draft 가
  각주로 거는 근거로 유효.

## 요약

3판째인 이 draft 는 앞선 세 라운드가 지적한 "목적지-필드 오분류"·"SoT 재선언"·"central-enum 우선순위
미결" 을 모두 실질적으로 해소했고, 인용 사실(코드 라인·테스트·결정문)은 전부 실측과 일치한다. 다만
이번 라운드에서 새로 발견한 지점은, 목적지-필드 서술을 빼면서 대신 넣은 위임 문장("카탈로그
SoT(`3-error-handling.md §1`)에 맡긴다")이 가리키는 문서가 실제로는 그 정보(어느 코드가
`Execution.error` vs `NodeExecution.error` 중 어디에 실리는지)를 갖고 있지 않다는 점이다 — 그
정보의 실제 SoT 는 `spec/1-data-model.md` 인데, 이 draft 는 그 문서를 `spec_impact` 에서 명시적으로
철회했다. 시스템 동작이 깨지는 CRITICAL 은 아니지만, 새 위임 포인터가 착지하지 않는 채로 규약
문서에 들어가면 다음 독자가 잘못된 SoT 를 따라가게 된다. 그 외 두 건(선재 drift 미해결,
execution-engine.md 와의 단방향 스코핑)은 이미 추적된 상태이며 이번 판이 새로 만든 문제가 아니다.

## 위험도

MEDIUM
