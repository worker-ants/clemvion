# 문서화(Documentation) 리뷰

## 발견사항

### [INFO] spec 내부 anchor 일괄 수정 — 문서 정확성 향상

- 위치: 파일 12-48 전체 (spec/*.md 변경 파일 다수)
- 상세: 변경된 파일의 대부분은 spec 내부 교차 참조 anchor slug 수정이다. 주요 패턴:
  - `#44-실행-진행-이벤트` → `#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input`
  - `#1-conditiongroup-구조` → `#1-condition-구조`
  - `#7-integration-노드-3종` → `#7-integration-노드-4종`
  - `#7-dry-run` → `#7-dry-run-모드-정의`
  - `#44-알림-이벤트-server--client` → `#44-알림-이벤트-server--client--계획미구현`
  이 수정들은 주석 정확성 관점에서 오래된/깨진 링크를 실제 heading slug 와 일치하도록 교정한 것으로 문서 품질에 긍정적이다.
- 제안: 없음.

### [INFO] `spec/5-system/_product-overview.md` — 시스템 영역 spec 맵 16개 신설

- 위치: `spec/5-system/_product-overview.md`
- 상세: 기존 3개 관련 문서 링크 블록이 16개 전 시스템 영역 spec 링크를 나열하는 독립 spec 맵으로 확장됐다. 인증/인가·API 규칙·에러 처리 3개 링크가 신규 맵 안에 포함되어 정보 손실 없이 13개 링크가 추가됐다. 신규 방문자가 시스템 영역 전체를 단일 진입점에서 탐색할 수 있게 된다.
- 제안: 없음. 영역 index 문서화 관점에서 명백한 개선.

### [INFO] `spec/2-navigation/_product-overview.md` — 내비게이션 화면 spec 맵 신설

- 위치: `spec/2-navigation/_product-overview.md`
- 상세: 내비게이션 화면 15개 spec 링크(워크플로우 목록·트리거 목록·스케줄 관리 등)를 한 블록으로 나열하는 spec 맵이 관련 문서 블록에 추가됐다. 영역 index 완전성 기여.
- 제안: 없음.

### [INFO] `spec/7-channel-web-chat/_product-overview.md` — 구성요소 spec 4개 링크 추가

- 위치: `spec/7-channel-web-chat/_product-overview.md`
- 상세: 위젯 SPA·SDK·인증·세션 흐름·보안 4개 구성요소 spec 링크가 관련 문서 블록에 추가됐다. 채널 웹챗 영역의 하위 spec 탐색 경로를 명시.
- 제안: 없음.

### [INFO] `spec/conventions/spec-impl-evidence.md` — Gate C 추가 및 §4.0 인접 가드 소절 신설

- 위치: `spec/conventions/spec-impl-evidence.md` §4
- 상세:
  1. 제목이 "4건" → "5건, 모두 build 차단" 으로 갱신됐고, 괄호 주석으로 §4.0 의 인접 가드·Gate D 가 이 5건 카운트에 포함되지 않음을 명시했다.
  2. Gate C (`spec-plan-completion.test.ts`) 행이 가드 테이블에 추가됐다.
  3. §4.0 소절이 신설되어 인접 지식저장소 가드 3개(`spec-link-integrity`, `spec-area-index`, `plan-frontmatter`)와 Gate D(advisory)를 목록 형태로 정리했다.
  4. `code:` frontmatter 에 `spec-plan-completion.test.ts` 경로가 추가되어 self-consistent 갱신이다.
- 평가: 실제 게이트 구성을 정확히 반영한 문서 갱신이며, 주석 정확성이 향상됐다. "5건, 모두 build 차단" 이라는 제목과 §4.0 의 설명("위 5건과 별개")이 명확히 분리되어 있어 이전 버전의 불명확함이 해소됐다.
- 제안: 없음.

### [WARNING] `spec/2-navigation/2-trigger-list.md` — API 링크 텍스트와 anchor 가리키는 섹션 의미 재확인 필요

- 위치: `spec/2-navigation/2-trigger-list.md` 줄 148-149, 267
- 상세: 두 API 행의 링크가 다음과 같이 변경됐다:
  - `SoT 는 [Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke)` → `SoT 는 [Spec EIA §7.1](../5-system/14-external-interaction-api.md#71-trigger-엔티티-확장)` (rotate-secret 행)
  - `SoT 는 [Spec EIA §7](../5-system/14-external-interaction-api.md#7-시크릿-회전--token-revoke)` → `SoT 는 [Spec EIA §7.3](../5-system/14-external-interaction-api.md#73-interactiontoken-in-memory--redis)` (revoke-token 행)
  두 API 가 이제 §7.1·§7.3 으로 각각 정밀하게 분기된 것은 개선이나, 링크 표시 텍스트 "Spec EIA §7.1"·"Spec EIA §7.3" 이 각각 "Trigger 엔티티 확장"·"InteractionToken in-memory / Redis" 를 가리킨다는 것이 맥락 없이는 직관적이지 않다. rotate-secret 의 SoT 로 "Trigger 엔티티 확장" 을 가리키는 것이 독자에게 충분히 명확한지 검토가 필요하다.
- 제안: 링크 텍스트를 `[Spec EIA §7.1 (Trigger 엔티티 확장)]` 또는 `[Spec EIA §7.1 시크릿 회전 컬럼]` 처럼 섹션 제목을 병기하거나, `spec/5-system/14-external-interaction-api.md` §7.1 에 해당 API 가 실제로 기술되어 있는지 명시적 확인 후 링크 텍스트를 섹션 내용을 반영하도록 조정하면 독자 혼동을 방지할 수 있다.

### [WARNING] `spec/conventions/node-cancellation.md` — `../../spec/5-system/` 상대 경로 패턴 잔존 (기존 문제)

- 위치: `spec/conventions/node-cancellation.md` 줄 106 (이번 변경에서 anchor 만 수정된 줄)
- 상세: `[실행 엔진 §1.2](../../spec/5-system/4-execution-engine.md#12-nodeexecution-상태)` 형태. `spec/conventions/` 에서 `../../spec/5-system/` 을 참조하는 경로는, 상위 2단계가 프로젝트 루트라면 올바른 경로는 `../5-system/4-execution-engine.md` 이어야 한다. 이번 변경은 동일 줄의 anchor 만 교정했고 경로 자체는 수정되지 않았다.
- 제안: `../../spec/5-system/` → `../5-system/` 경로 수정을 별도 링크 정합 작업 시 함께 처리할 것을 권장한다. 현재 동작은 repo root 기준으로 resolve 되어 기능적으로 broken 이 아니나 비관용적 패턴이다.

### [INFO] `spec/conventions/spec-impl-evidence.md` Gate D "advisory" 명확화 — 충분

- 위치: `spec/conventions/spec-impl-evidence.md` §4.0
- 상세: 이전 버전에서 Gate D 가 build 차단인지 advisory 인지 불명확했으나, 이번 변경에서 §4.0 에 "**advisory — build 차단 아님**" 을 명시하고 §4 제목 괄호 주석에 "§4.0 의 인접 가드·Gate D 는 이 5건 카운트에 포함되지 않는다" 를 추가했다. 문서화 관점의 모호성이 해소됐다.
- 제안: 없음.

### [INFO] `spec/4-nodes/3-ai/0-common.md` Rationale — `#62-제공-변수` → `#62-저장-전략` anchor 수정

- 위치: `spec/4-nodes/3-ai/0-common.md` Rationale 블록
- 상세: `[Spec 실행 엔진 §6.2](../../5-system/4-execution-engine.md#62-제공-변수)` → `#62-저장-전략` 로 수정. Rationale 문맥("KST 사용자가 UTC ISO8601 `$now` 로 9시간 어긋남 회귀")에서 §6.2 를 "저장 전략" 으로 가리키는 것이 의미상 "변수 제공"(이전 anchor) 보다 더 정확한지 재확인이 필요하다.
- 평가: 이미 requirement 리뷰어가 heading 실존 확인 완료(`## 6.2 저장 전략` 실존). 기계적 anchor 수정으로 정합. 다만 Rationale 맥락에서 §6.2 를 인용하는 이유("`$now` 가 UTC ISO8601" 설명)가 "저장 전략" 섹션보다 이전 "제공 변수" 섹션이 더 관련성이 있을 가능성이 있다. 이는 spec 리팩터링 과정에서 섹션 제목이 바뀐 것으로 추정되며 문서화 관점 이슈.
- 제안: `spec/5-system/4-execution-engine.md` §6.2 실제 내용을 확인하여 링크 의도("`$now` 변수 설명")와 섹션 내용("저장 전략")이 일치하는지 검토. 불일치 시 올바른 section anchor 로 재조정 필요.

### [INFO] 리뷰 산출물 파일들(파일 1-11) — 문서화 메타 이슈 없음

- 위치: `review/code/2026/06/03/23_42_50/` 및 `review/code/2026/06/04/00_10_01/` 하위 파일들
- 상세: 코드 리뷰 산출물 파일들은 정해진 리뷰 포맷을 따르고 있다. 문서화 관점(독스트링·API 문서·설정 문서 등)과 무관하다.
- 제안: 없음.

---

## 요약

이번 변경은 전반적으로 spec 내부 문서의 링크·anchor 정합성을 개선하는 작업이다. heading slug 변경을 따라가는 anchor 일괄 수정, 상대 경로 오류 수정, 파일명 변경 반영이 대부분을 차지한다. 독스트링·JSDoc·API 엔드포인트 문서·설정 문서 관점에서는 코드(구현) 변경이 없어 해당 사항이 없다. 긍정적 문서화 변경으로는 `_product-overview.md` 3곳의 영역 spec 맵 신설과 `spec-impl-evidence.md` 의 Gate C 추가 및 §4.0 Gate D advisory 명확화가 있다. 주의할 문서화 이슈는 두 가지다: (1) `trigger-list.md` 에서 rotate-secret / revoke-token API 의 SoT 링크가 §7 단일 앵커에서 §7.1·§7.3 으로 분리됐는데 링크 텍스트가 해당 섹션 주제("Trigger 엔티티 확장"·"InteractionToken")를 드러내지 않아 독자 혼동 가능성이 있고, (2) `node-cancellation.md` 의 `../../spec/5-system/` 경로 패턴이 이번 범위에서 수정되지 않고 잔존한다.

## 위험도

LOW

---

STATUS=success ISSUES=2
