# 요구사항(Requirement) 리뷰 — `nodeOutput` fail-closed allowlist (EIA §R17 잔여)

## 검토 범위 및 방법

`git diff` 대상 15개 파일 중 실제 런타임 로직 변경은 4개(`interaction.service.ts`,
`strip-external-only-fields.ts` + 각 `.spec.ts`)이고, 나머지는 plan 문서·직전
`/consistency-check --impl-prep` 산출물(review/consistency/.../18_30_40/*)·이번 작업이
반영한 `spec/5-system/14-external-interaction-api.md` §R17 갱신이다. 코드는 `Read` 로 전문을
직접 열어 대조했고, `codebase/backend/src/nodes/core/node-handler.interface.ts` (`NodeHandlerOutput`
정의)와 `spec/conventions/node-output.md` Principle 0/4.2.1 (`_resumeState`/`_resumeCheckpoint`/
`_retryState` 예외 레지스트리)을 직접 읽어 allowlist 상수와 line-level 대조했다. 해당 spec·유틸
테스트를 `npx jest strip-external-only-fields.spec.ts interaction.service.spec.ts` 로 직접
재실행해 133건 전부 통과를 확인했다(공유 worktree 뮤테이션 금지 관행에 따라 `NODE_OUTPUT_ALLOWED_KEYS`
자체를 변형하는 뮤테이션 재현은 하지 않고, TS 조건부 타입 배분 규칙으로 `assertAllowlistCoversHandlerContract`
의 동작을 정적으로 검증했다).

## 발견사항

- **[INFO]** plan 상위 트래커 체크박스 flip 이 실제로는 완료됐는데 하위 plan 의 작업 체크리스트 항목은 미체크로 남아 있다
  - 위치: `plan/in-progress/nodeoutput-allowlist.md:84` (`- [ ] 상위 트래커 체크박스 flip + 근거 기록`)
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 를 직접 열어 확인한 결과
    `- [x] **getStatus 일반 nodeOutput 키-allowlist**` 로 이미 flip 되어 있고 종결 근거(2026-08-23)까지
    적혀 있다(같은 diff 의 파일 6). 즉 작업 자체는 끝났는데, 그 완료를 추적하는
    `nodeoutput-allowlist.md` 쪽 체크박스만 갱신이 누락됐다. 기능 결함은 아니지만 이 저장소가
    이미 겪은 "plan 체크박스 ≠ 실제 상태" 패턴과 같은 모양이라 남긴다.
  - 제안: `nodeoutput-allowlist.md:84` 를 `[x]` 로 flip.

- **[INFO]** `NODE_OUTPUT_ALLOWED_KEYS` JSDoc의 "타입에서 파생" 표현은 실제로는 손으로 맞춘 리터럴 배열이다
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:107` 부근 JSDoc
    ("## 이 목록은 **타입에 결속**돼 있다 — 산문 주장이 아니다")
  - 상세: 이미 `review/consistency/2026/08/23/18_30_40/rationale_continuity.md` INFO#2 로 지적·기록된
    사항이다. `NODE_OUTPUT_ALLOWED_KEYS` 자체는 `keyof NodeHandlerOutput` 로부터 자동 생성된 것이
    아니라 손으로 옮겨 적은 리터럴이고, `assertAllowlistCoversHandlerContract` 가 컴파일타임에
    "누락 없음"만 보장한다(초과분은 감지하지 않음 — 예: `NodeHandlerOutput` 에서 `port` 가 제거돼도
    이 assertion 은 안 깨진다). 다만 fail-closed 방향이라 보안 리스크는 아니며 이미 알려진 낮은
    우선순위 항목이라 중복 CRITICAL/WARNING 으로 재기재하지 않는다.
  - 제안: 별도 조치 불요(추적 중). spec 착지 시 JSDoc 표현만 정정 권고.

## 기능 완전성 / 에러 시나리오 / 데이터 유효성 / 반환값 — 실측 확인된 항목

- `allowlistNodeOutputKeys<T>(value: T): T` (`strip-external-only-fields.ts:179`)는 null/`typeof !== 'object'`/배열
  입력을 그대로 통과시키고(엣지 케이스), 떨어뜨릴 키가 없으면 **동일 참조**를 반환하며(copy-on-change,
  waiting 폴링 빈도 고려), 원본을 변형하지 않는다(spread + `delete` 조합, `__proto__` own-property
  경유라 프로토타입 오염 없음) — 대응 캐너리(`strip-external-only-fields.spec.ts:190-291`) 9건 전부
  통과 확인.
- `PublicHandlerOutputKey = Exclude<keyof NodeHandlerOutput, '_resumeState' | '_retryState'>` 와
  `NODE_OUTPUT_ALLOWED_KEYS` 리터럴을 `node-handler.interface.ts:304-336` 원문과 직접 대조한 결과
  `config`/`output`/`meta`/`port`/`status` 5개 공개 키가 정확히 일치한다. 조건부 타입
  `PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number] ? true : never`는
  `PublicHandlerOutputKey` 가 (타입 매개변수가 아닌) 확정된 union 이므로 **배분되지 않고** 부분집합
  검사로 평가된다 — 새 공개 키가 추가되면 `never` 타입에 `true` 를 대입하는 형태가 되어 실제로
  빌드가 깨진다는 plan 의 주장과 일치한다.
- `interaction.service.ts` 의 `getStatus()` 3개 출구를 전수 확인: waiting `nodeOutput`(라인
  `allowlistNodeOutputKeys(stripAndRedact(nodeExec.outputData) ?? {})`)만 fail-closed allowlist가
  걸리고, terminal `result`/`error`(`stripAndRedact(execution.outputData)`만, allowlist 미적용)는
  의도적으로 제외된다 — `Execution.outputData` 는 `NodeHandlerOutput` shape 이 아니라 작성자 정의
  워크플로 출력이라는 근거가 코드 주석과 spec 갱신분(`spec/5-system/14-external-interaction-api.md`
  §R17 신규 표) 양쪽에 동일하게 기재돼 있다. `buttons`/`form`/`ai_conversation` 두 분기
  (`interaction.service.ts:424-435`) 모두 필터링된 `out` 을 쓰므로 한쪽만 걸리는 누락은 없다.
- 배선 캐너리(`interaction.service.spec.ts:617-642`)가 `getStatus` → `allowlistNodeOutputKeys` 실제
  호출 경로를 직접 검증한다 — `_retryState`/`__unknownFutureKey` 는 사라지고 `config`/`meta`/`output`
  (폼 폴백이 쓰는 셋)만 남는 것을 확인. 유틸 단위 테스트만으로는 헬퍼-호출부 배선 누락을 못 잡는다는
  점(plan 의 M1 뮤테이션 관찰과 일치)이 이 캐너리로 보완된다.
- `NODE_OUTPUT_ALLOWED_KEYS` 에서 제외된 `_resumeCheckpoint`(`node-output.md` Principle 0/4.2.1 —
  `NodeExecution.outputData._resumeCheckpoint` 로 실제 영속됨)는 allowlist 에 명시 열거되지 않았지만
  **fail-closed 설계상 자동으로 차단**된다 — JSDoc 예외 목록이 3필드 중 2개만 언급하는 문서 정확성
  이슈일 뿐 동작 결함은 아니다(이미 `review/.../cross_spec.md` INFO#1 로 등재, 중복 기재하지 않음).

## 관련 spec 본문 일치 여부 (spec fidelity)

관련 spec 은 `spec/5-system/14-external-interaction-api.md` §R17이다. 이번 diff 자체에 spec 갱신분
(§R17 "해소 (2026-08-23)" 신규 표)이 포함돼 있고, 코드와 line-level 로 정확히 대응한다: 표의 4행
(`getStatus waiting nodeOutput` = fail-closed / `terminal result` = deny-list 유지·의도적 제외 /
`terminal error` = 〃 / `SSE·fanout emit` = deny-list 유지·잔여)이 `interaction.service.ts` 의 실제
3-출구 분기 및 `websocket.service.ts` `toFanoutEnvelope`(변경 없음, 여전히 `stripExternalOnlyFields`만
적용)와 정확히 일치한다. "SSE 잔여는 정본 트래커에 별도 항목으로 등재돼 있다"는 서술도
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 신규 불릿(파일 6, "SSE/fanout 의
`nodeOutput` 은 여전히 fail-open deny-list 다")과 실제로 대응한다. 직전 `/consistency-check
--impl-prep`(`18_30_40`)이 WARNING 2건(rationale_continuity #1, plan_coherence #2)으로 지적한
"3-출구 열거 원칙이 spec에 반영되지 않음" / "SSE 비대칭이 plan에 미등재"는 이번 diff에 포함된 spec 표
+ 신규 tracker 항목으로 **둘 다 실제로 해소**돼 있음을 확인했다 — spec 과 코드 사이에 남은
불일치(CRITICAL 급)는 발견하지 못했다. `NodeHandlerOutput` shape 근거로 terminal 출구를 제외한 판단도
`spec/conventions/node-output.md` 의 5필드 invariant(Principle 0)와 충돌하지 않는다.

## 요약

핵심 로직(`allowlistNodeOutputKeys` + `NODE_OUTPUT_ALLOWED_KEYS` 컴파일타임 결속 + `getStatus` 배선)은
의도한 fail-open → fail-closed 전환을 정확히 구현했고, 엣지 케이스(null/원시값/배열/변형 없음/참조
동일성)와 세 출구 중 어디에 적용·미적용되는지의 범위 결정 모두 코드·테스트·spec·plan 네 곳에서
서로 정합하게 기록돼 있다. 직전 consistency-check 가 지적한 "부분 해소를 전체로 flip" 위험(WARNING 2건)은
이번 diff 자체에 포함된 spec 표·신규 tracker 항목으로 실제로 해소됐음을 원문 대조로 확인했다.
남은 것은 기능에 영향 없는 문서 정확성 수준의 INFO 2건(상위 plan 체크박스 미동기화, allowlist
"타입 파생" 표현의 사소한 과장 — 둘 다 이미 이전 리뷰에서 인지·추적 중)뿐이다.

## 위험도
NONE
