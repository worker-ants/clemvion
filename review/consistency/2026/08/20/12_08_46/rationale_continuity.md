# Rationale 연속성 검토 — `spec/5-system/` (impl-prep, `eia-inputdata-marker-guard`)

## 전제

target 은 `spec/5-system/` 현재 상태(미변경 — `git diff origin/main` 에 spec 변경 없음)이고,
`plan/in-progress/eia-inputdata-marker-guard.md` 가 그 위에서 착수하려는 구현 계획이다.
계획의 핵심은 `spec/5-system/14-external-interaction-api.md` **§R17 "잔여 ②"** 가 이미
명시해 둔 **"닫는 조건"**(프런트 마커 가드 선행 → `Execution.inputData` egress 마스킹 전환)을
그대로 집행하는 것이라, 그 결정 자체는 **기각된 대안의 재도입이 아니라 R17 이 예정해 둔
절차**다. 아래 발견사항은 이 절차 집행 과정에서 **다른 spec 문서로 propagate 되지 않을 위험**과
**기존에 못박힌 하위 원칙(마커 매칭 경계·번호 표기 규약)과의 정합**에 집중했다.
프롬프트 번들이 컨텍스트 예산으로 `spec/5-system/13-replay-rerun.md` ·
`spec/5-system/6-websocket-protocol.md` 등을 절단했으므로, 관련성이 있는
`13-replay-rerun.md` 는 저장소에서 직접 `Read` 하여 확인했다.

## 발견사항

