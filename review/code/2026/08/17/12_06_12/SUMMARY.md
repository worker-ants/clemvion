# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 기능적으로는 EIA §R17 마스킹 왕복-오염(폼 `defaultValue` 프리필이 마스킹 마커를 그대로 되쓰는 문제)을 정확히 겨냥한 방어적 수정이며 Critical 은 없음. 다만 신규 회귀 테스트 2건이 뮤테이션으로 vacuous 함이 실측 확인됐고(WARNING), 마스킹 가드 자체도 "부분-매치" 마스킹 결과에는 여전히 동일 클래스의 데이터 오염이 남는다(WARNING). CHANGELOG 갱신 누락(WARNING), muted-text 클래스 오사용으로 안내문구가 안 보일 가능성(WARNING), 미러 상수/함수 명명 불일치로 grep 동기화가 실패하는 문제(WARNING)까지 포함해 WARNING 6건이 누적되어 있어 LOW 가 아닌 MEDIUM 으로 판정한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | "제출 payload 에 마커가 실리지 않는다" 테스트가 `fireEvent.submit(button)` 을 써서 버튼 `type="submit"` 배선을 검증하지 못한다 — `type="button"` 으로 뮤테이션해도 이 테스트만 GREEN 유지(vacuous), 같은 파일의 다른 13개 `fireEvent.click` 기반 제출 테스트는 정상 RED | `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:664` (구현: `dynamic-form-ui.tsx:470`) | `fireEvent.submit(button)` → `fireEvent.click(button)` 으로 통일 |
| 2 | testing | 마스킹 안내 힌트가 "마스킹되지 않은 필드에서는 뜨지 않아야 한다"는 음의 단언이 없다 — 힌트 노출 조건을 `true &&` 로 뮤테이션(항상 노출)해도 전체 23건 GREEN(vacuous) | `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:614-633` (구현: `dynamic-form-ui.tsx:459`) | 마스킹 안 된 필드에서 힌트 텍스트 `not.toBeInTheDocument()` 부재 단언 추가 |
| 3 | security / requirement | 신규 가드 `isMaskedValue` 가 "값 전체가 마커와 정확 일치"하는 경우만 감지 — URI-내장 자격증명(`scheme://user:pass@host`→`scheme://***@host`) 등 부분-매치 마스킹 결과는 마커를 포함하되 정확 일치가 아니라서 그대로 프리필됨. 비밀 노출은 아니나 이 PR 이 막으려는 "조용한 데이터 오염"과 동일 클래스가 non-credential-키 필드에서 잔존 | `codebase/frontend/.../dynamic-form-ui.tsx:357-359` (`isMaskedValue`), `codebase/backend/.../sanitize-error-message.ts:35,42,51,118,120` (부분-매치 패턴) | 잔여 스코프를 spec/JSDoc 에 캐비엇으로 명시(정확 일치만 커버한다는 설계 의도 기록). 필수 조치는 아님 |
| 4 | documentation | `CHANGELOG.md` "Unreleased" 항목이 stale — 같은 마스킹 이니셔티브 직전 3커밋(#1177/#1179/#1180)은 모두 CHANGELOG 갱신했는데, 이번 커밋이 정확히 "트래커에 등재했다"고 서술된 프런트 마커 가드를 구현했음에도 CHANGELOG 는 미갱신 | `CHANGELOG.md:38-39` | "트래커에 등재했다" → "구현해 이 조건을 닫았다"로 갱신 또는 새 Unreleased 하위 항목 추가 |
| 5 | maintainability | 신규 안내 문구가 이 파일의 기존 muted-text 관용구(`text-[hsl(var(--muted-foreground))]`)를 벗어나 `text-muted-foreground` 유틸리티 클래스를 사용 — 이 저장소 Tailwind v4 설정엔 해당 클래스 매핑이 없어(`.text-muted-foreground` 규칙이 컴파일된 CSS 에 0건) 스타일 미적용(기본 전경색)으로 렌더링될 가능성 | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:460` | `text-[hsl(var(--muted-foreground))]` 로 통일 |
| 6 | maintainability | 마커 미러 상수/함수 이름이 backend SoT(`MASKED_MARKERS`/`isMaskedMarker`)와 frontend(`MASK_MARKERS`/`isMaskedValue`)가 달라 grep 기반 동기화 검색이 실패 — 같은 파일의 기존 `DEFAULT_FILE_*` 미러는 이름을 그대로 유지하는 선례가 있음 | `codebase/frontend/.../dynamic-form-ui.tsx:335,357` vs `codebase/backend/.../sanitize-error-message.ts:96-100,134` | `MASK_MARKERS`→`MASKED_MARKERS`, `isMaskedValue`→`isMaskedMarker` 로 명명 통일 (또는 다른 이유를 주석에 기록) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 7 | security / maintainability / side_effect / testing | 마스킹 마커 상수가 backend/frontend 두 곳에 수동 복제(SoT-미러) — 이미 이전 consistency-check 라운드(11_38_00, WARNING #3/#4)에서 식별·기록됨. 자동 동기화 검증(계약 테스트) 부재 | `codebase/frontend/.../dynamic-form-ui.tsx:335-339` vs `codebase/backend/.../sanitize-error-message.ts:96-100` | 공유 패키지로 추출하거나 두 상수 집합을 비교하는 회귀 테스트 추가(우선순위 낮음) |
| 8 | testing | 테스트 fixture 의 마커 리터럴이 (backend·frontend 에 이어) 세 번째로 복제됨 — `MASK_MARKERS` 가 export 안 돼 있어 재사용 불가하지만, fail-safe 방향(구현이 값 바꾸면 테스트가 RED) | `dynamic-form-ui.test.tsx:598` | `MASK_MARKERS` export 후 `it.each([...MASK_MARKERS])` 로 전환 |
| 9 | side_effect | `initialValueFor` 가 마커와 **정확 일치하는 정상 기본값**도 오탐으로 프리필을 건너뜀(리터럴로 그 문자열을 의도적으로 쓴 드문 경우) — 인지된 트레이드오프, 테스트로 부분-일치 보존은 확인됨 | `dynamic-form-ui.tsx:361-370` | 현행 유지 가능. 필요 시 spec/Rationale 에 한 줄 캐비엇 |
| 10 | documentation | plan 체크리스트 항목(`spec-sync-external-interaction-api-gaps.md`)이 `[x]` 로 완료 표시됐지만 하위 설명 문구는 과거 유예 서술("이번엔 Output 탭만 반영")을 그대로 유지해 완료 상태와 시제 불일치 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:301-303` | 하위 문장을 완료 시점 서술로 갱신 |
| 11 | requirement | spec §R17 "프리필 왕복" 신설 불릿이 Rationale 전용 — 이전부터 있던 구조적 갭(consistency-check WARNING #3, 이미 non-blocking 으로 기록)이 이번 불릿으로 아주 조금 넓어짐 | `spec/5-system/14-external-interaction-api.md` §R17 | 조치 불요 — 기존 WARNING #3 해소 시 함께 반영 |
| 12 | user_guide_sync | Form 노드 스키마 문서(`02-nodes/presentation.mdx`)에 신규 "마스킹된 defaultValue 프리필 스킵" UX 가 캐비엇으로 반영되지 않음(매트릭스가 지정한 `05-run-and-debug/` 타겟은 이미 충족) | `codebase/frontend/src/content/docs/02-nodes/presentation.mdx:198` (`defaultValue` 필드 설명) | 여력이 되면 한 문장 캐비엇 추가(필수 아님) |
| 13 | scope | `spec/**` 3개 파일이 함께 수정됨 — CLAUDE.md 일반 원칙과 표면적으로 다르나, 사전 `--impl-prep` 게이트를 통과한 저비용 문서 정합화(W1/W2)로 plan 체크리스트에 근거 명시됨 | `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/15-chat-channel.md` | 조치 불요 — 프로세스 참고 사항 |
| 14 | 기타 | `sanitize-error-message.ts` 변경은 JSDoc/상수 선언 재배치뿐, 로직·정규식·export 값 무변경(보안·유지보수성 영향 없음, 오히려 TSDoc 귀속 오류를 정정) | `codebase/backend/.../sanitize-error-message.ts:92-133` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 부분-매치 마스킹 잔여 오염(WARNING), SoT-미러 drift 위험(INFO), 새 인젝션/시크릿 없음 |
| requirement | NONE | 기능 완전성·spec fidelity 전부 일치. 부분-매치 잔여는 의도된 설계(INFO) |
| scope | NONE | diff 전량이 plan 체크리스트와 1:1 대응, 무관 변경 없음 |
| side_effect | LOW | 신규 공개 함수(순수), onSubmit payload 변경(의도됨), 정확 일치 오탐 엣지케이스 |
| maintainability | LOW | muted-text 클래스 오사용(WARNING), 미러 명명 불일치(WARNING) |
| testing | MEDIUM | 뮤테이션 실측으로 2건 vacuous 테스트 확인(WARNING), 핵심 가드 자체는 견고 |
| documentation | LOW | CHANGELOG stale(WARNING), plan 문구 시제 불일치(INFO), 그 외 문서화 완성도 높음 |
| user_guide_sync | LOW | Form 노드 스키마 문서에 캐비엇 누락(INFO), 매트릭스 타겟 자체는 충족 |

## 발견 없는 에이전트

없음 (전 8개 에이전트 모두 최소 INFO 이상 발견 보유, `scope`/`requirement` 는 실질 결함 없이 NONE).

## 권장 조치사항
1. (testing WARNING 1·2) 신규 describe 블록의 vacuous 테스트 2건 수정: `fireEvent.submit`→`fireEvent.click` 통일, 마스킹 안내 힌트에 "비마스킹 필드에서는 안 뜬다" 부재 단언 추가.
2. (documentation WARNING 4) `CHANGELOG.md` Unreleased 절을 이번 커밋의 실제 구현 상태로 갱신.
3. (maintainability WARNING 5) 안내 문구의 `text-muted-foreground` → `text-[hsl(var(--muted-foreground))]` 로 수정해 실제로 렌더링되도록 함.
4. (maintainability WARNING 6) 미러 상수/함수명(`MASK_MARKERS`/`isMaskedValue`)을 backend SoT 명명(`MASKED_MARKERS`/`isMaskedMarker`)과 통일해 향후 grep 기반 동기화 누락 방지.
5. (security/requirement WARNING 3) 부분-매치 마스킹 잔여 스코프를 spec Rationale 또는 JSDoc 에 명시적으로 캐비엇 기록(코드 수정은 선택, 문서화는 저비용 권장).
6. (INFO 7·8) 여력이 되면 backend↔frontend 마커 상수 동기화를 검증하는 계약 테스트 추가, 테스트 fixture 의 마커 리터럴을 `MASK_MARKERS` export 로 대체.

## 라우터 결정

- `routing_status`: `all` (라우터가 전체 reviewer 를 선택 — router 별도 skip 없음)
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — 전원 결과 확보됨 (forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (해당 없음) | 전원 실행됨 |