- **[WARNING] `13-replay-rerun.md §10.2` 의 "egress 마스킹 대상이 아니다" 정본 서술이 plan 의 spec 갱신 범위 밖에 있다**
  - target 위치: `spec/5-system/13-replay-rerun.md` §10.2 (Re-run 모달), "**`Execution.inputData`
    는 egress 마스킹 대상이 아니다 — 이 모달이 그 이유다 (2026-08-16)**" 콜아웃 블록
    (`... 근거·잔여·닫는 조건의 SoT 는 EIA §R17 "잔여 ②" 이며, 구현 정본은 ExecutionsService 의
    `MASKED_INPUT_DATA_REASON` 이다. 에디터의 "히스토리에서 불러오기"([실행 §2.2])도 같은 컬럼을
    같은 방식으로 재사용하므로 동일하게 적용된다.`)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` **§R17 "잔여 ②"**
    (2026-08-16/2026-08-17 정정) — 카브아웃·닫는 조건의 SoT. `13-replay-rerun.md §10.2` 는 이
    결정을 **UI 관점에서 미러**하며, 두 문서 모두 구현 정본으로 같은 상수
    `MASKED_INPUT_DATA_REASON` 을 명시적으로 지목한다.
  - 상세: plan 의 frontmatter `spec_impact` 는 `spec/5-system/14-external-interaction-api.md`
    **한 파일만** 열거하고, 체크리스트의 spec 갱신 항목도 `"spec §R17 — '닫는 조건' 충족 반영,
    inputData 를 마스킹 카탈로그로 이동"` 으로 R17 만 지목한다. 그러나 `13-replay-rerun.md §10.2`
    는 **같은 결정을 재-단언하는 두 번째 정본 위치**이고, `MASKED_INPUT_DATA_REASON` 상수를
    "폐기 또는 반전" 하면(plan 체크리스트 항목) 이 콜아웃은 즉시 사실과 어긋나는 문장이 된다
    — R17 은 마스킹됨(masked) 인데 13-replay-rerun.md 는 여전히 "마스킹 대상이 아니다" 라고
    말하는 자기모순이 생긴다. 이 프로젝트는 정확히 이 실패 형태(다른 spec 문서가 EIA 의 최신
    형태를 못 따라가는 stale 서술)를 이미 별도로 이름 붙여 추적하고 있다
    (`plan/in-progress/spec-sync-external-interaction-api-gaps.md` "타 문서가 EIA 의 현재 형태를
    못 따라간 서술" 절 — `15-chat-channel.md` 의 `InteractionRequestContext` stale 서술 사례가
    동일 유형).
  - 제안: `spec_impact` 에 `spec/5-system/13-replay-rerun.md` 를 추가하고, §10.2 콜아웃을
    §R17 갱신과 **같은 커밋에서** 갱신한다(예: "카브아웃은 닫혔다 — 프런트 마커 가드가
    프리필/제출을 막는다" 로 정정 + 가드 동작 요약). `MASKED_INPUT_DATA_REASON` 상수를
    반전하지 않고 이름을 유지한 채 의미만 바꾸는 경우에도, 두 문서의 링크 텍스트("egress
    마스킹 대상이 아니다")는 그대로 두면 거짓이 된다.

- **[INFO] `spec/3-workflow-editor/3-execution.md §2.2` "히스토리 로드" 행에 마커 가드 캐비엇 누락**
  - target 위치: `spec/3-workflow-editor/3-execution.md` §2.2 기능 표, "히스토리 로드" 행
    (line 91: `... 해당 실행의 inputData 를 textarea 에 적재 (editor-toolbar.tsx)`)
  - 과거 결정 출처: 같은 결정을 다루는 `13-replay-rerun.md §10.2` 콜아웃이 "에디터의 '히스토리에서
    불러오기' 도 같은 컬럼을 같은 방식으로 재사용하므로 동일하게 적용된다" 고 명시 — 즉 이 spec 이
    §10.2 의 서술 범위 안에 있다고 상호 참조되어 있음에도, 정작 이 표 자체에는 마스킹/가드 관련
    캐비엇이 전혀 없다(현재는 사실을 서술만 하고 있어 "틀린" 것은 아니지만, 가드가 생기면 UX 가
    바뀌므로 완전성이 깨진다).
  - 상세: 이 프로젝트는 폼 프리필 가드(#1181) 때 동일 패턴의 캐비엇을 유저 가이드에 추가하는 것을
    트래커 항목으로 별도 등재했다(`spec-sync-external-interaction-api-gaps.md` "유저 가이드 Error
    탭에도 마스킹 캐비엇" 항목) — 즉 "UI 캐비엇을 붙인다" 가 이 프로젝트의 일관된 관행이다. plan
    체크리스트의 "에디터 히스토리 로드 마커 가드" 항목이 코드만 언급하고 이 spec 표는 언급하지
    않는다.
  - 제안: 가드 구현 시 이 행에 "마스킹된 필드(마커) 가 남아 있으면 재실행이 차단됨" 캐비엇 한 줄
    추가. CRITICAL/WARNING 아님 — 현재 서술이 거짓이 되는 것은 아니라서 INFO.

- **[WARNING] "정확 일치만 잡는다 (의도)" 경계 원칙이 두 번째 소비처(에디터 히스토리)의 설계에서
  실측 확인되지 않았다**
  - target 위치: plan §"설계 — 두 소비처의 가드가 왜 서로 다른가" — "히스토리 로드 = 제출 차단:
    ... 마커를 그대로 보이게 두고, JSON 안에 마커가 남아 있는 동안 실행 버튼을 막는다"
  - 과거 결정 출처: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` 의
    `isMaskedMarker` JSDoc — "**보장의 경계 — 정확 일치만 잡는다 (의도)** ... 부분 포함으로
    넓히지 않는 이유: `a***b` 처럼 마커를 우연히 포함할 뿐인 정상 기본값까지 비우게 되어 ...
    오탐 비용이 미탐 비용보다 크다". 이 함수가 SoT 로 지목하는 backend `sanitize-error-message.ts`
    의 마커 집합(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)과 "마커 집합이 어긋나면 가드가 조용히
    뚫린다" 원칙은 `14-external-interaction-api.md §R17` "프리필 왕복" 불릿에도 그대로 적혀 있다.
  - 상세: Re-run 모달(#1181 과 "같은 형태")은 필드 단위 값이라 `isMaskedMarker` 를 그대로 재사용해
    정확 일치를 유지하기 쉽다. 그러나 에디터 히스토리 쪽은 **JSON 텍스트 전체**(`jsonInput` 문자열
    state, `editor-toolbar.tsx` 실측: `setJsonInput(JSON.stringify(detail.inputData ?? {}, null,
    2))`, `JSON.parse(jsonInput)` 로 파싱)를 다룬다. 여기서 "마커가 남아 있는가" 를 raw 문자열
    부분포함(`jsonInput.includes('***')` 류)으로 판단하면, 마크다운 강조(`***bold***`)처럼 값
    안에 우연히 3개 이상의 `*` 이 연속되는 정상 입력에서도 오탐이 나 실행 버튼이 부당하게
    막힌다 — 이는 `isMaskedMarker` 가 명시적으로 기각한 "부분 포함으로 넓히기" 와 같은 형태의
    설계다. 반대로 로드 시점에 확보한 파싱된 `inputData` 객체(또는 매 변경마다 `JSON.parse` 한
    결과)를 재귀적으로 순회해 각 leaf 값에 `isMaskedMarker` 를 적용하면 경계를 유지할 수 있다.
    plan 은 이 메커니즘을 명시하지 않았다.
  - 제안: 구현 시 raw substring 검색이 아니라 "파싱 성공 시 leaf 값 순회 + `isMaskedMarker`
    재사용(그대로 import, 재구현 금지)" 로 경계를 유지한다. 파싱 실패(사용자가 편집 중이라 JSON
    이 일시적으로 무효인) 상태의 fallback 정책(직전 유효 파싱 결과 유지 vs. 보수적으로 차단 유지)도
    함께 명시해 두면, 이 시리즈가 이미 두 번 겪은 "마커 미러가 어긋나 가드가 조용히 fail-open"
    (`spec-sync-external-interaction-api-gaps.md` "마커 미러 계약 테스트" 항목, 반복 지적)과 같은
    성격의 세 번째 반복을 피할 수 있다.

- **[INFO] R17 catalog 확장 시 번호 표기 규약(아라비아 숫자) 준수 상기**
  - target 위치: `14-external-interaction-api.md §R17`, "적용 범위는 총칭이 아니라 열거다" 불릿 —
    `> 표면 번호를 아라비아 숫자로 적는다 — 같은 절의 "잔여 ①②③" 이 원형숫자를 쓰므로 두 열거가
    글리프를 공유하면 인용이 섞인다 (23_49_05 naming W1).`
  - 과거 결정 출처: 위 인용 자체(같은 §R17 절 내부에 이미 명시된 규약).
  - 상세: plan 체크리스트("캐너리 4건 방향 반전")와 그 근거인
    `spec-sync-external-interaction-api-gaps.md` 는 테스트 캐너리를 `①`(findById)·`②`
    (findByWorkflow)·`⑧`(getChain)·`⑧-b`(stop) 로 원형숫자 표기한다. 이는 트래커/테스트 문맥의
    별개 번호 체계이지만, "표면 여섯, 컬럼 둘" 카탈로그를 갱신해 `inputData` 를 7번째 표면으로
    편입할 때 이 원형숫자 표기를 그대로 옮겨 적으면 R17 이 스스로 경고한 "인용이 섞이는" 사고를
    재현한다.
  - 제안: R17 카탈로그 갱신 시 아라비아 숫자만 사용하고, "표면 여섯, 컬럼 둘" 요약 수치도
    (`inputData` 편입 후) 갱신한다 — 이 문서는 이미 한 번 "넷" 이라는 수치가 낡아 있었던 전례가
    있다("종전 이 자리는 '`ExecutionsService` 4경로' 였는데 ... '넷' 이라는 수치가 이미 낡아
    있었다").

## 요약

target(`spec/5-system/`, 미변경)과 그 위에서 착수하려는 `eia-inputdata-marker-guard` 계획은
`§R17 "잔여 ②"` 가 이미 예정해 둔 절차(프런트 마커 가드 선행 → `Execution.inputData` egress
마스킹 전환)를 그대로 따르고 있어, **기각된 대안의 재도입이나 합의 원칙의 직접 위반은 없다** —
오히려 이 저장소의 Rationale 관행(카브아웃/마스킹 전환 판단 기준, egress-only, boundary
parity, 마커 SoT-미러) 을 이례적으로 충실히 따르고 있다. 다만 (1) 같은 결정을 재-단언하는
두 번째 정본 위치(`13-replay-rerun.md §10.2`)가 plan 의 spec 갱신 범위 밖에 있어, 계획대로
R17 만 고치면 두 spec 문서가 서로 모순되는 상태로 남을 위험이 높고, 이는 이 프로젝트가 이미
별도로 이름 붙여 추적 중인 실패 유형과 같다. (2) 두 번째 소비처(에디터 히스토리)의 마커 감지
메커니즘이 아직 미정이라, 구현 방식에 따라 `isMaskedMarker` 가 명시적으로 기각한 "부분 포함
매칭" 을 재도입할 위험이 있다. 두 사안 모두 CRITICAL 은 아니며 impl-prep 단계에서 체크리스트에
한두 줄을 추가하는 것으로 충분히 예방 가능하다.

## 위험도

MEDIUM
